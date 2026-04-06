import { describe, expect, it } from 'vitest';
import { formatEmail, type FormatEmailInput, type SpurOfTheMomentSuggestion, type Window } from './index.js';
import { todayWindowSection } from './time-aware.js';
import type { RunTimeContext } from './types.js';

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

    expect(html).toContain('class="hero-score"');
    expect(html).toContain('>75</div>');
    expect(html).toContain('>Excellent</div>');
    expect(html).toContain('AM light');
    expect(html).toContain('PM light');
    expect(html).toContain('Peak astro');
    expect(html).toContain('Best nearby astro alternative');
    expect(html).toContain('Malham Cove');
    expect(html).toContain('Crescent');
    expect(html).toContain('Low moon glow — good for astrophotography');
    expect(html).toContain('Best astro');
    expect(html).toContain('Evening astro window: 19:00-21:00 at 60/100.');
    expect(html).toContain('The window tops out at 60/100 overall despite a raw astro peak of 75/100 (19:00).');
    expect(html).toContain('Daylight utility');
    expect(html).toContain('&#x1F697; / &#x1F6B6;');
    expect(html).toContain('>Dew risk</span> Moderate');
    expect(html).not.toContain('Moisture');
    expect(html).not.toContain('TPW');
    expect(html).not.toContain('5-day car wash');
    expect(html).toContain('&middot;');
    expect(html).not.toContain('Sunrise</span> 06:23</span><span');
    expect(html).not.toContain('AM</span> 32 ·');
    expect(html).not.toContain('PM</span> 40 ·');
    expect(html).toContain('Days ahead');
    expect(html).not.toContain('5-day photography');
    expect(html).toContain('Key');
    expect(html).toContain('Score bands');
    expect(html).toContain('Excellent');
    expect(html).toContain('Good 58');
    expect(html).toContain('Marginal 42');
    expect(html).toContain('Poor');
    expect(html).toContain('Crepuscular rays = shafts of light');
    // at-a-glance must not restate peak time already visible in the hero grid
    expect(html).not.toContain('right as the window opens');
    expect(html).not.toContain('near the end of the window');
    expect(html).not.toContain('within the window');
    // at-a-glance must not include alternative score deltas — metric language banned (issue #71)
    expect(html).not.toContain('adds 25 points');
    expect(html).not.toContain('points stronger');
    // Today at a glance is Leeds-only: alternative location must not appear in the summary (issue #71)
    expect(html).not.toContain('Or consider Malham Cove instead');
    // Malham Cove still appears in the dedicated "Best nearby alternative" card, not the at-a-glance
    expect(html).toContain('Malham Cove');
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

  it('promotes the next future window and switches the outlook to remaining today on midday reruns', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        hours: [{ hour: '03:00', score: 56, ch: 0, visK: 12, wind: '5', pp: 0, tpw: 20 }],
        tops: ['astrophotography'],
      }, {
        label: 'Evening golden hour',
        start: '18:00',
        end: '18:00',
        peak: 53,
        hours: [{ hour: '18:00', score: 53, ch: 0, visK: 12.6, wind: '4', pp: 0, tpw: 20 }],
        tops: ['landscape', 'clear light path'],
      }, {
        label: 'Evening astro window',
        start: '21:00',
        end: '23:00',
        peak: 51,
        hours: [{ hour: '22:00', score: 51, ch: 1, visK: 8.1, wind: '9', pp: 0, tpw: 20 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 60,
        start: '06:00',
        end: '08:00',
        wind: 10,
        pp: 0,
        tmp: 7,
      },
      dailySummary: [{
        dayLabel: 'Today',
        dateKey: '2026-03-18',
        dayIdx: 0,
        photoScore: 60,
        headlineScore: 60,
        photoEmoji: '👍',
        amScore: 50,
        pmScore: 57,
        astroScore: 68,
        bestAstroHour: '03:00',
        confidence: 'high',
        confidenceStdDev: 8,
        astroConfidence: 'high',
        astroConfidenceStdDev: 7,
        bestPhotoHour: '03:00',
        bestTags: 'astrophotography',
        carWash: { rating: 'OK', label: 'Usable', score: 60, start: '06:00', end: '08:00', wind: 10, pp: 0, tmp: 7 },
        hours: [
          { hour: '12:00', tmp: 13, pp: 0, wind: 7, gusts: 9, visK: 15.8, pr: 0, ct: 0, isNight: false },
          { hour: '13:00', tmp: 14, pp: 1, wind: 8, gusts: 10, visK: 16.4, pr: 0, ct: 1, isNight: false },
          { hour: '18:00', tmp: 12, pp: 2, wind: 6, gusts: 8, visK: 15.5, pr: 0, ct: 2, isNight: false },
          { hour: '21:00', tmp: 9, pp: 0, wind: 7, gusts: 9, visK: 9.2, pr: 0, ct: 0, isNight: true },
        ],
      }, {
        dayLabel: 'Tomorrow',
        dateKey: '2026-03-19',
        dayIdx: 1,
        photoScore: 63,
        headlineScore: 63,
        photoEmoji: '👍',
        amScore: 29,
        pmScore: 60,
        astroScore: 61,
        carWash: { rating: 'Great', label: 'Great', score: 80, start: '06:00', end: '18:00', wind: 7, pp: 0, tmp: 11 },
        hours: [
          { hour: '09:00', tmp: 11, pp: 0, wind: 8, gusts: 10, visK: 12, pr: 0, ct: 20, isNight: false },
        ],
      }],
      altLocations: [],
      sunriseStr: '06:13',
      sunsetStr: '18:15',
      moonPct: 1,
      today: 'Wednesday 18 March',
      todayBestScore: 60,
      shSunsetQ: null,
      shSunriseQ: null,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Dark-sky conditions improve from 00:00 once the moon is down. Peak local time is around 03:00, within the midnight astro window.',
      debugContext: {
        metadata: {
          generatedAt: '2026-03-18T11:30:00.000Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.57,
          timezone: 'Europe/London',
          workflowVersion: 'debug-trace-v1',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    };

    const html = formatEmail(input);

    expect(html).toContain('Next window');
    expect(html).toContain('Earlier today');
    expect(html).toContain('Evening golden hour');
    expect(html).toContain('Midnight astro window');
    expect(html).toContain('Remaining today');
    expect(html).toContain('Today from 12:00');
    expect(html).toContain('Next photo windows: Evening golden hour 18:00');
    expect(html).not.toContain('Earlier daylight utility');
    expect(html).not.toContain('Tomorrow&#39;s weather');
  });

  it('keeps the debug outdoor trace aligned with the rendered remaining-today outlook', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Late morning local window',
        start: '09:00',
        end: '10:00',
        peak: 58,
        hours: [{ hour: '09:00', score: 58, ch: 10, visK: 18, wind: '10', pp: 0, tpw: 18 }],
        tops: ['landscape'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 60,
        start: '09:00',
        end: '11:00',
        wind: 18,
        pp: 0,
        tmp: 7,
      },
      dailySummary: [{
        dayLabel: 'Today',
        dateKey: '2026-03-30',
        dayIdx: 0,
        photoScore: 58,
        headlineScore: 58,
        photoEmoji: 'Good',
        amScore: 58,
        pmScore: 24,
        astroScore: 12,
        confidence: 'high',
        confidenceStdDev: 8,
        bestPhotoHour: '09:00',
        bestTags: 'landscape',
        carWash: {
          rating: 'OK',
          label: 'Usable',
          score: 60,
          start: '09:00',
          end: '11:00',
          wind: 18,
          pp: 0,
          tmp: 7,
        },
        hours: [
          { hour: '09:00', tmp: 6, pp: 0, wind: 26, gusts: 32, visK: 20, pr: 0, ct: 20, isNight: false },
          { hour: '10:00', tmp: 7, pp: 0, wind: 26, gusts: 32, visK: 20, pr: 0, ct: 20, isNight: false },
        ],
      }, {
        dayLabel: 'Tomorrow',
        dateKey: '2026-03-31',
        dayIdx: 1,
        photoScore: 70,
        headlineScore: 70,
        photoEmoji: 'Excellent',
        amScore: 70,
        pmScore: 64,
        astroScore: 18,
        confidence: 'high',
        confidenceStdDev: 6,
        bestPhotoHour: '09:00',
        bestTags: 'landscape',
        carWash: {
          rating: 'Good',
          label: 'Favourable',
          score: 82,
          start: '09:00',
          end: '12:00',
          wind: 10,
          pp: 0,
          tmp: 13,
        },
        hours: [
          { hour: '09:00', tmp: 12, pp: 0, wind: 10, gusts: 14, visK: 20, pr: 0, ct: 15, isNight: false },
          { hour: '10:00', tmp: 13, pp: 0, wind: 10, gusts: 14, visK: 20, pr: 0, ct: 15, isNight: false },
        ],
      }],
      altLocations: [],
      sunriseStr: '06:40',
      sunsetStr: '19:34',
      moonPct: 12,
      today: 'Monday 30 March',
      todayBestScore: 58,
      shSunsetQ: null,
      shSunriseQ: null,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Usable local conditions through late morning.',
      debugContext: {
        metadata: {
          generatedAt: '2026-03-30T08:00:00.000Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.57,
          timezone: 'Europe/London',
          workflowVersion: 'debug-trace-v1',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    };

    const html = formatEmail(input);

    expect(html).toContain('Remaining today');
    expect(input.debugContext?.outdoorComfort?.hours).toHaveLength(2);
    expect(input.debugContext?.outdoorComfort?.hours[0]).toMatchObject({
      hour: '09:00',
      tmp: 6,
      wind: 26,
      comfortScore: 75,
      label: 'Morning walk',
    });
    expect(input.debugContext?.outdoorComfort?.hours[0].tmp).not.toBe(12);
  });

  it('treats overnight windows as live once the evening start time has passed', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Overnight astro window',
        start: '23:00',
        end: '02:00',
        peak: 61,
        hours: [{ hour: '23:00', score: 61, ch: 2, visK: 18, wind: '6', pp: 0, tpw: 18 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 70,
        start: '12:00',
        end: '15:00',
        wind: 8,
        pp: 0,
        tmp: 8,
      },
      dailySummary: [{
        dayLabel: 'Today',
        dateKey: '2026-03-18',
        dayIdx: 0,
        photoScore: 61,
        headlineScore: 61,
        photoEmoji: '👍',
        amScore: 35,
        pmScore: 44,
        astroScore: 68,
        confidence: 'high',
        confidenceStdDev: 6,
        astroConfidence: 'high',
        astroConfidenceStdDev: 6,
        bestPhotoHour: '23:00',
        bestAstroHour: '23:00',
        bestTags: 'astrophotography',
        carWash: { rating: 'OK', label: 'Usable', score: 70, start: '12:00', end: '15:00', wind: 8, pp: 0, tmp: 8 },
      }],
      altLocations: [],
      sunriseStr: '06:13',
      sunsetStr: '18:15',
      moonPct: 8,
      today: 'Wednesday 18 March',
      todayBestScore: 61,
      shSunsetQ: null,
      shSunriseQ: null,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Tonight is the local astro slot.',
      debugContext: {
        metadata: {
          generatedAt: '2026-03-18T23:30:00.000Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.57,
          timezone: 'Europe/London',
          workflowVersion: 'debug-trace-v1',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    };

    const html = formatEmail(input);

    expect(html).toContain('Live now');
    expect(html).toContain('Overnight astro window');
    expect(html).not.toContain('Next window');
    expect(html).not.toContain('Earlier today');
  });

  it('treats overnight windows as live in the early-morning carry-over period', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Overnight astro window',
        start: '23:00',
        end: '02:00',
        peak: 61,
        hours: [{ hour: '01:00', score: 61, ch: 2, visK: 18, wind: '6', pp: 0, tpw: 18 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 70,
        start: '12:00',
        end: '15:00',
        wind: 8,
        pp: 0,
        tmp: 8,
      },
      dailySummary: [{
        dayLabel: 'Today',
        dateKey: '2026-03-19',
        dayIdx: 0,
        photoScore: 61,
        headlineScore: 61,
        photoEmoji: '👍',
        amScore: 35,
        pmScore: 44,
        astroScore: 68,
        confidence: 'high',
        confidenceStdDev: 6,
        astroConfidence: 'high',
        astroConfidenceStdDev: 6,
        bestPhotoHour: '01:00',
        bestAstroHour: '01:00',
        bestTags: 'astrophotography',
        carWash: { rating: 'OK', label: 'Usable', score: 70, start: '12:00', end: '15:00', wind: 8, pp: 0, tmp: 8 },
      }],
      altLocations: [],
      sunriseStr: '06:11',
      sunsetStr: '18:17',
      moonPct: 8,
      today: 'Thursday 19 March',
      todayBestScore: 61,
      shSunsetQ: null,
      shSunriseQ: null,
      sunDir: null,
      crepPeak: 0,
      aiText: 'The overnight astro slot is still live after midnight.',
      debugContext: {
        metadata: {
          generatedAt: '2026-03-19T01:00:00.000Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.57,
          timezone: 'Europe/London',
          workflowVersion: 'debug-trace-v1',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    };

    const html = formatEmail(input);

    expect(html).toContain('Live now');
    expect(html).toContain('Overnight astro window');
    expect(html).not.toContain('Next window');
    expect(html).not.toContain('Earlier today');
  });

  it('escapes dynamic time-aware card content', () => {
    const html = formatEmail({
      dontBother: false,
      windows: [{
        label: 'Evening <astro> & window',
        start: '19:00',
        end: '21:00',
        peak: 60,
        darkPhaseStart: '20:30',
        postMoonsetScore: 65,
        hours: [{ hour: '19:00', score: 60, ch: 0, visK: 16.5, wind: '8', pp: 0, tpw: 20, crepuscular: 50 }],
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
        bestPhotoHour: '19:00',
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
      compositionBullets: ['Frame the <north> skyline & wait.'],
    });

    expect(html).toContain('Evening &lt;astro&gt; &amp; window');
    expect(html).toContain('Frame the &lt;north&gt; skyline &amp; wait.');
    expect(html).not.toContain('Evening <astro> & window');
    expect(html).not.toContain('Frame the <north> skyline & wait.');
  });

  it('escapes the poor-day fallback line', () => {
    const runTime: RunTimeContext = { nowMinutes: 12 * 60, nowLabel: '12:00', timezone: 'Europe/London' };
    const windows: Window[] = [{
      label: 'Fallback <slot> & window',
      start: '19:00',
      end: '21:00',
      peak: 38,
      hours: [{ hour: '19:00', score: 38, ch: 80, visK: 8, wind: '18', pp: 70, tpw: 24 }],
      tops: ['landscape'],
    }];
    const html = todayWindowSection(
      true,
      38,
      'Poor conditions.',
      windows,
      [],
      [],
      runTime,
      null,
      [],
    );

    expect(html).toContain('If you still go: fallback &lt;slot&gt; &amp; window around 19:00 at 38/100.');
    expect(html).not.toContain('If you still go: fallback <slot> & window around 19:00 at 38/100.');
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

  it('groups nearby alternatives into astro and golden-hour sections', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Best chance around sunrise',
        start: '07:00',
        end: '07:00',
        peak: 36,
        hours: [{ hour: '07:00', score: 36, ch: 15, visK: 18, wind: '8', pp: 10, tpw: 16 }],
        tops: ['landscape'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 58,
        start: '06:00',
        end: '08:00',
        wind: 9,
        pp: 12,
        tmp: 7,
      },
      dailySummary: [{
        dayLabel: 'Monday',
        dateKey: '2026-03-16',
        dayIdx: 0,
        photoScore: 36,
        headlineScore: 36,
        photoEmoji: 'Marginal',
        amScore: 36,
        pmScore: 18,
        astroScore: 22,
        confidence: 'high',
        confidenceStdDev: 6,
        amConfidence: 'high',
        pmConfidence: 'medium',
        bestPhotoHour: '07:00',
        bestTags: 'landscape',
        carWash: {
          rating: 'OK',
          label: 'Usable',
          score: 58,
          start: '06:00',
          end: '08:00',
          wind: 9,
          pp: 12,
          tmp: 7,
        },
      }],
      altLocations: [{
        name: 'Brimham Rocks',
        driveMins: 40,
        bestScore: 81,
        bestAstroHour: '02:00',
        isAstroWin: true,
        darkSky: false,
      }, {
        name: 'Bolton Abbey',
        driveMins: 35,
        bestScore: 64,
        bestDayHour: '06:45',
        isAstroWin: false,
        darkSky: false,
      }],
      noAltsMsg: undefined,
      sunriseStr: '06:18',
      sunsetStr: '18:11',
      moonPct: 8,
      metarNote: '',
      today: 'Monday 16 March',
      todayBestScore: 36,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Leeds has a narrow sunrise option, but stronger alternatives exist if you can travel.',
    };

    const html = formatEmail(input);

    expect(html).toContain('Best nearby astro alternative');
    expect(html).toContain('Nearby astro options');
    expect(html).toContain('Brimham Rocks');
    expect(html).toContain('Astro - best 02:00 - 40 min drive');
    expect(html).toContain('Nearby landscape options');
    expect(html).toContain('Bolton Abbey');
    expect(html).toContain('Morning golden hour - best 06:45 - 35 min drive');
  });

  it('renders close contenders as a weaker darker-sky bucket', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '21:00',
        end: '23:00',
        peak: 56,
        hours: [{ hour: '22:00', score: 56, ch: 0, visK: 9.5, wind: '7', pp: 0, tpw: 18 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 58,
        start: '10:00',
        end: '12:00',
        wind: 9,
        pp: 10,
        tmp: 8,
      },
      dailySummary: [{
        dayLabel: 'Monday',
        dateKey: '2026-03-16',
        dayIdx: 0,
        photoScore: 56,
        headlineScore: 60,
        photoEmoji: 'Marginal',
        amScore: 32,
        pmScore: 44,
        astroScore: 68,
        confidence: 'high',
        confidenceStdDev: 7,
        astroConfidence: 'high',
        astroConfidenceStdDev: 7,
        bestPhotoHour: '22:00',
        bestAstroHour: '22:00',
        bestTags: 'astrophotography',
        carWash: {
          rating: 'OK',
          label: 'Usable',
          score: 58,
          start: '10:00',
          end: '12:00',
          wind: 9,
          pp: 10,
          tmp: 8,
        },
      }],
      altLocations: [],
      closeContenders: [{
        name: 'Malham Cove',
        driveMins: 55,
        bestScore: 68,
        bestAstroHour: '00:00',
        isAstroWin: true,
        darkSky: true,
        amScore: 24,
        pmScore: 30,
        astroScore: 68,
        siteDarkness: { bortle: 3 },
      }],
      noAltsMsg: undefined,
      sunriseStr: '06:18',
      sunsetStr: '18:11',
      moonPct: 8,
      metarNote: '',
      today: 'Monday 16 March',
      todayBestScore: 60,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Leeds is usable after dark, but darker sites are still worth considering.',
    };

    const html = formatEmail(input);

    expect(html).toContain('Worth a look for darker skies');
    expect(html).toContain('These do not clear the main trip threshold');
    expect(html).toContain('Malham Cove');
    expect(html).toContain('Darker-sky near miss - astro best 00:00 - 55 min drive · B3');
    expect(html).toContain('Nearby darker-sky contender');
  });

  it('adds an aurora note to the primary astro window when Kp clears the local threshold', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Midnight astro window',
        start: '00:00',
        end: '04:00',
        peak: 56,
        hours: [{ hour: '03:00', score: 56, ch: 0, visK: 12, wind: '5', pp: 0, tpw: 18 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Usable',
        score: 58,
        start: '10:00',
        end: '12:00',
        wind: 9,
        pp: 10,
        tmp: 8,
      },
      dailySummary: [{
        dayLabel: 'Wednesday',
        dateKey: '2026-03-18',
        dayIdx: 0,
        photoScore: 56,
        headlineScore: 60,
        photoEmoji: 'Marginal',
        amScore: 32,
        pmScore: 44,
        astroScore: 68,
        confidence: 'high',
        confidenceStdDev: 7,
        astroConfidence: 'high',
        astroConfidenceStdDev: 7,
        bestPhotoHour: '03:00',
        bestAstroHour: '03:00',
        bestTags: 'astrophotography',
        carWash: {
          rating: 'OK',
          label: 'Usable',
          score: 58,
          start: '10:00',
          end: '12:00',
          wind: 9,
          pp: 10,
          tmp: 8,
        },
      }],
      altLocations: [],
      sunriseStr: '06:13',
      sunsetStr: '18:15',
      moonPct: 1,
      metarNote: '',
      today: 'Wednesday 18 March',
      todayBestScore: 60,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Conditions improve through the midnight astro window. Peak local time is around 03:00, with the cleanest sky late in the slot.',
      peakKpTonight: 6.3,
    };

    const html = formatEmail(input);

    expect(html).toContain('Coincides with an active aurora signal (Kp 6.3 vs local threshold Kp 6) - favour a clean northern horizon.');
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
    
    expect(html).not.toContain('AI briefing');
    expect(html).not.toContain('Conditions in Leeds are not worth shooting today.');
    // at-a-glance must not reference the alt location score or suggest going there
    expect(html).not.toContain('If you do want to shoot');
    expect(html).not.toContain('scores 65/100 (75 min drive)');
  });

  it('surfaces a strong specialist session without reverting to no-window copy', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Best urban session',
        start: '03:00',
        end: '03:00',
        peak: 67,
        fallback: true,
        hours: [{ hour: '03:00', score: 2, ch: 98, visK: 11.1, wind: '8', pp: 0 }],
        tops: ['urban'],
      }],
      todayCarWash: {
        rating: 'Great',
        label: 'Great',
        score: 95,
        start: '08:00',
        end: '10:00',
        wind: 16,
        pp: 0,
        tmp: 8,
      },
      dailySummary: [{
        dayLabel: 'Monday',
        dateKey: '2026-03-30',
        dayIdx: 0,
        photoScore: 47,
        headlineScore: 47,
        photoEmoji: 'Marginal',
        amScore: 26,
        pmScore: 44,
        astroScore: 41,
        confidence: 'medium',
        confidenceStdDev: 20,
        amConfidence: 'low',
        pmConfidence: 'medium',
        astroConfidence: 'medium',
        astroConfidenceStdDev: 24,
        bestPhotoHour: '03:00',
        bestTags: 'urban',
        carWash: {
          rating: 'Great',
          label: 'Great',
          score: 95,
          start: '08:00',
          end: '10:00',
          wind: 16,
          pp: 0,
          tmp: 8,
        },
      }],
      altLocations: [],
      noAltsMsg: undefined,
      sunriseStr: '07:43',
      sunsetStr: '20:37',
      moonPct: 87,
      metarNote: '',
      today: 'Monday 30 March',
      todayBestScore: 47,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Urban conditions are strongest before dawn while the broader day stays mediocre.',
      sessionRecommendation: {
        primary: {
          session: 'urban',
          hourLabel: '03:00',
          score: 67,
          hardPass: true,
          confidence: 'low',
          volatility: 22,
          reasons: ['Wet streets and city light should hold up best before dawn.'],
          warnings: ['Confidence is low because model spread is still fairly wide.'],
          requiredCapabilities: [],
        },
        runnerUps: [{
          session: 'long-exposure',
          hourLabel: '06:00',
          score: 36,
          hardPass: true,
          confidence: 'low',
          volatility: 21,
          reasons: [],
          warnings: [],
          requiredCapabilities: [],
        }],
        bySession: [],
        hoursAnalyzed: 24,
        planB: null,
        alerts: [],
      },
    };

    const html = formatEmail(input);

    expect(html).toContain('Best urban session');
    expect(html).toContain('Best session today');
    expect(html).toContain('Urban at 03:00');
    expect(html).toContain('Low confidence');
    expect(html).toContain('Spread 22 pts');
    expect(html).toContain('Runner-up: Long exposure at 06:00 (36/100).');
    expect(html).not.toContain('No clear window today');
    expect(html).not.toContain('Not a great photography day locally');
  });

  it('strips the AI briefing opener when it restates the window label and score', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Overnight astro window',
        start: '04:00',
        end: '04:00',
        peak: 60,
        hours: [{ hour: '04:00', score: 60, ch: 10, visK: 20.5, wind: '6', pp: 0 }],
        tops: ['astrophotography'],
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
        photoScore: 60,
        headlineScore: 72,
        photoEmoji: 'Good',
        amScore: 30,
        pmScore: 35,
        astroScore: 72,
        confidence: 'medium',
        confidenceStdDev: 12,
        amConfidence: 'medium',
        pmConfidence: 'medium',
        bestPhotoHour: '04:00',
        bestTags: 'astrophotography',
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
      todayBestScore: 60,
      shSunsetQ: 55,
      shSunriseQ: null,
      shSunsetText: 'Moderate texture',
      sunDir: 260,
      crepPeak: 0,
      aiText: 'Overnight astro window at 04:00 scores 60/100, peak time with 20.5km visibility. Darker skies arrive after moonset, so the wider night still carries more promise than this narrow slot.',
    };

    const html = formatEmail(input);

    // The opener restating the window label + score should be stripped
    expect(html).not.toContain('Overnight astro window at 04:00 scores 60/100, peak time with 20.5km visibility.');
    // The remaining editorial context should still be present
    expect(html).toContain('Darker skies arrive after moonset, so the wider night still carries more promise than this narrow slot.');
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

  it('renders a no-window day as a local pass even if dontBother was not set upstream', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [],
      todayCarWash: { rating: 'OK', label: 'Great', score: 60, start: '06:00', end: '08:00', wind: 12, pp: 22, tmp: 5 },
      dailySummary: [{
        dayLabel: 'Monday', dateKey: '2026-03-16', dayIdx: 0,
        photoScore: 32, headlineScore: 42, photoEmoji: 'Marginal',
        amScore: 32, pmScore: 15, astroScore: 52, confidence: 'high', confidenceStdDev: 5,
        astroConfidence: 'high', astroConfidenceStdDev: 11,
        amConfidence: 'high', pmConfidence: 'high', bestPhotoHour: '07:00', bestTags: 'landscape, clear light path',
        bestAstroHour: '04:00', darkSkyStartsAt: '00:00',
        carWash: { rating: 'OK', label: 'Great', score: 60, start: '06:00', end: '08:00', wind: 12, pp: 22, tmp: 5 },
      }],
      altLocations: [{
        name: 'Brimham Rocks',
        driveMins: 40,
        bestScore: 81,
        bestDayHour: null,
        bestAstroHour: '02:00',
        isAstroWin: true,
        darkSky: false,
      }],
      noAltsMsg: undefined,
      sunriseStr: '06:18',
      sunsetStr: '18:11',
      moonPct: 8,
      metarNote: '',
      today: 'Monday 16 March',
      todayBestScore: 47,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Darkness improves from 00:00. Consider Brimham Rocks today.',
    };

    const html = formatEmail(input);

    expect(html).toContain('Best time');
    expect(html).toContain('No clear slot');
    expect(html).not.toContain('No clear local window');
    expect(html).toContain('No local window cleared the threshold today');
    expect(html).not.toContain('Best time</span> 07:00');
    expect(html).not.toContain('Best local setup: 07:00');
    expect(html).not.toContain('Shot ideas');
  });

  it('shows Dew risk High for TPW above 30mm', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        end: '21:00',
        peak: 60,
        hours: [{ hour: '19:00', score: 60, ch: 0, visK: 16.5, wind: '8', pp: 0, tpw: 35 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: { rating: 'OK', label: 'Usable', score: 60, start: '15:00', end: '17:00', wind: 14, pp: 24, tmp: 9 },
      dailySummary: [],
      altLocations: [],
      noAltsMsg: undefined,
      sunriseStr: '06:23',
      sunsetStr: '18:07',
      moonPct: 23,
      metarNote: '',
      today: 'Saturday 14 March',
      todayBestScore: 60,
      shSunsetQ: 70,
      shSunriseQ: null,
      shSunsetText: 'Good texture',
      sunDir: 251,
      crepPeak: 0,
      aiText: '',
    };
    const html = formatEmail(input);
    expect(html).toContain('>Dew risk</span> High');
    expect(html).not.toContain('Moisture');
    expect(html).not.toContain('TPW');
  });

  it('omits dew risk entry for TPW below 15mm', () => {
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [{
        label: 'Evening astro window',
        start: '19:00',
        end: '21:00',
        peak: 60,
        hours: [{ hour: '19:00', score: 60, ch: 0, visK: 16.5, wind: '8', pp: 0, tpw: 10 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: { rating: 'OK', label: 'Usable', score: 60, start: '15:00', end: '17:00', wind: 14, pp: 24, tmp: 9 },
      dailySummary: [],
      altLocations: [],
      noAltsMsg: undefined,
      sunriseStr: '06:23',
      sunsetStr: '18:07',
      moonPct: 23,
      metarNote: '',
      today: 'Saturday 14 March',
      todayBestScore: 60,
      shSunsetQ: 70,
      shSunriseQ: null,
      shSunsetText: 'Good texture',
      sunDir: 251,
      crepPeak: 0,
      aiText: '',
    };
    const html = formatEmail(input);
    expect(html).not.toContain('Dew risk');
    expect(html).not.toContain('Moisture');
    expect(html).not.toContain('TPW');
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
    expect(html).toContain('Best nearby astro alternative');
    expect(html).toContain('Sutton Bank');
    expect(html).toContain('Darker skies await above the escarpment edge.');
  });

  it('does not render a separate Spur of the moment section when spur matches top alt', () => {
    const html = formatEmail({ ...baseWithAlt, spurOfTheMoment: matchingSpur });
    expect(html).not.toContain('Spur of the moment');
  });

  it('hookLine appears inside the Best nearby astro alternative section, not after Days ahead', () => {
    const html = formatEmail({ ...baseWithAlt, spurOfTheMoment: matchingSpur });
    const altPos = html.indexOf('Best nearby astro alternative');
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
    const altSection = html.slice(html.indexOf('Best nearby astro alternative'), html.indexOf('Days ahead'));
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

describe('formatEmail long-range section', () => {
  it('renders the long-range card when a qualified long-range recommendation is present', () => {
    const html = formatEmail({
      dontBother: true,
      windows: [],
      todayCarWash: {
        rating: 'OK',
        label: 'Great',
        score: 60,
        start: '06:00',
        end: '08:00',
        wind: 12,
        pp: 22,
        tmp: 5,
      },
      dailySummary: [{
        dayLabel: 'Monday',
        dateKey: '2026-03-16',
        dayIdx: 0,
        photoScore: 32,
        headlineScore: 42,
        photoEmoji: 'Marginal',
        amScore: 32,
        pmScore: 19,
        astroScore: 52,
        confidence: 'high',
        confidenceStdDev: 5,
        astroConfidence: 'high',
        astroConfidenceStdDev: 11,
        amConfidence: 'high',
        pmConfidence: 'high',
        bestPhotoHour: '07:00',
        bestTags: 'landscape, clear light path',
        bestAstroHour: '04:00',
        darkSkyStartsAt: '00:00',
        carWash: {
          rating: 'OK',
          label: 'Great',
          score: 60,
          start: '06:00',
          end: '08:00',
          wind: 12,
          pp: 22,
          tmp: 5,
        },
      }],
      altLocations: [{
        name: 'Brimham Rocks',
        driveMins: 40,
        bestScore: 81,
        bestDayHour: null,
        bestAstroHour: '02:00',
        isAstroWin: true,
        darkSky: false,
      }],
      noAltsMsg: undefined,
      sunriseStr: '06:18',
      sunsetStr: '18:11',
      moonPct: 8,
      metarNote: '',
      today: 'Monday 16 March',
      todayBestScore: 42,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Leeds is not worth it today due to poor conditions. Brimham Rocks is a better alternative.',
      longRangeTop: {
        name: 'Goathland',
        region: 'north-york-moors',
        driveMins: 74,
        tags: ['waterfall', 'moorland'],
        darkSky: true,
        elevation: 170,
        bestScore: 88,
        bestDayHour: '07:00',
        bestAstroHour: '02:00',
        isAstroWin: true,
      },
      longRangeCardLabel: 'Weekend opportunity',
      darkSkyAlert: {
        name: 'Goathland',
        region: 'north-york-moors',
        driveMins: 74,
        astroScore: 88,
        bestAstroHour: '02:00',
      },
    });

    expect(html).toContain('Out of town options');
    expect(html).toContain('Long-range opportunity');
    expect(html).toContain('Goathland');
    expect(html).toContain('88/100 astro');
    expect(html).toContain('Best astro around 02:00 - dark sky site');
    expect(html).not.toContain('Dark sky alert</div>');
  });

  it('adds road-trip framing for very long long-range recommendations', () => {
    const html = formatEmail({
      dontBother: true,
      windows: [],
      todayCarWash: {
        rating: 'OK',
        label: 'Great',
        score: 60,
        start: '06:00',
        end: '08:00',
        wind: 12,
        pp: 22,
        tmp: 5,
      },
      dailySummary: [{
        dayLabel: 'Monday',
        dateKey: '2026-03-16',
        dayIdx: 0,
        photoScore: 32,
        headlineScore: 42,
        photoEmoji: 'Marginal',
        amScore: 32,
        pmScore: 19,
        astroScore: 52,
        confidence: 'high',
        confidenceStdDev: 5,
        astroConfidence: 'high',
        astroConfidenceStdDev: 11,
        amConfidence: 'high',
        pmConfidence: 'high',
        bestPhotoHour: '07:00',
        bestTags: 'landscape',
        bestAstroHour: '04:00',
        darkSkyStartsAt: '00:00',
        carWash: {
          rating: 'OK',
          label: 'Great',
          score: 60,
          start: '06:00',
          end: '08:00',
          wind: 12,
          pp: 22,
          tmp: 5,
        },
      }],
      altLocations: [],
      sunriseStr: '06:18',
      sunsetStr: '18:11',
      moonPct: 8,
      metarNote: '',
      today: 'Monday 16 March',
      todayBestScore: 42,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Leeds is not worth it today.',
      longRangeTop: {
        name: 'Snowdon (Yr Wyddfa)',
        region: 'snowdonia',
        driveMins: 215,
        tags: ['upland'],
        darkSky: true,
        elevation: 1085,
        bestScore: 86,
        bestDayHour: '07:00',
        bestAstroHour: '23:00',
        isAstroWin: true,
      },
      longRangeCardLabel: 'Long-range opportunity',
    });

    expect(html).toContain('Road-trip option - leave by ~19:25 for the 23:00 astro window. Overnight recommended.');
  });

  it('flags long-range trips that are departing soon', () => {
    const html = formatEmail({
      dontBother: true,
      windows: [],
      todayCarWash: {
        rating: 'OK',
        label: 'Great',
        score: 60,
        start: '06:00',
        end: '08:00',
        wind: 12,
        pp: 22,
        tmp: 5,
      },
      dailySummary: [{
        dayLabel: 'Monday',
        dateKey: '2026-03-16',
        dayIdx: 0,
        photoScore: 32,
        headlineScore: 42,
        photoEmoji: 'Marginal',
        amScore: 32,
        pmScore: 19,
        astroScore: 52,
        confidence: 'high',
        confidenceStdDev: 5,
        astroConfidence: 'high',
        astroConfidenceStdDev: 11,
        amConfidence: 'high',
        pmConfidence: 'high',
        bestPhotoHour: '07:00',
        bestTags: 'landscape',
        bestAstroHour: '04:00',
        darkSkyStartsAt: '00:00',
        carWash: {
          rating: 'OK',
          label: 'Great',
          score: 60,
          start: '06:00',
          end: '08:00',
          wind: 12,
          pp: 22,
          tmp: 5,
        },
      }],
      altLocations: [],
      sunriseStr: '06:18',
      sunsetStr: '18:11',
      moonPct: 8,
      metarNote: '',
      today: 'Monday 16 March',
      todayBestScore: 42,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Leeds is not worth it today.',
      longRangeTop: {
        name: 'Wastwater',
        region: 'lake-district',
        driveMins: 140,
        tags: ['water', 'mountain'],
        darkSky: true,
        elevation: 75,
        bestScore: 84,
        bestDayHour: null,
        bestAstroHour: '21:00',
        isAstroWin: true,
      },
      longRangeCardLabel: 'Long-range opportunity',
      debugContext: {
        metadata: {
          generatedAt: '2026-03-16T17:00:00Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.55,
          timezone: 'Europe/London',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    });

    expect(html).toContain('Departing soon - leave by ~18:40 for the 21:00 astro window.');
  });

  it('flags long-range trips whose departure window is closing', () => {
    const html = formatEmail({
      dontBother: true,
      windows: [],
      todayCarWash: {
        rating: 'OK',
        label: 'Great',
        score: 60,
        start: '06:00',
        end: '08:00',
        wind: 12,
        pp: 22,
        tmp: 5,
      },
      dailySummary: [{
        dayLabel: 'Monday',
        dateKey: '2026-03-16',
        dayIdx: 0,
        photoScore: 32,
        headlineScore: 42,
        photoEmoji: 'Marginal',
        amScore: 32,
        pmScore: 19,
        astroScore: 52,
        confidence: 'high',
        confidenceStdDev: 5,
        astroConfidence: 'high',
        astroConfidenceStdDev: 11,
        amConfidence: 'high',
        pmConfidence: 'high',
        bestPhotoHour: '07:00',
        bestTags: 'landscape',
        bestAstroHour: '04:00',
        darkSkyStartsAt: '00:00',
        carWash: {
          rating: 'OK',
          label: 'Great',
          score: 60,
          start: '06:00',
          end: '08:00',
          wind: 12,
          pp: 22,
          tmp: 5,
        },
      }],
      altLocations: [],
      sunriseStr: '06:18',
      sunsetStr: '18:11',
      moonPct: 8,
      metarNote: '',
      today: 'Monday 16 March',
      todayBestScore: 42,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Leeds is not worth it today.',
      longRangeTop: {
        name: 'Wastwater',
        region: 'lake-district',
        driveMins: 140,
        tags: ['water', 'mountain'],
        darkSky: true,
        elevation: 75,
        bestScore: 84,
        bestDayHour: null,
        bestAstroHour: '21:00',
        isAstroWin: true,
      },
      longRangeCardLabel: 'Long-range opportunity',
      debugContext: {
        metadata: {
          generatedAt: '2026-03-16T18:10:00Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.55,
          timezone: 'Europe/London',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    });

    expect(html).toContain('Departure window closing - leave by ~18:40 for the 21:00 astro window.');
  });

  it('suppresses long-range cards once the departure time has passed', () => {
    const html = formatEmail({
      dontBother: true,
      windows: [],
      todayCarWash: {
        rating: 'OK',
        label: 'Great',
        score: 60,
        start: '06:00',
        end: '08:00',
        wind: 12,
        pp: 22,
        tmp: 5,
      },
      dailySummary: [{
        dayLabel: 'Monday',
        dateKey: '2026-03-16',
        dayIdx: 0,
        photoScore: 32,
        headlineScore: 42,
        photoEmoji: 'Marginal',
        amScore: 32,
        pmScore: 19,
        astroScore: 52,
        confidence: 'high',
        confidenceStdDev: 5,
        astroConfidence: 'high',
        astroConfidenceStdDev: 11,
        amConfidence: 'high',
        pmConfidence: 'high',
        bestPhotoHour: '07:00',
        bestTags: 'landscape',
        bestAstroHour: '04:00',
        darkSkyStartsAt: '00:00',
        carWash: {
          rating: 'OK',
          label: 'Great',
          score: 60,
          start: '06:00',
          end: '08:00',
          wind: 12,
          pp: 22,
          tmp: 5,
        },
      }],
      altLocations: [],
      sunriseStr: '06:18',
      sunsetStr: '18:11',
      moonPct: 8,
      metarNote: '',
      today: 'Monday 16 March',
      todayBestScore: 42,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Leeds is not worth it today.',
      longRangeTop: {
        name: 'Wastwater',
        region: 'lake-district',
        driveMins: 140,
        tags: ['water', 'mountain'],
        darkSky: true,
        elevation: 75,
        bestScore: 84,
        bestDayHour: null,
        bestAstroHour: '21:00',
        isAstroWin: true,
      },
      longRangeCardLabel: 'Long-range opportunity',
      debugContext: {
        metadata: {
          generatedAt: '2026-03-16T19:16:00Z',
          location: 'Leeds',
          latitude: 53.8,
          longitude: -1.55,
          timezone: 'Europe/London',
          debugModeEnabled: false,
        },
        hourlyScoring: [],
        windows: [],
        nearbyAlternatives: [],
      },
    });

    expect(html).not.toContain('Wastwater');
    expect(html).not.toContain('Long-range opportunity');
  });

  it('adds moon phase, backup drive time, and certainty thresholds to days-ahead cards', () => {
    const html = formatEmail({
      dontBother: false,
      windows: [{
        label: 'Evening golden hour',
        start: '18:00',
        end: '18:00',
        peak: 60,
        hours: [{ hour: '18:00', score: 60, ch: 10, visK: 18, wind: '6', pp: 0, tpw: 16 }],
        tops: ['landscape'],
      }],
      todayCarWash: {
        rating: 'OK',
        label: 'Great',
        score: 80,
        start: '06:00',
        end: '08:00',
        wind: 7,
        pp: 0,
        tmp: 7,
      },
      dailySummary: [{
        dayLabel: 'Today',
        dateKey: '2026-03-18',
        dayIdx: 0,
        photoScore: 60,
        headlineScore: 60,
        photoEmoji: 'Good',
        amScore: 40,
        pmScore: 60,
        astroScore: 61,
        confidence: 'high',
        confidenceStdDev: 7,
        astroConfidence: 'high',
        astroConfidenceStdDev: 7,
        amConfidence: 'high',
        pmConfidence: 'high',
        bestPhotoHour: '18:00',
        bestTags: 'landscape',
        carWash: {
          rating: 'OK',
          label: 'Great',
          score: 80,
          start: '06:00',
          end: '08:00',
          wind: 7,
          pp: 0,
          tmp: 7,
        },
      }, {
        dayLabel: 'Tomorrow',
        dateKey: '2026-03-19',
        dayIdx: 1,
        photoScore: 58,
        headlineScore: 63,
        photoEmoji: 'Good',
        amScore: 29,
        pmScore: 60,
        astroScore: 61,
        bestAstroHour: '01:00',
        confidence: 'medium',
        confidenceStdDev: 19,
        astroConfidence: 'medium',
        astroConfidenceStdDev: 19,
        amConfidence: 'medium',
        pmConfidence: 'medium',
        bestPhotoHour: '18:00',
        bestTags: 'landscape',
        bestAlt: {
          name: 'Stanage Edge',
          driveMins: 65,
          bestScore: 85,
          bestAstroHour: '01:00',
          isAstroWin: true,
          darkSky: true,
        },
        carWash: {
          rating: 'OK',
          label: 'Great',
          score: 80,
          start: '06:00',
          end: '08:00',
          wind: 7,
          pp: 0,
          tmp: 7,
        },
        hours: [{
          hour: '01:00',
          tmp: 8,
          pp: 0,
          wind: 7,
          gusts: 10,
          visK: 12,
          pr: 0,
          ct: 10,
          isNight: true,
          moon: 18,
        }],
      }],
      altLocations: [],
      sunriseStr: '06:13',
      sunsetStr: '18:15',
      moonPct: 1,
      metarNote: '',
      today: 'Wednesday 18 March',
      todayBestScore: 60,
      shSunsetQ: null,
      shSunriseQ: null,
      shSunsetText: undefined,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Conditions improve into the evening.',
    });

    expect(html).toContain('Backup: Stanage Edge · 85/100 at 01:00 (astro) · 65 min drive');
    expect(html).toContain('Moon 18% lit');
    expect(html).toContain('Certainty bands = High &lt; 12 pts');
    expect(html).toContain('Fair 12&ndash;24 pts');
    expect(html).toContain('Low &ge; 25 pts');
  });
});
