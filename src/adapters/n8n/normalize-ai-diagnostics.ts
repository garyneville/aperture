import type { NormalizedEditorialInput } from './contracts/editorial-input.js';
import type { EditorialBoundaryPayload } from './contracts/editorial-input.js';

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined;
}

export function normalizeAiDiagnostics(input: EditorialBoundaryPayload): NormalizedEditorialInput {
  const {
    choices,
    geminiResponse,
    geminiRawPayload,
    geminiInspire,
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
    ...ctx
  } = input;

  const groqRawContent = choices?.[0]?.message?.content?.trim() || '';
  const geminiRawContent = typeof geminiResponse === 'string' ? geminiResponse.trim() : '';
  const normalizedGeminiRawPayload = typeof geminiRawPayload === 'string' && geminiRawPayload.trim().length > 0
    ? geminiRawPayload
    : undefined;
  const geminiDiagnostics = (
    geminiRawContent
    || normalizedGeminiRawPayload
    || typeof geminiStatusCode === 'number'
    || (typeof geminiFinishReason === 'string' && geminiFinishReason.trim().length > 0)
    || typeof geminiCandidateCount === 'number'
    || typeof geminiResponseByteLength === 'number'
    || typeof geminiResponseTruncated === 'boolean'
  )
    ? {
        statusCode: finiteNumberOrNull(geminiStatusCode),
        finishReason: typeof geminiFinishReason === 'string' && geminiFinishReason.trim().length > 0 ? geminiFinishReason.trim() : null,
        candidateCount: finiteNumberOrNull(geminiCandidateCount),
        responseByteLength: finiteNumberOrNull(geminiResponseByteLength),
        truncated: geminiResponseTruncated === true,
        extractionPath: typeof geminiExtractionPath === 'string' && geminiExtractionPath.trim().length > 0 ? geminiExtractionPath.trim() : null,
        topLevelKeys: stringList(geminiTopLevelKeys),
        payloadKeys: stringList(geminiPayloadKeys),
        partKinds: stringList(geminiPartKinds),
        extractedTextLength: finiteNumberOrNull(geminiExtractedTextLength),
        promptTokenCount: finiteNumberOrNull(geminiPromptTokenCount),
        candidatesTokenCount: finiteNumberOrNull(geminiCandidatesTokenCount),
        totalTokenCount: finiteNumberOrNull(geminiTotalTokenCount),
        thoughtsTokenCount: finiteNumberOrNull(geminiThoughtsTokenCount),
      }
    : undefined;

  const longRangePool = Array.isArray(ctx.longRangeDebugCandidates)
    ? ctx.longRangeDebugCandidates
    : Array.isArray(ctx.longRangeCandidates)
      ? ctx.longRangeCandidates
      : [];
  const nearbyAltNames = [
    ...(ctx.altLocations || []).map((alt: { name?: string }) => alt?.name),
    ...((ctx.debugContext?.nearbyAlternatives || []).map((alt: { name?: string }) => alt?.name)),
  ].filter((name: string | undefined): name is string => Boolean(name));

  return {
    ctx,
    groqRawContent,
    geminiRawContent,
    geminiInspire: typeof geminiInspire === 'string' ? geminiInspire : undefined,
    geminiRawPayload: normalizedGeminiRawPayload,
    geminiDiagnostics,
    nearbyAltNames,
    longRangePool,
  };
}
