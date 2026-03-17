import { describe, it, expect } from 'vitest';
import {
  parseMwisAdvisory,
  buildMwisAdvisoryNote,
  MWIS_UNAVAILABLE,
} from './wrap-mwis.adapter.js';

describe('parseMwisAdvisory', () => {
  it('returns null for empty input (graceful fallback)', () => {
    expect(parseMwisAdvisory('', 'dales_peak')).toBe(MWIS_UNAVAILABLE);
    expect(parseMwisAdvisory('   ', 'dales_peak')).toBe(MWIS_UNAVAILABLE);
  });

  it('detects snow on high ground from MWIS-style text', () => {
    const text = 'Expect snow on the summits above 600m. Snow cover on high ground persisting.';
    const result = parseMwisAdvisory(text, 'dales_peak');
    expect(result).not.toBeNull();
    expect(result!.snowOnHighGround).toBe(true);
    expect(result!.poorVisibilityHighGround).toBe(false);
    expect(result!.severeWindHighGround).toBe(false);
  });

  it('detects lying snow phrase', () => {
    const text = 'Lying snow above 500m. Conditions icy on exposed ridges.';
    const result = parseMwisAdvisory(text, 'dales_peak');
    expect(result!.snowOnHighGround).toBe(true);
  });

  it('detects poor summit visibility from hill fog phrasing', () => {
    const text = 'Hill fog on tops throughout the morning. Low cloud base expected.';
    const result = parseMwisAdvisory(text, 'lakes');
    expect(result!.poorVisibilityHighGround).toBe(true);
    expect(result!.snowOnHighGround).toBe(false);
  });

  it('detects severe winds on high ground', () => {
    const text = 'Very strong winds on the ridge tops, with gale force gusts possible at summits.';
    const result = parseMwisAdvisory(text, 'dales_peak');
    expect(result!.severeWindHighGround).toBe(true);
  });

  it('handles benign conditions with no advisory signals', () => {
    const text = 'Pleasant conditions on high ground. Good visibility. Light winds.';
    const result = parseMwisAdvisory(text, 'snowdonia');
    expect(result).not.toBeNull();
    expect(result!.snowOnHighGround).toBe(false);
    expect(result!.poorVisibilityHighGround).toBe(false);
    expect(result!.severeWindHighGround).toBe(false);
  });

  it('sets area and fetchedAt correctly', () => {
    const result = parseMwisAdvisory('Some forecast text.', 'lakes');
    expect(result!.area).toBe('lakes');
    expect(result!.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('buildMwisAdvisoryNote', () => {
  it('returns empty string for null forecast (MWIS unavailable)', () => {
    expect(buildMwisAdvisoryNote(null)).toBe('');
  });

  it('returns empty string when no advisory signals present', () => {
    const forecast = parseMwisAdvisory('Fine conditions on the high tops.', 'dales_peak')!;
    expect(buildMwisAdvisoryNote(forecast)).toBe('');
  });

  it('returns advisory note when snow is present', () => {
    const forecast = parseMwisAdvisory('Snow cover on summits.', 'dales_peak')!;
    const note = buildMwisAdvisoryNote(forecast);
    expect(note).toContain('snow on high ground');
    expect(note).toMatch(/^Mountain advisory:/);
  });

  it('combines multiple signals in a single note', () => {
    const text = 'Snow cover on tops. Hill fog reducing visibility. Gale force gusts on summits.';
    const forecast = parseMwisAdvisory(text, 'lakes')!;
    const note = buildMwisAdvisoryNote(forecast);
    expect(note).toContain('snow on high ground');
    expect(note).toContain('poor summit visibility');
    expect(note).toContain('severe winds on high ground');
  });
});
