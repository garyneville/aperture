import { describe, expect, it } from 'vitest';
import {
  outdoorComfortScore,
  outdoorComfortLabel,
  outdoorComfortReason,
  outdoorComfortReasonCodes,
  COMFORT_SCORE_CONFIG,
  RUN_FRIENDLY_THRESHOLDS,
  COMFORT_REASON_THRESHOLDS,
  type ComfortReasonCode,
} from './outdoor-comfort.js';
import type { NextDayHour } from '../../contracts/index.js';

describe('outdoorComfortScore', () => {
  it('returns 100 for ideal conditions', () => {
    expect(outdoorComfortScore({ tmp: 15, pp: 0, wind: 5, visK: 25, pr: 0 })).toBe(100);
  });

  it('deducts heavily for heavy rain probability', () => {
    const score = outdoorComfortScore({ tmp: 15, pp: 80, wind: 5, visK: 25, pr: 0 });
    expect(score).toBeLessThanOrEqual(50);
  });

  it('deducts moderately for moderate rain probability', () => {
    const lowRain = outdoorComfortScore({ tmp: 15, pp: 10, wind: 5, visK: 25, pr: 0 });
    const moderateRain = outdoorComfortScore({ tmp: 15, pp: 50, wind: 5, visK: 25, pr: 0 });
    expect(moderateRain).toBeLessThan(lowRain);
  });

  it('deducts for high wind', () => {
    const calm = outdoorComfortScore({ tmp: 15, pp: 0, wind: 5, visK: 25, pr: 0 });
    const windy = outdoorComfortScore({ tmp: 15, pp: 0, wind: 50, visK: 25, pr: 0 });
    expect(windy).toBeLessThan(calm);
  });

  it('deducts more for extreme wind', () => {
    const strong = outdoorComfortScore({ tmp: 15, pp: 0, wind: 35, visK: 25, pr: 0 });
    const extreme = outdoorComfortScore({ tmp: 15, pp: 0, wind: 50, visK: 25, pr: 0 });
    expect(extreme).toBeLessThan(strong);
  });

  it('deducts for freezing temperature', () => {
    const mild = outdoorComfortScore({ tmp: 15, pp: 0, wind: 5, visK: 25, pr: 0 });
    const freezing = outdoorComfortScore({ tmp: -3, pp: 0, wind: 5, visK: 25, pr: 0 });
    expect(freezing).toBeLessThan(mild);
  });

  it('deducts for very hot temperature', () => {
    const comfortable = outdoorComfortScore({ tmp: 20, pp: 0, wind: 5, visK: 25, pr: 0 });
    const hot = outdoorComfortScore({ tmp: 35, pp: 0, wind: 5, visK: 25, pr: 0 });
    expect(hot).toBeLessThan(comfortable);
  });

  it('deducts for poor visibility', () => {
    const clear = outdoorComfortScore({ tmp: 15, pp: 0, wind: 5, visK: 20, pr: 0 });
    const foggy = outdoorComfortScore({ tmp: 15, pp: 0, wind: 5, visK: 0.3, pr: 0 });
    expect(foggy).toBeLessThan(clear);
  });

  it('deducts for actual precipitation', () => {
    const dry = outdoorComfortScore({ tmp: 15, pp: 5, wind: 5, visK: 20, pr: 0 });
    const raining = outdoorComfortScore({ tmp: 15, pp: 5, wind: 5, visK: 20, pr: 4 });
    expect(raining).toBeLessThan(dry);
  });

  it('clamps at 0 for truly awful conditions', () => {
    const score = outdoorComfortScore({ tmp: -5, pp: 90, wind: 60, visK: 0.2, pr: 5 });
    expect(score).toBe(0);
  });

  it('clamps at 100 for perfect conditions beyond ideal', () => {
    const score = outdoorComfortScore({ tmp: 18, pp: 0, wind: 0, visK: 50, pr: 0 });
    expect(score).toBe(100);
  });

  describe('COMFORT_SCORE_CONFIG', () => {
    it('has expected rain thresholds', () => {
      expect(COMFORT_SCORE_CONFIG.rain.heavy.threshold).toBe(70);
      expect(COMFORT_SCORE_CONFIG.rain.moderate.threshold).toBe(40);
      expect(COMFORT_SCORE_CONFIG.rain.light.threshold).toBe(20);
      expect(COMFORT_SCORE_CONFIG.rain.minimal.threshold).toBe(5);
    });

    it('has expected wind thresholds', () => {
      expect(COMFORT_SCORE_CONFIG.wind.extreme.threshold).toBe(45);
      expect(COMFORT_SCORE_CONFIG.wind.strong.threshold).toBe(30);
      expect(COMFORT_SCORE_CONFIG.wind.moderate.threshold).toBe(20);
      expect(COMFORT_SCORE_CONFIG.wind.light.threshold).toBe(12);
    });

    it('has expected temperature thresholds', () => {
      expect(COMFORT_SCORE_CONFIG.temperature.freezing.threshold).toBe(0);
      expect(COMFORT_SCORE_CONFIG.temperature.cold.threshold).toBe(4);
      expect(COMFORT_SCORE_CONFIG.temperature.cool.threshold).toBe(7);
      expect(COMFORT_SCORE_CONFIG.temperature.veryHot.threshold).toBe(27);
      expect(COMFORT_SCORE_CONFIG.temperature.hot.threshold).toBe(32);
    });
  });
});

describe('outdoorComfortLabel', () => {
  it('returns "Best for a run" for high score with calm, mild, dry conditions', () => {
    const label = outdoorComfortLabel(80, { wind: 10, tmp: 15, pp: 5 });
    expect(label.text).toBe('Best for a run');
    expect(label.highlight).toBe(true);
  });

  it('returns "Best for a walk" for high score with moderate wind', () => {
    const windyLabel = outdoorComfortLabel(80, { wind: 28, tmp: 15, pp: 5 });
    expect(windyLabel.text).toBe('Best for a walk');
  });

  it('returns "Best for a walk" for high score with hot temperature', () => {
    const hotLabel = outdoorComfortLabel(80, { wind: 10, tmp: 28, pp: 5 });
    expect(hotLabel.text).toBe('Best for a walk');
  });

  it('returns "Best for a walk" for high score with cold temperature', () => {
    const coldLabel = outdoorComfortLabel(80, { wind: 10, tmp: 2, pp: 5 });
    expect(coldLabel.text).toBe('Best for a walk');
  });

  it('returns "Best for a walk" for high score with high rain probability', () => {
    const rainyLabel = outdoorComfortLabel(80, { wind: 10, tmp: 15, pp: 45 });
    expect(rainyLabel.text).toBe('Best for a walk');
  });

  it('returns "Pleasant" for moderate-good score', () => {
    const label = outdoorComfortLabel(60, { wind: 15, tmp: 12, pp: 15 });
    expect(label.text).toBe('Pleasant');
    expect(label.highlight).toBe(true);
  });

  it('returns "Acceptable" for marginal score', () => {
    const label = outdoorComfortLabel(40, { wind: 20, tmp: 8, pp: 25 });
    expect(label.text).toBe('Acceptable');
    expect(label.highlight).toBe(false);
  });

  it('returns "Poor conditions" for low score', () => {
    const label = outdoorComfortLabel(20, { wind: 40, tmp: 2, pp: 70 });
    expect(label.text).toBe('Poor conditions');
    expect(label.highlight).toBe(false);
  });

  it('returns correct colors for each category', () => {
    const best = outdoorComfortLabel(80, { wind: 10, tmp: 15, pp: 5 });
    const pleasant = outdoorComfortLabel(60, { wind: 15, tmp: 12, pp: 15 });
    const acceptable = outdoorComfortLabel(40, { wind: 20, tmp: 8, pp: 25 });
    const poor = outdoorComfortLabel(20, { wind: 40, tmp: 2, pp: 70 });

    expect(best.fg).toBeDefined();
    expect(best.bg).toBeDefined();
    expect(pleasant.fg).toBeDefined();
    expect(acceptable.fg).toBeDefined();
    expect(poor.fg).toBeDefined();
  });

  describe('RUN_FRIENDLY_THRESHOLDS', () => {
    it('has expected values', () => {
      expect(RUN_FRIENDLY_THRESHOLDS.maxWindKmh).toBe(22);
      expect(RUN_FRIENDLY_THRESHOLDS.minTempC).toBe(4);
      expect(RUN_FRIENDLY_THRESHOLDS.maxTempC).toBe(25);
      expect(RUN_FRIENDLY_THRESHOLDS.maxRainPct).toBe(40);
    });
  });
});

describe('outdoorComfortReasonCodes', () => {
  it('returns empty array for perfect conditions', () => {
    const codes = outdoorComfortReasonCodes({ tmp: 15, pp: 0, wind: 5, visK: 25, pr: 0 });
    expect(codes).toEqual([]);
  });

  it('detects heavy rain', () => {
    const codes = outdoorComfortReasonCodes({ tmp: 15, pp: 70, wind: 5, visK: 25, pr: 2 });
    expect(codes).toContain('rain-heavy');
  });

  it('detects rain risk', () => {
    const codes = outdoorComfortReasonCodes({ tmp: 15, pp: 40, wind: 5, visK: 25, pr: 0.5 });
    expect(codes).toContain('rain risk');
  });

  it('detects strong wind', () => {
    const codes = outdoorComfortReasonCodes({ tmp: 15, pp: 0, wind: 40, visK: 25, pr: 0 });
    expect(codes).toContain('strong wind');
  });

  it('detects breezy conditions', () => {
    const codes = outdoorComfortReasonCodes({ tmp: 15, pp: 0, wind: 25, visK: 25, pr: 0 });
    expect(codes).toContain('breezy');
  });

  it('detects cold temperature', () => {
    const codes = outdoorComfortReasonCodes({ tmp: 1, pp: 0, wind: 5, visK: 25, pr: 0 });
    expect(codes).toContain('cold');
  });

  it('detects warm temperature', () => {
    const codes = outdoorComfortReasonCodes({ tmp: 30, pp: 0, wind: 5, visK: 25, pr: 0 });
    expect(codes).toContain('warm');
  });

  it('detects low visibility', () => {
    const codes = outdoorComfortReasonCodes({ tmp: 15, pp: 0, wind: 5, visK: 1, pr: 0 });
    expect(codes).toContain('low visibility');
  });

  it('returns max 2 reasons', () => {
    const codes = outdoorComfortReasonCodes({ tmp: -5, pp: 80, wind: 50, visK: 0.5, pr: 3 });
    expect(codes.length).toBeLessThanOrEqual(2);
  });

  describe('COMFORT_REASON_THRESHOLDS', () => {
    it('has expected values', () => {
      expect(COMFORT_REASON_THRESHOLDS.rainHeavy).toEqual({ pr: 1, pp: 60 });
      expect(COMFORT_REASON_THRESHOLDS.rainRisk).toEqual({ pr: 0.2, pp: 35 });
      expect(COMFORT_REASON_THRESHOLDS.strongWind).toBe(35);
      expect(COMFORT_REASON_THRESHOLDS.breezy).toBe(22);
      expect(COMFORT_REASON_THRESHOLDS.cold).toBe(3);
      expect(COMFORT_REASON_THRESHOLDS.warm).toBe(28);
      expect(COMFORT_REASON_THRESHOLDS.lowVisibility).toBe(2);
    });
  });
});

describe('outdoorComfortReason', () => {
  it('returns empty string for perfect conditions', () => {
    const reason = outdoorComfortReason({ tmp: 15, pp: 0, wind: 5, visK: 25, pr: 0 });
    expect(reason).toBe('');
  });

  it('returns comma-separated reasons for multiple issues', () => {
    const reason = outdoorComfortReason({ tmp: 1, pp: 70, wind: 40, visK: 25, pr: 0 });
    expect(reason).toContain(',');
    expect(reason).toContain('rain-heavy');
    expect(reason).toContain('strong wind');
  });

  it('returns single reason for single issue', () => {
    const reason = outdoorComfortReason({ tmp: 15, pp: 0, wind: 40, visK: 25, pr: 0 });
    expect(reason).toBe('strong wind');
  });
});

describe('ComfortReasonCode type', () => {
  it('accepts valid reason codes', () => {
    const codes: ComfortReasonCode[] = [
      'rain-heavy',
      'rain risk',
      'strong wind',
      'breezy',
      'cold',
      'warm',
      'low visibility',
    ];
    expect(codes).toHaveLength(7);
  });
});
