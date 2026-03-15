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
    expect(result.prompt).toContain('Peak local time is around 19:00, right at the start of the window.');
    expect(result.prompt).toContain('Overall astro potential is 75/100 - the window score is held back by conditions outside the named window.');
    expect(result.prompt).toContain('Sutton Bank is 25 points stronger mainly because of darker skies around 20:00.');
    expect(result.prompt).toContain('- Sutton Bank (75min): 85/100 best astro 20:00 (dark sky)');
    expect(result.peakKpTonight).toBeNull();
  });
});
