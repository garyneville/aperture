import {
  LONG_RANGE_LOCATIONS,
  isWithinDriveLimit,
  estimatedDriveMins,
  haversineKm,
  type LongRangeLocation,
  type LocationTag,
  type Region,
} from './long-range-locations.js';
import { ALT_LOCATIONS } from './prepare-alt-locations.js';
import type { SiteDarkness } from './site-darkness.js';
import type { HomeLocation } from '../contracts/home-location.js';
import { DEFAULT_HOME_LOCATION } from './home-location.js';

/** Locations within this radius of an alt-location are already covered by the
 *  5-day alt-weather pipeline and don't need a separate long-range API call. */
const ALT_DEDUP_RADIUS_KM = 2;

export interface LongRangeLocationWithUrl {
  name: string;
  lat: number;
  lon: number;
  region: Region;
  elevation: number;
  tags: LocationTag[];
  siteDarkness: SiteDarkness;
  darkSky: boolean;
  driveMins: number;
  url: string;
}

const HOURLY_FIELDS = [
  'cloudcover', 'cloudcover_low', 'cloudcover_mid', 'cloudcover_high',
  'visibility', 'temperature_2m', 'relativehumidity_2m', 'dewpoint_2m',
  'precipitation', 'windspeed_10m', 'windgusts_10m',
  'total_column_integrated_water_vapour',
].join(',');

/**
 * Returns true if a long-range location is within ALT_DEDUP_RADIUS_KM of any
 * alt-location (which already receives a 5-day forecast).
 */
function isCoveredByAltLocation(loc: LongRangeLocation): boolean {
  return ALT_LOCATIONS.some(
    alt => haversineKm(loc.lat, loc.lon, alt.lat, alt.lon) < ALT_DEDUP_RADIUS_KM,
  );
}

/**
 * Returns long-range locations within the 4-hour drive limit,
 * each enriched with an Open-Meteo forecast URL and estimated drive time.
 * Locations already covered by an alt-location (within 2 km) are excluded
 * to avoid redundant API calls — those are scored via the alt-weather pipeline.
 */
export function prepareLongRangeLocations(
  timezone: string,
  homeLocation: Pick<HomeLocation, 'lat' | 'lon'> = DEFAULT_HOME_LOCATION,
): LongRangeLocationWithUrl[] {
  const tz = encodeURIComponent(timezone);
  return LONG_RANGE_LOCATIONS
    .filter(loc => isWithinDriveLimit(loc, homeLocation))
    .filter(loc => !isCoveredByAltLocation(loc))
    .map(loc => ({
      name: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      region: loc.region,
      elevation: loc.elevation,
      tags: loc.tags,
      siteDarkness: loc.siteDarkness,
      darkSky: loc.darkSky,
      driveMins: estimatedDriveMins(loc, homeLocation),
      url: `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&models=ukmo_seamless&hourly=${HOURLY_FIELDS}&daily=sunrise,sunset&timezone=${tz}&forecast_days=1`,
    }));
}
