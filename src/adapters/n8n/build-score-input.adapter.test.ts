import { describe, expect, it } from 'vitest';
import { run } from './build-score-input.adapter.js';

function fakeInput(json: Record<string, unknown>) {
  return { $input: { first: () => ({ json }), all: () => [{ json }] } } as never;
}

describe('build-score-input adapter', () => {
  it('merges ECMWF supplement fields into weather by timestamp alignment', () => {
    const weather = {
      hourly: {
        time: ['2026-04-06T00:00', '2026-04-06T01:00', '2026-04-06T02:00'],
        cloudcover: [50, 60, 70],
      },
      daily: { sunrise: ['2026-04-06T06:00'], sunset: ['2026-04-06T19:00'] },
    };
    const ecmwfSupplement = {
      hourly: {
        time: ['2026-04-06T00:00', '2026-04-06T01:00', '2026-04-06T02:00'],
        boundary_layer_height: [320, 450, 600],
        soil_temperature_0cm: [4.2, 3.8, 3.5],
      },
    };

    const [result] = run(fakeInput({ weather, ecmwfSupplement }));
    expect(result.json.weather.hourly.boundary_layer_height).toEqual([320, 450, 600]);
    expect(result.json.weather.hourly.soil_temperature_0cm).toEqual([4.2, 3.8, 3.5]);
    // Original weather fields preserved
    expect(result.json.weather.hourly.cloudcover).toEqual([50, 60, 70]);
  });

  it('aligns ECMWF data when time arrays differ', () => {
    const weather = {
      hourly: {
        time: ['2026-04-06T00:00', '2026-04-06T01:00', '2026-04-06T02:00'],
        cloudcover: [50, 60, 70],
      },
      daily: { sunrise: [], sunset: [] },
    };
    // ECMWF only has data for the first and third hours
    const ecmwfSupplement = {
      hourly: {
        time: ['2026-04-06T00:00', '2026-04-06T02:00'],
        boundary_layer_height: [320, 600],
      },
    };

    const [result] = run(fakeInput({ weather, ecmwfSupplement }));
    // Middle hour should be null since ECMWF doesn't have that timestamp
    expect(result.json.weather.hourly.boundary_layer_height).toEqual([320, null, 600]);
  });

  it('does not overwrite weather fields when ECMWF supplement is empty', () => {
    const weather = {
      hourly: {
        time: ['2026-04-06T00:00'],
        cloudcover: [50],
        soil_temperature_0cm: [5.0],
      },
      daily: { sunrise: [], sunset: [] },
    };
    const ecmwfSupplement = { hourly: { time: [] } };

    const [result] = run(fakeInput({ weather, ecmwfSupplement }));
    // Original soil_temperature_0cm preserved since ECMWF has no data
    expect(result.json.weather.hourly.soil_temperature_0cm).toEqual([5.0]);
  });

  it('falls back gracefully when ECMWF supplement is absent', () => {
    const weather = {
      hourly: { time: ['2026-04-06T00:00'], cloudcover: [50] },
      daily: { sunrise: [], sunset: [] },
    };

    const [result] = run(fakeInput({ weather }));
    expect(result.json.weather.hourly.cloudcover).toEqual([50]);
    expect(result.json.weather.hourly.boundary_layer_height).toBeUndefined();
  });
});
