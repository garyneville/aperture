export interface AltLocation {
  name: string;
  lat: number;
  lon: number;
  driveMins: number;
  types: string[];
  darkSky: boolean;
}

export interface AltLocationWithUrl extends AltLocation {
  url: string;
}

export const ALT_LOCATIONS: AltLocation[] = [
  { name: 'Bolton Abbey', lat: 53.984, lon: -1.878, driveMins: 35, types: ['mist', 'atmospheric'], darkSky: false },
  { name: 'Brimham Rocks', lat: 54.085, lon: -1.681, driveMins: 40, types: ['landscape', 'mist'], darkSky: false },
  { name: 'Ribblehead Viaduct', lat: 54.201, lon: -2.368, driveMins: 55, types: ['landscape', 'drama'], darkSky: false },
  { name: 'Malham Cove', lat: 54.069, lon: -2.158, driveMins: 55, types: ['landscape', 'astro'], darkSky: true },
  { name: 'Mam Tor', lat: 53.352, lon: -1.804, driveMins: 60, types: ['landscape', 'mist'], darkSky: false },
  { name: 'Stanage Edge', lat: 53.367, lon: -1.628, driveMins: 65, types: ['landscape'], darkSky: false },
  { name: 'Ladybower Reservoir', lat: 53.394, lon: -1.712, driveMins: 65, types: ['reflections', 'clarity'], darkSky: false },
  { name: 'Sutton Bank', lat: 54.241, lon: -1.218, driveMins: 75, types: ['astro', 'landscape'], darkSky: true },
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
    url: `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=${HOURLY_FIELDS}&daily=sunrise,sunset,moonrise,moonset&timezone=${tz}&forecast_days=5`,
  }));
}
