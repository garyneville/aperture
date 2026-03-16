export interface AstroScoreWindow {
  start?: string;
  end?: string;
  peak?: number;
  darkPhaseStart?: string | null;
}

export interface AstroScoreDaySummary {
  astroScore?: number;
  bestAstroHour?: string | null;
  darkSkyStartsAt?: string | null;
}

export interface AstroScoreExplanation {
  astroScore: number;
  windowScore: number;
  astroHour: string | null;
  reason: 'weighted-gap' | 'outside-window' | 'darker-later';
  text: string;
}

function isValidClockTime(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function windowContainsHour(
  window: AstroScoreWindow | null | undefined,
  hour: string | null,
): boolean {
  if (!window || !isValidClockTime(window.start) || !isValidClockTime(window.end) || !isValidClockTime(hour)) {
    return false;
  }

  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  const target = toMinutes(hour);

  if (end >= start) return target >= start && target <= end;
  return target >= start || target <= end;
}

export function explainAstroScoreGap(input: {
  window?: AstroScoreWindow | null;
  today?: AstroScoreDaySummary | null;
  threshold?: number;
}): AstroScoreExplanation | null {
  const { window, today, threshold = 10 } = input;
  if (typeof today?.astroScore !== 'number' || typeof window?.peak !== 'number') return null;

  const astroScore = today.astroScore;
  const windowScore = window.peak;
  if (astroScore - windowScore < threshold) return null;

  const astroHour = isValidClockTime(today.bestAstroHour) ? today.bestAstroHour : null;
  const darkSkyStart = isValidClockTime(today.darkSkyStartsAt)
    ? today.darkSkyStartsAt
    : isValidClockTime(window.darkPhaseStart)
      ? window.darkPhaseStart
      : null;

  if (astroHour && !windowContainsHour(window, astroHour)) {
    if (darkSkyStart && toMinutes(astroHour) >= toMinutes(darkSkyStart)) {
      return {
        astroScore,
        windowScore,
        astroHour,
        reason: 'darker-later',
        text: `Peak astro sub-score reaches ${astroScore}/100 around ${astroHour}, after darker conditions begin at ${darkSkyStart}; the named window itself tops out at ${windowScore}/100.`,
      };
    }

    return {
      astroScore,
      windowScore,
      astroHour,
      reason: 'outside-window',
      text: `Peak astro sub-score reaches ${astroScore}/100 around ${astroHour}, outside the named window; the named window itself tops out at ${windowScore}/100.`,
    };
  }

  const timing = astroHour ? ` at ${astroHour}` : '';
  return {
    astroScore,
    windowScore,
    astroHour,
    reason: 'weighted-gap',
    text: `Peak astro sub-score is ${astroScore}/100${timing}, with the final window score at ${windowScore}/100 after full weighting.`,
  };
}
