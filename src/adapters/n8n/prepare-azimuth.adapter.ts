import { prepareAzimuthSamples } from '../../core/prepare-azimuth.js';
import type { N8nRuntime } from './types.js';

export function run({ $ }: N8nRuntime) {
  const vars = $('Set Variables').first().json;
  const shData = $('HTTP: SunsetHue').first().json;

  const samples = prepareAzimuthSamples({
    lat: parseFloat(vars.lat || 53.82703),
    lon: parseFloat(vars.lon || -1.570755),
    timezone: vars.timezone || 'Europe/London',
    sunsetHueData: shData,
  });

  return samples.map(s => ({ json: s }));
}
