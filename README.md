# AM First-Time Quality

Virginia Tech Senior Design prototype for AI-assisted metallic additive-manufacturing build preparation and first-time-quality analysis.

## Current prototype
- STL upload and interactive 3D inspection
- Material and AM-process configuration
- Preflight engineering checks
- Build-readiness workspace
- Vercel-ready Next.js architecture

## Automatic change ticker

The repository tracks code/configuration changes on `main` in [`CHANGE_TICKER.json`](./CHANGE_TICKER.json). A GitHub Actions workflow increments the counter once for each pushed commit that changes source code, tests, dependencies, or build/configuration files. Documentation-only changes and the ticker's own update do not increment it. The workflow commits the updated counter directly to `main`; no extra branch is created.

The ticker advances after code changes are pushed to GitHub, not while edits remain uncommitted on a developer's computer. Check the Actions tab if an increment has not appeared yet.

## Run locally
```bash
npm install
npm run dev
```

## Deploy
Import this repository into Vercel. Framework detection should select Next.js automatically.

> Engineering prototype only. Recommendations and generated settings must be independently validated before use on manufacturing equipment. Do not commit controlled, proprietary, export-controlled, or otherwise restricted data.
