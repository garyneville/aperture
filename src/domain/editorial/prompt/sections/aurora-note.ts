import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from '../../aurora-visibility.js';
import type { AuroraSignal } from '../../../../lib/aurora-providers.js';
import type { HomeLocation } from '../../../../types/home-location.js';
import type { KpEntry } from '../build-prompt.js';

export function peakKpForNight(kpForecast: KpEntry[] | undefined, now: Date): number | null {
  if (!kpForecast || !kpForecast.length) return null;
  const tonightStart = new Date(now);
  tonightStart.setHours(18, 0, 0, 0);
  const tonightEnd = new Date(now);
  tonightEnd.setDate(tonightEnd.getDate() + 1);
  tonightEnd.setHours(6, 0, 0, 0);
  let peak: number | null = null;
  for (const entry of kpForecast) {
    const t = new Date(entry.time);
    if (t >= tonightStart && t <= tonightEnd) {
      if (peak === null || entry.kp > peak) peak = entry.kp;
    }
  }
  return peak;
}

export function buildAuroraNote(
  peakKpTonight: number | null,
  homeLocation: HomeLocation,
  auroraSignal?: AuroraSignal | null,
): string {
  const parts: string[] = [];
  const localLat = homeLocation.lat;
  const localThreshold = auroraVisibleKpThresholdForLat(localLat);

  // Near-term: AuroraWatch UK takes priority over Kp when available and active.
  // Only fall back to the NOAA Kp index when AuroraWatch UK is not available.
  const nearTerm = auroraSignal?.nearTerm;
  const awukActive = nearTerm && !nearTerm.isStale && nearTerm.level !== 'green';

  if (awukActive) {
    const levelLabel: Record<string, string> = {
      yellow: 'Minor geomagnetic activity',
      amber: 'Moderate geomagnetic activity',
      red: 'Storm-level activity',
    };
    const label = levelLabel[nearTerm.level] ?? nearTerm.level;
    parts.push(`Aurora (AuroraWatch UK): ${label} — watch conditions tonight for ${homeLocation.name}.`);
  } else if (peakKpTonight !== null && peakKpTonight >= 5) {
    // Fall back to NOAA Kp when AuroraWatch UK is unavailable or green
    const localVisible = isAuroraLikelyVisibleAtLat(localLat, peakKpTonight);
    parts.push(
      localVisible
        ? `Aurora alert: Kp ${peakKpTonight.toFixed(1)} forecast tonight — this clears the local visibility threshold of Kp ${localThreshold} for ${homeLocation.name}.`
        : `Aurora alert: Kp ${peakKpTonight.toFixed(1)} forecast tonight — local visibility usually needs about Kp ${localThreshold} at ${homeLocation.name} latitude.`,
    );
  }

  // Long-range: NASA DONKI CME (always shown when upcoming, independent of near-term)
  const upcomingCmeCount = auroraSignal?.upcomingCmeCount ?? 0;
  const nextArrival = auroraSignal?.nextCmeArrival;
  if (upcomingCmeCount > 0 && nextArrival) {
    const arrivalDate = new Date(nextArrival);
    const arrivalStr = isNaN(arrivalDate.getTime())
      ? nextArrival
      : arrivalDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const cmeLabel = upcomingCmeCount === 1 ? 'Earth-directed CME' : `${upcomingCmeCount} Earth-directed CMEs`;
    parts.push(`Aurora prediction: ${cmeLabel} expected ~${arrivalStr} (NASA DONKI) — elevated aurora probability 1–3 days ahead.`);
  }

  return parts.join(' ');
}
