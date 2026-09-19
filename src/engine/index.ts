/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AiEngine, AI_PROVIDERS } from './ai';
import { OfflineEngine, type OfflineEngineOptions } from './offline';
import { EngineError, type TranslationEngine } from './types';

export * from './types';
export { AI_PROVIDERS, AiEngine, findProvider } from './ai';
export type { AiCredentials, AiProvider } from './ai';
export { OfflineEngine, OCR_MODEL, TRANSLATION_MODEL } from './offline';
export type { OfflineEngineOptions } from './offline';
export { BubbleDetector } from './offline/bubbleDetector';
export type { DetectedBox, TextRegionDetector } from './offline/bubbleDetector';

/** The two choices the user is offered, as stored in settings. */
export type EngineConfig =
  | { kind: 'ai'; providerId: string; apiKey: string; model?: string }
  | ({ kind: 'offline' } & OfflineEngineOptions);

export function createEngine(config: EngineConfig): TranslationEngine {
  if (config.kind === 'ai') {
    return new AiEngine(config.providerId, { apiKey: config.apiKey, model: config.model });
  }
  if (config.kind === 'offline') {
    const { kind: _kind, ...options } = config;
    return new OfflineEngine(options);
  }
  throw new EngineError('UNSUPPORTED', `Unknown engine kind: ${JSON.stringify(config)}`);
}

/** Default settings for a first run: offline, because it needs no account. */
export function defaultEngineConfig(): EngineConfig {
  return { kind: 'offline' };
}

export function describeEngineChoices() {
  return {
    offline: {
      id: 'offline',
      label: 'On this device',
      note: 'No account and no key. Reads Japanese, writes English. Downloads models once.',
    },
    ai: AI_PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      defaultModel: provider.defaultModel,
      keyUrl: provider.keyUrl,
    })),
  };
}
