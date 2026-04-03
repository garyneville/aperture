import { describe, expect, it } from 'vitest';
import { formatDebugEmail } from './format-email.js';
import type { DebugContext } from './debug-context.js';

describe('formatDebugEmail', () => {
  it('renders the structured debug sections for a traced run', () => {
    const html = formatDebugEmail({
      metadata: {
        generatedAt: '2026-03-16T12:00:00.000Z',
        location: 'Leeds',
        latitude: 53.8,
        longitude: -1.57,
        timezone: 'Europe/London',
        workflowVersion: 'debug-trace-v1',
        triggerSource: 'github-actions-deploy',
        debugModeEnabled: true,
        debugModeSource: 'workflow toggle',
        debugRecipient: 'debug@example.com',
      },
      scores: {
        am: 32,
        pm: 15,
        astro: 75,
        overall: 60,
        bestSession: {
          session: 'storm',
          hour: '19:00',
          score: 84,
          confidence: 'high',
          volatility: 18,
        },
        certainty: 'medium',
        certaintySpread: 5,
        astroConfidence: 'high',
        astroConfidenceStdDev: 8,
      },
      hourlyScoring: [{
        hour: '04:00',
        timestamp: '2026-03-16T04:00:00.000Z',
        final: 72,
        cloud: 5,
        visK: 20.5,
        aod: 0.11,
        moonAdjustment: 30,
        moonState: 'Down',
        aodPenalty: 1,
        astroScore: 72,
        drama: 0,
        clarity: 0,
        mist: 0,
        moon: { altitudeDeg: -2, illuminationPct: 8, azimuthDeg: null, isUp: false },
        sessionScores: [
          { session: 'astro', score: 72, hardPass: true, confidence: 'high', volatility: 6, reasons: ['Cloud cover is low enough for a plausible dark-sky run.'], warnings: [] },
          { session: 'mist', score: 12, hardPass: false, confidence: 'low', volatility: 6, reasons: [], warnings: ['Air looks quite clear for a dedicated mist session.'] },
        ],
        tags: ['astrophotography'],
      }],
      windows: [{
        label: 'Overnight astro window',
        start: '04:00',
        end: '06:00',
        peak: 60,
        rank: 1,
        selected: true,
        fallback: false,
        selectionReason: 'selected as the highest-scoring local window',
        darkPhaseStart: '04:45',
        postMoonsetScore: 72,
      }],
      nearbyAlternatives: [{
        name: 'Sutton Bank',
        rank: 1,
        shown: true,
        bestScore: 85,
        dayScore: 30,
        astroScore: 85,
        driveMins: 75,
        bortle: 3,
        darknessScore: 75,
        darknessDelta: 50,
        weatherDelta: 25,
        deltaVsWindowPeak: 25,
      }],
      ai: {
        primaryProvider: 'gemini',
        selectedProvider: 'gemini',
        rawGroqResponse: '{"editorial":"Good night."}',
        rawGeminiResponse: '{"editorial":"Good night.","composition":["Low northern horizon"]}',
        rawGeminiPayload: '{"candidates":[{"content":{"parts":[{"text":"{\\"editorial\\":\\"Good night.\\"}","thoughtSignature":"sig"}]}}],"usageMetadata":{"thoughtsTokenCount":261}}',
        geminiDiagnostics: {
          statusCode: 200,
          finishReason: 'MAX_TOKENS',
          candidateCount: 1,
          responseByteLength: 812,
          truncated: true,
          extractionPath: 'item.body.data',
          topLevelKeys: ['statusCode', 'body'],
          payloadKeys: ['candidates', 'usageMetadata'],
          partKinds: ['text', 'thoughtSignature'],
          extractedTextLength: 55,
          promptTokenCount: 8,
          candidatesTokenCount: 11,
          totalTokenCount: 280,
          thoughtsTokenCount: 261,
        },
        normalizedAiText: 'Good night.',
        factualCheck: { passed: true, rulesTriggered: [] },
        editorialCheck: { passed: false, rulesTriggered: ['does not add editorial insight beyond card data'] },
        spurSuggestion: {
          raw: 'Kielder Forest (0.65)',
          confidence: 0.65,
          resolved: null,
          dropped: true,
          dropReason: 'confidence below threshold (0.65)',
        },
        weekStandout: {
          parseStatus: 'absent',
          rawValue: null,
          used: false,
          decision: 'fallback-used',
          finalValue: 'Today is the most reliable forecast; Wednesday may score higher but with much lower certainty.',
          fallbackReason: 'missing weekStandout value',
        },
        fallbackUsed: true,
        modelFallbackUsed: false,
        finalAiText: 'Local peak is around 04:00 in the overnight astro window.',
      },
      payloadSnapshots: [
        {
          label: 'Score input payload',
          byteLength: 128,
          json: '{"weather":{"hourly":{"time":["2026-03-16T04:00:00.000Z"]}}}',
        },
      ],
    });

    expect(html).toContain('Run metadata');
    expect(html).toContain('Day scores and certainty');
    expect(html).toContain('Best session today');
    expect(html).toContain('Storm (84/100 at 19:00)');
    expect(html).toContain('Best session volatility');
    expect(html).toContain('Certainty (daylight)');
    expect(html).toContain('Certainty (astro)');
    expect(html).toContain('Spread (daylight)');
    expect(html).toContain('Spread (astro)');
    expect(html).toContain('Fair');
    expect(html).not.toContain('>medium<');
    expect(html).toContain('Window selection trace');
    expect(html).toContain('Hourly scoring trace');
    expect(html).toContain('Nearby alternatives');
    expect(html).toContain('Δ vs Home');
    expect(html).toContain('Δ vs window');
    expect(html).toContain('AI editorial trace');
    expect(html).toContain('debug@example.com');
    expect(html).toContain('Overnight astro window');
    expect(html).toContain('Sutton Bank');
    expect(html).toContain('confidence below threshold');
    expect(html).toContain('weekStandout');
    expect(html).toContain('absent from raw response');
    expect(html).toContain('Model fallback');
    expect(html).toContain('Hardcoded fallback');
    expect(html).toContain('Gemini HTTP status');
    expect(html).toContain('MAX_TOKENS');
    expect(html).toContain('Gemini response bytes');
    expect(html).toContain('Gemini extraction path');
    expect(html).toContain('Gemini thoughts tokens');
    expect(html).toContain('Raw Gemini payload');
    expect(html).toContain('Gemini truncation signal');
    expect(html).toContain('Payload snapshots');
    expect(html).toContain('Score input payload');
    expect(html).toContain('Astro 72/100 (high, vol 6)');
    expect(html).toContain('Mist 12/100 gated (low, vol 6)');
  });
});

describe('formatDebugEmail — new debug sections', () => {
  const baseDebugContext: DebugContext = {
    metadata: {
      generatedAt: '2026-03-16T12:00:00.000Z',
      location: 'Leeds',
      latitude: 53.8,
      longitude: -1.57,
      timezone: 'Europe/London',
      workflowVersion: null,
      triggerSource: 'schedule',
      debugModeEnabled: true,
      debugModeSource: 'workflow toggle',
      debugRecipient: 'debug@example.com',
    },
    scores: {
      am: 30,
      pm: 40,
      astro: 75,
      overall: 60,
      certainty: 'medium',
      certaintySpread: 5,
      astroConfidence: 'unknown',
      astroConfidenceStdDev: null,
    },
    hourlyScoring: [],
    windows: [],
    nearbyAlternatives: [],
  };

  it('renders long-range pool section with candidate rows', () => {
    const html = formatDebugEmail({
      ...baseDebugContext,
      longRangeCandidates: [
        { name: 'Kielder Forest', region: 'northumberland', tags: ['dark-sky', 'forest'], bestScore: 91, dayScore: 40, astroScore: 91, driveMins: 120, darkSky: true, rank: 1, deltaVsHome: 31, shown: true },
        { name: 'Whernside', region: 'yorkshire-dales', tags: ['moorland'], bestScore: 79, dayScore: 79, astroScore: 30, driveMins: 55, darkSky: false, rank: 2, deltaVsHome: 19, shown: false, discardedReason: 'eligible pool candidate behind Kielder Forest' },
      ],
    });
    expect(html).toContain('Long-range pool');
    expect(html).toContain('Kielder Forest');
    expect(html).toContain('Whernside');
    expect(html).toContain('northumberland');
    expect(html).toContain('eligible pool candidate behind Kielder Forest');
  });

  it('shows the explicit primary rejection reason when a secondary model is selected', () => {
    const html = formatDebugEmail({
      ...baseDebugContext,
      ai: {
        primaryProvider: 'gemini',
        selectedProvider: 'groq',
        primaryRejectionReason: 'response truncated (MAX_TOKENS); editorial validation failed: editorial must contain two sentences',
        secondaryRejectionReason: null,
        rawGroqResponse: '{"editorial":"Conditions hold through the astro window.","composition":["Face north with a low tree line"]}',
        rawGeminiResponse: '{"editorial":"The moon sets before the midnight astro window begins at 00:',
        rawGeminiPayload: '{"body":{"data":{"candidates":[{"content":{"parts":[{"text":"truncated"}]}}]}}}',
        geminiDiagnostics: {
          statusCode: 200,
          finishReason: 'MAX_TOKENS',
          candidateCount: 1,
          responseByteLength: 382,
          truncated: true,
          extractionPath: 'item.body.data',
          thoughtsTokenCount: 704,
        },
        normalizedAiText: 'Conditions hold through the astro window.',
        factualCheck: { passed: true, rulesTriggered: [] },
        editorialCheck: { passed: true, rulesTriggered: [] },
        spurSuggestion: {
          raw: null,
          confidence: null,
          resolved: null,
          dropped: false,
        },
        weekStandout: {
          parseStatus: 'absent',
          rawValue: null,
          used: false,
          decision: 'fallback-used',
          finalValue: 'Today is the most reliable forecast.',
          fallbackReason: 'missing weekStandout value',
        },
        fallbackUsed: false,
        modelFallbackUsed: true,
        finalAiText: 'Conditions hold through the astro window.',
      },
    });

    expect(html).toContain('Primary rejection');
    expect(html).toContain('response truncated (MAX_TOKENS)');
    expect(html).toContain('editorial validation failed: editorial must contain two sentences');
    expect(html).toContain('Model fallback');
    expect(html).toContain('Yes — gemini rejected: response truncated (MAX_TOKENS); editorial validation failed: editorial must contain two sentences; used groq');
    expect(html).toContain('Hardcoded fallback');
    expect(html).toContain('No');
  });

  it('shows discarded long-range candidates even when none met the display threshold', () => {
    const html = formatDebugEmail({
      ...baseDebugContext,
      longRangeCandidates: [
        {
          name: 'North Pennines',
          region: 'north-pennines',
          tags: ['moorland'],
          bestScore: 48,
          dayScore: 32,
          astroScore: 48,
          driveMins: 95,
          darkSky: true,
          rank: 1,
          deltaVsHome: 6,
          shown: false,
          discardedReason: 'score below threshold (48 < 50)',
        },
        {
          name: 'Kielder Forest',
          region: 'northumberland',
          tags: ['forest', 'dark-sky'],
          bestScore: 54,
          dayScore: 28,
          astroScore: 54,
          driveMins: 120,
          darkSky: true,
          rank: 2,
          deltaVsHome: 8,
          shown: false,
          discardedReason: 'does not beat Leeds by 10 points (54 vs 46)',
        },
      ],
    });

    expect(html).toContain('Long-range pool');
    expect(html).toContain('North Pennines');
    expect(html).toContain('48');
    expect(html).toContain('score below threshold (48 &lt; 50)');
    expect(html).toContain('Kielder Forest');
    expect(html).toContain('does not beat Leeds by 10 points (54 vs 46)');
    expect(html).not.toContain('No long-range candidates met the threshold this run.');
  });

  it('renders kit advisory trace section with matched and shown columns', () => {
    const html = formatDebugEmail({
      ...baseDebugContext,
      kitAdvisory: {
        rules: [
          { id: 'high-wind', threshold: 'wind > 25 km/h', value: '30 km/h', matched: true, shown: true },
          { id: 'rain-risk', threshold: 'rain > 40%', value: '20%', matched: false, shown: false },
          { id: 'cold', threshold: 'temp < 2°C', value: '0°C', matched: true, shown: false },
        ],
        tipsShown: ['high-wind'],
      },
    });
    expect(html).toContain('Kit advisory rule trace');
    expect(html).toContain('Matched?');
    expect(html).toContain('Shown?');
    expect(html).toContain('cold');
    expect(html).toContain('Tips shown');
  });

  it('shows empty-state message when kitAdvisory is missing', () => {
    const html = formatDebugEmail({ ...baseDebugContext });
    expect(html).toContain('Kit advisory rule trace');
    expect(html).toContain('Kit advisory data not available');
  });
});
