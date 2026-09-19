/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EngineError,
  sanitizeLang,
  type EngineImage,
  type EngineRegion,
  type LanguagePair,
  type ProgressReporter,
  type TextItem,
  type TranslationEngine,
} from '../types';
import { geminiProvider } from './gemini';
import type { AiCredentials, AiProvider } from './provider';

export type { AiCredentials, AiProvider } from './provider';

/**
 * Every hosted backend the user can pick in the "platform" dropdown. Adding
 * one means writing a provider file and listing it here.
 */
export const AI_PROVIDERS: readonly AiProvider[] = [geminiProvider];

export function findProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((provider) => provider.id === id);
}

/**
 * Talks to a hosted model with a key the user pasted. The key is held in
 * memory here and sent straight to the provider from the user's own device --
 * there is no server in this app to relay it through, and none is wanted.
 */
export class AiEngine implements TranslationEngine {
  readonly kind = 'ai' as const;

  private readonly provider: AiProvider;
  private readonly creds: AiCredentials;

  constructor(providerId: string, creds: AiCredentials) {
    const provider = findProvider(providerId);
    if (!provider) {
      throw new EngineError('UNSUPPORTED', `No translation provider called "${providerId}".`);
    }
    this.provider = provider;
    this.creds = creds;
  }

  get id(): string {
    return `ai:${this.provider.id}`;
  }

  get label(): string {
    return this.provider.label;
  }

  async prepare(onProgress?: ProgressReporter): Promise<void> {
    onProgress?.({ stage: 'preparing', message: `Checking your ${this.provider.label} key` });
    if (!this.creds.apiKey?.trim()) {
      throw new EngineError(
        'MISSING_API_KEY',
        `Paste a ${this.provider.label} API key, or switch to the offline engine.`,
      );
    }
  }

  async detectAndTranslate(
    image: EngineImage,
    langs: LanguagePair,
    onProgress?: ProgressReporter,
  ): Promise<EngineRegion[]> {
    const pair = normalizePair(langs);
    // One request covers detection, reading and translation, so the whole page
    // is in view when the text is translated.
    onProgress?.({ stage: 'detecting', message: `Reading the page with ${this.provider.label}` });
    return this.provider.detectAndTranslate(image, pair, this.creds);
  }

  async translateTexts(
    items: TextItem[],
    langs: LanguagePair,
    onProgress?: ProgressReporter,
  ): Promise<Record<string, string>> {
    const pair = normalizePair(langs);
    onProgress?.({ stage: 'translating', message: `Translating into ${pair.target}` });
    return this.provider.translateTexts(items, pair, this.creds);
  }

  dispose(): void {
    // Nothing is held open; the key lives only as long as this instance.
  }
}

function normalizePair(langs: LanguagePair): LanguagePair {
  return {
    source: sanitizeLang(langs.source, 'auto'),
    target: sanitizeLang(langs.target, 'English'),
  };
}
