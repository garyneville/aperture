import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';
import { getPhotoWeatherLocation } from '../../config.js';

type InspireWindow = {
  label?: unknown;
  start?: unknown;
  end?: unknown;
  peak?: unknown;
};

type InspireAltLocation = {
  name?: unknown;
};

type InspireInput = {
  windows?: unknown;
  altLocations?: unknown;
  dontBother?: unknown;
  peakKpTonight?: unknown;
  locationName?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeWindow(value: unknown): InspireWindow | null {
  return isRecord(value) ? value as InspireWindow : null;
}

function normalizeAltLocations(value: unknown): InspireAltLocation[] {
  return Array.isArray(value)
    ? value.filter(isRecord) as InspireAltLocation[]
    : [];
}

export function buildInspirePrompt(input: InspireInput): string {
  const locationName = input.locationName || getPhotoWeatherLocation();
  const windows = Array.isArray(input.windows) ? input.windows.map(normalizeWindow).filter(Boolean) : [];
  const topWindow = windows[0];
  const altLocations = normalizeAltLocations(input.altLocations);
  const dontBother = input.dontBother === true;
  const isAstro = typeof topWindow?.label === 'string' && topWindow.label.toLowerCase().includes('astro');
  const isSingleHour = topWindow?.start === topWindow?.end;
  const range = typeof topWindow?.start === 'string' && (!isSingleHour && typeof topWindow?.end === 'string')
    ? `${topWindow.start}\u2013${topWindow.end}`
    : typeof topWindow?.start === 'string'
      ? topWindow.start
      : '';
  const altNames = altLocations
    .slice(0, 2)
    .map(location => typeof location.name === 'string' ? location.name : null)
    .filter((name): name is string => Boolean(name))
    .join(' and ');
  const peakKpTonight = typeof input.peakKpTonight === 'number' ? input.peakKpTonight : null;
  const auroraVisible = isAstro && peakKpTonight !== null && peakKpTonight >= 6;

  let context: string;
  if (dontBother) {
    context = `Today the conditions are genuinely poor for photography in ${locationName}.${altNames ? ` There are better options nearby: ${altNames}.` : ''} Be honest but find inspiration anyway.`;
  } else if (topWindow) {
    const label = typeof topWindow.label === 'string' ? topWindow.label.toLowerCase() : 'a window';
    const peak = typeof topWindow.peak === 'number' ? topWindow.peak : 0;
    const auroraNote = auroraVisible
      ? ` An active aurora signal is in play tonight (Kp ${peakKpTonight.toFixed(1)}), so a clean northern horizon matters.`
      : '';
    context = `Today's best window is ${label}${range ? ` from ${range}` : ''}, scoring ${peak}/100. ${altNames ? `Nearby options: ${altNames}.` : ''} Conditions lean toward ${isAstro ? 'astrophotography and night skies' : 'golden light and landscape shots'}.${auroraNote}`;
  } else {
    context = `Conditions today are uncertain in ${locationName}.`;
  }

  return `You are a creative photography inspiration companion for a photographer based in ${locationName}.\n\n${context}\n\nIn 2\u20133 sentences (~50 words): where should they go today, what should they look for, what feeling should they chase? Be poetic, evocative, whimsical \u2014 no scores, no metrics, no technical advice. Just pure inspiration. Surprise them.`;
}

export function run({ $input }: N8nRuntime) {
  const input = firstInputJson($input, {} as InspireInput);
  return [{ json: { inspirePrompt: buildInspirePrompt(input) } }];
}
