/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Copies ONNX Runtime Web's WebAssembly files into public/ort/.
 *
 * ORT loads its .wasm at runtime by URL rather than through an import, so a
 * bundler never sees it. Left alone, the request falls through to the SPA
 * fallback and the runtime is handed index.html, which fails as
 * "expected magic word 00 61 73 6d, found 3c 21 64 6f" -- that being the
 * start of "<!doctype html>".
 *
 * Serving them from a path we control fixes it here, and is also how the
 * desktop and Android shells will ship them.
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FROM = join('node_modules', 'onnxruntime-web', 'dist');
const TO = join('public', 'ort');

mkdirSync(TO, { recursive: true });

let copied = 0;
let bytes = 0;
for (const name of readdirSync(FROM)) {
  // The .mjs loaders sit beside the .wasm they instantiate; both are needed.
  if (!/^ort-wasm-.*\.(wasm|mjs)$/.test(name)) continue;
  const source = join(FROM, name);
  copyFileSync(source, join(TO, name));
  copied += 1;
  bytes += statSync(source).size;
}

console.log(`sync-ort: ${copied} file(s), ${(bytes / 1e6).toFixed(0)} MB -> ${TO}`);
