import { describe, expect, it } from 'vitest';
import { alertBadgeText, alertBadgeClass, formatAlerts } from './alert-helpers.js';
import type { Alert } from '../../contracts/index.js';

describe('alertBadgeText', () => {
  it('returns the badge field unchanged', () => {
    const alert: Alert = { level: 'warn', category: 'lightning', badge: '⚡ Lightning risk', message: 'Seek shelter.' };
    expect(alertBadgeText(alert)).toBe('⚡ Lightning risk');
  });
});

describe('alertBadgeClass', () => {
  it('returns warn class for warn-level alerts', () => {
    const alert: Alert = { level: 'warn', category: 'dust', badge: '🌫️ Saharan dust', message: 'Low contrast.' };
    expect(alertBadgeClass(alert)).toBe('alert-badge-warn');
  });

  it('returns info class for info-level alerts', () => {
    const alert: Alert = { level: 'info', category: 'pollen', badge: '🌿 High pollen', message: 'Allergy risk.' };
    expect(alertBadgeClass(alert)).toBe('alert-badge-info');
  });
});

describe('formatAlerts', () => {
  it('returns empty array for undefined input', () => {
    expect(formatAlerts(undefined)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(formatAlerts([])).toEqual([]);
  });

  it('deduplicates by category keeping the first occurrence', () => {
    const alerts: Alert[] = [
      { level: 'warn', category: 'lightning', badge: '⚡ Lightning risk', message: 'A' },
      { level: 'info', category: 'lightning', badge: '⚡ Lightning possible', message: 'B' },
    ];
    const result = formatAlerts(alerts);
    expect(result).toHaveLength(1);
    expect(result[0].badge).toBe('⚡ Lightning risk');
  });

  it('sorts warn alerts before info alerts', () => {
    const alerts: Alert[] = [
      { level: 'info', category: 'pollen', badge: '🌿 High pollen', message: 'A' },
      { level: 'warn', category: 'lightning', badge: '⚡ Lightning risk', message: 'B' },
    ];
    const result = formatAlerts(alerts);
    expect(result[0].level).toBe('warn');
    expect(result[1].level).toBe('info');
  });

  it('preserves all unique categories', () => {
    const alerts: Alert[] = [
      { level: 'warn', category: 'lightning', badge: '⚡ Lightning risk', message: 'A' },
      { level: 'info', category: 'pollen', badge: '🌿 High pollen', message: 'B' },
      { level: 'warn', category: 'dust', badge: '🌫️ Saharan dust', message: 'C' },
    ];
    const result = formatAlerts(alerts);
    expect(result).toHaveLength(3);
    expect(result.map(a => a.category)).toEqual(['dust', 'lightning', 'pollen']);
  });
});
