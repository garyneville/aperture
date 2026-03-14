import { describe, expect, it } from 'vitest';
import { formatEmail, type FormatEmailInput } from './format-email.js';

describe('formatEmail hero summary', () => {
  it('renders a structured today summary with separated facts, score mix, and alternative', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        end: '21:00',
        peak: 60,
        hours: [{ score: 60, ch: 0, visK: 16.5, wind: '8', pp: 0, tpw: 20 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 60,
        start: '15:00',
        end: '17:00',
        wind: 14,
        pp: 24,
        tmp: 9,
      },
      dailySummary: [{
        dayLabel: 'Saturday',
        dateKey: '2026-03-14',
        dayIdx: 0,
        photoScore: 75,
        headlineScore: 75,
        photoEmoji: 'Excellent',
        amScore: 32,
        pmScore: 40,
        astroScore: 75,
        confidence: 'high',
        confidenceStdDev: 10,
        amConfidence: 'medium',
        pmConfidence: 'medium',
        bestPhotoHour: '18:00',
        bestTags: 'landscape',
        bestAlt: {
          name: 'Malham Cove',
          driveMins: 55,
          bestScore: 85,
          bestAstroHour: '20:00',
          isAstroWin: true,
          darkSky: true,
        },
        carWash: {
          rating: 'OK',
          label: 'Usable',
          score: 60,
          start: '15:00',
          end: '17:00',
          wind: 14,
          pp: 24,
          tmp: 9,
        },
      }],
      altLocations: [{
        name: 'Malham Cove',
        driveMins: 55,
        bestScore: 85,
        bestAstroHour: '20:00',
        isAstroWin: true,
        darkSky: true,
      }],
      noAltsMsg: undefined,
      sunriseStr: '06:23',
      sunsetStr: '18:07',
      moonPct: 23,
      metarNote: 'METAR clear',
      today: 'Saturday 14 March',
      todayBestScore: 75,
      shSunsetQ: 70,
      shSunriseQ: 61,
      shSunsetText: 'Good texture',
      sunDir: 251,
      crepPeak: 0,
      aiText: 'Leeds has a usable evening astro slot, but Sutton Bank gains 25 points from darker skies.',
    };

    const html = formatEmail(input);

    expect(html).toContain('Good - 60/100');
    expect(html).toContain('AM light');
    expect(html).toContain('PM light');
    expect(html).toContain('Overall astro');
    expect(html).toContain('Best nearby alternative');
    expect(html).toContain('Malham Cove');
    expect(html).toContain('Crescent');
    expect(html).toContain('Evening astro window: 19:00-21:00 at 60/100.');
    expect(html).toContain('Overall astro potential still peaks 15 points higher than the named local window.');
    expect(html).toContain('Malham Cove adds 25 points with darker skies at 20:00.');
    expect(html).toContain('Best backup: Malham Cove - 85/100 at 20:00 (astro)');
    expect(html).toContain('Daylight utility');
    expect(html).toContain('🚗 / 🚶');
    expect(html).not.toContain('5-day car wash');
    expect(html).toContain('&middot;');
    expect(html).not.toContain('Sunrise</span> 06:23</span><span');
  });

  it('adds a later-night distinction when both local windows are astro', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        end: '22:00',
        peak: 60,
        hours: [{ score: 60, ch: 0, visK: 18.3, wind: '9', pp: 0, tpw: 20 }],
        tops: ['astrophotography'],
      }, {
        label: 'Overnight astro window',
        start: '01:00',
        end: '05:00',
        peak: 57,
        hours: [{ score: 57, ch: 0, visK: 25.9, wind: '9', pp: 0, tpw: 20 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 60,
        start: '15:00',
        end: '17:00',
        wind: 14,
        pp: 24,
        tmp: 9,
      },
      dailySummary: [{
        dayLabel: 'Saturday',
        dateKey: '2026-03-14',
        dayIdx: 0,
        photoScore: 75,
        headlineScore: 75,
        photoEmoji: 'Excellent',
        amScore: 32,
        pmScore: 46,
        astroScore: 75,
        confidence: 'medium',
        confidenceStdDev: 17,
        amConfidence: 'medium',
        pmConfidence: 'low',
        bestPhotoHour: '20:00',
        bestTags: 'astrophotography',
        carWash: {
          rating: 'OK',
          label: 'Usable',
          score: 60,
          start: '15:00',
          end: '17:00',
          wind: 14,
          pp: 24,
          tmp: 9,
        },
      }],
      altLocations: [],
      noAltsMsg: undefined,
      sunriseStr: '06:23',
      sunsetStr: '18:07',
      moonPct: 23,
      metarNote: '',
      today: 'Saturday 14 March',
      todayBestScore: 75,
      shSunsetQ: 70,
      shSunriseQ: 61,
      shSunsetText: 'Good texture',
      sunDir: 251,
      crepPeak: 0,
      aiText: 'The overnight slot is the later backup if you miss the evening window.',
    };

    const html = formatEmail(input);

    expect(html).toContain('Later, darker backup if you miss the first astro slot.');
  });
});
