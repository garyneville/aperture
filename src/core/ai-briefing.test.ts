import { describe, expect, it } from 'vitest';
import { renderAiBriefingText } from './ai-briefing.js';

describe('renderAiBriefingText', () => {
  const baseCtx = {
    dontBother: false,
    windows: [{
      label: 'Overnight astro window',
      start: '04:00',
      end: '04:00',
      peak: 60,
      hours: [{ hour: '04:00', score: 60 }],
    }],
    dailySummary: [{
      bestPhotoHour: '04:00',
      astroScore: 72,
      bestAstroHour: '04:00',
    }],
    altLocations: [],
  };

  it('replaces a single-sentence card restatement with deterministic fallback copy', () => {
    const result = renderAiBriefingText(
      'Overnight astro window at 04:00 scores 60/100, peak time with 20.5km visibility.',
      baseCtx,
    );

    expect(result.usedFallback).toBe(true);
    expect(result.text).toContain('Local peak is around 04:00 in the overnight astro window.');
    expect(result.text).toContain('Peak astro sub-score is 72/100 at 04:00, with the final window score at 60/100 after full weighting.');
  });

  it('strips a redundant opener when a useful second sentence follows', () => {
    const result = renderAiBriefingText(
      'Overnight astro window at 04:00 scores 60/100, peak time with 20.5km visibility. Darker skies arrive after moonset, so the wider night still carries more promise than this narrow slot.',
      baseCtx,
    );

    expect(result.usedFallback).toBe(false);
    expect(result.strippedOpener).toBe(true);
    expect(result.text).toBe('Darker skies arrive after moonset, so the wider night still carries more promise than this narrow slot.');
  });
});
