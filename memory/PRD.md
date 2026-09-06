# Bannr — Mobile-First Banner Builder (PRD)

## Problem Statement
Rewrite the forked OpenCut repo into a **banner builder** with **CapCut-style UX/UI** (dark UI, bottom toolbar, timeline) that is **mobile-first**. Build the **frontend first with mock data** so the user can click around and validate UX before a backend is built.

## User Choices (from kickoff)
- Banner types: Social media, Web/display ads, Event/marketing posters, Video ads (display + fullscreen).
- Both **static** and **animated** (CapCut-style timeline) banners.
- Tools: backgrounds & templates, layers + timeline, images/stickers/upload, text, HTML shapes (square/circle/custom) with cut/merge/mask.
- Look: **match CapCut** (dark, bottom toolbar, mobile-first).
- Build inside the same forked repo. Frontend-first, mock data OK.

## Architecture
- Repo is a monorepo (`/app/apps/web`, `apps/desktop`, `apps/api`). Original web app was Vite + TanStack Start + Cloudflare (needs Node 22).
- Converted `apps/web` to a **client-only Vite SPA** (React 19 + Tailwind v4), dropping SSR/Cloudflare/wrangler (Node-20 incompatible) — no routing, view state toggles Home/Editor.
- Served on **port 3000** via supervisor; `/app/frontend` is a **symlink → /app/apps/web** (supervisor runs `yarn start` = `vite --host 0.0.0.0 --port 3000`).
- No backend yet. All data is in-memory mock data.

### Key files
- `src/App.tsx` — mobile device-frame + Home/Editor view state
- `src/screens/Home.tsx` — projects, templates, size preset picker
- `src/screens/Editor.tsx` — EditorProvider + RAF playback loop
- `src/store/editor.tsx` — reducer store (layers, selection, tool, time, mode)
- `src/components/editor/{TopBar,Canvas,Toolbar,Timeline,Panels,ExportSheet}.tsx`
- `src/lib/data.ts` — presets, templates, fonts, palette, gradients, stickers, mock recents
- `src/types.ts` — Layer/Preset/Project types

## Implemented (2026-06-23)
- **Home**: Bannr header, New Banner CTA, size preset picker (4 categories, 15 presets), Recent (mock x3), Templates bento (6).
- **Editor**: scaled artboard on checkerboard, tap-to-select, drag-move, corner resize, double-tap text edit (select-all on entry).
- **Tools**: Text (headings), Elements (rect/circle/triangle/star/line), Stickers (emoji), Image (device upload via FileReader + stock), Background (solid/gradient/image), Layers (reorder/visibility/delete).
- **Contextual toolbar** per layer type: font, color/fill, style (size/weight/opacity), align, shape swap, corner radius, mask (radius-based + MOCKED cut/merge), animate, duplicate, delete, reorder.
- **Timeline**: per-layer clips (color-coded), draggable playhead scrub, trim handles, play/pause with RAF, zoom in/out, time readout. Split MOCKED (disabled).
- **Animation**: entrance anims (fade/rise/pop/slide); static shows composed frame, animated plays/scrubs over time.
- **Export**: mock sheet, format depends on mode (MP4/GIF/PNG animated; PNG/JPG/SVG static), quality, fake render progress → success.
- Testing: iteration_2.json = 100% retests + regression pass, 0 console errors.

## Fixes (2026-06-23, post-MVP)
- **Corner resize**: all 4 corners now resize (was bottom-right only). Handles moved to an overlay above all layers (no occlusion); text scales fontSize; move/resize clamped to artboard bounds.
- **Text editing**: rewrote inline edit as an uncontrolled `EditableText` (focus + select-all once). Commits on blur AND on unmount (tap empty canvas). Fixed React 19 StrictMode double-effect via split `onCommit`/`onDone` + `committed` ref reset. Verified across all commit paths (iteration_5.json).

## Status of mocks
- Export rendering/saving: **MOCKED**.
- Cut/Merge boolean ops: **MOCKED** (mask via radius is real).
- All projects/templates/recents: **in-memory mock** (no persistence — lost on Home nav).

## Backlog / Next
- **P0 (backend phase)**: persistence (projects CRUD, autosave), real export (server-side render to PNG/JPG/MP4/GIF), asset/upload storage.
- **P1**: real user templates library, undo/redo history, multi-select & group, real crop, boolean cut/merge, font uploads.
- **P2**: collaboration, brand kits, share links, keyframe-level animation, transitions between clips.
- **Polish (LOW)**: fit-to-width option for wide presets, timeline vertical scroll affordance for 4+ layers, scrub-over-clips.
