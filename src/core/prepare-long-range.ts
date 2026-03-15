import {
  LONG_RANGE_LOCATIONS,
  isWithinDriveLimit,
  estimatedDriveMins,
  type LongRangeLocation,
  type LocationTag,
  type Region,
} from './long-range-locations.js';

export interface LongRangeLocationWithUrl {
  name: string;
  lat: number;
  lon: number;
  region: Region;
  elevation: number;
  tags: LocationTag[];
  darkSky: boolean;
  driveMins: number;
  url: string;
}

const HOURLY_FIELDS = [
  'cloudcover', 'cloudcover_low', 'cloudcover_mid', 'cloudcover_high',
  'visibility', 'temperature_2m', 'relativehumidity_2m', 'dewpoint_2m',
  'precipitation_probability', 'precipitation', 'windspeed_10m', 'windgusts_10m',
  'total_column_integrated_water_vapour',
].join(',');

/**
 * Returns long-range locations within the 4-hour drive limit,
 * each enriched with an Open-Meteo forecast URL and estimated drive time.
 */
export function prepareLongRangeLocations(timezone: string): LongRangeLocationWithUrl[] {
  const tz = encodeURIComponent(timezone);
  return LONG_RANGE_LOCATIONS
    .filter(isWithinDriveLimit)
    .map(loc => ({
      name: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      region: loc.region,
      elevation: loc.elevation,
      tags: loc.tags,
      darkSky: loc.darkSky,
      driveMins: estimatedDriveMins(loc),
      url: `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=${HOURLY_FIELDS}&daily=sunrise,sunset&timezone=${tz}&forecast_days=1`,
    }));
}
