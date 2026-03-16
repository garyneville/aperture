import { isDarkSkySite, siteDarknessFromBortle, type SiteDarkness } from './site-darkness.js';

export interface AltLocation {
  name: string;
  lat: number;
  lon: number;
  driveMins: number;
  types: string[];
  siteDarkness: SiteDarkness;
  darkSky: boolean;
}

export interface AltLocationWithUrl extends AltLocation {
  url: string;
}

function defineAltLocation(raw: Omit<AltLocation, 'siteDarkness' | 'darkSky'> & { bortle: number }): AltLocation {
  const siteDarkness = siteDarknessFromBortle(raw.bortle);
  return {
    name: raw.name,
    lat: raw.lat,
    lon: raw.lon,
    driveMins: raw.driveMins,
    types: raw.types,
    siteDarkness,
    darkSky: isDarkSkySite(siteDarkness),
  };
}

export const ALT_LOCATIONS: AltLocation[] = [
  defineAltLocation({ name: 'Bolton Abbey', lat: 53.984, lon: -1.878, driveMins: 35, types: ['mist', 'atmospheric'], bortle: 5 }),
  defineAltLocation({ name: 'Brimham Rocks', lat: 54.085, lon: -1.681, driveMins: 40, types: ['landscape', 'mist'], bortle: 4 }),
  defineAltLocation({ name: 'Ribblehead Viaduct', lat: 54.201, lon: -2.368, driveMins: 55, types: ['landscape', 'drama'], bortle: 4 }),
  defineAltLocation({ name: 'Malham Cove', lat: 54.069, lon: -2.158, driveMins: 55, types: ['landscape', 'astro'], bortle: 3 }),
  defineAltLocation({ name: 'Mam Tor', lat: 53.352, lon: -1.804, driveMins: 60, types: ['landscape', 'mist'], bortle: 5 }),
  defineAltLocation({ name: 'Stanage Edge', lat: 53.367, lon: -1.628, driveMins: 65, types: ['landscape'], bortle: 5 }),
  defineAltLocation({ name: 'Ladybower Reservoir', lat: 53.394, lon: -1.712, driveMins: 65, types: ['reflections', 'clarity'], bortle: 5 }),
  defineAltLocation({ name: 'Sutton Bank', lat: 54.241, lon: -1.218, driveMins: 75, types: ['astro', 'landscape'], bortle: 3 }),
];

const HOURLY_FIELDS = [
  'cloudcover', 'cloudcover_low', 'cloudcover_mid', 'cloudcover_high',
  'visibility', 'temperature_2m', 'relativehumidity_2m', 'dewpoint_2m',
  'precipitation_probability', 'precipitation', 'windspeed_10m', 'windgusts_10m',
  'total_column_integrated_water_vapour',
].join(',');

export function prepareAltLocations(timezone: string): AltLocationWithUrl[] {
  const tz = encodeURIComponent(timezone);
  return ALT_LOCATIONS.map(loc => ({
    ...loc,
    url: `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=${HOURLY_FIELDS}&daily=sunrise,sunset&timezone=${tz}&forecast_days=5`,
  }));
}
