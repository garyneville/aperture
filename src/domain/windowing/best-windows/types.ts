/**
 * Shared types for best-windows modules.
 */

import type { SessionId, SessionRecommendationSummary } from '../../../types/session-score.js';
import type { DebugContext } from '../../../lib/debug-context.js';
import type { AltLocation } from '../../../types/brief.js';

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
  darkPhaseStart?: string | null;
  postMoonsetScore?: number | null;
}

export type WindowSelectionSource = 'threshold' | 'fallback' | 'session-fallback';

export interface WindowCandidate extends Omit<Window, 'label'> {
  labelHint?: string;
  selectionSource: WindowSelectionSource;
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
  astroConfidence: string;
  astroConfidenceStdDev: number | null;
  goldAmMins: number;
  goldPmMins: number;
  amScore: number;
  pmScore: number;
  astroScore: number;
  bestAstroHour?: string | null;
  darkSkyStartsAt?: string | null;
  bestAmHour: string;
  bestPmHour: string;
  sunriseOcclusionRisk: number | null;
  sunsetOcclusionRisk: number | null;
  bestAlt?: AltLocation | null;
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
  sessionRecommendation?: SessionRecommendationSummary;
  debugContext?: DebugContext;
}

export interface BestWindowsOutput {
  windows: Window[];
  dontBother: boolean;
  todayBestScore: number;
  todayCarWash: CarWash;
  dailySummary: DailySummary[];
  metarNote: string;
  sessionRecommendation?: SessionRecommendationSummary;
  sunrise: string | undefined;
  sunset: string | undefined;
  moonPct: number;
  debugContext: DebugContext;
}

// Constants
export const PHOTO_THRESHOLD = 48;
export const STRONG_SESSION_FALLBACK_SCORE = 58;
export const SESSION_FALLBACK_MARGIN = 10;
