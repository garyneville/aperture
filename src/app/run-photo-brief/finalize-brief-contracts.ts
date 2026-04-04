/**
 * Contracts for the finalize-brief use case.
 *
 * This use case assembles the final brief by:
 * 1. Normalizing editorial inputs (Groq/Gemini responses, diagnostics)
 * 2. Preparing debug context
 * 3. Resolving editorial (with fallbacks)
 * 4. Hydrating debug trace
 * 5. Rendering all outputs (email, Telegram, site, JSON)
 */

import type { EditorialDecision } from './contracts.js';

// Cross-layer types imported from contracts (shared across app/domain/presenters/adapters)
import type {
  BriefJson,
  DebugContext,
  EditorialGatewayPayload,
  ScoredForecastContext,
  LongRangeSpurCandidate,
} from '../../contracts/index.js';

/**
 * Final runtime context consumed by finalizeBrief.
 *
 * This use case runs after scoring and before rendering, so it needs the
 * scored-forecast payload that presenters expect, plus a few runtime/debug
 * flags that are not part of the presenter contract.
 */
export type FinalizeRuntimeContext = Omit<ScoredForecastContext, 'debugContext'> & {
  debugContext?: DebugContext;
  homeLatitude?: number | null;
  homeLocationName?: string | null;
  debugMode?: boolean;
  debugModeSource?: string;
  debugEmailTo?: string;
  triggerSource?: string | null;
};

/**
 * Raw editorial inputs from AI providers.
 * This is the stable boundary payload that crosses from the runtime (n8n, CLI, etc.)
 * into the application layer after transport-specific extraction has already happened.
 */
export type RawEditorialInput = {
  /** Scored runtime context used for both editorial resolution and rendering. */
  context: FinalizeRuntimeContext;

  /** Stable editorial gateway payload built at the runtime edge. */
  editorialGateway: EditorialGatewayPayload;

  /** Gemini inspire text (optional creative addition) */
  geminiInspire?: string;

  /** Nearby alternative location names for spur suggestion filtering */
  nearbyAltNames?: string[];

  /** Long-range destination candidates for spur suggestions */
  longRangePool?: LongRangeSpurCandidate[];
};

/**
 * Normalized editorial inputs after parsing and validation.
 */
export type NormalizedEditorialInput = {
  /** The final runtime context (minus diagnostic fields) */
  context: FinalizeRuntimeContext;

  /** Stable editorial gateway payload */
  editorialGateway: EditorialGatewayPayload;

  /** Optional Gemini inspire text */
  geminiInspire?: string;

  /** Nearby alternative names for spur filtering */
  nearbyAltNames: string[];

  /** Long-range pool for spur suggestions */
  longRangePool: LongRangeSpurCandidate[];
};

/**
 * Configuration for the finalize operation.
 */
export type FinalizeConfig = {
  /** Primary AI provider preference (vendor name: 'groq' | 'gemini') */
  preferredProvider: 'groq' | 'gemini';

  /** Home location metadata */
  homeLocation: {
    name: string;
    lat: number;
    lon: number;
    timezone: string;
  };

  /** Debug configuration */
  debug: {
    enabled: boolean;
    emailTo: string;
    source: string;
  };

  /** Trigger source identifier */
  triggerSource: string | null;
};

/**
 * The complete finalized brief result.
 */
export type FinalizedBrief = {
  /** The canonical brief JSON */
  briefJson: BriefJson;

  /** Telegram formatted message */
  telegramMsg: string;

  /** Email HTML */
  emailHtml: string;

  /** Site HTML */
  siteHtml: string;

  /** Debug email HTML (empty if debug disabled) */
  debugEmailHtml: string;

  /** Debug email subject */
  debugEmailSubject: string;

  /** Editorial decision details */
  editorial: EditorialDecision;

  /** Whether debug mode is active */
  debugMode: boolean;

  /** Debug recipient email */
  debugEmailTo: string;

  /** Full debug context */
  debugContext: DebugContext;
};

/**
 * Prepared debug context before hydration.
 */
export type PreparedDebugContext = {
  debugContext: DebugContext;
  debugMode: boolean;
  debugEmailTo: string;
  debugModeSource: string;
  triggerSource: string | null;
};
