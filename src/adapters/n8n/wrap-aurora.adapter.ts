import { fuseAuroraSignals, parseAuroraWatchUK, parseNasaDonkiCme } from '../../lib/aurora-providers.js';
import type { N8nRuntime } from './types.js';

/**
 * Wraps aurora prediction data from two upstream HTTP nodes:
 *   - HTTP: AuroraWatch UK  (near-term, XML)
 *   - HTTP: NASA DONKI CME  (long-range, JSON array)
 *
 * Both HTTP nodes feed into Merge: Aurora HTTP before this code node,
 * ensuring both have completed. Named-node access via `$` reads each
 * response independently to avoid JSON/array merge ambiguity.
 *
 * Returns: [{ json: { auroraSignal } }]
 *   auroraSignal may represent partial data when one provider fails.
 */
export function run({ $ }: N8nRuntime) {
  try {
    const awukRaw = (() => {
      try { return $('HTTP: AuroraWatch UK').first().json; } catch { return null; }
    })();

    const donkiRaw = (() => {
      try {
        const items = $('HTTP: NASA DONKI CME').all();
        if (items.length === 1 && Array.isArray(items[0]?.json)) {
          // n8n returned the JSON array as items[0].json
          return items[0].json as unknown[];
        }
        if (items.length > 1) {
          // n8n split the array into multiple items (one per CME event)
          return items.map(i => i.json);
        }
        return items[0]?.json ?? null;
      } catch { return null; }
    })();

    const nearTerm = parseAuroraWatchUK(awukRaw);
    const longRange = parseNasaDonkiCme(donkiRaw);
    const auroraSignal = fuseAuroraSignals(nearTerm, longRange);

    return [{ json: { auroraSignal } }];
  } catch {
    return [{ json: { auroraSignal: null } }];
  }
}
