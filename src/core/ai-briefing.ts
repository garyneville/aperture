import { explainAstroScoreGap } from './astro-score-explanation.js';
import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from './aurora-visibility.js';
import { resolveHomeLatitude, resolveHomeLocationName } from '../types/home-location.js';

export interface AiBriefingWindowHour {
  hour?: string;
  score?: number;
}

export interface AiBriefingWindow {
  label?: string;
  start?: string;
  end?: string;
  peak?: number;
  hours?: AiBriefingWindowHour[];
}

export interface AiBriefingDaySummary {
  bestPhotoHour?: string;
  astroScore?: number;
  bestAstroHour?: string | null;
  darkSkyStartsAt?: string | null;
}

export interface AiBriefingAltLocation {
  name?: string;
  bestScore?: number;
  bestAstroHour?: string | null;
  darkSky?: boolean;
  driveMins?: number;
}

export interface AiBriefingContext {
  dontBother?: boolean;
  windows?: AiBriefingWindow[];
  dailySummary?: AiBriefingDaySummary[];
  altLocations?: AiBriefingAltLocation[];
  peakKpTonight?: number | null;
  homeLatitude?: number | null;
  homeLocationName?: string | null;
}

export interface RenderAiBriefingResult {
  text: string;
  strippedOpener: boolean;
  usedFallback: boolean;
}

const VALUE_CUES = [
  ' because ',
  ' but ',
  ' however ',
  ' although ',
  ' despite ',
  ' while ',
  ' expect ',
  ' expected ',
  ' likely ',
  ' unlikely ',
  ' should ',
  ' may ',
  ' might ',
  ' once ',
  ' until ',
  ' before ',
  ' after ',
  ' brief ',
  ' only ',
  ' improving ',
  ' improve ',
  ' clearing ',
  ' clearer ',
  ' thinning ',
  ' thinner ',
  ' building ',
  ' fading ',
  ' stronger ',
  ' weaker ',
  ' darker ',
  ' brighter ',
  ' cleaner ',
  ' clearest ',
  ' cleanest ',
  ' held back ',
  ' fallback ',
  ' if you miss ',
];

export function splitAiSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (!'.!?'.includes(char)) continue;

    const prev = trimmed[index - 1];
    const next = trimmed[index + 1];
    if (char === '.' && /\d/.test(prev || '') && /\d/.test(next || '')) {
      continue;
    }

    let nextIndex = index + 1;
    while (nextIndex < trimmed.length && /\s/.test(trimmed[nextIndex])) {
      nextIndex += 1;
    }

    if (nextIndex >= trimmed.length || /[A-Z0-9"'(]/.test(trimmed[nextIndex])) {
      sentences.push(trimmed.slice(start, nextIndex).trim());
      start = nextIndex;
    }
  }

  if (start < trimmed.length) {
    sentences.push(trimmed.slice(start).trim());
  }

  return sentences.filter(Boolean);
}

function peakHourForWindow(window: AiBriefingWindow | undefined): string | null {
  if (!window?.hours?.length) return null;
  const peakHour = window.hours.find(hour => hour.score === window.peak) || window.hours[window.hours.length - 1];
  return peakHour?.hour || null;
}

function windowRange(window: AiBriefingWindow | undefined): string {
  if (!window?.start || !window?.end) return '';
  return window.start === window.end ? window.start : `${window.start}-${window.end}`;
}

function hasRedundantOpening(sentence: string, topWindow: AiBriefingWindow | undefined): boolean {
  if (!topWindow?.label || typeof topWindow.peak !== 'number') return false;
  const lower = sentence.toLowerCase();
  const labelLower = topWindow.label.toLowerCase();
  const scoreLower = `${topWindow.peak}/100`;
  const labelPos = lower.indexOf(labelLower);
  const scorePos = lower.indexOf(scoreLower);
  return labelPos >= 0 && scorePos > labelPos;
}

function sentenceAddsEditorialValue(sentence: string, topWindow: AiBriefingWindow | undefined): boolean {
  const lower = ` ${sentence.toLowerCase()} `;
  if (VALUE_CUES.some(cue => lower.includes(cue))) return true;

  const knownFragments = [
    topWindow?.label?.toLowerCase() || '',
    typeof topWindow?.peak === 'number' ? `${topWindow.peak}/100` : '',
    topWindow?.start?.toLowerCase() || '',
    topWindow?.end?.toLowerCase() || '',
    windowRange(topWindow).toLowerCase(),
    peakHourForWindow(topWindow)?.toLowerCase() || '',
  ].filter(Boolean);

  let stripped = lower;
  for (const fragment of knownFragments) {
    stripped = stripped.split(fragment).join(' ');
  }

  stripped = stripped
    .replace(/\b\d+(?:\.\d+)?(?:\/100|km\/h|km|%)\b/g, ' ')
    .replace(/\b(?:score|scores|scoring|window|local|best|peak|time|visibility|cloud|cover|rain|wind|conditions|condition|session|slot|forecast|with|and|the|a|an|at|from|around|in|for|today|tonight|near|good|great|offers|offer|gives|give|shows|show|high|low|patchy|work)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped.length > 0;
}

export function isSingleSentenceCardRestatement(aiText: string, ctx: AiBriefingContext): boolean {
  const topWindow = ctx.windows?.[0];
  if (!topWindow || !aiText) return false;
  const sentences = splitAiSentences(aiText);
  if (sentences.length !== 1) return false;
  if (!hasRedundantOpening(sentences[0], topWindow)) return false;
  return !sentenceAddsEditorialValue(sentences[0], topWindow);
}

function stripAltLocationSentences(text: string, altLocations: AiBriefingAltLocation[] | undefined): { text: string; stripped: boolean } {
  const altNames = (altLocations || []).map(a => a.name).filter((n): n is string => Boolean(n));
  if (!altNames.length) return { text, stripped: false };

  const patterns = altNames.map(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
  const sentences = splitAiSentences(text);
  const kept = sentences.filter(s => !patterns.some(re => re.test(s)));
  if (kept.length === sentences.length) return { text, stripped: false };

  return { text: kept.join(' ').trim(), stripped: true };
}

export function buildFallbackAiText(ctx: AiBriefingContext): string {
  const topWindow = ctx.windows?.[0];
  const nextWindow = ctx.windows?.[1];
  const today = ctx.dailySummary?.[0];
  const topAlt = ctx.altLocations?.[0];
  const lat = resolveHomeLatitude(ctx);
  const homeLocationName = resolveHomeLocationName({ location: { name: ctx.homeLocationName } });
  const auroraThreshold = auroraVisibleKpThresholdForLat(lat);
  const auroraVisibleLocally = isAuroraLikelyVisibleAtLat(lat, ctx.peakKpTonight);

  if (ctx.dontBother) {
    if (topAlt && typeof topAlt.bestScore === 'number') {
      return `${homeLocationName} looks poor for photography today.${topAlt.driveMins ? ` ${topAlt.name} is the strongest nearby option at ${topAlt.bestScore}/100 - ${topAlt.driveMins}-minute drive.` : ` ${topAlt.name} scores ${topAlt.bestScore}/100.`}`;
    }
    return `${homeLocationName} looks poor for photography today.`;
  }

  if (!topWindow) {
    if (topAlt?.name) {
      const altDrive = topAlt.driveMins ? ` — ${topAlt.driveMins}-minute drive` : '';
      const altConditions = topAlt.darkSky ? ' for better dark sky conditions' : ' for better overall conditions';
      return `No strong local photo window in ${homeLocationName} today. Consider ${topAlt.name}${altConditions}${altDrive}.`;
    }
    if (today?.darkSkyStartsAt) {
      return `No strong local photo window in ${homeLocationName} today. Skies get darker from ${today.darkSkyStartsAt}, but local conditions still stay marginal.`;
    }
    return `No strong local photo window in ${homeLocationName} today.`;
  }

  const isSingleHour = topWindow.start === topWindow.end;
  const peakHour = peakHourForWindow(topWindow) || today?.bestPhotoHour || topWindow.end || topWindow.start || 'later';
  const range = windowRange(topWindow);
  const labelLower = topWindow.label?.toLowerCase() || 'best window';
  const firstSentence = isSingleHour
    ? `Best conditions are around ${peakHour} in the ${labelLower}.`
    : `The ${labelLower} from ${range} is the strongest local slot today.`;

  if (auroraVisibleLocally && labelLower.includes('astro')) {
    return `${firstSentence} Aurora is possible through this slot (Kp ${ctx.peakKpTonight?.toFixed(1) ?? 'unknown'} clears the local threshold of Kp ${auroraThreshold}), so keep a clean northern horizon in play.`;
  }

  const astroGap = explainAstroScoreGap({ window: topWindow, today });
  if (astroGap) {
    return `${firstSentence} ${astroGap.text}`;
  }

  if (nextWindow?.label && nextWindow.start && nextWindow.end) {
    return `${firstSentence} If you miss it, ${nextWindow.label.toLowerCase()} is the later fallback from ${windowRange(nextWindow)}.`;
  }

  return firstSentence;
}

export function renderAiBriefingText(aiText: string, ctx: AiBriefingContext): RenderAiBriefingResult {
  const topWindow = ctx.windows?.[0];
  if (!aiText) {
    return {
      text: aiText,
      strippedOpener: false,
      usedFallback: false,
    };
  }

  if (!topWindow) {
    return {
      text: buildFallbackAiText(ctx),
      strippedOpener: false,
      usedFallback: true,
    };
  }

  const filtered = stripAltLocationSentences(aiText, ctx.altLocations);
  const workingText = filtered.text || buildFallbackAiText(ctx);
  const usedFallbackAfterFilter = !filtered.text;

  const sentences = splitAiSentences(workingText);
  if (!sentences.length || !hasRedundantOpening(sentences[0], topWindow)) {
    return {
      text: workingText,
      strippedOpener: false,
      usedFallback: usedFallbackAfterFilter,
    };
  }

  const remainder = sentences.slice(1).join(' ').trim();
  if (remainder) {
    return {
      text: remainder,
      strippedOpener: true,
      usedFallback: usedFallbackAfterFilter,
    };
  }

  if (sentenceAddsEditorialValue(sentences[0], topWindow)) {
    return {
      text: workingText,
      strippedOpener: false,
      usedFallback: usedFallbackAfterFilter,
    };
  }

  return {
    text: buildFallbackAiText(ctx),
    strippedOpener: false,
    usedFallback: true,
  };
}
