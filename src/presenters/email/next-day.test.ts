import { describe, expect, it } from 'vitest';
import {
  formatEmail,
  nextDayHourlyOutlookSection,
  outdoorComfortLabel,
  outdoorComfortScore,
  type DaySummary,
  type FormatEmailInput,
  type NextDayHour,
  type Window,
} from './index.js';
import type { DebugContext } from '../../lib/debug-context.js';

/**
 * This file contains INTEGRATION tests for the next-day facade.
 *
 * For focused unit tests of the extracted modules, see:
 * - outdoor-comfort.test.ts - Tests for scoring, labels, and reasons
 * - outdoor-outlook-model.test.ts - Tests for window selection and model building
 * - render-outdoor-outlook.test.ts - Tests for HTML rendering
 */

function makeTomorrowDay(hours: Partial<NextDayHour>[]): DaySummary {
  const defaultHour: NextDayHour = {
    hour: '09:00',
    tmp: 14,
    pp: 5,
    wind: 8,
    gusts: 12,
    visK: 20,
    pr: 0,
    ct: 30,
    isNight: false,
  };

  return {
    dayLabel: 'Tomorrow',
    dateKey: '2026-03-15',
    dayIdx: 1,
    photoScore: 40,
    headlineScore: 40,
    photoEmoji: '🟡',
    amScore: 30,
    pmScore: 40,
    astroScore: 20,
    carWash: { rating: 'OK', label: 'Usable', score: 60, start: '10:00', end: '12:00', wind: 8, pp: 5, tmp: 14 },
    hours: hours.map(hour => ({ ...defaultHour, ...hour })),
  };
}

describe('nextDayHourlyOutlookSection', () => {
  it('returns empty string when tomorrow has no hours', () => {
    const result = nextDayHourlyOutlookSection(undefined);
    expect(result).toBe('');
  });

  it('returns empty string when tomorrow has only night hours', () => {
    const tomorrow = makeTomorrowDay([{ hour: '01:00', isNight: true }]);
    const result = nextDayHourlyOutlookSection(tomorrow);
    expect(result).toBe('');
  });

  it('renders a table when daytime hours are present', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 15, pp: 5, wind: 8, isNight: false },
    ]);
    const html = nextDayHourlyOutlookSection(tomorrow);
    expect(html).toContain('Tomorrow at a glance');
    expect(html).toContain('09:00');
    expect(html).toContain('10:00');
    expect(html).toContain('Time');
    expect(html).toContain('Sky');
    expect(html).toContain('Temp');
    expect(html).toContain('Rain');
    expect(html).toContain('Wind');
    expect(html).toContain('Outdoor');
  });

  it('renders weather SVG icons from cloud and rain signals', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '09:00', ct: 10, pp: 0, pr: 0, isNight: false },
      { hour: '10:00', ct: 70, pp: 5, pr: 0, isNight: false },
      { hour: '11:00', ct: 45, pp: 55, pr: 0, isNight: false },
      { hour: '12:00', ct: 85, pp: 90, pr: 3, isNight: false },
    ]);
    const html = nextDayHourlyOutlookSection(tomorrow);

    expect(html).toContain('data-condition="clear-day"');
    expect(html).toContain('data-condition="cloudy"');
    expect(html).toContain('data-condition="partly-cloudy-day-rain"');
    expect(html).toContain('data-condition="rain"');
  });

  it('uses night variant SVG icons for night hours', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '22:00', ct: 10, pp: 0, pr: 0, isNight: true },
      { hour: '23:00', ct: 45, pp: 0, pr: 0, isNight: true },
      { hour: '00:00', ct: 45, pp: 55, pr: 0, isNight: true },
    ]);
    const html = nextDayHourlyOutlookSection(tomorrow);

    expect(html).toContain('data-condition="clear-night"');
    expect(html).not.toContain('data-condition="partly-cloudy-night"');
    expect(html).not.toContain('data-condition="partly-cloudy-night-rain"');
  });

  it('explains outdoor comfort scores with short reason text', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '09:00', tmp: 14, pp: 0, wind: 8, pr: 0, visK: 20, isNight: false },
      { hour: '10:00', tmp: 6, pp: 85, wind: 40, pr: 3, visK: 1.5, isNight: false },
    ]);
    const html = nextDayHourlyOutlookSection(tomorrow);

    expect(html).not.toContain('comfortable baseline');
    expect(html).toContain('rain-heavy, strong wind');
  });

  it('highlights pleasant hours and de-emphasises poor ones', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '09:00', tmp: 15, pp: 2, wind: 6, pr: 0, visK: 20, isNight: false },
      { hour: '14:00', tmp: 10, pp: 80, wind: 50, pr: 3, visK: 2, isNight: false },
    ]);
    const html = nextDayHourlyOutlookSection(tomorrow);
    expect(html).toMatch(/Best for a (run|walk)/);
    expect(html).toContain('Poor conditions');
  });

  it('shows a summary sentence describing tomorrow', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '09:00', tmp: 14, pp: 3, wind: 8, isNight: false },
    ]);
    const html = nextDayHourlyOutlookSection(tomorrow);
    expect(html).toMatch(/mostly dry|chance of showers|some rain|heavy rain/i);
  });

  it('populates debugContext.outdoorComfort when debugContext is provided', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 15, pp: 5, wind: 8, isNight: false },
    ]);
    const debugContext: DebugContext = { hourlyScoring: [], windows: [], nearbyAlternatives: [] };
    nextDayHourlyOutlookSection(tomorrow, debugContext);
    expect(debugContext.outdoorComfort).toBeDefined();
    expect(debugContext.outdoorComfort!.hours).toHaveLength(2);
    expect(debugContext.outdoorComfort!.hours[0].hour).toBe('09:00');
    expect(typeof debugContext.outdoorComfort!.hours[0].comfortScore).toBe('number');
    expect(debugContext.outdoorComfort!.hours[0].label).toBeTruthy();
  });

  it('identifies and reports the best outdoor window in debugContext', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '08:00', tmp: 14, pp: 80, wind: 40, isNight: false },
      { hour: '09:00', tmp: 15, pp: 3, wind: 6, isNight: false },
      { hour: '10:00', tmp: 15, pp: 3, wind: 6, isNight: false },
      { hour: '11:00', tmp: 14, pp: 80, wind: 40, isNight: false },
    ]);
    const debugContext: DebugContext = { hourlyScoring: [], windows: [], nearbyAlternatives: [] };
    nextDayHourlyOutlookSection(tomorrow, debugContext);
    expect(debugContext.outdoorComfort?.bestWindow).not.toBeNull();
    expect(debugContext.outdoorComfort?.bestWindow?.start).toBe('09:00');
    expect(debugContext.outdoorComfort?.bestWindow?.end).toBe('10:00');
  });

  it('keeps the best outdoor window focused on the peak comfort cluster', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '08:00', tmp: 6, pp: 25, wind: 22, pr: 0, visK: 18, isNight: false },
      { hour: '09:00', tmp: 6, pp: 25, wind: 22, pr: 0, visK: 18, isNight: false },
      { hour: '10:00', tmp: 6, pp: 25, wind: 22, pr: 0, visK: 18, isNight: false },
      { hour: '11:00', tmp: 6, pp: 25, wind: 22, pr: 0, visK: 18, isNight: false },
      { hour: '12:00', tmp: 6, pp: 25, wind: 22, pr: 0, visK: 18, isNight: false },
      { hour: '13:00', tmp: 6, pp: 25, wind: 22, pr: 0, visK: 18, isNight: false },
      { hour: '14:00', tmp: 14, pp: 0, wind: 10, pr: 0, visK: 20, isNight: false },
      { hour: '15:00', tmp: 14, pp: 0, wind: 10, pr: 0, visK: 20, isNight: false },
      { hour: '16:00', tmp: 14, pp: 0, wind: 10, pr: 0, visK: 20, isNight: false },
    ]);
    const debugContext: DebugContext = { hourlyScoring: [], windows: [], nearbyAlternatives: [] };

    const html = nextDayHourlyOutlookSection(tomorrow, debugContext);

    expect(debugContext.outdoorComfort?.bestWindow).toEqual({
      start: '14:00',
      end: '16:00',
      label: 'Best for a run',
    });
    expect(html).toContain('Best outdoor window: 14:00–16:00.');
    expect(html).not.toContain('Best outdoor window: 08:00–16:00.');
  });

  it('includes the exact end hour of the last listed photo window in remaining-today mode', () => {
    const today = makeTomorrowDay([
      { hour: '20:00', tmp: 9, pp: 5, wind: 8, pr: 0, visK: 18, ct: 20, isNight: false },
      { hour: '21:00', tmp: 8, pp: 5, wind: 8, pr: 0, visK: 18, ct: 20, isNight: true },
      { hour: '22:00', tmp: 7, pp: 5, wind: 8, pr: 0, visK: 18, ct: 20, isNight: true },
      { hour: '23:00', tmp: 6, pp: 5, wind: 8, pr: 0, visK: 18, ct: 20, isNight: true },
    ]);
    const photoWindows: Window[] = [{
      label: 'Evening astro window',
      start: '21:00',
      end: '23:00',
      peak: 48,
      tops: ['astrophotography'],
    }];

    const html = nextDayHourlyOutlookSection(today, undefined, {
      title: 'Today from 20:00',
      caption: "Today's remaining-hours outlook",
      summaryContext: 'today',
      startAtMinutes: 20 * 60,
      showOvernight: false,
      photoWindows,
    });

    expect(html).toContain('20:00');
    expect(html).toContain('21:00');
    expect(html).toContain('22:00');
    expect(html).toContain('23:00');
  });

  it('renders the section inside the main formatEmail output when tomorrow has hours', () => {
    const tomorrow = makeTomorrowDay([
      { hour: '09:00', tmp: 15, pp: 3, wind: 8, isNight: false },
      { hour: '12:00', tmp: 16, pp: 3, wind: 8, isNight: false },
    ]);
    const input: FormatEmailInput = {
      dontBother: false,
      windows: [],
      todayCarWash: { rating: 'OK', label: 'Usable', score: 60, start: '10:00', end: '12:00', wind: 8, pp: 5, tmp: 14 },
      dailySummary: [
        {
          dayLabel: 'Today',
          dateKey: '2026-03-14',
          dayIdx: 0,
          photoScore: 40,
          headlineScore: 40,
          photoEmoji: '🟡',
          carWash: { rating: 'OK', label: 'Usable', score: 60, start: '10:00', end: '12:00', wind: 8, pp: 5, tmp: 14 },
        },
        tomorrow,
      ],
      altLocations: [],
      sunriseStr: '06:30',
      sunsetStr: '18:10',
      moonPct: 10,
      today: 'Saturday 14 March',
      todayBestScore: 40,
      shSunsetQ: null,
      shSunriseQ: null,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Not a great day locally.',
    };
    const html = formatEmail(input);
    const tomorrowSectionTitle = 'Tomorrow&#39;s weather';
    expect(html).toContain(tomorrowSectionTitle);
    expect(html).toContain('Tomorrow at a glance');
    expect(html).toContain('09:00');
    expect(html.indexOf(tomorrowSectionTitle)).toBeLessThan(html.indexOf('Days ahead'));
  });
});
