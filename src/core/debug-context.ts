export interface DebugRunMetadata {
  generatedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  workflowVersion?: string | null;
  debugModeEnabled: boolean;
  debugModeSource?: string | null;
  debugRecipient?: string | null;
}

export interface DebugScores {
  am: number;
  pm: number;
  astro: number;
  overall: number;
  certainty: string | null;
  certaintySpread: number | null;
  astroConfidence: string | null;
  astroConfidenceStdDev: number | null;
}

export interface DebugHourlyScore {
  hour: string;
  timestamp: string;
  final: number;
  cloud: number;
  visK: number;
  aod: number;
  moonAdjustment: number;
  moonState: string;
  aodPenalty: number;
  astroScore: number;
  drama: number;
  clarity: number;
  mist: number;
  moon: {
    altitudeDeg: number;
    illuminationPct: number;
    azimuthDeg: number | null;
    isUp: boolean;
  };
  tags: string[];
}

export interface DebugWindowTrace {
  label: string;
  start: string;
  end: string;
  peak: number;
  rank: number;
  selected: boolean;
  fallback: boolean;
  selectionReason: string;
  darkPhaseStart?: string | null;
  postMoonsetScore?: number | null;
}

export interface DebugNearbyAlternative {
  name: string;
  rank: number;
  shown: boolean;
  bestScore: number;
  dayScore: number;
  astroScore: number;
  driveMins: number;
  bortle: number;
  darknessScore: number;
  darknessDelta: number;
  /** Delta vs Leeds overall/headline score (used for filtering — must beat Leeds by 8+ pts). */
  weatherDelta: number;
  /** Delta vs the selected local window peak (same baseline used in AI/fallback editorial text). */
  deltaVsWindowPeak: number | null;
  discardedReason?: string;
}

export interface DebugAiCheck {
  passed: boolean;
  rulesTriggered: string[];
}

export type WeekStandoutParseStatus = 'present' | 'absent' | 'parse-failure';
export type WeekStandoutDecision = 'raw-used' | 'fallback-used' | 'omitted';

export interface DebugWeekStandoutTrace {
  parseStatus: WeekStandoutParseStatus;
  rawValue: string | null;
  used: boolean;
  decision?: WeekStandoutDecision;
  finalValue?: string | null;
  fallbackReason?: string | null;
}

export interface DebugAiTrace {
  rawGroqResponse: string;
  normalizedAiText: string;
  factualCheck: DebugAiCheck;
  editorialCheck: DebugAiCheck;
  spurSuggestion: {
    raw: string | null;
    confidence: number | null;
    resolved: string | null;
    dropped: boolean;
    dropReason?: string;
  };
  weekStandout: DebugWeekStandoutTrace;
  fallbackUsed: boolean;
  finalAiText: string;
}

export interface DebugLongRangeCandidate {
  name: string;
  region: string;
  tags: string[];
  bestScore: number;
  dayScore: number;
  astroScore: number;
  driveMins: number;
  darkSky: boolean;
  rank: number;
  deltaVsLeeds: number;
  shown: boolean;
  discardedReason?: string;
}

export interface DebugKitAdvisoryRule {
  id: string;
  threshold: string;
  value: string;
  matched: boolean;
  shown: boolean;
}

export interface DebugKitAdvisory {
  rules: DebugKitAdvisoryRule[];
  tipsShown: string[];
}

export interface DebugContext {
  metadata?: DebugRunMetadata;
  scores?: DebugScores;
  hourlyScoring: DebugHourlyScore[];
  windows: DebugWindowTrace[];
  nearbyAlternatives: DebugNearbyAlternative[];
  longRangeCandidates?: DebugLongRangeCandidate[];
  kitAdvisory?: DebugKitAdvisory;
  ai?: DebugAiTrace;
}

export function emptyDebugContext(): DebugContext {
  return {
    hourlyScoring: [],
    windows: [],
    nearbyAlternatives: [],
  };
}
