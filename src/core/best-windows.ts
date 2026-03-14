export interface ScoredHour {
  ts: string;
  t: string;
  hour: string;
  score: number;
  drama: number;
  clarity: number;
  mist: number;
  astro: number;
  crepuscular: number;
  shQ: number | null;
  cl: number;
  cm: number;
  ch: number;
  ct: number;
  visK: number;
  aod: number;
  tpw: number;
  wind: number;
  gusts: number;
  tmp: number;
  hum: number;
  dew: number;
  pp: number;
  pr: number;
  vpd: number;
  azimuthRisk: number | null;
  isGolden: boolean;
  isGoldAm: boolean;
  isGoldPm: boolean;
  isBlue: boolean;
  isBlueAm: boolean;
  isBluePm: boolean;
  isNight: boolean;
  moon: number;
  uv: number;
  tags: string[];
}

export interface Window {
  start: string;
  st: string;
  end: string;
  et: string;
  peak: number;
  tops: string[];
  hours: ScoredHour[];
  fallback: boolean;
  label: string;
}

export interface DailySummary {
  dateKey: string;
  dayLabel: string;
  dayIdx: number;
  hours: ScoredHour[];
  photoScore: number;
  headlineScore: number;
  photoEmoji: string;
  photoRating: string;
  bestPhotoHour: string;
  bestTags: string;
  carWash: CarWash;
  sunrise: string;
  sunset: string;
  shSunsetQuality: number | null;
  shSunriseQuality: number | null;
  shSunsetText: string | null;
  sunDirection: number | null;
  crepRayPeak: number;
  confidence: string;
  confidenceStdDev: number | null;
  durationBonus: number;
  amConfidence: string;
  amConfidenceStdDev: number | null;
  pmConfidence: string;
  pmConfidenceStdDev: number | null;
  goldAmMins: number;
  goldPmMins: number;
  amScore: number;
  pmScore: number;
  astroScore: number;
  bestAmHour: string;
  bestPmHour: string;
  sunriseOcclusionRisk: number | null;
  sunsetOcclusionRisk: number | null;
  bestAlt?: any;
}

export interface CarWash {
  score: number;
  rating: string;
  label: string;
  start: string;
  end: string;
  wind: number;
  pp: number;
  tmp: number;
}

export interface BestWindowsInput {
  todayHours: ScoredHour[];
  dailySummary: DailySummary[];
  metarNote: string;
}

export interface BestWindowsOutput {
  windows: Window[];
  dontBother: boolean;
  todayBestScore: number;
  todayCarWash: CarWash;
  dailySummary: DailySummary[];
  metarNote: string;
  sunrise: string | undefined;
  sunset: string | undefined;
  moonPct: number;
}

const PHOTO_THRESHOLD = 48;

export function groupWindows(hrs: ScoredHour[], threshold = 45): Omit<Window, 'label'>[] {
  const wins: Omit<Window, 'label'>[] = [];
  let cur: Omit<Window, 'label'> | null = null;

  for (const h of hrs) {
    if (h.score >= threshold) {
      if (!cur) {
        cur = {
          start: h.hour, st: h.t,
          end: h.hour, et: h.t,
          peak: h.score, tops: h.tags,
          hours: [h], fallback: false,
        };
      } else {
        cur.end = h.hour;
        cur.et = h.t;
        cur.hours.push(h);
        if (h.score > cur.peak) {
          cur.peak = h.score;
          cur.tops = h.tags;
        }
      }
    } else if (cur) {
      wins.push(cur);
      cur = null;
    }
  }
  if (cur) wins.push(cur);
  return wins.sort((a, b) => b.peak - a.peak).slice(0, 3);
}

function sameSession(a: ScoredHour | null, b: ScoredHour | null): boolean {
  if (!a || !b) return false;
  const isAm = (h: ScoredHour) => h.isGoldAm || h.isBlueAm;
  const isPm = (h: ScoredHour) => h.isGoldPm || h.isBluePm;
  if (a.isNight && b.isNight) return true;
  if (isAm(a) && isAm(b)) return true;
  if (isPm(a) && isPm(b)) return true;
  return false;
}

export function buildFallbackWindow(hrs: ScoredHour[]): Omit<Window, 'label'> | null {
  const candidates = hrs.filter(h =>
    (h.isGoldAm || h.isBlueAm || h.isGoldPm || h.isBluePm) &&
    typeof h.score === 'number'
  );
  if (!candidates.length) return null;

  const best = candidates.reduce((top, h) => h.score > top.score ? h : top, { score: -1 } as ScoredHour);
  if (best.score < 36) return null;

  const sessionHours = hrs.filter(h => sameSession(h, best));
  if (!sessionHours.length) return null;

  const threshold = Math.max(36, best.score - 6);
  let bestIdx = sessionHours.findIndex(h => h.t === best.t);
  if (bestIdx < 0) bestIdx = sessionHours.findIndex(h => h.hour === best.hour);
  if (bestIdx < 0) bestIdx = 0;

  let start = bestIdx;
  let end = bestIdx;
  while (start > 0 && sessionHours[start - 1].score >= threshold) start--;
  while (end < sessionHours.length - 1 && sessionHours[end + 1].score >= threshold) end++;

  const hours = sessionHours.slice(start, end + 1);
  const tops = (best.tags && best.tags.length)
    ? best.tags
    : hours.flatMap(h => h.tags || []).slice(0, 2);

  return {
    start: hours[0].hour, st: hours[0].t,
    end: hours[hours.length - 1].hour, et: hours[hours.length - 1].t,
    peak: best.score, tops, hours, fallback: true,
  };
}

function labelWindow(w: Omit<Window, 'label'>, sunrise?: string, sunset?: string): string {
  const sunrD = sunrise ? new Date(sunrise) : null;
  const sunsetD = sunset ? new Date(sunset) : null;
  const s = new Date(w.st);

  if (w.fallback) {
    if (w.hours.some(h => h.isGoldPm || h.isBluePm)) return 'Best chance around sunset';
    if (w.hours.some(h => h.isGoldAm || h.isBlueAm)) return 'Best chance around sunrise';
    if (w.hours.some(h => h.isNight && h.astro > 35)) return 'Best chance for astro';
  }

  if (w.hours.some(h => h.isNight && h.astro > 35) && !w.hours.some(h => h.isBlue)) return 'Astrophotography window';
  if (w.hours.some(h => h.isBlue && !h.isGolden)) return 'Blue hour';
  if (w.hours.some(h => h.isGolden) && sunrD && s < new Date(+sunrD + 4 * 3600000)) return 'Morning golden hour';
  if (w.hours.some(h => h.isGolden) && sunsetD && s > new Date(+sunsetD - 8 * 3600000)) return 'Evening golden hour';
  if (w.hours.some(h => h.isBlue)) return 'Blue hour';
  if (w.hours.some(h => h.mist > 40)) return 'Misty / atmospheric';
  return 'Good light window';
}

export function bestWindows(input: BestWindowsInput): BestWindowsOutput {
  const { todayHours, dailySummary, metarNote } = input;

  let windows = groupWindows(todayHours);
  if (!windows.length) {
    const fallback = buildFallbackWindow(todayHours);
    if (fallback) windows = [fallback];
  }

  const sunrise = dailySummary[0]?.sunrise;
  const sunset = dailySummary[0]?.sunset;

  const labelledWindows: Window[] = windows.map(w => ({
    ...w,
    label: labelWindow(w, sunrise, sunset),
  }));

  const todayHeadline = dailySummary[0]?.headlineScore ?? dailySummary[0]?.photoScore ?? 0;
  const todayBestScore = labelledWindows.length
    ? Math.max(labelledWindows[0].peak, todayHeadline)
    : todayHeadline;
  const dontBother = todayBestScore < PHOTO_THRESHOLD;

  const todayCarWash = dailySummary[0]?.carWash || {
    score: 0, rating: '\u274c', label: 'No good window',
    start: '\u2014', end: '\u2014', wind: 0, pp: 0, tmp: 0,
  };

  return {
    windows: labelledWindows,
    dontBother,
    todayBestScore,
    todayCarWash,
    dailySummary,
    metarNote,
    sunrise,
    sunset,
    moonPct: todayHours[0]?.moon ?? 0,
  };
}
