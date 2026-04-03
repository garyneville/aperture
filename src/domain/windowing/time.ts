/**
 * Time conversion utilities for window scheduling.
 *
 * These pure functions convert between clock strings (HH:MM) and minute values.
 * They are used by both domain logic and presenters for consistent time handling.
 */

/**
 * Convert a clock string (HH:MM) to minutes since midnight.
 * Returns null for invalid inputs.
 */
export function clockToMinutes(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

/**
 * Convert minutes since midnight to a clock string (HH:MM).
 * Handles wrap-around for times crossing midnight.
 */
export function minutesToClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
