import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import { moonFrac } from './utils.js';

export function getSolarAltitude(ts: number, lat: number, lon: number): number {
  const observer = new Observer(lat, lon, 0);
  const date = new Date(ts);
  const equator = Equator(Body.Sun, date, observer, true, true);
  const horizon = Horizon(date, observer, equator.ra, equator.dec, 'normal');
  return horizon.altitude;
}

export interface MoonMetrics {
  illumination: number;
  altitudeDeg: number;
  azimuthDeg: number;
  isUp: boolean;
}

/**
 * Returns a human-readable label describing the moon's current state.
 * Used in debug output to make score adjustments self-explanatory.
 */
export function moonState(metrics: MoonMetrics): string {
  if (!metrics.isUp) return 'Down';
  if (metrics.illumination < 0.2) return 'Thin crescent';
  if (metrics.illumination < 0.5) return 'Faint';
  if (metrics.altitudeDeg <= 30) return 'Bright & low';
  return 'Bright & high';
}

export function moonScoreAdjustment(metrics: MoonMetrics): number {
  if (!metrics.isUp) {
    // Graduated dark-sky bonus: full +30 when firmly set (≥30° below horizon),
    // smaller bonus when the moon has just dipped below (about to rise).
    const depthFactor = Math.min(1, Math.abs(metrics.altitudeDeg) / 30);
    return Math.round(10 + depthFactor * 20);
  }
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
  const ASTRO_DARK_ELEVATION = -18;
  const sorted = [...timestamps].sort((a, b) => Date.parse(a) - Date.parse(b));

  for (const ts of sorted) {
    const solarAlt = getSolarAltitude(Date.parse(ts), lat, lon);
    if (solarAlt <= ASTRO_DARK_ELEVATION) return ts;
  }

  return null;
}
