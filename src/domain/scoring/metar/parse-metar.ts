import { parseMetar } from 'metar-taf-parser';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MetarWxType =
  | 'fog'
  | 'mist'
  | 'haze'
  | 'smoke'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | null;

export interface ParsedMetar {
  wxType: MetarWxType;
  visibilityM: number | null;
  cloudBaseM: number | null;
  tempC: number | null;
  dewPointC: number | null;
  dewPointSpreadC: number | null;
}

const EMPTY: ParsedMetar = {
  wxType: null,
  visibilityM: null,
  cloudBaseM: null,
  tempC: null,
  dewPointC: null,
  dewPointSpreadC: null,
};

// ── Wx-code → photographically meaningful type mapping ────────────────────────

const WX_MAP: Record<string, MetarWxType> = {
  TS: 'thunderstorm',
  FG: 'fog',
  BR: 'mist',
  HZ: 'haze',
  FU: 'smoke',
  RA: 'rain',
  DZ: 'rain',
  SN: 'snow',
  SG: 'snow',
  GR: 'snow',
  GS: 'snow',
};

/** Priority order — earlier entries win when multiple wx codes are present. */
const WX_PRIORITY: MetarWxType[] = [
  'thunderstorm',
  'fog',
  'snow',
  'rain',
  'smoke',
  'haze',
  'mist',
];

function classifyWx(conditions: Array<{ descriptive?: string; phenomenons?: string[] }>): MetarWxType {
  const types = new Set<MetarWxType>();
  for (const cond of conditions) {
    // TS appears as a descriptive qualifier, not a phenomenon
    if (cond.descriptive === 'TS') types.add('thunderstorm');
    for (const code of cond.phenomenons ?? []) {
      const mapped = WX_MAP[code];
      if (mapped) types.add(mapped);
    }
  }
  if (types.size === 0) return null;
  return WX_PRIORITY.find(t => types.has(t)) ?? null;
}

/** Convert feet AGL → metres. */
const ftToM = (ft: number) => Math.round(ft * 0.3048);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse raw METAR observation(s) into structured, photographically useful fields.
 *
 * Accepts the same flexible input shape that the existing adapter produces:
 * - `Array<{ rawOb?: string }>`
 * - `{ rawOb?: string }`
 * - bare string
 *
 * Returns all-nulls when METAR is unavailable or unparseable.
 */
export function parseMetarRaw(
  metarRaw: Array<{ rawOb?: string }> | { rawOb?: string } | string,
): ParsedMetar {
  try {
    const raw = extractRawString(metarRaw);
    if (!raw) return EMPTY;

    const parsed = parseMetar(raw);

    const wxType = classifyWx(parsed.weatherConditions ?? []);

    const visibilityM = parsed.visibility?.value != null
      ? parsed.visibility.value
      : null;

    // Cloud base: take lowest reported layer height (feet → metres)
    const layers = (parsed.clouds ?? [])
      .filter(c => c.height != null)
      .sort((a, b) => a.height! - b.height!);
    const cloudBaseM = layers.length > 0 ? ftToM(layers[0]!.height!) : null;

    const tempC = parsed.temperature ?? null;
    const dewPointC = parsed.dewPoint ?? null;
    const dewPointSpreadC = tempC != null && dewPointC != null
      ? Math.max(0, tempC - dewPointC)
      : null;

    return { wxType, visibilityM, cloudBaseM, tempC, dewPointC, dewPointSpreadC };
  } catch {
    return EMPTY;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractRawString(
  metarRaw: Array<{ rawOb?: string }> | { rawOb?: string } | string,
): string {
  if (typeof metarRaw === 'string') return metarRaw.trim();
  if (Array.isArray(metarRaw)) return (metarRaw[0]?.rawOb ?? '').trim();
  return (metarRaw?.rawOb ?? '').trim();
}
