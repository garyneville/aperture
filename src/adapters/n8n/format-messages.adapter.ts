import { formatTelegram } from '../../core/format-telegram.js';
import {
  buildFallbackAiText as buildSharedFallbackAiText,
  isSingleSentenceCardRestatement,
  splitAiSentences,
} from '../../core/ai-briefing.js';
import { formatDebugEmail, formatEmail } from '../../core/format-email.js';
import type { SpurOfTheMomentSuggestion } from '../../core/format-email.js';
import {
  emptyDebugContext,
  type DebugAiCheck,
  type DebugContext,
  type WeekStandoutDecision,
  type WeekStandoutParseStatus,
} from '../../core/debug-context.js';
import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from '../../core/aurora-visibility.js';
import { LONG_RANGE_LOCATIONS, estimatedDriveMins } from '../../core/long-range-locations.js';
import { getPhotoBriefEditorialPrimaryProvider, getPhotoWeatherLat } from '../../config.js';
import type { N8nRuntime } from './types.js';

type BriefContext = {
  dontBother?: boolean;
  debugMode?: boolean;
  debugModeSource?: string;
  debugEmailTo?: string;
  debugContext?: DebugContext;
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
    deltaVsLeeds?: number;
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
    deltaVsLeeds?: number;
    shown?: boolean;
    discardedReason?: string;
  }>;
};

type WindowLike = {
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

export function normalizeAiText(text: string): string {
  const decimalFixed = text.replace(/(\d)\.\s+(\d)/g, '$1.$2');
  const cleaned = decimalFixed.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(No AI summary)';

  const sentences = splitAiSentences(cleaned);
  const shortened = sentences.slice(0, 2).join(' ').trim();

  const result = shortened.length > 280
    ? `${shortened.slice(0, 277).trimEnd()}...`
    : shortened;

  // Fix AI decimal-spacing artifacts like "20. 5km" → "20.5km" (#108).
  // Must run after sentence joining: the sentence splitter treats the "." in a
  // decimal as a sentence boundary and the subsequent join reintroduces a space,
  // so \s* catches both that reintroduced space and any spacing in the raw AI output.
  return result.replace(/(\d)\.\s*(\d)/g, '$1.$2');
}

export function getFactualCheck(aiText: string, ctx: BriefContext): DebugAiCheck {
  const topWindow = ctx.windows?.[0];
  const topAlt = ctx.altLocations?.[0];
  const peakHour = peakWindowHour(topWindow);
  const today = ctx.dailySummary?.[0];
  const SCORE_TOLERANCE = 5;
  const rulesTriggered: string[] = [];

  // Rule 1: reject if the first sentence mentions the alt location name.
  // A coherent editorial describes Leeds conditions first; the alt belongs in a follow-up sentence.
  if (topAlt?.name) {
    const sentenceEnd = aiText.search(/[.!?]/);
    const firstSentence = sentenceEnd >= 0 ? aiText.slice(0, sentenceEnd + 1) : aiText;
    if (firstSentence.toLowerCase().includes(topAlt.name.toLowerCase())) {
      rulesTriggered.push('alt name appears in first sentence');
    }
  }

  // Build the list of valid numeric values from source data.
  const validScores: number[] = [];
  if (typeof topWindow?.peak === 'number') validScores.push(topWindow.peak);
  if (typeof topAlt?.bestScore === 'number') validScores.push(topAlt.bestScore);
  if (typeof today?.astroScore === 'number') validScores.push(today.astroScore);
  topWindow?.hours?.forEach(h => { if (typeof h.score === 'number') validScores.push(h.score); });

  // Rule 2: reject if any quoted X/100 score is not within ±SCORE_TOLERANCE of any known source value.
  const quotedScores = [...aiText.matchAll(/\b(\d+)\/100\b/g)].map(m => parseInt(m[1], 10));
  if (quotedScores.length > 0 && validScores.length > 0) {
    const hasInvalidScore = quotedScores.some(
      score => !validScores.some(valid => Math.abs(score - valid) <= SCORE_TOLERANCE),
    );
    if (hasInvalidScore) rulesTriggered.push('quoted score not grounded in source values');
  }

  // Rule 3: reject if any "X points stronger" value doesn't match the real alt delta (±SCORE_TOLERANCE).
  const realDelta = (typeof topAlt?.bestScore === 'number' && typeof topWindow?.peak === 'number')
    ? topAlt.bestScore - topWindow.peak
    : null;
  if (realDelta !== null) {
    const quotedDeltas = [...aiText.matchAll(/\b(\d+)\s+points?\s+stronger\b/gi)].map(m => parseInt(m[1], 10));
    if (quotedDeltas.length > 0) {
      const hasInvalidDelta = quotedDeltas.some(delta => Math.abs(delta - realDelta) > SCORE_TOLERANCE);
      if (hasInvalidDelta) rulesTriggered.push('quoted alternative delta does not match source data');
    }
  }

  // Rule 4: reject if the editorial contains metric alt language — score deltas or point counts tied
  // to the alternative location. These are metric leaks regardless of factual accuracy. The editorial
  // must use prose recommendations only; all score detail belongs in the alternative card.
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
  const topWindow = ctx.windows?.[0];
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
  const mentionsWindow = [
    topWindow.label?.toLowerCase(),
    topWindow.start && topWindow.end ? `${topWindow.start}-${topWindow.end}`.toLowerCase() : '',
    topWindow.start && topWindow.end ? `${topWindow.start} to ${topWindow.end}`.toLowerCase() : '',
  ].filter((fragment): fragment is string => Boolean(fragment)).some(fragment => lower.includes(fragment));

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
  return buildSharedFallbackAiText(ctx);
}

export type SpurRaw = { locationName: string; hookLine: string; confidence: number };
type LongRangeSpurCandidate = { name?: string; shown?: boolean; discardedReason?: string };

function isAstroWindow(window: WindowLike | undefined): boolean {
  if (!window) return false;
  return window.label?.toLowerCase().includes('astro') === true || (window.tops || []).includes('astrophotography');
}

/** Strip Markdown code fences (```json ... ``` or ``` ... ```) that Groq occasionally wraps responses in. */
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
      const spur = parsed.spurOfTheMoment;
      if (
        spur &&
        typeof spur === 'object' &&
        typeof spur.locationName === 'string' &&
        typeof spur.hookLine === 'string' &&
        typeof spur.confidence === 'number'
      ) {
        spurRaw = { locationName: spur.locationName, hookLine: spur.hookLine, confidence: spur.confidence };
      }
      const weekStandoutRawValue = typeof parsed.weekStandout === 'string' ? parsed.weekStandout : null;
      const weekStandoutParseStatus: WeekStandoutParseStatus = weekStandoutRawValue !== null ? 'present' : 'absent';
      return {
        editorial: typeof parsed.editorial === 'string' ? parsed.editorial : rawContent,
        compositionBullets: Array.isArray(parsed.composition)
          ? parsed.composition.filter((s: unknown) => typeof s === 'string')
          : [],
        weekInsight: weekStandoutRawValue ?? '',
        spurRaw,
        weekStandoutParseStatus,
        weekStandoutRawValue,
      };
    }
  } catch {
    // Not JSON — treat as plain editorial text (backward compat)
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

export type EditorialProvider = 'groq' | 'gemini';

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
};

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

  return {
    primaryProvider: preferredProvider,
    selectedProvider: selectedCandidate?.provider ?? 'template',
    primaryCandidate,
    secondaryCandidate,
    selectedCandidate,
    fallbackUsed: selectedCandidate === null,
  };
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
  return isAuroraLikelyVisibleAtLat(getPhotoWeatherLat(), ctx.peakKpTonight);
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
  const topWindow = ctx.windows?.[0];
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
): SpurOfTheMomentSuggestion | null {
  if (!spurRaw || spurRaw.confidence < 0.7) return null;
  const loc = LONG_RANGE_LOCATIONS.find(l => l.name === spurRaw.locationName);
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

function normaliseLongRangeCandidate(c: Record<string, unknown>, rank: number) {
  return {
    name: typeof c.name === 'string' ? c.name : '(unknown)',
    region: typeof c.region === 'string' ? c.region : '—',
    tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
    bestScore: typeof c.bestScore === 'number' ? c.bestScore : 0,
    dayScore: typeof c.dayScore === 'number' ? c.dayScore : 0,
    astroScore: typeof c.astroScore === 'number' ? c.astroScore : 0,
    driveMins: typeof c.driveMins === 'number' ? c.driveMins : 0,
    darkSky: c.darkSky === true,
    rank,
    deltaVsLeeds: typeof c.deltaVsLeeds === 'number' ? c.deltaVsLeeds : 0,
    shown: c.shown === true,
    discardedReason: typeof c.discardedReason === 'string' ? c.discardedReason : undefined,
  };
}

type WeekSummaryDay = NonNullable<BriefContext['dailySummary']>[number];

type WeekStandoutResolution = {
  text: string;
  usedRaw: boolean;
  decision: WeekStandoutDecision;
  fallbackReason: string | null;
};

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
    today &&
    topDay &&
    topDay !== today &&
    displayScore(topDay) > displayScore(today) &&
    todaySpread !== null &&
    topSpread !== null &&
    topSpread - todaySpread >= 8,
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
    // Accept the AI output if it mentions "today" + "reliable" and names any
    // forecast day that scores ≥ today with meaningfully higher spread.
    // This avoids false rejections when multiple days tie on score but the AI
    // picks a different (equally valid) high-certainty-gap day than the sort winner.
    const today = forecastDays.find(d => d.dayIdx === 0) || forecastDays[0];
    const todayScore = displayScore(today);
    const todaySprd = spreadScore(today);
    const eligibleLabels = forecastDays
      .filter(d => d !== today
        && displayScore(d) >= todayScore
        && todaySprd !== null
        && spreadScore(d) !== null
        && (spreadScore(d) as number) - todaySprd >= 8)
      .map(d => (d.dayLabel || '').toLowerCase())
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

export function run({ $input }: N8nRuntime) {
  const input = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();
  const { choices, geminiResponse, geminiInspire, ...ctx } = input;
  const rawContent = choices?.[0]?.message?.content?.trim() || '';
  const geminiRawContent = typeof geminiResponse === 'string' ? geminiResponse.trim() : '';
  const longRangeDebugPool = Array.isArray(ctx.longRangeDebugCandidates)
    ? ctx.longRangeDebugCandidates
    : Array.isArray(ctx.longRangeCandidates)
      ? ctx.longRangeCandidates
      : [];
  const nearbyAltNames = [
    ...(ctx.altLocations || []).map((a: { name?: string }) => a?.name),
    ...((ctx.debugContext?.nearbyAlternatives || []).map((a: { name?: string }) => a?.name)),
  ].filter((n: string | undefined): n is string => Boolean(n));
  const editorialChoice = chooseEditorialCandidate(
    getPhotoBriefEditorialPrimaryProvider(),
    ctx,
    rawContent,
    geminiRawContent,
  );
  const activeCandidate = editorialChoice.selectedCandidate;
  const traceCandidate = activeCandidate || editorialChoice.primaryCandidate || editorialChoice.secondaryCandidate;
  const spurOfTheMoment = resolveSpurSuggestion(activeCandidate?.spurRaw || null, nearbyAltNames, longRangeDebugPool as LongRangeSpurCandidate[]);
  const aiText = activeCandidate
    ? activeCandidate.normalizedAiText
    : buildFallbackAiText(ctx);
  const resolvedWeekStandout = validateWeekInsight(activeCandidate?.weekInsight || '', ctx.dailySummary);
  const safeCompositionBullets = filterCompositionBullets(activeCandidate?.compositionBullets || [], ctx);

  const debugContext = ctx.debugContext || emptyDebugContext();
  const debugMode = ctx.debugMode === true;
  const debugEmailTo = typeof ctx.debugEmailTo === 'string' ? ctx.debugEmailTo : '';
  const debugModeSource = typeof ctx.debugModeSource === 'string' && ctx.debugModeSource.trim().length > 0
    ? ctx.debugModeSource
    : (debugMode ? 'workflow toggle' : 'workflow default');

  debugContext.metadata = {
    ...(debugContext.metadata || {}),
    generatedAt: debugContext.metadata?.generatedAt || new Date().toISOString(),
    location: debugContext.metadata?.location || 'Leeds',
    latitude: debugContext.metadata?.latitude ?? 0,
    longitude: debugContext.metadata?.longitude ?? 0,
    timezone: debugContext.metadata?.timezone || 'Europe/London',
    workflowVersion: debugContext.metadata?.workflowVersion || null,
    debugModeEnabled: debugMode,
    debugModeSource,
    debugRecipient: debugMode ? debugEmailTo : null,
  };

  /* Populate long-range candidate pool from context */
  if (Array.isArray(longRangeDebugPool)) {
    debugContext.longRangeCandidates = (longRangeDebugPool as Array<Record<string, unknown>>)
      .map((c, idx) => normaliseLongRangeCandidate(c, idx + 1));
  }

  debugContext.ai = {
    primaryProvider: editorialChoice.primaryProvider,
    selectedProvider: editorialChoice.selectedProvider,
    rawGroqResponse: rawContent,
    rawGeminiResponse: geminiRawContent || undefined,
    normalizedAiText: traceCandidate?.normalizedAiText || '',
    factualCheck: traceCandidate?.factualCheck || { passed: false, rulesTriggered: ['missing AI summary'] },
    editorialCheck: traceCandidate?.editorialCheck || { passed: false, rulesTriggered: ['missing AI summary'] },
    spurSuggestion: {
      raw: activeCandidate?.spurRaw ? `${activeCandidate.spurRaw.locationName} (${activeCandidate.spurRaw.confidence})` : null,
      confidence: activeCandidate?.spurRaw?.confidence ?? null,
      resolved: spurOfTheMoment?.locationName || null,
      dropped: Boolean(activeCandidate?.spurRaw) && !spurOfTheMoment,
      dropReason: resolveSpurDropReason(activeCandidate?.spurRaw || null, nearbyAltNames, longRangeDebugPool as LongRangeSpurCandidate[]),
    },
    weekStandout: {
      parseStatus: activeCandidate?.weekStandoutParseStatus || 'absent',
      rawValue: activeCandidate?.weekStandoutRawValue || null,
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
  };

  const safeGeminiInspire = typeof geminiInspire === 'string' && geminiInspire.trim().length > 0
    ? geminiInspire.trim()
    : undefined;

  const telegramMsg = formatTelegram({ ...ctx, aiText });
  const emailHtml = formatEmail({ ...ctx, aiText, compositionBullets: safeCompositionBullets, weekInsight: resolvedWeekStandout.text, spurOfTheMoment, geminiInspire: safeGeminiInspire, debugContext });
  const debugEmailHtml = debugMode ? formatDebugEmail(debugContext) : '';
  const debugEmailSubject = debugContext.metadata?.location
    ? `Photo Brief Debug - ${debugContext.metadata.location} - ${ctx.today || 'today'}`
    : `Photo Brief Debug - ${ctx.today || 'today'}`;

  return [{ json: {
    telegramMsg,
    emailHtml,
    debugMode,
    debugEmailTo,
    debugEmailHtml,
    debugEmailSubject,
  } }];
}
