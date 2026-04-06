import { describe, expect, it } from 'vitest';
import {
  buildOutdoorOutlookModel,
  formatPhotoWindowList,
  type OutdoorOutlookModel,
  type OutdoorOutlookOptions,
} from './outdoor-outlook-model.js';
import type { DaySummary, NextDayHour, Window } from '../../contracts/index.js';

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

describe('buildOutdoorOutlookModel', () => {
  it('returns null when day is undefined', () => {
    const model = buildOutdoorOutlookModel(undefined);
    expect(model).toBeNull();
  });

  it('returns null when day has no hours', () => {
    const day = makeDaySummary([]);
    const model = buildOutdoorOutlookModel(day);
    expect(model).toBeNull();
  });

  it('returns null when all hours are filtered out', () => {
    const day = makeDaySummary([
      { hour: '01:00', isNight: true },
      { hour: '02:00', isNight: true },
    ]);
    const model = buildOutdoorOutlookModel(day, { showOvernight: false });
    expect(model).toBeNull();
  });

  it('builds a model with rows for each hour', () => {
    const day = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 15, pp: 5, wind: 8, isNight: false },
    ]);
    const model = buildOutdoorOutlookModel(day);

    expect(model).not.toBeNull();
    expect(model!.rows).toHaveLength(2);
    expect(model!.hours).toHaveLength(2);
  });

  it('calculates comfort scores for each row', () => {
    const day = makeDaySummary([
      { hour: '09:00', tmp: 14, pp: 5, wind: 8, isNight: false },
      { hour: '10:00', tmp: 5, pp: 80, wind: 40, isNight: false },
    ]);
    const model = buildOutdoorOutlookModel(day);

    expect(model!.rows[0].score).toBeGreaterThan(model!.rows[1].score);
  });

  it('includes labels with highlight flag for good conditions', () => {
    const day = makeDaySummary([
      { hour: '09:00', tmp: 15, pp: 2, wind: 6, isNight: false },
    ]);
    const model = buildOutdoorOutlookModel(day);

    expect(model!.rows[0].label.highlight).toBe(true);
    expect(model!.rows[0].label.text).toMatch(/Morning (run|walk)/);
  });

  it('includes reason text for suboptimal conditions', () => {
    const day = makeDaySummary([
      { hour: '09:00', tmp: 2, pp: 70, wind: 40, isNight: false },
    ]);
    const model = buildOutdoorOutlookModel(day);

    expect(model!.rows[0].reason).toBeTruthy();
    expect(model!.rows[0].reason.length).toBeGreaterThan(0);
  });

  it('filters out hours before startAtMinutes', () => {
    const day = makeDaySummary([
      { hour: '08:00', isNight: false },
      { hour: '09:00', isNight: false },
      { hour: '10:00', isNight: false },
    ]);
    const model = buildOutdoorOutlookModel(day, { startAtMinutes: 9 * 60 });

    expect(model!.hours).toHaveLength(2);
    expect(model!.hours[0].hour).toBe('09:00');
    expect(model!.hours[1].hour).toBe('10:00');
  });

  it('shows night hours when showOvernight is true', () => {
    const day = makeDaySummary([
      { hour: '22:00', isNight: true },
      { hour: '23:00', isNight: true },
    ]);
    const model = buildOutdoorOutlookModel(day, { showOvernight: true });

    expect(model!.hours).toHaveLength(2);
  });

  it('hides overnight hours (before 18:00 or after 23:00) when showOvernight is false', () => {
    const day = makeDaySummary([
      { hour: '01:00', isNight: true },
      { hour: '02:00', isNight: true },
    ]);
    const model = buildOutdoorOutlookModel(day, { showOvernight: false });

    expect(model).toBeNull();
  });

  it('shows evening hours (18:00-22:59) even when isNight is true', () => {
    const day = makeDaySummary([
      { hour: '20:00', isNight: true },
      { hour: '22:00', isNight: true },
    ]);
    const model = buildOutdoorOutlookModel(day, { showOvernight: false });

    // Evening hours 18:00-23:00 are shown even if marked as night
    expect(model).not.toBeNull();
    expect(model!.hours).toHaveLength(2);
  });

  it('shows evening hours (18:00-23:00) even if marked night', () => {
    const day = makeDaySummary([
      { hour: '20:00', isNight: true },
      { hour: '21:00', isNight: true },
    ]);
    const model = buildOutdoorOutlookModel(day, { showOvernight: false });

    expect(model!.hours).toHaveLength(2);
  });

  it('separates day rows from all rows', () => {
    const day = makeDaySummary([
      { hour: '09:00', isNight: false },
      { hour: '10:00', isNight: false },
      { hour: '22:00', isNight: true },
    ]);
    const model = buildOutdoorOutlookModel(day, { showOvernight: true });

    expect(model!.rows).toHaveLength(3);
    expect(model!.dayRows).toHaveLength(2);
  });

  describe('bestWindow detection', () => {
    it('finds the best outdoor window from day rows', () => {
      const day = makeDaySummary([
        { hour: '08:00', tmp: 5, pp: 80, wind: 40, isNight: false },
        { hour: '09:00', tmp: 15, pp: 3, wind: 6, isNight: false },
        { hour: '10:00', tmp: 15, pp: 3, wind: 6, isNight: false },
        { hour: '11:00', tmp: 5, pp: 80, wind: 40, isNight: false },
      ]);
      const model = buildOutdoorOutlookModel(day);

      expect(model!.bestWindow).not.toBeNull();
      expect(model!.bestWindow!.start).toBe('09:00');
      expect(model!.bestWindow!.end).toBe('10:00');
    });

    it('returns null when no highlighted rows exist', () => {
      const day = makeDaySummary([
        { hour: '08:00', tmp: 0, pp: 90, wind: 50, isNight: false },
        { hour: '09:00', tmp: 0, pp: 90, wind: 50, isNight: false },
      ]);
      const model = buildOutdoorOutlookModel(day);

      expect(model!.bestWindow).toBeNull();
    });

    it('focuses on peak comfort cluster rather than longest run', () => {
      const day = makeDaySummary([
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
      const model = buildOutdoorOutlookModel(day);

      expect(model!.bestWindow!.start).toBe('14:00');
      expect(model!.bestWindow!.end).toBe('16:00');
    });

    it('uses the best label from the window', () => {
      const day = makeDaySummary([
        { hour: '09:00', tmp: 15, pp: 3, wind: 6, isNight: false },
        { hour: '10:00', tmp: 15, pp: 3, wind: 6, isNight: false },
      ]);
      const model = buildOutdoorOutlookModel(day);

      expect(model!.bestWindow!.label).toMatch(/Morning (run|walk)/);
    });
  });

  describe('summaryLine generation', () => {
    it('generates summary for tomorrow context', () => {
      const day = makeDaySummary([
        { hour: '09:00', tmp: 14, pp: 3, wind: 8, isNight: false },
      ]);
      const model = buildOutdoorOutlookModel(day, { summaryContext: 'tomorrow' });

      expect(model!.summaryLine).toContain('Best outdoor window');
      expect(model!.summaryLine).toContain('°C');
    });

    it('generates summary for today context', () => {
      const day = makeDaySummary([
        { hour: '09:00', tmp: 14, pp: 3, wind: 8, isNight: false },
      ]);
      const model = buildOutdoorOutlookModel(day, { summaryContext: 'today' });

      expect(model!.summaryLine).toContain('Best remaining outdoor window');
    });

    it('describes rain conditions', () => {
      const day = makeDaySummary([
        { hour: '09:00', tmp: 14, pp: 80, wind: 8, isNight: false },
      ]);
      const model = buildOutdoorOutlookModel(day);

      expect(model!.summaryLine).toMatch(/heavy rain|rain/i);
    });

    it('describes wind conditions', () => {
      const day = makeDaySummary([
        { hour: '09:00', tmp: 14, pp: 5, wind: 45, isNight: false },
      ]);
      const model = buildOutdoorOutlookModel(day);

      expect(model!.summaryLine).toMatch(/strong winds|breezy/i);
    });

    it('includes average temperature', () => {
      const day = makeDaySummary([
        { hour: '09:00', tmp: 14, isNight: false },
        { hour: '10:00', tmp: 16, isNight: false },
      ]);
      const model = buildOutdoorOutlookModel(day);

      expect(model!.summaryLine).toContain('15°C');
    });

    it('handles no daytime hours', () => {
      const day = makeDaySummary([
        { hour: '22:00', isNight: true },
        { hour: '23:00', isNight: true },
      ]);
      const model = buildOutdoorOutlookModel(day, { showOvernight: true, summaryContext: 'tomorrow' });

      expect(model!.summaryLine).toContain('No daytime hours');
    });

    it('handles no hours remaining for today context', () => {
      const day = makeDaySummary([]);
      const model = buildOutdoorOutlookModel(day, { summaryContext: 'today' });

      expect(model).toBeNull();
    });
  });

  describe('photo windows integration', () => {
    it('includes hours within photo windows even at night', () => {
      const day = makeDaySummary([
        { hour: '21:00', isNight: true },
        { hour: '22:00', isNight: true },
        { hour: '23:00', isNight: true },
      ]);
      const photoWindows: Window[] = [{
        label: 'Evening astro',
        start: '21:00',
        end: '23:00',
        peak: 48,
        tops: ['astrophotography'],
      }];
      const model = buildOutdoorOutlookModel(day, {
        showOvernight: false,
        photoWindows,
      });

      expect(model!.hours).toHaveLength(3);
    });

    it('handles photo windows crossing midnight', () => {
      const day = makeDaySummary([
        { hour: '23:00', isNight: true },
        { hour: '00:00', isNight: true },
        { hour: '01:00', isNight: true },
      ]);
      const photoWindows: Window[] = [{
        label: 'Late night',
        start: '23:00',
        end: '01:00',
        peak: 48,
        tops: ['astrophotography'],
      }];
      const model = buildOutdoorOutlookModel(day, {
        showOvernight: false,
        photoWindows,
      });

      expect(model!.hours).toHaveLength(3);
    });
  });
});

describe('formatPhotoWindowList', () => {
  it('formats a single window', () => {
    const windows: Window[] = [{
      label: 'Morning',
      start: '08:00',
      end: '10:00',
      peak: 48,
      tops: ['landscape'],
    }];
    const result = formatPhotoWindowList(windows);

    expect(result).toBe('Morning 08:00-10:00');
  });

  it('formats multiple windows with separator', () => {
    const windows: Window[] = [
      { label: 'Morning', start: '08:00', end: '10:00', peak: 48, tops: ['landscape'] },
      { label: 'Evening', start: '18:00', end: '20:00', peak: 52, tops: ['sunset'] },
    ];
    const result = formatPhotoWindowList(windows);

    expect(result).toContain('Morning 08:00-10:00');
    expect(result).toContain('Evening 18:00-20:00');
    expect(result).toContain('·');
  });

  it('returns empty string for empty array', () => {
    const result = formatPhotoWindowList([]);
    expect(result).toBe('');
  });
});
