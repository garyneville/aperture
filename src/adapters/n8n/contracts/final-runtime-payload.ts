import type { DebugContext } from '../../../lib/debug-context.js';
import type { BriefJson } from '../../../types/brief.js';
import type { BriefContext } from '../../../domain/editorial/resolution/resolve-editorial.js';

export type GroqChoice = {
  message?: {
    content?: string;
  };
};

export type GeminiDiagnosticsFields = {
  geminiResponse?: unknown;
  geminiRawPayload?: unknown;
  geminiInspire?: unknown;
  geminiStatusCode?: unknown;
  geminiFinishReason?: unknown;
  geminiCandidateCount?: unknown;
  geminiResponseByteLength?: unknown;
  geminiResponseTruncated?: unknown;
  geminiExtractionPath?: unknown;
  geminiTopLevelKeys?: unknown;
  geminiPayloadKeys?: unknown;
  geminiPartKinds?: unknown;
  geminiExtractedTextLength?: unknown;
  geminiPromptTokenCount?: unknown;
  geminiCandidatesTokenCount?: unknown;
  geminiTotalTokenCount?: unknown;
  geminiThoughtsTokenCount?: unknown;
};

export type EditorialBoundaryPayload = BriefContext & GeminiDiagnosticsFields & {
  choices?: GroqChoice[];
};

export type LongRangeCandidateLike = {
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
};

export type FinalRuntimePayload = EditorialBoundaryPayload & Record<string, unknown> & {
  debugContext?: DebugContext;
  debugMode?: boolean;
  debugEmailTo?: string;
  debugModeSource?: string;
  triggerSource?: string | null;
  today?: string;
  longRangeCandidates?: LongRangeCandidateLike[];
  longRangeDebugCandidates?: LongRangeCandidateLike[];
};

export type RenderableRuntimeContext = FinalRuntimePayload & {
  debugContext: DebugContext;
};

export type FormatMessagesOutput = {
  briefJson: BriefJson;
  telegramMsg: string;
  emailHtml: string;
  siteHtml: string;
  debugMode: boolean;
  debugEmailTo: string;
  debugEmailHtml: string;
  debugEmailSubject: string;
};
