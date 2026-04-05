import type { NowcastSatelliteData, NowcastSignal, NowcastDirection } from '../contracts.js';

const STALE_WINDOW_MS = 45 * 60 * 1000; // 45 minutes — generous for MTG 20-30 min latency
const SIGNIFICANCE_THRESHOLD = 0.15; // minimum delta to be meaningful
const MIN_CLEAR_SKY_RADIATION = 10; // W/m² — below this, sun is too low for meaningful signal

export interface ClearingSignalInput {
  satellite: NowcastSatelliteData;
  forecastCloudCover: number; // 0-100 scale from model
  now: Date;
}

/**
 * Compute a clearing/thickening signal by comparing satellite-observed
 * shortwave radiation against clear-sky theoretical radiation.
 *
 * observedCloudFactor = 1 - (observed / clearSky)
 *   0 = fully clear, 1 = fully overcast
 *
 * Compare against forecastCloudCover (0-100 → 0-1) to detect divergence.
 */
export function computeClearingSignal(input: ClearingSignalInput): NowcastSignal | null {
  const { satellite, forecastCloudCover, now } = input;

  const observed = satellite.current?.shortwave_radiation_instant
    ?? satellite.current?.shortwave_radiation;
  const clearSky = satellite.current_clear_sky?.shortwave_radiation;
  const obsTime = satellite.current?.time;

  if (observed == null || clearSky == null || !obsTime) return null;

  // If clear-sky radiation is very low (night or deep twilight), signal is not useful
  if (clearSky < MIN_CLEAR_SKY_RADIATION) return null;

  // Check freshness
  const obsDate = new Date(obsTime);
  const ageMs = now.getTime() - obsDate.getTime();
  if (ageMs > STALE_WINDOW_MS || ageMs < 0) return null;

  const observedCloudFactor = Math.max(0, Math.min(1, 1 - (observed / clearSky)));
  const forecastCloudFraction = Math.max(0, Math.min(1, forecastCloudCover / 100));
  const delta = forecastCloudFraction - observedCloudFactor; // positive = clearing faster than forecast

  let direction: NowcastDirection = 'neutral';
  if (delta > SIGNIFICANCE_THRESHOLD) direction = 'clearing';
  else if (delta < -SIGNIFICANCE_THRESHOLD) direction = 'thickening';

  const magnitude = Math.abs(delta);

  const confidence = ageMs < 20 * 60 * 1000 ? 'high'
    : ageMs < 35 * 60 * 1000 ? 'medium'
    : 'low';

  const staleAfter = new Date(obsDate.getTime() + STALE_WINDOW_MS).toISOString();

  return {
    direction,
    magnitude,
    observedCloudFactor,
    forecastCloudFraction,
    delta,
    confidence,
    staleAfter,
    source: 'satellite-radiation',
  };
}
