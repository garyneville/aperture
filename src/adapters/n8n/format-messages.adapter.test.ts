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
    const aiText = 'Local peak is around 22:00 near the end of the Evening astro window. Sutton Bank is 24 points stronger thanks to darker skies if you can make the drive.';

    expect(shouldReplaceAiText(aiText, ctx)).toBe(false);
  });

  it('does not repeat start-end range for single-hour fallback windows', () => {
    const singleHourCtx = {
      windows: [{
        label: 'Best chance around sunrise',
        start: '07:00',
        end: '07:00',
        peak: 36,
        hours: [{ hour: '07:00', score: 36 }],
      }],
      dailySummary: [{ bestPhotoHour: '07:00', astroScore: 55 }],
      altLocations: [{
        name: 'Sutton Bank',
        bestScore: 65,
        bestAstroHour: '19:00',
        darkSky: true,
        driveMins: 75,
      }],
    };

    const text = buildFallbackAiText(singleHourCtx);
    expect(text).not.toContain('07:00-07:00');
    expect(text).toContain('07:00');
    expect(text).toContain('Sutton Bank is 29 points stronger');
  });

  it('uses generic wording for astro-delta on morning windows', () => {
    const morningCtx = {
      windows: [{
        label: 'Best chance around sunrise',
        start: '07:00',
        end: '07:00',
        peak: 36,
        hours: [{ hour: '07:00', score: 36 }],
      }],
      dailySummary: [{ bestPhotoHour: '07:00', astroScore: 55 }],
      altLocations: [],
    };

    const text = buildFallbackAiText(morningCtx);
    expect(text).toContain('conditions outside the named window');
    expect(text).not.toContain('evening');
  });
});
