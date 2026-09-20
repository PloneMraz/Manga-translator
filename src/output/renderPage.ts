/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { context2d, createCanvas, loadImage } from '../lib/image';
import type { BoundingBox, Region, RegionType } from '../types';

export interface RenderOptions {
  /**
   * Cover the original text before drawing the translation. Leaving it on is
   * almost always right: without it the page carries both scripts at once.
   */
  coverOriginal?: boolean;
  /** Comics are conventionally set in caps, and the on-screen preview is. */
  uppercase?: boolean;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** 0..1, for the lossy types. */
  quality?: number;
}

export interface RenderResult {
  blob: Blob;
  width: number;
  height: number;
  /** Regions actually drawn, after approved/hidden/empty filtering. */
  drawn: number;
}

/** Colours and weights, kept in step with the on-screen preview. */
const INK = '#111827';
const SFX_INK = '#ef4444';
const SFX_OUTLINE = '#ffffff';
const DEFAULT_FONT = 'Comic Neue';
const LINE_HEIGHT = 1.15;
/** Keep text off a rectangular region's border. */
const TEXT_INSET = 0.08;
/**
 * Half-width of the rectangle inscribed in an ellipse, as a fraction of the
 * ellipse's. A round bubble narrows towards the top and bottom, so text laid
 * out to the bounding box crosses the outline on its first and last lines.
 */
const ELLIPSE_FIT = Math.SQRT1_2;
const MIN_FONT_PX = 8;
const MAX_FONT_PX = 220;

/**
 * Draws the approved translations onto the page and returns it as an image
 * file. This is the real export: what comes back is the user's own page with
 * their own approved text on it, at the source resolution.
 */
export async function renderTranslatedPage(
  imageDataUrl: string,
  regions: Region[],
  options: RenderOptions = {},
): Promise<RenderResult> {
  const {
    coverOriginal = true,
    uppercase = true,
    mimeType = 'image/png',
    quality = 0.92,
  } = options;

  const source = await loadImage(imageDataUrl);
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas, { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);

  // Only what the user approved, kept, and actually has words for.
  const visible = regions.filter(
    (region) => region.isApplied && !region.isHidden && region.translatedText?.trim(),
  );

  await ensureFonts(visible);

  for (const region of visible) {
    const rect = toPixels(region.box, width, height);
    if (rect.width < 2 || rect.height < 2) continue;

    if (coverOriginal) {
      // Sample the page's own background rather than assuming white: a tinted
      // bubble, a narrator box or a grey panel all keep their colour.
      fillRegion(ctx, rect, region.type, sampleBackground(ctx, rect));
    }

    drawText(ctx, rect, region, uppercase);
  }

  const blob = await toBlob(canvas, mimeType, quality);
  return { blob, width, height, drawn: visible.length };
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function toPixels(box: BoundingBox, width: number, height: number): Rect {
  return {
    x: (box.x / 100) * width,
    y: (box.y / 100) * height,
    width: (box.width / 100) * width,
    height: (box.height / 100) * height,
  };
}

/**
 * Median colour of a thin ring just inside the region. A median ignores the
 * glyphs crossing the ring, which an average would smear into the result.
 */
function sampleBackground(ctx: CanvasRenderingContext2D, rect: Rect): string {
  const inset = Math.max(1, Math.round(Math.min(rect.width, rect.height) * 0.06));
  const x = Math.max(0, Math.round(rect.x) + inset);
  const y = Math.max(0, Math.round(rect.y) + inset);
  const w = Math.max(1, Math.round(rect.width) - inset * 2);
  const h = Math.max(1, Math.round(rect.height) - inset * 2);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(x, y, w, h).data;
  } catch {
    return '#ffffff';
  }

  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  const ring = Math.max(1, Math.round(Math.min(w, h) * 0.08));

  for (let row = 0; row < h; row += 1) {
    const onRing = row < ring || row >= h - ring;
    for (let col = 0; col < w; col += 1) {
      if (!onRing && col >= ring && col < w - ring) continue;
      const p = (row * w + col) * 4;
      reds.push(data[p]);
      greens.push(data[p + 1]);
      blues.push(data[p + 2]);
    }
  }

  if (reds.length === 0) return '#ffffff';
  return `rgb(${median(reds)}, ${median(greens)}, ${median(blues)})`;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

/** Bubbles, titles and margin notes are drawn round; boxes and effects are not. */
function isRounded(type: RegionType): boolean {
  return type !== 'narrator' && type !== 'sfx';
}

function fillRegion(ctx: CanvasRenderingContext2D, rect: Rect, type: RegionType, colour: string): void {
  // Pull in slightly so a bubble keeps its drawn outline.
  const inset = Math.max(1, Math.min(rect.width, rect.height) * 0.02);
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = Math.max(1, rect.width - inset * 2);
  const h = Math.max(1, rect.height - inset * 2);

  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  if (!isRounded(type)) {
    // Square boxes, and sound effects, have no round shape to preserve. An
    // effect painted across artwork will show its patch; a trained detector
    // with a real mask is what fixes that, not a different rectangle.
    ctx.rect(x, y, w, h);
  } else {
    // The inscribed ellipse, not a rectangle: a speech bubble is drawn round,
    // and a rectangular patch cuts its outline off at the top and bottom.
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  region: Region,
  uppercase: boolean,
): void {
  const text = uppercase ? region.translatedText.toUpperCase() : region.translatedText;
  const round = isRounded(region.type);
  // An ellipse gets the rectangle that fits inside it; a box gets a margin.
  const fraction = round ? ELLIPSE_FIT : 1 - TEXT_INSET * 2;
  const boxWidth = rect.width * fraction;
  const boxHeight = rect.height * fraction;
  const family = region.font?.trim() || DEFAULT_FONT;
  const weight = region.type === 'title' ? '900' : '700';

  const layout = fitText(ctx, text, boxWidth, boxHeight, family, weight, region.fontSize);
  if (layout.lines.length === 0) return;

  ctx.save();
  ctx.font = fontSpec(weight, layout.fontSize, family);
  ctx.textBaseline = 'middle';
  ctx.textAlign = region.align ?? 'center';

  const margin = (rect.width - boxWidth) / 2;
  const anchorX =
    ctx.textAlign === 'left'
      ? rect.x + margin
      : ctx.textAlign === 'right'
        ? rect.x + rect.width - margin
        : rect.x + rect.width / 2;

  const step = layout.fontSize * LINE_HEIGHT;
  const blockHeight = step * layout.lines.length;
  let cursorY = rect.y + rect.height / 2 - blockHeight / 2 + step / 2;

  const isSfx = region.type === 'sfx';
  if (isSfx) {
    // A sound effect sits over artwork, so it needs a halo to stay readable.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = SFX_OUTLINE;
    ctx.lineWidth = Math.max(2, layout.fontSize / 6);
  }
  ctx.fillStyle = isSfx ? SFX_INK : INK;

  for (const line of layout.lines) {
    if (isSfx) ctx.strokeText(line, anchorX, cursorY);
    ctx.fillText(line, anchorX, cursorY);
    cursorY += step;
  }
  ctx.restore();
}

function fontSpec(weight: string, size: number, family: string): string {
  return `${weight} ${size}px "${family}", "Comic Neue", sans-serif`;
}

interface TextLayout {
  lines: string[];
  fontSize: number;
}

interface WrapResult {
  lines: string[];
  /** True when a single token had to be split mid-word to fit. */
  broke: boolean;
}

/**
 * Picks a size that fits, then wraps to it. An explicit size is honoured and
 * only shrunk if the text would otherwise spill out of the region.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  family: string,
  weight: string,
  requested: number | 'auto',
): TextLayout {
  const ceiling =
    requested === 'auto'
      ? Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, maxHeight))
      : Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, requested));

  // Two passes. The first refuses to split a word, because a smaller line of
  // whole words always reads better than a big one cut down the middle. Only
  // if no size in range can do that -- a single token wider than the region --
  // does the second pass allow a break.
  const whole = search(ctx, text, maxWidth, maxHeight, family, weight, ceiling, false);
  if (whole) return whole;

  const broken = search(ctx, text, maxWidth, maxHeight, family, weight, ceiling, true);
  if (broken) return broken;

  // Nothing fit even at the floor. Set it at the floor and let it be tight
  // rather than dropping the user's words on the floor instead.
  ctx.font = fontSpec(weight, MIN_FONT_PX, family);
  return { lines: wrap(ctx, text, maxWidth, true).lines, fontSize: MIN_FONT_PX };
}

/** Largest size in [MIN_FONT_PX, ceiling] whose wrap fits, or null. */
function search(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  family: string,
  weight: string,
  ceiling: number,
  allowBreaks: boolean,
): TextLayout | null {
  let low = MIN_FONT_PX;
  let high = Math.round(ceiling);
  let best: TextLayout | null = null;

  while (low <= high) {
    const size = (low + high) >> 1;
    ctx.font = fontSpec(weight, size, family);
    const { lines, broke } = wrap(ctx, text, maxWidth, allowBreaks);
    const fits =
      lines.length > 0 &&
      (allowBreaks || !broke) &&
      lines.length * size * LINE_HEIGHT <= maxHeight &&
      lines.every((line) => ctx.measureText(line).width <= maxWidth);

    if (fits) {
      best = { lines, fontSize: size };
      low = size + 1;
    } else {
      high = size - 1;
    }
  }
  return best;
}

/**
 * Wraps on spaces, and on characters where a single token is too wide -- which
 * is what scripts written without spaces need.
 */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  allowBreaks: boolean,
): WrapResult {
  const lines: string[] = [];
  let broke = false;

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let line = '';
    const flush = () => {
      if (line) lines.push(line);
      line = '';
    };

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      flush();
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
      } else {
        broke = true;
        if (!allowBreaks) {
          // Report the break; the caller will retry at a smaller size.
          line = word;
          continue;
        }
        // One long token: break it per character. This is what a script
        // written without spaces needs, and the last resort for one without.
        let piece = '';
        for (const char of word) {
          const grown = piece + char;
          if (piece && ctx.measureText(grown).width > maxWidth) {
            lines.push(piece);
            piece = char;
          } else {
            piece = grown;
          }
        }
        line = piece;
      }
    }
    flush();
  }

  return { lines, broke };
}

/** Custom faces must be loaded before the canvas can measure or draw them. */
async function ensureFonts(regions: Region[]): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;

  const families = new Set(regions.map((region) => region.font?.trim() || DEFAULT_FONT));
  await Promise.all(
    [...families].map((family) =>
      fonts.load(`700 48px "${family}"`).catch(() => undefined),
    ),
  );
}

function toBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The page could not be encoded as an image.'))),
      mimeType,
      quality,
    );
  });
}
