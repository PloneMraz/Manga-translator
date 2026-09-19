/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Checks that BubbleDetector finds speech bubbles on a page, and that it does
 * not invent regions where there is only artwork.
 *
 * The detector reads pixels through a canvas, so it needs a real browser --
 * jsdom will not do. Run it with:
 *
 *     npm run test:detector
 *
 * Playwright is not a dependency of this project, because installing it pulls
 * a browser down. Install it yourself first:
 *
 *     npm i -D playwright && npx playwright install chromium
 *
 * Set CHROMIUM_PATH to use a browser that is already on the machine.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const IOU_PASS = 0.5;

const work = mkdtempSync(join(tmpdir(), 'bubble-detector-'));
const bundlePath = join(work, 'detector.js');

try {
  execFileSync(
    'npx',
    ['esbuild', 'src/engine/offline/bubbleDetector.ts', '--bundle', '--format=iife',
      '--global-name=BD', `--outfile=${bundlePath}`, '--log-level=warning'],
    { stdio: 'inherit' },
  );

  const { chromium } = await import('playwright');
  const launchOptions = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH;

  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: readFileSync(bundlePath, 'utf8') });

  const { boxes, truth, ms } = await page.evaluate(drawPageAndDetect);
  await browser.close();

  console.log(`\nDetector ran in ${ms.toFixed(0)} ms and returned ${boxes.length} box(es).\n`);

  let matched = 0;
  truth.forEach((expected, index) => {
    let best = 0;
    for (const found of boxes) best = Math.max(best, iou(expected, found.box));
    const ok = best >= IOU_PASS;
    if (ok) matched += 1;
    console.log(`  bubble ${index + 1}: ${ok ? 'found ' : 'MISSED'} (best IoU ${best.toFixed(2)})`);
  });

  const extra = boxes.length - matched;
  console.log(`\n  matched ${matched}/${truth.length}; regions with no bubble behind them: ${extra}`);

  if (matched !== truth.length || extra !== 0) {
    console.error('\nFAIL');
    process.exitCode = 1;
  } else {
    console.log('\nPASS');
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

/**
 * Draws a synthetic page in the browser and runs the detector over it. Kept as
 * one function because it is serialized into the page.
 */
function drawPageAndDetect() {
  const W = 800;
  const H = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);

  g.strokeStyle = '#000';
  g.lineWidth = 4;
  g.strokeRect(30, 30, W - 60, 520);
  g.strokeRect(30, 600, W - 60, 560);

  // Artwork, so the panels are not blank white.
  g.fillStyle = '#9a9a9a';
  g.beginPath();
  g.arc(250, 380, 120, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6e6e6e';
  g.fillRect(420, 850, 300, 260);

  const truth = [];
  const bubble = (cx, cy, rx, ry) => {
    g.fillStyle = '#fff';
    g.strokeStyle = '#000';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#111';
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        g.fillRect(cx - rx * 0.6 + col * rx * 0.3, cy - ry * 0.45 + row * ry * 0.35, rx * 0.18, ry * 0.18);
      }
    }
    truth.push({
      x: ((cx - rx) / W) * 100,
      y: ((cy - ry) / H) * 100,
      width: ((2 * rx) / W) * 100,
      height: ((2 * ry) / H) * 100,
    });
  };

  bubble(180, 140, 110, 70);
  bubble(600, 220, 120, 80);
  bubble(240, 760, 130, 85);

  // A sound effect drawn straight onto the artwork. It has no enclosing light
  // region, so this detector is expected to miss it -- and expected not to
  // report the artwork around it as a region either.
  g.strokeStyle = '#000';
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(470, 900);
  g.lineTo(700, 1050);
  g.moveTo(700, 900);
  g.lineTo(470, 1050);
  g.stroke();

  const dataUrl = canvas.toDataURL('image/png');
  const started = performance.now();
  return new BD.BubbleDetector()
    .detect({ dataUrl, width: W, height: H })
    .then((boxes) => ({ boxes, truth, ms: performance.now() - started }));
}

function iou(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  const overlap = (right - left) * (bottom - top);
  return overlap / (a.width * a.height + b.width * b.height - overlap);
}
