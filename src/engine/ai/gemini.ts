/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EngineError,
  describeSource,
  mimeOf,
  stripDataUrl,
  type EngineImage,
  type EngineRegion,
  type LanguagePair,
  type TextItem,
} from '../types';
import type { AiCredentials, AiProvider } from './provider';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Multimodal: the detection call sends an image. Change this when a new
 * generation ships rather than rewriting the provider.
 */
const DEFAULT_MODEL = 'gemini-3.8-flash';

const REGION_TYPES = "'bubble', 'sfx', 'narrator', 'author_note' or 'title'";

const boxSchema = {
  type: 'OBJECT',
  properties: {
    x: { type: 'NUMBER' },
    y: { type: 'NUMBER' },
    width: { type: 'NUMBER' },
    height: { type: 'NUMBER' },
  },
  required: ['x', 'y', 'width', 'height'],
};

const regionsSchema = {
  type: 'OBJECT',
  properties: {
    regions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          box: boxSchema,
          type: { type: 'STRING', description: REGION_TYPES },
          ocrText: { type: 'STRING' },
          translatedText: { type: 'STRING' },
        },
        required: ['id', 'box', 'type', 'ocrText', 'translatedText'],
      },
    },
  },
  required: ['regions'],
};

const translationsSchema = {
  type: 'OBJECT',
  properties: {
    translations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          translatedText: { type: 'STRING' },
        },
        required: ['id', 'translatedText'],
      },
    },
  },
  required: ['translations'],
};

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(
  parts: GeminiPart[],
  responseSchema: unknown,
  creds: AiCredentials,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!creds.apiKey || !creds.apiKey.trim()) {
    throw new EngineError(
      'MISSING_API_KEY',
      'No Gemini API key. Paste one in Settings, or switch to the offline engine.',
    );
  }

  const model = creds.model?.trim() || DEFAULT_MODEL;
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      // The key rides in a header rather than the query string so it stays out
      // of URLs, referrers and logs.
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': creds.apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
      signal,
    });
  } catch (error) {
    throw new EngineError('UPSTREAM_FAILED', `Could not reach Gemini: ${describeError(error)}`, error);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const code = response.status === 401 || response.status === 403 ? 'MISSING_API_KEY' : 'UPSTREAM_FAILED';
    throw new EngineError(code, `Gemini returned ${response.status}. ${extractApiMessage(body)}`, body);
  }

  const payload = await response.json().catch(() => null);
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new EngineError('BAD_RESPONSE', 'Gemini returned no text to parse.', payload);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new EngineError('BAD_RESPONSE', 'Gemini returned text that is not valid JSON.', text);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Pull Google's own message out of an error body when there is one. */
function extractApiMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message;
    if (typeof message === 'string') return message;
  } catch {
    // Fall through to the raw body below.
  }
  return body.slice(0, 300);
}

export const geminiProvider: AiProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  defaultModel: DEFAULT_MODEL,
  keyUrl: 'https://aistudio.google.com/apikey',

  async detectAndTranslate(image: EngineImage, langs: LanguagePair, creds, signal) {
    const prompt = `You are a professional comic/manga page layout analyzer and text detector (OCR).
Analyze this comic page image. Locate every single text block on the page, including dialogue speech bubbles, narrator rectangular boxes, stylized sound effects (SFX in onomatopoeia), chapter titles, or handwritten author notes.

For each text block, find its boundary box. Return its coordinates in percentage terms relative to whole image width and height (values from 0 to 100).
- x: distance from left border (0 to 100)
- y: distance from top border (0 to 100)
- width: horizontal width of the box (0 to 100)
- height: vertical height of the box (0 to 100)

Classify the text region into one of the following exact types:
- 'bubble': dialogue or thought bubble with text.
- 'narrator': rectangular narrative caption box, usually on panel borders.
- 'sfx': sound effect texts written free-form over artwork.
- 'author_note': marginal handwritten notes or tiny disclaimer notes.
- 'title': title logos or chapter titles.

${describeSource(langs.source)}
Transcribe the original text exactly as it appears, in its own script, and put it in 'ocrText'.
Then translate it into fluent, natural ${langs.target} and place that in 'translatedText'.
Translate into ${langs.target} even when the source text is already in another language. Never answer in any language other than ${langs.target} in the 'translatedText' field.`;

    const data = (await callGemini(
      [
        { inline_data: { mime_type: mimeOf(image.dataUrl), data: stripDataUrl(image.dataUrl) } },
        { text: prompt },
      ],
      regionsSchema,
      creds,
      signal,
    )) as { regions?: unknown };

    if (!Array.isArray(data.regions)) {
      throw new EngineError('BAD_RESPONSE', 'Gemini returned no regions array.', data);
    }
    return data.regions as EngineRegion[];
  },

  async translateTexts(items: TextItem[], langs: LanguagePair, creds, signal) {
    if (items.length === 0) return {};

    const prompt = `You are a professional comic localization editor. Translate into ${langs.target}.
${describeSource(langs.source)}
Translate the following OCR transcript sections. Speech bubbles must read like authentic, natural comic dialogue in ${langs.target}. Sound effects (SFX) should become the onomatopoeia a ${langs.target} comic would actually use, not a literal gloss.
Translate every item into ${langs.target}, including items already written in another language.

Input items:
${JSON.stringify(items.map((item) => ({ id: item.id, type: item.type, text: item.text })))}`;

    const data = (await callGemini([{ text: prompt }], translationsSchema, creds, signal)) as {
      translations?: { id?: string; translatedText?: string }[];
    };

    const out: Record<string, string> = {};
    for (const entry of data.translations ?? []) {
      if (typeof entry?.id === 'string' && typeof entry.translatedText === 'string') {
        out[entry.id] = entry.translatedText;
      }
    }
    // Items the model skipped are simply absent. The caller keeps the original
    // text for those rather than being handed an invented translation.
    return out;
  },
};
