/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Checks that renderTranslatedPage produces a real image: original text
 * covered, translation drawn, artwork untouched, and unapproved regions left
 * exactly as they were.
 *
 * Original glyphs are painted pure blue (#0000ff), a colour the renderer never
 * produces, so "is the original still there?" has an unambiguous answer.
 *
 * Needs a browser. See tests/bubble-detector.mjs for the Playwright setup.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const work = mkdtempSync(join(tmpdir(), 'render-page-'));
const bundlePath = join(work, 'render.js');
const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

try {
  execFileSync(
    'npx',
    ['esbuild', 'src/output/renderPage.ts', '--bundle', '--format=iife',
      '--global-name=R', `--outfile=${bundlePath}`, '--log-level=warning'],
    { stdio: 'inherit' },
  );

  const { chromium } = await import('playwright');
  const launchOptions = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH;

  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: readFileSync(bundlePath, 'utf8') });

  const out = await page.evaluate(renderAndProbe);
  await browser.close();

  console.log(`\nRendered ${out.width}x${out.height}, ${out.bytes} bytes, ${out.drawn} region(s) drawn.\n`);

  check('output keeps the source size', out.width === 800 && out.height === 1200, `${out.width}x${out.height}`);
  check('output is a PNG', out.type === 'image/png', out.type);
  check('approved region: original text gone', out.approvedBlue === 0, `${out.approvedBlue} blue px left`);
  check('approved region: translation drawn', out.approvedInk > 200, `${out.approvedInk} ink px`);
  check('unapproved region: left untouched', out.unapprovedBlue > 200, `${out.unapprovedBlue} blue px kept`);
  check('hidden region: left untouched', out.hiddenBlue > 200, `${out.hiddenBlue} blue px kept`);
  check('artwork outside regions unchanged', out.artworkIdentical, out.artworkIdentical ? '' : 'pixels differ');
  check('only the approved region was drawn', out.drawn === 1, `drawn=${out.drawn}`);

  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed === 0 ? '\nPASS' : `\nFAIL (${failed} check(s))`);
  if (failed > 0) process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}

function renderAndProbe() {
  const W = 800, H = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');

  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);

  // Artwork we must not disturb.
  g.fillStyle = '#6e6e6e'; g.fillRect(40, 950, 300, 200);

  // Three bubbles, each with pure-blue "original text" inside.
  const boxes = [
    { x: 100, y: 80, w: 260, h: 150 },   // approved
    { x: 450, y: 80, w: 260, h: 150 },   // not approved
    { x: 100, y: 400, w: 260, h: 150 },  // hidden
  ];
  for (const b of boxes) {
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 4;
    g.beginPath();
    g.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.fillStyle = '#0000ff';
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++)
        g.fillRect(b.x + 50 + c * 42, b.y + 40 + r * 32, 30, 20);
  }

  const artworkBefore = g.getImageData(60, 980, 120, 120).data.slice();
  const dataUrl = canvas.toDataURL('image/png');

  const pct = (b) => ({ x: (b.x / W) * 100, y: (b.y / H) * 100, width: (b.w / W) * 100, height: (b.h / H) * 100 });
  const base = { font: 'Arial', fontSize: 'auto', align: 'center', ocrText: 'こんにちは' };
  const regions = [
    { ...base, id: 'a', box: pct(boxes[0]), type: 'bubble',
      translatedText: 'Hello old friend, it has been a while!', isHidden: false, isApplied: true },
    { ...base, id: 'b', box: pct(boxes[1]), type: 'bubble',
      translatedText: 'This one was never approved.', isHidden: false, isApplied: false },
    { ...base, id: 'c', box: pct(boxes[2]), type: 'bubble',
      translatedText: 'This one is hidden.', isHidden: true, isApplied: true },
  ];

  return R.renderTranslatedPage(dataUrl, regions).then(async (result) => {
    const bitmap = await createImageBitmap(result.blob);
    const check = document.createElement('canvas');
    check.width = bitmap.width; check.height = bitmap.height;
    const cg = check.getContext('2d', { willReadFrequently: true });
    cg.drawImage(bitmap, 0, 0);

    const countIn = (b, test) => {
      const d = cg.getImageData(b.x, b.y, b.w, b.h).data;
      let n = 0;
      for (let p = 0; p < d.length; p += 4) if (test(d[p], d[p + 1], d[p + 2])) n++;
      return n;
    };
    const isBlue = (r, gg, bb) => bb > 180 && r < 80 && gg < 80;
    const isInk = (r, gg, bb) => r < 90 && gg < 90 && bb < 90;

    const artworkAfter = cg.getImageData(60, 980, 120, 120).data;
    let identical = artworkAfter.length === artworkBefore.length;
    for (let i = 0; identical && i < artworkAfter.length; i++) {
      if (artworkAfter[i] !== artworkBefore[i]) identical = false;
    }

    return {
      width: result.width, height: result.height, drawn: result.drawn,
      bytes: result.blob.size, type: result.blob.type,
      approvedBlue: countIn(boxes[0], isBlue),
      approvedInk: countIn(boxes[0], isInk),
      unapprovedBlue: countIn(boxes[1], isBlue),
      hiddenBlue: countIn(boxes[2], isBlue),
      artworkIdentical: identical,
    };
  });
}
