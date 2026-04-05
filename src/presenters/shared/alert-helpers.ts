import type { Alert } from '../../contracts/index.js';

/**
 * Returns the emoji-prefixed badge text for an alert.
 */
export function alertBadgeText(alert: Alert): string {
  return alert.badge;
}

/**
 * Formats an array of alerts: deduplicated by category, sorted warn-first.
 * Returns the cleaned list ready for rendering.
 */
export function formatAlerts(alerts: Alert[] | undefined): Alert[] {
  if (!alerts?.length) return [];

  const seen = new Set<string>();
  const unique: Alert[] = [];
  for (const alert of alerts) {
    if (!seen.has(alert.category)) {
      seen.add(alert.category);
      unique.push(alert);
    }
  }

  return unique.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'warn' ? -1 : 1;
    return a.category.localeCompare(b.category);
  });
}

/**
 * Returns a CSS class name for the alert badge based on level.
 */
export function alertBadgeClass(alert: Alert): string {
  return alert.level === 'warn' ? 'alert-badge-warn' : 'alert-badge-info';
}
