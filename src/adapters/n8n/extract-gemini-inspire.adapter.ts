import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';
import { getHttpResponseBodySource, unwrapHttpPayload } from './contracts/http-response.js';

type GeminiPart = Record<string, unknown> & {
  text?: unknown;
};

type GeminiCandidate = {
  content?: {
    parts?: unknown;
  } | null;
};

type GeminiGenerateContentResponse = {
  candidates: GeminiCandidate[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isGeminiGenerateContentResponse(value: Record<string, unknown>): value is GeminiGenerateContentResponse {
  return Array.isArray(value.candidates);
}

function collectGeminiText(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] as GeminiCandidate | undefined : undefined;
  const parts = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts.filter(isRecord) as GeminiPart[]
    : [];

  return parts
    .map(part => typeof part.text === 'string' ? part.text : '')
    .join('')
    .trim();
}

export function extractGeminiInspire(item: Record<string, unknown>): string | null {
  const responseSource = getHttpResponseBodySource(item);
  const payloadInfo = unwrapHttpPayload(
    responseSource.value,
    responseSource.path,
    isGeminiGenerateContentResponse,
  );
  const raw = collectGeminiText(payloadInfo.payload?.candidates)
    || (typeof responseSource.value === 'string' ? responseSource.value.trim() : '');
  if (!raw) {
    return null;
  }

  return raw.replace(/[^.!?]*$/, '').trim() || raw;
}

export function run({ $input }: N8nRuntime) {
  const item = firstInputJson($input, {} as Record<string, unknown>);
  return [{ json: { geminiInspire: extractGeminiInspire(item) } }];
}
