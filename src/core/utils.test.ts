import { describe, expect, it } from 'vitest';
import { isMoonUpAt, moonAltitude } from './utils.js';

describe('local moon timeline helpers', () => {
  it('derives moon-up state from local altitude without forecast moonrise/moonset data', () => {
    expect(isMoonUpAt(Date.parse('2026-03-21T21:00:00Z'), 53.8, -1.57)).toBe(true);
    expect(isMoonUpAt(Date.parse('2026-03-21T23:00:00Z'), 53.8, -1.57)).toBe(false);
  });

  it('handles moonset after midnight across the civil-day boundary', () => {
    expect(isMoonUpAt(Date.parse('2026-03-22T23:00:00Z'), 53.8, -1.57)).toBe(true);
    expect(isMoonUpAt(Date.parse('2026-03-23T01:00:00Z'), 53.8, -1.57)).toBe(false);
  });

  it('returns signed moon altitude for later scoring use', () => {
    expect(moonAltitude(Date.parse('2026-03-21T21:00:00Z'), 53.8, -1.57)).toBeGreaterThan(0);
    expect(moonAltitude(Date.parse('2026-03-21T23:00:00Z'), 53.8, -1.57)).toBeLessThan(0);
  });
});
