// Shared data contracts for the scoring domain.
// Types here are used by both score-all-days.ts and the hourly/daily submodules.

// ── Nowcast interfaces ────────────────────────────────────────────────────────

export interface NowcastSatelliteData {
  current?: {
    time?: string;
    shortwave_radiation?: number;
    shortwave_radiation_instant?: number;
  };
  hourly?: {
    time?: string[];
    shortwave_radiation?: number[];
    shortwave_radiation_instant?: number[];
  };
  current_clear_sky?: {
    shortwave_radiation?: number;
  };
  hourly_clear_sky?: {
    time?: string[];
    shortwave_radiation?: number[];
  };
}

export type NowcastDirection = 'clearing' | 'thickening' | 'neutral';

export interface NowcastSignal {
  direction: NowcastDirection;
  magnitude: number;
  observedCloudFactor: number;
  forecastCloudFraction: number;
  delta: number;
  confidence: 'high' | 'medium' | 'low';
  staleAfter: string;
  source: 'satellite-radiation';
}

// ── Input interfaces ──────────────────────────────────────────────────────────

export interface WeatherData {
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
    precipitation?: number[];
    windspeed_10m?: number[];
    windgusts_10m?: number[];
    winddirection_10m?: number[];
    cape?: number[];
    vapour_pressure_deficit?: number[];
    total_column_integrated_water_vapour?: number[];
    boundary_layer_height?: number[];
    direct_radiation?: (number | null)[];
    diffuse_radiation?: (number | null)[];
    soil_temperature_0cm?: (number | null)[];
  };
  daily?: {
    sunrise: string[];
    sunset: string[];
    moonrise?: string[];
    moonset?: string[];
  };
}

export interface AirQualityData {
  hourly?: {
    time?: string[];
    aerosol_optical_depth?: (number | null)[];
    dust?: (number | null)[];
    european_aqi?: (number | null)[];
    uv_index?: (number | null)[];
    pm2_5?: (number | null)[];
    alder_pollen?: (number | null)[];
    birch_pollen?: (number | null)[];
    grass_pollen?: (number | null)[];
  };
}

export interface PrecipProbData {
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
    lightning_potential?: (number | null)[];
  };
}

export interface SunsetHueEntry {
  time?: string;
  type?: string;
  quality?: number;
  quality_text?: string;
  direction?: string;
  magics?: {
    golden_hour?: [string, string];
    blue_hour?: [string, string];
  };
}

export interface EnsembleData {
  hourly?: Record<string, (number | null)[] | string[]>;
}

export interface AzimuthScanResult {
  occlusionRisk?: number | null;
  lowRisk?: number | null;
  horizonGapPct?: number | null;
  gapQualityScore?: number | null;
  clearPathBonus?: number;
}

export interface AzimuthByPhase {
  sunrise?: Record<string, AzimuthScanResult>;
  sunset?: Record<string, AzimuthScanResult>;
}

export interface MarineData {
  hourly?: {
    time?: string[];
    wave_height?: (number | null)[];
    wave_direction?: (number | null)[];
    wave_period?: (number | null)[];
    wave_peak_period?: (number | null)[];
  };
}

// ── Output types ──────────────────────────────────────────────────────────────

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
  windDir: number | null;
  gusts: number;
  tmp: number;
  hum: number;
  dew: number;
  pp: number;
  pr: number;
  vpd: number;
  boundaryLayerHeightM?: number | null;
  horizonGapPct?: number | null;
  azimuthRisk: number | null;
  isGolden: boolean;
  isGoldAm: boolean;
  isGoldPm: boolean;
  isBlue: boolean;
  isBlueAm: boolean;
  isBluePm: boolean;
  isNight: boolean;
  moon: number;
  moonAltDeg: number | null;
  solarAltDeg: number | null;
  uv: number;
  tags: string[];
  directRadiationWm2?: number | null;
  diffuseRadiationWm2?: number | null;
  soilTemperature0cmC?: number | null;
  comfort: string;
  nowcastSignal?: NowcastSignal | null;
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

export interface DaySummary {
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
  postFrontalClarityPeak: number;
  postFrontalClarityWindow: string | null;
}
