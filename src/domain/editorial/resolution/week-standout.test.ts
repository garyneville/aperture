import { describe, expect, it } from 'vitest';
import {
  buildDeterministicWeekStandout,
  resolveWeekStandout,
} from './week-standout.js';

describe('week standout resolution', () => {
  it('uses the reliable-day wording when today is steadier but another day scores higher', () => {
    const text = buildDeterministicWeekStandout([
      { dayIdx: 0, dayLabel: 'Today', headlineScore: 60, confidenceStdDev: 5 },
      { dayIdx: 1, dayLabel: 'Wednesday', headlineScore: 70, confidenceStdDev: 17 },
    ]);

    expect(text).toBe('Today is the most reliable forecast; Wednesday may score higher but with much lower certainty.');
  });

  it('uses the standout-day wording when one day clearly leads', () => {
    const text = buildDeterministicWeekStandout([
      { dayIdx: 0, dayLabel: 'Today', headlineScore: 44 },
      { dayIdx: 1, dayLabel: 'Friday', headlineScore: 57 },
      { dayIdx: 2, dayLabel: 'Saturday', headlineScore: 49 },
    ]);

    expect(text).toBe('Friday is the standout day.');
  });

  it('keeps the deterministic result even when the model hint disagrees', () => {
    const result = resolveWeekStandout('Today is the standout day.', [
      { dayIdx: 0, dayLabel: 'Today', headlineScore: 44 },
      { dayIdx: 1, dayLabel: 'Friday', headlineScore: 57 },
      { dayIdx: 2, dayLabel: 'Saturday', headlineScore: 49 },
    ]);

    expect(result.text).toBe('Friday is the standout day.');
    expect(result.used).toBe(true);
    expect(result.decision).toBe('deterministic-used');
    expect(result.hintAligned).toBe(false);
  });

  it('omits the week standout cleanly when no forecast days are available', () => {
    const result = resolveWeekStandout(null, []);

    expect(result.text).toBe('');
    expect(result.used).toBe(false);
    expect(result.decision).toBe('omitted');
    expect(result.note).toBe('no forecast days available');
  });
});
