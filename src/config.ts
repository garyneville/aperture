export const PHOTO_WEATHER_CONFIG = {
  lat: '__PHOTO_WEATHER_LAT__',
  lon: '__PHOTO_WEATHER_LON__',
  location: '__PHOTO_WEATHER_LOCATION__',
  timezone: '__PHOTO_WEATHER_TIMEZONE__',
  icao: '__PHOTO_WEATHER_ICAO__',
} as const;

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPhotoWeatherLat(): number {
  return parseNumber(PHOTO_WEATHER_CONFIG.lat, 53.82703);
}

export function getPhotoWeatherLon(): number {
  return parseNumber(PHOTO_WEATHER_CONFIG.lon, -1.570755);
}
