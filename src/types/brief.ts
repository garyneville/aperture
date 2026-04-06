import type { DebugContext } from '../lib/debug-context.js';
import type { AuroraSignal } from '../lib/aurora-providers.js';
import type { SessionRecommendationSummary } from './session-score.js';

export const BRIEF_JSON_SCHEMA_VERSION = 'aperture-brief/v1' as const;

export interface WindowHour {
  hour?: string;
  score: number;
  ch?: number;
  visK?: number;
  wind?: string | number;
  pp?: number;
  crepuscular?: number;
  tpw?: number;
  tmp?: number;
}

export interface Window {
  label: string;
  start: string;
  end: string;
  peak: number;
  /** The clock time (HH:MM) of the highest-scoring hour within this window.
   * Populated by the scoring pipeline. Prefer this over inferring from hours[].score,
   * since WindowHour.score is the daily final score while peak is the session score. */
  peakHour?: string | null;
  darkPhaseStart?: string | null;
  postMoonsetScore?: number | null;
  fallback?: boolean;
  hours?: WindowHour[];
  tops?: string[];
}

export interface AltLocation {
  name: string;
  driveMins: number;
  bestScore: number;
  bestDayHour?: string | null;
  bestAstroHour?: string | null;
  types?: string[];
  isAstroWin?: boolean;
  darkSky?: boolean;
  amScore?: number;
  pmScore?: number;
  dayScore?: number;
  astroScore?: number;
  elevationM?: number;
  isUpland?: boolean;
  snowDepthCm?: number | null;
  snowfallCm?: number | null;
  siteDarkness?: {
    bortle: number;
  };
}

export interface CarWash {
  rating: string;
  label: string;
  score: number;
  start: string;
  end: string;
  wind: number;
  pp: number;
  tmp?: number;
}

export interface NextDayHour {
  hour: string;
  tmp: number;
  pp: number;
  wind: number;
  gusts: number;
  visK: number;
  pr: number;
  ct: number;
  isNight: boolean;
  moon?: number;
  nowcastSignal?: import('../domain/scoring/contracts.js').NowcastSignal | null;
}

export interface RunTimeContext {
  nowMinutes: number;
  nowLabel: string;
  timezone: string;
}

export interface WindowDisplayPlan {
  primary: Window | null;
  remaining: Window[];
  past: Window[];
  promotedFromPast: boolean;
  allPast: boolean;
}

export interface DaySummary {
  dayLabel: string;
  dateKey: string;
  dayIdx: number;
  photoScore: number;
  headlineScore?: number;
  photoEmoji: string;
  amScore?: number;
  pmScore?: number;
  astroScore?: number;
  bestAstroHour?: string | null;
  darkSkyStartsAt?: string | null;
  confidence?: string;
  confidenceStdDev?: number | null;
  astroConfidence?: string;
  astroConfidenceStdDev?: number | null;
  amConfidence?: string;
  pmConfidence?: string;
  bestPhotoHour?: string;
  bestTags?: string;
  bestAlt?: AltLocation | null;
  carWash: CarWash;
  hours?: NextDayHour[];
}

export interface LongRangeCard {
  name: string;
  region: string;
  driveMins: number;
  bestScore: number;
  amScore?: number;
  pmScore?: number;
  dayScore?: number;
  astroScore?: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  isAstroWin: boolean;
  darkSky: boolean;
  elevation: number;
  tags: string[];
}

export interface DarkSkyAlertCard {
  name: string;
  region: string;
  driveMins: number;
  astroScore: number;
  bestAstroHour: string | null;
}

export interface SpurOfTheMomentSuggestion {
  locationName: string;
  region: string;
  driveMins: number;
  tags: string[];
  darkSky: boolean;
  hookLine: string;
  confidence: number;
}

export interface BriefRenderInput {
  dontBother: boolean;
  windows: Window[];
  todayCarWash: CarWash;
  dailySummary: DaySummary[];
  altLocations: AltLocation[];
  closeContenders?: AltLocation[];
  noAltsMsg?: string;
  sunriseStr: string;
  sunsetStr: string;
  moonPct: number;
  moonAltAtBestAstro?: number | null;
  metarNote?: string;
  today: string;
  todayBestScore: number;
  shSunsetQ: number | null;
  shSunriseQ: number | null;
  shSunsetText?: string;
  sunDir: number | null;
  crepPeak: number;
  aiText: string;
  compositionBullets?: string[];
  weekInsight?: string;
  peakKpTonight?: number | null;
  auroraSignal?: AuroraSignal | null;
  longRangeTop?: LongRangeCard | null;
  longRangeCardLabel?: string | null;
  darkSkyAlert?: DarkSkyAlertCard | null;
  spurOfTheMoment?: SpurOfTheMomentSuggestion | null;
  geminiInspire?: string;
  location?: BriefJsonLocation;
  sessionRecommendation?: SessionRecommendationSummary;
  debugContext?: DebugContext;
}

export interface BriefJsonLocation {
  name: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BriefJson extends BriefRenderInput {
  schemaVersion: typeof BRIEF_JSON_SCHEMA_VERSION;
  generatedAt: string | null;
  location: BriefJsonLocation;
}
