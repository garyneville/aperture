import { describe, expect, it } from 'vitest';
import {
  buildKitTips,
  evaluateKitRules,
  formatEmail,
  type CarWash,
  type FormatEmailInput,
  type Window,
} from './format-email.js';
import type { DebugContext } from './debug-context.js';

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
      30,
      40,
      3,
    );
    expect(tips.length).toBeLessThanOrEqual(3);
  });

  it('returns tips sorted by priority descending', () => {
    const tips = buildKitTips(
      { ...baseCarWash, wind: 30, pp: 50 },
      baseWindows,
      30,
      40,
    );
    for (let index = 1; index < tips.length; index++) {
      expect(tips[index - 1].priority).toBeGreaterThanOrEqual(tips[index].priority);
    }
  });
});

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

  it('kit advisory appears after today\'s window section and before the next major section', () => {
    const input: FormatEmailInput = {
      ...baseInput,
      todayCarWash: { ...baseInput.todayCarWash, wind: 35 },
    };
    const html = formatEmail(input);
    const nextSectionHeading = html.includes('Out of town options')
      ? 'Out of town options'
      : html.includes('Tomorrow\'s weather')
        ? 'Tomorrow\'s weather'
        : 'Days ahead';
    expect(html.indexOf('Kit advisory')).toBeGreaterThan(html.indexOf('Today\'s window'));
    expect(html.indexOf('Kit advisory')).toBeLessThan(html.indexOf(nextSectionHeading));
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

describe('evaluateKitRules', () => {
  const quietDay: CarWash = {
    rating: 'OK',
    label: 'Usable',
    score: 60,
    start: '15:00',
    end: '17:00',
    wind: 10,
    pp: 20,
    tmp: 8,
  };
  const quietWindows: Window[] = [{
    label: 'Evening astro window',
    start: '20:00',
    end: '23:00',
    peak: 65,
    hours: [{ hour: '20:00', score: 65, visK: 20, tpw: 18, ch: 5 }],
    tops: ['astrophotography'],
  }];

  it('returns all 6 kit rules in the trace', () => {
    const { trace } = evaluateKitRules(quietDay, quietWindows, 50, 30);
    expect(trace).toHaveLength(6);
  });

  it('still surfaces astro-window on a quiet dark astro session', () => {
    const { trace, tipsShown } = evaluateKitRules(quietDay, quietWindows, 50, 30);
    const astroRule = trace.find(rule => rule.id === 'astro-window')!;
    expect(tipsShown).toContain('astro-window');
    expect(astroRule.matched).toBe(true);
    expect(astroRule.shown).toBe(true);
  });

  it('marks matched and shown separately when the display cap hides a lower-priority rule', () => {
    const extremeDay: CarWash = { ...quietDay, wind: 35, pp: 55, tmp: 0 };
    const extremeWindows: Window[] = [{
      label: 'Overnight astro window',
      start: '01:00',
      end: '04:00',
      peak: 65,
      hours: [{ hour: '01:00', score: 65, visK: 1, tpw: 40 }],
      tops: ['astrophotography'],
    }];
    const { trace, tipsShown } = evaluateKitRules(extremeDay, extremeWindows, 65, 10, 2);
    const hiddenRule = trace.find(rule => rule.id === 'cold')!;
    expect(hiddenRule.matched).toBe(true);
    expect(hiddenRule.shown).toBe(false);
    expect(tipsShown).toHaveLength(2);
  });

  it('uses the strongest astro window in the trace, not only the first window', () => {
    const mixedWindows: Window[] = [{
      label: 'Evening golden hour',
      start: '18:00',
      end: '19:00',
      peak: 65,
      hours: [{ hour: '18:00', score: 65, visK: 20, tpw: 15 }],
      tops: ['landscape'],
    }, {
      label: 'Overnight astro window',
      start: '23:00',
      end: '02:00',
      peak: 60,
      hours: [{ hour: '00:00', score: 60, visK: 24, tpw: 15 }],
      tops: ['astrophotography'],
    }];
    const { trace, tipsShown } = evaluateKitRules(quietDay, mixedWindows, 0, 8);
    const rule = trace.find(entry => entry.id === 'astro-window')!;
    expect(rule.matched).toBe(true);
    expect(rule.value).toContain('later Overnight astro window 23:00-02:00');
    expect(tipsShown).toContain('astro-window');
  });
});

describe('kit advisory debug trace population', () => {
  it('formatEmail populates debugContext.kitAdvisory when debugContext provided', () => {
    const debugContext: DebugContext = { hourlyScoring: [], windows: [], nearbyAlternatives: [] };
    formatEmail({
      dontBother: false,
      windows: [{
        label: 'Overnight astro window',
        start: '01:00',
        end: '04:00',
        peak: 65,
        hours: [{ hour: '01:00', score: 65, visK: 20, tpw: 18 }],
        tops: ['astrophotography'],
      }],
      todayCarWash: { rating: 'OK', label: 'Usable', score: 60, start: '15:00', end: '17:00', wind: 10, pp: 20, tmp: 8 },
      dailySummary: [{ dayLabel: 'Mon', dateKey: '2026-03-16', dayIdx: 0, photoScore: 65, photoEmoji: '📷', astroScore: 65, carWash: { rating: 'OK', label: 'Usable', score: 60, start: '15:00', end: '17:00', wind: 10, pp: 20, tmp: 8 } }],
      altLocations: [],
      sunriseStr: '06:00',
      sunsetStr: '18:00',
      moonPct: 8,
      today: 'Monday 16 March',
      todayBestScore: 65,
      shSunsetQ: null,
      shSunriseQ: null,
      sunDir: null,
      crepPeak: 0,
      aiText: 'Good conditions tonight.',
      debugContext,
    });
    expect(debugContext.kitAdvisory).toBeDefined();
    expect(debugContext.kitAdvisory!.rules).toHaveLength(6);
    expect(debugContext.kitAdvisory!.tipsShown).toContain('astro-window');
  });
});
