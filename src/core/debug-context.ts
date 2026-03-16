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
}

export interface DebugHourlyScore {
  hour: string;
  timestamp: string;
  final: number;
  cloud: number;
  visK: number;
  aod: number;
  moonAdjustment: number;
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
  weatherDelta: number;
  discardedReason?: string;
}

export interface DebugAiCheck {
  passed: boolean;
  rulesTriggered: string[];
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
  fallbackUsed: boolean;
  finalAiText: string;
}

export interface DebugContext {
  metadata?: DebugRunMetadata;
  scores?: DebugScores;
  hourlyScoring: DebugHourlyScore[];
  windows: DebugWindowTrace[];
  nearbyAlternatives: DebugNearbyAlternative[];
  ai?: DebugAiTrace;
}

export function emptyDebugContext(): DebugContext {
  return {
    hourlyScoring: [],
    windows: [],
    nearbyAlternatives: [],
  };
}
