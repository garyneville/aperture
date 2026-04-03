/**
 * aurora-providers.ts
 *
 * Unified aurora prediction module. Provides:
 *   - A minimal SpaceWeatherProvider interface for extensibility
 *   - AuroraWatch UK near-term status parser (XML)
 *   - NASA DONKI CME long-range parser (JSON)
 *   - Signal fusion logic (fuse both sources into one user-facing AuroraSignal)
 *
 * Designed to degrade gracefully when one or both providers are unavailable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuroraLevel = 'green' | 'yellow' | 'amber' | 'red';

/** One Earth-directed coronal mass ejection from NASA DONKI. */
export interface CmeEvent {
  activityId: string;
  startTime: string;
  /** Estimated shock arrival time at Earth (ISO 8601). Null when model unavailable. */
  estimatedArrivalTime: string | null;
  /** Human-readable CME note from NASA. */
  note: string;
  /** Kp index estimated by the ENLIL model (max across lead times). */
  estimatedKp: number | null;
}

/**
 * Near-term aurora status from AuroraWatch UK.
 * Freshness: the API updates every ~15 minutes; treat as stale after 2 h.
 */
export interface NearTermAurora {
  level: AuroraLevel;
  /** ISO 8601 timestamp of the reading (from the API's `created` attribute). */
  fetchedAt: string;
  isStale: boolean;
}

/**
 * Long-range aurora outlook from NASA DONKI CME feed.
 * Covers Earth-directed CMEs expected 1–4 days ahead.
 */
export interface LongRangeAurora {
  earthDirectedCmes: CmeEvent[];
  /** ISO 8601 timestamp of the most recently started CME event in the response. */
  fetchedAt: string;
  isStale: boolean;
}

/**
 * Unified aurora signal ready for display and prompt injection.
 */
export interface AuroraSignal {
  /** AuroraWatch UK near-term reading (tonight). Null when unavailable. */
  nearTerm: NearTermAurora | null;
  /** NASA DONKI CME long-range outlook (next 1–4 days). Null when unavailable. */
  longRange: LongRangeAurora | null;
  /**
   * The most severe level across both sources, for quick UI decisions.
   * 'none' means both providers returned no data.
   */
  dominantLevel: AuroraLevel | 'none';
  /**
   * Temporal scope of the dominant signal.
   * 'tonight' = driven by AuroraWatch UK (near-term).
   * 'days-ahead' = driven by NASA DONKI (long-range, no near-term alert).
   * 'none' = no useful signal.
   */
  horizon: 'tonight' | 'days-ahead' | 'none';
  /** Overall confidence in the aurora prediction. */
  confidence: 'high' | 'medium' | 'low';
  /** Number of Earth-directed CMEs arriving within the next 96 hours. */
  upcomingCmeCount: number;
  /** Nearest estimated CME arrival time (ISO 8601). Null when none found. */
  nextCmeArrival: string | null;
}

// ---------------------------------------------------------------------------
// Provider interface (for future extensibility)
// ---------------------------------------------------------------------------

export interface SpaceWeatherProvider<TRaw, TSignal> {
  name: string;
  /** Parse raw API response; returns null on failure. */
  parse(raw: TRaw, now?: Date): TSignal | null;
}

// ---------------------------------------------------------------------------
// AuroraWatch UK provider
// ---------------------------------------------------------------------------

/** Maximum age (ms) before an AuroraWatch UK reading is considered stale. */
const AWUK_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Parse the AuroraWatch UK current-status XML.
 * Expected format:
 *   <current_status>
 *     <site_status created="2026-03-17T17:00:00+00:00" color="green" .../>
 *   </current_status>
 *
 * Accepts either raw XML string or an object with a `data` field (n8n text response).
 */
export function parseAuroraWatchUK(
  raw: unknown,
  now: Date = new Date(),
): NearTermAurora | null {
  try {
    const xmlStr = extractText(raw);
    if (!xmlStr) return null;

    const color = extractXmlAttribute(xmlStr, 'color');
    const created = extractXmlAttribute(xmlStr, 'created');

    if (!color) return null;

    const level = normaliseLevel(color);
    if (!level) return null;

    const fetchedAt = created || now.toISOString();
    const fetchedDate = new Date(fetchedAt);
    const age = isNaN(fetchedDate.getTime()) ? Infinity : now.getTime() - fetchedDate.getTime();
    const isStale = age > AWUK_STALE_MS;

    return { level, fetchedAt, isStale };
  } catch {
    return null;
  }
}

export const auroraWatchUKProvider: SpaceWeatherProvider<unknown, NearTermAurora> = {
  name: 'AuroraWatch UK',
  parse: parseAuroraWatchUK,
};

// ---------------------------------------------------------------------------
// NASA DONKI CME provider
// ---------------------------------------------------------------------------

/** Maximum age (ms) before a DONKI response is considered stale. */
const DONKI_STALE_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Lookahead window for CME arrivals to report as "upcoming" (ms). */
const DONKI_LOOKAHEAD_MS = 96 * 60 * 60 * 1000; // 96 hours / 4 days

/**
 * Parse the NASA DONKI CME API response.
 * Filters for Earth-directed events only (isEarthGB === true in analyses or enlilList).
 * Accepts either a JSON array directly or n8n item containing the array.
 */
export function parseNasaDonkiCme(
  raw: unknown,
  now: Date = new Date(),
): LongRangeAurora | null {
  try {
    const events = extractArray(raw);
    if (!events) return null;

    const earthDirectedCmes: CmeEvent[] = [];
    let latestStart = '';

    for (const event of events) {
      if (!isRecord(event)) continue;

      const activityId = String(event['activityID'] ?? event['activityId'] ?? '');
      const startTime = String(event['startTime'] ?? '');
      const note = String(event['note'] ?? '');

      if (startTime > latestStart) latestStart = startTime;

      // Walk analyses to find Earth-directed ones
      const analyses = asArray(event['cmeAnalyses']);
      let isEarthDirected = false;
      let estimatedArrivalTime: string | null = null;
      let estimatedKp: number | null = null;

      for (const analysis of analyses) {
        if (!isRecord(analysis)) continue;

        // Direct Earth-directed flag on the analysis
        if (analysis['isEarthGB'] === true) {
          isEarthDirected = true;
        }

        // Check ENLIL model list for Earth impact
        const enlilList = asArray(analysis['enlilList']);
        for (const enlil of enlilList) {
          if (!isRecord(enlil)) continue;
          if (enlil['isEarthGB'] === true) {
            isEarthDirected = true;
            const arrival = enlil['estimatedShockArrivalTime'];
            if (typeof arrival === 'string' && arrival) {
              if (!estimatedArrivalTime || arrival < estimatedArrivalTime) {
                estimatedArrivalTime = arrival;
              }
            }
            // Pick the highest kp estimate across lead times
            const kpCandidates = ['kp_18', 'kp_90', 'kp_135', 'kp_180'].map(k => {
              const v = enlil[k];
              return typeof v === 'number' ? v : null;
            }).filter((v): v is number => v !== null);
            if (kpCandidates.length > 0) {
              const maxKp = Math.max(...kpCandidates);
              if (estimatedKp === null || maxKp > estimatedKp) estimatedKp = maxKp;
            }
          }
        }
      }

      // Also check note/instruments for "Earth" mention as a fallback (word boundary to avoid false positives)
      if (!isEarthDirected && (/\bearth\b/i.test(note) || /\bhalo\b/i.test(note))) {
        isEarthDirected = true;
      }

      if (isEarthDirected && activityId) {
        earthDirectedCmes.push({ activityId, startTime, estimatedArrivalTime, note, estimatedKp });
      }
    }

    const fetchedAt = latestStart || now.toISOString();
    const fetchedDate = new Date(fetchedAt);
    const age = isNaN(fetchedDate.getTime()) ? Infinity : now.getTime() - fetchedDate.getTime();
    const isStale = age > DONKI_STALE_MS;

    // Sort by arrival time (soonest first), nulls last
    earthDirectedCmes.sort((a, b) => {
      if (!a.estimatedArrivalTime) return 1;
      if (!b.estimatedArrivalTime) return -1;
      return a.estimatedArrivalTime.localeCompare(b.estimatedArrivalTime);
    });

    return { earthDirectedCmes, fetchedAt, isStale };
  } catch {
    return null;
  }
}

export const nasaDonkiCmeProvider: SpaceWeatherProvider<unknown, LongRangeAurora> = {
  name: 'NASA DONKI CME',
  parse: parseNasaDonkiCme,
};

// ---------------------------------------------------------------------------
// Signal fusion
// ---------------------------------------------------------------------------

const LEVEL_RANK: Record<AuroraLevel, number> = {
  green: 0,
  yellow: 1,
  amber: 2,
  red: 3,
};

/**
 * Fuse near-term and long-range signals into a single AuroraSignal.
 * Either or both may be null (graceful degradation).
 */
export function fuseAuroraSignals(
  nearTerm: NearTermAurora | null,
  longRange: LongRangeAurora | null,
  now: Date = new Date(),
): AuroraSignal {
  // Count upcoming Earth-directed CMEs (arriving within lookahead window).
  // Stale long-range data is not surfaced — we can't trust arrival windows.
  const freshLongRange = longRange && !longRange.isStale ? longRange : null;
  const upcomingCmes = (freshLongRange?.earthDirectedCmes ?? []).filter(cme => {
    if (!cme.estimatedArrivalTime) return false;
    const arrival = new Date(cme.estimatedArrivalTime).getTime();
    const diff = arrival - now.getTime();
    return diff >= 0 && diff <= DONKI_LOOKAHEAD_MS;
  });

  const nextCmeArrival = upcomingCmes[0]?.estimatedArrivalTime ?? null;
  const upcomingCmeCount = upcomingCmes.length;

  // Determine dominant level
  let dominantLevel: AuroraLevel | 'none' = 'none';
  let horizon: AuroraSignal['horizon'] = 'none';

  const nearTermLevel = nearTerm && !nearTerm.isStale ? nearTerm.level : null;
  const hasUpcomingCme = upcomingCmeCount > 0 && !(longRange?.isStale ?? true);

  if (nearTermLevel && nearTermLevel !== 'green') {
    // Active alert (yellow/amber/red) — near-term drives
    dominantLevel = nearTermLevel;
    horizon = 'tonight';
  } else if (nearTermLevel === 'green') {
    // Tonight is quiet — near-term green drives dominant level; CME shown via count
    dominantLevel = 'green';
    horizon = 'tonight';
  } else if (hasUpcomingCme) {
    // No near-term data at all but CME incoming — predictive signal
    dominantLevel = 'yellow'; // conservative: actual storm level uncertain
    horizon = 'days-ahead';
  }

  // Confidence
  const nearTermOk = nearTerm !== null && !nearTerm.isStale;
  const longRangeOk = longRange !== null && !longRange.isStale;
  let confidence: AuroraSignal['confidence'] = 'low';
  if (nearTermOk && longRangeOk) confidence = 'high';
  else if (nearTermOk || longRangeOk) confidence = 'medium';

  return {
    nearTerm: nearTerm,
    longRange: longRange,
    dominantLevel,
    horizon,
    confidence,
    upcomingCmeCount,
    nextCmeArrival,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractText(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  if (isRecord(raw)) {
    if (typeof raw['data'] === 'string') return raw['data'];
    if (typeof raw['body'] === 'string') return raw['body'];
    if (typeof raw['text'] === 'string') return raw['text'];
  }
  return null;
}

function extractXmlAttribute(xml: string, attr: string): string | null {
  // Match attr="value" or attr='value'
  const re = new RegExp(`${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`${attr}='([^']*)'`, 'i');
  const m2 = xml.match(re2);
  return m2 ? m2[1] : null;
}

function normaliseLevel(color: string): AuroraLevel | null {
  const c = color.toLowerCase().trim();
  if (c === 'green') return 'green';
  if (c === 'yellow') return 'yellow';
  if (c === 'amber') return 'amber';
  if (c === 'red') return 'red';
  return null;
}

function extractArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  // n8n wraps responses in json field sometimes
  if (isRecord(raw) && Array.isArray(raw['data'])) return raw['data'] as unknown[];
  if (isRecord(raw) && Array.isArray(raw['json'])) return raw['json'] as unknown[];
  return null;
}

function asArray(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [];
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}
