/**
 * Shared types for score-alternatives modules.
 */

import type { SiteDarkness } from '../site-darkness.js';
import type { AltLocation } from '../prepare-alt-locations.js';
import type { DebugContext } from '../debug-context.js';

/** Open-Meteo hourly + daily response shape (fields we use). */
export interface AltWeatherData {
  hourly?: {
    time?: string[];
    cloudcover?: number[];
    cloudcover_low?: number[];
    cloudcover_mid?: number[];
    cloudcover_high?: number[];
    visibility?: number[];
    temperature_2m?: number[];
    relativehumidity_2m?: number[];
    dewpoint_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    windspeed_10m?: number[];
    windgusts_10m?: number[];
    total_column_integrated_water_vapour?: number[];
    /** Snowfall in cm/hr (Open-Meteo hourly, available when elevation is upland). */
    snowfall?: number[];
    /** Snow depth on the ground in metres (Open-Meteo hourly). */
    snow_depth?: number[];
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
    moonrise?: string[];
    moonset?: string[];
  };
}

/** Per-day scoring result for a single location. */
export interface LocDayScore {
  dateKey: string;
  dayIdx: number;
  bestDay: number;
  bestAstro: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  bestTags: string[];
  amScore: number;
  pmScore: number;
  isAstroWin: boolean;
  meetsThreshold: boolean;
  /** Maximum snow depth on the ground for the day (cm), null when no data. */
  snowDepthCm: number | null;
  /** Total snowfall for the day (cm), null when no data. */
  snowfallCm: number | null;
}

/** A today-alt candidate that passed threshold + home comparison. */
export interface TodayAlt {
  name: string;
  driveMins: number;
  types: string[];
  siteDarkness: SiteDarkness;
  darkSky: boolean;
  dayScore: number;
  astroScore: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  amScore: number;
  pmScore: number;
  isAstroWin: boolean;
  meetsThreshold: boolean;
  elevationM: number;
  isUpland: boolean;
  /** Maximum snow depth on the ground for today (cm), null when no data or no snow. */
  snowDepthCm: number | null;
  /** Total snowfall for today (cm), null when no data or no snow. */
  snowfallCm: number | null;
}

/** Best alt candidate attached to each day in the augmented summary. */
export interface BestAltCandidate {
  name: string;
  driveMins: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  isAstroWin: boolean;
  siteDarkness: SiteDarkness;
  darkSky: boolean;
  bestTags: string[];
  amScore: number;
  pmScore: number;
  elevationM: number;
  isUpland: boolean;
  snowDepthCm: number | null;
  snowfallCm: number | null;
}

/** Minimal shape for a dailySummary entry from Best Windows. */
export interface DaySummary {
  headlineScore?: number;
  photoScore?: number;
  [key: string]: unknown;
}

/** Home-location context produced by the Best Windows stage. */
export interface HomeContext {
  windows: unknown;
  dontBother: unknown;
  todayBestScore: unknown;
  todayCarWash: unknown;
  dailySummary: DaySummary[];
  metarNote: unknown;
  sunrise: unknown;
  sunset: unknown;
  moonPct: unknown;
  debugContext?: DebugContext;
}

/** Input to scoreAlternatives. */
export interface ScoreAlternativesInput {
  altWeatherData: AltWeatherData[];
  altLocationMeta: AltLocation[];
  homeContext: HomeContext;
  timezone?: string;
}

/** Output from scoreAlternatives. */
export interface ScoreAlternativesOutput {
  altLocations: TodayAlt[];
  closeContenders: TodayAlt[];
  noAltsMsg: string | null;
  augmentedSummary: (DaySummary & { bestAlt: BestAltCandidate | null })[];
  debugContext: DebugContext;
}

/** Thresholds for alternative scoring. */
export const DAY_THRESHOLD = 58;
export const ASTRO_THRESHOLD = 60;
export const BEAT_HOME_MARGIN = 8;
