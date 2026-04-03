export interface AstroScoreWindow {
  start?: string;
  end?: string;
  peak?: number;
  darkPhaseStart?: string | null;
  hours?: Array<{
    hour?: string;
    score?: number;
    astro?: number;
    ct?: number;
    visK?: number;
    aod?: number;
  }>;
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

function formatOneDecimal(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function joinReasons(reasons: string[]): string {
  if (reasons.length <= 1) return reasons[0] || '';
  if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`;
  return `${reasons.slice(0, -1).join(', ')}, and ${reasons[reasons.length - 1]}`;
}

function findRelevantHour(
  window: AstroScoreWindow | null | undefined,
  astroHour: string | null,
): NonNullable<AstroScoreWindow['hours']>[number] | null {
  const hours = window?.hours;
  if (!hours?.length) return null;

  if (astroHour) {
    const exact = hours.find(hour => hour.hour === astroHour);
    if (exact) return exact;
  }

  const byPeak = typeof window?.peak === 'number'
    ? hours.find(hour => hour.score === window.peak)
    : null;
  return byPeak || hours[0] || null;
}

function astroPenaltySummary(
  hour: NonNullable<AstroScoreWindow['hours']>[number] | null,
): { subject: string; plural: boolean } | null {
  if (!hour) return null;

  const reasons: string[] = [];
  if (typeof hour.ct === 'number' && hour.ct >= 5) {
    reasons.push('cloud cover');
  }
  if (typeof hour.visK === 'number' && hour.visK < 15) {
    reasons.push(`reduced visibility (${formatOneDecimal(hour.visK)}km)`);
  }
  if (typeof hour.aod === 'number' && hour.aod >= 0.12) {
    const descriptor = hour.aod >= 0.18 ? 'heavy' : hour.aod >= 0.15 ? 'moderate' : 'light';
    reasons.push(`${descriptor} aerosol loading (AOD ${hour.aod.toFixed(2)})`);
  }

  if (!reasons.length) return null;
  return {
    subject: joinReasons(reasons),
    plural: reasons.length > 1,
  };
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

  const timing = astroHour ? ` (${astroHour})` : '';
  const penalties = astroPenaltySummary(findRelevantHour(window, astroHour));
  return {
    astroScore,
    windowScore,
    astroHour,
    reason: 'weighted-gap',
    text: penalties
      ? `The window tops out at ${windowScore}/100 overall — ${penalties.subject} ${penalties.plural ? 'keep' : 'keeps'} it below the raw astro peak of ${astroScore}/100${timing}.`
      : `The window tops out at ${windowScore}/100 overall despite a raw astro peak of ${astroScore}/100${timing}.`,
  };
}
