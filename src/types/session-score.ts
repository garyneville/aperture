import type { ScoringCapability } from './capabilities.js';

export type SessionId =
  | 'golden-hour'
  | 'astro'
  | 'mist'
  | 'storm'
  | 'street'
  | 'wildlife'
  | 'waterfall'
  | 'seascape';

export type SessionConfidence = 'low' | 'medium' | 'high';

export interface DerivedHourFeatures {
  hourLabel: string;
  overallScore: number;
  dramaScore: number;
  clarityScore: number;
  mistScore: number;
  astroScore: number;
  crepuscularScore: number;
  transparencyScore: number;
  cloudLowPct: number;
  cloudMidPct: number;
  cloudHighPct: number;
  cloudTotalPct: number;
  visibilityKm: number;
  aerosolOpticalDepth: number;
  precipProbabilityPct: number;
  humidityPct: number;
  temperatureC: number;
  dewPointC: number;
  dewPointSpreadC: number;
  windKph: number;
  gustKph: number;
  moonIlluminationPct: number;
  isNight: boolean;
  isGolden: boolean;
  isBlue: boolean;
  tags: string[];
  boundaryLayerHeightM?: number | null;
  horizonGapPct?: number | null;
  seeingScore?: number | null;
  lightPollutionBortle?: number | null;
  surfaceWetnessScore?: number | null;
  tideState?: string | null;
  swellHeightM?: number | null;
  swellPeriodS?: number | null;
  capeJkg?: number | null;
  verticalShearKts?: number | null;
  lightningRisk?: number | null;
}

export interface SessionScore {
  session: SessionId;
  score: number;
  hardPass: boolean;
  confidence: SessionConfidence;
  volatility: number | null;
  reasons: string[];
  warnings: string[];
  requiredCapabilities: ScoringCapability[];
}

export interface SessionEvaluator {
  session: SessionId;
  requiredCapabilities: ScoringCapability[];
  evaluateHour(features: DerivedHourFeatures): SessionScore;
}
