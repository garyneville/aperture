/**
 * Public contract surface for home location configuration.
 *
 * Runtime defaults and helper functions live in src/lib/home-location.ts.
 */

export interface HomeLocation {
  name: string;
  lat: number;
  lon: number;
  timezone: string;
  icao?: string;
  isCoastal?: boolean;
}
