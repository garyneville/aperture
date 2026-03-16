import { formatTelegram } from '../../core/format-telegram.js';
import { formatEmail } from '../../core/format-email.js';
import type { N8nRuntime } from './types.js';

type BriefContext = {
  dontBother?: boolean;
  windows?: WindowLike[];
  dailySummary?: Array<{
    bestPhotoHour?: string;
    astroScore?: number;
  }>;
  altLocations?: Array<{
    name?: string;
    bestScore?: number;
    bestAstroHour?: string | null;
    darkSky?: boolean;
    driveMins?: number;
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
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(No AI summary)';

  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(sentence => sentence.trim()) || [cleaned];
  const shortened = sentences.slice(0, 2).join(' ').trim();

  return shortened.length > 280
    ? `${shortened.slice(0, 277).trimEnd()}...`
    : shortened;
}

function peakHourForWindow(window: WindowLike | undefined): string | null {
  if (!window?.hours?.length) return null;
  const peakHour = window.hours.find(hour => hour.score === window.peak) || window.hours[window.hours.length - 1];
  return peakHour?.hour || null;
}

export function isFactuallyIncoherentEditorial(aiText: string, ctx: BriefContext): boolean {
  const topWindow = ctx.windows?.[0];
  const topAlt = ctx.altLocations?.[0];
  const SCORE_TOLERANCE = 5;

  // Rule 1: reject if the first sentence mentions the alt location name.
  // A coherent editorial describes Leeds conditions first; the alt belongs in a follow-up sentence.
  if (topAlt?.name) {
    const sentenceEnd = aiText.search(/[.!?]/);
    const firstSentence = sentenceEnd >= 0 ? aiText.slice(0, sentenceEnd + 1) : aiText;
    if (firstSentence.toLowerCase().includes(topAlt.name.toLowerCase())) {
      return true;
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
    if (hasInvalidScore) return true;
  }

  // Rule 3: reject if any "X points stronger" value doesn't match the real alt delta (±SCORE_TOLERANCE).
  const realDelta = (typeof topAlt?.bestScore === 'number' && typeof topWindow?.peak === 'number')
    ? topAlt.bestScore - topWindow.peak
    : null;
  if (realDelta !== null) {
    const quotedDeltas = [...aiText.matchAll(/\b(\d+)\s+points?\s+stronger\b/gi)].map(m => parseInt(m[1], 10));
    if (quotedDeltas.length > 0) {
      const hasInvalidDelta = quotedDeltas.some(delta => Math.abs(delta - realDelta) > SCORE_TOLERANCE);
      if (hasInvalidDelta) return true;
    }
  }

  return false;
}

export function shouldReplaceAiText(aiText: string, ctx: BriefContext): boolean {
  const topWindow = ctx.windows?.[0];
  if (!aiText || aiText === '(No AI summary)') return true;
  if (!topWindow) return false;

  // Factual coherence check takes priority: replace regardless of keyword heuristics.
  if (isFactuallyIncoherentEditorial(aiText, ctx)) return true;

  const lower = aiText.toLowerCase();
  const mentionsWindow = [
    topWindow.label?.toLowerCase(),
    topWindow.start && topWindow.end ? `${topWindow.start}-${topWindow.end}`.toLowerCase() : '',
    topWindow.start && topWindow.end ? `${topWindow.start} to ${topWindow.end}`.toLowerCase() : '',
  ].filter((fragment): fragment is string => Boolean(fragment)).some(fragment => lower.includes(fragment));

  const addsInsight = [
    'peak',
    'darker',
    'stronger',
    'later',
    'overall astro',
    'held back',
    'drive',
    'fallback',
    'not worth',
    'alternative',
  ].some(fragment => lower.includes(fragment));

  // For dontBother days the AI won't reference a window — just check for editorial value.
  if (ctx.dontBother) return !addsInsight;

  // For positive days: replace if AI doesn't mention the window at all, or mentions it
  // but adds no editorial insight beyond restating the card data.
  return !mentionsWindow || !addsInsight;
}

function windowRange(w: { start?: string; end?: string }): string {
  if (!w.start || !w.end) return '';
  return w.start === w.end ? w.start : `${w.start}-${w.end}`;
}

export function buildFallbackAiText(ctx: BriefContext): string {
  const topWindow = ctx.windows?.[0];
  const nextWindow = ctx.windows?.[1];
  const today = ctx.dailySummary?.[0];
  const topAlt = ctx.altLocations?.[0];

  if (ctx.dontBother) {
    if (topAlt && typeof topAlt.bestScore === 'number') {
      return `Conditions in Leeds are not worth shooting today.${topAlt.driveMins ? ` ${topAlt.name} is the best nearby option at ${topAlt.bestScore}/100 — ${topAlt.driveMins}-minute drive.` : ` ${topAlt.name} scores ${topAlt.bestScore}/100.`}`;
    }
    return 'Conditions in Leeds are not worth shooting today.';
  }

  if (!topWindow) return '(No AI summary)';

  const isSingleHour = topWindow.start === topWindow.end;
  const peakHour = peakHourForWindow(topWindow) || today?.bestPhotoHour || topWindow.end || topWindow.start || 'later';
  const range = windowRange(topWindow);
  const firstSentence = isSingleHour
    ? `Local peak is around ${peakHour} in the ${topWindow.label?.toLowerCase() || 'best window'}.`
    : `Local peak is around ${peakHour} in the ${topWindow.label?.toLowerCase() || 'best window'}${range ? ` from ${range}` : ''}.`;

  if (topAlt && typeof topAlt.bestScore === 'number' && typeof topWindow.peak === 'number' && topAlt.bestScore - topWindow.peak >= 10) {
    return `${firstSentence} ${topAlt.name} is ${topAlt.bestScore - topWindow.peak} points stronger${topAlt.darkSky ? ' thanks to darker skies' : ''}${topAlt.bestAstroHour ? ` around ${topAlt.bestAstroHour}` : ''}${topAlt.driveMins ? ` if you can make the ${topAlt.driveMins}-minute drive` : ''}.`;
  }

  if (typeof today?.astroScore === 'number' && typeof topWindow.peak === 'number' && today.astroScore - topWindow.peak >= 10) {
    return `${firstSentence} Overall astro potential is ${today.astroScore}/100, but the window score is held back by conditions outside the named window.`;
  }

  if (nextWindow?.label && nextWindow.start && nextWindow.end) {
    return `${firstSentence} If you miss it, ${nextWindow.label.toLowerCase()} is the later fallback from ${nextWindow.start}-${nextWindow.end}.`;
  }

  return firstSentence;
}

function parseGroqResponse(rawContent: string): {
  editorial: string;
  compositionBullets: string[];
  weekInsight: string;
} {
  try {
    const parsed = JSON.parse(rawContent);
    if (parsed && typeof parsed === 'object') {
      return {
        editorial: typeof parsed.editorial === 'string' ? parsed.editorial : rawContent,
        compositionBullets: Array.isArray(parsed.composition)
          ? parsed.composition.filter((s: unknown) => typeof s === 'string')
          : [],
        weekInsight: typeof parsed.weekStandout === 'string' ? parsed.weekStandout : '',
      };
    }
  } catch {
    // Not JSON — treat as plain editorial text (backward compat)
  }
  return { editorial: rawContent, compositionBullets: [], weekInsight: '' };
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
  const { editorial, compositionBullets, weekInsight } = parseGroqResponse(rawContent);
  const normalizedAiText = normalizeAiText(editorial);
  const aiText = shouldReplaceAiText(normalizedAiText, ctx)
    ? buildFallbackAiText(ctx)
    : normalizedAiText;

  const telegramMsg = formatTelegram({ ...ctx, aiText });
  const emailHtml = formatEmail({ ...ctx, aiText, compositionBullets, weekInsight });

  return [{ json: { telegramMsg, emailHtml } }];
}
