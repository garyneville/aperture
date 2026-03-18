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
        debugModeEnabled: true,
        debugModeSource: 'workflow toggle',
        debugRecipient: 'debug@example.com',
      },
      scores: {
        am: 32,
        pm: 15,
        astro: 75,
        overall: 60,
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
    });

    expect(html).toContain('Run metadata');
    expect(html).toContain('Day scores and certainty');
    expect(html).toContain('Certainty (daylight)');
    expect(html).toContain('Certainty (astro)');
    expect(html).toContain('Spread (daylight)');
    expect(html).toContain('Spread (astro)');
    expect(html).toContain('Window selection trace');
    expect(html).toContain('Hourly astro scoring');
    expect(html).toContain('Nearby alternatives');
    expect(html).toContain('Δ vs Leeds');
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
        { name: 'Kielder Forest', region: 'northumberland', tags: ['dark-sky', 'forest'], bestScore: 91, dayScore: 40, astroScore: 91, driveMins: 120, darkSky: true, rank: 1, deltaVsLeeds: 31, shown: true },
        { name: 'Whernside', region: 'yorkshire-dales', tags: ['moorland'], bestScore: 79, dayScore: 79, astroScore: 30, driveMins: 55, darkSky: false, rank: 2, deltaVsLeeds: 19, shown: false, discardedReason: 'eligible pool candidate behind Kielder Forest' },
      ],
    });
    expect(html).toContain('Long-range pool');
    expect(html).toContain('Kielder Forest');
    expect(html).toContain('Whernside');
    expect(html).toContain('northumberland');
    expect(html).toContain('eligible pool candidate behind Kielder Forest');
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
          deltaVsLeeds: 6,
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
          deltaVsLeeds: 8,
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
