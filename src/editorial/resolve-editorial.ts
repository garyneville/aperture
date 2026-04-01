import {
  buildFallbackAiText as buildSharedFallbackAiText,
  isSingleSentenceCardRestatement,
  splitAiSentences,
} from '../core/ai-briefing.js';
import {
  buildWindowDisplayPlan,
  getRunTimeContext,
  timeAwareBriefingFallback,
  windowRange,
} from '../core/format-email/time-aware.js';
import type {
  DebugAiCheck,
  DebugAiTrace,
  DebugGeminiDiagnostics,
  WeekStandoutDecision,
  WeekStandoutParseStatus,
} from '../core/debug-context.js';
import { isAuroraLikelyVisibleAtLat } from '../core/aurora-visibility.js';
import { LONG_RANGE_LOCATIONS, estimatedDriveMins } from '../core/long-range-locations.js';
import type {
  EditorialDecision,
  EditorialProvider,
  SpurSuggestion,
} from '../core/standalone/contracts.js';
import { resolveHomeLatitude } from '../types/home-location.js';

export type BriefContext = {
  homeLatitude?: number | null;
  homeLocationName?: string | null;
  dontBother?: boolean;
  debugMode?: boolean;
  debugModeSource?: string;
  debugEmailTo?: string;
  debugContext?: {
    metadata?: {
      generatedAt?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
    };
    nearbyAlternatives?: Array<{ name?: string }>;
  };
  peakKpTonight?: number | null;
  auroraSignal?: {
    nearTerm?: {
      level?: string;
      isStale?: boolean;
    } | null;
  } | null;
  windows?: WindowLike[];
  dailySummary?: Array<{
    dayLabel?: string;
    dayIdx?: number;
    headlineScore?: number;
    photoScore?: number;
    confidence?: string;
    confidenceStdDev?: number | null;
    bestPhotoHour?: string;
    astroScore?: number;
    bestAstroHour?: string | null;
    darkSkyStartsAt?: string | null;
  }>;
  altLocations?: Array<{
    name?: string;
    bestScore?: number;
    bestAstroHour?: string | null;
    darkSky?: boolean;
    driveMins?: number;
  }>;
  longRangeCandidates?: Array<{
    name?: string;
    region?: string;
    tags?: string[];
    bestScore?: number;
    dayScore?: number;
    astroScore?: number;
    driveMins?: number;
    darkSky?: boolean;
    deltaVsHome?: number;
    shown?: boolean;
    discardedReason?: string;
  }>;
  longRangeDebugCandidates?: Array<{
    name?: string;
    region?: string;
    tags?: string[];
    bestScore?: number;
    dayScore?: number;
    astroScore?: number;
    driveMins?: number;
    darkSky?: boolean;
    deltaVsHome?: number;
    shown?: boolean;
    discardedReason?: string;
  }>;
};

export type WindowLike = {
  label?: string;
  start?: string;
  end?: string;
  peak?: number;
  tops?: string[];
  hours?: Array<{
    hour?: string;
    score?: number;
    ct?: number;
    visK?: number;
    aod?: number;
  }>;
};

type WindowHourLike = NonNullable<WindowLike['hours']>[number];

type ValidationWindowContext = {
  originalPrimaryWindow: WindowLike | null;
  referenceWindow: WindowLike | null;
  promotedFromPast: boolean;
};

export type SpurRaw = { locationName: string; hookLine: string; confidence: number };
export type LongRangeSpurCandidate = { name?: string; shown?: boolean; discardedReason?: string };

type EditorialCandidate = {
  provider: EditorialProvider;
  rawContent: string;
  editorial: string;
  compositionBullets: string[];
  weekInsight: string;
  spurRaw: SpurRaw | null;
  weekStandoutParseStatus: WeekStandoutParseStatus;
  weekStandoutRawValue: string | null;
  normalizedAiText: string;
  factualCheck: DebugAiCheck;
  editorialCheck: DebugAiCheck;
  passed: boolean;
  reusableComponents: boolean;
};

type WeekSummaryDay = NonNullable<BriefContext['dailySummary']>[number];

type WeekStandoutResolution = {
  text: string;
  usedRaw: boolean;
  decision: WeekStandoutDecision;
  fallbackReason: string | null;
};

export type ResolveEditorialInput = {
  preferredProvider: EditorialProvider;
  ctx: BriefContext;
  groqRawContent: string;
  geminiRawContent: string;
  geminiInspire?: string;
  geminiDiagnostics?: DebugGeminiDiagnostics;
  nearbyAltNames?: string[];
  longRangePool?: LongRangeSpurCandidate[];
};

export type ResolveEditorialOutput = {
  editorial: EditorialDecision;
  debugAiTrace: DebugAiTrace;
};

function clockToMinutes(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function peakWindowHour(window: WindowLike | undefined): WindowHourLike | null {
  const hours = window?.hours;
  if (!hours?.length) return null;
  return hours.find(hour => hour.score === window?.peak) || hours[0] || null;
}

function getValidationWindowContext(ctx: BriefContext): ValidationWindowContext {
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

export function normalizeAiText(text: string): string {
  const decimalFixed = text.replace(/(\d)\.\s+(\d)/g, '$1.$2');
  const cleaned = decimalFixed.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(No AI summary)';

  const sentences = splitAiSentences(cleaned);
  const shortened = sentences.slice(0, 2).join(' ').trim();

  const result = shortened.length > 280
    ? `${shortened.slice(0, 277).trimEnd()}...`
    : shortened;

  // Fix AI decimal-spacing artifacts like "20. 5km" -> "20.5km".
  return result.replace(/(\d)\.\s*(\d)/g, '$1.$2');
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

export function buildFallbackAiText(ctx: BriefContext): string {
  const generatedAt = ctx.debugContext?.metadata?.generatedAt;
  if (generatedAt && ctx.windows?.length) {
    const displayPlan = buildWindowDisplayPlan(
      ctx.windows as Parameters<typeof buildWindowDisplayPlan>[0],
      getRunTimeContext(ctx.debugContext as Parameters<typeof getRunTimeContext>[0]).nowMinutes,
    );
    const timeAwareFallback = timeAwareBriefingFallback(displayPlan);
    if (timeAwareFallback) return timeAwareFallback;
  }
  return buildSharedFallbackAiText(ctx);
}

function isAstroWindow(window: WindowLike | undefined): boolean {
  if (!window) return false;
  return window.label?.toLowerCase().includes('astro') === true || (window.tops || []).includes('astrophotography');
}

function stripMarkdownFences(content: string): string {
  return content.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/, '$1').trim();
}

export function parseGroqResponse(rawContent: string): {
  editorial: string;
  compositionBullets: string[];
  weekInsight: string;
  spurRaw: SpurRaw | null;
  weekStandoutParseStatus: WeekStandoutParseStatus;
  weekStandoutRawValue: string | null;
} {
  const stripped = stripMarkdownFences(rawContent);
  let parseFailure = false;
  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed === 'object') {
      let spurRaw: SpurRaw | null = null;
      const spur = (parsed as Record<string, unknown>).spurOfTheMoment;
      if (
        spur
        && typeof spur === 'object'
        && typeof (spur as Record<string, unknown>).locationName === 'string'
        && typeof (spur as Record<string, unknown>).hookLine === 'string'
        && typeof (spur as Record<string, unknown>).confidence === 'number'
      ) {
        spurRaw = {
          locationName: (spur as Record<string, unknown>).locationName as string,
          hookLine: (spur as Record<string, unknown>).hookLine as string,
          confidence: (spur as Record<string, unknown>).confidence as number,
        };
      }
      const weekStandoutRawValue = typeof (parsed as Record<string, unknown>).weekStandout === 'string'
        ? (parsed as Record<string, unknown>).weekStandout as string
        : null;
      const weekStandoutParseStatus: WeekStandoutParseStatus = weekStandoutRawValue !== null ? 'present' : 'absent';
      return {
        editorial: typeof (parsed as Record<string, unknown>).editorial === 'string'
          ? (parsed as Record<string, unknown>).editorial as string
          : rawContent,
        compositionBullets: Array.isArray((parsed as Record<string, unknown>).composition)
          ? ((parsed as Record<string, unknown>).composition as unknown[]).filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : [],
        weekInsight: weekStandoutRawValue ?? '',
        spurRaw,
        weekStandoutParseStatus,
        weekStandoutRawValue,
      };
    }
  } catch {
    parseFailure = true;
  }
  return {
    editorial: rawContent,
    compositionBullets: [],
    weekInsight: '',
    spurRaw: null,
    weekStandoutParseStatus: parseFailure ? 'parse-failure' : 'absent',
    weekStandoutRawValue: null,
  };
}

function buildEditorialCandidate(
  provider: EditorialProvider,
  rawContent: string,
  ctx: BriefContext,
): EditorialCandidate | null {
  if (!rawContent.trim()) return null;
  const parsed = parseGroqResponse(rawContent);
  const normalizedAiText = normalizeAiText(parsed.editorial);
  const factualCheck = getFactualCheck(normalizedAiText, ctx);
  const editorialCheck = getEditorialCheck(normalizedAiText, ctx);

  return {
    provider,
    rawContent,
    editorial: parsed.editorial,
    compositionBullets: parsed.compositionBullets,
    weekInsight: parsed.weekInsight,
    spurRaw: parsed.spurRaw,
    weekStandoutParseStatus: parsed.weekStandoutParseStatus,
    weekStandoutRawValue: parsed.weekStandoutRawValue,
    normalizedAiText,
    factualCheck,
    editorialCheck,
    passed: factualCheck.passed && editorialCheck.passed,
    reusableComponents: parsed.weekStandoutParseStatus !== 'parse-failure',
  };
}

export function chooseEditorialCandidate(
  preferredProvider: EditorialProvider,
  ctx: BriefContext,
  groqRawContent: string,
  geminiRawContent: string,
): {
  primaryProvider: EditorialProvider;
  selectedProvider: EditorialProvider | 'template';
  primaryCandidate: EditorialCandidate | null;
  secondaryCandidate: EditorialCandidate | null;
  selectedCandidate: EditorialCandidate | null;
  componentCandidate: EditorialCandidate | null;
  fallbackUsed: boolean;
} {
  const candidates: Record<EditorialProvider, EditorialCandidate | null> = {
    groq: buildEditorialCandidate('groq', groqRawContent, ctx),
    gemini: buildEditorialCandidate('gemini', geminiRawContent, ctx),
  };
  const secondaryProvider: EditorialProvider = preferredProvider === 'groq' ? 'gemini' : 'groq';
  const primaryCandidate = candidates[preferredProvider];
  const secondaryCandidate = candidates[secondaryProvider];

  const selectedCandidate = primaryCandidate?.passed
    ? primaryCandidate
    : secondaryCandidate?.passed
      ? secondaryCandidate
      : null;
  const componentCandidate = selectedCandidate
    || (primaryCandidate?.reusableComponents
      ? primaryCandidate
      : secondaryCandidate?.reusableComponents
        ? secondaryCandidate
        : null);

  return {
    primaryProvider: preferredProvider,
    selectedProvider: selectedCandidate?.provider ?? 'template',
    primaryCandidate,
    secondaryCandidate,
    selectedCandidate,
    componentCandidate,
    fallbackUsed: selectedCandidate === null,
  };
}

function summarizeCandidateRejection(
  provider: EditorialProvider,
  rawContent: string,
  candidate: EditorialCandidate | null,
  geminiDiagnostics?: DebugGeminiDiagnostics,
): string | null {
  const reasons: string[] = [];

  if (!rawContent.trim()) {
    if (provider === 'gemini' && geminiDiagnostics?.statusCode !== null && geminiDiagnostics?.statusCode !== undefined) {
      reasons.push(`HTTP ${geminiDiagnostics.statusCode} but empty response body`);
    } else {
      reasons.push('empty response body');
    }
  }

  if (provider === 'gemini' && geminiDiagnostics?.truncated) {
    reasons.push(`response truncated (${geminiDiagnostics.finishReason || 'incomplete Gemini response'})`);
  }

  if (candidate && !candidate.factualCheck.passed) {
    reasons.push(`factual validation failed: ${candidate.factualCheck.rulesTriggered.join(', ')}`);
  }

  if (candidate && !candidate.editorialCheck.passed) {
    reasons.push(`editorial validation failed: ${candidate.editorialCheck.rulesTriggered.join(', ')}`);
  }

  return reasons.length ? reasons.join('; ') : null;
}

function normaliseCompositionBullet(text: string): string {
  return text
    .replace(/^[\s\u2022*-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function remoteLocationNames(ctx: BriefContext): string[] {
  return [
    ...(ctx.altLocations || []).map(location => location?.name),
    ...LONG_RANGE_LOCATIONS.map(location => location.name),
  ].filter((name): name is string => Boolean(name));
}

function isRemoteCompositionBullet(bullet: string, ctx: BriefContext): boolean {
  const lower = bullet.toLowerCase();
  if (remoteLocationNames(ctx).some(name => lower.includes(name.toLowerCase()))) {
    return true;
  }
  return /\b(?:drive to|make the drive|road trip|detour|travel to|min drive|minute drive)\b/i.test(bullet);
}

function dedupeBullets(bullets: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const bullet of bullets) {
    const key = bullet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(bullet);
  }
  return result;
}

function isAuroraOpportunity(ctx: BriefContext): boolean {
  const nearTerm = ctx.auroraSignal?.nearTerm;
  if (nearTerm && !nearTerm.isStale && (nearTerm.level === 'amber' || nearTerm.level === 'red')) {
    return true;
  }
  return isAuroraLikelyVisibleAtLat(resolveHomeLatitude(ctx), ctx.peakKpTonight);
}

function compositionSpecificityScore(bullet: string, ctx: BriefContext): number {
  const lower = bullet.toLowerCase();
  let score = 0;

  if (/\b(?:ridge|edge|horizon|skyline|tree|tower|church|roofline|water|reflection|canal|bridge|foreground|silhouette|valley|moor|north|northern|mist|rays|cloud gap)\b/i.test(bullet)) {
    score += 2;
  }
  if (/\b(?:frame|use|keep|face|watch|leave|set)\b/i.test(bullet)) {
    score += 1;
  }
  if (isAuroraOpportunity(ctx) && /\b(?:aurora|north|northern|horizon|curtain|glow)\b/i.test(bullet)) {
    score += 3;
  }
  if (/\b(?:silhouetted landmark foreground|wide-field constellation framing|simple local silhouette|work a simple local landscape composition)\b/i.test(lower)) {
    score -= 3;
  }
  if (lower.split(/\s+/).length < 6) {
    score -= 1;
  }

  return score;
}

function fallbackCompositionBullets(ctx: BriefContext): string[] {
  const { referenceWindow: topWindow } = getValidationWindowContext(ctx);
  if (!topWindow) return [];

  const peakHour = topWindow.hours?.find(hour => hour.score === topWindow.peak)?.hour
    || topWindow.hours?.[topWindow.hours.length - 1]?.hour
    || topWindow.end
    || topWindow.start
    || 'the peak';
  const loweredLabel = topWindow.label?.toLowerCase() || 'best window';
  const lowerTags = new Set((topWindow.tops || []).map(tag => tag.toLowerCase()));
  const ideas: string[] = [];

  if (isAstroWindow(topWindow)) {
    const darkPhaseStart = ctx.dailySummary?.[0]?.darkSkyStartsAt;
    if (isAuroraOpportunity(ctx)) {
      ideas.push(`Face north with a low ridge, tree line, or rooftop silhouette and leave space for any aurora structure around ${peakHour}.`);
      ideas.push(`Keep one wide frame over the cleanest northern horizon and stay ready for shorter, faster exposures if aurora glow appears.`);
      return dedupeBullets(ideas).slice(0, 2);
    }
    ideas.push(`Set a dark ridge, rooftop, or lone tree low in the frame so the cleanest sky stays dominant around ${peakHour}.`);
    ideas.push(
      darkPhaseStart
        ? `Save your cleanest skyline frame for after ${darkPhaseStart} once the sky turns fully dark.`
        : `Work a simple skyline, tree line, or rooftop silhouette while the ${loweredLabel} is at its cleanest.`,
    );
    return dedupeBullets(ideas).slice(0, 2);
  }

  if (lowerTags.has('clear light path')) {
    ideas.push('Use a lone tree, church tower, or ridge break where the light path stays clean to the horizon.');
  }
  if (lowerTags.has('crepuscular rays')) {
    ideas.push('Watch for gaps in broken cloud and frame shafts of light across open ground, a valley gap, or a tree line.');
  }
  if (lowerTags.has('atmospheric') || lowerTags.has('misty / atmospheric') || lowerTags.has('mist')) {
    ideas.push('Look for layered trees, canal edges, or distant rooftops where haze can separate the scene into soft bands.');
  }
  if (!ideas.length) {
    ideas.push(`Work a simple local skyline, bare tree, or roofline around ${peakHour} during the ${loweredLabel}.`);
  }
  ideas.push(`Keep a tighter second frame on one clear foreground shape while the ${loweredLabel} holds its cleanest light.`);
  return dedupeBullets(ideas).slice(0, 2);
}

export function filterCompositionBullets(rawBullets: string[], ctx: BriefContext): string[] {
  const cleaned = rawBullets
    .map(normaliseCompositionBullet)
    .filter(Boolean)
    .filter(bullet => !isRemoteCompositionBullet(bullet, ctx));

  const fallback = fallbackCompositionBullets(ctx);
  const deduped = dedupeBullets(cleaned);
  const rankedRaw = deduped
    .map((bullet, index) => ({ bullet, index, score: compositionSpecificityScore(bullet, ctx) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const strongRaw = rankedRaw.filter(entry => entry.score > 0).map(entry => entry.bullet);
  const weakRaw = rankedRaw.filter(entry => entry.score <= 0).map(entry => entry.bullet);

  if (strongRaw.length >= 2) {
    return strongRaw.slice(0, 2);
  }

  return dedupeBullets([...strongRaw, ...fallback, ...weakRaw]).slice(0, 2);
}

export function resolveSpurSuggestion(
  spurRaw: SpurRaw | null,
  nearbyAltNames: string[] = [],
  longRangePool: LongRangeSpurCandidate[] = [],
): SpurSuggestion | null {
  if (!spurRaw || spurRaw.confidence < 0.7) return null;
  const loc = LONG_RANGE_LOCATIONS.find(location => location.name === spurRaw.locationName);
  if (!loc) return null;
  if (nearbyAltNames.includes(loc.name)) return null;
  const longRangeCandidate = longRangePool.find(candidate => candidate?.name === loc.name);
  if (longRangeCandidate?.shown === true) return null;
  if (typeof longRangeCandidate?.discardedReason === 'string' && longRangeCandidate.discardedReason.trim().length > 0) {
    return null;
  }
  return {
    locationName: loc.name,
    region: loc.region,
    driveMins: estimatedDriveMins(loc),
    tags: loc.tags,
    darkSky: loc.darkSky,
    hookLine: spurRaw.hookLine,
    confidence: spurRaw.confidence,
  };
}

function resolveSpurDropReason(
  spurRaw: SpurRaw | null,
  nearbyAltNames: string[] = [],
  longRangePool: LongRangeSpurCandidate[] = [],
): string | undefined {
  if (!spurRaw) return undefined;
  if (spurRaw.confidence < 0.7) return `confidence below threshold (${spurRaw.confidence})`;
  if (nearbyAltNames.includes(spurRaw.locationName)) {
    return 'already scored in nearby alternatives';
  }
  const longRangeCandidate = longRangePool.find(candidate => candidate?.name === spurRaw.locationName);
  if (longRangeCandidate?.shown === true) {
    return 'already shown in long-range recommendations';
  }
  if (typeof longRangeCandidate?.discardedReason === 'string' && longRangeCandidate.discardedReason.trim().length > 0) {
    return `long-range candidate rejected: ${longRangeCandidate.discardedReason}`;
  }
  if (!LONG_RANGE_LOCATIONS.find(location => location.name === spurRaw.locationName)) {
    return 'location not found in approved long-range list';
  }
  return undefined;
}

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

function buildWeekStandoutFallback(days: WeekSummaryDay[] | undefined): string {
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

function validateWeekInsight(rawValue: string | null, days: WeekSummaryDay[] | undefined): WeekStandoutResolution {
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

export function resolveEditorial(input: ResolveEditorialInput): ResolveEditorialOutput {
  const {
    preferredProvider,
    ctx,
    groqRawContent,
    geminiRawContent,
    geminiInspire,
    geminiDiagnostics,
    nearbyAltNames = [],
    longRangePool = [],
  } = input;
  const editorialChoice = chooseEditorialCandidate(
    preferredProvider,
    ctx,
    groqRawContent,
    geminiRawContent,
  );
  const secondaryProvider: EditorialProvider = preferredProvider === 'groq' ? 'gemini' : 'groq';
  const editorialCandidate = editorialChoice.selectedCandidate;
  const componentCandidate = editorialChoice.componentCandidate;
  const traceCandidate = editorialCandidate
    || componentCandidate
    || editorialChoice.primaryCandidate
    || editorialChoice.secondaryCandidate;
  const bestSpurRaw = componentCandidate?.spurRaw
    || editorialChoice.primaryCandidate?.spurRaw
    || editorialChoice.secondaryCandidate?.spurRaw
    || null;
  const spurOfTheMoment = resolveSpurSuggestion(
    bestSpurRaw,
    nearbyAltNames,
    longRangePool,
  );
  const aiText = editorialCandidate
    ? editorialCandidate.normalizedAiText
    : buildFallbackAiText(ctx);
  const bestWeekInsight = (componentCandidate?.weekInsight || '')
    || editorialChoice.primaryCandidate?.weekInsight
    || editorialChoice.secondaryCandidate?.weekInsight
    || '';
  const resolvedWeekStandout = validateWeekInsight(bestWeekInsight, ctx.dailySummary);
  const safeCompositionBullets = filterCompositionBullets(
    (componentCandidate?.compositionBullets?.length ? componentCandidate.compositionBullets : null)
      || editorialChoice.primaryCandidate?.compositionBullets
      || editorialChoice.secondaryCandidate?.compositionBullets
      || [],
    ctx,
  );
  const safeGeminiInspire = typeof geminiInspire === 'string' && geminiInspire.trim().length > 0
    ? geminiInspire.trim()
    : undefined;
  const primaryRawContent = preferredProvider === 'gemini' ? geminiRawContent : groqRawContent;
  const secondaryRawContent = secondaryProvider === 'gemini' ? geminiRawContent : groqRawContent;
  const primaryRejectionReason = editorialChoice.selectedProvider === preferredProvider
    ? null
    : summarizeCandidateRejection(
        preferredProvider,
        primaryRawContent,
        editorialChoice.primaryCandidate,
        preferredProvider === 'gemini' ? geminiDiagnostics : undefined,
      );
  const secondaryRejectionReason = editorialChoice.selectedProvider === secondaryProvider
    ? null
    : editorialChoice.selectedProvider === 'template'
      ? summarizeCandidateRejection(
          secondaryProvider,
          secondaryRawContent,
          editorialChoice.secondaryCandidate,
          secondaryProvider === 'gemini' ? geminiDiagnostics : undefined,
        )
      : null;

  return {
    editorial: {
      primaryProvider: editorialChoice.primaryProvider,
      selectedProvider: editorialChoice.selectedProvider,
      fallbackUsed: editorialChoice.fallbackUsed,
      aiText,
      compositionBullets: safeCompositionBullets,
      weekInsight: resolvedWeekStandout.text,
      spurOfTheMoment,
      geminiInspire: safeGeminiInspire,
      rawGroqResponse: groqRawContent || undefined,
      rawGeminiResponse: geminiRawContent || undefined,
    },
    debugAiTrace: {
      primaryProvider: editorialChoice.primaryProvider,
      selectedProvider: editorialChoice.selectedProvider,
      primaryRejectionReason,
      secondaryRejectionReason,
      rawGroqResponse: groqRawContent,
      rawGeminiResponse: geminiRawContent || undefined,
      geminiDiagnostics,
      normalizedAiText: traceCandidate?.normalizedAiText || '',
      factualCheck: traceCandidate?.factualCheck || { passed: false, rulesTriggered: ['missing AI summary'] },
      editorialCheck: traceCandidate?.editorialCheck || { passed: false, rulesTriggered: ['missing AI summary'] },
      spurSuggestion: {
        raw: bestSpurRaw ? `${bestSpurRaw.locationName} (${bestSpurRaw.confidence})` : null,
        confidence: bestSpurRaw?.confidence ?? null,
        resolved: spurOfTheMoment?.locationName || null,
        dropped: Boolean(bestSpurRaw) && !spurOfTheMoment,
        dropReason: resolveSpurDropReason(bestSpurRaw, nearbyAltNames, longRangePool),
      },
      weekStandout: {
        parseStatus: componentCandidate?.weekStandoutParseStatus || 'absent',
        rawValue: componentCandidate?.weekStandoutRawValue || null,
        used: resolvedWeekStandout.usedRaw,
        decision: resolvedWeekStandout.decision,
        finalValue: resolvedWeekStandout.text || null,
        fallbackReason: resolvedWeekStandout.fallbackReason,
      },
      fallbackUsed: editorialChoice.fallbackUsed,
      modelFallbackUsed: !editorialChoice.fallbackUsed
        && editorialChoice.selectedProvider !== editorialChoice.primaryProvider
        && editorialChoice.selectedProvider !== 'template',
      finalAiText: aiText,
    },
  };
}
