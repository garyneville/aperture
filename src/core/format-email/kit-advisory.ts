import { esc } from '../utils.js';
import type { DebugKitAdvisoryRule } from '../debug-context.js';
import { C, FONT, card } from './shared.js';
import { clockToMinutes, isAstroWindow, windowRange } from './time-aware.js';
import type { CarWash, Window, WindowHour } from './types.js';

export interface KitTip {
  id: string;
  text: string;
  priority: number;
}

interface KitRuleParams {
  windKmh: number;
  rainPct: number;
  tempC: number | undefined;
  visibilityKm: number | undefined;
  tpwMm: number | undefined;
  astroScore: number;
  isAstroWin: boolean;
  moonPct: number;
  astroWindow: Window | undefined;
  astroWindowIsPrimary: boolean;
}

interface KitRule {
  id: string;
  predicate: (params: KitRuleParams) => boolean;
  priority: number;
}

const KIT_RULES: KitRule[] = [
  { id: 'high-wind', predicate: ({ windKmh }) => windKmh > 25, priority: 10 },
  { id: 'rain-risk', predicate: ({ rainPct }) => rainPct > 40, priority: 9 },
  { id: 'fog-mist', predicate: ({ visibilityKm }) => visibilityKm !== undefined && visibilityKm < 5, priority: 8 },
  { id: 'astro-window', predicate: ({ astroScore, isAstroWin, moonPct }) => isAstroWin && astroScore >= 60 && moonPct < 60, priority: 7 },
  { id: 'cold', predicate: ({ tempC }) => tempC !== undefined && tempC < 2, priority: 6 },
  { id: 'high-moisture', predicate: ({ tpwMm, tempC }) => tpwMm !== undefined && tpwMm > 30 && (tempC === undefined || tempC < 12), priority: 5 },
];

function peakWindowHour(window: Window | undefined): WindowHour | undefined {
  if (!window?.hours?.length) return undefined;
  return window.hours.find(hour => hour.score === window.peak) || window.hours[0];
}

function astroWindowSignal(window: Window | undefined): number {
  if (!window) return 0;
  const hourPeak = Math.max(...(window.hours?.map(hour => hour.score) || [0]));
  return Math.max(window.peak || 0, window.postMoonsetScore || 0, hourPeak);
}

function bestAstroWindow(windows: Window[]): Window | undefined {
  return windows
    .filter(window => isAstroWindow(window))
    .sort((a, b) => astroWindowSignal(b) - astroWindowSignal(a))[0];
}

function buildKitTipText(ruleId: string, params: KitRuleParams): string {
  switch (ruleId) {
    case 'high-wind':
      return 'High wind: ballast your tripod or avoid long exposures; shoot parallel to gusts.';
    case 'rain-risk':
      return 'Rain expected: verify weather sealing on body and lens; pack a microfibre cloth for the front element.';
    case 'fog-mist':
      return 'Low visibility: telephoto compression will look great; switch to manual focus and bracket exposures.';
    case 'astro-window': {
      const astroWindow = params.astroWindow;
      const windowLabel = astroWindow
        ? `${params.astroWindowIsPrimary ? 'Astro window' : 'Later astro window'} ${windowRange(astroWindow)}`
        : 'Astro window';
      const darkPhaseNote = astroWindow?.darkPhaseStart ? ` Darker after ${astroWindow.darkPhaseStart}.` : '';
      return `${windowLabel}: fastest wide-aperture lens; intervalometer for star trails; red torch to preserve night vision.${darkPhaseNote}`;
    }
    case 'cold':
      return 'Near-freezing: battery performance drops - carry spares in an inside pocket.';
    case 'high-moisture':
      return 'High dew risk: atmospheric moisture may cause lens fogging - let glass acclimatise before shooting.';
    default:
      return '';
  }
}

function buildKitRuleParams(
  todayCarWash: CarWash,
  windows: Window[],
  astroScore: number,
  moonPct: number,
  nowMinutes = 0,
): KitRuleParams {
  const upcomingWindows = (windows || []).filter(window => {
    const endMinutes = clockToMinutes(window.end);
    return endMinutes === null || endMinutes >= nowMinutes;
  });
  const topWindow = upcomingWindows[0];
  const topPeakHour = peakWindowHour(topWindow);
  const astroWindow = bestAstroWindow(upcomingWindows);
  const astroPeakHour = peakWindowHour(astroWindow);
  const resolvedAstroScore = Math.max(
    astroScore || 0,
    astroWindowSignal(astroWindow),
  );

  return {
    windKmh: todayCarWash.wind,
    rainPct: todayCarWash.pp,
    tempC: todayCarWash.tmp,
    visibilityKm: topPeakHour?.visK ?? astroPeakHour?.visK,
    tpwMm: topPeakHour?.tpw ?? astroPeakHour?.tpw,
    astroScore: resolvedAstroScore,
    isAstroWin: Boolean(astroWindow),
    moonPct,
    astroWindow,
    astroWindowIsPrimary: Boolean(astroWindow && astroWindow === topWindow),
  };
}

export function buildKitTips(
  todayCarWash: CarWash,
  windows: Window[],
  astroScore: number,
  moonPct: number,
  maxTips = 3,
  nowMinutes = 0,
): KitTip[] {
  const params = buildKitRuleParams(todayCarWash, windows, astroScore, moonPct, nowMinutes);

  return KIT_RULES
    .filter(rule => rule.predicate(params))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxTips)
    .map(rule => ({ id: rule.id, text: buildKitTipText(rule.id, params), priority: rule.priority }));
}

export function evaluateKitRules(
  todayCarWash: CarWash,
  windows: Window[],
  astroScore: number,
  moonPct: number,
  maxTips = 3,
  nowMinutes = 0,
): { trace: DebugKitAdvisoryRule[]; tipsShown: string[] } {
  const params = buildKitRuleParams(todayCarWash, windows, astroScore, moonPct, nowMinutes);

  const thresholdLabels: Record<string, string> = {
    'high-wind': 'wind > 25 km/h',
    'rain-risk': 'rain > 40%',
    'fog-mist': 'visibility < 5 km',
    'astro-window': 'score ≥ 60, isAstroWin, moonPct < 60%',
    cold: 'temp < 2°C',
    'high-moisture': 'TPW > 30mm + temp < 12°C',
  };

  const astroWindowLabel = params.astroWindow
    ? `${params.astroWindowIsPrimary ? 'primary' : 'later'} ${params.astroWindow.label} ${windowRange(params.astroWindow)}`
    : 'n/a';
  const optKm = params.visibilityKm !== undefined ? `${params.visibilityKm} km` : 'n/a';
  const optTemp = params.tempC !== undefined ? `${params.tempC}°C` : 'n/a';
  const optTpw = params.tpwMm !== undefined ? `${params.tpwMm}mm` : 'n/a';

  const valueLabels: Record<string, string> = {
    'high-wind': `${params.windKmh} km/h`,
    'rain-risk': `${params.rainPct}%`,
    'fog-mist': optKm,
    'astro-window': `score ${params.astroScore}/100, moonPct ${params.moonPct}%, astro ${params.isAstroWin ? 'Yes' : 'No'}, ${astroWindowLabel}`,
    cold: optTemp,
    'high-moisture': `${optTpw} (temp ${optTemp})`,
  };

  const matchedRules = KIT_RULES
    .filter(rule => rule.predicate(params))
    .sort((a, b) => b.priority - a.priority);
  const shownRules = matchedRules.slice(0, maxTips);
  const shownIds = new Set(shownRules.map(rule => rule.id));

  const trace: DebugKitAdvisoryRule[] = KIT_RULES.map(rule => ({
    id: rule.id,
    threshold: thresholdLabels[rule.id] ?? '—',
    value: valueLabels[rule.id] ?? '—',
    matched: rule.predicate(params),
    shown: shownIds.has(rule.id),
  }));

  return {
    trace,
    tipsShown: shownRules.map(rule => rule.id),
  };
}

export function kitAdvisoryCard(tips: KitTip[]): string {
  if (!tips.length) return '';
  const items = tips.map(tip =>
    `<div style="Margin-bottom:6px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">&#x2022; ${esc(tip.text)}</div>`
  ).join('');
  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Kit advisory</div>
    <div style="Margin-top:4px;">${items}</div>
  `, '', `border-left:3px solid ${C.tertiary};`);
}
