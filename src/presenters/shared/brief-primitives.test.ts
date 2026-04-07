import { describe, it, expect } from 'vitest';
import { scoreState, SCORE_THRESHOLDS } from './brief-primitives.js';

describe('SCORE_THRESHOLDS', () => {
  it('defines recalibrated thresholds for UK spring conditions', () => {
    expect(SCORE_THRESHOLDS.excellent).toBe(72);
    expect(SCORE_THRESHOLDS.good).toBe(52);
    expect(SCORE_THRESHOLDS.marginal).toBe(35);
  });
});

describe('scoreState — boundary values', () => {
  it('returns Excellent at the threshold boundary (72)', () => {
    expect(scoreState(72).label).toBe('Excellent');
  });

  it('returns Good just below Excellent (71)', () => {
    expect(scoreState(71).label).toBe('Good');
  });

  it('returns Good at the threshold boundary (52)', () => {
    expect(scoreState(52).label).toBe('Good');
  });

  it('returns Marginal just below Good (51)', () => {
    expect(scoreState(51).label).toBe('Marginal');
  });

  it('returns Marginal at the threshold boundary (35)', () => {
    expect(scoreState(35).label).toBe('Marginal');
  });

  it('returns Poor just below Marginal (34)', () => {
    expect(scoreState(34).label).toBe('Poor');
  });

  it('returns Excellent for high scores (100)', () => {
    expect(scoreState(100).label).toBe('Excellent');
  });

  it('returns Poor for zero', () => {
    expect(scoreState(0).label).toBe('Poor');
  });

  it('classifies a clear-sky golden hour score (~52) as Good, not Poor', () => {
    // R8: A clear-sky golden hour day (score ~50-55) should NOT be labelled Poor
    expect(scoreState(52).label).toBe('Good');
    expect(scoreState(50).label).toBe('Marginal');
    expect(scoreState(55).label).toBe('Good');
  });
});
