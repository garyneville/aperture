import { describe, expect, it } from 'vitest';
import {
  renderNextDayHourlyOutlook,
  renderRemainingTodayOutlook,
} from './render-outdoor-outlook.js';
import type { DaySummary, NextDayHour, RunTimeContext, Window } from './types.js';
import type { DebugContext } from '../../lib/debug-context.js';

function makeDaySummary(hours: Partial<NextDayHour>[]): DaySummary {
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

describe('renderNextDayHourlyOutlook', () => {
  it('returns empty string when tomorrow is undefined', () => {
    const html = renderNextDayHourlyOutlook(undefined, undefined);
    expect(html).toBe('');
  });

  it('returns empty string when tomorrow has no hours', () => {
    const tomorrow = makeDaySummary([]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined);
    expect(html).toBe('');
  });

  it('renders a table with expected columns', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 15, pp: 5, wind: 8, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined);

    expect(html).toContain('Tomorrow at a glance');
    expect(html).toContain('Time');
    expect(html).toContain('Sky');
    expect(html).toContain('Temp');
    expect(html).toContain('Rain');
    expect(html).toContain('Wind');
    expect(html).toContain('Outdoor');
    expect(html).toContain('Why');
  });

  it('renders hour data in table rows', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 15, pp: 10, wind: 12, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined);

    expect(html).toContain('09:00');
    expect(html).toContain('10:00');
    expect(html).toContain('14');
    expect(html).toContain('15');
  });

  it('renders weather SVG icons from cloud and rain signals', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', ct: 10, pp: 0, pr: 0, isNight: false },
      { hour: '10:00', ct: 70, pp: 5, pr: 0, isNight: false },
      { hour: '11:00', ct: 45, pp: 55, pr: 0, isNight: false },
      { hour: '12:00', ct: 85, pp: 90, pr: 3, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined);

    expect(html).toContain('data-condition="clear-day"');
    expect(html).toContain('data-condition="cloudy"');
    expect(html).toContain('data-condition="partly-cloudy-day-rain"');
    expect(html).toContain('data-condition="rain"');
  });

  it('uses night variant SVG icons for night hours', () => {
    const tomorrow = makeDaySummary([
      { hour: '22:00', ct: 10, pp: 0, pr: 0, isNight: true },
      { hour: '23:00', ct: 45, pp: 0, pr: 0, isNight: true },
      { hour: '00:00', ct: 45, pp: 55, pr: 0, isNight: true },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined, { showOvernight: true });

    expect(html).toContain('data-condition="clear-night"');
  });

  it('explains outdoor comfort scores with short reason text', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 0, wind: 8, pr: 0, visK: 20, isNight: false },
      { hour: '10:00', tmp: 6, pp: 85, wind: 40, pr: 3, visK: 1.5, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined);

    expect(html).toContain('rain-heavy');
    expect(html).toContain('strong wind');
  });

  it('highlights pleasant hours with background color', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 15, pp: 2, wind: 6, pr: 0, visK: 20, isNight: false },
      { hour: '14:00', tmp: 10, pp: 80, wind: 50, pr: 3, visK: 2, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined);

    expect(html).toMatch(/Best for a (run|walk)/);
    expect(html).toContain('Poor conditions');
  });

  it('shows a summary sentence describing tomorrow', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 3, wind: 8, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined);

    expect(html).toMatch(/mostly dry|chance of showers|some rain|heavy rain/i);
  });

  it('populates debugContext.outdoorComfort when debugContext is provided', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 15, pp: 5, wind: 8, isNight: false },
    ]);
    const debugContext: DebugContext = { hourlyScoring: [], windows: [], nearbyAlternatives: [] };
    renderNextDayHourlyOutlook(tomorrow, debugContext);

    expect(debugContext.outdoorComfort).toBeDefined();
    expect(debugContext.outdoorComfort!.hours).toHaveLength(2);
    expect(debugContext.outdoorComfort!.hours[0].hour).toBe('09:00');
    expect(typeof debugContext.outdoorComfort!.hours[0].comfortScore).toBe('number');
    expect(debugContext.outdoorComfort!.hours[0].label).toBeTruthy();
  });

  it('identifies and reports the best outdoor window in debugContext', () => {
    const tomorrow = makeDaySummary([
      { hour: '08:00', tmp: 14, pp: 80, wind: 40, isNight: false },
      { hour: '09:00', tmp: 15, pp: 3, wind: 6, isNight: false },
      { hour: '10:00', tmp: 15, pp: 3, wind: 6, isNight: false },
      { hour: '11:00', tmp: 14, pp: 80, wind: 40, isNight: false },
    ]);
    const debugContext: DebugContext = { hourlyScoring: [], windows: [], nearbyAlternatives: [] };
    renderNextDayHourlyOutlook(tomorrow, debugContext);

    expect(debugContext.outdoorComfort?.bestWindow).not.toBeNull();
    expect(debugContext.outdoorComfort?.bestWindow?.start).toBe('09:00');
    expect(debugContext.outdoorComfort?.bestWindow?.end).toBe('10:00');
  });

  it('keeps the best outdoor window focused on the peak comfort cluster', () => {
    const tomorrow = makeDaySummary([
      { hour: '08:00', tmp: 6, pp: 25, wind: 22, isNight: false },
      { hour: '09:00', tmp: 6, pp: 25, wind: 22, isNight: false },
      { hour: '10:00', tmp: 6, pp: 25, wind: 22, isNight: false },
      { hour: '11:00', tmp: 6, pp: 25, wind: 22, isNight: false },
      { hour: '12:00', tmp: 6, pp: 25, wind: 22, isNight: false },
      { hour: '13:00', tmp: 6, pp: 25, wind: 22, isNight: false },
      { hour: '14:00', tmp: 14, pp: 0, wind: 10, isNight: false },
      { hour: '15:00', tmp: 14, pp: 0, wind: 10, isNight: false },
      { hour: '16:00', tmp: 14, pp: 0, wind: 10, isNight: false },
    ]);
    const debugContext: DebugContext = { hourlyScoring: [], windows: [], nearbyAlternatives: [] };
    const html = renderNextDayHourlyOutlook(tomorrow, debugContext);

    expect(debugContext.outdoorComfort?.bestWindow).toEqual({
      start: '14:00',
      end: '16:00',
      label: 'Best for a run',
    });
    expect(html).toContain('Best outdoor window: 14:00–16:00.');
  });

  it('renders photo windows when provided', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
    ]);
    const photoWindows: Window[] = [{
      label: 'Morning',
      start: '08:00',
      end: '10:00',
      peak: 48,
      tops: ['landscape'],
    }];
    const html = renderNextDayHourlyOutlook(tomorrow, undefined, { photoWindows });

    expect(html).toContain('Next photo windows');
    expect(html).toContain('Morning 08:00-10:00');
  });

  it('uses custom title when provided', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined, { title: 'Custom Title' });

    expect(html).toContain('Custom Title');
  });

  it('includes table caption for accessibility', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined, { caption: 'Test Caption' });

    expect(html).toContain('<caption');
    expect(html).toContain('Test Caption');
  });

  it('renders filled/unfilled indicator dots based on highlight status', () => {
    const tomorrow = makeDaySummary([
      { hour: '09:00', tmp: 15, pp: 2, wind: 6, isNight: false },
      { hour: '10:00', tmp: 5, pp: 80, wind: 40, isNight: false },
    ]);
    const html = renderNextDayHourlyOutlook(tomorrow, undefined);

    expect(html).toContain('&#x25CF;');
    expect(html).toContain('&#x25CB;');
  });
});

describe('renderRemainingTodayOutlook', () => {
  it('renders from current time rounded up to next hour', () => {
    const today = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 15, pp: 5, wind: 8, isNight: false },
      { hour: '11:00', tmp: 16, pp: 5, wind: 8, isNight: false },
    ]);
    const runTime: RunTimeContext = { nowMinutes: 9 * 60 + 30, nowLabel: '09:30', timezone: 'Europe/London' }; // 09:30
    const html = renderRemainingTodayOutlook(today, runTime, []);

    expect(html).toContain('Today from 10:00');
    expect(html).not.toContain('09:00');
    expect(html).toContain('10:00');
    expect(html).toContain('11:00');
  });

  it('uses current hour when exactly on the hour', () => {
    const today = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 15, pp: 5, wind: 8, isNight: false },
    ]);
    const runTime: RunTimeContext = { nowMinutes: 9 * 60, nowLabel: '09:00', timezone: 'Europe/London' }; // 09:00 exactly
    const html = renderRemainingTodayOutlook(today, runTime, []);

    expect(html).toContain('Today from 09:00');
    expect(html).toContain('09:00');
  });

  it('includes the exact end hour of the last listed photo window', () => {
    const today = makeDaySummary([
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

    const html = renderRemainingTodayOutlook(today, { nowMinutes: 20 * 60, nowLabel: '20:00', timezone: 'Europe/London' }, photoWindows);

    expect(html).toContain('20:00');
    expect(html).toContain('21:00');
    expect(html).toContain('22:00');
    expect(html).toContain('23:00');
  });

  it('populates debugContext with today context', () => {
    const today = makeDaySummary([
      { hour: '14:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '15:00', tmp: 15, pp: 5, wind: 8, isNight: false },
    ]);
    const debugContext: DebugContext = { hourlyScoring: [], windows: [], nearbyAlternatives: [] };
    renderRemainingTodayOutlook(today, { nowMinutes: 13 * 60, nowLabel: '13:00', timezone: 'Europe/London' }, [], debugContext);

    expect(debugContext.outdoorComfort).toBeDefined();
    expect(debugContext.outdoorComfort!.hours).toHaveLength(2);
  });
});
