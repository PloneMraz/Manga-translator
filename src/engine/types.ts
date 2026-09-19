/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BoundingBox, RegionType } from '../types';

/** A page handed to an engine, exactly as the user supplied it. */
export interface EngineImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * The language pair for one request. Never baked into an engine: the user
 * chooses it, and "auto" lets an engine that can detect the script do so.
 */
export interface LanguagePair {
  source: string;
  target: string;
}

export interface EngineRegion {
  id: string;
  box: BoundingBox;
  type: RegionType;
  ocrText: string;
  translatedText: string;
}

export interface TextItem {
  id: string;
  type: RegionType;
  text: string;
}

export type EngineStage = 'preparing' | 'detecting' | 'reading' | 'translating';

export interface EngineProgress {
  stage: EngineStage;
  message: string;
  /** 0..1 where the engine can measure it; omitted where it cannot. */
  ratio?: number;
}

export type ProgressReporter = (progress: EngineProgress) => void;

export type EngineErrorCode =
  | 'MISSING_API_KEY'
  | 'UPSTREAM_FAILED'
  | 'MODEL_LOAD_FAILED'
  | 'BAD_RESPONSE'
  | 'UNSUPPORTED';

/**
 * Engines fail loudly. Nothing in this layer may invent a region, a
 * transcription or a translation to paper over an error: a caller that cannot
 * tell a failure from a result is worse off than one handed an exception.
 */
export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly detail?: unknown;

  constructor(code: EngineErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * What every translation backend looks like from the app's side. The AI
 * engines and the on-device engine differ enormously inside -- one request
 * versus three models -- but the app only ever sees this.
 */
export interface TranslationEngine {
  readonly id: string;
  readonly label: string;
  readonly kind: 'ai' | 'offline';

  /** Load models or validate credentials. Safe to call more than once. */
  prepare(onProgress?: ProgressReporter): Promise<void>;

  /** Find every text region on the page, read it, and translate it. */
  detectAndTranslate(
    image: EngineImage,
    langs: LanguagePair,
    onProgress?: ProgressReporter,
  ): Promise<EngineRegion[]>;

  /**
   * Re-translate text that has already been read, keyed by region id. Used
   * when the user edits a transcription or switches target language, so the
   * page is not detected and read a second time.
   */
  translateTexts(
    items: TextItem[],
    langs: LanguagePair,
    onProgress?: ProgressReporter,
  ): Promise<Record<string, string>>;

  /** Release models and memory. */
  dispose(): void;
}

/**
 * Language names travel inside prompts and this repository is public, so they
 * are untrusted input: collapse whitespace, drop characters that could
 * restructure a prompt, and cap the length.
 */
export function sanitizeLang(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    .replace(/[\r\n`{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return cleaned || fallback;
}

export function describeSource(source: string): string {
  return source === 'auto'
    ? 'Detect the source language yourself; the page may mix scripts.'
    : `The source language is ${source}.`;
}

/** Strip the `data:` header from a data URL, returning the raw base64 body. */
export function stripDataUrl(dataUrl: string): string {
  return dataUrl.replace(/^data:[^;,]+;base64,/, '');
}

/** Read the mime type out of a data URL, defaulting to PNG. */
export function mimeOf(dataUrl: string): string {
  const match = /^data:([^;,]+);base64,/.exec(dataUrl);
  return match ? match[1] : 'image/png';
}
