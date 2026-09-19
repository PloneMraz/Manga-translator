/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BoundingBox } from '../../types';
import { EngineError, type EngineImage } from '../types';

export interface DetectedBox {
  box: BoundingBox;
  /** 0..1, how bubble-like the blob looked. Used only for ordering. */
  confidence: number;
}

/**
 * Finds the text regions on a page. Swappable: a YOLO segmentation model
 * exported to ONNX can implement this without the engine noticing.
 */
export interface TextRegionDetector {
  readonly id: string;
  readonly label: string;
  detect(image: EngineImage): Promise<DetectedBox[]>;
}

/** Work at this longest edge; full resolution buys nothing and costs a lot. */
const WORK_EDGE = 1000;

/** A pixel at or above this luma counts as bubble interior. */
const LIGHT_LUMA = 200;
/** A pixel at or below this luma counts as ink. */
const DARK_LUMA = 90;

const MIN_AREA_FRACTION = 0.0015;
const MAX_AREA_FRACTION = 0.25;
const MIN_FILL_RATIO = 0.55;
const MIN_ASPECT = 0.15;
const MAX_ASPECT = 8;
const MIN_INK_FRACTION = 0.02;
const MAX_INK_FRACTION = 0.45;
const MAX_REGIONS = 40;
/** Grow each box by this fraction of its size so glyphs are not clipped. */
const PADDING = 0.02;

/**
 * Classical speech-bubble detection: bubbles are large light blobs, enclosed
 * by line art, holding a moderate amount of ink.
 *
 * This is a heuristic, and its limits are the honest ones for the approach:
 * it finds enclosed speech and thought bubbles on clean pages, and it does
 * NOT find sound effects drawn over artwork, because those have no enclosing
 * light region to find. It exists so the offline engine works with nothing
 * downloaded; a trained detector belongs behind the same interface.
 */
export class BubbleDetector implements TextRegionDetector {
  readonly id = 'bubble-cv';
  readonly label = 'Speech bubbles (no download)';

  async detect(image: EngineImage): Promise<DetectedBox[]> {
    const { data, width, height } = await rasterize(image);

    const luma = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < luma.length; i += 1, p += 4) {
      luma[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
    }

    const total = width * height;
    const labels = new Int32Array(total).fill(-1);
    const stack = new Int32Array(total);
    const found: DetectedBox[] = [];

    for (let seed = 0; seed < total; seed += 1) {
      if (labels[seed] !== -1 || luma[seed] < LIGHT_LUMA) continue;

      // Flood the light blob, tracking its extent as we go.
      let top = 0;
      stack[top++] = seed;
      labels[seed] = seed;

      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      let count = 0;
      let touchesBorder = false;

      while (top > 0) {
        const index = stack[--top];
        const x = index % width;
        const y = (index - x) / width;

        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;

        if (x > 0) push(index - 1);
        if (x < width - 1) push(index + 1);
        if (y > 0) push(index - width);
        if (y < height - 1) push(index + width);
      }

      function push(next: number) {
        if (labels[next] === -1 && luma[next] >= LIGHT_LUMA) {
          labels[next] = seed;
          stack[top++] = next;
        }
      }

      // The page background and the margins are light and reach the edge.
      if (touchesBorder) continue;

      const areaFraction = count / total;
      if (areaFraction < MIN_AREA_FRACTION || areaFraction > MAX_AREA_FRACTION) continue;

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const aspect = boxWidth / boxHeight;
      if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) continue;

      // A bubble is a solid blob; a thin ribbon of background between panels
      // is not.
      const fill = count / (boxWidth * boxHeight);
      if (fill < MIN_FILL_RATIO) continue;

      const ink = inkFraction(luma, width, minX, minY, boxWidth, boxHeight);
      if (ink < MIN_INK_FRACTION || ink > MAX_INK_FRACTION) continue;

      found.push({
        box: toPercentBox(minX, minY, boxWidth, boxHeight, width, height),
        confidence: Math.min(1, fill * (1 - Math.abs(ink - 0.15) / 0.45)),
      });
    }

    found.sort((a, b) => b.confidence - a.confidence);
    return dropOverlaps(found).slice(0, MAX_REGIONS);
  }
}

function inkFraction(
  luma: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  boxWidth: number,
  boxHeight: number,
): number {
  let dark = 0;
  for (let y = y0; y < y0 + boxHeight; y += 1) {
    const row = y * width;
    for (let x = x0; x < x0 + boxWidth; x += 1) {
      if (luma[row + x] <= DARK_LUMA) dark += 1;
    }
  }
  return dark / (boxWidth * boxHeight);
}

function toPercentBox(
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  width: number,
  height: number,
): BoundingBox {
  const padX = boxWidth * PADDING;
  const padY = boxHeight * PADDING;
  const left = Math.max(0, x - padX);
  const top = Math.max(0, y - padY);
  const right = Math.min(width, x + boxWidth + padX);
  const bottom = Math.min(height, y + boxHeight + padY);
  return {
    x: (left / width) * 100,
    y: (top / height) * 100,
    width: ((right - left) / width) * 100,
    height: ((bottom - top) / height) * 100,
  };
}

/** Keep the strongest of any pair that covers substantially the same area. */
function dropOverlaps(boxes: DetectedBox[]): DetectedBox[] {
  const kept: DetectedBox[] = [];
  for (const candidate of boxes) {
    if (!kept.some((existing) => iou(existing.box, candidate.box) > 0.4)) {
      kept.push(candidate);
    }
  }
  return kept;
}

function iou(a: BoundingBox, b: BoundingBox): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  const overlap = (right - left) * (bottom - top);
  return overlap / (a.width * a.height + b.width * b.height - overlap);
}

interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

async function rasterize(image: EngineImage): Promise<Raster> {
  const bitmap = await loadImage(image.dataUrl);
  const scale = Math.min(1, WORK_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new EngineError('UNSUPPORTED', 'This browser would not give us a 2D canvas to read the page with.');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () =>
      reject(new EngineError('UNSUPPORTED', 'That file could not be decoded as an image.'));
    element.src = dataUrl;
  });
}
