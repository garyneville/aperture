import type {
  DebugAiCheck,
  DebugAiTrace,
  DebugGeminiDiagnostics,
  WeekStandoutDecision,
  WeekStandoutParseStatus,
} from '../../../core/debug-context.js';
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

export type ParsedEditorialResponse = {
  editorial: string;
  compositionBullets: string[];
  weekInsight: string;
  spurRaw: SpurRaw | null;
  weekStandoutParseStatus: WeekStandoutParseStatus;
  weekStandoutRawValue: string | null;
};

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
  groqRawContent: string;
  geminiRawContent: string;
  geminiInspire?: string;
  geminiDiagnostics?: DebugGeminiDiagnostics;
  geminiRawPayload?: string;
  nearbyAltNames?: string[];
  longRangePool?: LongRangeSpurCandidate[];
};

export type ResolveEditorialOutput = {
  editorial: EditorialDecision;
  debugAiTrace: DebugAiTrace;
};

export type { EditorialProvider, SpurSuggestion };
