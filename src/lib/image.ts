/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Decode a data URL into an image element. */
export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('That file could not be decoded as an image.'));
    element.src = dataUrl;
  });
}

/** A 2D context, or a clear error saying why there isn't one. */
export function context2d(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', options);
  if (!context) {
    throw new Error('This browser would not provide a 2D canvas context.');
  }
  return context;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}
