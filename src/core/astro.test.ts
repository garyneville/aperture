import { describe, expect, it } from 'vitest';
import { findDarkSkyStart, getMoonMetrics } from './astro.js';

describe('shared astro metrics helper', () => {
  it('derives moon-up state, altitude, azimuth, and illumination together', () => {
    const moonUp = getMoonMetrics(Date.parse('2026-03-21T21:00:00Z'), 53.8, -1.57);
    const moonDown = getMoonMetrics(Date.parse('2026-03-21T23:00:00Z'), 53.8, -1.57);

    expect(moonUp.isUp).toBe(true);
    expect(moonUp.altitudeDeg).toBeGreaterThan(0);
    expect(moonUp.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(moonUp.azimuthDeg).toBeLessThanOrEqual(360);
    expect(moonUp.illumination).toBeGreaterThanOrEqual(0);
    expect(moonUp.illumination).toBeLessThanOrEqual(1);

    expect(moonDown.isUp).toBe(false);
    expect(moonDown.altitudeDeg).toBeLessThan(0);
  });

  it('finds the first dark-sky timestamp after moonset across midnight', () => {
    const start = findDarkSkyStart(
      ['2026-03-22T23:00:00Z', '2026-03-23T01:00:00Z', '2026-03-23T03:00:00Z'],
      53.8,
      -1.57,
    );

    expect(start).toBe('2026-03-23T01:00:00Z');
  });
});
