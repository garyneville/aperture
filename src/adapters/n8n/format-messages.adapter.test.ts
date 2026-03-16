import { describe, expect, it } from 'vitest';
import { buildFallbackAiText, isFactuallyIncoherentEditorial, normalizeAiText, shouldReplaceAiText, parseGroqResponse, resolveSpurSuggestion } from './format-messages.adapter.js';
import { LONG_RANGE_LOCATIONS, estimatedDriveMins } from '../../core/long-range-locations.js';

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
      dailySummary: [{ bestPhotoHour: '07:00', astroScore: 55, bestAstroHour: '07:00' }],
      altLocations: [],
    };

    const text = buildFallbackAiText(morningCtx);
    expect(text).toContain('Peak astro sub-score is 55/100 at 07:00, with the final window score at 36/100 after full weighting.');
    expect(text).not.toContain('evening');
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

  it('does not flag a coherent editorial with the alt in the second sentence', () => {
    const coherentText = 'Local peak is around 20:00 in the evening astro window. Sutton Bank is 30 points stronger thanks to darker skies.';
    expect(isFactuallyIncoherentEditorial(coherentText, marchCtx)).toBe(false);
  });

  it('shouldReplaceAiText returns true for the 15 March hallucination', () => {
    const hallucinatedText = 'Leeds has the Sutton Bank window from 20:00, scoring 85. Sutton Bank is 85 points stronger mainly because of darker skies around 20:00.';
    expect(shouldReplaceAiText(hallucinatedText, marchCtx)).toBe(true);
  });

  it('shouldReplaceAiText returns false for a coherent editorial that passes keyword heuristics', () => {
    const coherentText = 'Local peak is around 20:00 in the evening astro window. Sutton Bank is 30 points stronger thanks to darker skies if you can make the drive.';
    expect(shouldReplaceAiText(coherentText, marchCtx)).toBe(false);
  });
});

describe('parseGroqResponse — spurOfTheMoment', () => {
  it('extracts spurRaw when all required fields are present', () => {
    const raw = JSON.stringify({
      editorial: 'Good conditions today.',
      composition: ['Shot idea 1', 'Shot idea 2'],
      weekStandout: 'Thursday looks best.',
      spurOfTheMoment: { locationName: 'Aysgarth Falls', hookLine: 'Overcast light is perfect for waterfalls without harsh shadows.', confidence: 0.85 },
    });
    const result = parseGroqResponse(raw);
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
    expect(parseGroqResponse(raw).spurRaw).toEqual({
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
    expect(parseGroqResponse(raw).spurRaw).toBeNull();
  });

  it('returns null spurRaw when spurOfTheMoment key is absent', () => {
    const raw = JSON.stringify({ editorial: 'Good.', composition: [], weekStandout: 'Today.' });
    expect(parseGroqResponse(raw).spurRaw).toBeNull();
  });

  it('still extracts editorial and composition when spurOfTheMoment is absent', () => {
    const raw = JSON.stringify({ editorial: 'Fine day.', composition: ['Idea A'], weekStandout: 'Friday.' });
    const result = parseGroqResponse(raw);
    expect(result.editorial).toBe('Fine day.');
    expect(result.compositionBullets).toEqual(['Idea A']);
    expect(result.weekInsight).toBe('Friday.');
  });
});

describe('parseGroqResponse — weekStandout parse status', () => {
  it('reports present status and raw value when weekStandout is in the response', () => {
    const raw = JSON.stringify({ editorial: 'Good.', composition: [], weekStandout: 'Wednesday is the standout day.' });
    const result = parseGroqResponse(raw);
    expect(result.weekStandoutParseStatus).toBe('present');
    expect(result.weekStandoutRawValue).toBe('Wednesday is the standout day.');
    expect(result.weekInsight).toBe('Wednesday is the standout day.');
  });

  it('reports absent status when weekStandout is missing from a valid JSON response', () => {
    const raw = JSON.stringify({ editorial: 'Good.', composition: [] });
    const result = parseGroqResponse(raw);
    expect(result.weekStandoutParseStatus).toBe('absent');
    expect(result.weekStandoutRawValue).toBeNull();
    expect(result.weekInsight).toBe('');
  });

  it('reports absent status when weekStandout is not a string', () => {
    const raw = JSON.stringify({ editorial: 'Good.', composition: [], weekStandout: 42 });
    const result = parseGroqResponse(raw);
    expect(result.weekStandoutParseStatus).toBe('absent');
    expect(result.weekStandoutRawValue).toBeNull();
  });

  it('reports parse-failure status when the response is not valid JSON', () => {
    const result = parseGroqResponse('Not JSON at all.');
    expect(result.weekStandoutParseStatus).toBe('parse-failure');
    expect(result.weekStandoutRawValue).toBeNull();
    expect(result.weekInsight).toBe('');
  });

  it('strips Markdown code fences and successfully parses weekStandout', () => {
    const inner = JSON.stringify({ editorial: 'Good.', composition: [], weekStandout: 'Friday is best.' });
    const fenced = `\`\`\`json\n${inner}\n\`\`\``;
    const result = parseGroqResponse(fenced);
    expect(result.weekStandoutParseStatus).toBe('present');
    expect(result.weekStandoutRawValue).toBe('Friday is best.');
    expect(result.weekInsight).toBe('Friday is best.');
  });

  it('strips plain Markdown code fences (no language tag) and parses weekStandout', () => {
    const inner = JSON.stringify({ editorial: 'Good.', composition: [], weekStandout: 'Saturday is clearest.' });
    const fenced = `\`\`\`\n${inner}\n\`\`\``;
    const result = parseGroqResponse(fenced);
    expect(result.weekStandoutParseStatus).toBe('present');
    expect(result.weekStandoutRawValue).toBe('Saturday is clearest.');
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
  it('fixes "X. Y" decimal spacing artifact from AI output (the bug case)', () => {
    // Groq sometimes echoes "20. 5km" treating the decimal point as a sentence end.
    expect(normalizeAiText('Visibility drops to 20. 5km through the window.')).toBe('Visibility drops to 20.5km through the window.');
  });

  it('fixes decimal at a sentence-splitter boundary', () => {
    // The sentence regex splits on any "."; "18.3km" becomes ["Tonight reaches 18.", "3km ..."].
    // When rejoined the decimal fix must restore the original value.
    expect(normalizeAiText('Tonight reaches 18. 3km visibility making this a solid astro night.')).toBe('Tonight reaches 18.3km visibility making this a solid astro night.');
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
