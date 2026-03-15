import { formatTelegram } from '../../core/format-telegram.js';
import { formatEmail } from '../../core/format-email.js';
import type { N8nRuntime } from './types.js';

type BriefContext = {
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

export function shouldReplaceAiText(aiText: string, ctx: BriefContext): boolean {
  const topWindow = ctx.windows?.[0];
  if (!aiText || aiText === '(No AI summary)') return true;
  if (!topWindow) return false;

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
  ].some(fragment => lower.includes(fragment));

  return mentionsWindow && !addsInsight;
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

export function run({ $input }: N8nRuntime) {
  const input = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();
  const { choices, ...ctx } = input;
  const normalizedAiText = normalizeAiText(choices?.[0]?.message?.content?.trim() || '');
  const aiText = shouldReplaceAiText(normalizedAiText, ctx)
    ? buildFallbackAiText(ctx)
    : normalizedAiText;

  const telegramMsg = formatTelegram({ ...ctx, aiText });
  const emailHtml = formatEmail({ ...ctx, aiText });

  return [{ json: { telegramMsg, emailHtml } }];
}
