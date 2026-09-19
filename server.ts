/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit for base64 comic pages
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));

// Model id is configurable so a new Gemini generation does not need a code
// change. Must be a multimodal model: /api/analyze-layout sends an image.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// The language pair is never hardcoded. "auto" lets the model detect the
// source script, which is what a mixed-language page needs.
const DEFAULT_SOURCE_LANG = "auto";
const DEFAULT_TARGET_LANG = process.env.DEFAULT_TARGET_LANG || "English";

class MissingApiKeyError extends Error {
  code = "MISSING_API_KEY";
}

// Language names reach the model inside a prompt, and this repo is public, so
// treat them as untrusted: collapse whitespace, drop characters that could
// restructure the prompt, and cap the length.
function sanitizeLang(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\r\n`{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  return cleaned || fallback;
}

function resolveLanguages(body: any): { source: string; target: string } {
  return {
    source: sanitizeLang(body?.sourceLang, DEFAULT_SOURCE_LANG),
    target: sanitizeLang(body?.targetLang, DEFAULT_TARGET_LANG),
  };
}

function describeSource(source: string): string {
  return source === "auto"
    ? "Detect the source language yourself; the page may mix scripts."
    : `The source language is ${source}.`;
}

// Map an upstream failure onto a status the client can act on, instead of
// dressing it up as a success.
function sendUpstreamError(res: any, error: any, stage: string) {
  const isKeyProblem = error?.code === "MISSING_API_KEY";
  return res.status(isKeyProblem ? 503 : 502).json({
    success: false,
    code: isKeyProblem ? "MISSING_API_KEY" : "UPSTREAM_FAILED",
    error: `${stage} failed: ${error?.message || String(error)}`,
  });
}

// Shared lazy-loaded Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new MissingApiKeyError("GEMINI_API_KEY is not set. Put a Gemini API key in .env (see .env.example) or, in Google AI Studio, in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Default Sample Comic Page definitions
const SAMPLE_PAGES_REGIONS: Record<string, any[]> = {
  "page_001": [
    {
      id: "reg_001_1",
      box: { x: 15, y: 12, width: 20, height: 12 },
      type: "bubble",
      ocrText: "信じられない！空を飛んでいる！",
      translatedText: "Unbelievable! He's flying in the sky!"
    },
    {
      id: "reg_001_2",
      box: { x: 50, y: 35, width: 22, height: 10 },
      type: "sfx",
      ocrText: "ブーーーン",
      translatedText: "WHOAAM"
    },
    {
      id: "reg_001_3",
      box: { x: 68, y: 10, width: 26, height: 14 },
      type: "narrator",
      ocrText: "吉日、都心にて。",
      translatedText: "A lucky day, in the middle of the city."
    },
    {
      id: "reg_001_4",
      box: { x: 42, y: 65, width: 18, height: 11 },
      type: "bubble",
      ocrText: "ここが東京か...",
      translatedText: "So this is Tokyo..."
    }
  ],
  "page_002": [
    {
      id: "reg_002_1",
      box: { x: 20, y: 15, width: 24, height: 13 },
      type: "bubble",
      ocrText: "おーい、ケンジ！久しぶり！",
      translatedText: "Hey, Kenji! Long time no see!"
    },
    {
      id: "reg_002_2",
      box: { x: 58, y: 30, width: 12, height: 15 },
      type: "sfx",
      ocrText: "スタスタ",
      translatedText: "tap tap"
    },
    {
      id: "reg_002_3",
      box: { x: 62, y: 60, width: 20, height: 12 },
      type: "bubble",
      ocrText: "調子はどうだ？",
      translatedText: "How are things going?"
    }
  ],
  "page_003": [
    {
      id: "reg_003_1",
      box: { x: 15, y: 18, width: 25, height: 16 },
      type: "bubble",
      ocrText: "場所が分かりづらい。スマホのGPSを使うか。",
      translatedText: "The place is hard to find. Should I use my phone GPS?"
    },
    {
      id: "reg_003_2",
      box: { x: 70, y: 12, width: 22, height: 14 },
      type: "narrator",
      ocrText: "目的地まであと2キロメートル。",
      translatedText: "2 kilometers remaining to destination."
    },
    {
      id: "reg_003_3",
      box: { x: 42, y: 48, width: 32, height: 15 },
      type: "title",
      ocrText: "新たな旅立ち",
      translatedText: "New Beginnings"
    },
    {
      id: "reg_003_4",
      box: { x: 74, y: 88, width: 23, height: 8 },
      type: "author_note",
      ocrText: "※この物語はフィクションです。",
      translatedText: "※ Note: This story is fictional."
    }
  ]
};

// Key availability verification endpoint
app.get("/api/config", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({ hasApiKey: hasKey });
});

// Layout analysis API using Gemini Vision or using Mocks for Sample pages
app.post("/api/analyze-layout", async (req, res) => {
  const { imageBase64, pageId } = req.body;
  const { source, target } = resolveLanguages(req.body);

  // 1. If it's a sample page and not uploaded, return its pre-baked layout boxes
  if (pageId && SAMPLE_PAGES_REGIONS[pageId]) {
    // Simulating small network latency for OCR
    await new Promise((resolve) => setTimeout(resolve, 800));
    return res.json({
      success: true,
      regions: SAMPLE_PAGES_REGIONS[pageId].map(r => ({
        ...r,
        // For preloaded state, keep translated text blank so the state machine runs correctly!
        // The user stays on the page >= 5 seconds to load translations
        translatedText: "" 
      }))
    });
  }

  // 2. If it is a custom image upload, run real Gemini Vision!
  if (!imageBase64) {
    return res.status(400).json({ error: "Missing imageBase64 or pageId content." });
  }

  try {
    const ai = getGeminiClient();

    // Keep the real mime type: the input is whatever image the user uploaded,
    // not necessarily a PNG, and Gemini is told the type explicitly.
    const dataUrlMatch = /^data:(image\/[\w.+-]+);base64,/.exec(imageBase64);
    const mimeType = dataUrlMatch ? dataUrlMatch[1] : "image/png";
    const base64Clean = imageBase64.replace(/^data:image\/[\w.+-]+;base64,/, "");

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
- 'sfx': sound effect texts written free-form over artwork (like 'BOOM', 'THUMP', 'ドキドキ', 'あはは').
- 'author_note': marginal handwritten notes or tiny disclaimer notes.
- 'title': title logos or chapter titles.

${describeSource(source)}
Transcribe the original text exactly as it appears, in its own script, and put it in 'ocrText'.
Then translate it into fluent, natural ${target} and place that in 'translatedText'.
Translate into ${target} even when the source text is already in another language. Never answer in any language other than ${target} in the 'translatedText' field.

Your response MUST be a valid JSON object matching this schema, with no other text:
{
  "regions": [
    {
      "id": "unique_id_string",
      "box": { "x": percentage_number, "y": percentage_number, "width": percentage_number, "height": percentage_number },
      "type": "bubble" | "sfx" | "narrator" | "author_note" | "title",
      "ocrText": "raw original text found",
      "translatedText": "fluent ${target} translation"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Clean
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            regions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  box: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      width: { type: Type.NUMBER },
                      height: { type: Type.NUMBER }
                    },
                    required: ["x", "y", "width", "height"]
                  },
                  type: { 
                    type: Type.STRING, 
                    description: "bubble, sfx, narrator, author_note, or title" 
                  },
                  ocrText: { type: Type.STRING },
                  translatedText: { type: Type.STRING }
                },
                required: ["id", "box", "type", "ocrText", "translatedText"]
              }
            }
          },
          required: ["regions"]
        }
      }
    });

    const resultText = response.text || "{}";
    const data = JSON.parse(resultText);

    // Make sure we blank out 'translatedText' initially to conform to the Preloaded slide-window design,
    // (the client holds it as preloaded and triggers translate API only after 5s user intent)
    const regionsWithBlankedTranslation = (data.regions || []).map((reg: any) => ({
      ...reg,
      backupTranslation: reg.translatedText, // store server's prediction to return quickly later
      backupLang: target, // so /api/translate-text can tell a stale language apart
      translatedText: ""
    }));

    return res.json({
      success: true,
      regions: regionsWithBlankedTranslation
    });
  } catch (error: any) {
    // No fabricated regions here. A failed detection that returns HTTP 200
    // with invented Japanese text is indistinguishable from a real result,
    // which is worse than an outright error.
    console.error("Gemini Vision detection failed:", error);
    return sendUpstreamError(res, error, "Text detection");
  }
});

// Translation API endpoint (triggered by user staying >= 5s on page)
app.post("/api/translate-text", async (req, res) => {
  const { regions, pageId } = req.body;
  const { source, target } = resolveLanguages(req.body);

  if (!regions || !Array.isArray(regions)) {
    return res.status(400).json({ error: "Missing regions list to translate." });
  }

  // 1. If sample page, we have pre-baked translations which we can return instantly!
  if (pageId && SAMPLE_PAGES_REGIONS[pageId]) {
    await new Promise((resolve) => setTimeout(resolve, 600)); // Simulate translation pipeline delay
    const reference = SAMPLE_PAGES_REGIONS[pageId];
    const translated = regions.map((targetRegion: any) => {
      const match = reference.find(ref => ref.id === targetRegion.id);
      return {
        ...targetRegion,
        translatedText: match ? match.translatedText : targetRegion.ocrText,
        isApplied: false
      };
    });
    return res.json({ success: true, regions: translated });
  }

  // 2. The layout call already translated into some language. Reuse that only
  // when it is the language being asked for now -- otherwise the user switched
  // target language after detection and the backup is stale.
  const canReuseBackup = regions.every(
    (r: any) => !r.ocrText || (r.backupTranslation && r.backupLang === target)
  );
  if (canReuseBackup) {
    const updated = regions.map((r: any) => ({
      ...r,
      translatedText: r.backupTranslation || r.translatedText || ""
    }));
    return res.json({ success: true, regions: updated });
  }

  // 3. Otherwise, translate using Gemini
  try {
    const ai = getGeminiClient();

    const translationPrompt = `You are a professional comic localization editor. Translate into ${target}.
${describeSource(source)}
Translate the following OCR transcript sections. Speech bubbles must read like authentic, natural comic dialogue in ${target}. Sound effects (SFX) should become the onomatopoeia a ${target} comic would actually use, not a literal gloss.
Translate every item into ${target}, including items already written in another language.

Input items:
${JSON.stringify(regions.map(r => ({ id: r.id, type: r.type, text: r.ocrText })))}

Return strictly a JSON list matching this schema, with no additional formatting:
{
  "translations": [
    { "id": "id_matching_input", "translatedText": "natural ${target} translation" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: translationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  translatedText: { type: Type.STRING }
                },
                required: ["id", "translatedText"]
              }
            }
          },
          required: ["translations"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    const translationsList = parsed.translations || [];

    const updated = regions.map((region: any) => {
      const foundMatch = translationsList.find((t: any) => t.id === region.id);
      return {
        ...region,
        // No match means the model skipped this region. Leave it empty so the
        // UI falls back to the original text rather than showing a fake one.
        translatedText: foundMatch ? foundMatch.translatedText : ""
      };
    });

    return res.json({ success: true, regions: updated });
  } catch (error: any) {
    console.error("Gemini Translation failed:", error);
    return sendUpstreamError(res, error, "Translation");
  }
});


// Dev & Production serving configurations
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
