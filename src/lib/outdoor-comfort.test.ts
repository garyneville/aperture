import { describe, it, expect } from 'vitest';
import { outdoorComfortScore, outdoorComfortText } from './outdoor-comfort.js';

describe('outdoorComfortScore', () => {
  it('returns 100 for perfect conditions', () => {
    expect(outdoorComfortScore({ tmp: 18, pp: 0, wind: 8, visK: 30, pr: 0 })).toBe(100);
  });

  it('penalises heavy rain probability', () => {
    expect(outdoorComfortScore({ tmp: 18, pp: 80, wind: 8, visK: 30, pr: 0 })).toBe(50);
  });

  it('penalises cold temperatures', () => {
    expect(outdoorComfortScore({ tmp: 2, pp: 0, wind: 8, visK: 30, pr: 0 })).toBe(80);
  });

  it('penalises strong wind', () => {
    expect(outdoorComfortScore({ tmp: 18, pp: 0, wind: 35, visK: 30, pr: 0 })).toBe(70);
  });

  it('clamps at 0 for extreme conditions', () => {
    expect(outdoorComfortScore({ tmp: -5, pp: 90, wind: 50, visK: 0.3, pr: 5 })).toBe(0);
  });
});

describe('outdoorComfortText', () => {
  it('returns time-of-day text for high comfort', () => {
    const h = { wind: 10, tmp: 15, pp: 5 };
    expect(outdoorComfortText(80, h, '09:00')).toBe('Morning run');
  });

  it('returns "Pleasant" for mid-range scores', () => {
    expect(outdoorComfortText(60, { wind: 10, tmp: 15, pp: 5 })).toBe('Pleasant');
  });

  it('returns "Acceptable" for lower scores', () => {
    expect(outdoorComfortText(40, { wind: 10, tmp: 15, pp: 5 })).toBe('Acceptable');
  });

  it('returns "Poor conditions" for low scores', () => {
    expect(outdoorComfortText(20, { wind: 10, tmp: 15, pp: 5 })).toBe('Poor conditions');
  });

  it('returns walk variant when not run-friendly', () => {
    const h = { wind: 30, tmp: 15, pp: 5 };  // wind too high for running
    expect(outdoorComfortText(80, h, '09:00')).toBe('Morning walk');
  });

  it('returns evening label for evening hours', () => {
    const h = { wind: 10, tmp: 15, pp: 5 };
    expect(outdoorComfortText(80, h, '19:00')).toBe('Evening run');
  });
});
