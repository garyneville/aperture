import { describe, expect, it } from 'vitest';
import { buildFallbackAiText, shouldReplaceAiText } from './format-messages.adapter.js';

describe('format-messages adapter editorial fallback', () => {
  const ctx = {
    windows: [{
      label: 'Evening astro window',
      start: '19:00',
      end: '22:00',
      peak: 61,
      hours: [
        { hour: '19:00', score: 54 },
        { hour: '20:00', score: 57 },
        { hour: '21:00', score: 59 },
        { hour: '22:00', score: 61 },
      ],
    }, {
      label: 'Overnight astro window',
      start: '01:00',
      end: '05:00',
      peak: 57,
      hours: [{ hour: '01:00', score: 57 }],
    }],
    dailySummary: [{
      bestPhotoHour: '22:00',
      astroScore: 75,
    }],
    altLocations: [{
      name: 'Sutton Bank',
      bestScore: 85,
      bestAstroHour: '20:00',
      darkSky: true,
      driveMins: 75,
    }],
  };

  it('replaces card-restatement AI copy with a structured summary', () => {
    const aiText = 'For Leeds, the Evening astro window from 19:00-22:00 scores 61/100 with 0% cloud cover and 15.2km visibility.';

    expect(shouldReplaceAiText(aiText, ctx)).toBe(true);
    expect(buildFallbackAiText(ctx)).toContain('Local peak is around 22:00');
    expect(buildFallbackAiText(ctx)).toContain('Sutton Bank is 24 points stronger thanks to darker skies around 20:00 if you can make the 75-minute drive.');
  });

  it('keeps AI copy that already adds comparative insight', () => {
    const aiText = 'Local peak is around 22:00 near the end of the evening window. Sutton Bank is 24 points stronger thanks to darker skies if you can make the drive.';

    expect(shouldReplaceAiText(aiText, ctx)).toBe(false);
  });
});
