import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';
import {
  getHttpResponseBodySource,
  getHttpRetryAfterSeconds,
  getHttpResponseStatusCode,
  getObjectKeys,
  getUtf8ByteLength,
  safeJsonStringify,
  unwrapHttpPayload,
} from './contracts/http-response.js';

type GeminiUsageMetadata = {
  promptTokenCount?: unknown;
  candidatesTokenCount?: unknown;
  totalTokenCount?: unknown;
  thoughtsTokenCount?: unknown;
};

type GeminiPart = Record<string, unknown> & {
  text?: unknown;
};

type GeminiCandidate = {
  finishReason?: unknown;
  content?: {
    parts?: unknown;
  } | null;
};

type GeminiGenerateContentResponse = {
  candidates: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata | null;
};

type GeminiFallbackExtraction = {
  geminiResponse: string | null;
  geminiRawPayload: string | null;
  geminiStatusCode: number | null;
  geminiFinishReason: string | null;
  geminiCandidateCount: number | null;
  geminiResponseByteLength: number | null;
  geminiResponseTruncated: boolean;
  geminiExtractionPath: string | null;
  geminiTopLevelKeys: string[];
  geminiPayloadKeys: string[] | null;
  geminiPartKinds: string[] | null;
  geminiExtractedTextLength: number | null;
  geminiPromptTokenCount: number | null;
  geminiCandidatesTokenCount: number | null;
  geminiTotalTokenCount: number | null;
  geminiThoughtsTokenCount: number | null;
  geminiRetryAfter: number | null;
  /** Structured error message for diagnostic logging. */
  geminiErrorDetail: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isGeminiGenerateContentResponse(value: Record<string, unknown>): value is GeminiGenerateContentResponse {
  return Array.isArray(value.candidates);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function collectGeminiParts(candidate: GeminiCandidate | null): GeminiPart[] {
  return Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts.filter(isRecord)
    : [];
}

function collectGeminiText(parts: GeminiPart[]): string {
  return parts
    .map(part => typeof part.text === 'string' ? part.text : '')
    .join('')
    .trim();
}

function listGeminiPartKinds(parts: GeminiPart[]): string[] | null {
  return parts.length > 0
    ? Array.from(new Set(parts.flatMap(part => Object.keys(part))))
    : null;
}

function isMalformedJsonText(text: string | null): boolean {
  if (!text || !/^[\[{]/.test(text)) {
    return false;
  }

  try {
    JSON.parse(text);
    return false;
  } catch {
    return true;
  }
}

function buildGeminiErrorDetail(
  statusCode: number | null,
  responseByteLength: number | null,
  text: string | null,
  truncated: boolean,
  retryAfter: number | null,
): string | null {
  const issues: string[] = [];
  if (statusCode !== null && statusCode >= 400) {
    issues.push(`HTTP ${statusCode}`);
  }
  if (statusCode === 429) issues.push('reason=rate-limited');
  if (typeof responseByteLength === 'number' && responseByteLength > 0 && !text) {
    issues.push(`reason=no-text-extracted, bodyBytes=${responseByteLength}`);
  }
  if (text === null && (responseByteLength === null || responseByteLength === 0)) {
    issues.push('reason=empty-response');
  }
  if (truncated) issues.push('reason=truncated');
  if (typeof retryAfter === 'number') issues.push(`retryAfter=${retryAfter}s`);
  return issues.length > 0 ? issues.join(', ') : null;
}

export function extractGeminiFallback(item: Record<string, unknown>): GeminiFallbackExtraction {
  const responseSource = getHttpResponseBodySource(item);
  const payloadInfo = unwrapHttpPayload(
    responseSource.value,
    responseSource.path,
    isGeminiGenerateContentResponse,
  );
  const payload = payloadInfo.payload;
  const candidate = Array.isArray(payload?.candidates) ? payload.candidates[0] ?? null : null;
  const parts = collectGeminiParts(candidate);
  const rawText = collectGeminiText(parts);
  const text = rawText || null;
  const rawTransportText = typeof payloadInfo.transportText === 'string' && payloadInfo.transportText.trim().length > 0
    ? payloadInfo.transportText
    : typeof responseSource.value === 'string' && responseSource.value.trim().length > 0
      ? responseSource.value
      : null;
  const serializedPayload = payload ? safeJsonStringify(payload) : rawTransportText;
  const diagnosticPayload = serializedPayload
    || rawTransportText
    || (isRecord(responseSource.value) ? safeJsonStringify(responseSource.value) : null)
    || rawText;
  const usageMetadata = payload?.usageMetadata && isRecord(payload.usageMetadata)
    ? payload.usageMetadata
    : null;
  const finishReason = typeof candidate?.finishReason === 'string' ? candidate.finishReason : null;

  const statusCode = getHttpResponseStatusCode(item);
  const responseByteLength = getUtf8ByteLength(diagnosticPayload);
  const truncated = finishReason === 'MAX_TOKENS' || isMalformedJsonText(text);
  const retryAfter = getHttpRetryAfterSeconds(item);

  return {
    geminiResponse: text,
    geminiRawPayload: diagnosticPayload || null,
    geminiStatusCode: statusCode,
    geminiFinishReason: finishReason,
    geminiCandidateCount: Array.isArray(payload?.candidates) ? payload.candidates.length : null,
    geminiResponseByteLength: responseByteLength,
    geminiResponseTruncated: truncated,
    geminiExtractionPath: payloadInfo.path,
    geminiTopLevelKeys: getObjectKeys(item) ?? [],
    geminiPayloadKeys: getObjectKeys(payload),
    geminiPartKinds: listGeminiPartKinds(parts),
    geminiExtractedTextLength: text ? text.length : null,
    geminiPromptTokenCount: numberOrNull(usageMetadata?.promptTokenCount),
    geminiCandidatesTokenCount: numberOrNull(usageMetadata?.candidatesTokenCount),
    geminiTotalTokenCount: numberOrNull(usageMetadata?.totalTokenCount),
    geminiThoughtsTokenCount: numberOrNull(usageMetadata?.thoughtsTokenCount),
    geminiRetryAfter: retryAfter,
    geminiErrorDetail: buildGeminiErrorDetail(statusCode, responseByteLength, text, truncated, retryAfter),
  };
}

export function run({ $input }: N8nRuntime) {
  const item = firstInputJson($input, {} as Record<string, unknown>);
  return [{ json: extractGeminiFallback(item) }];
}
