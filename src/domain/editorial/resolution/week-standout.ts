import type {
  WeekStandoutResolution,
  WeekSummaryDay,
} from './types.js';

function displayScore(day: WeekSummaryDay | undefined): number {
  if (!day) return 0;
  if (typeof day.headlineScore === 'number') return day.headlineScore;
  if (typeof day.photoScore === 'number') return day.photoScore;
  return 0;
}

function spreadScore(day: WeekSummaryDay | undefined): number | null {
  if (!day || typeof day.confidenceStdDev !== 'number') return null;
  return day.confidenceStdDev;
}

function sanitizeWeekInsight(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildReliableLeadText(today: WeekSummaryDay, topDay: WeekSummaryDay): string {
  return `Today is the most reliable forecast; ${topDay.dayLabel || 'later in the week'} may score higher but with much lower certainty.`;
}

function buildStandoutText(topDay: WeekSummaryDay): string {
  return `${topDay.dayLabel || 'Today'} is the standout day.`;
}

function buildBestBetText(topDay: WeekSummaryDay | undefined): string {
  return `${topDay?.dayLabel || 'Today'} is the best bet this week.`;
}

function forecastDays(days: WeekSummaryDay[] | undefined): WeekSummaryDay[] {
  return (days || []).slice(0, 5);
}

function sortByScoreThenSpread(days: WeekSummaryDay[]): WeekSummaryDay[] {
  return [...days].sort((a, b) => {
    const scoreDelta = displayScore(b) - displayScore(a);
    if (scoreDelta !== 0) return scoreDelta;

    // Prefer lower spread (more reliable forecast) when scores tie
    const spreadA = spreadScore(a) ?? Number.POSITIVE_INFINITY;
    const spreadB = spreadScore(b) ?? Number.POSITIVE_INFINITY;
    const spreadDelta = spreadA - spreadB;
    if (spreadDelta !== 0) return spreadDelta;

    return (a.dayIdx ?? Number.MAX_SAFE_INTEGER) - (b.dayIdx ?? Number.MAX_SAFE_INTEGER);
  });
}

export function buildDeterministicWeekStandout(days: WeekSummaryDay[] | undefined): string {
  const rankedDays = forecastDays(days);
  if (!rankedDays.length) return '';

  const today = rankedDays.find(day => day.dayIdx === 0) || rankedDays[0];
  const rankedByScore = sortByScoreThenSpread(rankedDays);
  const topDay = rankedByScore[0];
  const secondDay = rankedByScore[1];
  const todaySpread = spreadScore(today);
  const reliableComparisonDay = sortByScoreThenSpread(
    rankedDays.filter(day => day !== today),
  ).find(day => {
    const daySpread = spreadScore(day);
    return displayScore(day) > displayScore(today)
      && todaySpread !== null
      && daySpread !== null
      && daySpread - todaySpread >= 8;
  }) ?? null;

  const todayIsReliableLead = Boolean(
    today
    && reliableComparisonDay,
  );

  if (todayIsReliableLead) {
    return buildReliableLeadText(today, reliableComparisonDay!);
  }

  if (topDay && secondDay && displayScore(topDay) - displayScore(secondDay) >= 5) {
    return buildStandoutText(topDay);
  }

  return buildBestBetText(topDay);
}

function evaluateReliableHint(rawHint: string, days: WeekSummaryDay[]): { aligned: boolean; note: string } {
  const today = days.find(day => day.dayIdx === 0) || days[0];
  const todayScore = displayScore(today);
  const todaySpread = spreadScore(today);
  const eligibleLabels = days
    .filter(day => day !== today
      && displayScore(day) >= todayScore
      && todaySpread !== null
      && spreadScore(day) !== null
      && (spreadScore(day) as number) - todaySpread >= 8)
    .map(day => (day.dayLabel || '').toLowerCase())
    .filter(Boolean);

  const lowerRaw = rawHint.toLowerCase();
  const mentionsEligibleDay = eligibleLabels.length === 0
    || eligibleLabels.some(label => lowerRaw.includes(label));
  const aligned = lowerRaw.includes('today')
    && lowerRaw.includes('reliable')
    && mentionsEligibleDay;

  return {
    aligned,
    note: aligned
      ? 'model hint matched the deterministic reliable-day result'
      : 'model hint did not identify today as the reliable lead with the expected higher-scoring comparison day',
  };
}

function evaluateStandoutHint(rawHint: string, days: WeekSummaryDay[]): { aligned: boolean; note: string } {
  const rankedByScore = sortByScoreThenSpread(days);
  const topDay = rankedByScore[0];
  const expectedLabel = (topDay?.dayLabel || 'Today').toLowerCase();
  const lowerRaw = rawHint.toLowerCase();
  const aligned = lowerRaw.includes(expectedLabel)
    && (lowerRaw.includes('standout') || lowerRaw.includes('best'));

  return {
    aligned,
    note: aligned
      ? 'model hint matched the deterministic standout day'
      : `model hint did not name ${topDay?.dayLabel || 'Today'} as the deterministic standout day`,
  };
}

function evaluateWeekStandoutHint(rawValue: string | null, days: WeekSummaryDay[] | undefined, deterministicText: string): { hintAligned: boolean | null; note: string | null } {
  const rankedDays = forecastDays(days);
  if (!rankedDays.length) {
    return {
      hintAligned: null,
      note: 'no forecast days available',
    };
  }

  const sanitizedRaw = rawValue ? sanitizeWeekInsight(rawValue) : '';
  if (!sanitizedRaw) {
    return {
      hintAligned: null,
      note: 'model did not provide a weekStandout hint',
    };
  }

  if (countWords(sanitizedRaw) > 30) {
    return {
      hintAligned: false,
      note: 'model hint exceeded 30 words',
    };
  }

  if (deterministicText.toLowerCase().includes('today is the most reliable forecast')) {
    const evaluation = evaluateReliableHint(sanitizedRaw, rankedDays);
    return {
      hintAligned: evaluation.aligned,
      note: evaluation.note,
    };
  }

  const evaluation = evaluateStandoutHint(sanitizedRaw, rankedDays);
  return {
    hintAligned: evaluation.aligned,
    note: evaluation.note,
  };
}

export function resolveWeekStandout(rawValue: string | null, days: WeekSummaryDay[] | undefined): WeekStandoutResolution {
  const deterministicText = buildDeterministicWeekStandout(days);

  if (!deterministicText) {
    return {
      text: '',
      used: false,
      decision: 'omitted',
      hintAligned: null,
      note: 'no forecast days available',
    };
  }

  const { hintAligned, note } = evaluateWeekStandoutHint(rawValue, days, deterministicText);

  return {
    text: deterministicText,
    used: true,
    decision: 'deterministic-used',
    hintAligned,
    note,
  };
}
