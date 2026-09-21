# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Workflow rules

**Work on `main`.** The repository owner reviews changes as they land and
asked for work to go straight onto the default branch, so do not open a side
branch or a pull request unless they ask for one. `main` is what people clone,
so run `npm run lint`, `npm run build` and `npm test` before every push to it.

**Commit after every result report.** Whenever a piece of work is reported as
done — an analysis, a fix, a refactor, a status report — commit what it
produced before ending the turn, and push to the working branch. This
environment runs in an ephemeral container that is reclaimed after the
session, so anything uncommitted is lost.

Two clarifications on that rule:

- A report that produced no file changes has nothing to commit. Say so
  instead of manufacturing a commit.
- Byproducts are not work product. Build output, scratch files and logs get
  deleted, not committed. `dist/`, `node_modules/` and `.env*` are already
  ignored.

## What this app is

An image translation tool for comics and manga. The user supplies 1–100
images; the app finds the text, translates it, and writes each approved page
back out as an image with the original text replaced in place.

The workflow is review-then-export, not load-in-get-out. Machine output is a
draft the user corrects by hand. Pages leave the app **one at a time as they
are approved**, written into an output folder — never as a single archive,
and never all at once at the end.

Two translation engines, chosen by the user:

1. **AI** — the user picks a provider and pastes their own API key.
2. **Offline** — models run on the user's own device, no account, no network.

Offline is the priority. Japanese to English is the minimum bar; other pairs
are welcome but not required.

## Architecture

**No server.** The app must run standalone as an Android APK and as a PC
application. A background service the user has to start is not offline, so
all inference happens on-device, in the client.

This is why `server.ts` (Express + server-side Gemini) is being retired. Its
prompts, language plumbing and error handling move into the client engine
layer; only the location changes. An API key the user pastes stays on their
own device, so no server is needed to hide it either.

One UI codebase, three shells: browser, PC (Tauri), Android (WebView). Do not
fork the interface per platform.

The offline pipeline runs through Transformers.js / ONNX Runtime Web, which
execute ONNX models in the browser with no backend. Verified components:

| Step | Model | Size |
| --- | --- | --- |
| Find text regions | `huyvux3005/manga109-segmentation-bubble` (YOLO seg) | 12 MB `.pt`, needs ONNX export |
| Read Japanese text | `onnx-community/manga-ocr-base-ONNX` | 117 MB int8, 74 MB q4f16 |
| Translate ja→en | `Xenova/opus-mt-ja-en` | Transformers.js ONNX build |

The manga-ocr ONNX card declares `library_name: transformers.js`, so it is
built for exactly this use. A ~1 GB install is acceptable; do not trade
quality for size without being asked.

Writing files: use the File System Access API on desktop browsers, the native
filesystem in the Tauri and Android shells, and fall back to one download per
approved page where neither exists. Never zip.

## Known constraint when working in the cloud container

`huggingface.co` is blocked by the egress proxy here (403), so models cannot
be downloaded and inference cannot be run end to end in this environment.
Code, typecheck and build are verifiable; actual model output is not. Say so
rather than implying a pipeline was tested.

## Commands

```
npm install
npm run dev            # tsx server.ts, listens on :3000  (being retired)
npm run lint           # tsc --noEmit
npm run build          # vite build + esbuild bundle of server.ts
npm start              # node dist/server.cjs
npm run test:detector  # runs BubbleDetector in a real browser
npm run test:render    # renders a page and checks the result, in a browser
npm test               # both browser tests
```

`test:detector` needs Playwright, which is deliberately not a dependency
because installing it pulls down a browser: `npm i -D playwright && npx
playwright install chromium`. In this container a browser is already present,
so run it as `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:detector`
and never run `playwright install`.

Installing `@huggingface/transformers` here needs `--ignore-scripts`: its
`onnxruntime-node` dependency downloads a native binary in a postinstall step
and the egress proxy blocks that host. The binary is only used when
Transformers.js runs under Node, and this app runs it in the browser.

## Engine layer

`src/engine/` is the seam between the app and whatever does the translating.
`TranslationEngine` in `src/engine/types.ts` is the whole contract; the app
must not reach past it into a provider.

- `ai/` — hosted models. `provider.ts` is the shape a provider implements,
  `gemini.ts` is one, and `AI_PROVIDERS` in `ai/index.ts` is what fills the
  platform dropdown. Adding a provider is a new file plus a line in that list.
  Requests go straight from the user's device with the key they pasted.
- `offline/` — on-device. `bubbleDetector.ts` finds regions, Transformers.js
  reads and translates them. `TextRegionDetector` is an interface so a trained
  ONNX detector can replace the classical one without touching the engine.

Engines never fabricate. A failure throws `EngineError` with a code; a region
the model skipped is left empty so the UI shows the original text. Do not add
a fallback that returns invented regions or translations.

## Output layer

`src/output/` turns an approved page into a file on disk.

- `renderPage.ts` — draws the page at source resolution, covers each approved
  region with a colour sampled from the page itself, and sets the translation
  in it. Bubbles are filled and fitted as ellipses, not rectangles: a
  rectangular patch cuts a bubble's outline off, and text laid out to the
  bounding box crosses it. Words are never split to justify a larger font.
- `destination.ts` — one upload is one session, one folder. Pages are handed
  over as they are approved. Writes into a folder the user picked through the
  File System Access API, and falls back to one download per page. Never zips.

Both are covered by browser tests. Keep them passing: they are the only thing
in this repository that proves the output is real.

## Known landmines

Verified by running the toolchain, not by reading alone.

- `tsconfig.json` does not set `strict`, so a clean `npm run lint` proves
  much less than it looks like. Null assignments to non-nullable fields pass
  silently.
- Regions produced by the translation engine omit `font`, `fontSize`,
  `align`, `isHidden` and `isApplied`, all of which `Region` in
  `src/types.ts` declares as required. Only regions drawn in `Canvas.tsx`
  carry them.
- Around a hundred Tailwind classes use shades that do not exist
  (`bg-gray-55`, `text-stone-250`, `text-blue-550`, ...). They emit no CSS.
  Check a class against the built stylesheet before trusting it.
- The UI has no responsive breakpoints at all, and the fixed 66px toolbar
  plus 360px properties panel exceed a phone's width on their own. The
  layout needs rebuilding for the Android shell, not tweaking.
- The Export button still calls the old simulated path and downloads a
  hardcoded SVG under a `.png` filename. `src/output/` replaces it and works;
  nothing calls it yet.
- The three built-in sample pages are `div`s pretending to be comic panels.
  They are dead weight once real images are the input; delete them with the
  client rework.
