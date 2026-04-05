import { describe, expect, it } from 'vitest';
import { parseMetarRaw } from './parse-metar.js';

describe('parseMetarRaw', () => {
  // ── Wx type classification ────────────────────────────────────────────────

  it('extracts fog (FG) with low visibility', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25005KT 0800 FG OVC002 02/02 Q1023' }]);
    expect(result.wxType).toBe('fog');
    expect(result.visibilityM).toBe(800);
    expect(result.cloudBaseM).toBe(61); // 200ft → ~61m
    expect(result.tempC).toBe(2);
    expect(result.dewPointC).toBe(2);
    expect(result.dewPointSpreadC).toBe(0);
  });

  it('extracts mist (BR)', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25005KT 3000 BR SCT010 08/06 Q1020' }]);
    expect(result.wxType).toBe('mist');
    expect(result.visibilityM).toBe(3000);
  });

  it('extracts haze (HZ)', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z VRB02KT 6000 HZ SCT030 15/08 Q1018' }]);
    expect(result.wxType).toBe('haze');
    expect(result.visibilityM).toBe(6000);
  });

  it('extracts smoke (FU)', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 18008KT 4000 FU SCT020 12/06 Q1015' }]);
    expect(result.wxType).toBe('smoke');
  });

  it('extracts rain (RA)', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 27015KT 5000 RA BKN015 07/05 Q1008' }]);
    expect(result.wxType).toBe('rain');
  });

  it('extracts snow (SN)', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 06010KT 1200 SN OVC005 M01/M02 Q1025' }]);
    expect(result.wxType).toBe('snow');
  });

  it('extracts thunderstorm (TS) — highest priority', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25020G35KT 2000 TSRA BKN020CB 14/12 Q1005' }]);
    expect(result.wxType).toBe('thunderstorm');
  });

  it('thunderstorm wins when multiple wx codes present', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25020G35KT 2000 TSRA FG BKN020CB 10/10 Q1005' }]);
    expect(result.wxType).toBe('thunderstorm');
  });

  // ── Clear conditions ──────────────────────────────────────────────────────

  it('returns null wxType for CAVOK (clear skies)', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25012KT CAVOK 09/02 Q1023' }]);
    expect(result.wxType).toBeNull();
    expect(result.tempC).toBe(9);
    expect(result.dewPointC).toBe(2);
    expect(result.dewPointSpreadC).toBe(7);
  });

  // ── Cloud base extraction ─────────────────────────────────────────────────

  it('extracts lowest cloud base from multiple layers', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25012KT 9999 FEW040 BKN100 09/02 Q1023' }]);
    expect(result.cloudBaseM).toBe(1219); // 4000ft → 1219m
    expect(result.wxType).toBeNull();
  });

  it('returns null cloud base when no layers reported', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25012KT CAVOK 09/02 Q1023' }]);
    expect(result.cloudBaseM).toBeNull();
  });

  // ── Dew point spread ──────────────────────────────────────────────────────

  it('computes dew point spread correctly', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25012KT 9999 FEW040 12/05 Q1023' }]);
    expect(result.dewPointSpreadC).toBe(7);
  });

  it('clamps dew point spread to 0 minimum', () => {
    // M01/00 → temp -1, dewpoint 0 → dewPointSpread would be -1, clamped to 0
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25005KT 0800 FG OVC002 M01/00 Q1023' }]);
    expect(result.dewPointSpreadC).toBe(0);
  });

  // ── Input shape flexibility ───────────────────────────────────────────────

  it('accepts bare string input', () => {
    const result = parseMetarRaw('METAR EGNM 051550Z 25012KT 9999 FEW040 09/02 Q1023');
    expect(result.tempC).toBe(9);
    expect(result.visibilityM).toBe(9999);
  });

  it('accepts single object input', () => {
    const result = parseMetarRaw({ rawOb: 'METAR EGNM 051550Z 25012KT 9999 FEW040 09/02 Q1023' });
    expect(result.tempC).toBe(9);
  });

  it('uses first element when given array', () => {
    const result = parseMetarRaw([
      { rawOb: 'METAR EGNM 051550Z 25012KT 9999 FEW040 09/02 Q1023' },
      { rawOb: 'METAR EGNM 051650Z 26010KT 8000 BKN030 10/03 Q1022' },
    ]);
    expect(result.tempC).toBe(9);
  });

  // ── Graceful degradation ──────────────────────────────────────────────────

  it('returns all-nulls for empty array', () => {
    const result = parseMetarRaw([]);
    expect(result).toEqual({
      wxType: null, visibilityM: null, cloudBaseM: null,
      tempC: null, dewPointC: null, dewPointSpreadC: null,
    });
  });

  it('returns all-nulls for empty string', () => {
    const result = parseMetarRaw('');
    expect(result).toEqual({
      wxType: null, visibilityM: null, cloudBaseM: null,
      tempC: null, dewPointC: null, dewPointSpreadC: null,
    });
  });

  it('returns all-nulls for missing rawOb', () => {
    const result = parseMetarRaw([{}]);
    expect(result).toEqual({
      wxType: null, visibilityM: null, cloudBaseM: null,
      tempC: null, dewPointC: null, dewPointSpreadC: null,
    });
  });

  it('returns all-nulls for malformed METAR', () => {
    const result = parseMetarRaw([{ rawOb: 'NOT A VALID METAR STRING AT ALL' }]);
    expect(result).toEqual({
      wxType: null, visibilityM: null, cloudBaseM: null,
      tempC: null, dewPointC: null, dewPointSpreadC: null,
    });
  });

  // ── Visibility ────────────────────────────────────────────────────────────

  it('extracts visibility in metres for UK-format METAR', () => {
    const result = parseMetarRaw([{ rawOb: 'METAR EGNM 051550Z 25012KT 7000 SCT030 BKN080 11/04 Q1020' }]);
    expect(result.visibilityM).toBe(7000);
  });
});
