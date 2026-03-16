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
        darkSkyStartsAt: '22:00',
        bestAmHour: '07:00',
        bestPmHour: '18:00',
        sunriseOcclusionRisk: null,
        sunsetOcclusionRisk: null,
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
    expect(result.prompt).toContain('Sentence 1: name the best local window exactly as labelled, include its time and score, add one useful detail');
    expect(result.prompt).toContain('Sentence 2: use one editorial insight line below with light paraphrase.');
    expect(result.prompt).toContain('No camera tips, composition advice, hype, or filler.');
    expect(result.prompt).toContain('Seasonal context: March — early spring; blossom building; frost on clear nights still likely.');
    expect(result.prompt).toContain('Dark-sky conditions improve from 22:00 once the moon is down.');
    expect(result.prompt).toContain('Peak local time is around 19:00, right at the start of the window.');
    expect(result.prompt).toContain('Overall astro potential is 75/100 - the window score is held back by conditions outside the named window.');
    expect(result.prompt).toContain('Sutton Bank is 25 points stronger mainly because of darker skies around 20:00.');
    expect(result.prompt).toContain('- Sutton Bank (75min): 85/100 best astro 20:00 (dark sky)');
    expect(result.peakKpTonight).toBeNull();
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
});
