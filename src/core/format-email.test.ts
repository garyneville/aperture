import { describe, expect, it } from 'vitest';
import { buildKitTips, formatDebugEmail, formatEmail, type CarWash, type FormatEmailInput, type SpurOfTheMomentSuggestion, type Window } from './format-email.js';

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
        bestAstroHour: '19:00',
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
    expect(html).toContain('Peak astro');
    expect(html).toContain('Best nearby alternative');
    expect(html).toContain('Malham Cove');
    expect(html).toContain('Crescent');
    expect(html).toContain('Best time');
    expect(html).toContain('Evening astro window: 19:00-21:00 at 60/100.');
    expect(html).toContain('Peak astro sub-score is 75/100 at 19:00, with the final window score at 60/100 after full weighting.');
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

  it('surfaces a dark-phase note when a window improves after moonset', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Overnight astro window',
        start: '22:00',
        end: '00:00',
        peak: 84,
        darkPhaseStart: '23:00',
        postMoonsetScore: 84,
        hours: [{ hour: '00:00', score: 84, ch: 0, visK: 24, wind: '6', pp: 0 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: { rating: 'OK', label: 'Usable', score: 55, start: '14:00', end: '16:00', wind: 10, pp: 15, tmp: 11 },
      dailySummary: [{
        dayLabel: 'Sunday', dateKey: '2026-03-15', dayIdx: 0, photoScore: 40, headlineScore: 84, photoEmoji: 'Good',
        amScore: 0, pmScore: 0, astroScore: 84, confidence: 'medium', confidenceStdDev: 12,
        amConfidence: 'medium', pmConfidence: 'medium', bestPhotoHour: '22:00', bestTags: 'astrophotography',
        carWash: { rating: 'OK', label: 'Usable', score: 55, start: '14:00', end: '16:00', wind: 10, pp: 15, tmp: 11 },
      }],
      altLocations: [],
      noAltsMsg: undefined,
      sunriseStr: '06:20',
      sunsetStr: '18:10',
      moonPct: 60,
      metarNote: '',
      today: 'Sunday 15 March',
      todayBestScore: 84,
      shSunsetQ: 55,
      shSunriseQ: null,
      shSunsetText: 'Moderate texture',
      sunDir: 260,
      crepPeak: 0,
      aiText: 'The window improves after moonset.',
    };

    const html = formatEmail(input);

    expect(html).toContain('Dark from 23:00 - peak after moonset 84/100.');
  });
});

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
        },
        fallbackUsed: true,
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
  });
});

/* ------------------------------------------------------------------ */
/*  buildKitTips unit tests                                            */
/* ------------------------------------------------------------------ */

describe('buildKitTips', () => {
  const baseCarWash: CarWash = {
    rating: 'OK',
    label: 'Usable',
    score: 60,
    start: '15:00',
    end: '17:00',
    wind: 10,
    pp: 10,
    tmp: 12,
  };

  const baseWindows: Window[] = [{
    label: 'Evening golden hour',
    start: '18:00',
    end: '19:00',
    peak: 65,
    hours: [{ hour: '18:00', score: 65, ch: 20, visK: 20, wind: '10', pp: 10, tpw: 15 }],
    tops: ['landscape'],
  }];

  it('returns no tips when all conditions are benign', () => {
    const tips = buildKitTips(baseCarWash, baseWindows, 30, 40);
    expect(tips).toHaveLength(0);
  });

  it('returns high-wind tip when wind exceeds 25 km/h', () => {
    const tips = buildKitTips({ ...baseCarWash, wind: 30 }, baseWindows, 30, 40);
    expect(tips.some(t => t.id === 'high-wind')).toBe(true);
  });

  it('returns rain-risk tip when rain probability exceeds 40%', () => {
    const tips = buildKitTips({ ...baseCarWash, pp: 55 }, baseWindows, 30, 40);
    expect(tips.some(t => t.id === 'rain-risk')).toBe(true);
  });

  it('returns cold tip when temperature drops below 2°C', () => {
    const tips = buildKitTips({ ...baseCarWash, tmp: -1 }, baseWindows, 30, 40);
    expect(tips.some(t => t.id === 'cold')).toBe(true);
  });

  it('returns fog-mist tip when peak window hour visibility is below 5 km', () => {
    const lowVisWindows: Window[] = [{
      ...baseWindows[0],
      hours: [{ hour: '18:00', score: 65, ch: 20, visK: 2, wind: '5', pp: 5, tpw: 15 }],
    }];
    const tips = buildKitTips(baseCarWash, lowVisWindows, 30, 40);
    expect(tips.some(t => t.id === 'fog-mist')).toBe(true);
  });

  it('returns astro-window tip when astro score ≥ 60, window is astro, and moon < 60%', () => {
    const astroWindows: Window[] = [{
      label: 'Evening astro window',
      start: '22:00',
      end: '02:00',
      peak: 75,
      hours: [{ hour: '22:00', score: 75, ch: 5, visK: 25, wind: '5', pp: 0, tpw: 15 }],
      tops: ['astrophotography'],
    }];
    const tips = buildKitTips(baseCarWash, astroWindows, 70, 25);
    expect(tips.some(t => t.id === 'astro-window')).toBe(true);
  });

  it('returns astro-window tip when the astro window itself clears the threshold even if the summary astro score is missing', () => {
    const astroWindows: Window[] = [{
      label: 'Evening astro window',
      start: '22:00',
      end: '02:00',
      peak: 60,
      hours: [{ hour: '23:00', score: 60, ch: 5, visK: 25, wind: '5', pp: 0, tpw: 15 }],
      tops: ['astrophotography'],
    }];
    const tips = buildKitTips(baseCarWash, astroWindows, 0, 25);
    expect(tips.some(t => t.id === 'astro-window')).toBe(true);
  });

  it('returns astro-window tip for a later astro backup even when the first window is daylight', () => {
    const mixedWindows: Window[] = [{
      ...baseWindows[0],
    }, {
      label: 'Overnight astro window',
      start: '23:00',
      end: '02:00',
      peak: 60,
      hours: [{ hour: '00:00', score: 60, ch: 5, visK: 24, wind: '5', pp: 0, tpw: 15 }],
      tops: ['astrophotography'],
    }];
    const tips = buildKitTips(baseCarWash, mixedWindows, 0, 8);
    expect(tips.some(t => t.id === 'astro-window')).toBe(true);
    expect(tips.find(t => t.id === 'astro-window')?.text).toContain('Later astro window 23:00-02:00');
  });

  it('does not return astro-window tip when moon is too bright (≥ 60%)', () => {
    const astroWindows: Window[] = [{
      label: 'Evening astro window',
      start: '22:00',
      end: '02:00',
      peak: 75,
      hours: [{ hour: '22:00', score: 75, ch: 5, visK: 25, wind: '5', pp: 0, tpw: 15 }],
      tops: ['astrophotography'],
    }];
    const tips = buildKitTips(baseCarWash, astroWindows, 70, 80);
    expect(tips.some(t => t.id === 'astro-window')).toBe(false);
  });

  it('returns high-moisture tip when TPW is high and temperature is cool', () => {
    const highMoistureWindows: Window[] = [{
      ...baseWindows[0],
      hours: [{ hour: '18:00', score: 65, ch: 20, visK: 10, wind: '5', pp: 20, tpw: 35 }],
    }];
    const tips = buildKitTips({ ...baseCarWash, tmp: 8 }, highMoistureWindows, 30, 40);
    expect(tips.some(t => t.id === 'high-moisture')).toBe(true);
  });

  it('limits output to maxTips even when many conditions are triggered', () => {
    const tips = buildKitTips(
      { ...baseCarWash, wind: 35, pp: 60, tmp: 0 },
      baseWindows,
      30, 40,
      3,
    );
    expect(tips.length).toBeLessThanOrEqual(3);
  });

  it('returns tips sorted by priority descending', () => {
    const tips = buildKitTips(
      { ...baseCarWash, wind: 30, pp: 50 },
      baseWindows,
      30, 40,
    );
    for (let i = 1; i < tips.length; i++) {
      expect(tips[i - 1].priority).toBeGreaterThanOrEqual(tips[i].priority);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Kit advisory card rendering                                        */
/* ------------------------------------------------------------------ */

describe('kit advisory card in formatEmail', () => {
  const baseInput: FormatEmailInput = {
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
      bestPhotoHour: '18:00',
      bestTags: 'landscape',
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
    sunriseStr: '06:23',
    sunsetStr: '18:07',
    moonPct: 23,
    today: 'Saturday 14 March',
    todayBestScore: 75,
    shSunsetQ: null,
    shSunriseQ: null,
    sunDir: null,
    crepPeak: 0,
    aiText: 'Clear astro conditions expected.',
  };

  it('renders kit advisory card when a condition is triggered (high wind)', () => {
    const input: FormatEmailInput = {
      ...baseInput,
      todayCarWash: { ...baseInput.todayCarWash, wind: 35 },
    };
    const html = formatEmail(input);
    expect(html).toContain('Kit advisory');
    expect(html).toContain('High wind');
  });

  it('renders kit advisory card when rain risk is triggered', () => {
    const input: FormatEmailInput = {
      ...baseInput,
      todayCarWash: { ...baseInput.todayCarWash, pp: 55 },
    };
    const html = formatEmail(input);
    expect(html).toContain('Kit advisory');
    expect(html).toContain('Rain expected');
  });

  it('does not render kit advisory card when all conditions are benign', () => {
    const calmInput: FormatEmailInput = {
      ...baseInput,
      windows: [{
        label: 'Evening golden hour',
        start: '18:00',
        end: '19:00',
        peak: 65,
        hours: [{ hour: '18:00', score: 65, ch: 20, visK: 20, wind: '10', pp: 10, tpw: 15 }],
        tops: ['landscape'],
      }],
      todayCarWash: {
        rating: 'Good',
        label: 'Good',
        score: 80,
        start: '15:00',
        end: '18:00',
        wind: 8,
        pp: 5,
        tmp: 15,
      },
      dailySummary: [{
        ...baseInput.dailySummary[0],
        astroScore: 20,
      }],
      moonPct: 70,
    };
    const html = formatEmail(calmInput);
    expect(html).not.toContain('Kit advisory');
  });

  it('kit advisory appears after today\'s window section and before alternatives section', () => {
    const input: FormatEmailInput = {
      ...baseInput,
      todayCarWash: { ...baseInput.todayCarWash, wind: 35 },
    };
    const html = formatEmail(input);
    expect(html.indexOf('Kit advisory')).toBeGreaterThan(html.indexOf('Today\'s window'));
    expect(html.indexOf('Kit advisory')).toBeLessThan(html.indexOf('Alternatives'));
  });

  it('renders astro kit advice from a later night window even when the top window is daylight', () => {
    const input: FormatEmailInput = {
      ...baseInput,
      windows: [{
        label: 'Evening golden hour',
        start: '18:00',
        end: '19:00',
        peak: 65,
        hours: [{ hour: '18:00', score: 65, ch: 20, visK: 20, wind: '10', pp: 10, tpw: 15 }],
        tops: ['landscape'],
      }, {
        label: 'Overnight astro window',
        start: '23:00',
        end: '02:00',
        peak: 60,
        hours: [{ hour: '00:00', score: 60, ch: 5, visK: 24, wind: '5', pp: 0, tpw: 15 }],
        tops: ['astrophotography'],
      }],
      dailySummary: [{
        ...baseInput.dailySummary[0],
        astroScore: undefined,
      }],
      moonPct: 8,
    };
    const html = formatEmail(input);
    expect(html).toContain('Kit advisory');
    expect(html).toContain('Later astro window 23:00-02:00');
  });
});

describe('formatEmail spur of the moment card', () => {
  const baseInput: FormatEmailInput = {
    dontBother: false,
    windows: [{
      label: 'Evening golden hour',
      start: '18:00',
      end: '19:00',
      peak: 65,
      hours: [{ hour: '18:00', score: 65, ch: 20, visK: 20, wind: '10', pp: 10, tpw: 15 }],
      tops: ['landscape'],
    }],
    todayCarWash: {
      rating: 'OK', label: 'Usable', score: 60,
      start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 12,
    },
    dailySummary: [{
      dayLabel: 'Monday', dateKey: '2026-03-16', dayIdx: 0,
      photoScore: 65, headlineScore: 65, photoEmoji: 'Good',
      amScore: 30, pmScore: 65, astroScore: 20,
      bestPhotoHour: '18:00', bestTags: 'landscape',
      carWash: { rating: 'OK', label: 'Usable', score: 60, start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 12 },
    }],
    altLocations: [],
    sunriseStr: '06:15', sunsetStr: '18:20', moonPct: 50,
    today: 'Monday 16 March', todayBestScore: 65,
    shSunsetQ: null, shSunriseQ: null, sunDir: null, crepPeak: 0,
    aiText: 'A decent evening golden hour with good visibility.',
  };

  const aysgarthSpur: SpurOfTheMomentSuggestion = {
    locationName: 'Aysgarth Falls',
    region: 'yorkshire-dales',
    driveMins: 68,
    tags: ['waterfall', 'woodland'],
    darkSky: false,
    hookLine: 'Overcast light is perfect for waterfalls without harsh shadows.',
    confidence: 0.85,
  };

  it('renders the spur card with location name, hook line, drive time and region', () => {
    const html = formatEmail({ ...baseInput, spurOfTheMoment: aysgarthSpur });
    expect(html).toContain('Spur of the moment');
    expect(html).toContain('Aysgarth Falls');
    expect(html).toContain('Overcast light is perfect for waterfalls without harsh shadows.');
    expect(html).toContain('68 min drive');
    expect(html).toContain('Yorkshire Dales');
  });

  it('does not render the spur section when spurOfTheMoment is null', () => {
    const html = formatEmail({ ...baseInput, spurOfTheMoment: null });
    expect(html).not.toContain('Spur of the moment');
  });

  it('does not render the spur section when spurOfTheMoment is undefined', () => {
    const html = formatEmail({ ...baseInput });
    expect(html).not.toContain('Spur of the moment');
  });

  it('renders dark sky note when darkSky is true', () => {
    const darkSkySpur: SpurOfTheMomentSuggestion = {
      ...aysgarthSpur,
      locationName: 'Wastwater',
      region: 'lake-district',
      tags: ['lake', 'upland'],
      darkSky: true,
      hookLine: 'Exceptional dark sky with mountain reflections on still water.',
    };
    const html = formatEmail({ ...baseInput, spurOfTheMoment: darkSkySpur });
    expect(html).toContain('Dark sky site');
  });

  it('does not render dark sky note when darkSky is false', () => {
    const html = formatEmail({ ...baseInput, spurOfTheMoment: aysgarthSpur });
    expect(html).not.toContain('Dark sky site');
  });

  it('spur card appears after Days ahead and before the key definitions footer', () => {
    const html = formatEmail({ ...baseInput, spurOfTheMoment: aysgarthSpur });
    expect(html.indexOf('Spur of the moment')).toBeGreaterThan(html.indexOf('Days ahead'));
    expect(html.indexOf('Spur of the moment')).toBeLessThan(html.indexOf('Crepuscular rays = shafts of light'));
  });

  it('spur card does not show a score pill', () => {
    const html = formatEmail({ ...baseInput, spurOfTheMoment: aysgarthSpur });
    const spurSection = html.slice(html.indexOf('Spur of the moment'));
    expect(spurSection).not.toMatch(/\d+\/100/);
  });
});

describe('formatEmail spur-of-the-moment merge into nearby alt card', () => {
  const altLocation = {
    name: 'Sutton Bank',
    driveMins: 75,
    bestScore: 85,
    bestAstroHour: '04:00',
    bestDayHour: null as string | null | undefined,
    isAstroWin: true,
    darkSky: false,
  };

  const matchingSpur: SpurOfTheMomentSuggestion = {
    locationName: 'Sutton Bank',
    region: 'north-york-moors',
    driveMins: 75,
    tags: ['moorland', 'escarpment'],
    darkSky: false,
    hookLine: 'Darker skies await above the escarpment edge.',
    confidence: 0.9,
  };

  const baseWithAlt: FormatEmailInput = {
    dontBother: false,
    windows: [{
      label: 'Evening golden hour',
      start: '18:00',
      end: '19:00',
      peak: 65,
      hours: [{ hour: '18:00', score: 65, ch: 20, visK: 20, wind: '10', pp: 10, tpw: 15 }],
      tops: ['landscape'],
    }],
    todayCarWash: {
      rating: 'OK', label: 'Usable', score: 60,
      start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 12,
    },
    dailySummary: [{
      dayLabel: 'Monday', dateKey: '2026-03-16', dayIdx: 0,
      photoScore: 65, headlineScore: 65, photoEmoji: 'Good',
      amScore: 30, pmScore: 65, astroScore: 20,
      bestPhotoHour: '18:00', bestTags: 'landscape',
      carWash: { rating: 'OK', label: 'Usable', score: 60, start: '15:00', end: '17:00', wind: 10, pp: 10, tmp: 12 },
    }],
    altLocations: [altLocation],
    sunriseStr: '06:15', sunsetStr: '18:20', moonPct: 50,
    today: 'Monday 16 March', todayBestScore: 65,
    shSunsetQ: null, shSunriseQ: null, sunDir: null, crepPeak: 0,
    aiText: 'Conditions look reasonable locally.',
  };

  it('appends hookLine to the nearby alt card when spur location matches top alt', () => {
    const html = formatEmail({ ...baseWithAlt, spurOfTheMoment: matchingSpur });
    expect(html).toContain('Best nearby alternative');
    expect(html).toContain('Sutton Bank');
    expect(html).toContain('Darker skies await above the escarpment edge.');
  });

  it('does not render a separate Spur of the moment section when spur matches top alt', () => {
    const html = formatEmail({ ...baseWithAlt, spurOfTheMoment: matchingSpur });
    expect(html).not.toContain('Spur of the moment');
  });

  it('hookLine appears inside the Best nearby alternative section, not after Days ahead', () => {
    const html = formatEmail({ ...baseWithAlt, spurOfTheMoment: matchingSpur });
    const altPos = html.indexOf('Best nearby alternative');
    const daysAheadPos = html.indexOf('Days ahead');
    const hookPos = html.indexOf('Darker skies await above the escarpment edge.');
    expect(altPos).toBeGreaterThan(-1);
    expect(hookPos).toBeGreaterThan(altPos);
    expect(hookPos).toBeLessThan(daysAheadPos);
  });

  it('renders a separate spur card when spur location differs from top alt', () => {
    const differentSpur: SpurOfTheMomentSuggestion = {
      locationName: 'Aysgarth Falls',
      region: 'yorkshire-dales',
      driveMins: 68,
      tags: ['waterfall', 'woodland'],
      darkSky: false,
      hookLine: 'Overcast light is perfect for waterfalls without harsh shadows.',
      confidence: 0.85,
    };
    const html = formatEmail({ ...baseWithAlt, spurOfTheMoment: differentSpur });
    expect(html).toContain('Spur of the moment');
    expect(html).toContain('Aysgarth Falls');
    expect(html).toContain('Overcast light is perfect for waterfalls without harsh shadows.');
    // Alt card should NOT show the different spur's hookLine
    const altSection = html.slice(html.indexOf('Best nearby alternative'), html.indexOf('Days ahead'));
    expect(altSection).not.toContain('Overcast light is perfect for waterfalls');
  });

  it('hookLine is escaped correctly when it contains special characters', () => {
    const spurWithSpecialChars: SpurOfTheMomentSuggestion = {
      ...matchingSpur,
      hookLine: "It's a <great> day & night.",
    };
    const html = formatEmail({ ...baseWithAlt, spurOfTheMoment: spurWithSpecialChars });
    expect(html).not.toContain("It's a <great>");
    expect(html).toContain('&#39;');
    expect(html).toContain('&lt;great&gt;');
    expect(html).toContain('&amp;');
  });
});
