import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import { moonFrac } from './utils.js';

export interface MoonMetrics {
  illumination: number;
  altitudeDeg: number;
  azimuthDeg: number;
  isUp: boolean;
}

export function moonScoreAdjustment(metrics: MoonMetrics): number {
  if (!metrics.isUp) return 30;
  if (metrics.illumination < 0.2) return 30;

  const altitudeFactor = Math.max(0, Math.min(90, metrics.altitudeDeg)) / 90;

  if (metrics.illumination < 0.5) {
    const softenedBonus = 10 - ((metrics.illumination - 0.2) / 0.3) * 10 * altitudeFactor;
    return Math.round(Math.max(0, softenedBonus));
  }

  const basePenalty = ((metrics.illumination - 0.5) / 0.5) * 20;
  return -Math.round(basePenalty * altitudeFactor);
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
