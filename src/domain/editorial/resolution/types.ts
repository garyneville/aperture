import type {
  DebugAiCheck,
  DebugAiTrace,
  DebugApiCallStatus,
  DebugGeminiDiagnostics,
  DebugGroqDiagnostics,
  WeekStandoutDecision,
  WeekStandoutParseStatus,
} from '../../../lib/debug-context.js';
import type {
  EditorialDecision,
  EditorialProvider,
  SpurSuggestion,
} from '../../../app/run-photo-brief/contracts.js';

export type BriefContext = {
  homeLatitude?: number | null;
  homeLocationName?: string | null;
  dontBother?: boolean;
  debugMode?: boolean;
  debugModeSource?: string;
  debugEmailTo?: string;
  debugContext?: {
    metadata?: {
      generatedAt?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
    };
    nearbyAlternatives?: Array<{ name?: string }>;
  };
  peakKpTonight?: number | null;
  auroraSignal?: {
    nearTerm?: {
      level?: string;
      isStale?: boolean;
    } | null;
  } | null;
  windows?: WindowLike[];
  dailySummary?: Array<{
    dayLabel?: string;
    dayIdx?: number;
    headlineScore?: number;
    photoScore?: number;
    confidence?: string;
    confidenceStdDev?: number | null;
    bestPhotoHour?: string;
    astroScore?: number;
    bestAstroHour?: string | null;
    darkSkyStartsAt?: string | null;
  }>;
  altLocations?: Array<{
    name?: string;
    bestScore?: number;
    bestAstroHour?: string | null;
    darkSky?: boolean;
    driveMins?: number;
  }>;
  longRangeCandidates?: Array<{
    name?: string;
    region?: string;
    tags?: string[];
    bestScore?: number;
    dayScore?: number;
    astroScore?: number;
    driveMins?: number;
    darkSky?: boolean;
    deltaVsHome?: number;
    shown?: boolean;
    discardedReason?: string;
  }>;
  longRangeDebugCandidates?: Array<{
    name?: string;
    region?: string;
    tags?: string[];
    bestScore?: number;
    dayScore?: number;
    astroScore?: number;
    driveMins?: number;
    darkSky?: boolean;
    deltaVsHome?: number;
    shown?: boolean;
    discardedReason?: string;
  }>;
};

export type WindowLike = {
  label?: string;
  start?: string;
  end?: string;
  peak?: number;
  peakHour?: string | null;
  tops?: string[];
  hours?: Array<{
    hour?: string;
    score?: number;
    ct?: number;
    visK?: number;
    aod?: number;
  }>;
};

export type WindowHourLike = NonNullable<WindowLike['hours']>[number];

export type ValidationWindowContext = {
  originalPrimaryWindow: WindowLike | null;
  referenceWindow: WindowLike | null;
  promotedFromPast: boolean;
};

export type SpurRaw = { locationName: string; hookLine: string; confidence: number };
export type LongRangeSpurCandidate = { name?: string; shown?: boolean; discardedReason?: string };

/**
 * Provider-neutral parse result states.
 * Explicitly categorizes the outcome of parsing a model response.
 */
export type EditorialParseResult =
  | 'valid-structured'    // Successfully parsed valid structured JSON with expected fields
  | 'raw-text-only'       // No parseable structure; returning raw text only
  | 'malformed-structured'; // JSON was detected but malformed or missing expected fields

/**
 * Provider-neutral model response structure.
 * This represents the expected shape of any AI provider's response,
 * decoupled from specific provider naming (Groq/Gemini/etc).
 */
export type EditorialModelResponse = {
  /** Primary editorial text content */
  editorial: string;
  /** Composition/shot suggestions as bullet points */
  composition?: string[];
  /** Week standout insight text */
  weekStandout?: string;
  /** Spur-of-the-moment suggestion with metadata */
  spurOfTheMoment?: {
    locationName: string;
    hookLine: string;
    confidence: number;
  };
};

/**
 * Provider-neutral candidate payload extracted from a model response.
 * This is the normalized form used internally after parsing.
 */
export type EditorialCandidatePayload = {
  editorial: string;
  compositionBullets: string[];
  weekInsight: string;
  spurRaw: SpurRaw | null;
  /** Explicit parse result state - new provider-neutral field */
  parseResult: EditorialParseResult;
  /** @deprecated Use parseResult instead. Kept for backward compatibility. */
  weekStandoutParseStatus: WeekStandoutParseStatus;
  weekStandoutRawValue: string | null;
};

export type EditorialGatewayParseState = EditorialParseResult | 'empty';

export type EditorialGatewayOutcome = 'ready' | 'empty' | 'malformed' | 'unusable';

type EditorialGatewayBase = {
  rawText: string;
  normalizedText: string;
  outcome: EditorialGatewayOutcome;
  parseResult: EditorialGatewayParseState;
  parsedResponse: EditorialCandidatePayload | null;
  apiCallStatus?: DebugApiCallStatus;
};

export type GroqEditorialGatewayResult = EditorialGatewayBase & {
  provider: 'groq';
  diagnostics?: DebugGroqDiagnostics;
};

export type GeminiEditorialGatewayResult = EditorialGatewayBase & {
  provider: 'gemini';
  diagnostics?: DebugGeminiDiagnostics;
  rawPayload?: string;
};

export type EditorialGatewayResult =
  | GroqEditorialGatewayResult
  | GeminiEditorialGatewayResult;

export type EditorialGatewayPayload = {
  groq: GroqEditorialGatewayResult;
  gemini: GeminiEditorialGatewayResult;
};

/**
 * @deprecated Use EditorialCandidatePayload instead. This type will be removed in a future release.
 */
export type ParsedEditorialResponse = EditorialCandidatePayload;

export type EditorialCandidate = {
  provider: EditorialProvider;
  rawContent: string;
  editorial: string;
  compositionBullets: string[];
  weekInsight: string;
  spurRaw: SpurRaw | null;
  weekStandoutParseStatus: WeekStandoutParseStatus;
  weekStandoutRawValue: string | null;
  normalizedAiText: string;
  factualCheck: DebugAiCheck;
  editorialCheck: DebugAiCheck;
  passed: boolean;
  reusableComponents: boolean;
};

export type WeekSummaryDay = NonNullable<BriefContext['dailySummary']>[number];

export type WeekStandoutResolution = {
  text: string;
  usedRaw: boolean;
  decision: WeekStandoutDecision;
  fallbackReason: string | null;
};

export type ResolveEditorialInput = {
  preferredProvider: EditorialProvider;
  ctx: BriefContext;
  editorialGateway: EditorialGatewayPayload;
  geminiInspire?: string;
  nearbyAltNames?: string[];
  longRangePool?: LongRangeSpurCandidate[];
};

export type ResolveEditorialOutput = {
  editorial: EditorialDecision;
  debugAiTrace: DebugAiTrace;
};

export type { EditorialProvider, SpurSuggestion };
