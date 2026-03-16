import { Body, Equator, Horizon, Observer } from 'astronomy-engine';

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
}

export function moonFrac(ts: number): number {
  const cycle = 29.53058867 * 86400000;
  const phase = ((ts - 947182440000) % cycle + cycle) % cycle / cycle;
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

export function moonAltitude(ts: number, lat: number, lon: number): number {
  const observer = new Observer(lat, lon, 0);
  const equator = Equator(Body.Moon, new Date(ts), observer, true, false);
  return Horizon(new Date(ts), observer, equator.ra, equator.dec, 'normal').altitude;
}

export function isMoonUpAt(
  ts: number,
  lat: number,
  lon: number,
): boolean {
  return moonAltitude(ts, lat, lon) > 0;
}

export function solarElevation(ts: number, lat: number, lon: number): number {
  const JD = ts / 86400000 + 2440587.5;
  const n = JD - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  const eps = 23.439 * Math.PI / 180;
  const sinDec = Math.sin(eps) * Math.sin(lam);
  const latR = lat * Math.PI / 180;
  const GMST = (6.697375 + 0.0657098242 * n + (ts % 86400000) / 3600000) % 24;
  const LST = (GMST + lon / 15) % 24;
  const HA = (LST - 12) * 15 * Math.PI / 180;
  return Math.asin(Math.sin(latR) * sinDec + Math.cos(latR) * Math.sqrt(1 - sinDec * sinDec) * Math.cos(HA)) * 180 / Math.PI;
}

/**
 * Gaussian AOD clarity score — peaks at aod=0.10 (sweet spot for colour),
 * applies progressive illumination penalty above 0.25 (too thick = dull).
 */
export function aodClarity(aod: number): number {
  const mu = 0.10, sigma = 0.08;
  const vibrancy = Math.round(25 * Math.exp(-Math.pow(aod - mu, 2) / (2 * sigma * sigma)));
  const illuminationPenalty = aod > 0.25 ? Math.round((aod - 0.25) * 60) : 0;
  return vibrancy - illuminationPenalty;
}

export function pad(s: string | number, len: number): string {
  return String(s).padEnd(len).substring(0, len);
}

export function rpad(s: string | number, len: number): string {
  return String(s).padStart(len).slice(-len);
}

export function bar(n: number): string {
  const f = Math.round(n / 20);
  return '\u2588'.repeat(f) + '\u2591'.repeat(5 - f);
}

export function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
