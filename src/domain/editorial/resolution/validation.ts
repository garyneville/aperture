import {
  isSingleSentenceCardRestatement,
  splitAiSentences,
} from '../ai-briefing.js';
import {
  buildWindowDisplayPlan,
  clockToMinutes,
  getRunTimeContext,
  windowRange,
} from '../../../domain/windowing/index.js';
import type { DebugAiCheck } from '../../../lib/debug-context.js';
import type {
  BriefContext,
  ValidationWindowContext,
  WindowHourLike,
  WindowLike,
} from './types.js';

export function peakWindowHour(window: WindowLike | undefined): WindowHourLike | null {
  const hours = window?.hours;
  if (!hours?.length) return null;
  if (window?.peakHour) {
    return hours.find(hour => hour.hour === window.peakHour) || hours[0] || null;
  }
  return hours.find(hour => hour.score === window?.peak) || hours[0] || null;
}

export function getValidationWindowContext(ctx: BriefContext): ValidationWindowContext {
  const originalPrimaryWindow = ctx.windows?.[0] || null;
  const generatedAt = ctx.debugContext?.metadata?.generatedAt;
  if (!originalPrimaryWindow || !generatedAt || !ctx.windows?.length) {
    return {
      originalPrimaryWindow,
      referenceWindow: originalPrimaryWindow,
      promotedFromPast: false,
    };
  }

  const displayPlan = buildWindowDisplayPlan(
    ctx.windows as Parameters<typeof buildWindowDisplayPlan>[0],
    getRunTimeContext(ctx.debugContext as Parameters<typeof getRunTimeContext>[0]).nowMinutes,
  );
  return {
    originalPrimaryWindow,
    referenceWindow: (displayPlan.promotedFromPast ? displayPlan.primary : originalPrimaryWindow) as WindowLike | null,
    promotedFromPast: displayPlan.promotedFromPast,
  };
}

function windowReferenceFragments(window: WindowLike | null | undefined): string[] {
  if (!window?.label || !window.start || !window.end) return [];
  return [
    window.label.toLowerCase(),
    windowRange(window as { start: string; end: string }).toLowerCase(),
    `${window.start} to ${window.end}`.toLowerCase(),
  ];
}

export function getFactualCheck(aiText: string, ctx: BriefContext): DebugAiCheck {
  const { referenceWindow: topWindow } = getValidationWindowContext(ctx);
  const topAlt = ctx.altLocations?.[0];
  const peakHour = peakWindowHour(topWindow || undefined);
  const today = ctx.dailySummary?.[0];
  const scoreTolerance = 5;
  const rulesTriggered: string[] = [];

  if (topAlt?.name) {
    const sentenceEnd = aiText.search(/[.!?]/);
    const firstSentence = sentenceEnd >= 0 ? aiText.slice(0, sentenceEnd + 1) : aiText;
    if (firstSentence.toLowerCase().includes(topAlt.name.toLowerCase())) {
      rulesTriggered.push('alt name appears in first sentence');
    }
  }

  const validScores: number[] = [];
  if (typeof topWindow?.peak === 'number') validScores.push(topWindow.peak);
  if (typeof topAlt?.bestScore === 'number') validScores.push(topAlt.bestScore);
  if (typeof today?.astroScore === 'number') validScores.push(today.astroScore);
  topWindow?.hours?.forEach(hour => {
    if (typeof hour.score === 'number') validScores.push(hour.score);
  });

  const quotedScores = [...aiText.matchAll(/\b(\d+)\/100\b/g)].map(match => parseInt(match[1], 10));
  if (quotedScores.length > 0 && validScores.length > 0) {
    const hasInvalidScore = quotedScores.some(
      score => !validScores.some(valid => Math.abs(score - valid) <= scoreTolerance),
    );
    if (hasInvalidScore) rulesTriggered.push('quoted score not grounded in source values');
  }

  const realDelta = (typeof topAlt?.bestScore === 'number' && typeof topWindow?.peak === 'number')
    ? topAlt.bestScore - topWindow.peak
    : null;
  if (realDelta !== null) {
    const quotedDeltas = [...aiText.matchAll(/\b(\d+)\s+points?\s+stronger\b/gi)].map(match => parseInt(match[1], 10));
    if (quotedDeltas.length > 0) {
      const hasInvalidDelta = quotedDeltas.some(delta => Math.abs(delta - realDelta) > scoreTolerance);
      if (hasInvalidDelta) rulesTriggered.push('quoted alternative delta does not match source data');
    }
  }

  if (topAlt?.name) {
    const altMetricPattern = /\b(\d+)\s+points?\b|\badds\s+\d+\s+points?\b/gi;
    const hasAltMetric = altMetricPattern.test(aiText) && aiText.toLowerCase().includes(topAlt.name.toLowerCase());
    if (hasAltMetric) {
      rulesTriggered.push('editorial contains metric alt language (score delta or point count) — use prose recommendation only');
    }
  }

  const lower = aiText.toLowerCase();
  const cloudPenaltyPattern = /\b(cloud(?:\s+cover)?|clouds?|haze)\b.*\b(weigh|weighs|hold|holds|held|limit|limits|limiting|reduce|reduces|reduced|keep|keeps|kept|drag|drags|dragged)\b|\b(weigh|weighs|hold|holds|held|limit|limits|limiting|reduce|reduces|reduced|keep|keeps|kept|drag|drags|dragged)\b.*\b(cloud(?:\s+cover)?|clouds?|haze)\b/;
  if (cloudPenaltyPattern.test(lower) && typeof peakHour?.ct === 'number' && peakHour.ct < 5) {
    rulesTriggered.push('editorial attributes the score gap to cloud or haze despite peak-hour cloud below 5%');
  }

  const moonsetPattern = /\bonce the moon is down\b|\bafter moonset\b|\bonce moonset\b/;
  const darkSkyStartMins = clockToMinutes(today?.darkSkyStartsAt ?? null);
  const windowStartMins = clockToMinutes(topWindow?.start ?? null);
  if (
    moonsetPattern.test(lower)
    && darkSkyStartMins !== null
    && (darkSkyStartMins === 0 || (windowStartMins !== null && darkSkyStartMins <= windowStartMins))
  ) {
    rulesTriggered.push('editorial implies moonset happens later even though dark-sky conditions already begin by the selected window start');
  }

  const explicitPeakTime = aiText.match(/\b(?:peak(?: local)? time is around|best(?: local)? time is around|tops? out around)\s+(\d{2}:\d{2})/i)?.[1] || null;
  const expectedPeakTime = peakHour?.hour || topWindow?.end || topWindow?.start || today?.bestPhotoHour || null;
  if (explicitPeakTime && expectedPeakTime && explicitPeakTime !== expectedPeakTime) {
    rulesTriggered.push('editorial peak time does not match the selected window peak hour');
  }

  return {
    passed: rulesTriggered.length === 0,
    rulesTriggered,
  };
}

export function isFactuallyIncoherentEditorial(aiText: string, ctx: BriefContext): boolean {
  return !getFactualCheck(aiText, ctx).passed;
}

export function getEditorialCheck(aiText: string, ctx: BriefContext): DebugAiCheck {
  const rulesTriggered: string[] = [];
  const { referenceWindow: topWindow } = getValidationWindowContext(ctx);
  const sentences = splitAiSentences(aiText);

  if (!aiText || aiText === '(No AI summary)') {
    rulesTriggered.push('missing AI summary');
    return { passed: false, rulesTriggered };
  }

  if (!topWindow) {
    if (!ctx.dontBother) {
      rulesTriggered.push('no chosen local window in context');
      return { passed: false, rulesTriggered };
    }
    return { passed: true, rulesTriggered };
  }

  const lower = aiText.toLowerCase();
  const mentionsWindow = windowReferenceFragments(topWindow)
    .some(fragment => lower.includes(fragment));

  const addsInsight = [
    'because',
    'expect',
    'likely',
    'should',
    'may',
    'darker',
    'darkest',
    'stronger',
    'later',
    'late',
    'astro sub-score',
    'full weighting',
    'weighted',
    'near the end',
    'right at the start',
    'improving',
    'clearing',
    'clearer',
    'thin',
    'moonset',
    'consider',
    'better',
    'dark sky',
    'aurora',
    'horizon',
    'northern',
    'overall astro',
    'held back',
    'drive',
    'fallback',
    'not worth',
    'alternative',
    'earlier today',
    'already passed',
    'remaining local option',
  ].some(fragment => lower.includes(fragment));

  if (isSingleSentenceCardRestatement(aiText, ctx)) {
    rulesTriggered.push('single sentence only restates the visible window card');
  }
  if (!ctx.dontBother && sentences.length < 2) {
    rulesTriggered.push('editorial must contain two sentences');
  }
  if (!ctx.dontBother && !mentionsWindow) {
    rulesTriggered.push('does not reference the chosen local window');
  }
  if (!addsInsight) {
    rulesTriggered.push('does not add editorial insight beyond card data');
  }

  return {
    passed: rulesTriggered.length === 0,
    rulesTriggered,
  };
}

export function shouldReplaceAiText(aiText: string, ctx: BriefContext): boolean {
  const factualCheck = getFactualCheck(aiText, ctx);
  if (!factualCheck.passed) return true;
  return !getEditorialCheck(aiText, ctx).passed;
}
