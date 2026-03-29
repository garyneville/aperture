# Aperture

Source repository for the Leeds photo brief app.

This repo owns the application code:
- forecasting and scoring logic
- prompt/editorial generation
- email, site, and Telegram rendering
- n8n workflow source and generated workflow JSON

Branch layout:
- `main`: application source
- `gh-pages`: published static site output for `https://garyneville.github.io/aperture/`

Key paths:
- `src/core`: app logic
- `src/adapters/n8n`: n8n runtime adapters
- `workflow/skeleton.json`: workflow source
- `workflow/photography-weather-brief.json`: generated n8n workflow artifact

Common commands:
- `npm test`
- `npm run typecheck`
- `npm run build`

The homelab/infrastructure repo is `garyneville/home`. This repo is the source of truth for the photography application itself.
