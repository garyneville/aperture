import type { DebugGeminiDiagnostics } from '../../../core/debug-context.js';
import type {
  BriefContext,
  LongRangeSpurCandidate,
} from '../../../editorial/resolve-editorial.js';

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

export type EditorialContextPayload = Omit<
  EditorialBoundaryPayload,
  'choices'
  | 'geminiResponse'
  | 'geminiRawPayload'
  | 'geminiInspire'
  | 'geminiStatusCode'
  | 'geminiFinishReason'
  | 'geminiCandidateCount'
  | 'geminiResponseByteLength'
  | 'geminiResponseTruncated'
  | 'geminiExtractionPath'
  | 'geminiTopLevelKeys'
  | 'geminiPayloadKeys'
  | 'geminiPartKinds'
  | 'geminiExtractedTextLength'
  | 'geminiPromptTokenCount'
  | 'geminiCandidatesTokenCount'
  | 'geminiTotalTokenCount'
  | 'geminiThoughtsTokenCount'
>;

export type NormalizedEditorialInput = {
  ctx: EditorialContextPayload;
  groqRawContent: string;
  geminiRawContent: string;
  geminiInspire?: string;
  geminiRawPayload?: string;
  geminiDiagnostics?: DebugGeminiDiagnostics;
  nearbyAltNames: string[];
  longRangePool: LongRangeSpurCandidate[];
};
