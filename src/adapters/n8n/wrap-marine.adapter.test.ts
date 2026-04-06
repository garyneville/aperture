import { describe, expect, it, vi } from 'vitest';
import { run } from './wrap-marine.adapter.js';

vi.mock('../../config/runtime.js', () => ({
  getPhotoWeatherIsCoastal: vi.fn(() => false),
}));

import { getPhotoWeatherIsCoastal } from '../../config/runtime.js';

const mockIsCoastal = vi.mocked(getPhotoWeatherIsCoastal);

function fakeInput(json: Record<string, unknown>) {
  return { $input: { first: () => ({ json }), all: () => [{ json }] } } as never;
}

describe('wrap-marine adapter', () => {
  it('returns empty marine data when location is inland', () => {
    mockIsCoastal.mockReturnValue(false);
    const [result] = run(fakeInput({ hourly: { time: ['2026-04-06T00:00'], wave_height: [1.2] } }));
    expect(result.json.marine).toEqual({ hourly: { time: [] } });
  });

  it('passes through marine data when location is coastal', () => {
    mockIsCoastal.mockReturnValue(true);
    const marinePayload = { hourly: { time: ['2026-04-06T00:00'], wave_height: [1.2] } };
    const [result] = run(fakeInput(marinePayload));
    expect(result.json.marine).toEqual(marinePayload);
  });
});
