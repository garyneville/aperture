import { describe, expect, it } from 'vitest';
import { run } from './wrap-ecmwf-supplement.adapter.js';

function fakeInput(json: Record<string, unknown>) {
  return { $input: { first: () => ({ json }), all: () => [{ json }] } } as never;
}

describe('wrap-ecmwf-supplement adapter', () => {
  it('passes through ECMWF supplement data', () => {
    const payload = {
      hourly: {
        time: ['2026-04-06T00:00', '2026-04-06T01:00'],
        boundary_layer_height: [320, 450],
        soil_temperature_0cm: [4.2, 3.8],
      },
    };
    const [result] = run(fakeInput(payload));
    expect(result.json.ecmwfSupplement).toEqual(payload);
  });

  it('returns empty ecmwfSupplement when input is missing', () => {
    const runtime = {
      $input: { first: () => { throw new Error('no input'); }, all: () => [] },
    } as never;
    const [result] = run(runtime);
    expect(result.json.ecmwfSupplement).toEqual({ hourly: { time: [] } });
  });
});
