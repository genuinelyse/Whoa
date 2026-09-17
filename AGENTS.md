# Base44 Dev Environment

## Project Overview
OpenCut / "Bannr" — a mobile-first banner builder and animation editor. Monorepo with:
- `apps/web` — Vite + React 19 + Tailwind CSS v4 frontend (the main preview target)
- `apps/api` — Cloudflare Worker (Elysia) — not referenced by the web app, not needed for preview
- `apps/desktop` — Rust/GPUI desktop app — not needed for preview

## Running the App
```sh
docker compose -f docker-compose.base44.yml up -d
```
- Web app serves on **port 3000** via Vite dev server (live reload enabled)
- `node:22-slim` base image, source bind-mounted at `/app`
- `npm install` runs at container startup (no lockfile; deps resolve fresh)
- Named volumes keep `node_modules` persistent across restarts

## Key Details
- No environment variables or secrets required — the web app is fully standalone
- Vite config already has `host: 0.0.0.0`, `allowedHosts: true`, and HMR on port 443/wss
- The `#` path alias maps to `apps/web/src` (see `vite.config.ts` and `tsconfig.json`)
- Health check: `GET /` returns 200

## Verification
```sh
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # expect 200
curl -s http://localhost:3000/src/main.tsx | head -5            # expect transformed JS
```
