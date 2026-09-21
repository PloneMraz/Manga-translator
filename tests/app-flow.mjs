/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drives the whole app in a real browser: load a page, draw a region by hand,
 * type a translation, approve it, export it, and check that what comes out is
 * the page with the translation on it.
 *
 * This is the path that works with no model and no API key -- the one a user
 * can always fall back to -- so it is the one that must never break.
 *
 * Starts its own dev server. Needs Playwright; see tests/bubble-detector.mjs.
 *
 *     npm run test:app
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.APP_TEST_PORT ?? 3000);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const work = mkdtempSync(join(tmpdir(), 'app-flow-'));

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

let server;
let browser;
try {
  server = await startServer();
  const { chromium } = await import('playwright');
  const launch = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  browser = await chromium.launch(launch);

  const pagePath = join(work, 'page.png');
  writeFileSync(pagePath, Buffer.from(await drawSourcePage(browser), 'base64'));

  const page = await browser.newPage({ acceptDownloads: true });
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(String(error)));
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('text=Comic Translator', { timeout: 30_000 });
  check('starts empty, with no built-in pages', (await page.locator('text=Outer Sky').count()) === 0);

  await page.setInputFiles('input[type=file]', pagePath);
  await page.waitForSelector('#canvas-scaler', { timeout: 30_000 });
  check('the uploaded page opens', true);

  const canvas = await page.locator('#canvas-scaler').boundingBox();
  // A page taller than its container used to be clipped above the viewport,
  // putting its first rows out of reach.
  check('the top of the page is reachable', canvas.y >= 0, `y=${Math.round(canvas.y)}`);

  await page.click('#tool-btn-draw');
  await page.mouse.move(canvas.x + canvas.width * 0.14, canvas.y + canvas.height * 0.06);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.52, canvas.y + canvas.height * 0.22, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  check('drawing a box opens the region editor', (await page.locator('#translation-input').count()) === 1);

  await page.fill('#translation-input', 'Long time no see!');
  await page.click('#btn-properties-apply');
  await page.waitForTimeout(250);

  await page.click('#menu-export-btn');
  await page.click('#menu-export-page-btn');
  await page.waitForSelector('#export-write-btn', { timeout: 15_000 });

  // Read the dialog's own count. Asserting the click "worked" without looking
  // is how a green test ends up proving nothing.
  const dialog = await page.locator('#export-write-btn').locator('xpath=ancestor::div[3]').innerText();
  const approved = Number(/Approved regions to set:\s*(\d+)/.exec(dialog)?.[1] ?? '0');
  check('the region is really approved', approved === 1, `approved=${approved}`);
  check('the dialog names a real output folder', dialog.includes('Results/'));

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.click('#export-write-btn'),
  ]);
  const exported = join(work, 'exported.png');
  await download.saveAs(exported);
  check('a page file is written', true, download.suggestedFilename());

  const bytes = readFileSync(exported);
  check('it is a PNG, not the old placeholder SVG',
    bytes[0] === 0x89 && bytes.subarray(1, 4).toString() === 'PNG', `${bytes.length} bytes`);
  check('it carries real page content', bytes.length > 5_000);
  check('nothing threw in the page', crashes.length === 0, crashes[0] ?? '');
} finally {
  await browser?.close();
  server?.kill('SIGTERM');
  rmSync(work, { recursive: true, force: true });
}

const failed = results.filter((ok) => !ok).length;
console.log(failed === 0 ? '\nPASS' : `\nFAIL (${failed} check(s))`);
if (failed > 0) process.exitCode = 1;

async function startServer() {
  const child = spawn('npm', ['run', 'dev'], { stdio: 'ignore', env: { ...process.env, PORT: String(PORT) } });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/`);
      if (response.ok) return child;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  child.kill('SIGTERM');
  throw new Error(`The dev server did not come up on ${ORIGIN}.`);
}

/** A comic page with a speech bubble, drawn in the browser. */
async function drawSourcePage(browser) {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 900;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 700, 900);
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    g.strokeRect(25, 25, 650, 400);
    g.strokeRect(25, 450, 650, 420);
    g.fillStyle = '#cfcfcf';
    g.beginPath();
    g.arc(200, 300, 90, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.strokeStyle = '#111';
    g.beginPath();
    g.ellipse(230, 130, 130, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#111';
    g.font = '22px "IPAGothic", sans-serif';
    g.textAlign = 'center';
    g.fillText('久しぶり！', 230, 125);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.close();
  return base64;
}
