import { describe, expect, it } from 'vitest';
import {
  deriveHourFeatures,
  evaluateBuiltInSessions,
  evaluateSessionHour,
  getBuiltInSessionEvaluators,
} from './session-scoring.js';
import type { ScoredHour } from './best-windows.js';

function makeHour(overrides: Partial<ScoredHour> = {}): ScoredHour {
  return {
    ts: '2026-03-29T19:00:00Z',
    t: '2026-03-29T19:00:00Z',
    hour: '19:00',
    score: 72,
    drama: 78,
    clarity: 68,
    mist: 20,
    astro: 14,
    crepuscular: 61,
    shQ: 0.62,
    cl: 20,
    cm: 30,
    ch: 18,
    ct: 52,
    visK: 24,
    aod: 0.12,
    tpw: 11,
    wind: 11,
    gusts: 18,
    tmp: 9,
    hum: 66,
    dew: 4,
    pp: 8,
    pr: 0,
    vpd: 0.8,
    azimuthRisk: null,
    isGolden: true,
    isGoldAm: false,
    isGoldPm: true,
    isBlue: false,
    isBlueAm: false,
    isBluePm: false,
    isNight: false,
    moon: 12,
    uv: 0,
    tags: ['dramatic sky', 'golden hour'],
    ...overrides,
  };
}

describe('session scoring foundation', () => {
  it('exposes built-in evaluators for the first two session types', () => {
    expect(getBuiltInSessionEvaluators().map(evaluator => evaluator.session)).toEqual(['golden-hour', 'astro', 'mist']);
  });

  it('derives reusable features from the current scored-hour shape', () => {
    const features = deriveHourFeatures(makeHour());

    expect(features.hourLabel).toBe('19:00');
    expect(features.cloudTotalPct).toBe(52);
    expect(features.transparencyScore).toBeGreaterThan(0);
    expect(features.isGolden).toBe(true);
  });

  it('scores a golden-hour session with a hard pass during low-angle light', () => {
    const result = evaluateSessionHour('golden-hour', makeHour());

    expect(result.hardPass).toBe(true);
    expect(result.score).toBeGreaterThan(60);
    expect(result.reasons).toContain('Broken cloud cover can catch low-angle light well.');
    expect(result.requiredCapabilities).toContain('sun-geometry');
  });

  it('fails astro hard gates during daylight hours', () => {
    const result = evaluateSessionHour('astro', makeHour({ isNight: false, astro: 55, ct: 5 }));

    expect(result.hardPass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.warnings).toContain('This hour is not inside a darkness window.');
  });

  it('ranks astro first for a dark, clear hour', () => {
    const sessions = evaluateBuiltInSessions(makeHour({
      isGolden: false,
      isGoldPm: false,
      isNight: true,
      astro: 86,
      ct: 9,
      cl: 4,
      cm: 5,
      ch: 6,
      visK: 30,
      hum: 58,
      aod: 0.06,
      moon: 8,
      tags: ['astrophotography'],
    }));

    expect(sessions[0]?.session).toBe('astro');
    expect(sessions[0]?.hardPass).toBe(true);
    expect(sessions[0]?.confidence).toBe('high');
  });

  it('can surface mist as the best-fit session for a fog-prone hour', () => {
    const sessions = evaluateBuiltInSessions(makeHour({
      score: 48,
      drama: 25,
      clarity: 18,
      mist: 86,
      astro: 0,
      crepuscular: 12,
      ct: 92,
      visK: 4.5,
      aod: 0.08,
      wind: 4,
      gusts: 7,
      tmp: 6,
      hum: 95,
      dew: 5,
      pp: 18,
      isGolden: false,
      isGoldPm: false,
      isBlue: false,
      isNight: false,
      tags: ['mist', 'atmospheric'],
    }));

    expect(sessions[0]?.session).toBe('mist');
    expect(sessions[0]?.hardPass).toBe(true);
    expect(sessions[0]?.reasons).toContain('Visibility is in a useful misty-landscape range.');
  });
});
