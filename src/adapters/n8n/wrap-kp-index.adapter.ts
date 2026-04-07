import type { N8nRuntime } from './types.js';

type KpEntry = { time: string; kp: number };
type KpIndexOutput = { kpForecast: KpEntry[]; kpError?: boolean };

/**
 * Wraps NOAA SWPC planetary Kp-index forecast.
 * Endpoint: https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json
 * Response: array-of-arrays, first row is headers ["time_tag", "kp", "observed", "noaa_scale"]
 */
export function run({ $input }: N8nRuntime): [{ json: KpIndexOutput }] {
  try {
    const items = $input.all();

    // n8n may return the JSON array as a single item containing the array,
    // or as multiple items (one per row) — handle both.
    let rawRows: unknown[];
    if (items.length === 1 && Array.isArray(items[0].json)) {
      rawRows = items[0].json as unknown[];
    } else {
      rawRows = items.map(item => item.json);
    }

    const today = new Date().toISOString().slice(0, 10); // UTC midnight cutoff

    const kpForecast = rawRows
      .filter(row => Array.isArray(row) && row.length >= 2 && !isNaN(parseFloat(String(row[1]))))
      .map(row => ({
        time: String((row as unknown[])[0]),
        kp: parseFloat(String((row as unknown[])[1])),
      }))
      .filter(entry => entry.time >= today);

    return [{ json: { kpForecast } }];
  } catch (err) {
    console.warn('[wrap-kp-index] failed to process Kp-index data:', err instanceof Error ? err.message : err);
    return [{ json: { kpForecast: [], kpError: true } }];
  }
}
