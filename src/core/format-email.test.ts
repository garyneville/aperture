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
        hours: [{ hour: '19:00', score: 60, ch: 0, visK: 16.5, wind: '8', pp: 0, tpw: 20 }],
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
    expect(html).toContain('Best time');
    expect(html).toContain('Evening astro window: 19:00-21:00 at 60/100.');
    expect(html).toContain('Overall astro potential: 75/100 - the window score is held back by conditions outside the named window.');
    expect(html).toContain('Daylight utility');
    expect(html).toContain('&#x1F697; / &#x1F6B6;');
    expect(html).toContain('>Moisture</span> 20mm');
    expect(html).not.toContain('TPW');
    expect(html).not.toContain('5-day car wash');
    expect(html).toContain('&middot;');
    expect(html).not.toContain('Sunrise</span> 06:23</span><span');
    expect(html).not.toContain('AM</span> 32 ·');
    expect(html).not.toContain('PM</span> 40 ·');
    expect(html).toContain('Days ahead');
    expect(html).not.toContain('5-day photography');
    expect(html).toContain('Key');
    expect(html).toContain('Crepuscular rays = shafts of light');
    // at-a-glance must not restate peak time already visible in the hero grid
    expect(html).not.toContain('right as the window opens');
    expect(html).not.toContain('near the end of the window');
    expect(html).not.toContain('within the window');
    // at-a-glance must not include alternative score deltas (local Leeds only)
    expect(html).not.toContain('adds 25 points');
  });

  it('adds a later-night distinction when both local windows are astro', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        end: '22:00',
        peak: 60,
        hours: [{ hour: '22:00', score: 60, ch: 0, visK: 18.3, wind: '9', pp: 0, tpw: 20 }],
        tops: ['astrophotography'],
      }, {
        label: 'Overnight astro window',
        start: '01:00',
        end: '05:00',
        peak: 57,
        hours: [{ hour: '01:00', score: 57, ch: 0, visK: 25.9, wind: '9', pp: 0, tpw: 20 }],
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

  it('places daylight utility after alternatives in the email flow', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        end: '21:00',
        peak: 60,
        hours: [{ hour: '19:00', score: 60, ch: 0, visK: 16.5, wind: '8', pp: 0, tpw: 20 }],
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
        bestPhotoHour: '20:00',
        bestTags: 'astrophotography',
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

    expect(html.indexOf('Alternatives')).toBeLessThan(html.indexOf('Daylight utility'));
    expect(html.indexOf('Daylight utility')).toBeLessThan(html.indexOf('Days ahead'));
  });

  it('does not leak internal fallback tags into days-ahead cards', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        end: '21:00',
        peak: 60,
        hours: [{ hour: '19:00', score: 60, ch: 0, visK: 16.5, wind: '8', pp: 0, tpw: 20 }],
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
        photoScore: 60,
        headlineScore: 60,
        photoEmoji: 'Good',
        amScore: 32,
        pmScore: 40,
        astroScore: 60,
        confidence: 'high',
        confidenceStdDev: 10,
        amConfidence: 'medium',
        pmConfidence: 'medium',
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
      }, {
        dayLabel: 'Tomorrow',
        dateKey: '2026-03-15',
        dayIdx: 1,
        photoScore: 46,
        headlineScore: 46,
        photoEmoji: 'Marginal',
        amScore: 30,
        pmScore: 24,
        astroScore: 18,
        confidence: 'medium',
        confidenceStdDev: 14,
        amConfidence: 'medium',
        pmConfidence: 'low',
        bestPhotoHour: '07:00',
        bestTags: 'poor',
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
      }, {
        dayLabel: 'Monday',
        dateKey: '2026-03-16',
        dayIdx: 2,
        photoScore: 48,
        headlineScore: 48,
        photoEmoji: 'Marginal',
        amScore: 31,
        pmScore: 26,
        astroScore: 20,
        confidence: 'medium',
        confidenceStdDev: 13,
        amConfidence: 'medium',
        pmConfidence: 'medium',
        bestPhotoHour: '18:00',
        bestTags: 'general',
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
      todayBestScore: 60,
      shSunsetQ: 70,
      shSunriseQ: 61,
      shSunsetText: 'Good texture',
      sunDir: 251,
      crepPeak: 0,
      aiText: 'Leeds has a usable evening astro slot.',
    };

    const html = formatEmail(input);

    expect(html).not.toContain('Best at 07:00 - poor');
    expect(html).not.toContain('Best at 18:00 - general');
    expect(html).toContain('Best at 07:00 - mixed conditions');
    expect(html).toContain('Best at 18:00 - mixed conditions');
  });

  it('uses astro timing when a future day headline is astro-led', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        end: '21:00',
        peak: 60,
        hours: [{ hour: '19:00', score: 60, ch: 0, visK: 16.5, wind: '8', pp: 0, tpw: 20 }],
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
        photoScore: 60,
        headlineScore: 60,
        photoEmoji: 'Good',
        amScore: 32,
        pmScore: 40,
        astroScore: 60,
        bestAstroHour: '22:00',
        confidence: 'high',
        confidenceStdDev: 10,
        amConfidence: 'medium',
        pmConfidence: 'medium',
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
      }, {
        dayLabel: 'Tomorrow',
        dateKey: '2026-03-15',
        dayIdx: 1,
        photoScore: 34,
        headlineScore: 72,
        photoEmoji: 'Excellent',
        amScore: 18,
        pmScore: 22,
        astroScore: 72,
        bestAstroHour: '03:00',
        confidence: 'medium',
        confidenceStdDev: 12,
        amConfidence: 'medium',
        pmConfidence: 'medium',
        bestPhotoHour: '07:00',
        bestTags: 'poor',
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
      todayBestScore: 60,
      shSunsetQ: 70,
      shSunriseQ: 61,
      shSunsetText: 'Good texture',
      sunDir: 251,
      crepPeak: 0,
      aiText: 'Leeds has a usable evening astro slot.',
    };

    const html = formatEmail(input);

    expect(html).toContain('Best local astro around 03:00');
    expect(html).not.toContain('Best at 07:00 - poor');
  });

  it('collapses poor-day local detail and suppresses the AI briefing block', () => {
    const input: FormatEmailInput = {
      dontBother: true,
      windows: [{
        label: 'Best chance around sunrise',
        start: '07:00',
        end: '07:00',
        peak: 46,
        hours: [{ hour: '07:00', score: 46, ch: 75, visK: 8.2, wind: '12', pp: 10, tpw: 24 }],
        tops: ['general'],
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
        photoScore: 40,
        headlineScore: 46,
        photoEmoji: 'Marginal',
        amScore: 22,
        pmScore: 18,
        astroScore: 46,
        bestAstroHour: '23:00',
        confidence: 'medium',
        confidenceStdDev: 16,
        amConfidence: 'medium',
        pmConfidence: 'medium',
        bestPhotoHour: '07:00',
        bestTags: 'poor',
        bestAlt: {
          name: 'Sutton Bank',
          driveMins: 75,
          bestScore: 65,
          bestAstroHour: '00:00',
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
        name: 'Sutton Bank',
        driveMins: 75,
        bestScore: 65,
        bestAstroHour: '00:00',
        isAstroWin: true,
        darkSky: true,
      }],
      noAltsMsg: undefined,
      sunriseStr: '06:23',
      sunsetStr: '18:07',
      moonPct: 23,
      metarNote: '',
      today: 'Saturday 14 March',
      todayBestScore: 46,
      shSunsetQ: 70,
      shSunriseQ: 61,
      shSunsetText: 'Good texture',
      sunDir: 251,
      crepPeak: 0,
      aiText: 'Conditions in Leeds are not worth shooting today. Sutton Bank is the best nearby option at 65/100.',
    };

    const html = formatEmail(input);

    expect(html).toContain('Not a great photography day locally');
    expect(html).toContain('If you still go: best chance around sunrise around 07:00 at 46/100.');
    expect(html).not.toContain('AI briefing');
    expect(html).not.toContain('Conditions in Leeds are not worth shooting today.');
    // at-a-glance must not reference the alt location score or suggest going there
    expect(html).not.toContain('If you do want to shoot');
    expect(html).not.toContain('scores 65/100 (75 min drive)');
  });

  it('strips the AI briefing opener when it restates the window label and score', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening light window',
        start: '18:00',
        end: '20:00',
        peak: 62,
        hours: [{ hour: '19:00', score: 62, ch: 40, visK: 12.0, wind: '10', pp: 5 }],
        tops: ['landscape'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 55,
        start: '14:00',
        end: '16:00',
        wind: 10,
        pp: 15,
        tmp: 11,
      },
      dailySummary: [{
        dayLabel: 'Sunday',
        dateKey: '2026-03-15',
        dayIdx: 0,
        photoScore: 62,
        headlineScore: 62,
        photoEmoji: 'Good',
        amScore: 30,
        pmScore: 62,
        astroScore: 20,
        confidence: 'medium',
        confidenceStdDev: 12,
        amConfidence: 'medium',
        pmConfidence: 'medium',
        bestPhotoHour: '19:00',
        bestTags: 'landscape',
        carWash: {
          rating: 'OK',
          label: 'Usable',
          score: 55,
          start: '14:00',
          end: '16:00',
          wind: 10,
          pp: 15,
          tmp: 11,
        },
      }],
      altLocations: [],
      noAltsMsg: undefined,
      sunriseStr: '06:20',
      sunsetStr: '18:10',
      moonPct: 50,
      metarNote: '',
      today: 'Sunday 15 March',
      todayBestScore: 62,
      shSunsetQ: 55,
      shSunriseQ: null,
      shSunsetText: 'Moderate texture',
      sunDir: 260,
      crepPeak: 0,
      aiText: 'The evening light window scores 62/100. Expect patchy cloud with good visibility for landscape work.',
    };

    const html = formatEmail(input);

    // The opener restating the window label + score should be stripped
    expect(html).not.toContain('The evening light window scores 62/100.');
    // The remaining editorial context should still be present
    expect(html).toContain('Expect patchy cloud with good visibility for landscape work.');
    expect(html).toContain('AI briefing');
  });

  it('does not strip the AI opener when the score appears before the label', () => {
    const baseWindow = {
      label: 'Evening light window',
      start: '18:00',
      end: '20:00',
      peak: 62,
      hours: [{ hour: '19:00', score: 62, ch: 40, visK: 12.0, wind: '10', pp: 5 }],
      tops: ['landscape'],
    };
    const baseInput: FormatEmailInput = {
      dontBother: false,
      windows: [baseWindow],
      todayCarWash: { rating: 'OK', label: 'Usable', score: 55, start: '14:00', end: '16:00', wind: 10, pp: 15, tmp: 11 },
      dailySummary: [{
        dayLabel: 'Sunday', dateKey: '2026-03-15', dayIdx: 0, photoScore: 62, headlineScore: 62, photoEmoji: 'Good',
        amScore: 30, pmScore: 62, astroScore: 20, confidence: 'medium', confidenceStdDev: 12,
        amConfidence: 'medium', pmConfidence: 'medium', bestPhotoHour: '19:00', bestTags: 'landscape',
        carWash: { rating: 'OK', label: 'Usable', score: 55, start: '14:00', end: '16:00', wind: 10, pp: 15, tmp: 11 },
      }],
      altLocations: [],
      noAltsMsg: undefined,
      sunriseStr: '06:20', sunsetStr: '18:10', moonPct: 50, metarNote: '',
      today: 'Sunday 15 March', todayBestScore: 62,
      shSunsetQ: 55, shSunriseQ: null, shSunsetText: 'Moderate texture', sunDir: 260, crepPeak: 0,
      // Score appears before label — not a simple restatement, should not strip
      aiText: 'A 62/100 is what the evening light window offers today. Cloud should thin by dusk.',
    };

    const html = formatEmail(baseInput);

    // Opener should be preserved since score precedes label (not a restatement pattern)
    expect(html).toContain('A 62/100 is what the evening light window offers today.');
  });

  it('does not strip the AI opener when the text has no sentence boundary', () => {
    const baseWindow = {
      label: 'Evening light window',
      start: '18:00',
      end: '20:00',
      peak: 62,
      hours: [{ hour: '19:00', score: 62, ch: 40, visK: 12.0, wind: '10', pp: 5 }],
      tops: ['landscape'],
    };
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [baseWindow],
      todayCarWash: { rating: 'OK', label: 'Usable', score: 55, start: '14:00', end: '16:00', wind: 10, pp: 15, tmp: 11 },
      dailySummary: [{
        dayLabel: 'Sunday', dateKey: '2026-03-15', dayIdx: 0, photoScore: 62, headlineScore: 62, photoEmoji: 'Good',
        amScore: 30, pmScore: 62, astroScore: 20, confidence: 'medium', confidenceStdDev: 12,
        amConfidence: 'medium', pmConfidence: 'medium', bestPhotoHour: '19:00', bestTags: 'landscape',
        carWash: { rating: 'OK', label: 'Usable', score: 55, start: '14:00', end: '16:00', wind: 10, pp: 15, tmp: 11 },
      }],
      altLocations: [],
      noAltsMsg: undefined,
      sunriseStr: '06:20', sunsetStr: '18:10', moonPct: 50, metarNote: '',
      today: 'Sunday 15 March', todayBestScore: 62,
      shSunsetQ: 55, shSunriseQ: null, shSunsetText: 'Moderate texture', sunDir: 260, crepPeak: 0,
      // Single sentence with no period — nothing to strip
      aiText: 'Evening light window scores 62/100 but patchy cloud may thin by dusk',
    };

    const html = formatEmail(input);

    expect(html).toContain('Evening light window scores 62/100 but patchy cloud may thin by dusk');
  });
});
