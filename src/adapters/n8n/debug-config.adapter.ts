import type { N8nRuntime } from './types.js';

const DEBUG_EMAIL_TO = '__PHOTO_WEATHER_DEBUG_EMAIL_TO__';

function isPlaceholder(value: string): boolean {
  return /^__.+__$/.test(value);
}

export function run(_runtime: N8nRuntime) {
  const debugEmailTo = isPlaceholder(DEBUG_EMAIL_TO) ? '' : DEBUG_EMAIL_TO.trim();
  const debugMode = debugEmailTo.length > 0;

  return [{
    json: {
      debugMode,
      debugModeSource: debugMode ? 'debug recipient configured' : 'debug recipient missing',
      debugEmailTo,
    },
  }];
}
