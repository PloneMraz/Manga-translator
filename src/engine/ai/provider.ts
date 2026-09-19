/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EngineImage,
  EngineRegion,
  LanguagePair,
  TextItem,
} from '../types';

/** Credentials and model choice for one provider, supplied by the user. */
export interface AiCredentials {
  apiKey: string;
  /** Overrides the provider's default model when set. */
  model?: string;
}

/**
 * One hosted translation backend. Providers are plain objects so adding
 * another is a file, not a change to the engine.
 */
export interface AiProvider {
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  /** Where the user gets a key, shown next to the key field. */
  readonly keyUrl: string;

  detectAndTranslate(
    image: EngineImage,
    langs: LanguagePair,
    creds: AiCredentials,
    signal?: AbortSignal,
  ): Promise<EngineRegion[]>;

  translateTexts(
    items: TextItem[],
    langs: LanguagePair,
    creds: AiCredentials,
    signal?: AbortSignal,
  ): Promise<Record<string, string>>;
}
