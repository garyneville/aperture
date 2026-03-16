import { formatTelegram } from '../../core/format-telegram.js';
import {
  buildFallbackAiText as buildSharedFallbackAiText,
  isSingleSentenceCardRestatement,
  splitAiSentences,
} from '../../core/ai-briefing.js';
import { formatDebugEmail, formatEmail } from '../../core/format-email.js';
import type { SpurOfTheMomentSuggestion } from '../../core/format-email.js';
import { emptyDebugContext, type DebugAiCheck, type DebugContext, type WeekStandoutParseStatus } from '../../core/debug-context.js';
import { LONG_RANGE_LOCATIONS, estimatedDriveMins } from '../../core/long-range-locations.js';
import type { N8nRuntime } from './types.js';

type BriefContext = {
  dontBother?: boolean;
  debugMode?: boolean;
  debugEmailTo?: string;
  debugContext?: DebugContext;
  windows?: WindowLike[];
  dailySummary?: Array<{
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
  }>;
};

type WindowLike = {
  label?: string;
  start?: string;
  end?: string;
  peak?: number;
  tops?: string[];
  hours?: Array<{ hour?: string; score?: number }>;
};

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
  const today = ctx.dailySummary?.[0];
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

  if (!aiText || aiText === '(No AI summary)') {
    rulesTriggered.push('missing AI summary');
    return { passed: false, rulesTriggered };
  }

  if (!topWindow) {
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
    'stronger',
    'later',
    'astro sub-score',
    'full weighting',
    'weighted',
    'near the end',
    'right at the start',
    'improving',
    'clearing',
    'thin',
    'moonset',
    'consider',
    'better',
    'dark sky',
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

export function resolveSpurSuggestion(
  spurRaw: SpurRaw | null,
  nearbyAltNames: string[] = [],
): SpurOfTheMomentSuggestion | null {
  if (!spurRaw || spurRaw.confidence < 0.7) return null;
  const loc = LONG_RANGE_LOCATIONS.find(l => l.name === spurRaw.locationName);
  if (!loc) return null;
  if (nearbyAltNames.includes(loc.name)) return null;
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

function resolveSpurDropReason(spurRaw: SpurRaw | null, nearbyAltNames: string[] = []): string | undefined {
  if (!spurRaw) return undefined;
  if (spurRaw.confidence < 0.7) return `confidence below threshold (${spurRaw.confidence})`;
  if (!LONG_RANGE_LOCATIONS.find(location => location.name === spurRaw.locationName)) {
    return 'location not found in approved long-range list';
  }
  if (nearbyAltNames.includes(spurRaw.locationName)) {
    return 'already shown in nearby alternatives';
  }
  return undefined;
}

export function run({ $input }: N8nRuntime) {
  const input = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();
  const { choices, ...ctx } = input;
  const rawContent = choices?.[0]?.message?.content?.trim() || '';
  const { editorial, compositionBullets, weekInsight, spurRaw, weekStandoutParseStatus, weekStandoutRawValue } = parseGroqResponse(rawContent);
  const nearbyAltNames = (ctx.altLocations || []).map((a: { name?: string }) => a?.name).filter((n: string | undefined): n is string => Boolean(n));
  const spurOfTheMoment = resolveSpurSuggestion(spurRaw, nearbyAltNames);
  const normalizedAiText = normalizeAiText(editorial);
  const factualCheck = getFactualCheck(normalizedAiText, ctx);
  const editorialCheck = getEditorialCheck(normalizedAiText, ctx);
  const fallbackUsed = !factualCheck.passed || !editorialCheck.passed;
  const aiText = fallbackUsed ? buildFallbackAiText(ctx) : normalizedAiText;

  const debugContext = ctx.debugContext || emptyDebugContext();
  const debugMode = ctx.debugMode === true;
  const debugEmailTo = typeof ctx.debugEmailTo === 'string' ? ctx.debugEmailTo : '';

  debugContext.metadata = {
    ...(debugContext.metadata || {}),
    generatedAt: debugContext.metadata?.generatedAt || new Date().toISOString(),
    location: debugContext.metadata?.location || 'Leeds',
    latitude: debugContext.metadata?.latitude ?? 0,
    longitude: debugContext.metadata?.longitude ?? 0,
    timezone: debugContext.metadata?.timezone || 'Europe/London',
    workflowVersion: debugContext.metadata?.workflowVersion || null,
    debugModeEnabled: debugMode,
    debugModeSource: debugMode ? 'workflow toggle' : 'workflow default',
    debugRecipient: debugMode ? debugEmailTo : null,
  };

  /* Populate long-range candidate pool from context */
  if (Array.isArray(ctx.longRangeCandidates)) {
    debugContext.longRangeCandidates = (ctx.longRangeCandidates as Array<Record<string, unknown>>)
      .map((c, idx) => ({
        name: typeof c?.name === 'string' ? c.name : '(unknown)',
        region: typeof c?.region === 'string' ? c.region : '—',
        tags: Array.isArray(c?.tags) ? (c.tags as string[]) : [],
        bestScore: typeof c?.bestScore === 'number' ? c.bestScore : 0,
        dayScore: typeof c?.dayScore === 'number' ? c.dayScore : 0,
        astroScore: typeof c?.astroScore === 'number' ? c.astroScore : 0,
        driveMins: typeof c?.driveMins === 'number' ? c.driveMins : 0,
        darkSky: c?.darkSky === true,
        rank: idx + 1,
      }));
  }

  debugContext.ai = {
    rawGroqResponse: rawContent,
    normalizedAiText,
    factualCheck,
    editorialCheck,
    spurSuggestion: {
      raw: spurRaw ? `${spurRaw.locationName} (${spurRaw.confidence})` : null,
      confidence: spurRaw?.confidence ?? null,
      resolved: spurOfTheMoment?.locationName || null,
      dropped: Boolean(spurRaw) && !spurOfTheMoment,
      dropReason: resolveSpurDropReason(spurRaw, nearbyAltNames),
    },
    weekStandout: {
      parseStatus: weekStandoutParseStatus,
      rawValue: weekStandoutRawValue,
      used: weekStandoutParseStatus === 'present' && weekStandoutRawValue !== null && weekStandoutRawValue.length > 0,
    },
    fallbackUsed,
    finalAiText: aiText,
  };

  const telegramMsg = formatTelegram({ ...ctx, aiText });
  const emailHtml = formatEmail({ ...ctx, aiText, compositionBullets, weekInsight, spurOfTheMoment, debugContext });
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
