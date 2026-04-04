import { describe, expect, it } from 'vitest';
import { BRIEF_JSON_SCHEMA_VERSION } from '../../contracts/index.js';
import {
  buildFallbackAiText,
  chooseEditorialCandidate,
  filterCompositionBullets,
  isFactuallyIncoherentEditorial,
  normalizeAiText,
  parseEditorialResponse,
  resolveSpurSuggestion,
  shouldReplaceAiText,
} from '../../domain/editorial/resolution/resolve-editorial.js';
import {
  run,
} from './format-messages.adapter.js';
import { buildEditorialGatewayPayload } from '../../app/run-photo-brief/editorial-gateway.js';
import { LONG_RANGE_LOCATIONS, estimatedDriveMins } from '../../lib/long-range-locations.js';

function createEditorialGateway(groqRawText: string, geminiRawText = '') {
  return buildEditorialGatewayPayload({ groqRawText, geminiRawText });
}

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
      bestAstroHour: '22:00',
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
    const fallback = buildFallbackAiText(ctx);
    expect(fallback).toContain('The evening astro window from 19:00-22:00 is the strongest local slot today.');
    // Editorial fallback is Leeds-only — alternative location must not appear (issue #71)
    expect(fallback).not.toContain('Consider Sutton Bank');
    expect(fallback).not.toContain('points stronger');
  });

  it('keeps AI copy that uses prose-only alt recommendation without metric language', () => {
    const aiText = 'Conditions improve through the evening astro window towards 22:00. Consider Sutton Bank for better dark sky conditions if you can make the drive.';

    expect(shouldReplaceAiText(aiText, ctx)).toBe(false);
  });

  it('replaces AI copy that mentions alt score delta even when factually correct (Rule 4)', () => {
    const metricLeakText = 'Local peak is around 22:00 near the end of the Evening astro window. Sutton Bank is 24 points stronger thanks to darker skies if you can make the drive.';

    expect(shouldReplaceAiText(metricLeakText, ctx)).toBe(true);
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
      dailySummary: [{ bestPhotoHour: '07:00', astroScore: 55, bestAstroHour: '07:00' }],
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
    // Editorial fallback is Leeds-only — alternative location must not appear (issue #71)
    expect(text).not.toContain('Consider Sutton Bank');
    expect(text).not.toContain('points stronger');
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
      dailySummary: [{ bestPhotoHour: '07:00', astroScore: 55, bestAstroHour: '07:00' }],
      altLocations: [],
    };

    const text = buildFallbackAiText(morningCtx);
    expect(text).toContain('The window tops out at 36/100 overall despite a raw astro peak of 55/100 (07:00).');
    expect(text).not.toContain('evening');
  });

  it('switches fallback copy to the next upcoming window when the original primary window is already past', () => {
    const eveningCtx = {
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        hours: [{ hour: '03:00', score: 56 }],
      }, {
        label: 'Evening astro window',
        start: '21:00',
        end: '23:00',
        peak: 48,
        hours: [{ hour: '22:00', score: 48 }],
      }],
      dailySummary: [{
        bestPhotoHour: '22:00',
        astroScore: 68,
        bestAstroHour: '22:00',
        darkSkyStartsAt: '21:00',
      }],
      altLocations: [],
      debugContext: {
        metadata: {
          generatedAt: '2026-03-18T19:16:00Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.55,
          timezone: 'Europe/London',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    };

    const text = buildFallbackAiText(eveningCtx);
    expect(text).toContain('Midnight astro window 00:00-04:00 was earlier today.');
    expect(text).toContain('Evening astro window 21:00-23:00 is the best remaining local option.');
    expect(text).not.toContain('The midnight astro window from 00:00-04:00 is the strongest local slot today.');
  });

  it('forces fallback when a non-dontBother run has no chosen local window', () => {
    const noWindowCtx = {
      windows: [],
      dontBother: false,
      dailySummary: [{
        bestPhotoHour: '07:00',
        astroScore: 52,
        bestAstroHour: '04:00',
        darkSkyStartsAt: '00:00',
      }],
      altLocations: [{
        name: 'Brimham Rocks',
        bestScore: 81,
        bestAstroHour: '02:00',
        darkSky: false,
        driveMins: 40,
      }],
    };

    const aiText = 'Darkness improves from 00:00. Consider Brimham Rocks today — better overall conditions (40 min drive).';

    expect(shouldReplaceAiText(aiText, noWindowCtx)).toBe(true);
    expect(buildFallbackAiText(noWindowCtx)).toContain('No strong local photo window in Leeds today');
  });

  it('filters remote composition bullets and backfills local-only ideas', () => {
    const bullets = filterCompositionBullets([
      'Shoot tree silhouettes at sunrise',
      'Capture star trails at Brimham Rocks',
    ], {
      windows: [{
        label: 'Best chance around sunrise',
        start: '07:00',
        end: '07:00',
        peak: 36,
        tops: ['landscape', 'clear light path'],
        hours: [{ hour: '07:00', score: 36 }],
      }],
      dailySummary: [{ bestPhotoHour: '07:00' }],
      altLocations: [{ name: 'Brimham Rocks', driveMins: 40 }],
    });

    expect(bullets).toContain('Shoot tree silhouettes at sunrise');
    expect(bullets.some(bullet => bullet.includes('Brimham Rocks'))).toBe(false);
    expect(bullets).toHaveLength(2);
  });

  it('injects aurora-aware shot ideas when a local aurora opportunity is active', () => {
    const bullets = filterCompositionBullets([
      'Star trails with a silhouetted landmark foreground',
      'Wide-field constellation framing',
    ], {
      peakKpTonight: 6.3,
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        tops: ['astrophotography'],
        hours: [{ hour: '03:00', score: 56 }],
      }],
      dailySummary: [{ bestPhotoHour: '03:00', astroScore: 68, bestAstroHour: '03:00' }],
      altLocations: [],
    });

    expect(bullets[0]?.toLowerCase()).toContain('north');
    expect(bullets.join(' ').toLowerCase()).toContain('aurora');
  });
});

describe('isFactuallyIncoherentEditorial — 15 March regression', () => {
  const marchCtx = {
    windows: [{
      label: 'Evening astro window',
      start: '20:00',
      end: '23:00',
      peak: 55,
      hours: [
        { hour: '20:00', score: 55 },
        { hour: '21:00', score: 50 },
        { hour: '22:00', score: 48 },
        { hour: '23:00', score: 45 },
      ],
    }],
    dailySummary: [{ bestPhotoHour: '20:00', astroScore: 60 }],
    altLocations: [{
      name: 'Sutton Bank',
      bestScore: 85,
      bestAstroHour: '20:00',
      darkSky: true,
      driveMins: 75,
    }],
  };

  it('flags hallucination where alt name appears in first sentence (rule 1)', () => {
    const hallucinatedText = 'Leeds has the Sutton Bank window from 20:00, scoring 85. Sutton Bank is 85 points stronger mainly because of darker skies around 20:00.';
    expect(isFactuallyIncoherentEditorial(hallucinatedText, marchCtx)).toBe(true);
  });

  it('flags hallucination where delta is reused as score (rule 3)', () => {
    // First sentence is fine but delta is wrong (85 points stronger; real delta is 30)
    const wrongDeltaText = 'Local peak is around 20:00 in the evening astro window. Sutton Bank is 85 points stronger mainly because of darker skies.';
    expect(isFactuallyIncoherentEditorial(wrongDeltaText, marchCtx)).toBe(true);
  });

  it('flags hallucination where quoted X/100 score is not in source data (rule 2)', () => {
    // Leeds peak is 55, Sutton Bank is 85, astro score is 60 — 70 is not a known value
    const wrongScoreText = 'Local peak is around 20:00, scoring 70/100. Sutton Bank is 30 points stronger thanks to darker skies.';
    expect(isFactuallyIncoherentEditorial(wrongScoreText, marchCtx)).toBe(true);
  });

  it('flags metric alt language even when factually correct (Rule 4 — 16 March regression)', () => {
    // "30 points stronger" is factually accurate (85 - 55 = 30) but is a metric leak.
    // Rule 4 catches this regardless of accuracy. Editorial must use prose only.
    const metricLeakText = 'Local peak is around 20:00 in the evening astro window. Sutton Bank is 30 points stronger thanks to darker skies.';
    expect(isFactuallyIncoherentEditorial(metricLeakText, marchCtx)).toBe(true);
  });

  it('does not flag a prose-only alt mention in the second sentence', () => {
    const proseText = 'Local peak is around 20:00 in the evening astro window. Consider Sutton Bank for better dark sky conditions if you can make the drive.';
    expect(isFactuallyIncoherentEditorial(proseText, marchCtx)).toBe(false);
  });

  it('flags cloud-blame copy when peak-hour cloud is effectively zero', () => {
    const cloudCtx = {
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        hours: [
          { hour: '03:00', score: 56, ct: 0, visK: 12, aod: 0.13 },
        ],
      }],
      dailySummary: [{
        bestPhotoHour: '03:00',
        astroScore: 68,
        bestAstroHour: '03:00',
        darkSkyStartsAt: '00:00',
      }],
      altLocations: [],
    };

    const hallucinatedText = 'The midnight astro window is worth a look. Cloud or haze weigh it down from the raw astro peak.';
    expect(isFactuallyIncoherentEditorial(hallucinatedText, cloudCtx)).toBe(true);
  });

  it('flags moonset phrasing when dark-sky conditions already begin at the selected window start', () => {
    const moonCtx = {
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        hours: [{ hour: '03:00', score: 56, ct: 0, visK: 12, aod: 0.13 }],
      }],
      dailySummary: [{
        bestPhotoHour: '03:00',
        astroScore: 68,
        bestAstroHour: '03:00',
        darkSkyStartsAt: '00:00',
      }],
      altLocations: [],
    };

    const misleadingText = 'Dark-sky conditions improve from 00:00 once the moon is down. Peak local time is around 03:00 within the midnight astro window.';
    expect(isFactuallyIncoherentEditorial(misleadingText, moonCtx)).toBe(true);
  });

  it('flags peak-time phrasing when the named time is outside the window range', () => {
    // Times within window range are now accepted (Issue #96 - loosened validation)
    // Only times completely outside the window range should be flagged
    const outsideWindowText = 'Dark-sky conditions hold through the midnight astro window. Peak local time is around 22:00 the previous evening.';
    expect(isFactuallyIncoherentEditorial(outsideWindowText, {
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        hours: [{ hour: '03:00', score: 56, ct: 0, visK: 12, aod: 0.13 }],
      }],
      dailySummary: [{
        bestPhotoHour: '03:00',
        astroScore: 68,
        bestAstroHour: '03:00',
        darkSkyStartsAt: '00:00',
      }],
      altLocations: [],
    })).toBe(true);

    // Times within the window range should be accepted even if not the exact peak
    const withinWindowText = 'Dark-sky conditions hold through the midnight astro window. Peak local time is around 01:00 within the midnight astro window.';
    expect(isFactuallyIncoherentEditorial(withinWindowText, {
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        hours: [{ hour: '03:00', score: 56, ct: 0, visK: 12, aod: 0.13 }],
      }],
      dailySummary: [{
        bestPhotoHour: '03:00',
        astroScore: 68,
        bestAstroHour: '03:00',
        darkSkyStartsAt: '00:00',
      }],
      altLocations: [],
    })).toBe(false);
  });

  it('shouldReplaceAiText returns true for the 15 March hallucination', () => {
    const hallucinatedText = 'Leeds has the Sutton Bank window from 20:00, scoring 85. Sutton Bank is 85 points stronger mainly because of darker skies around 20:00.';
    expect(shouldReplaceAiText(hallucinatedText, marchCtx)).toBe(true);
  });

  it('shouldReplaceAiText returns true for metric alt language even when factually correct', () => {
    const metricLeakText = 'Local peak is around 20:00 in the evening astro window. Sutton Bank is 30 points stronger thanks to darker skies if you can make the drive.';
    expect(shouldReplaceAiText(metricLeakText, marchCtx)).toBe(true);
  });

  it('shouldReplaceAiText returns false for a prose-only alt recommendation', () => {
    const proseText = 'Local peak is around 20:00 in the evening astro window. Consider Sutton Bank for better dark sky conditions if you can make the drive.';
    expect(shouldReplaceAiText(proseText, marchCtx)).toBe(false);
  });
});

describe('parseEditorialResponse — spurOfTheMoment', () => {
  it('extracts spurRaw when all required fields are present', () => {
    const raw = JSON.stringify({
      editorial: 'Good conditions today.',
      composition: ['Shot idea 1', 'Shot idea 2'],
      weekStandout: 'Thursday looks best.',
      spurOfTheMoment: { locationName: 'Aysgarth Falls', hookLine: 'Overcast light is perfect for waterfalls without harsh shadows.', confidence: 0.85 },
    });
    const result = parseEditorialResponse(raw);
    expect(result.spurRaw).not.toBeNull();
    expect(result.spurRaw?.locationName).toBe('Aysgarth Falls');
    expect(result.spurRaw?.hookLine).toBe('Overcast light is perfect for waterfalls without harsh shadows.');
    expect(result.spurRaw?.confidence).toBe(0.85);
  });

  it('keeps spurRaw even when confidence is below 0.7 so the debug trace can explain the drop', () => {
    const raw = JSON.stringify({
      editorial: 'Good conditions today.',
      composition: [],
      weekStandout: 'Today.',
      spurOfTheMoment: { locationName: 'Mam Tor', hookLine: 'Nice upland views.', confidence: 0.65 },
    });
    expect(parseEditorialResponse(raw).spurRaw).toEqual({
      locationName: 'Mam Tor',
      hookLine: 'Nice upland views.',
      confidence: 0.65,
    });
  });

  it('drops spurRaw when locationName is missing', () => {
    const raw = JSON.stringify({
      editorial: 'Good.',
      composition: [],
      weekStandout: 'Today.',
      spurOfTheMoment: { hookLine: 'Great views.', confidence: 0.8 },
    });
    expect(parseEditorialResponse(raw).spurRaw).toBeNull();
  });

  it('drops spurRaw when structured-output placeholders are blank', () => {
    const raw = JSON.stringify({
      editorial: 'Good.',
      composition: [],
      weekStandout: 'Today.',
      spurOfTheMoment: { locationName: '', hookLine: '', confidence: 0 },
    });
    expect(parseEditorialResponse(raw).spurRaw).toBeNull();
  });

  it('returns null spurRaw when spurOfTheMoment key is absent', () => {
    const raw = JSON.stringify({ editorial: 'Good.', composition: [], weekStandout: 'Today.' });
    expect(parseEditorialResponse(raw).spurRaw).toBeNull();
  });

  it('still extracts editorial and composition when spurOfTheMoment is absent', () => {
    const raw = JSON.stringify({ editorial: 'Fine day.', composition: ['Idea A'], weekStandout: 'Friday.' });
    const result = parseEditorialResponse(raw);
    expect(result.editorial).toBe('Fine day.');
    expect(result.compositionBullets).toEqual(['Idea A']);
    expect(result.weekInsight).toBe('Friday.');
  });
});

describe('chooseEditorialCandidate', () => {
  const ctx = {
    windows: [{
      label: 'Midnight astro window',
      start: '00:00',
      end: '04:00',
      peak: 56,
      tops: ['astrophotography'],
      hours: [{ hour: '03:00', score: 56, ct: 0, visK: 12, aod: 0.13 }],
    }],
    dailySummary: [{
      bestPhotoHour: '03:00',
      astroScore: 68,
      bestAstroHour: '03:00',
      darkSkyStartsAt: '00:00',
    }],
    peakKpTonight: 6.3,
    altLocations: [],
  };

  it('uses the preferred Gemini provider when it passes validation', () => {
    const geminiContent = JSON.stringify({
      editorial: 'Conditions stay clean through the midnight astro window. The 03:00 peak also lines up with an aurora signal, so a clear northern horizon matters.',
      composition: ['Face north with a low tree line for any aurora glow', 'Keep a wide frame above a dark ridge at 03:00'],
    });
    const groqContent = JSON.stringify({
      editorial: 'The midnight astro window from 00:00-04:00 scores 56/100. Peak local time is around 03:00.',
      composition: ['Star trails with a silhouetted landmark foreground', 'Wide-field constellation framing'],
    });

    const choice = chooseEditorialCandidate(
      'gemini',
      ctx,
      createEditorialGateway(groqContent, geminiContent),
    );

    expect(choice.selectedProvider).toBe('gemini');
    expect(choice.selectedCandidate?.compositionBullets[0]).toContain('Face north');
  });

  it('falls back to Groq when the preferred Gemini candidate fails validation', () => {
    const geminiContent = JSON.stringify({
      editorial: 'The midnight astro window from 00:00-04:00 scores 56/100. Peak local time is around 01:00.',
      composition: ['Wide-field constellation framing'],
    });
    const groqContent = JSON.stringify({
      editorial: 'Conditions stay clean through the midnight astro window. Peak local time is around 03:00, with the cleanest sky late in the slot.',
      composition: ['Set a dark ridge low in the frame for the 03:00 peak', 'Keep the cleanest skyline for the darkest part of the slot'],
    });

    const choice = chooseEditorialCandidate(
      'gemini',
      ctx,
      createEditorialGateway(groqContent, geminiContent),
    );

    expect(choice.selectedProvider).toBe('groq');
    expect(choice.primaryCandidate?.passed).toBe(false);
    expect(choice.secondaryCandidate?.passed).toBe(true);
  });

  it('validates against the next upcoming window when the original primary window has already passed', () => {
    const pastWindowCtx = {
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        tops: ['astrophotography'],
        hours: [{ hour: '03:00', score: 56, ct: 0, visK: 12, aod: 0.13 }],
      }, {
        label: 'Evening astro window',
        start: '21:00',
        end: '23:00',
        peak: 48,
        tops: ['astrophotography'],
        hours: [{ hour: '22:00', score: 48, ct: 12, visK: 10, aod: 0.14 }],
      }],
      dailySummary: [{
        bestPhotoHour: '22:00',
        astroScore: 68,
        bestAstroHour: '22:00',
        darkSkyStartsAt: '21:00',
      }],
      peakKpTonight: 6.1,
      altLocations: [],
      debugContext: {
        metadata: {
          generatedAt: '2026-03-18T19:16:00Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.55,
          timezone: 'Europe/London',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    };
    const groqContent = JSON.stringify({
      editorial: 'The midnight astro window was earlier today. The evening astro window from 21:00-23:00 is now the best remaining local option as darker skies settle in.',
      composition: ['Keep a clean skyline ready for the darker second slot'],
    });
    const geminiContent = JSON.stringify({
      editorial: 'The midnight astro window from 00:00-04:00 scores 56/100. Peak local time is around 03:00.',
      composition: ['Wide-field constellation framing'],
    });

    const choice = chooseEditorialCandidate(
      'groq',
      pastWindowCtx,
      createEditorialGateway(groqContent, geminiContent),
    );

    expect(choice.selectedProvider).toBe('groq');
    expect(choice.primaryCandidate?.passed).toBe(true);
    expect(choice.primaryCandidate?.factualCheck.passed).toBe(true);
    expect(choice.primaryCandidate?.editorialCheck.passed).toBe(true);
  });

  it('keeps reusable composition and spur data when only the editorial check fails', () => {
    const groqContent = JSON.stringify({
      editorial: 'Conditions stay clean tonight.',
      composition: ['Frame the canal bridge under the clearest western sky'],
      weekStandout: 'Wednesday is the standout day.',
      spurOfTheMoment: {
        locationName: 'Aysgarth Falls',
        hookLine: 'Soft overcast and full flow make the falls worth the drive today.',
        confidence: 0.8,
      },
    });

    const choice = chooseEditorialCandidate(
      'groq',
      ctx,
      createEditorialGateway(groqContent),
    );

    expect(choice.selectedProvider).toBe('template');
    expect(choice.selectedCandidate).toBeNull();
    expect(choice.componentCandidate?.provider).toBe('groq');
    expect(choice.componentCandidate?.compositionBullets).toEqual(['Frame the canal bridge under the clearest western sky']);
    expect(choice.componentCandidate?.spurRaw?.locationName).toBe('Aysgarth Falls');
  });
});

describe('parseEditorialResponse — provider-neutral parsing', () => {
  it('returns valid-structured parse result for valid JSON response', () => {
    const raw = JSON.stringify({
      editorial: 'Good conditions today.',
      composition: ['Shot idea 1'],
      weekStandout: 'Thursday looks best.',
    });
    const result = parseEditorialResponse(raw);
    expect(result.parseResult).toBe('valid-structured');
    expect(result.editorial).toBe('Good conditions today.');
    expect(result.compositionBullets).toEqual(['Shot idea 1']);
    expect(result.weekInsight).toBe('Thursday looks best.');
  });

  it('returns raw-text-only parse result for non-JSON response', () => {
    const raw = 'This is just plain text without JSON structure.';
    const result = parseEditorialResponse(raw);
    expect(result.parseResult).toBe('raw-text-only');
    expect(result.editorial).toBe(raw);
    expect(result.compositionBullets).toEqual([]);
    expect(result.weekInsight).toBe('');
    expect(result.spurRaw).toBeNull();
  });

  it('returns malformed-structured parse result for invalid JSON', () => {
    const raw = '{ invalid json }';
    const result = parseEditorialResponse(raw);
    expect(result.parseResult).toBe('malformed-structured');
    expect(result.editorial).toBe(raw);
  });

  it('returns malformed-structured when editorial field is missing from JSON', () => {
    const raw = JSON.stringify({ composition: ['Shot idea'], weekStandout: 'Friday' });
    const result = parseEditorialResponse(raw);
    expect(result.parseResult).toBe('malformed-structured');
    expect(result.editorial).toBe(raw); // Falls back to raw content
    expect(result.weekStandoutRawValue).toBe('Friday');
  });

  it('extracts spurRaw when all required fields are present', () => {
    const raw = JSON.stringify({
      editorial: 'Good conditions today.',
      composition: ['Shot idea 1', 'Shot idea 2'],
      weekStandout: 'Thursday looks best.',
      spurOfTheMoment: { locationName: 'Aysgarth Falls', hookLine: 'Overcast light is perfect for waterfalls without harsh shadows.', confidence: 0.85 },
    });
    const result = parseEditorialResponse(raw);
    expect(result.parseResult).toBe('valid-structured');
    expect(result.spurRaw).not.toBeNull();
    expect(result.spurRaw?.locationName).toBe('Aysgarth Falls');
    expect(result.spurRaw?.hookLine).toBe('Overcast light is perfect for waterfalls without harsh shadows.');
    expect(result.spurRaw?.confidence).toBe(0.85);
  });

  it('strips Markdown code fences and successfully parses', () => {
    const inner = JSON.stringify({ editorial: 'Good.', composition: [], weekStandout: 'Friday is best.' });
    const fenced = `\`\`\`json\n${inner}\n\`\`\``;
    const result = parseEditorialResponse(fenced);
    expect(result.parseResult).toBe('valid-structured');
    expect(result.editorial).toBe('Good.');
  });
});

describe('resolveSpurSuggestion', () => {
  it('returns null when spurRaw is null', () => {
    expect(resolveSpurSuggestion(null)).toBeNull();
  });

  it('returns null when confidence is below 0.7', () => {
    expect(resolveSpurSuggestion({ locationName: 'Mam Tor', hookLine: 'Great.', confidence: 0.65 })).toBeNull();
  });

  it('returns null when locationName is not in the known list', () => {
    expect(resolveSpurSuggestion({ locationName: 'Fictional Peak', hookLine: 'Great.', confidence: 0.9 })).toBeNull();
  });

  it('returns null when locationName is a misspelled variant', () => {
    expect(resolveSpurSuggestion({ locationName: 'Pen-Y-Ghent', hookLine: 'Great.', confidence: 0.9 })).toBeNull();
  });

  it('resolves a valid location with metadata from LONG_RANGE_LOCATIONS, not from Groq', () => {
    const loc = LONG_RANGE_LOCATIONS.find(l => l.name === 'Aysgarth Falls')!;
    const result = resolveSpurSuggestion({ locationName: 'Aysgarth Falls', hookLine: 'Autumn colour fills the gorge.', confidence: 0.8 });
    expect(result).not.toBeNull();
    expect(result?.locationName).toBe('Aysgarth Falls');
    expect(result?.region).toBe(loc.region);
    expect(result?.driveMins).toBe(estimatedDriveMins(loc));
    expect(result?.tags).toEqual(loc.tags);
    expect(result?.darkSky).toBe(loc.darkSky);
    expect(result?.hookLine).toBe('Autumn colour fills the gorge.');
    expect(result?.confidence).toBe(0.8);
  });

  it('correctly identifies a dark sky location', () => {
    const result = resolveSpurSuggestion({ locationName: 'Wastwater', hookLine: 'Exceptional dark sky with mountain reflections.', confidence: 0.9 });
    expect(result?.darkSky).toBe(true);
  });

  it('correctly identifies a non-dark-sky location', () => {
    const result = resolveSpurSuggestion({ locationName: 'Mam Tor', hookLine: 'Dramatic ridge walk above the Hope Valley.', confidence: 0.75 });
    expect(result?.darkSky).toBe(false);
  });
});

describe('normalizeAiText — decimal spacing fix (#108)', () => {
  it('fixes "X. Y" decimal spacing from AI output (the main bug case)', () => {
    expect(normalizeAiText('Visibility drops to 20. 5km through the window.')).toBe('Visibility drops to 20.5km through the window.');
  });

  it('fixes a decimal that falls at the sentence splitter boundary', () => {
    expect(normalizeAiText('Vis 20. 5km tonight. Darker skies after moonset.')).toBe('Vis 20.5km tonight. Darker skies after moonset.');
  });

  it('does not alter a correctly formatted decimal', () => {
    expect(normalizeAiText('Expect 18.3km visibility at the peak hour.')).toBe('Expect 18.3km visibility at the peak hour.');
  });

  it('does not alter sentence-ending periods before words', () => {
    expect(normalizeAiText('The window opens at 20:00. Conditions improve overnight.')).toBe('The window opens at 20:00. Conditions improve overnight.');
  });

  it('does not alter sentence-ending periods before capital letters', () => {
    expect(normalizeAiText('Good conditions tonight. Tomorrow looks clearer.')).toBe('Good conditions tonight. Tomorrow looks clearer.');
  });

  it('returns (No AI summary) for empty input', () => {
    expect(normalizeAiText('')).toBe('(No AI summary)');
  });
});

describe('resolveSpurSuggestion — nearby alt deduplication', () => {
  it('drops the spur when its location is already in nearbyAltNames', () => {
    const result = resolveSpurSuggestion(
      { locationName: 'Aysgarth Falls', hookLine: 'Autumn colour.', confidence: 0.85 },
      ['Aysgarth Falls'],
    );
    expect(result).toBeNull();
  });

  it('resolves the spur when it is not in nearbyAltNames', () => {
    const result = resolveSpurSuggestion(
      { locationName: 'Aysgarth Falls', hookLine: 'Autumn colour.', confidence: 0.85 },
      ['Mam Tor', 'Sutton Bank'],
    );
    expect(result).not.toBeNull();
    expect(result?.locationName).toBe('Aysgarth Falls');
  });

  it('resolves the spur when nearbyAltNames is empty', () => {
    const result = resolveSpurSuggestion(
      { locationName: 'Aysgarth Falls', hookLine: 'Autumn colour.', confidence: 0.85 },
      [],
    );
    expect(result).not.toBeNull();
  });

  it('resolves the spur when nearbyAltNames is not provided', () => {
    const result = resolveSpurSuggestion(
      { locationName: 'Aysgarth Falls', hookLine: 'Autumn colour.', confidence: 0.85 },
    );
    expect(result).not.toBeNull();
  });

  it('drops the spur when the long-range scoring pool already rejected that location', () => {
    const result = resolveSpurSuggestion(
      { locationName: 'Aysgarth Falls', hookLine: 'Autumn colour.', confidence: 0.85 },
      [],
      [{ name: 'Aysgarth Falls', shown: false, discardedReason: 'does not beat Leeds by 10 points (50 vs 42)' }],
    );
    expect(result).toBeNull();
  });
});

describe('run — weekStandout validation', () => {
  const makeDay = (
    dayLabel: string,
    dayIdx: number,
    headlineScore: number,
    confidence: 'high' | 'medium' | 'low',
    confidenceStdDev: number,
  ) => ({
    dayLabel,
    dateKey: `2026-03-${String(16 + dayIdx).padStart(2, '0')}`,
    dayIdx,
    photoScore: headlineScore,
    headlineScore,
    photoEmoji: 'Good',
    amScore: 30,
    pmScore: 35,
    astroScore: headlineScore,
    confidence,
    confidenceStdDev,
    amConfidence: confidence,
    pmConfidence: confidence,
    bestPhotoHour: '21:00',
    bestTags: 'astrophotography',
    carWash: {
      rating: 'OK',
      label: 'Usable',
      score: 60,
      start: '06:00',
      end: '08:00',
      wind: 10,
      pp: 10,
      tmp: 8,
    },
  });

  const makeRuntimeOutput = (weekStandout: string | undefined, dailySummary = [
    makeDay('Today', 0, 60, 'high', 5),
    makeDay('Tomorrow', 1, 55, 'medium', 15),
    makeDay('Wednesday', 2, 70, 'low', 39),
    makeDay('Thursday', 3, 45, 'medium', 12),
    makeDay('Friday', 4, 50, 'medium', 18),
  ]) => {
    const content = JSON.stringify({
      editorial: 'Conditions improve through the evening astro window toward 21:00. Clearer skies hold into the best hour.',
      composition: ['Frame the skyline against the western glow'],
      ...(weekStandout !== undefined ? { weekStandout } : {}),
    });

    return run({
      $input: {
        first: () => ({
          json: {
            choices: [{ message: { content } }],
            dontBother: false,
            debugMode: true,
            debugModeSource: 'debug recipient configured',
            debugEmailTo: 'debug@example.com',
            windows: [{
              label: 'Evening astro window',
              start: '19:00',
              end: '21:00',
              peak: 60,
              tops: ['astrophotography'],
              hours: [{ hour: '21:00', score: 60 }],
            }],
            dailySummary,
            todayCarWash: {
              rating: 'OK',
              label: 'Usable',
              score: 60,
              start: '06:00',
              end: '08:00',
              wind: 10,
              pp: 10,
              tmp: 8,
            },
            altLocations: [],
            sunriseStr: '06:18',
            sunsetStr: '18:11',
            moonPct: 8,
            metarNote: '',
            debugContext: {
              metadata: {
                generatedAt: '2026-03-16T12:00:00.000Z',
                timezone: 'Europe/London',
              },
              hourlyScoring: [],
              windows: [],
              nearbyAlternatives: [],
            },
            today: 'Monday 16 March',
            todayBestScore: 60,
            shSunsetQ: null,
            shSunriseQ: null,
            shSunsetText: null,
            sunDir: null,
            crepPeak: 0,
          },
        }),
        all: () => [],
      },
      $: () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
    })[0].json as {
      briefJson: {
        schemaVersion: string;
        location: { name: string | null };
        aiText: string;
        weekInsight?: string;
      };
      emailHtml: string;
      siteHtml: string;
      debugEmailHtml: string;
    };
  };

  it('keeps a valid raw weekStandout that matches the strongest day', () => {
    const result = makeRuntimeOutput('Wednesday is the standout day.', [
      makeDay('Today', 0, 60, 'high', 12),
      makeDay('Tomorrow', 1, 55, 'medium', 15),
      makeDay('Wednesday', 2, 70, 'medium', 16),
      makeDay('Thursday', 3, 45, 'medium', 12),
      makeDay('Friday', 4, 50, 'medium', 18),
    ]);

    expect(result.emailHtml).toContain('Wednesday is the standout day.');
    expect(result.debugEmailHtml).toContain('present in raw response → matched deterministic result: &quot;Wednesday is the standout day.&quot;');
  });

  it('returns the canonical briefJson payload for downstream consumers', () => {
    const result = makeRuntimeOutput('Wednesday is the standout day.', [
      makeDay('Today', 0, 60, 'high', 12),
      makeDay('Tomorrow', 1, 55, 'medium', 15),
      makeDay('Wednesday', 2, 70, 'medium', 16),
      makeDay('Thursday', 3, 45, 'medium', 12),
      makeDay('Friday', 4, 50, 'medium', 18),
    ]);

    expect(result.briefJson.schemaVersion).toBe(BRIEF_JSON_SCHEMA_VERSION);
    expect(result.briefJson.location.name).toBe('Leeds');
    expect(result.briefJson.aiText).toContain('Conditions improve through the evening astro window');
    expect(result.briefJson.weekInsight).toBe('Wednesday is the standout day.');
  });

  it('keeps daylight utility glyphs entity-encoded in assembled html outputs', () => {
    const result = makeRuntimeOutput('Wednesday is the standout day.');

    expect(result.emailHtml).toContain('&#x1F697; / &#x1F6B6;');
    expect(result.emailHtml).not.toContain('🚗 / 🚶');
    expect(result.emailHtml).not.toContain('��');

    const siteResult = run({
      $input: {
        first: () => ({
          json: {
            choices: [{ message: { content: JSON.stringify({
              editorial: 'Conditions improve through the evening astro window toward 21:00. Clearer skies hold into the best hour.',
              composition: ['Frame the skyline against the western glow'],
              weekStandout: 'Wednesday is the standout day.',
            }) } }],
            dontBother: false,
            debugMode: true,
            debugModeSource: 'debug recipient configured',
            debugEmailTo: 'debug@example.com',
            windows: [{
              label: 'Evening astro window',
              start: '19:00',
              end: '21:00',
              peak: 60,
              tops: ['astrophotography'],
              hours: [{ hour: '21:00', score: 60 }],
            }],
            dailySummary: [
              makeDay('Today', 0, 60, 'high', 5),
              makeDay('Tomorrow', 1, 55, 'medium', 15),
              makeDay('Wednesday', 2, 70, 'low', 39),
            ],
            todayCarWash: {
              rating: 'OK',
              label: 'Usable',
              score: 60,
              start: '06:00',
              end: '08:00',
              wind: 10,
              pp: 10,
              tmp: 8,
            },
            altLocations: [],
            sunriseStr: '06:18',
            sunsetStr: '18:11',
            moonPct: 8,
            metarNote: '',
            debugContext: {
              metadata: {
                generatedAt: '2026-03-16T05:00:00.000Z',
                timezone: 'Europe/London',
              },
              hourlyScoring: [],
              windows: [],
              nearbyAlternatives: [],
            },
            today: 'Monday 16 March',
            todayBestScore: 60,
            shSunsetQ: null,
            shSunriseQ: null,
            shSunsetText: null,
            sunDir: null,
            crepPeak: 0,
          },
        }),
        all: () => [],
      },
      $: () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
    })[0].json as {
      siteHtml: string;
    };

    expect(siteResult.siteHtml).toContain('&#x1F697; / &#x1F6B6;');
    expect(siteResult.siteHtml).not.toContain('🚗 / 🚶');
    expect(siteResult.siteHtml).not.toContain('��');
  });

  it('replaces a semantically wrong weekStandout with the reliability fallback', () => {
    const result = makeRuntimeOutput('Wednesday is most reliable.');

    expect(result.emailHtml).toContain('Today is the most reliable forecast; Wednesday may score higher but with much lower certainty.');
    expect(result.emailHtml).not.toContain('Wednesday is most reliable.');
    expect(result.debugEmailHtml).toContain('ignored in favour of deterministic result');
    expect(result.debugEmailHtml).toContain('model hint did not identify today as the reliable lead');
  });

  it('accepts weekStandout naming an equally-scored day with lower certainty (#223)', () => {
    // Reproduces the scenario: Tomorrow and Saturday both score 63,
    // but Saturday has much lower certainty. The AI correctly names
    // Saturday even though sort-order would pick Tomorrow.
    const result = makeRuntimeOutput(
      'Today is the most reliable forecast; Saturday may score higher but with much lower certainty',
      [
        makeDay('Today', 0, 55, 'high', 5),
        makeDay('Tomorrow', 1, 63, 'medium', 19),
        makeDay('Friday', 2, 52, 'medium', 16),
        makeDay('Saturday', 3, 63, 'low', 35),
        makeDay('Sunday', 4, 48, 'low', 28),
      ],
    );

    expect(result.emailHtml).toContain('Today is the most reliable forecast; Saturday may score higher but with much lower certainty');
    expect(result.debugEmailHtml).toContain('present in raw response → matched deterministic result');
  });

  it('keeps composition bullets and spur output when editorial text falls back to the template', () => {
    const content = JSON.stringify({
      editorial: 'Conditions stay clean tonight.',
      composition: [
        'Frame the canal bridge under the clearest western sky',
        'Keep a low roofline below the darkest part of the slot',
      ],
      weekStandout: 'Wednesday is the standout day.',
      spurOfTheMoment: {
        locationName: 'Aysgarth Falls',
        hookLine: 'Soft overcast and full flow make the falls worth the drive today.',
        confidence: 0.8,
      },
    });

    const result = run({
      $input: {
        first: () => ({
          json: {
            choices: [{ message: { content } }],
            dontBother: false,
            debugMode: true,
            debugModeSource: 'debug recipient configured',
            debugEmailTo: 'debug@example.com',
            windows: [{
              label: 'Evening astro window',
              start: '19:00',
              end: '21:00',
              peak: 60,
              tops: ['astrophotography'],
              hours: [{ hour: '21:00', score: 60 }],
            }],
            dailySummary: [
              makeDay('Today', 0, 60, 'high', 12),
              makeDay('Tomorrow', 1, 55, 'medium', 15),
              makeDay('Wednesday', 2, 70, 'medium', 16),
            ],
            todayCarWash: {
              rating: 'OK',
              label: 'Usable',
              score: 60,
              start: '06:00',
              end: '08:00',
              wind: 10,
              pp: 10,
              tmp: 8,
            },
            altLocations: [],
            debugContext: {
              metadata: {
                generatedAt: '2026-03-16T12:00:00.000Z',
                timezone: 'Europe/London',
              },
              hourlyScoring: [],
              windows: [],
              nearbyAlternatives: [],
            },
            sunriseStr: '06:18',
            sunsetStr: '18:11',
            moonPct: 8,
            metarNote: '',
            today: 'Monday 16 March',
            todayBestScore: 60,
            shSunsetQ: null,
            shSunriseQ: null,
            shSunsetText: null,
            sunDir: null,
            crepPeak: 0,
          },
        }),
        all: () => [],
      },
      $: () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
    })[0].json as {
      emailHtml: string;
      debugEmailHtml: string;
    };

    expect(result.emailHtml).toContain('Frame the canal bridge under the clearest western sky');
    expect(result.emailHtml).toContain('Soft overcast and full flow make the falls worth the drive today.');
    expect(result.debugEmailHtml).toContain('Editorial check:</span> Failed (editorial must contain two sentences');
    expect(result.debugEmailHtml).toContain('does not reference the chosen local window');
    expect(result.debugEmailHtml).toContain('Aysgarth Falls (0.8)');
  });

  it('drops a spur suggestion when the location was already scored in the nearby alternatives pool', () => {
    const content = JSON.stringify({
      editorial: 'Leeds is not worth it today due to poor conditions. Consider Brimham Rocks instead.',
      composition: [],
      weekStandout: 'Wednesday is most reliable, with Thursday scoring higher.',
      spurOfTheMoment: {
        locationName: 'Ribblehead Viaduct',
        hookLine: 'Misty dawn at the viaduct',
        confidence: 0.8,
      },
    });

    const result = run({
      $input: {
        first: () => ({
          json: {
            choices: [{ message: { content } }],
            dontBother: true,
            debugMode: true,
            debugModeSource: 'debug recipient configured',
            debugEmailTo: 'debug@example.com',
            windows: [],
            dailySummary: [
              makeDay('Today', 0, 42, 'high', 5),
              makeDay('Tomorrow', 1, 62, 'high', 11),
              makeDay('Wednesday', 2, 67, 'low', 31),
            ],
            todayCarWash: {
              rating: 'OK',
              label: 'Usable',
              score: 60,
              start: '06:00',
              end: '08:00',
              wind: 12,
              pp: 22,
              tmp: 5,
            },
            altLocations: [{
              name: 'Brimham Rocks',
              bestScore: 81,
              bestAstroHour: '02:00',
              darkSky: false,
              driveMins: 40,
            }],
            debugContext: {
              hourlyScoring: [],
              windows: [],
              nearbyAlternatives: [{
                name: 'Ribblehead Viaduct',
                rank: 5,
                shown: false,
                bestScore: 26,
                dayScore: 8,
                astroScore: 26,
                driveMins: 55,
                bortle: 4,
                darknessScore: 63,
                darknessDelta: 38,
                weatherDelta: -16,
                deltaVsWindowPeak: null,
                discardedReason: 'astro score below threshold (26 < 60)',
              }],
            },
            sunriseStr: '06:18',
            sunsetStr: '18:11',
            moonPct: 8,
            metarNote: '',
            today: 'Monday 16 March',
            todayBestScore: 42,
            shSunsetQ: null,
            shSunriseQ: null,
            shSunsetText: null,
            sunDir: null,
            crepPeak: 0,
          },
        }),
        all: () => [],
      },
      $: () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
    })[0].json as {
      emailHtml: string;
      debugEmailHtml: string;
    };

    expect(result.emailHtml).not.toContain('Misty dawn at the viaduct');
    expect(result.debugEmailHtml).toContain('Ribblehead Viaduct (0.8) → dropped: already scored in nearby alternatives');
    expect(result.debugEmailHtml).not.toContain('Resolved spur:</span> Ribblehead Viaduct');
  });

  it('drops a spur suggestion when the long-range pool already rejected that location', () => {
    const content = JSON.stringify({
      editorial: 'Leeds is not ideal today due to poor conditions. Brimham Rocks is a better alternative.',
      composition: [],
      weekStandout: 'Today is the most reliable forecast; Wednesday may score higher but with much lower certainty',
      spurOfTheMoment: {
        locationName: 'Aysgarth Falls',
        hookLine: 'Frozen waterfalls in early spring',
        confidence: 0.8,
      },
    });

    const result = run({
      $input: {
        first: () => ({
          json: {
            choices: [{ message: { content } }],
            dontBother: true,
            debugMode: true,
            debugModeSource: 'debug recipient configured',
            debugEmailTo: 'debug@example.com',
            windows: [],
            dailySummary: [
              makeDay('Today', 0, 42, 'high', 5),
              makeDay('Tomorrow', 1, 50, 'medium', 12),
              makeDay('Wednesday', 2, 57, 'medium', 22),
            ],
            todayCarWash: {
              rating: 'OK',
              label: 'Usable',
              score: 60,
              start: '06:00',
              end: '08:00',
              wind: 12,
              pp: 22,
              tmp: 5,
            },
            altLocations: [{
              name: 'Brimham Rocks',
              bestScore: 81,
              bestAstroHour: '02:00',
              darkSky: false,
              driveMins: 40,
            }],
            longRangeDebugCandidates: [{
              name: 'Goathland',
              region: 'north-york-moors',
              tags: ['waterfall', 'moorland'],
              bestScore: 88,
              dayScore: 28,
              astroScore: 88,
              driveMins: 80,
              darkSky: true,
              rank: 1,
              deltaVsHome: 46,
              shown: true,
            }, {
              name: 'Aysgarth Falls',
              region: 'yorkshire-dales',
              tags: ['waterfall', 'woodland'],
              bestScore: 50,
              dayScore: 16,
              astroScore: 50,
              driveMins: 51,
              darkSky: false,
              rank: 14,
              deltaVsHome: 8,
              shown: false,
              discardedReason: 'does not beat Leeds by 10 points (50 vs 42)',
            }],
            debugContext: {
              hourlyScoring: [],
              windows: [],
              nearbyAlternatives: [],
            },
            sunriseStr: '06:18',
            sunsetStr: '18:11',
            moonPct: 8,
            metarNote: '',
            today: 'Monday 16 March',
            todayBestScore: 42,
            shSunsetQ: null,
            shSunriseQ: null,
            shSunsetText: null,
            sunDir: null,
            crepPeak: 0,
          },
        }),
        all: () => [],
      },
      $: () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
    })[0].json as {
      emailHtml: string;
      debugEmailHtml: string;
    };

    expect(result.emailHtml).not.toContain('Frozen waterfalls in early spring');
    expect(result.debugEmailHtml).toContain('Aysgarth Falls (0.8) → dropped: long-range candidate rejected: does not beat Leeds by 10 points (50 vs 42)');
    expect(result.debugEmailHtml).not.toContain('Resolved spur:</span> Aysgarth Falls');
  });
});

describe('run — model fallback reporting (#74)', () => {
  it('reports model fallback when primary fails and secondary succeeds', () => {
    // Gemini (primary) gives a truncated/bad response; Groq (secondary) passes
    const groqContent = JSON.stringify({
      editorial: 'Conditions stay clean through the midnight astro window. The 03:00 peak sits under the darkest patch of sky tonight.',
      composition: ['Face north with a low tree line for any aurora glow'],
    });
    const geminiContent = '{"editorial": "The moon sets before the Midnight astro window begins at 00:';  // truncated

    const result = run({
      $input: {
        first: () => ({
          json: {
            choices: [{ message: { content: groqContent } }],
            geminiResponse: geminiContent,
            geminiStatusCode: 200,
            geminiFinishReason: 'MAX_TOKENS',
            geminiCandidateCount: 1,
            geminiResponseByteLength: 382,
            geminiResponseTruncated: true,
            dontBother: false,
            debugMode: true,
            debugModeSource: 'debug recipient configured',
            debugEmailTo: 'debug@example.com',
            windows: [{
              label: 'Midnight astro window',
              start: '00:00',
              end: '04:00',
              peak: 56,
              tops: ['astrophotography'],
              hours: [{ hour: '03:00', score: 56 }],
            }],
            dailySummary: [{
              dayLabel: 'Today',
              dayIdx: 0,
              headlineScore: 56,
              photoScore: 56,
              confidence: 'high',
              confidenceStdDev: 5,
              bestPhotoHour: '03:00',
              astroScore: 68,
              bestAstroHour: '03:00',
              darkSkyStartsAt: '00:00',
            }],
            altLocations: [],
            todayCarWash: {
              rating: 'OK',
              label: 'Usable',
              score: 60,
              start: '06:00',
              end: '08:00',
              wind: 10,
              pp: 10,
              tmp: 8,
            },
            sunriseStr: '06:18',
            sunsetStr: '18:11',
            moonPct: 8,
            metarNote: '',
            today: 'Monday 16 March',
            todayBestScore: 56,
            peakKpTonight: 6.3,
            shSunsetQ: null,
            shSunriseQ: null,
            shSunsetText: null,
            sunDir: null,
            crepPeak: 0,
          },
        }),
        all: () => [],
      },
      $: () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
    })[0].json as { debugEmailHtml: string };

    expect(result.debugEmailHtml).toContain('Model fallback');
    expect(result.debugEmailHtml).toContain('Primary rejection');
    expect(result.debugEmailHtml).toContain('Yes — gemini rejected:');
    expect(result.debugEmailHtml).toContain('response truncated (MAX_TOKENS)');
    expect(result.debugEmailHtml).toContain('used groq');
    expect(result.debugEmailHtml).not.toContain('gemini failed, used groq');
    expect(result.debugEmailHtml).toContain('Hardcoded fallback');
    expect(result.debugEmailHtml).toContain('Gemini HTTP status');
    expect(result.debugEmailHtml).toContain('MAX_TOKENS');
    expect(result.debugEmailHtml).toContain('Gemini truncation signal');
  });
});
