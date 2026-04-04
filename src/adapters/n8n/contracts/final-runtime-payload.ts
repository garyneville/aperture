import type { BriefJson, DebugContext } from '../../../contracts/index.js';
import type { FinalizeRuntimeContext } from '../../../app/run-photo-brief/finalize-brief-contracts.js';

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
  geminiRetryAfter?: unknown;
  groqStatusCode?: unknown;
  groqResponseByteLength?: unknown;
  groqRetryAfter?: unknown;
};

export type EditorialBoundaryPayload = FinalizeRuntimeContext & GeminiDiagnosticsFields & {
  choices?: GroqChoice[];
};

export type FinalRuntimePayload = EditorialBoundaryPayload & Record<string, unknown>;

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
