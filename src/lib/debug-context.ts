import type { SessionConfidence, SessionId } from '../contracts/session-score.js';

export interface DebugRunMetadata {
  generatedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  workflowVersion?: string | null;
  triggerSource?: string | null;
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
  bestSession?: {
    session: SessionId;
    hour: string;
    score: number;
    confidence: SessionConfidence;
    volatility: number | null;
  };
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
  sessionScores?: DebugHourlySessionScore[];
  tags: string[];
}

export interface DebugHourlySessionScore {
  session: SessionId;
  score: number;
  hardPass: boolean;
  confidence: SessionConfidence;
  volatility: number | null;
  reasons: string[];
  warnings: string[];
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
  /** Delta vs the home overall/headline score (used for filtering — must beat home by 8+ pts). */
  weatherDelta: number;
  /** Delta vs the selected local window peak (same baseline used in AI/fallback editorial text). */
  deltaVsWindowPeak: number | null;
  discardedReason?: string;
}

export interface DebugAiCheck {
  passed: boolean;
  rulesTriggered: string[];
}

/**
 * Diagnostics for the primary AI provider.
 * Previously named DebugGeminiDiagnostics, renamed to reflect slot role.
 */
export interface DebugPrimaryDiagnostics {
  statusCode: number | null;
  finishReason: string | null;
  candidateCount: number | null;
  responseByteLength: number | null;
  truncated: boolean;
  extractionPath?: string | null;
  topLevelKeys?: string[];
  payloadKeys?: string[];
  partKinds?: string[];
  extractedTextLength?: number | null;
  promptTokenCount?: number | null;
  candidatesTokenCount?: number | null;
  totalTokenCount?: number | null;
  thoughtsTokenCount?: number | null;
  /** Rate limit retry-after header value in seconds, if applicable */
  retryAfter?: number | null;
}

/**
 * Diagnostics for the fallback AI provider.
 * Previously named DebugGroqDiagnostics, renamed to reflect slot role.
 */
export interface DebugFallbackDiagnostics {
  statusCode: number | null;
  responseByteLength: number | null;
  /** Rate limit retry-after header value in seconds, if applicable */
  retryAfter?: number | null;
}

/**
 * @deprecated Use DebugPrimaryDiagnostics instead.
 */
export type DebugGeminiDiagnostics = DebugPrimaryDiagnostics;

/**
 * @deprecated Use DebugFallbackDiagnostics instead.
 */
export type DebugGroqDiagnostics = DebugFallbackDiagnostics;


/**
 * Provider slot type - represents the role of the provider in the editorial pipeline.
 */
export type ProviderSlot = 'primary' | 'fallback';

/**
 * Legacy provider names for backward compatibility.
 * @deprecated Use ProviderSlot instead.
 */
export type LegacyProviderName = 'gemini' | 'groq';

export interface DebugApiCallStatus {
  /** Provider slot (primary/fallback) rather than specific vendor */
  provider: ProviderSlot | LegacyProviderName;
  status: 'success' | 'rate-limited' | 'error';
  httpStatus: number | null;
  message: string;
  retryAfter?: number | null;
}

export type WeekStandoutDecision = 'deterministic-used' | 'omitted';

export interface DebugWeekStandoutTrace {
  parseResult: 'valid-structured' | 'raw-text-only' | 'malformed-structured';
  rawValue: string | null;
  used: boolean;
  decision?: WeekStandoutDecision;
  finalValue?: string | null;
  hintAligned?: boolean | null;
  note?: string | null;
}

/**
 * Provider selection result type.
 * Represents which provider slot was selected for the editorial.
 */
export type SelectedProvider = ProviderSlot | 'template';

/**
 * @deprecated Use SelectedProvider instead.
 */
export type LegacySelectedProvider = 'groq' | 'gemini' | 'template';

export interface DebugAiTrace {
  /** Primary provider slot used for this run */
  primaryProvider?: ProviderSlot | LegacyProviderName;
  /** Selected provider (primary, fallback, or template) */
  selectedProvider?: SelectedProvider | LegacySelectedProvider;
  /** Reason primary provider was rejected (if applicable) */
  primaryRejectionReason?: string | null;
  /** Reason fallback provider was rejected (if applicable) */
  secondaryRejectionReason?: string | null;
  /** Raw response from fallback provider (historically Groq) */
  rawFallbackResponse: string;
  /** Raw response from primary provider (historically Gemini) */
  rawPrimaryResponse?: string;
  /** Raw payload from primary provider (historically Gemini) */
  rawPrimaryPayload?: string;
  /** @deprecated Use rawFallbackResponse instead */
  rawGroqResponse: string;
  /** @deprecated Use rawPrimaryResponse instead */
  rawGeminiResponse?: string;
  /** @deprecated Use rawPrimaryPayload instead */
  rawGeminiPayload?: string;
  /** Diagnostics for primary provider */
  primaryDiagnostics?: DebugPrimaryDiagnostics;
  /** Diagnostics for fallback provider */
  fallbackDiagnostics?: DebugFallbackDiagnostics;
  /** @deprecated Use primaryDiagnostics instead */
  geminiDiagnostics?: DebugPrimaryDiagnostics;
  /** @deprecated Use fallbackDiagnostics instead */
  groqDiagnostics?: DebugFallbackDiagnostics;
  /** High-level API call status for both providers */
  apiCallStatuses?: DebugApiCallStatus[];
  normalizedAiText: string;
  factualCheck: DebugAiCheck;
  editorialCheck: DebugAiCheck;
  /** Composition bullets received from providers and the final resolved set after filtering. */
  compositionBullets?: {
    rawCount: number;
    resolvedCount: number;
    sourceProvider: string | null;
    resolved: string[];
  };
  spurSuggestion: {
    raw: string | null;
    confidence: number | null;
    resolved: string | null;
    dropped: boolean;
    dropReason?: string;
  };
  weekStandout: DebugWeekStandoutTrace;
  fallbackUsed: boolean;
  modelFallbackUsed: boolean;
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
  deltaVsHome: number;
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

export interface DebugOutdoorComfortHour {
  hour: string;
  comfortScore: number;
  label: string;
  tmp: number;
  pp: number;
  wind: number;
  visK: number;
  pr: number;
}

export interface DebugOutdoorComfort {
  bestWindow: { start: string; end: string; label: string } | null;
  hours: DebugOutdoorComfortHour[];
}

export interface DebugPayloadSnapshot {
  label: string;
  byteLength: number;
  /** Human-readable summary of the payload (preferred over raw json). */
  summary?: string;
  /** Full JSON payload — only included when explicitly requested (may be very large). */
  json?: string;
}

export interface DebugContext {
  metadata?: DebugRunMetadata;
  scores?: DebugScores;
  hourlyScoring: DebugHourlyScore[];
  windows: DebugWindowTrace[];
  nearbyAlternatives: DebugNearbyAlternative[];
  longRangeCandidates?: DebugLongRangeCandidate[];
  kitAdvisory?: DebugKitAdvisory;
  outdoorComfort?: DebugOutdoorComfort;
  ai?: DebugAiTrace;
  payloadSnapshots?: DebugPayloadSnapshot[];
}

export function emptyDebugContext(): DebugContext {
  return {
    hourlyScoring: [],
    windows: [],
    nearbyAlternatives: [],
  };
}
