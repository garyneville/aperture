import { describe, expect, it } from 'vitest';
import { explainAstroScoreGap } from './astro-score-explanation.js';

describe('explainAstroScoreGap', () => {
  it('explains same-hour astro gaps as weighting differences', () => {
    const result = explainAstroScoreGap({
      window: {
        start: '04:00',
        end: '04:00',
        peak: 51,
      },
      today: {
        astroScore: 63,
        bestAstroHour: '04:00',
      },
    });

    expect(result?.reason).toBe('weighted-gap');
    expect(result?.text).toBe('Peak astro sub-score is 63/100 at 04:00, with the final window score at 51/100 after full weighting.');
  });

  it('calls out when the strongest astro hour sits outside the named window', () => {
    const result = explainAstroScoreGap({
      window: {
        start: '19:00',
        end: '22:00',
        peak: 60,
      },
      today: {
        astroScore: 75,
        bestAstroHour: '01:00',
      },
    });

    expect(result?.reason).toBe('outside-window');
    expect(result?.text).toBe('Peak astro sub-score reaches 75/100 around 01:00, outside the named window; the named window itself tops out at 60/100.');
  });

  it('prefers dark-sky timing language when the stronger astro hour arrives after moonset', () => {
    const result = explainAstroScoreGap({
      window: {
        start: '19:00',
        end: '22:00',
        peak: 60,
      },
      today: {
        astroScore: 75,
        bestAstroHour: '23:30',
        darkSkyStartsAt: '22:45',
      },
    });

    expect(result?.reason).toBe('darker-later');
    expect(result?.text).toBe('Peak astro sub-score reaches 75/100 around 23:30, after darker conditions begin at 22:45; the named window itself tops out at 60/100.');
  });
});
