import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { run } from './wrap-kp-index.adapter.js';

function fakeInput(json: unknown) {
  return { $input: { first: () => ({ json }), all: () => [{ json }] } } as never;
}

function fakeInputMulti(rows: unknown[]) {
  return { $input: { first: () => ({ json: rows[0] }), all: () => rows.map(json => ({ json })) } } as never;
}

describe('wrap-kp-index adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters out historical Kp entries before today', () => {
    const rawRows = [
      ['time_tag', 'kp', 'observed', 'noaa_scale'], // header
      ['2026-03-30 06:00:00', '2.33', 'observed', '1'],
      ['2026-04-01 09:00:00', '3.00', 'observed', '2'],
      ['2026-04-06 00:00:00', '4.67', 'predicted', '3'],
      ['2026-04-07 12:00:00', '5.00', 'predicted', '4'],
    ];
    const [result] = run(fakeInput(rawRows));
    expect(result.json.kpForecast).toEqual([
      { time: '2026-04-06 00:00:00', kp: 4.67 },
      { time: '2026-04-07 12:00:00', kp: 5 },
    ]);
  });

  it('returns empty array when all entries are historical', () => {
    const rawRows = [
      ['2026-03-28 06:00:00', '1.33', 'observed', '0'],
      ['2026-03-29 09:00:00', '2.00', 'observed', '1'],
    ];
    const [result] = run(fakeInput(rawRows));
    expect(result.json.kpForecast).toEqual([]);
  });

  it('keeps all entries when all are from today onward', () => {
    const rawRows = [
      ['2026-04-06 03:00:00', '3.00', 'predicted', '2'],
      ['2026-04-06 18:00:00', '5.33', 'predicted', '4'],
      ['2026-04-08 00:00:00', '2.67', 'predicted', '2'],
    ];
    const [result] = run(fakeInput(rawRows));
    expect(result.json.kpForecast).toHaveLength(3);
  });

  it('handles multi-item input (one row per n8n item)', () => {
    const rows = [
      ['2026-04-05 21:00:00', '3.00', 'observed', '2'],
      ['2026-04-06 06:00:00', '4.00', 'predicted', '3'],
    ];
    const [result] = run(fakeInputMulti(rows));
    expect(result.json.kpForecast).toEqual([
      { time: '2026-04-06 06:00:00', kp: 4 },
    ]);
  });

  it('returns empty kpForecast and kpError on exception', () => {
    const badInput = { $input: { all: () => { throw new Error('boom'); } } } as never;
    const [result] = run(badInput);
    expect(result.json.kpForecast).toEqual([]);
    expect(result.json.kpError).toBe(true);
  });
});
