# Telegram Presenter Primer

This folder contains the Telegram message formatter. It transforms brief data into HTML-formatted messages suitable for Telegram's Bot API.

## Purpose

- render the photo brief as a Telegram HTML message
- work within Telegram's HTML subset constraints
- provide a concise, mobile-friendly summary of conditions
- use emoji and formatting that renders well in Telegram clients

## Public Entry Points

- [`format-telegram.ts`](./format-telegram.ts)
  `formatTelegram(input)` — Main entry point. Accepts `BriefRenderInput` and returns an HTML-formatted string for Telegram.

Exported types (re-exports from brief types):
```typescript
export type {
  AltLocation, CarWash, DarkSkyAlertCard, DaySummary,
  LongRangeCard, Window, WindowHour,
} from '../../contracts/index.js';

export type FormatTelegramInput = BriefRenderInput;
```

## Main Files / Module Map

- `format-telegram.ts`
  Single-file presenter with helper functions and main export. Organized into:
  - Helper functions for specific sections (alternatives, windows, 5-day forecast, car wash, long range)
  - Main `formatTelegram()` function that assembles the complete message

### Helper Functions

- `altsTelegram(alts)` — Formats alternative locations with emoji indicators
- `windowsTelegram(wins)` — Formats shooting windows with weather details
- `photoFiveDayTelegram(days)` — Formats 4-day photo forecast with bar charts
- `cwFiveDayTelegram(days)` — Formats car wash forecast
- `longRangeTelegram(top, label, alert)` — Formats long-range destination section

## Data In / Data Out

**Input (`FormatTelegramInput` / `BriefRenderInput`):**
```typescript
{
  dontBother: boolean
  windows: Window[]
  dailySummary: DaySummary[]
  altLocations: AltLocation[]
  aiText: string
  sunriseStr: string
  sunsetStr: string
  moonPct: number
  peakKpTonight: number | null
  longRangeTop: LongRangeCard | null
  // ... (see ../../contracts/brief.ts for complete type)
}
```

**Output:**
HTML-formatted string using Telegram's allowed tags:
- `<b>` — bold
- `<i>` — italic
- `<code>` — monospace (used for aligned tables)
- Emoji characters for visual indicators

## Telegram HTML Constraints

Telegram supports a limited HTML subset. This formatter uses:
- `<b>` for bold headers and emphasis
- `<i>` for italic hints and secondary text
- `<code>` for monospace alignment (forecast tables)
- Unicode emoji for visual indicators (📷, 🔥, 🌅, 🌙, etc.)

**Not supported** (and not used):
- `<br>` (use `\n` instead)
- CSS styles
- Nested tags beyond simple combinations

## What Belongs Here

- Telegram-specific message formatting
- Emoji selection and placement
- Concise summary logic (mobile-optimized)
- Telegram HTML tag usage
- Character-efficient formatting

## What Does Not Belong Here

- **Full HTML documents** — belongs in `../site/`
- **Email markup** — belongs in `../email/`
- **Business logic** — belongs in `src/domain`
- **Shared formatting** — use `../shared/brief-primitives.ts` for colors/icons if needed

## Tests

Tests for Telegram formatting are typically covered via integration tests in the adapter layer:
- [`../../adapters/n8n/format-messages.adapter.test.ts`](../../adapters/n8n/format-messages.adapter.test.ts)

## Working Rule

Keep Telegram output concise and scannable. Mobile users need to glance and understand conditions quickly. Use emoji for visual scanning, monospace tables for alignment, and bold for key information. The "don't bother" state should be immediately obvious from the first line.

## Output Structure

The formatted message follows this structure:

```
📷 {Location} Photo Brief — {Date}
🌅 {sunrise}  🌇 {sunset}  🌙 {moon}% moon
{hue/aurora lines if applicable}
───────────────────────
{windows or "Not worth it today"}

💬 {AI editorial text}

📍 Other places to consider today:
{alternatives list}

───────────────────────
📅 Days Ahead
{4-day forecast table}

🚗 Car Wash Forecast
{car wash table}
```

## Related Docs

- [`../email/README.md`](../email/README.md) — Email presenter (similar input, different output)
- [`../site/README.md`](../site/README.md) — Site presenter (full HTML output)
- [`../../adapters/n8n/README.md`](../../adapters/n8n/README.md) — How Telegram messages are sent via n8n
