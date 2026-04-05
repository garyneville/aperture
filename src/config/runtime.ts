export const PHOTO_WEATHER_CONFIG = {
  lat: '__PHOTO_WEATHER_LAT__',
  lon: '__PHOTO_WEATHER_LON__',
  location: '__PHOTO_WEATHER_LOCATION__',
  timezone: '__PHOTO_WEATHER_TIMEZONE__',
  icao: '__PHOTO_WEATHER_ICAO__',
  editorialPrimaryProvider: '__PHOTO_BRIEF_EDITORIAL_PRIMARY_PROVIDER__',
  editorialPromptMode: '__PHOTO_BRIEF_EDITORIAL_PROMPT_MODE__',
  inspireEnabled: '__PHOTO_BRIEF_INSPIRE_ENABLED__',
  editorialProviders: '__PHOTO_BRIEF_EDITORIAL_PROVIDERS__',
} as const;

export const PHOTO_BRIEF_WORKFLOW_VERSION = 'debug-trace-v1';
export type EditorialPromptMode = 'legacy-json' | 'structured-output';

function isPlaceholder(value: string): boolean {
  return /^__.+__$/.test(value);
}

function parseNumber(value: string, fallback: number): number {
  if (!value || isPlaceholder(value)) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseString(value: string, fallback: string): string {
  return !value || isPlaceholder(value) ? fallback : value;
}

export function getPhotoWeatherLat(): number {
  return parseNumber(PHOTO_WEATHER_CONFIG.lat, 53.82703);
}

export function getPhotoWeatherLon(): number {
  return parseNumber(PHOTO_WEATHER_CONFIG.lon, -1.570755);
}

export function getPhotoWeatherLocation(): string {
  return parseString(PHOTO_WEATHER_CONFIG.location, 'Leeds');
}

export function getPhotoWeatherTimezone(): string {
  return parseString(PHOTO_WEATHER_CONFIG.timezone, 'Europe/London');
}

export function getPhotoWeatherIcao(): string {
  return parseString(PHOTO_WEATHER_CONFIG.icao, 'EGNM');
}

export function getPhotoBriefEditorialPrimaryProvider(): 'groq' | 'gemini' {
  const provider = parseString(PHOTO_WEATHER_CONFIG.editorialPrimaryProvider, 'groq').toLowerCase();
  return provider === 'gemini' ? 'gemini' : 'groq';
}

export function getPhotoBriefEditorialPromptMode(): EditorialPromptMode {
  const mode = parseString(PHOTO_WEATHER_CONFIG.editorialPromptMode, 'structured-output').toLowerCase();
  return mode === 'legacy-json' ? 'legacy-json' : 'structured-output';
}

export function getPhotoBriefInspireEnabled(): boolean {
  const value = PHOTO_WEATHER_CONFIG.inspireEnabled;
  if (!value || isPlaceholder(value)) return true;
  return value.toLowerCase() !== 'false';
}

export type EditorialProviderName = 'groq' | 'gemini' | 'openrouter';

const DEFAULT_EDITORIAL_PROVIDERS: EditorialProviderName[] = ['groq', 'gemini'];

export function getEditorialProviders(): EditorialProviderName[] {
  const raw = parseString(PHOTO_WEATHER_CONFIG.editorialProviders, '');
  if (!raw) return DEFAULT_EDITORIAL_PROVIDERS;
  const providers = raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter((s): s is EditorialProviderName => s === 'groq' || s === 'gemini' || s === 'openrouter');
  return providers.length > 0 ? providers : DEFAULT_EDITORIAL_PROVIDERS;
}

export interface EditorialRetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_EDITORIAL_RETRY: EditorialRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  backoffMultiplier: 3,
};
