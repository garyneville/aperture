import type { Alert, DerivedHourFeatures } from '../../../types/session-score.js';

/**
 * Generates safety and environmental alerts from aggregated hour features.
 *
 * Pure function: takes an array of hour features (typically a full day) and
 * returns deduplicated alerts sorted by severity (warn before info).
 */
export function generateAlerts(hours: DerivedHourFeatures[]): Alert[] {
  const alerts: Alert[] = [];

  // ── Lightning ─────────────────────────────────────────────────────────────
  const peakLightning = Math.max(
    ...hours.map(h => h.lightningRisk ?? 0),
  );
  if (peakLightning >= 50) {
    alerts.push({
      level: 'warn',
      category: 'lightning',
      badge: '⚡ Lightning risk',
      message: 'Active lightning risk during this session — seek shelter if storms develop.',
    });
  } else if (peakLightning >= 10) {
    alerts.push({
      level: 'info',
      category: 'lightning',
      badge: '⚡ Lightning possible',
      message: 'Low lightning potential in the forecast — monitor conditions.',
    });
  }

  // ── Air quality (European AQI) ────────────────────────────────────────────
  const peakAqi = Math.max(
    ...hours.map(h => h.europeanAqi ?? 0),
  );
  if (peakAqi > 100) {
    alerts.push({
      level: 'warn',
      category: 'air-quality',
      badge: '😷 Poor air quality',
      message: 'AQI above 100 — reduced visibility and contrast likely. Limit prolonged outdoor exposure.',
    });
  }

  // ── Pollen ────────────────────────────────────────────────────────────────
  const peakPollen = Math.max(
    ...hours.map(h => h.pollenGrainsM3 ?? 0),
  );
  if (peakPollen > 100) {
    alerts.push({
      level: 'info',
      category: 'pollen',
      badge: '🌿 High pollen',
      message: 'Pollen count is elevated — allergy sufferers should take precautions for outdoor sessions.',
    });
  }

  // ── Dust (AOD) ────────────────────────────────────────────────────────────
  const peakAod = Math.max(
    ...hours.map(h => h.aerosolOpticalDepth ?? 0),
  );
  if (peakAod > 0.4) {
    alerts.push({
      level: 'warn',
      category: 'dust',
      badge: '🌫️ Saharan dust',
      message: 'Dust AOD above 0.4 — expect flat, low-contrast light and reduced telephoto clarity.',
    });
  }

  // ── UV exposure ───────────────────────────────────────────────────────────
  const peakUv = Math.max(
    ...hours.map(h => h.uvIndex ?? 0),
  );
  const sessionHours = hours.length;
  if (peakUv >= 8 && sessionHours > 2) {
    alerts.push({
      level: 'info',
      category: 'uv-exposure',
      badge: '☀️ High UV',
      message: `UV index ${Math.round(peakUv)} — wear sun protection for extended outdoor sessions.`,
    });
  }

  // Sort: warn before info, then by category for stability
  return alerts.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'warn' ? -1 : 1;
    return a.category.localeCompare(b.category);
  });
}
