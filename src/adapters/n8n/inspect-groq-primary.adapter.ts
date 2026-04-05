import { parseEditorialResponse } from '../../domain/editorial/resolution/parse.js';
import type { GroqChoice } from './contracts/final-runtime-payload.js';
import {
  getHttpResponseBodySource,
  getHttpResponseStatusCode,
  getHttpRetryAfterSeconds,
  getUtf8ByteLength,
  safeJsonStringify,
  unwrapHttpPayload,
} from './contracts/http-response.js';
import { firstInputJson } from './input.js';
import type { N8nRuntime } from './types.js';

type GroqChoiceMessage = {
  content?: unknown;
};

type GroqChoiceLike = {
  message?: GroqChoiceMessage | null;
};

type GroqChatCompletionsResponse = {
  choices: GroqChoiceLike[];
};

export type GroqPrimaryInspection = {
  choices: GroqChoice[];
  groqStatusCode: number | null;
  groqResponseByteLength: number | null;
  groqRetryAfter: number | null;
  groqFallbackRequired: boolean;
  groqFallbackReason: string | null;
  /** Structured error message for diagnostic logging. */
  groqErrorDetail: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isGroqChatCompletionsResponse(value: Record<string, unknown>): value is GroqChatCompletionsResponse {
  return Array.isArray(value.choices);
}

function normalizeChoices(choices: GroqChoiceLike[] | undefined): GroqChoice[] {
  if (!Array.isArray(choices)) {
    return [];
  }

  return choices
    .filter(isRecord)
    .map(choice => ({
      message: isRecord(choice.message)
        ? {
            content: typeof choice.message.content === 'string' ? choice.message.content : undefined,
          }
        : undefined,
    }));
}

function getChoiceContent(choices: GroqChoice[]): string {
  const value = choices[0]?.message?.content;
  return typeof value === 'string' ? value.trim() : '';
}

function getFallbackReason(statusCode: number | null, rawText: string): string | null {
  if (statusCode === 429) {
    return 'rate-limited';
  }

  if (typeof statusCode === 'number' && statusCode >= 400) {
    return `http-error-${statusCode}`;
  }

  if (!rawText) {
    return 'empty-response';
  }

  const parsed = parseEditorialResponse(rawText);
  if (parsed.parseResult === 'malformed-structured') {
    return 'malformed-structured-output';
  }

  if (!parsed.editorial.trim()) {
    return 'empty-editorial';
  }

  return null;
}

function buildErrorDetail(
  statusCode: number | null,
  fallbackReason: string | null,
  responseByteLength: number | null,
  retryAfter: number | null,
): string | null {
  if (!fallbackReason) return null;

  const parts: string[] = [];
  if (statusCode !== null) parts.push(`HTTP ${statusCode}`);
  parts.push(`reason=${fallbackReason}`);
  if (typeof responseByteLength === 'number') parts.push(`bodyBytes=${responseByteLength}`);
  if (typeof retryAfter === 'number') parts.push(`retryAfter=${retryAfter}s`);
  return parts.join(', ');
}

export function inspectGroqPrimary(item: Record<string, unknown>): GroqPrimaryInspection {
  const responseSource = getHttpResponseBodySource(item);
  const payloadInfo = unwrapHttpPayload(
    responseSource.value,
    responseSource.path,
    isGroqChatCompletionsResponse,
  );
  const payload = payloadInfo.payload;
  const choices = normalizeChoices(payload?.choices);
  const rawText = getChoiceContent(choices);
  const serializedPayload = payload ? safeJsonStringify(payload) : payloadInfo.transportText;
  const responseByteLength = getUtf8ByteLength(serializedPayload || rawText);
  const groqStatusCode = getHttpResponseStatusCode(item);
  const groqFallbackReason = getFallbackReason(groqStatusCode, rawText);

  return {
    choices,
    groqStatusCode,
    groqResponseByteLength: responseByteLength,
    groqRetryAfter: getHttpRetryAfterSeconds(item),
    groqFallbackRequired: groqFallbackReason !== null,
    groqFallbackReason,
    groqErrorDetail: buildErrorDetail(
      groqStatusCode,
      groqFallbackReason,
      responseByteLength,
      getHttpRetryAfterSeconds(item),
    ),
  };
}

export function run({ $input }: N8nRuntime) {
  const item = firstInputJson($input, {} as Record<string, unknown>);
  return [{ json: inspectGroqPrimary(item) }];
}
