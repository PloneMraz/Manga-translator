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

## Project

Comic/manga translation workspace exported from Google AI Studio. React 19 +
Vite 6 + Tailwind 4 on the client, Express 4 + `@google/genai` on the server.
`server.ts` serves both the API and the Vite middleware.

## Commands

```
npm install
npm run dev      # tsx server.ts, listens on :3000
npm run lint     # tsc --noEmit
npm run build    # vite build + esbuild bundle of server.ts
npm start        # node dist/server.cjs
```

## Known landmines

Verified by running the toolchain, not by reading alone. Fix these rather
than working around them.

- `npm start` crashes on boot. `server.ts` calls
  `fileURLToPath(import.meta.url)`, but the build bundles it as CJS, where
  `import.meta` is empty. Both `__filename` and `__dirname` are dead code —
  the production branch uses `process.cwd()`.
- `tsconfig.json` does not set `strict`, so a clean `npm run lint` proves
  much less than it looks like. Null assignments to non-nullable fields pass
  silently.
- The server's `catch` blocks return HTTP 200 with `success: true` and
  hardcoded Japanese sample regions. The client never reads the `warning`
  field, so a failed API call is indistinguishable from a real result.
- Regions returned by the server omit `font`, `fontSize`, `align`,
  `isHidden` and `isApplied`, all of which `Region` in `src/types.ts`
  declares as required.
- Around a hundred Tailwind classes use shades that do not exist
  (`bg-gray-55`, `text-stone-250`, `text-blue-550`, ...). They emit no CSS.
  Check a class against the built stylesheet before trusting it.
- Export and inpainting are simulated. The download is a hardcoded SVG.
