import { describe, it, expect } from 'vitest';
import { computeConfidence, type ConfidenceInput, type SessionBoundaries } from './confidence.js';

const baseBoundaries: SessionBoundaries = {
  goldAmS: new Date('2026-04-06T05:50:00Z'),
  goldAmE: new Date('2026-04-06T07:05:00Z'),
  goldPmS: new Date('2026-04-06T18:55:00Z'),
  goldPmE: new Date('2026-04-06T20:05:00Z'),
  blueAmS: new Date('2026-04-06T05:30:00Z'),
  bluePmE: new Date('2026-04-06T20:30:00Z'),
};

function makeInput(stdDevs: number[]): ConfidenceInput {
  const byDate: Record<string, { ts: string; i: number }[]> = {};
  const ensIdx: Record<string, { mean: number; stdDev: number }> = {};
  const dateKey = '2026-04-06';
  byDate[dateKey] = [];

  // Create hourly entries spanning 00:00–23:00
  for (let h = 0; h < 24; h++) {
    const ts = `2026-04-06T${String(h).padStart(2, '0')}:00:00Z`;
    const sd = stdDevs[h % stdDevs.length];
    byDate[dateKey].push({ ts, i: h });
    ensIdx[ts] = { mean: 50, stdDev: sd };
  }

  return { dateKey, byDate, ensIdx, boundaries: baseBoundaries };
}

describe('computeConfidence — recalibrated bands', () => {
  it('returns high confidence when stdDev < 15', () => {
    const result = computeConfidence(makeInput([10]));
    expect(result.overall.confidence).toBe('high');
  });

  it('returns medium confidence when stdDev is between 15 and 29', () => {
    const result = computeConfidence(makeInput([22]));
    expect(result.overall.confidence).toBe('medium');
  });

  it('returns low confidence when stdDev is between 30 and 39', () => {
    const result = computeConfidence(makeInput([35]));
    expect(result.overall.confidence).toBe('low');
  });

  it('returns very-low confidence when stdDev >= 40', () => {
    const result = computeConfidence(makeInput([45]));
    expect(result.overall.confidence).toBe('very-low');
  });

  it('correctly distinguishes bands at threshold boundaries', () => {
    // Just below each boundary
    expect(computeConfidence(makeInput([14.9])).overall.confidence).toBe('high');
    expect(computeConfidence(makeInput([29.9])).overall.confidence).toBe('medium');
    expect(computeConfidence(makeInput([39.9])).overall.confidence).toBe('low');

    // At each boundary
    expect(computeConfidence(makeInput([15])).overall.confidence).toBe('medium');
    expect(computeConfidence(makeInput([30])).overall.confidence).toBe('low');
    expect(computeConfidence(makeInput([40])).overall.confidence).toBe('very-low');
  });
});
