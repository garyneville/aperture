import type { N8nRuntime } from './types.js';

export function run(_runtime: N8nRuntime) {
  return [{
    json: {
      debugMode: false,
      debugEmailTo: '__PHOTO_WEATHER_DEBUG_EMAIL_TO__',
    },
  }];
}
