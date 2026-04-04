import { parseEditorialResponse } from '../../domain/editorial/resolution/parse.js';
import type {
  DebugApiCallStatus,
  DebugGeminiDiagnostics,
  DebugGroqDiagnostics,
  EditorialGatewayOutcome,
  EditorialGatewayPayload,
} from '../../contracts/index.js';

type BuildEditorialGatewayResultInput =
  | {
      provider: 'groq';
      rawText?: string;
      diagnostics?: DebugGroqDiagnostics;
    }
  | {
      provider: 'gemini';
      rawText?: string;
      rawPayload?: string;
      diagnostics?: DebugGeminiDiagnostics;
    };

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRawPayload(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined;
}

function buildApiCallStatus(
  provider: 'groq',
  diagnostics?: DebugGroqDiagnostics,
): DebugApiCallStatus | undefined;
function buildApiCallStatus(
  provider: 'gemini',
  diagnostics?: DebugGeminiDiagnostics,
): DebugApiCallStatus | undefined;
function buildApiCallStatus(
  provider: 'groq' | 'gemini',
  diagnostics?: DebugGeminiDiagnostics | DebugGroqDiagnostics,
): DebugApiCallStatus | undefined {
  const statusCode = diagnostics?.statusCode;

  if (statusCode === undefined || statusCode === null) {
    return undefined;
  }

  let status: DebugApiCallStatus['status'] = 'success';
  let message = `HTTP ${statusCode}`;

  if (statusCode === 429) {
    status = 'rate-limited';
    message = diagnostics?.retryAfter
      ? `Rate limited — retry after ${diagnostics.retryAfter}s`
      : 'Rate limited';
  } else if (statusCode >= 400) {
    status = 'error';
    message = `Error ${statusCode}`;
  } else if (statusCode === 200) {
    const bytes = diagnostics?.responseByteLength ?? 0;

    if (provider === 'gemini') {
      const geminiDiagnostics = diagnostics as DebugGeminiDiagnostics | undefined;
      const tokens = geminiDiagnostics?.candidatesTokenCount ?? 0;
      message = `Success — ${bytes} bytes, ${tokens} tokens`;

      if (geminiDiagnostics?.truncated) {
        message += `, truncated (${geminiDiagnostics.finishReason})`;
      }
    } else {
      message = `Success — ${bytes} bytes`;
    }
  }

  return {
    provider,
    status,
    httpStatus: statusCode,
    message,
    retryAfter: diagnostics?.retryAfter ?? null,
  };
}

function deriveGatewayOutcome(
  normalizedText: string,
  parseResult: ReturnType<typeof parseEditorialResponse>['parseResult'],
): EditorialGatewayOutcome {
  if (parseResult === 'malformed-structured') {
    return 'malformed';
  }

  if (!normalizedText) {
    return 'unusable';
  }

  return 'ready';
}

export function buildEditorialGatewayResult(
  input: Extract<BuildEditorialGatewayResultInput, { provider: 'groq' }>,
): EditorialGatewayPayload['groq'];
export function buildEditorialGatewayResult(
  input: Extract<BuildEditorialGatewayResultInput, { provider: 'gemini' }>,
): EditorialGatewayPayload['gemini'];
export function buildEditorialGatewayResult(
  input: BuildEditorialGatewayResultInput,
): EditorialGatewayPayload['groq'] | EditorialGatewayPayload['gemini'] {
  const rawText = trimText(input.rawText);

  if (!rawText) {
    if (input.provider === 'gemini') {
      const apiCallStatus = buildApiCallStatus('gemini', input.diagnostics);

      return {
        provider: 'gemini',
        rawText: '',
        normalizedText: '',
        outcome: 'empty',
        parseResult: 'empty',
        parsedResponse: null,
        rawPayload: normalizeRawPayload(input.rawPayload),
        diagnostics: input.diagnostics,
        apiCallStatus,
      };
    }

    const apiCallStatus = buildApiCallStatus('groq', input.diagnostics);

    return {
      provider: 'groq',
      rawText: '',
      normalizedText: '',
      outcome: 'empty',
      parseResult: 'empty',
      parsedResponse: null,
      diagnostics: input.diagnostics,
      apiCallStatus,
    };
  }

  const parsedResponse = parseEditorialResponse(rawText);
  const normalizedText = trimText(parsedResponse.editorial);
  const outcome = deriveGatewayOutcome(normalizedText, parsedResponse.parseResult);

  if (input.provider === 'gemini') {
    const apiCallStatus = buildApiCallStatus('gemini', input.diagnostics);

    return {
      provider: 'gemini',
      rawText,
      normalizedText,
      outcome,
      parseResult: parsedResponse.parseResult,
      parsedResponse,
      rawPayload: normalizeRawPayload(input.rawPayload),
      diagnostics: input.diagnostics,
      apiCallStatus,
    };
  }

  const apiCallStatus = buildApiCallStatus('groq', input.diagnostics);

  return {
    provider: 'groq',
    rawText,
    normalizedText,
    outcome,
    parseResult: parsedResponse.parseResult,
    parsedResponse,
    diagnostics: input.diagnostics,
    apiCallStatus,
  };
}

export function buildEditorialGatewayPayload(input: {
  groqRawText?: string;
  geminiRawText?: string;
  geminiRawPayload?: string;
  geminiDiagnostics?: DebugGeminiDiagnostics;
  groqDiagnostics?: DebugGroqDiagnostics;
}): EditorialGatewayPayload {
  return {
    groq: buildEditorialGatewayResult({
      provider: 'groq',
      rawText: input.groqRawText,
      diagnostics: input.groqDiagnostics,
    }),
    gemini: buildEditorialGatewayResult({
      provider: 'gemini',
      rawText: input.geminiRawText,
      rawPayload: input.geminiRawPayload,
      diagnostics: input.geminiDiagnostics,
    }),
  };
}

/**
 * Extract Gemini diagnostics from loose runtime fields.
 */
export function extractGeminiDiagnostics(input: {
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
}): DebugGeminiDiagnostics | undefined {
  const {
    geminiStatusCode,
    geminiFinishReason,
    geminiCandidateCount,
    geminiResponseByteLength,
    geminiResponseTruncated,
    geminiExtractionPath,
    geminiTopLevelKeys,
    geminiPayloadKeys,
    geminiPartKinds,
    geminiExtractedTextLength,
    geminiPromptTokenCount,
    geminiCandidatesTokenCount,
    geminiTotalTokenCount,
    geminiThoughtsTokenCount,
  } = input;

  const hasAnyDiagnostic =
    typeof geminiStatusCode === 'number'
    || (typeof geminiFinishReason === 'string' && geminiFinishReason.trim().length > 0)
    || typeof geminiCandidateCount === 'number'
    || typeof geminiResponseByteLength === 'number'
    || typeof geminiResponseTruncated === 'boolean';

  if (!hasAnyDiagnostic) {
    return undefined;
  }

  return {
    statusCode: finiteNumberOrNull(geminiStatusCode),
    finishReason:
      typeof geminiFinishReason === 'string' && geminiFinishReason.trim().length > 0
        ? geminiFinishReason.trim()
        : null,
    candidateCount: finiteNumberOrNull(geminiCandidateCount),
    responseByteLength: finiteNumberOrNull(geminiResponseByteLength),
    truncated: geminiResponseTruncated === true,
    extractionPath:
      typeof geminiExtractionPath === 'string' && geminiExtractionPath.trim().length > 0
        ? geminiExtractionPath.trim()
        : null,
    topLevelKeys: stringList(geminiTopLevelKeys),
    payloadKeys: stringList(geminiPayloadKeys),
    partKinds: stringList(geminiPartKinds),
    extractedTextLength: finiteNumberOrNull(geminiExtractedTextLength),
    promptTokenCount: finiteNumberOrNull(geminiPromptTokenCount),
    candidatesTokenCount: finiteNumberOrNull(geminiCandidatesTokenCount),
    totalTokenCount: finiteNumberOrNull(geminiTotalTokenCount),
    thoughtsTokenCount: finiteNumberOrNull(geminiThoughtsTokenCount),
  };
}

/**
 * Extract Groq diagnostics from loose runtime fields.
 */
export function extractGroqDiagnostics(input: {
  groqStatusCode?: unknown;
  groqResponseByteLength?: unknown;
  groqRetryAfter?: unknown;
}): DebugGroqDiagnostics | undefined {
  const { groqStatusCode, groqResponseByteLength, groqRetryAfter } = input;

  const hasAnyDiagnostic =
    typeof groqStatusCode === 'number' || typeof groqResponseByteLength === 'number';

  if (!hasAnyDiagnostic) {
    return undefined;
  }

  return {
    statusCode: finiteNumberOrNull(groqStatusCode),
    responseByteLength: finiteNumberOrNull(groqResponseByteLength),
    retryAfter: finiteNumberOrNull(groqRetryAfter),
  };
}
