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

export function buildWeekStandoutFallback(days: WeekSummaryDay[] | undefined): string {
  const forecastDays = (days || []).slice(0, 5);
  if (!forecastDays.length) return '';

  const today = forecastDays.find(day => day.dayIdx === 0) || forecastDays[0];
  const rankedByScore = [...forecastDays].sort((a, b) => displayScore(b) - displayScore(a));
  const topDay = rankedByScore[0];
  const secondDay = rankedByScore[1];
  const todaySpread = spreadScore(today);
  const topSpread = spreadScore(topDay);

  const todayIsReliableLead = Boolean(
    today
    && topDay
    && topDay !== today
    && displayScore(topDay) > displayScore(today)
    && todaySpread !== null
    && topSpread !== null
    && topSpread - todaySpread >= 8,
  );

  if (todayIsReliableLead) {
    return `Today is the most reliable forecast; ${topDay.dayLabel || 'later in the week'} may score higher but with much lower certainty.`;
  }

  if (topDay && secondDay && displayScore(topDay) - displayScore(secondDay) >= 5) {
    return `${topDay.dayLabel || 'Today'} is the standout day.`;
  }

  return `${topDay?.dayLabel || 'Today'} is the best bet this week.`;
}

export function validateWeekInsight(rawValue: string | null, days: WeekSummaryDay[] | undefined): WeekStandoutResolution {
  const fallback = buildWeekStandoutFallback(days);
  const sanitizedRaw = rawValue ? sanitizeWeekInsight(rawValue) : '';

  if (!fallback) {
    return {
      text: sanitizedRaw,
      usedRaw: sanitizedRaw.length > 0,
      decision: sanitizedRaw.length > 0 ? 'raw-used' : 'omitted',
      fallbackReason: sanitizedRaw.length > 0 ? null : 'no forecast days available',
    };
  }

  if (!sanitizedRaw) {
    return {
      text: fallback,
      usedRaw: false,
      decision: 'fallback-used',
      fallbackReason: 'missing weekStandout value',
    };
  }

  if (countWords(sanitizedRaw) > 30) {
    return {
      text: fallback,
      usedRaw: false,
      decision: 'fallback-used',
      fallbackReason: 'weekStandout exceeded 30 words',
    };
  }

  const lowerRaw = sanitizedRaw.toLowerCase();
  const lowerFallback = fallback.toLowerCase();
  const forecastDays = (days || []).slice(0, 5);
  const topDay = [...forecastDays].sort((a, b) => displayScore(b) - displayScore(a))[0];

  if (lowerFallback.includes('today is the most reliable forecast')) {
    const today = forecastDays.find(day => day.dayIdx === 0) || forecastDays[0];
    const todayScore = displayScore(today);
    const todaySpread = spreadScore(today);
    const eligibleLabels = forecastDays
      .filter(day => day !== today
        && displayScore(day) >= todayScore
        && todaySpread !== null
        && spreadScore(day) !== null
        && (spreadScore(day) as number) - todaySpread >= 8)
      .map(day => (day.dayLabel || '').toLowerCase())
      .filter(Boolean);

    const mentionsEligibleDay = eligibleLabels.length === 0
      || eligibleLabels.some(label => lowerRaw.includes(label));
    const valid = lowerRaw.includes('today')
      && lowerRaw.includes('reliable')
      && mentionsEligibleDay;
    if (!valid) {
      return {
        text: fallback,
        usedRaw: false,
        decision: 'fallback-used',
        fallbackReason: 'weekStandout misidentified the reliable day',
      };
    }
  } else {
    const expectedLabel = (topDay?.dayLabel || 'Today').toLowerCase();
    const valid = lowerRaw.includes(expectedLabel)
      && (lowerRaw.includes('standout') || lowerRaw.includes('best'));
    if (!valid) {
      return {
        text: fallback,
        usedRaw: false,
        decision: 'fallback-used',
        fallbackReason: 'weekStandout did not name the expected standout day',
      };
    }
  }

  return {
    text: sanitizedRaw,
    usedRaw: true,
    decision: 'raw-used',
    fallbackReason: null,
  };
}
