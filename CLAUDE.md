# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Workflow rules

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
npm run dev      # tsx server.ts, listens on :3000  (being retired)
npm run lint     # tsc --noEmit
npm run build    # vite build + esbuild bundle of server.ts
npm start        # node dist/server.cjs
```

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
- Export and inpainting are still simulated. The download is a hardcoded SVG
  served under a `.png` filename.
- The three built-in sample pages are `div`s pretending to be comic panels.
  They are dead weight once real images are the input; delete them with the
  client rework.
