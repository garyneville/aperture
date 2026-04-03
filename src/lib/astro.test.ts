import { describe, expect, it } from 'vitest';
import { findDarkSkyStart, getMoonMetrics, moonScoreAdjustment, moonState } from './astro.js';

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

  it('penalises a bright moon much more when it is high than when it is low', () => {
    const lowMoon = moonScoreAdjustment({
      illumination: 0.7,
      altitudeDeg: 10,
      azimuthDeg: 180,
      isUp: true,
    });
    const highMoon = moonScoreAdjustment({
      illumination: 0.7,
      altitudeDeg: 60,
      azimuthDeg: 180,
      isUp: true,
    });

    expect(lowMoon).toBeGreaterThan(highMoon);
    expect(lowMoon).toBe(-1);
    expect(highMoon).toBe(-5);
  });

  it('gives a graduated dark-sky bonus based on how far below the horizon the moon is', () => {
    const justSet = moonScoreAdjustment({
      illumination: 0.9,
      altitudeDeg: -1,
      azimuthDeg: 180,
      isUp: false,
    });
    const halfwayDown = moonScoreAdjustment({
      illumination: 0.9,
      altitudeDeg: -15,
      azimuthDeg: 180,
      isUp: false,
    });
    const firmlySet = moonScoreAdjustment({
      illumination: 0.9,
      altitudeDeg: -45,
      azimuthDeg: 180,
      isUp: false,
    });

    expect(justSet).toBeLessThan(firmlySet);
    expect(halfwayDown).toBeLessThan(firmlySet);
    expect(justSet).toBe(11);   // 10 + (1/30)*20 ≈ 10.67 → 11
    expect(halfwayDown).toBe(20); // 10 + (15/30)*20 = 20
    expect(firmlySet).toBe(30);   // capped at 30
  });

  it('gives full +30 bonus for a thin crescent moon that is up', () => {
    expect(moonScoreAdjustment({
      illumination: 0.1,
      altitudeDeg: 40,
      azimuthDeg: 180,
      isUp: true,
    })).toBe(30);
  });

  describe('moonState', () => {
    it('returns "Down" when moon is below horizon', () => {
      expect(moonState({ illumination: 0.9, altitudeDeg: -20, azimuthDeg: 180, isUp: false })).toBe('Down');
    });

    it('returns "Thin crescent" when illumination < 20% and moon is up', () => {
      expect(moonState({ illumination: 0.1, altitudeDeg: 20, azimuthDeg: 180, isUp: true })).toBe('Thin crescent');
    });

    it('returns "Faint" when illumination is 20–50% and moon is up', () => {
      expect(moonState({ illumination: 0.35, altitudeDeg: 20, azimuthDeg: 180, isUp: true })).toBe('Faint');
    });

    it('returns "Bright & low" when illumination ≥ 50% and altitude ≤ 30°', () => {
      expect(moonState({ illumination: 0.7, altitudeDeg: 15, azimuthDeg: 180, isUp: true })).toBe('Bright & low');
    });

    it('returns "Bright & high" when illumination ≥ 50% and altitude > 30°', () => {
      expect(moonState({ illumination: 0.7, altitudeDeg: 60, azimuthDeg: 180, isUp: true })).toBe('Bright & high');
    });
  });
});
