/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { env, pipeline } from '@huggingface/transformers';
import {
  EngineError,
  type EngineImage,
  type EngineRegion,
  type LanguagePair,
  type ProgressReporter,
  type TextItem,
  type TranslationEngine,
} from '../types';
import { BubbleDetector, loadImage, type TextRegionDetector } from './bubbleDetector';

/**
 * NOT WORKING YET. Every public ONNX conversion of manga-ocr tested so far
 * fails, and this constant only records the least-bad one. Reading a page
 * offline does not work until a correct conversion exists.
 *
 * What was tried, and how each one failed:
 *
 * - onnx-community/manga-ocr-base-ONNX: no decoder_model_merged and no
 *   tokenizer files at all, so it 404s on load. Being tagged
 *   library_name: transformers.js is not the same as having the layout
 *   Transformers.js needs.
 * - ms57rd/manga-ocr-base-ONNX: loads, then returns an empty string for
 *   every image, including large clean text on white.
 * - DigitalLarynx/manga-ocr-onnx and xingliao/manga-ocr-onnx-full: load and
 *   return text, but the wrong text -- the same handful of unrelated kanji
 *   from all of them.
 *
 * Ruled out by experiment, so do not spend time on these again: dtype (q8,
 * fp32 and mixed all behave identically), image preprocessing (a clean
 * 224x224 render fails the same way), the tokenizer (the repo vocabulary and
 * kha-white's original decode the generated ids identically), the generation
 * config (matches the original), and the decoding strategy (beam and greedy
 * are identical). The generated ids interleave the decoder start token with
 * real ones, which points at the exported graph's cache branch rather than
 * anything callers control.
 *
 * The way out is to export ONNX from kha-white/manga-ocr-base directly with
 * Optimum, which produces a correct merged decoder, and host that.
 */
export const OCR_MODEL = 'ms57rd/manga-ocr-base-ONNX';
export const TRANSLATION_MODEL = 'Xenova/opus-mt-ja-en';

/**
 * What this engine can actually do. manga-ocr reads Japanese and nothing
 * else, and opus-mt-ja-en translates Japanese into English and nothing else,
 * so the engine refuses other pairs rather than returning something wrong.
 */
const READABLE_SOURCES = new Set(['auto', 'japanese', 'ja', 'jp', 'jpn']);
const WRITABLE_TARGETS = new Set(['english', 'en', 'eng']);

export interface OfflineEngineOptions {
  detector?: TextRegionDetector;
  /**
   * Where model files come from. Point this at a directory the shell ships
   * to make the app work on a device that has never been online.
   */
  localModelPath?: string;
  allowRemoteModels?: boolean;
  /** 'webgpu' is far faster where it exists; 'wasm' works everywhere. */
  device?: 'webgpu' | 'wasm';
  /** Quantization. Smaller is lighter; q8 is the sensible default. */
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16';
}

type AnyPipeline = (input: unknown, options?: unknown) => Promise<unknown>;

/**
 * Runs the whole pipeline on the user's own device: no account, no key, no
 * network once the models are cached.
 */
export class OfflineEngine implements TranslationEngine {
  readonly id = 'offline';
  readonly label = 'On this device (no account)';
  readonly kind = 'offline' as const;

  private readonly detector: TextRegionDetector;
  private readonly options: OfflineEngineOptions;
  private ocr: AnyPipeline | null = null;
  private translator: AnyPipeline | null = null;
  private preparing: Promise<void> | null = null;

  constructor(options: OfflineEngineOptions = {}) {
    this.detector = options.detector ?? new BubbleDetector();
    this.options = options;
  }

  async prepare(onProgress?: ProgressReporter): Promise<void> {
    // Concurrent callers share one load instead of pulling the models twice.
    if (!this.preparing) {
      this.preparing = this.loadModels(onProgress).catch((error) => {
        this.preparing = null;
        throw error;
      });
    }
    return this.preparing;
  }

  private async loadModels(onProgress?: ProgressReporter): Promise<void> {
    if (this.options.localModelPath) {
      env.localModelPath = this.options.localModelPath;
      env.allowLocalModels = true;
    } else {
      // Otherwise Transformers.js probes this app's own origin for every
      // model file first, so each one costs a 404 round trip before it even
      // reaches the Hub.
      env.allowLocalModels = false;
    }
    if (this.options.allowRemoteModels === false) {
      env.allowRemoteModels = false;
    }

    const device = this.options.device ?? 'wasm';
    const dtype = this.options.dtype ?? 'q8';

    const report = (what: string) => (progress: { status?: string; progress?: number }) => {
      onProgress?.({
        stage: 'preparing',
        message: `${what}: ${progress?.status ?? 'loading'}`,
        ratio: typeof progress?.progress === 'number' ? progress.progress / 100 : undefined,
      });
    };

    try {
      this.ocr = (await pipeline('image-to-text', OCR_MODEL, {
        device,
        dtype,
        progress_callback: report('Japanese text reader'),
      })) as unknown as AnyPipeline;

      this.translator = (await pipeline('translation', TRANSLATION_MODEL, {
        device,
        dtype,
        progress_callback: report('Japanese to English translator'),
      })) as unknown as AnyPipeline;
    } catch (error) {
      throw new EngineError(
        'MODEL_LOAD_FAILED',
        `Could not load the on-device models: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  async detectAndTranslate(
    image: EngineImage,
    langs: LanguagePair,
    onProgress?: ProgressReporter,
  ): Promise<EngineRegion[]> {
    assertSupported(langs);
    await this.prepare(onProgress);

    onProgress?.({ stage: 'detecting', message: 'Looking for speech bubbles' });
    const boxes = await this.detector.detect(image);
    if (boxes.length === 0) return [];

    const source = await loadImage(image.dataUrl);
    const regions: EngineRegion[] = [];

    for (let index = 0; index < boxes.length; index += 1) {
      onProgress?.({
        stage: 'reading',
        message: `Reading bubble ${index + 1} of ${boxes.length}`,
        ratio: index / boxes.length,
      });
      const crop = cropToDataUrl(source, boxes[index].box);
      const ocrText = await this.readText(crop);
      if (!ocrText) continue;

      regions.push({
        id: `off_${Date.now().toString(36)}_${index}`,
        box: boxes[index].box,
        // The detector finds enclosed bubbles, so that is what these are. It
        // cannot tell a narrator box from a bubble, and does not pretend to.
        type: 'bubble',
        ocrText,
        translatedText: '',
      });
    }

    const translations = await this.translateTexts(
      regions.map((region) => ({ id: region.id, type: region.type, text: region.ocrText })),
      langs,
      onProgress,
    );

    return regions.map((region) => ({
      ...region,
      translatedText: translations[region.id] ?? '',
    }));
  }

  async translateTexts(
    items: TextItem[],
    langs: LanguagePair,
    onProgress?: ProgressReporter,
  ): Promise<Record<string, string>> {
    assertSupported(langs);
    if (items.length === 0) return {};
    await this.prepare(onProgress);

    const out: Record<string, string> = {};
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.text.trim()) continue;
      onProgress?.({
        stage: 'translating',
        message: `Translating ${index + 1} of ${items.length}`,
        ratio: index / items.length,
      });
      const translated = await this.runTranslator(item.text);
      // An empty result stays empty. The caller shows the original rather
      // than a placeholder dressed up as a translation.
      if (translated) out[item.id] = translated;
    }
    return out;
  }

  private async readText(dataUrl: string): Promise<string> {
    if (!this.ocr) throw new EngineError('MODEL_LOAD_FAILED', 'The text reader is not loaded.');
    const result = await this.ocr(dataUrl);
    return firstString(result, 'generated_text');
  }

  private async runTranslator(text: string): Promise<string> {
    if (!this.translator) {
      throw new EngineError('MODEL_LOAD_FAILED', 'The translator is not loaded.');
    }
    const result = await this.translator(text);
    return firstString(result, 'translation_text');
  }

  dispose(): void {
    this.ocr = null;
    this.translator = null;
    this.preparing = null;
  }
}

function assertSupported(langs: LanguagePair): void {
  const source = langs.source.trim().toLowerCase();
  const target = langs.target.trim().toLowerCase();
  if (!READABLE_SOURCES.has(source)) {
    throw new EngineError(
      'UNSUPPORTED',
      `The on-device reader only reads Japanese, so it cannot handle ${langs.source}. Use the AI engine for that language.`,
    );
  }
  if (!WRITABLE_TARGETS.has(target)) {
    throw new EngineError(
      'UNSUPPORTED',
      `The on-device translator only writes English, so it cannot produce ${langs.target}. Use the AI engine for that language.`,
    );
  }
}

/** Transformers.js returns either an object or a one-element array of them. */
function firstString(result: unknown, key: string): string {
  const entry = Array.isArray(result) ? result[0] : result;
  const value = (entry as Record<string, unknown> | null)?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function cropToDataUrl(source: HTMLImageElement, box: { x: number; y: number; width: number; height: number }): string {
  const x = Math.round((box.x / 100) * source.width);
  const y = Math.round((box.y / 100) * source.height);
  const width = Math.max(1, Math.round((box.width / 100) * source.width));
  const height = Math.max(1, Math.round((box.height / 100) * source.height));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new EngineError('UNSUPPORTED', 'This browser would not give us a 2D canvas to crop with.');
  }
  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}
