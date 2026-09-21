/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AI_PROVIDERS, type EngineConfig } from './engine';

export interface AppSettings {
  engine: EngineConfig;
  /** "auto", or a language name. Never a fixed pair. */
  sourceLang: string;
  targetLang: string;
  /** Comics are conventionally set in caps. */
  uppercase: boolean;
}

const STORAGE_KEY = 'comic_translator_settings';

export function defaultSettings(): AppSettings {
  // Offline first: it is the only choice that works with no account.
  return { engine: { kind: 'offline' }, sourceLang: 'auto', targetLang: 'English', uppercase: true };
}

/**
 * Settings live on the device, which includes the API key. That is the same
 * trust boundary a desktop app has, and this app has no server to hold it
 * instead -- but it does mean any script on this origin could read it, so the
 * key field says where the key is kept.
 */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing, or storage turned off. The app still runs; the
    // settings just will not survive a reload.
  }
}

/** Anything stored by an older version, or hand-edited, is repaired here. */
function normalize(value: unknown): AppSettings {
  const base = defaultSettings();
  if (!value || typeof value !== 'object') return base;
  const raw = value as Record<string, unknown>;

  const engine = raw.engine as Record<string, unknown> | undefined;
  if (engine?.kind === 'ai') {
    const providerId = typeof engine.providerId === 'string' ? engine.providerId : '';
    if (AI_PROVIDERS.some((provider) => provider.id === providerId)) {
      base.engine = {
        kind: 'ai',
        providerId,
        apiKey: typeof engine.apiKey === 'string' ? engine.apiKey : '',
        model: typeof engine.model === 'string' && engine.model ? engine.model : undefined,
      };
    }
  }

  if (typeof raw.sourceLang === 'string' && raw.sourceLang.trim()) base.sourceLang = raw.sourceLang;
  if (typeof raw.targetLang === 'string' && raw.targetLang.trim()) base.targetLang = raw.targetLang;
  if (typeof raw.uppercase === 'boolean') base.uppercase = raw.uppercase;
  return base;
}

/** Offered in the language pickers; the fields accept anything typed. */
export const COMMON_LANGUAGES = [
  'English',
  'Vietnamese',
  'Japanese',
  'Korean',
  'Chinese',
  'French',
  'Spanish',
  'German',
];
