/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ort from 'onnxruntime-web';
import { context2d, createCanvas } from '../../lib/image';
import { EngineError, type ProgressReporter } from '../types';

/**
 * Reads Japanese text out of a cropped image with manga-ocr, driving ONNX
 * Runtime directly instead of going through a Transformers.js pipeline.
 *
 * It has to be done this way. manga-ocr's decoder is BERT, which has no past
 * key values, so no merged decoder can exist for it -- Optimum refuses to
 * export one -- while the Transformers.js pipeline will not load an
 * encoder-decoder without `decoder_model_merged.onnx`. Those cannot both be
 * satisfied, so the generation loop lives here.
 *
 * Without a cache the loop is simply: run the encoder once, then feed the
 * whole sequence so far to the decoder at each step and take the last
 * position's argmax. That is quadratic in the length of the text, which does
 * not matter when the text is one speech bubble.
 */

/** ViT input side; the encoder's position embedding assumes exactly this. */
const IMAGE_SIZE = 224;
/** From the model's config: [CLS] starts the sequence, [SEP] ends it. */
const START_TOKEN = 2;
const EOS_TOKEN = 3;
/** A bubble that runs longer than this is a runaway, not a bubble. */
const MAX_TOKENS = 64;

let runtimeConfigured = false;

/**
 * ONNX Runtime fetches its .wasm by URL at run time, so no bundler resolves
 * it and the request otherwise falls through to the SPA fallback -- the
 * runtime is then handed index.html and fails on the magic word, reporting
 * "found 3c 21 64 6f", which is the start of "<!doctype html>". Point it at
 * the copy this app serves itself.
 *
 * Threads are off deliberately: they need SharedArrayBuffer, which needs
 * cross-origin isolation headers a packaged app cannot count on.
 */
function configureRuntime(wasmPath?: string): void {
  if (runtimeConfigured) return;
  // Left unset, the runtime resolves its files relative to its own module,
  // which is what `optimizeDeps.exclude` in vite.config.ts makes possible.
  // A shell that relocates them can still say where they went.
  if (wasmPath) ort.env.wasm.wasmPaths = wasmPath;
  ort.env.wasm.numThreads = 1;
  runtimeConfigured = true;
}

export interface MangaOcrOptions {
  /**
   * Where `onnx/encoder_model.onnx`, `onnx/decoder_model.onnx` and
   * `vocab.txt` are served from, with no trailing slash.
   */
  modelUrl: string;
  /** 'webgpu' where available; 'wasm' works everywhere. */
  executionProviders?: string[];
  /** Where ONNX Runtime's own .wasm files are served from. */
  wasmPath?: string;
}

export class MangaOcrReader {
  private encoder: ort.InferenceSession | null = null;
  private decoder: ort.InferenceSession | null = null;
  private vocab: string[] = [];
  private loading: Promise<void> | null = null;

  constructor(private readonly options: MangaOcrOptions) {}

  /** Loads the two graphs and the vocabulary. Safe to call repeatedly. */
  async load(onProgress?: ProgressReporter): Promise<void> {
    if (!this.loading) {
      this.loading = this.loadOnce(onProgress).catch((error) => {
        this.loading = null;
        throw error;
      });
    }
    return this.loading;
  }

  private async loadOnce(onProgress?: ProgressReporter): Promise<void> {
    const base = this.options.modelUrl.replace(/\/+$/, '');
    const providers = this.options.executionProviders ?? ['wasm'];
    configureRuntime(this.options.wasmPath);

    try {
      onProgress?.({ stage: 'preparing', message: 'Fetching the Japanese text reader' });
      const [encoderBytes, decoderBytes, vocabText] = await Promise.all([
        fetchBytes(`${base}/onnx/encoder_model.onnx`),
        fetchBytes(`${base}/onnx/decoder_model.onnx`),
        fetchText(`${base}/vocab.txt`),
      ]);

      onProgress?.({ stage: 'preparing', message: 'Starting the Japanese text reader' });
      this.encoder = await ort.InferenceSession.create(encoderBytes, { executionProviders: providers });
      this.decoder = await ort.InferenceSession.create(decoderBytes, { executionProviders: providers });
      this.vocab = vocabText.split(/\r?\n/);
    } catch (error) {
      throw new EngineError(
        'MODEL_LOAD_FAILED',
        `Could not load the Japanese text reader: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /** Reads one cropped region. Returns '' when the model finds no text. */
  async read(source: CanvasImageSource): Promise<string> {
    if (!this.encoder || !this.decoder) {
      throw new EngineError('MODEL_LOAD_FAILED', 'The Japanese text reader is not loaded.');
    }

    const { last_hidden_state: encoderStates } = await this.encoder.run({
      pixel_values: toPixelValues(source),
    });

    const ids: number[] = [START_TOKEN];
    for (let step = 0; step < MAX_TOKENS; step += 1) {
      const inputIds = new ort.Tensor(
        'int64',
        BigInt64Array.from(ids, (id) => BigInt(id)),
        [1, ids.length],
      );
      const { logits } = await this.decoder.run({
        input_ids: inputIds,
        encoder_hidden_states: encoderStates,
      });

      const next = argmaxAtLastPosition(logits, ids.length);
      if (next === EOS_TOKEN) break;
      ids.push(next);
    }

    // The model emits [CLS] of its own accord before the first character, so
    // drop every special token rather than only the one we seeded with.
    return ids
      .map((id) => this.vocab[id] ?? '')
      .filter((token) => token && !/^\[.*\]$/.test(token))
      .join('');
  }

  dispose(): void {
    this.encoder = null;
    this.decoder = null;
    this.vocab = [];
    this.loading = null;
  }
}

/** Highest-scoring token at the sequence's last position. */
function argmaxAtLastPosition(logits: ort.Tensor, sequenceLength: number): number {
  const vocabSize = logits.dims[2];
  const offset = (sequenceLength - 1) * vocabSize;
  const scores = logits.data as Float32Array;
  let best = 0;
  let bestScore = -Infinity;
  for (let token = 0; token < vocabSize; token += 1) {
    const score = scores[offset + token];
    if (score > bestScore) {
      bestScore = score;
      best = token;
    }
  }
  return best;
}

/**
 * Squashes the crop to 224x224 and normalises it the way the model's
 * preprocessor does: rescale to 0..1, then (v - 0.5) / 0.5. The aspect ratio
 * is deliberately not preserved -- manga-ocr was trained on square-resized
 * crops, and a config that keeps the ratio produces a non-square tensor that
 * breaks the position embedding outright.
 */
function toPixelValues(source: CanvasImageSource): ort.Tensor {
  const canvas = createCanvas(IMAGE_SIZE, IMAGE_SIZE);
  const ctx = context2d(canvas, { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
  const { data } = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);

  const plane = IMAGE_SIZE * IMAGE_SIZE;
  const out = new Float32Array(3 * plane);
  for (let pixel = 0, rgba = 0; pixel < plane; pixel += 1, rgba += 4) {
    out[pixel] = data[rgba] / 127.5 - 1;
    out[pixel + plane] = data[rgba + 1] / 127.5 - 1;
    out[pixel + 2 * plane] = data[rgba + 2] / 127.5 - 1;
  }
  return new ort.Tensor('float32', out, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return response.text();
}
