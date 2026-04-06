import type { Window } from '../../../windowing/best-windows.js';
import type { DailySummary } from '../../../windowing/best-windows.js';

export function extractLocalHHMM(iso: string): string {
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '--:--';
}

export function isAstroWindow(window: Window | undefined): boolean {
  if (!window) return false;
  return window.label.toLowerCase().includes('astro') || (window.tops || []).includes('astrophotography');
}

export function peakHourForWindow(window: Window | undefined): string | null {
  if (!window?.hours?.length) return null;
  const peakHour = window.hours.find(hour => hour.score === window.peak) || window.hours[window.hours.length - 1];
  return peakHour?.hour || null;
}

export function windowRange(w: { start: string; end: string }): string {
  return w.start === w.end ? w.start : `${w.start}-${w.end}`;
}

export function windowTrendInsight(window: Window | undefined): string {
  if (!window?.hours?.length) return '';
  const peakHour = peakHourForWindow(window);
  if (!peakHour) return '';

  if (window.start === window.end) return '';

  const firstHour = window.hours[0];
  const lastHour = window.hours[window.hours.length - 1];
  const firstScore = typeof firstHour?.score === 'number' ? firstHour.score : null;
  const lastScore = typeof lastHour?.score === 'number' ? lastHour.score : null;

  if (peakHour === window.end && firstScore !== null && lastScore !== null && lastScore - firstScore >= 6) {
    return `- Peak local time is around ${peakHour}, with conditions improving through the window.`;
  }

  if (peakHour === window.start && firstScore !== null && lastScore !== null && firstScore - lastScore >= 6) {
    return `- Peak local time is around ${peakHour}, right as the window opens.`;
  }

  if (peakHour === window.end) return `- Peak local time is around ${peakHour}, near the end of the window.`;
  if (peakHour === window.start) return `- Peak local time is around ${peakHour}, right at the start of the window.`;
  return `- Peak local time is around ${peakHour}, within the ${window.label.toLowerCase()}.`;
}

export function weekSummaryLine(dailySummary: DailySummary[]): string {
  return dailySummary.slice(0, 5).map(d => {
    const score = d.headlineScore ?? d.photoScore;
    if (!d.confidence || d.confidence === 'unknown') return `${d.dayLabel}: ${score}/100`;
    const spreadPart = d.confidenceStdDev != null
      ? ` spread ${d.confidenceStdDev}`
      : '';
    return `${d.dayLabel}: ${score}/100 (${d.confidence} confidence${spreadPart})`;
  }).join(' | ');
}

export function moonTimingNote(todayDay: DailySummary | undefined): string {
  if (!todayDay?.darkSkyStartsAt || (todayDay.astroScore ?? 0) <= 0) return '';
  if (todayDay.darkSkyStartsAt === '00:00') {
    return '\nAstronomical darkness begins by 00:00, so dark-sky conditions are in place from the start of the usable night.';
  }
  return `\nDark-sky conditions begin from ${todayDay.darkSkyStartsAt} once astronomical twilight ends.`;
}

export function confidenceLabel(confidence: string): string {
  if (confidence === 'high') return 'high';
  if (confidence === 'medium') return 'fair';
  if (confidence === 'low') return 'low';
  if (confidence === 'very-low') return 'very low';
  return 'unknown';
}

export function getMonthOneIndexed(date: Date, timezone: string): number {
  return Number.parseInt(
    new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: timezone }).format(date),
    10,
  );
}
