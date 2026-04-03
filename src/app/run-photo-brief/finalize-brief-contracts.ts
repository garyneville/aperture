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

import type { DebugContext, DebugGeminiDiagnostics } from '../../lib/debug-context.js';
import type { BriefContext, LongRangeSpurCandidate } from '../../domain/editorial/resolution/resolve-editorial.js';
import type { EditorialDecision } from './contracts.js';
import type { BriefJson } from '../../types/brief.js';

/**
 * Raw editorial inputs from AI providers.
 * This is the boundary payload that crosses from the runtime (n8n, CLI, etc.)
 * into the application layer.
 */
export type RawEditorialInput = {
  /** Scored forecast context with windows, alternatives, etc. */
  context: BriefContext;

  /** Groq API response choices */
  groqChoices?: Array<{ message?: { content?: string } }>;

  /** Gemini raw text response */
  geminiResponse?: string;

  /** Gemini raw payload (for debugging) */
  geminiRawPayload?: string;

  /** Gemini inspire text (optional creative addition) */
  geminiInspire?: string;

  /** Gemini diagnostics for debug tracing */
  geminiDiagnostics?: DebugGeminiDiagnostics;

  /** Nearby alternative location names for spur suggestion filtering */
  nearbyAltNames?: string[];

  /** Long-range destination candidates for spur suggestions */
  longRangePool?: LongRangeSpurCandidate[];
};

/**
 * Normalized editorial inputs after parsing and validation.
 */
export type NormalizedEditorialInput = {
  /** The brief context (minus diagnostic fields) */
  context: BriefContext;

  /** Raw Groq response content */
  groqRawContent: string;

  /** Raw Gemini response content */
  geminiRawContent: string;

  /** Optional Gemini inspire text */
  geminiInspire?: string;

  /** Optional Gemini raw payload for debugging */
  geminiRawPayload?: string;

  /** Optional Gemini diagnostics */
  geminiDiagnostics?: DebugGeminiDiagnostics;

  /** Nearby alternative names for spur filtering */
  nearbyAltNames: string[];

  /** Long-range pool for spur suggestions */
  longRangePool: LongRangeSpurCandidate[];
};

/**
 * Configuration for the finalize operation.
 */
export type FinalizeConfig = {
  /** Primary AI provider preference */
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
