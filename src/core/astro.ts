import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import { moonFrac } from './utils.js';

export interface MoonMetrics {
  illumination: number;
  altitudeDeg: number;
  azimuthDeg: number;
  isUp: boolean;
}

export function getMoonMetrics(ts: number, lat: number, lon: number): MoonMetrics {
  const observer = new Observer(lat, lon, 0);
  const date = new Date(ts);
  const equator = Equator(Body.Moon, date, observer, true, false);
  const horizon = Horizon(date, observer, equator.ra, equator.dec, 'normal');

  return {
    illumination: moonFrac(ts),
    altitudeDeg: horizon.altitude,
    azimuthDeg: horizon.azimuth,
    isUp: horizon.altitude > 0,
  };
}

export function findDarkSkyStart(
  timestamps: string[],
  lat: number,
  lon: number,
): string | null {
  const sorted = [...timestamps].sort((a, b) => Date.parse(a) - Date.parse(b));

  for (const ts of sorted) {
    if (!getMoonMetrics(Date.parse(ts), lat, lon).isUp) return ts;
  }

  return null;
}
