import { isAuroraLikelyVisibleAtLat } from '../aurora-visibility.js';
import { LONG_RANGE_LOCATIONS } from '../../../lib/long-range-locations.js';
import { resolveHomeLatitude } from '../../../lib/home-location.js';
import type {
  BriefContext,
  WindowLike,
} from './types.js';
import {
  getValidationWindowContext,
  peakWindowHour,
} from './validation.js';

function isAstroWindow(window: WindowLike | undefined): boolean {
  if (!window) return false;
  return window.label?.toLowerCase().includes('astro') === true || (window.tops || []).includes('astrophotography');
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

function averageWindowCloud(window: WindowLike): number | null {
  const hours = (window.hours || []).filter(h => typeof h.ct === 'number');
  if (!hours.length) return null;
  return hours.reduce((sum, h) => sum + (h.ct as number), 0) / hours.length;
}

function averageWindowVisibility(window: WindowLike): number | null {
  const hours = (window.hours || []).filter(h => typeof h.visK === 'number');
  if (!hours.length) return null;
  return hours.reduce((sum, h) => sum + (h.visK as number), 0) / hours.length;
}

function fallbackCompositionBullets(ctx: BriefContext): string[] {
  const { referenceWindow: topWindow } = getValidationWindowContext(ctx);
  if (!topWindow) return [];

  const peakHour = topWindow.peakHour
    || peakWindowHour(topWindow)?.hour
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
      ideas.push('Keep one wide frame over the cleanest northern horizon and stay ready for shorter, faster exposures if aurora glow appears.');
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

  // Tag-based bullets (highest priority — the window already signals a specific opportunity)
  if (lowerTags.has('clear light path')) {
    ideas.push('Use a lone tree, church tower, or ridge break where the light path stays clean to the horizon.');
  }
  if (lowerTags.has('crepuscular rays')) {
    ideas.push('Watch for gaps in broken cloud and frame shafts of light across open ground, a valley gap, or a tree line.');
  }
  if (lowerTags.has('atmospheric') || lowerTags.has('misty / atmospheric') || lowerTags.has('mist')) {
    ideas.push('Look for layered trees, canal edges, or distant rooftops where haze can separate the scene into soft bands.');
  }

  // Weather-condition buckets — use scored hour data when tags don't cover it
  if (!ideas.length) {
    const avgCloud = averageWindowCloud(topWindow);
    const avgVis = averageWindowVisibility(topWindow);
    const isGolden = loweredLabel.includes('golden');

    if (avgCloud !== null && avgCloud < 30 && isGolden) {
      // Clear-sky golden hour
      ideas.push(`Find a clean horizon — lone tree, church spire, or ridge silhouette — and let the low sun do the work around ${peakHour}.`);
      ideas.push('Side-light picks out every texture; get close to walls, bark, or dry stone for warm, raking detail.');
    } else if (avgCloud !== null && avgCloud >= 70) {
      // Overcast / diffuse light
      ideas.push('Flat light suits intimate subjects — woodland, water reflections, stone textures, or close-up botanicals.');
      ideas.push(`Work sheltered spots where even light removes harsh shadows around ${peakHour}.`);
    } else if (avgVis !== null && avgVis < 5) {
      // Low visibility / atmospheric
      ideas.push('Use the low visibility for depth — layer trees, fences, or buildings receding into mist or haze.');
      ideas.push(`Look for isolated shapes that stand out from the murk around ${peakHour}.`);
    } else if (avgCloud !== null && avgCloud >= 30 && avgCloud < 70) {
      // Broken / mixed cloud
      ideas.push(`Broken cloud means shifting light — watch for spotlight moments on open ground or rooftops around ${peakHour}.`);
      ideas.push('Frame a strong foreground shape and wait for cloud gaps to backlight the scene.');
    } else {
      ideas.push(`Work a simple local skyline, bare tree, or roofline around ${peakHour} during the ${loweredLabel}.`);
    }
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
