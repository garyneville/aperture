import type { ScoringCapability } from './capabilities.js';

export type AlertLevel = 'warn' | 'info';
export type AlertCategory = 'lightning' | 'air-quality' | 'pollen' | 'dust' | 'uv-exposure';

export interface Alert {
  level: AlertLevel;
  category: AlertCategory;
  badge: string;
  message: string;
}

export type SessionId =
  | 'golden-hour'
  | 'astro'
  | 'mist'
  | 'storm'
  | 'urban'
  | 'long-exposure'
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
  windDirectionDeg: number | null;
  boundaryLayerTrapScore: number | null;
  hazeTrapRisk: number | null;
  cloudOpticalThicknessPct: number;
  highCloudTranslucencyScore: number;
  lowCloudBlockingScore: number;
  moonIlluminationPct: number;
  moonAltitudeDeg?: number | null;
  solarAltitudeDeg?: number | null;
  isNight: boolean;
  isGolden: boolean;
  isBlue: boolean;
  tags: string[];
  azimuthOcclusionRiskPct?: number | null;
  azimuthLowCloudRiskPct?: number | null;
  clearPathBonusPts?: number | null;
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
  ensembleCloudStdDevPct?: number | null;
  ensembleCloudMeanPct?: number | null;
  directRadiationWm2?: number | null;
  diffuseRadiationWm2?: number | null;
  soilTemperature0cmC?: number | null;
  diffuseToDirectRatio: number | null;
  hasFrost: boolean | null;
  metarWxType?: string | null;
  metarVisibilityM?: number | null;
  metarCloudBaseM?: number | null;
  metarDewPointSpreadC?: number | null;
  visibilityDeltaVsModelKm?: number | null;
  postFrontalClarityScore?: number | null;
  recentRainfallMm?: number | null;
  swellDirectionDeg?: number | null;
  waveHeightM?: number | null;
  pm25Ugm3?: number | null;
  pollenGrainsM3?: number | null;
  uvIndex?: number | null;
  europeanAqi?: number | null;
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

export interface SessionHourSelection extends SessionScore {
  hourLabel: string;
}

export interface SessionRecommendation extends SessionHourSelection {}

export interface SessionRecommendationSummary {
  primary: SessionRecommendation | null;
  runnerUps: SessionRecommendation[];
  bySession: SessionRecommendation[];
  hoursAnalyzed: number;
  planB: string | null;
  alerts: Alert[];
}

export interface SessionEvaluator {
  session: SessionId;
  requiredCapabilities: ScoringCapability[];
  evaluateHour(features: DerivedHourFeatures): SessionScore;
}
