import { describe, expect, it } from 'vitest';
import { buildPrompt } from './build-prompt.js';

describe('buildPrompt', () => {
  it('constrains the AI briefing to structured editorial output', () => {
    const result = buildPrompt({
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        st: '2026-03-14T19:00:00.000Z',
        end: '21:00',
        et: '2026-03-14T21:00:00.000Z',
        peak: 60,
        tops: ['astrophotography'],
        hours: [{
          ts: '2026-03-14T19:00:00.000Z',
          t: '2026-03-14T19:00:00.000Z',
          hour: '19:00',
          score: 60,
          drama: 0,
          clarity: 0,
          mist: 0,
          astro: 75,
          crepuscular: 0,
          shQ: null,
          cl: 0,
          cm: 0,
          ch: 0,
          ct: 0,
          visK: 18.3,
          aod: 0,
          tpw: 20,
          wind: 9,
          gusts: 11,
          tmp: 6,
          hum: 55,
          dew: 3,
          pp: 0,
          pr: 0,
          vpd: 0,
          azimuthRisk: null,
          isGolden: false,
          isGoldAm: false,
          isGoldPm: false,
          isBlue: false,
          isBlueAm: false,
          isBluePm: false,
          isNight: true,
          moon: 23,
          uv: 0,
          tags: ['astrophotography'],
        }],
        fallback: false,
      }],
      dontBother: false,
      todayBestScore: 75,
      todayCarWash: {
        score: 80,
        rating: '✅',
        label: 'Great',
        start: '15:00',
        end: '17:00',
        wind: 14,
        pp: 24,
        tmp: 9,
      },
      dailySummary: [{
        dateKey: '2026-03-14',
        dayLabel: 'Today',
        dayIdx: 0,
        hours: [],
        photoScore: 60,
        headlineScore: 75,
        photoEmoji: '🔥',
        photoRating: 'Excellent',
        bestPhotoHour: '20:00',
        bestTags: 'astrophotography',
        carWash: {
          score: 80,
          rating: '✅',
          label: 'Great',
          start: '15:00',
          end: '17:00',
          wind: 14,
          pp: 24,
          tmp: 9,
        },
        sunrise: '2026-03-14T06:23:00.000Z',
        sunset: '2026-03-14T18:07:00.000Z',
        shSunsetQuality: 70,
        shSunriseQuality: 61,
        shSunsetText: 'Good texture',
        sunDirection: 251,
        crepRayPeak: 0,
        confidence: 'high',
        confidenceStdDev: 10,
        durationBonus: 0,
        amConfidence: 'medium',
        amConfidenceStdDev: 10,
        pmConfidence: 'medium',
        pmConfidenceStdDev: 10,
        goldAmMins: 0,
        goldPmMins: 0,
        amScore: 32,
        pmScore: 46,
        astroScore: 75,
        bestAstroHour: '19:00',
        darkSkyStartsAt: '22:00',
        bestAmHour: '07:00',
        bestPmHour: '18:00',
        sunriseOcclusionRisk: null,
        sunsetOcclusionRisk: null,
        astroConfidence: 'unknown', astroConfidenceStdDev: null,
      }],
      altLocations: [{
        name: 'Sutton Bank',
        driveMins: 75,
        bestScore: 85,
        bestDayHour: '07:00',
        bestAstroHour: '20:00',
        isAstroWin: true,
        darkSky: true,
        types: ['astrophotography'],
      }],
      noAltsMsg: null,
      metarNote: '✅ METAR: clear skies confirmed',
      sessionRecommendation: {
        primary: {
          session: 'astro',
          hourLabel: '19:00',
          score: 75,
          hardPass: true,
          confidence: 'high',
          volatility: 6,
          reasons: ['Cloud cover is low enough for a plausible dark-sky run.'],
          warnings: [],
          requiredCapabilities: ['moon-geometry', 'cloud-stratification', 'visibility', 'aerosols', 'humidity', 'light-pollution', 'ensemble-confidence'],
        },
        runnerUps: [],
        bySession: [],
        hoursAnalyzed: 3,
        planB: null,
        alerts: [],
      },
      sunrise: '2026-03-14T06:23:00.000Z',
      sunset: '2026-03-14T18:07:00.000Z',
      moonPct: 23,
      now: new Date('2026-03-14T12:00:00Z'),
    });

    expect(result.prompt).toContain('Respond with ONLY a raw JSON object');
    expect(result.prompt).toContain('"editorial":"<2 sentences max 55 words>"');
    expect(result.prompt).toContain('"composition":["<shot idea 1>","<shot idea 2>"]');
    expect(result.prompt).toContain('"weekStandout":"<1 sentence max 30 words — if one day scores clearly higher, call it standout; if today wins only on certainty while another day scores higher, call it most reliable and name the higher-scoring day>"');
    expect(result.prompt).toContain('Selected primary window: Evening astro window (19:00-21:00). Your editorial must reference this window by name or time range. Do not describe conditions outside this window unless making a direct comparison.');
    expect(result.prompt).toContain('Sentence 1: explain why the best local window is worth attention using one supplied fact about timing, change, darkness, or trend.');
    expect(result.prompt).toContain('Sentence 2: use one editorial insight line below with light paraphrase.');
    expect(result.prompt).toContain('Do not open by repeating the visible window name, time, score, or visibility line.');
    expect(result.prompt).toContain('Never return a single sentence.');
    expect(result.prompt).toContain('No camera tips, composition advice, hype, or filler.');
    expect(result.prompt).toContain('Do not blame cloud unless the supplied peak-hour cloud cover supports it.');
    expect(result.prompt).toContain('Seasonal context: March — early spring; blossom building; frost on clear nights still likely.');
    expect(result.prompt).toContain('Dark-sky conditions begin from 22:00 once astronomical twilight ends.');
    expect(result.prompt).toContain('Peak local time is around 19:00, right at the start of the window.');
    expect(result.prompt).toContain('The window tops out at 60/100 overall despite a raw astro peak of 75/100 (19:00).');
    expect(result.prompt).not.toContain('Consider Sutton Bank today — better dark sky conditions (75 min drive).');
    expect(result.prompt).not.toContain('points stronger');
    expect(result.prompt).toContain('The editorial must describe Leeds conditions only.');
    expect(result.prompt).toContain('- Sutton Bank (75min): 85/100 best astro 20:00 (dark sky)');
    expect(result.systemPrompt).toContain('Return JSON that matches the supplied schema exactly.');
    expect(result.systemPrompt).toContain('EDITORIAL RULES');
    expect(result.systemPrompt).toContain('COMPOSITION RULES');
    expect(result.systemPrompt).toContain('If nothing stands out, return spurOfTheMoment with locationName "", hookLine "", and confidence 0.');
    expect(result.userPrompt).toContain('Selected primary window: Evening astro window (19:00-21:00)');
    expect(result.userPrompt).toContain('Editorial insight options:');
    expect(result.userPrompt).toContain('Shot constraints:');
    expect(result.userPrompt).toContain('Long-range locations for spurOfTheMoment:');
    expect(result.userPrompt).not.toContain('Respond with ONLY a raw JSON object');
    expect(result.responseSchemaName).toBe('photo_brief_editorial_response');
    expect(result.responseSchema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['editorial', 'composition', 'weekStandout', 'spurOfTheMoment',
        'windowExplanation', 'sessionComparison', 'nextDayBridge', 'altLocationHook']),
      additionalProperties: false,
      properties: {
        editorial: { type: 'string' },
        windowExplanation: { type: 'string' },
        sessionComparison: { type: 'string' },
        nextDayBridge: { type: 'string' },
        altLocationHook: { type: 'string' },
        composition: { type: 'array', items: { type: 'string' } },
        weekStandout: { type: 'string' },
        spurOfTheMoment: {
          type: 'object',
          required: ['locationName', 'hookLine', 'confidence'],
          additionalProperties: false,
        },
      },
    });
    expect(result.peakKpTonight).toBeNull();
    // Visibility must be a whole number in the prompt (no decimal) so the LLM
    // cannot echo back "18. 3km" with a spurious decimal space (#108).
    expect(result.prompt).toContain('Vis 18km');
    expect(result.prompt).not.toMatch(/Vis \d+\.\d+km/);
    expect(result.sessionRecommendation?.primary?.session).toBe('astro');
  });

  it('includes spurOfTheMoment schema key and location list in the good-day prompt', () => {
    const result = buildPrompt({
      windows: [{
        label: 'Evening astro window', start: '19:00', st: '2026-03-16T19:00:00.000Z',
        end: '21:00', et: '2026-03-16T21:00:00.000Z', peak: 60, tops: ['astrophotography'],
        hours: [{
          ts: '2026-03-16T19:00:00.000Z', t: '2026-03-16T19:00:00.000Z',
          hour: '19:00', score: 60, drama: 0, clarity: 0, mist: 0, astro: 60, crepuscular: 0,
          shQ: null, cl: 0, cm: 0, ch: 0, ct: 0, visK: 18, aod: 0, tpw: 20,
          wind: 9, gusts: 11, tmp: 6, hum: 55, dew: 3, pp: 0, pr: 0, vpd: 0,
          azimuthRisk: null, isGolden: false, isGoldAm: false, isGoldPm: false,
          isBlue: false, isBlueAm: false, isBluePm: false, isNight: true, moon: 23, uv: 0,
          tags: ['astrophotography'],
        }],
        fallback: false,
      }],
      dontBother: false,
      todayBestScore: 60,
      todayCarWash: { score: 70, rating: '✅', label: 'Good', start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 10 },
      dailySummary: [{
        dateKey: '2026-03-16', dayLabel: 'Today', dayIdx: 0, hours: [],
        photoScore: 60, headlineScore: 60, photoEmoji: '👍', photoRating: 'Good',
        bestPhotoHour: '19:00', bestTags: 'astrophotography',
        carWash: { score: 70, rating: '✅', label: 'Good', start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 10 },
        sunrise: '2026-03-16T06:15:00.000Z', sunset: '2026-03-16T18:20:00.000Z',
        shSunsetQuality: null, shSunriseQuality: null, shSunsetText: null,
        sunDirection: null, crepRayPeak: 0, confidence: 'high', confidenceStdDev: 8,
        durationBonus: 0, amConfidence: 'medium', amConfidenceStdDev: 8,
        pmConfidence: 'medium', pmConfidenceStdDev: 8, goldAmMins: 0, goldPmMins: 0,
        amScore: 30, pmScore: 40, astroScore: 60,
        darkSkyStartsAt: null, bestAmHour: '—', bestPmHour: '—',
        sunriseOcclusionRisk: null, sunsetOcclusionRisk: null,
        astroConfidence: 'unknown', astroConfidenceStdDev: null,
      }],
      altLocations: [],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-03-16T06:15:00.000Z',
      sunset: '2026-03-16T18:20:00.000Z',
      moonPct: 50,
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(result.prompt).toContain('"spurOfTheMoment"');
    expect(result.prompt).toContain('"locationName"');
    expect(result.prompt).toContain('"hookLine"');
    expect(result.prompt).toContain('"confidence"');
    expect(result.prompt).toContain('SPUR OF THE MOMENT');
    expect(result.prompt).toContain('Pen-y-ghent');
    expect(result.prompt).toContain('Galloway Forest');
  });

  it('groups nearby alternatives by astro and golden-hour mode in the prompt context', () => {
    const result = buildPrompt({
      windows: [{
        label: 'Best chance around sunrise',
        start: '07:00',
        st: '2026-03-16T07:00:00.000Z',
        end: '07:00',
        et: '2026-03-16T07:00:00.000Z',
        peak: 36,
        tops: ['landscape'],
        hours: [{
          ts: '2026-03-16T07:00:00.000Z',
          t: '2026-03-16T07:00:00.000Z',
          hour: '07:00',
          score: 36,
          drama: 0,
          clarity: 0,
          mist: 0,
          astro: 12,
          crepuscular: 0,
          shQ: null,
          cl: 15,
          cm: 10,
          ch: 5,
          ct: 15,
          visK: 18,
          aod: 0,
          tpw: 16,
          wind: 8,
          gusts: 10,
          tmp: 6,
          hum: 65,
          dew: 2,
          pp: 10,
          pr: 0,
          vpd: 0,
          azimuthRisk: null,
          isGolden: true,
          isGoldAm: true,
          isGoldPm: false,
          isBlue: false,
          isBlueAm: false,
          isBluePm: false,
          isNight: false,
          moon: 8,
          uv: 0,
          tags: ['landscape'],
        }],
        fallback: false,
      }],
      dontBother: false,
      todayBestScore: 36,
      todayCarWash: {
        score: 58,
        rating: '✅',
        label: 'Usable',
        start: '06:00',
        end: '08:00',
        wind: 9,
        pp: 12,
        tmp: 7,
      },
      dailySummary: [{
        dateKey: '2026-03-16',
        dayLabel: 'Today',
        dayIdx: 0,
        hours: [],
        photoScore: 36,
        headlineScore: 36,
        photoEmoji: '🟡',
        photoRating: 'Marginal',
        bestPhotoHour: '07:00',
        bestTags: 'landscape',
        carWash: {
          score: 58,
          rating: '✅',
          label: 'Usable',
          start: '06:00',
          end: '08:00',
          wind: 9,
          pp: 12,
          tmp: 7,
        },
        sunrise: '2026-03-16T06:18:00.000Z',
        sunset: '2026-03-16T18:11:00.000Z',
        shSunsetQuality: null,
        shSunriseQuality: null,
        shSunsetText: null,
        sunDirection: null,
        crepRayPeak: 0,
        confidence: 'high',
        confidenceStdDev: 6,
        durationBonus: 0,
        amConfidence: 'high',
        amConfidenceStdDev: 6,
        pmConfidence: 'medium',
        pmConfidenceStdDev: 12,
        goldAmMins: 0,
        goldPmMins: 0,
        amScore: 36,
        pmScore: 18,
        astroScore: 22,
        bestAstroHour: '02:00',
        darkSkyStartsAt: null,
        bestAmHour: '07:00',
        bestPmHour: '18:00',
        sunriseOcclusionRisk: null,
        sunsetOcclusionRisk: null,
        astroConfidence: 'unknown',
        astroConfidenceStdDev: null,
      }],
      altLocations: [{
        name: 'Brimham Rocks',
        driveMins: 40,
        bestScore: 81,
        bestDayHour: '06:45',
        bestAstroHour: '02:00',
        isAstroWin: true,
        darkSky: false,
        types: ['astrophotography'],
      }, {
        name: 'Bolton Abbey',
        driveMins: 35,
        bestScore: 64,
        bestDayHour: '06:45',
        bestAstroHour: null,
        isAstroWin: false,
        darkSky: false,
        types: ['landscape'],
      }],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-03-16T06:18:00.000Z',
      sunset: '2026-03-16T18:11:00.000Z',
      moonPct: 8,
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(result.prompt).toContain('Nearby alternatives worth considering:');
    expect(result.prompt).toContain('Nearby astro options:');
    expect(result.prompt).toContain('- Brimham Rocks (40min): 81/100 best astro 02:00');
    expect(result.prompt).toContain('Nearby landscape options:');
    expect(result.prompt).toContain('- Bolton Abbey (35min): 64/100 morning golden hour around 06:45');
  });

  it('passes long-range fields through to the formatter context', () => {
    const result = buildPrompt({
      windows: [],
      dontBother: true,
      todayBestScore: 30,
      todayCarWash: { score: 40, rating: '❌', label: 'Poor', start: '—', end: '—', wind: 30, pp: 80, tmp: 5 },
      dailySummary: [{
        dateKey: '2026-03-16', dayLabel: 'Today', dayIdx: 0, hours: [],
        photoScore: 30, headlineScore: 30, photoEmoji: '❌', photoRating: 'Poor',
        bestPhotoHour: '—', bestTags: '',
        carWash: { score: 40, rating: '❌', label: 'Poor', start: '—', end: '—', wind: 30, pp: 80, tmp: 5 },
        sunrise: '2026-03-16T06:15:00.000Z', sunset: '2026-03-16T18:20:00.000Z',
        shSunsetQuality: null, shSunriseQuality: null, shSunsetText: null,
        sunDirection: null, crepRayPeak: 0, confidence: 'low', confidenceStdDev: 20,
        durationBonus: 0, amConfidence: 'low', amConfidenceStdDev: 20,
        pmConfidence: 'low', pmConfidenceStdDev: 20, goldAmMins: 0, goldPmMins: 0,
        amScore: 20, pmScore: 25, astroScore: 15,
        darkSkyStartsAt: null, bestAmHour: '—', bestPmHour: '—',
        sunriseOcclusionRisk: null, sunsetOcclusionRisk: null,
        astroConfidence: 'unknown', astroConfidenceStdDev: null,
      }],
      altLocations: [],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-03-16T06:15:00.000Z',
      sunset: '2026-03-16T18:20:00.000Z',
      moonPct: 80,
      longRangeTop: {
        name: 'Kielder Forest',
        region: 'northumberland',
        driveMins: 120,
        tags: ['woodland', 'moorland'],
        siteDarkness: { bortle: 2, siteDarknessScore: 88, source: 'test', lookupDate: '2026-03-16' },
        darkSky: true,
        elevation: 312,
        dayScore: 40,
        amScore: 20,
        pmScore: 30,
        astroScore: 91,
        bestScore: 91,
        bestDayHour: '07:00',
        bestAstroHour: '22:00',
        isAstroWin: true,
      },
      longRangeCardLabel: 'Weekend opportunity',
      darkSkyAlert: {
        name: 'Kielder Forest',
        region: 'northumberland',
        driveMins: 120,
        astroScore: 91,
        bestAstroHour: '22:00',
        moonPct: 12,
      },
      longRangeCandidates: [{
        name: 'Kielder Forest',
        region: 'northumberland',
        driveMins: 120,
        tags: ['woodland', 'moorland'],
        siteDarkness: { bortle: 2, siteDarknessScore: 88, source: 'test', lookupDate: '2026-03-16' },
        darkSky: true,
        elevation: 312,
        dayScore: 40,
        amScore: 20,
        pmScore: 30,
        astroScore: 91,
        bestScore: 91,
        bestDayHour: '07:00',
        bestAstroHour: '22:00',
        isAstroWin: true,
      }],
      longRangeDebugCandidates: [{
        name: 'Kielder Forest',
        region: 'northumberland',
        driveMins: 120,
        tags: ['woodland', 'moorland'],
        siteDarkness: { bortle: 2, siteDarknessScore: 88, source: 'test', lookupDate: '2026-03-16' },
        darkSky: true,
        elevation: 312,
        dayScore: 40,
        amScore: 20,
        pmScore: 30,
        astroScore: 91,
        bestScore: 91,
        bestDayHour: '07:00',
        bestAstroHour: '22:00',
        isAstroWin: true,
        rank: 1,
        deltaVsHome: 56,
        shown: true,
      }],
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(result.longRangeTop?.name).toBe('Kielder Forest');
    expect(result.longRangeCardLabel).toBe('Weekend opportunity');
    expect(result.darkSkyAlert?.name).toBe('Kielder Forest');
    expect(result.longRangeDebugCandidates?.[0]?.deltaVsHome).toBe(56);
  });

  it('includes spurOfTheMoment schema key and location list in the dontBother prompt', () => {
    const result = buildPrompt({
      windows: [],
      dontBother: true,
      todayBestScore: 30,
      todayCarWash: { score: 40, rating: '❌', label: 'Poor', start: '—', end: '—', wind: 30, pp: 80, tmp: 5 },
      dailySummary: [{
        dateKey: '2026-03-16', dayLabel: 'Today', dayIdx: 0, hours: [],
        photoScore: 30, headlineScore: 30, photoEmoji: '❌', photoRating: 'Poor',
        bestPhotoHour: '—', bestTags: '',
        carWash: { score: 40, rating: '❌', label: 'Poor', start: '—', end: '—', wind: 30, pp: 80, tmp: 5 },
        sunrise: '2026-03-16T06:15:00.000Z', sunset: '2026-03-16T18:20:00.000Z',
        shSunsetQuality: null, shSunriseQuality: null, shSunsetText: null,
        sunDirection: null, crepRayPeak: 0, confidence: 'low', confidenceStdDev: 20,
        durationBonus: 0, amConfidence: 'low', amConfidenceStdDev: 20,
        pmConfidence: 'low', pmConfidenceStdDev: 20, goldAmMins: 0, goldPmMins: 0,
        amScore: 20, pmScore: 25, astroScore: 15,
        darkSkyStartsAt: null, bestAmHour: '—', bestPmHour: '—',
        sunriseOcclusionRisk: null, sunsetOcclusionRisk: null,
        astroConfidence: 'unknown', astroConfidenceStdDev: null,
      }],
      altLocations: [],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-03-16T06:15:00.000Z',
      sunset: '2026-03-16T18:20:00.000Z',
      moonPct: 80,
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(result.prompt).toContain('"spurOfTheMoment"');
    expect(result.prompt).toContain('SPUR OF THE MOMENT');
    expect(result.prompt).toContain('Pen-y-ghent');
    expect(result.prompt).toContain('WEEK STANDOUT (1 sentence, max 30 words):');
    expect(result.prompt).toContain('If today wins only on certainty (lower spread) while another day scores higher, call today the "most reliable" day');
    expect(result.prompt).toContain('Today is the most reliable forecast; Wednesday may score higher but with much lower certainty');
    expect(result.prompt).toContain('Use only the supplied 5-day outlook labels, scores, and spreads. Do not invent a different higher-scoring day.');
    expect(result.prompt).toContain('"weekStandout":"<1 sentence max 30 words — if one day scores clearly higher, call it standout; if today wins only on certainty while another day scores higher, call it most reliable and name the higher-scoring day>"');
    expect(result.systemPrompt).toContain('composition must be an empty array.');
    expect(result.userPrompt).toContain('Nearby alternatives summary:');
    expect(result.userPrompt).toContain('Long-range locations for spurOfTheMoment:');
    expect(result.userPrompt).not.toContain('Respond with ONLY a raw JSON object');
  });

  it('treats a missing local window as dontBother and explains the weighted no-window state', () => {
    const result = buildPrompt({
      windows: [],
      dontBother: false,
      todayBestScore: 47,
      todayCarWash: { score: 60, rating: '✅', label: 'Great', start: '06:00', end: '08:00', wind: 12, pp: 22, tmp: 5 },
      dailySummary: [{
        dateKey: '2026-03-16', dayLabel: 'Today', dayIdx: 0, hours: [],
        photoScore: 32, headlineScore: 42, photoEmoji: '🟡', photoRating: 'Marginal',
        bestPhotoHour: '07:00', bestTags: 'landscape, clear light path',
        carWash: { score: 60, rating: '✅', label: 'Great', start: '06:00', end: '08:00', wind: 12, pp: 22, tmp: 5 },
        sunrise: '2026-03-16T06:18:00.000Z', sunset: '2026-03-16T18:11:00.000Z',
        shSunsetQuality: null, shSunriseQuality: null, shSunsetText: null,
        sunDirection: null, crepRayPeak: 0, confidence: 'high', confidenceStdDev: 5,
        durationBonus: 0, amConfidence: 'high', amConfidenceStdDev: 5,
        pmConfidence: 'high', pmConfidenceStdDev: 5, goldAmMins: 0, goldPmMins: 0,
        amScore: 32, pmScore: 15, astroScore: 52, bestAstroHour: '04:00', darkSkyStartsAt: '00:00',
        bestAmHour: '07:00', bestPmHour: '18:00',
        sunriseOcclusionRisk: 10, sunsetOcclusionRisk: null,
        astroConfidence: 'high', astroConfidenceStdDev: 11,
      }],
      altLocations: [{
        name: 'Brimham Rocks',
        driveMins: 40,
        bestScore: 81,
        bestDayHour: null,
        bestAstroHour: '02:00',
        isAstroWin: true,
        darkSky: false,
        types: ['astrophotography'],
      }],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-03-16T06:18:00.000Z',
      sunset: '2026-03-16T18:11:00.000Z',
      moonPct: 8,
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(result.dontBother).toBe(true);
    expect(result.prompt).toContain('no local window cleared the full weighted threshold');
    expect(result.prompt).not.toContain('Sentence 1: explain why the best local window is worth attention');
  });

  it('includes spread in the 5-day outlook and instructs AI to distinguish score winner from certainty-only winner', () => {
    const makeDailySummaryDay = (dayLabel: string, dayIdx: number, headlineScore: number, confidence: string, confidenceStdDev: number | null) => ({
      dateKey: `2026-03-${14 + dayIdx}`,
      dayLabel,
      dayIdx,
      hours: [],
      photoScore: headlineScore - 5,
      headlineScore,
      photoEmoji: '👍',
      photoRating: 'Good',
      bestPhotoHour: '19:00',
      bestTags: 'golden hour',
      carWash: { score: 60, rating: '✅', label: 'OK', start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 10 },
      sunrise: '2026-03-14T06:20:00.000Z',
      sunset: '2026-03-14T18:10:00.000Z',
      shSunsetQuality: null,
      shSunriseQuality: null,
      shSunsetText: null,
      sunDirection: null,
      crepRayPeak: 0,
      confidence,
      confidenceStdDev,
      durationBonus: 0,
      amConfidence: 'medium',
      amConfidenceStdDev: confidenceStdDev,
      pmConfidence: 'medium',
      pmConfidenceStdDev: confidenceStdDev,
      goldAmMins: 0,
      goldPmMins: 0,
      amScore: 30,
      pmScore: 40,
      astroScore: 50,
      astroConfidence: 'unknown',
      astroConfidenceStdDev: null,
      darkSkyStartsAt: null,
      bestAmHour: '07:00',
      bestPmHour: '18:00',
      sunriseOcclusionRisk: null,
      sunsetOcclusionRisk: null,
    });

    const result = buildPrompt({
      windows: [{
        label: 'Evening window', start: '18:00', st: '2026-03-14T18:00:00.000Z',
        end: '20:00', et: '2026-03-14T20:00:00.000Z', peak: 60, tops: ['golden hour'],
        hours: [{
          ts: '2026-03-14T18:00:00.000Z', t: '2026-03-14T18:00:00.000Z',
          hour: '18:00', score: 60, drama: 0, clarity: 0, mist: 0, astro: 0, crepuscular: 0,
          shQ: null, cl: 20, cm: 10, ch: 5, ct: 35, visK: 18, aod: 0, tpw: 20,
          wind: 10, gusts: 12, tmp: 8, hum: 60, dew: 4, pp: 5, pr: 0, vpd: 0,
          azimuthRisk: null, isGolden: true, isGoldAm: false, isGoldPm: true,
          isBlue: false, isBlueAm: false, isBluePm: false, isNight: false, moon: 10, uv: 2,
          tags: ['golden hour'],
        }],
        fallback: false,
      }],
      dontBother: false,
      todayBestScore: 60,
      todayCarWash: { score: 60, rating: '✅', label: 'OK', start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 10 },
      dailySummary: [
        makeDailySummaryDay('Monday', 0, 60, 'high', 5),
        makeDailySummaryDay('Tuesday', 1, 55, 'medium', 15),
        makeDailySummaryDay('Wednesday', 2, 70, 'low', 39),
        makeDailySummaryDay('Thursday', 3, 45, 'medium', 12),
        makeDailySummaryDay('Friday', 4, 50, 'medium', 18),
      ],
      altLocations: [],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-03-14T06:20:00.000Z',
      sunset: '2026-03-14T18:10:00.000Z',
      moonPct: 30,
      now: new Date('2026-03-14T12:00:00Z'),
    });

    // Spread values should appear in the 5-day outlook so the AI can reason about certainty
    expect(result.prompt).toContain('Monday: 60/100 (high confidence spread 5)');
    expect(result.prompt).toContain('Wednesday: 70/100 (low confidence spread 39)');

    // The prompt should instruct the AI to distinguish score wins from certainty-only wins
    expect(result.prompt).toContain('If one day scores clearly higher than others, call it the "standout" day.');
    expect(result.prompt).toContain('If today wins only on certainty (lower spread) while another day scores higher, call today the "most reliable" day');
    expect(result.prompt).toContain('Use only the supplied 5-day outlook labels, scores, and spreads. Do not invent a different higher-scoring day.');
  });

  const makeAstroWindow = (dateStr: string) => ({
    label: 'Evening astro window',
    start: '21:00',
    st: `${dateStr}T21:00:00.000Z`,
    end: '23:00',
    et: `${dateStr}T23:00:00.000Z`,
    peak: 65,
    tops: ['astrophotography'],
    hours: [{
      ts: `${dateStr}T21:00:00.000Z`, t: `${dateStr}T21:00:00.000Z`,
      hour: '21:00', score: 65, drama: 0, clarity: 0, mist: 0, astro: 65, crepuscular: 0,
      shQ: null, cl: 0, cm: 0, ch: 0, ct: 0, visK: 20, aod: 0, tpw: 20,
      wind: 8, gusts: 10, tmp: 8, hum: 50, dew: 2, pp: 0, pr: 0, vpd: 0,
      azimuthRisk: null, isGolden: false, isGoldAm: false, isGoldPm: false,
      isBlue: false, isBlueAm: false, isBluePm: false, isNight: true, moon: 10, uv: 0,
      tags: ['astrophotography'],
    }],
    fallback: false,
  });

  const makeBaseDailySummary = (dateKey: string) => ({
    dateKey, dayLabel: 'Today', dayIdx: 0, hours: [],
    photoScore: 65, headlineScore: 65, photoEmoji: '👍', photoRating: 'Good',
    bestPhotoHour: '21:00', bestTags: 'astrophotography',
    carWash: { score: 60, rating: '✅', label: 'Good', start: '15:00', end: '17:00', wind: 10, pp: 5, tmp: 10 },
    sunrise: `${dateKey}T06:00:00.000Z`, sunset: `${dateKey}T20:00:00.000Z`,
    shSunsetQuality: null, shSunriseQuality: null, shSunsetText: null,
    sunDirection: null, crepRayPeak: 0, confidence: 'high' as const, confidenceStdDev: 8,
    durationBonus: 0, amConfidence: 'medium' as const, amConfidenceStdDev: 8,
    pmConfidence: 'medium' as const, pmConfidenceStdDev: 8, goldAmMins: 0, goldPmMins: 0,
    amScore: 30, pmScore: 45, astroScore: 65,
    astroConfidence: 'unknown' as const, astroConfidenceStdDev: null,
    darkSkyStartsAt: null, bestAmHour: '—', bestPmHour: '—',
    sunriseOcclusionRisk: null, sunsetOcclusionRisk: null,
  });

  it('includes Leeds-local landmark guidance when an astro window is clear enough', () => {
    // March: out of Milky Way season — local-only and urban-skyglow constraints should appear for astro
    const result = buildPrompt({
      windows: [makeAstroWindow('2026-03-16')],
      dontBother: false,
      todayBestScore: 65,
      todayCarWash: { score: 60, rating: '✅', label: 'Good', start: '15:00', end: '17:00', wind: 10, pp: 5, tmp: 10 },
      dailySummary: [makeBaseDailySummary('2026-03-16')],
      altLocations: [],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-03-16T06:00:00.000Z',
      sunset: '2026-03-16T20:00:00.000Z',
      moonPct: 15,
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(result.prompt).toContain('Sky quality constraints for shot ideas:');
    expect(result.prompt).toContain('Home location (Leeds) is Bortle 7');
    expect(result.prompt).toContain('Do NOT suggest Milky Way core shots for the home session');
    expect(result.prompt).toContain('star trails with a silhouetted landmark foreground');
    expect(result.prompt).toContain('Composition bullets must stay focused on the named local window');
  });

  it('blocks Milky Way suggestions outside of season (Oct–Mar) for any location', () => {
    // January: definitely out of Milky Way season
    const result = buildPrompt({
      windows: [makeAstroWindow('2026-01-10')],
      dontBother: false,
      todayBestScore: 65,
      todayCarWash: { score: 60, rating: '✅', label: 'Good', start: '15:00', end: '17:00', wind: 10, pp: 5, tmp: 10 },
      dailySummary: [makeBaseDailySummary('2026-01-10')],
      altLocations: [{
        name: 'Sutton Bank',
        driveMins: 75,
        bestScore: 80,
        bestDayHour: '07:00',
        bestAstroHour: '22:00',
        isAstroWin: true,
        darkSky: true,
        types: ['astrophotography'],
      }],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-01-10T08:00:00.000Z',
      sunset: '2026-01-10T16:30:00.000Z',
      moonPct: 20,
      now: new Date('2026-01-10T12:00:00Z'),
    });

    expect(result.prompt).toContain('Milky Way core is NOT seasonally visible from UK in Jan');
    expect(result.prompt).toContain('Do not suggest Milky Way photography at any location this month');
    expect(result.prompt).toContain('star trails');
  });

  it('permits Milky Way suggestion for dark-sky alt in season (Apr–Sep)', () => {
    // June: in Milky Way season, dark-sky alt available
    const result = buildPrompt({
      windows: [makeAstroWindow('2026-06-15')],
      dontBother: false,
      todayBestScore: 70,
      todayCarWash: { score: 65, rating: '✅', label: 'Good', start: '14:00', end: '16:00', wind: 8, pp: 5, tmp: 15 },
      dailySummary: [makeBaseDailySummary('2026-06-15')],
      altLocations: [{
        name: 'Galloway Forest',
        driveMins: 180,
        bestScore: 85,
        bestDayHour: '06:00',
        bestAstroHour: '23:00',
        isAstroWin: true,
        darkSky: true,
        types: ['astrophotography'],
      }],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-06-15T04:30:00.000Z',
      sunset: '2026-06-15T21:30:00.000Z',
      moonPct: 10,
      now: new Date('2026-06-15T12:00:00Z'),
    });

    // Should NOT block Milky Way outright — it's in season
    expect(result.prompt).not.toContain('Milky Way core is NOT seasonally visible');
    expect(result.prompt).toContain('Galloway Forest');
    expect(result.prompt).toContain('Milky Way work may be viable');
    expect(result.prompt).toContain('Home location (Leeds) is Bortle 7');
    expect(result.prompt).toContain('keep the composition bullets about the local session');
  });

  it('prompts aurora-aware editorial and composition when Kp clears the local threshold', () => {
    const result = buildPrompt({
      windows: [makeAstroWindow('2026-03-18')],
      dontBother: false,
      todayBestScore: 60,
      todayCarWash: { score: 65, rating: '✅', label: 'Good', start: '14:00', end: '16:00', wind: 8, pp: 5, tmp: 8 },
      dailySummary: [makeBaseDailySummary('2026-03-18')],
      altLocations: [{
        name: 'Stanage Edge',
        driveMins: 65,
        bestScore: 85,
        bestDayHour: '06:00',
        bestAstroHour: '22:00',
        isAstroWin: true,
        darkSky: true,
        types: ['astrophotography'],
      }],
      noAltsMsg: null,
      metarNote: '',
      sunrise: '2026-03-18T06:13:00.000Z',
      sunset: '2026-03-18T18:15:00.000Z',
      moonPct: 1,
      kpForecast: [{ time: '2026-03-18T22:00:00Z', kp: 6.3 }],
      now: new Date('2026-03-18T12:00:00Z'),
    });

    expect(result.prompt).toContain('Aurora alert: Kp 6.3 forecast tonight — this clears the local visibility threshold of Kp 6 for Leeds.');
    expect(result.prompt).toContain('This window coincides with an active aurora signal (Kp 6.3 vs local visibility threshold Kp 6)');
    expect(result.prompt).toContain('Make the first bullet aurora-led');
    expect(result.prompt).toContain('Avoid generic placeholders like "silhouetted landmark foreground" or "wide-field constellation framing"');
  });

  it('uses injected home location in the prompt without populating debug metadata', () => {
    const result = buildPrompt({
      homeLocation: {
        name: 'York',
        lat: 53.96,
        lon: -1.08,
        timezone: 'Europe/London',
      },
      workflowVersion: 'test-workflow-v2',
      windows: [],
      dontBother: true,
      todayBestScore: 24,
      todayCarWash: { score: 40, rating: 'OK', label: 'Fine', start: '10:00', end: '12:00', wind: 12, pp: 35, tmp: 8 },
      dailySummary: [{
        ...makeBaseDailySummary('2026-03-14'),
        headlineScore: 24,
        photoScore: 24,
        astroScore: 30,
      }],
      metarNote: '',
      moonPct: 18,
      now: new Date('2026-03-14T12:00:00Z'),
    });

    expect(result.prompt).toContain('Photography assistant for York.');
    expect(result.debugContext.metadata).toBeUndefined();
  });

  it('does not double-apply DST offset for sunrise/sunset strings (regression)', () => {
    // April 2 is in BST (UTC+1).  Open-Meteo with timezone=Europe/London
    // returns already-localised ISO strings WITHOUT the Z suffix.
    // The old code parsed them through new Date() + toLocaleTimeString,
    // which re-applied the +1 offset, producing UTC+2 times.
    const result = buildPrompt({
      windows: [{
        label: 'Golden hour',
        start: '19:00',
        st: '2026-04-02T19:00:00',
        end: '20:00',
        et: '2026-04-02T20:00:00',
        peak: 55,
        tops: ['golden hour'],
        hours: [{
          ts: '2026-04-02T19:00:00', t: '2026-04-02T19:00:00',
          hour: '19:00', score: 55, drama: 30, clarity: 40, mist: 0, astro: 0, crepuscular: 0, shQ: null,
          cl: 30, cm: 20, ch: 10, ct: 40, visK: 15, aod: 0.1, tpw: 10,
          wind: 10, gusts: 18, tmp: 12, hum: 60, dew: 5, pp: 5, pr: 0, vpd: 0,
          azimuthRisk: null, isGolden: true, isGoldAm: false, isGoldPm: true,
          isBlue: false, isBlueAm: false, isBluePm: false, isNight: false, moon: 0.1, uv: 0,
          tags: ['golden hour'],
        }],
        fallback: false,
      }],
      dontBother: false,
      todayBestScore: 55,
      todayCarWash: { score: 70, rating: '✅', label: 'Good', start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 12 },
      dailySummary: [{
        dateKey: '2026-04-02', dayLabel: 'Today', dayIdx: 0, hours: [],
        photoScore: 55, headlineScore: 55, photoEmoji: '👍', photoRating: 'Good',
        bestPhotoHour: '19:00', bestTags: 'golden hour',
        carWash: { score: 70, rating: '✅', label: 'Good', start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 12 },
        sunrise: '2026-04-02T06:36:00', sunset: '2026-04-02T19:43:00',
        shSunsetQuality: null, shSunriseQuality: null, shSunsetText: null,
        sunDirection: 260, crepRayPeak: 0, confidence: 'high' as const, confidenceStdDev: 8,
        durationBonus: 0, amConfidence: 'medium' as const, amConfidenceStdDev: 8,
        pmConfidence: 'medium' as const, pmConfidenceStdDev: 8, goldAmMins: 0, goldPmMins: 0,
        amScore: 30, pmScore: 55, astroScore: 0,
        astroConfidence: 'unknown' as const, astroConfidenceStdDev: null,
        darkSkyStartsAt: null, bestAmHour: '—', bestPmHour: '19:00',
        sunriseOcclusionRisk: null, sunsetOcclusionRisk: null,
      }],
      altLocations: [],
      noAltsMsg: null,
      metarNote: '',
      // Already-localised BST times from Open-Meteo (no Z suffix)
      sunrise: '2026-04-02T06:36:00',
      sunset: '2026-04-02T19:43:00',
      moonPct: 15,
      now: new Date('2026-04-02T12:00:00Z'),
    });

    // Should show the pre-localised BST times, NOT UTC+2
    expect(result.sunriseStr).toBe('06:36');
    expect(result.sunsetStr).toBe('19:43');
    expect(result.prompt).toContain('Sunrise: 06:36');
    expect(result.prompt).toContain('Sunset: 19:43');
    // Must NOT contain the double-offset times
    expect(result.prompt).not.toContain('Sunrise: 07:36');
    expect(result.prompt).not.toContain('Sunset: 20:43');
  });

});
