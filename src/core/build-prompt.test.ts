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
      sunrise: '2026-03-14T06:23:00.000Z',
      sunset: '2026-03-14T18:07:00.000Z',
      moonPct: 23,
      now: new Date('2026-03-14T12:00:00Z'),
    });

    expect(result.prompt).toContain('Respond with ONLY a raw JSON object');
    expect(result.prompt).toContain('"editorial":"<2 sentences max 55 words>"');
    expect(result.prompt).toContain('"composition":["<shot idea 1>","<shot idea 2>"]');
    expect(result.prompt).toContain('"weekStandout":"<1 sentence max 30 words>"');
    expect(result.prompt).toContain('Sentence 1: explain why the best local window is worth attention using one supplied fact about timing, change, darkness, or trend.');
    expect(result.prompt).toContain('Sentence 2: use one editorial insight line below with light paraphrase.');
    expect(result.prompt).toContain('Do not open by repeating the visible window name, time, score, or visibility line.');
    expect(result.prompt).toContain('Never return a single sentence.');
    expect(result.prompt).toContain('No camera tips, composition advice, hype, or filler.');
    expect(result.prompt).toContain('Seasonal context: March — early spring; blossom building; frost on clear nights still likely.');
    expect(result.prompt).toContain('Dark-sky conditions improve from 22:00 once the moon is down.');
    expect(result.prompt).toContain('Peak local time is around 19:00, right at the start of the window.');
    expect(result.prompt).toContain('Peak astro sub-score is 75/100 at 19:00, with the final window score at 60/100 after full weighting.');
    expect(result.prompt).toContain('Consider Sutton Bank today — better dark sky conditions (75 min drive).');
    expect(result.prompt).not.toContain('points stronger');
    expect(result.prompt).toContain('When an insight line mentions a nearby alternative, use a prose recommendation only');
    expect(result.prompt).toContain('- Sutton Bank (75min): 85/100 best astro 20:00 (dark sky)');
    expect(result.peakKpTonight).toBeNull();
    // Visibility must be a whole number in the prompt (no decimal) so the LLM
    // cannot echo back "18. 3km" with a spurious decimal space (#108).
    expect(result.prompt).toContain('Vis 18km');
    expect(result.prompt).not.toMatch(/Vis \d+\.\d+km/);
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
    expect(result.prompt).toContain('Astro alternatives:');
    expect(result.prompt).toContain('- Brimham Rocks (40min): 81/100 best astro 02:00');
    expect(result.prompt).toContain('Golden-hour alternatives:');
    expect(result.prompt).toContain('- Bolton Abbey (35min): 64/100 morning golden hour around 06:45');
  });

  it('passes long-range fields through to the formatter context', () => {
    const result = buildPrompt({
      windows: [],
      dontBother: true,
      todayBestScore: 35,
      todayCarWash: { score: 40, rating: '❌', label: 'Poor', start: '—', end: '—', wind: 30, pp: 80, tmp: 5 },
      dailySummary: [{
        dateKey: '2026-03-16', dayLabel: 'Today', dayIdx: 0, hours: [],
        photoScore: 35, headlineScore: 35, photoEmoji: '❌', photoRating: 'Poor',
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
        astroScore: 91,
        bestScore: 91,
        bestDayHour: '07:00',
        bestAstroHour: '22:00',
        isAstroWin: true,
        rank: 1,
        deltaVsLeeds: 56,
        shown: true,
      }],
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(result.longRangeTop?.name).toBe('Kielder Forest');
    expect(result.longRangeCardLabel).toBe('Weekend opportunity');
    expect(result.darkSkyAlert?.name).toBe('Kielder Forest');
    expect(result.longRangeDebugCandidates?.[0]?.deltaVsLeeds).toBe(56);
  });

  it('includes spurOfTheMoment schema key and location list in the dontBother prompt', () => {
    const result = buildPrompt({
      windows: [],
      dontBother: true,
      todayBestScore: 35,
      todayCarWash: { score: 40, rating: '❌', label: 'Poor', start: '—', end: '—', wind: 30, pp: 80, tmp: 5 },
      dailySummary: [{
        dateKey: '2026-03-16', dayLabel: 'Today', dayIdx: 0, hours: [],
        photoScore: 35, headlineScore: 35, photoEmoji: '❌', photoRating: 'Poor',
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

  it('includes home Bortle class in sky quality constraints for an astro window', () => {
    // March: out of Milky Way season — home Bortle constraint should always appear for astro
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
});
