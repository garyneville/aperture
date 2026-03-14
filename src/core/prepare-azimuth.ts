export interface AzimuthSample {
  type: string;
  bearing: number;
  distanceKm: number;
  lat: number;
  lon: number;
  url: string;
}

export interface PrepareAzimuthInput {
  lat: number;
  lon: number;
  timezone: string;
  sunsetHueData: Array<{ type?: string; direction?: number | string }>;
}

const DISTANCES_KM = [25, 50, 80, 120, 160, 200];
const HOURLY_FIELDS = [
  'cloudcover', 'cloudcover_low', 'cloudcover_mid', 'cloudcover_high',
  'precipitation_probability', 'precipitation', 'visibility', 'windspeed_10m',
].join(',');

function degToRad(v: number): number { return v * Math.PI / 180; }
function radToDeg(v: number): number { return v * 180 / Math.PI; }

export function circularMean(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const x = values.reduce((s, v) => s + Math.cos(degToRad(v)), 0) / values.length;
  const y = values.reduce((s, v) => s + Math.sin(degToRad(v)), 0) / values.length;
  let deg = radToDeg(Math.atan2(y, x));
  if (deg < 0) deg += 360;
  return deg;
}

export function destinationPoint(latDeg: number, lonDeg: number, bearingDeg: number, distanceKm: number): { lat: number; lon: number } {
  const R = 6371;
  const d = distanceKm / R;
  const t = degToRad(bearingDeg);
  const p1 = degToRad(latDeg);
  const l1 = degToRad(lonDeg);

  const sinP2 = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t);
  const p2 = Math.asin(sinP2);
  const y = Math.sin(t) * Math.sin(d) * Math.cos(p1);
  const x = Math.cos(d) - Math.sin(p1) * sinP2;
  const l2 = l1 + Math.atan2(y, x);

  return {
    lat: radToDeg(p2),
    lon: ((radToDeg(l2) + 540) % 360) - 180,
  };
}

export function prepareAzimuthSamples(input: PrepareAzimuthInput): AzimuthSample[] {
  const { lat, lon, timezone, sunsetHueData } = input;
  const tz = encodeURIComponent(timezone);

  const directions: Record<string, number[]> = { sunrise: [], sunset: [] };
  (Array.isArray(sunsetHueData) ? sunsetHueData : []).forEach(entry => {
    if (!entry?.type || !Number.isFinite(Number(entry.direction))) return;
    if (entry.type === 'sunrise' || entry.type === 'sunset') {
      directions[entry.type].push(Number(entry.direction));
    }
  });

  const phaseBearings: Record<string, number> = {
    sunrise: circularMean(directions.sunrise, 90),
    sunset: circularMean(directions.sunset, 270),
  };

  return Object.entries(phaseBearings).flatMap(([type, bearing]) => {
    return DISTANCES_KM.map(distanceKm => {
      const point = destinationPoint(lat, lon, bearing, distanceKm);
      return {
        type,
        bearing: Math.round(bearing),
        distanceKm,
        lat: Number(point.lat.toFixed(4)),
        lon: Number(point.lon.toFixed(4)),
        url: `https://api.open-meteo.com/v1/forecast?latitude=${point.lat.toFixed(4)}&longitude=${point.lon.toFixed(4)}&hourly=${HOURLY_FIELDS}&timezone=${tz}&forecast_days=5`,
      };
    });
  });
}
