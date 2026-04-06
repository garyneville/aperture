import { describe, expect, it } from 'vitest';
import {
  fuseAuroraSignals,
  parseAuroraWatchUK,
  parseNasaDonkiCme,
  type AuroraSignal,
  type CmeEvent,
  type LongRangeAurora,
  type NearTermAurora,
} from './aurora-providers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AWUK_GREEN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<current_status>
  <site_status created="2026-03-17T16:00:00+00:00" color="green" description="No significant activity" url="http://aurorawatch.lancs.ac.uk/"/>
</current_status>`;

const AWUK_AMBER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<current_status>
  <site_status created="2026-03-17T21:00:00+00:00" color="amber" description="Moderate geomagnetic activity" url="http://aurorawatch.lancs.ac.uk/"/>
</current_status>`;

const AWUK_RED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<current_status>
  <site_status created="2026-03-17T22:00:00+00:00" color="red" description="Storm conditions" url="http://aurorawatch.lancs.ac.uk/"/>
</current_status>`;

const NOW = new Date('2026-03-17T17:30:00Z');

// A fresh DONKI response with one Earth-directed CME arriving in ~36 hours
function makeDonkiResponse(overrides: Partial<{
  isEarthGB: boolean;
  arrivalTime: string;
  kp_90: number | null;
  note: string;
}> = {}): unknown[] {
  const {
    isEarthGB = true,
    arrivalTime = '2026-03-19T03:00Z',
    kp_90 = 6,
    note = 'Earth directed CME.',
  } = overrides;

  return [{
    activityID: '2026-03-17T12:00:00-CME-001',
    startTime: '2026-03-17T12:00Z',
    note,
    instruments: [],
    cmeAnalyses: [{
      isMostAccurate: true,
      isEarthGB,
      enlilList: [{
        isEarthGB,
        estimatedShockArrivalTime: arrivalTime,
        kp_18: null,
        kp_90,
        kp_135: null,
        kp_180: null,
      }],
    }],
  }];
}

// ---------------------------------------------------------------------------
// parseAuroraWatchUK
// ---------------------------------------------------------------------------

describe('parseAuroraWatchUK', () => {
  it('parses green status', () => {
    const result = parseAuroraWatchUK(AWUK_GREEN_XML, NOW);
    expect(result).not.toBeNull();
    expect(result!.level).toBe('green');
    expect(result!.isStale).toBe(false);
    expect(result!.fetchedAt).toBe('2026-03-17T16:00:00+00:00');
  });

  it('parses amber status', () => {
    const result = parseAuroraWatchUK(AWUK_AMBER_XML, NOW);
    expect(result!.level).toBe('amber');
    expect(result!.isStale).toBe(false);
  });

  it('parses red status', () => {
    const result = parseAuroraWatchUK(AWUK_RED_XML, NOW);
    expect(result!.level).toBe('red');
    expect(result!.isStale).toBe(false);
  });

  it('marks reading as stale when older than 2 hours', () => {
    const staleXml = `<current_status>
      <site_status created="2026-03-17T14:00:00+00:00" color="amber"/>
    </current_status>`;
    // NOW is 17:30, created at 14:00 = 3.5 h ago → stale
    const result = parseAuroraWatchUK(staleXml, NOW);
    expect(result!.isStale).toBe(true);
  });

  it('accepts n8n text-response object with data field', () => {
    const nativeN8n = { data: AWUK_GREEN_XML };
    const result = parseAuroraWatchUK(nativeN8n, NOW);
    expect(result!.level).toBe('green');
  });

  it('returns null for empty/missing XML', () => {
    expect(parseAuroraWatchUK(null, NOW)).toBeNull();
    expect(parseAuroraWatchUK('', NOW)).toBeNull();
    expect(parseAuroraWatchUK('<empty/>', NOW)).toBeNull();
  });

  it('returns null for unknown color value', () => {
    const xml = `<current_status><site_status color="purple" created="2026-03-17T17:00:00Z"/></current_status>`;
    expect(parseAuroraWatchUK(xml, NOW)).toBeNull();
  });

  it('handles colour attribute with single quotes', () => {
    const xml = `<current_status><site_status created='2026-03-17T17:00:00Z' color='yellow'/></current_status>`;
    const result = parseAuroraWatchUK(xml, NOW);
    expect(result!.level).toBe('yellow');
  });

  it('uses now as fetchedAt when created attribute is missing', () => {
    const xml = `<current_status><site_status color="green"/></current_status>`;
    const result = parseAuroraWatchUK(xml, NOW);
    expect(result!.fetchedAt).toBe(NOW.toISOString());
  });

  // ---- New status.xml format ----

  it('parses new status.xml format with <state name="green">', () => {
    const xml = `<aurorawatch>
      <current><state name="green" value="0" color="#33ff33">No significant activity</state></current>
      <previous><state name="yellow" value="50" color="#ffff00">Minor geomagnetic activity</state></previous>
      <station>SAMNET/CRK2</station>
      <updated>2026-03-17 17:00:00</updated>
    </aurorawatch>`;
    const result = parseAuroraWatchUK(xml, NOW);
    expect(result).not.toBeNull();
    expect(result!.level).toBe('green');
    expect(result!.fetchedAt).toBe('2026-03-17 17:00:00');
    expect(result!.isStale).toBe(false);
  });

  it('parses new status.xml format with amber state', () => {
    const xml = `<aurorawatch>
      <current><state name="amber" value="100" color="#ff9900">Amber alert: possible aurora</state></current>
      <updated>2026-03-17 16:30:00</updated>
    </aurorawatch>`;
    const result = parseAuroraWatchUK(xml, NOW);
    expect(result!.level).toBe('amber');
    expect(result!.isStale).toBe(false);
  });

  it('marks new format as stale when updated timestamp is old', () => {
    const xml = `<aurorawatch>
      <current><state name="yellow" value="50" color="#ffff00">Minor activity</state></current>
      <updated>2026-03-17 14:00:00</updated>
    </aurorawatch>`;
    // NOW is 17:30, updated at 14:00 = 3.5 h ago → stale
    const result = parseAuroraWatchUK(xml, NOW);
    expect(result!.isStale).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseNasaDonkiCme
// ---------------------------------------------------------------------------

describe('parseNasaDonkiCme', () => {
  it('extracts Earth-directed CMEs via isEarthGB on enlilList', () => {
    const result = parseNasaDonkiCme(makeDonkiResponse(), NOW);
    expect(result).not.toBeNull();
    expect(result!.earthDirectedCmes).toHaveLength(1);
    expect(result!.earthDirectedCmes[0].activityId).toBe('2026-03-17T12:00:00-CME-001');
    expect(result!.earthDirectedCmes[0].estimatedArrivalTime).toBe('2026-03-19T03:00Z');
    expect(result!.earthDirectedCmes[0].estimatedKp).toBe(6);
  });

  it('excludes non-Earth-directed CMEs', () => {
    const result = parseNasaDonkiCme(makeDonkiResponse({ isEarthGB: false, note: '' }), NOW);
    expect(result!.earthDirectedCmes).toHaveLength(0);
  });

  it('includes CME when note mentions "Earth" as fallback', () => {
    const raw = makeDonkiResponse({ isEarthGB: false, note: 'Halo CME, Earth impact likely.' });
    const result = parseNasaDonkiCme(raw, NOW);
    expect(result!.earthDirectedCmes).toHaveLength(1);
  });

  it('sorts CMEs by arrival time soonest-first', () => {
    const raw: unknown[] = [
      {
        activityID: 'CME-002', startTime: '2026-03-18T00:00Z', note: '', instruments: [],
        cmeAnalyses: [{ isEarthGB: true, enlilList: [{ isEarthGB: true, estimatedShockArrivalTime: '2026-03-20T00:00Z', kp_90: null }] }],
      },
      {
        activityID: 'CME-001', startTime: '2026-03-17T12:00Z', note: '', instruments: [],
        cmeAnalyses: [{ isEarthGB: true, enlilList: [{ isEarthGB: true, estimatedShockArrivalTime: '2026-03-19T00:00Z', kp_90: null }] }],
      },
    ];
    const result = parseNasaDonkiCme(raw, NOW);
    expect(result!.earthDirectedCmes[0].activityId).toBe('CME-001');
    expect(result!.earthDirectedCmes[1].activityId).toBe('CME-002');
  });

  it('handles empty array gracefully', () => {
    const result = parseNasaDonkiCme([], NOW);
    expect(result!.earthDirectedCmes).toHaveLength(0);
  });

  it('returns null for completely invalid input', () => {
    expect(parseNasaDonkiCme(null, NOW)).toBeNull();
    expect(parseNasaDonkiCme('not json', NOW)).toBeNull();
    expect(parseNasaDonkiCme({ data: 'bad' }, NOW)).toBeNull();
  });

  it('marks data as stale when latest CME start is older than 12 hours', () => {
    // CME started 24 hours ago → stale
    const raw = makeDonkiResponse({ arrivalTime: '2026-03-18T12:00Z' });
    (raw[0] as Record<string, unknown>)['startTime'] = '2026-03-16T17:00Z';
    const result = parseNasaDonkiCme(raw, NOW);
    expect(result!.isStale).toBe(true);
  });

  it('accepts n8n-wrapped array in data field', () => {
    const wrapped = { data: makeDonkiResponse() };
    const result = parseNasaDonkiCme(wrapped, NOW);
    expect(result!.earthDirectedCmes).toHaveLength(1);
  });

  it('picks the highest kp across enlilList entries', () => {
    const raw: unknown[] = [{
      activityID: 'CME-001', startTime: '2026-03-17T12:00Z', note: '', instruments: [],
      cmeAnalyses: [{
        isEarthGB: true,
        enlilList: [
          { isEarthGB: true, estimatedShockArrivalTime: '2026-03-19T00:00Z', kp_90: 4 },
          { isEarthGB: true, estimatedShockArrivalTime: '2026-03-19T06:00Z', kp_90: 7 },
        ],
      }],
    }];
    const result = parseNasaDonkiCme(raw, NOW);
    expect(result!.earthDirectedCmes[0].estimatedKp).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// fuseAuroraSignals
// ---------------------------------------------------------------------------

function makeNearTerm(level: NearTermAurora['level'], ageHours = 0): NearTermAurora {
  const fetchedAt = new Date(NOW.getTime() - ageHours * 3600_000).toISOString();
  return { level, fetchedAt, isStale: ageHours > 2 };
}

function makeLongRange(cmes: CmeEvent[], ageHours = 0): LongRangeAurora {
  const fetchedAt = new Date(NOW.getTime() - ageHours * 3600_000).toISOString();
  return { earthDirectedCmes: cmes, fetchedAt, isStale: ageHours > 12 };
}

function makeCme(arrivalOffsetHours: number): CmeEvent {
  const arrival = new Date(NOW.getTime() + arrivalOffsetHours * 3600_000).toISOString();
  return {
    activityId: `CME-${arrivalOffsetHours}h`,
    startTime: NOW.toISOString(),
    estimatedArrivalTime: arrival,
    note: 'Earth directed.',
    estimatedKp: 6,
  };
}

describe('fuseAuroraSignals', () => {
  it('returns "none" dominant level when both providers unavailable', () => {
    const signal = fuseAuroraSignals(null, null, NOW);
    expect(signal.dominantLevel).toBe('none');
    expect(signal.horizon).toBe('none');
    expect(signal.confidence).toBe('low');
  });

  it('uses near-term amber level when AWUK shows amber', () => {
    const signal = fuseAuroraSignals(makeNearTerm('amber'), null, NOW);
    expect(signal.dominantLevel).toBe('amber');
    expect(signal.horizon).toBe('tonight');
  });

  it('uses green near-term level with confidence=medium when only AWUK available', () => {
    const signal = fuseAuroraSignals(makeNearTerm('green'), null, NOW);
    expect(signal.dominantLevel).toBe('green');
    expect(signal.confidence).toBe('medium');
  });

  it('shows days-ahead when no near-term alert but CME incoming', () => {
    const longRange = makeLongRange([makeCme(36)]);
    const signal = fuseAuroraSignals(makeNearTerm('green'), longRange, NOW);
    expect(signal.dominantLevel).toBe('green');
    expect(signal.horizon).toBe('tonight');
    expect(signal.upcomingCmeCount).toBe(1);
    expect(signal.nextCmeArrival).toBeTruthy();
  });

  it('shows days-ahead horizon when near-term is null but CME incoming', () => {
    const longRange = makeLongRange([makeCme(36)]);
    const signal = fuseAuroraSignals(null, longRange, NOW);
    expect(signal.horizon).toBe('days-ahead');
    expect(signal.dominantLevel).toBe('yellow');
    expect(signal.upcomingCmeCount).toBe(1);
  });

  it('does not count past CMEs as upcoming', () => {
    const pastCme = makeCme(-10); // arrived 10 hours ago
    const longRange = makeLongRange([pastCme]);
    const signal = fuseAuroraSignals(null, longRange, NOW);
    expect(signal.upcomingCmeCount).toBe(0);
    expect(signal.nextCmeArrival).toBeNull();
    expect(signal.horizon).toBe('none');
  });

  it('does not count CMEs beyond 96-hour lookahead', () => {
    const farFutureCme = makeCme(100); // 100 hours from now
    const longRange = makeLongRange([farFutureCme]);
    const signal = fuseAuroraSignals(null, longRange, NOW);
    expect(signal.upcomingCmeCount).toBe(0);
  });

  it('confidence is high when both providers have fresh data', () => {
    const longRange = makeLongRange([makeCme(36)]);
    const signal = fuseAuroraSignals(makeNearTerm('yellow'), longRange, NOW);
    expect(signal.confidence).toBe('high');
  });

  it('confidence is medium with only one fresh provider', () => {
    const staleNearTerm = makeNearTerm('amber', 3); // 3 h old → stale
    const signal = fuseAuroraSignals(staleNearTerm, makeLongRange([makeCme(36)]), NOW);
    expect(signal.confidence).toBe('medium');
  });

  it('ignores stale near-term data for dominant level', () => {
    const staleAmber = makeNearTerm('amber', 3); // 3 h old → stale
    const signal = fuseAuroraSignals(staleAmber, null, NOW);
    // stale near-term should not drive the dominant level
    expect(signal.dominantLevel).toBe('none');
  });

  it('ignores stale long-range data for dominant level', () => {
    const staleLongRange = makeLongRange([makeCme(36)], 13); // 13 h old → stale
    const signal = fuseAuroraSignals(null, staleLongRange, NOW);
    expect(signal.dominantLevel).toBe('none');
    expect(signal.upcomingCmeCount).toBe(0);
  });

  it('counts imminent CME from stale data when arrival is within 24h', () => {
    const now = new Date('2026-04-05T14:00Z');
    const signal = fuseAuroraSignals(null, {
      isStale: true,
      fetchedAt: '2026-04-05T01:48Z',
      earthDirectedCmes: [{
        activityId: 'test-cme',
        startTime: '2026-04-02T20:46Z',
        estimatedArrivalTime: '2026-04-05T20:00Z', // 6h away
        estimatedKp: 4,
        note: 'Earth directed.',
      }],
    }, now);
    expect(signal.upcomingCmeCount).toBe(1);
    expect(signal.nextCmeArrival).toBe('2026-04-05T20:00Z');
    expect(signal.dominantLevel).toBe('yellow');
    expect(signal.confidence).toBe('low');
  });

  it('does NOT count stale CME when arrival is >24h away', () => {
    const now = new Date('2026-04-05T14:00Z');
    const signal = fuseAuroraSignals(null, {
      isStale: true,
      fetchedAt: '2026-04-04T01:00Z',
      earthDirectedCmes: [{
        activityId: 'test-cme',
        startTime: '2026-04-02T20:46Z',
        estimatedArrivalTime: '2026-04-07T20:00Z', // 2 days away
        estimatedKp: 4,
        note: 'Earth directed.',
      }],
    }, now);
    expect(signal.upcomingCmeCount).toBe(0);
  });

  it('surfaces both near-term and long-range data on the signal object', () => {
    const nearTerm = makeNearTerm('red');
    const longRange = makeLongRange([makeCme(48)]);
    const signal: AuroraSignal = fuseAuroraSignals(nearTerm, longRange, NOW);
    expect(signal.nearTerm).toBe(nearTerm);
    expect(signal.longRange).toBe(longRange);
  });

  // ---- Diagnostic warnings ----

  it('warns when AuroraWatch near-term signal is missing', () => {
    const signal = fuseAuroraSignals(null, makeLongRange([makeCme(36)]), NOW);
    expect(signal.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('AuroraWatch UK near-term signal missing')]),
    );
  });

  it('warns when AuroraWatch near-term signal is stale', () => {
    const stale = makeNearTerm('amber', 3);
    const signal = fuseAuroraSignals(stale, makeLongRange([makeCme(36)]), NOW);
    expect(signal.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('stale')]),
    );
  });

  it('warns when DONKI long-range signal is missing', () => {
    const signal = fuseAuroraSignals(makeNearTerm('green'), null, NOW);
    expect(signal.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('NASA DONKI long-range signal missing')]),
    );
  });

  it('DONKI 503 scenario: near-term still works, confidence degrades, CME data absent', () => {
    // Simulates DONKI returning HTTP 503 — longRange is null
    const signal = fuseAuroraSignals(makeNearTerm('yellow'), null, NOW);
    expect(signal.dominantLevel).toBe('yellow');
    expect(signal.horizon).toBe('tonight');
    expect(signal.confidence).toBe('medium'); // degraded from 'high'
    expect(signal.upcomingCmeCount).toBe(0);
    expect(signal.nextCmeArrival).toBeNull();
    expect(signal.longRange).toBeNull();
    expect(signal.nearTerm).not.toBeNull();
    expect(signal.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/NASA DONKI.*confidence degraded/)]),
    );
  });

  it('has no warnings when both providers have fresh data', () => {
    const signal = fuseAuroraSignals(makeNearTerm('green'), makeLongRange([makeCme(36)]), NOW);
    expect(signal.warnings).toEqual([]);
  });
});
