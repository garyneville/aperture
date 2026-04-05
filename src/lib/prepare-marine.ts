/**
 * URL builder for the Open-Meteo Marine API.
 *
 * Builds a single request URL for a coastal location. The marine API
 * returns hourly wave/swell fields needed by the seascape evaluator.
 *
 * @see https://open-meteo.com/en/docs/marine-weather-api
 */

export interface MarineLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface MarineLocationWithUrl extends MarineLocation {
  url: string;
}

const MARINE_HOURLY_FIELDS = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wave_peak_period',
].join(',');

export function prepareMarine(
  location: MarineLocation,
  timezone: string,
  forecastDays = 5,
): MarineLocationWithUrl {
  const tz = encodeURIComponent(timezone);
  return {
    ...location,
    url: `https://marine-api.open-meteo.com/v1/marine?latitude=${location.lat}&longitude=${location.lon}&hourly=${MARINE_HOURLY_FIELDS}&timezone=${tz}&forecast_days=${forecastDays}`,
  };
}
