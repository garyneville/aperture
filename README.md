# Aperture

Source repository for the Leeds photo brief app.

This repo owns the application code:
- forecasting and scoring logic
- prompt/editorial generation
- email, site, and Telegram rendering
- n8n workflow source and generated workflow JSON

## What This System Does

Aperture fetches weather forecast data from multiple providers (Open-Meteo, OpenWeather, METAR, etc.), scores the conditions for photography quality, generates editorial content via AI providers (Groq, Gemini), and renders the results as email, web page, Telegram message, and machine-readable JSON. The entire pipeline runs on a schedule via n8n, with output published to GitHub Pages and sent via email/Telegram.

## Branch Layout

- `main`: application source
- `gh-pages`: published static site output for `https://garyneville.github.io/aperture/`

## Key Paths

- `src/app/run-photo-brief`: orchestration entrypoint
- `src/domain`: scoring and editorial domain logic
- `src/presenters`: email, site, Telegram, and brief JSON presenters
- `src/adapters/n8n`: n8n runtime adapters
- `src/contracts`: public cross-layer type contracts
- `workflow/source/skeleton.json`: workflow source
- `generated/workflow/photography-weather-brief.json`: generated n8n workflow artifact

## Common Commands

- `npm test`
- `npm run typecheck`
- `npm run build`

## Where to Make Changes

| If you want to... | Look in... |
|-------------------|------------|
| Change how weather is scored | `src/domain/scoring/` |
| Change AI prompts or fallbacks | `src/domain/editorial/` |
| Change email appearance | `src/presenters/email/` |
| Change site appearance | `src/presenters/site/sections/` |
| Change Telegram format | `src/presenters/telegram/` |
| Change the workflow pipeline | `src/app/run-photo-brief/` |
| Change n8n integration | `src/adapters/n8n/` |
| Add a new output format | `src/presenters/` (new folder) |

## Documentation

- [`docs/architecture.md`](./docs/architecture.md) — System architecture and data flow
- [`src/app/README.md`](./src/app/README.md) — App layer orchestration
- [`src/app/run-photo-brief/README.md`](./src/app/run-photo-brief/README.md) — Main use case
- [`src/domain/README.md`](./src/domain/README.md) — Domain layer (scoring, editorial)
- [`src/domain/scoring/README.md`](./src/domain/scoring/README.md) — Scoring details
- [`src/domain/editorial/README.md`](./src/domain/editorial/README.md) — Editorial details
- [`src/presenters/README.md`](./src/presenters/README.md) — Presenter layer overview
- [`src/presenters/email/README.md`](./src/presenters/email/README.md) — Email presenter
- [`src/presenters/site/README.md`](./src/presenters/site/README.md) — Site presenter
- [`src/presenters/telegram/README.md`](./src/presenters/telegram/README.md) — Telegram presenter
- [`src/presenters/brief-json/README.md`](./src/presenters/brief-json/README.md) — JSON output
- [`src/presenters/shared/README.md`](./src/presenters/shared/README.md) — Shared primitives
- [`src/contracts/README.md`](./src/contracts/README.md) — Public contracts
- [`src/adapters/n8n/README.md`](./src/adapters/n8n/README.md) — n8n adapter boundary
- [`src/lib/README.md`](./src/lib/README.md) — Shared utilities
- [`workflow/build/README.md`](./workflow/build/README.md) — Workflow generation

## New Contributors / Coding Agents Start Here

1. Read [`docs/architecture.md`](./docs/architecture.md) for the system overview
2. Read [`src/app/run-photo-brief/README.md`](./src/app/run-photo-brief/README.md) to understand the main workflow
3. Read the relevant layer primer (`src/domain/`, `src/presenters/`, etc.) for the area you're changing
4. Check the working rules in each README — they explain what belongs where

The homelab/infrastructure repo is `garyneville/home`. This repo is the source of truth for the photography application itself.
