/**
 * wrap-mwis.adapter.ts — Phase 2 MWIS advisory stub
 *
 * Mountain Weather Information Service (MWIS) provides human-written forecasts
 * for UK upland areas. This adapter is a Phase 2 placeholder that defines the
 * provider interface and graceful fallback behaviour.
 *
 * # How MWIS plugs in (Phase 2)
 *
 * MWIS publishes area forecasts as structured HTML pages (no formal JSON API).
 * The recommended integration path is:
 *
 *   1. Add an n8n HTTP node that fetches the MWIS RSS feed for the relevant
 *      area (e.g. "Yorkshire Dales & Peak District"):
 *        https://www.mwis.org.uk/rss/english/yorkshire-dales-peak-district
 *
 *   2. Feed the RSS XML into this adapter, which parses the `<description>`
 *      element and extracts advisory signals (snow, visibility, wind).
 *
 *   3. The parsed `MwisAreaForecast` is fanned out to all alt locations whose
 *      `mwisArea` field matches. Each location receives a `mwisAdvisory` string
 *      that the email card can surface as supplementary text.
 *
 *   4. Scoring continues to come from Open-Meteo numeric data. MWIS text is
 *      advisory-only and never overrides the numeric score.
 *
 * # Precedence
 *   - Open-Meteo provides numeric scores (temperature, wind, visibility).
 *   - MWIS provides qualitative advisory copy for the alt card.
 *   - If MWIS is unavailable, the card renders without the advisory note
 *     (graceful fallback — no error surfaced to the user).
 *
 * # Coverage areas (mwisArea keys used in ALT_LOCATIONS config)
 *   - 'dales_peak'  → Yorkshire Dales & Peak District
 *   - 'lakes'       → Lake District
 *   - 'snowdonia'   → Snowdonia
 */

/** MWIS area identifiers matching the `mwisArea` field on AltLocation. */
export type MwisAreaKey = 'dales_peak' | 'lakes' | 'snowdonia';

/** Parsed advisory signals from an MWIS area forecast. */
export interface MwisAreaForecast {
  area: MwisAreaKey;
  /** Raw advisory text extracted from the MWIS forecast page / RSS item. */
  rawText: string;
  /** True when MWIS mentions significant snow on high ground. */
  snowOnHighGround: boolean;
  /** True when MWIS warns of poor visibility on summits. */
  poorVisibilityHighGround: boolean;
  /** True when MWIS warns of severe or gale-force winds on high ground. */
  severeWindHighGround: boolean;
  /** ISO timestamp of when the forecast was fetched (for staleness checks). */
  fetchedAt: string;
}

/** Graceful no-op result when MWIS is unavailable. */
export const MWIS_UNAVAILABLE: null = null;

/**
 * Parse a raw MWIS RSS `<description>` string into advisory signals.
 *
 * This is intentionally lightweight — MWIS text is human-written and varies
 * in structure. The patterns below catch the most common phrasings without
 * brittle exact-match logic.
 *
 * @param rawText  The plain-text content of the MWIS forecast item.
 * @param area     The MWIS area key this forecast belongs to.
 * @returns        A `MwisAreaForecast` or `null` if rawText is empty/invalid.
 */
export function parseMwisAdvisory(rawText: string, area: MwisAreaKey): MwisAreaForecast | null {
  if (!rawText || rawText.trim().length === 0) return MWIS_UNAVAILABLE;

  const lower = rawText.toLowerCase();

  const snowOnHighGround =
    /snow (on|above|on the) (high ground|summits?|tops?|ridges?)/.test(lower) ||
    /lying snow/.test(lower) ||
    /snow cover/.test(lower);

  const poorVisibilityHighGround =
    /poor visibility/.test(lower) ||
    /low cloud/.test(lower) ||
    /hill fog/.test(lower) ||
    /mist (on|above)/.test(lower) ||
    /cloud (on|covering) (summits?|tops?)/.test(lower);

  const severeWindHighGround =
    /gale/.test(lower) ||
    /storm force/.test(lower) ||
    /severe (gusts?|winds?)/.test(lower) ||
    /very strong winds?/.test(lower);

  return {
    area,
    rawText: rawText.trim(),
    snowOnHighGround,
    poorVisibilityHighGround,
    severeWindHighGround,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Build a concise advisory note for display in an alt location card.
 *
 * Returns an empty string when no advisory conditions are present so the card
 * renders cleanly without a blank note row.
 */
export function buildMwisAdvisoryNote(forecast: MwisAreaForecast | null): string {
  if (!forecast) return '';

  const signals: string[] = [];
  if (forecast.snowOnHighGround) signals.push('snow on high ground');
  if (forecast.poorVisibilityHighGround) signals.push('poor summit visibility');
  if (forecast.severeWindHighGround) signals.push('severe winds on high ground');

  if (signals.length === 0) return '';
  return `Mountain advisory: ${signals.join(', ')}.`;
}
