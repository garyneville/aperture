import { buildFallbackAiText as buildSharedFallbackAiText } from '../../../lib/ai-briefing.js';
import {
  buildWindowDisplayPlan,
  getRunTimeContext,
  timeAwareBriefingFallback,
} from '../../../domain/windowing/index.js';
import type { DebugGeminiDiagnostics } from '../../../lib/debug-context.js';
import type { EditorialProvider } from '../../../app/run-photo-brief/contracts.js';
import { filterCompositionBullets } from './composition.js';
import {
  normalizeAiText,
  parseGroqResponse,
} from './parse.js';
import {
  resolveSpurDropReason,
  resolveSpurSuggestion,
} from './spur-suggestion.js';
import type {
  BriefContext,
  EditorialCandidate,
  LongRangeSpurCandidate,
  ResolveEditorialInput,
  ResolveEditorialOutput,
} from './types.js';
import {
  getEditorialCheck,
  getFactualCheck,
} from './validation.js';
import { validateWeekInsight } from './week-standout.js';

export type {
  BriefContext,
  LongRangeSpurCandidate,
  ResolveEditorialInput,
  ResolveEditorialOutput,
  SpurRaw,
  WindowLike,
} from './types.js';
export { normalizeAiText, parseGroqResponse } from './parse.js';
export {
  isFactuallyIncoherentEditorial,
  shouldReplaceAiText,
} from './validation.js';
export { filterCompositionBullets } from './composition.js';
export { resolveSpurSuggestion } from './spur-suggestion.js';

function buildEditorialCandidate(
  provider: EditorialProvider,
  rawContent: string,
  ctx: BriefContext,
): EditorialCandidate | null {
  if (!rawContent.trim()) return null;
  const parsed = parseGroqResponse(rawContent);
  const normalizedAiText = normalizeAiText(parsed.editorial);
  const factualCheck = getFactualCheck(normalizedAiText, ctx);
  const editorialCheck = getEditorialCheck(normalizedAiText, ctx);

  return {
    provider,
    rawContent,
    editorial: parsed.editorial,
    compositionBullets: parsed.compositionBullets,
    weekInsight: parsed.weekInsight,
    spurRaw: parsed.spurRaw,
    weekStandoutParseStatus: parsed.weekStandoutParseStatus,
    weekStandoutRawValue: parsed.weekStandoutRawValue,
    normalizedAiText,
    factualCheck,
    editorialCheck,
    passed: factualCheck.passed && editorialCheck.passed,
    reusableComponents: parsed.weekStandoutParseStatus !== 'parse-failure',
  };
}

export function chooseEditorialCandidate(
  preferredProvider: EditorialProvider,
  ctx: BriefContext,
  groqRawContent: string,
  geminiRawContent: string,
): {
  primaryProvider: EditorialProvider;
  selectedProvider: EditorialProvider | 'template';
  primaryCandidate: EditorialCandidate | null;
  secondaryCandidate: EditorialCandidate | null;
  selectedCandidate: EditorialCandidate | null;
  componentCandidate: EditorialCandidate | null;
  fallbackUsed: boolean;
} {
  const candidates: Record<EditorialProvider, EditorialCandidate | null> = {
    groq: buildEditorialCandidate('groq', groqRawContent, ctx),
    gemini: buildEditorialCandidate('gemini', geminiRawContent, ctx),
  };
  const secondaryProvider: EditorialProvider = preferredProvider === 'groq' ? 'gemini' : 'groq';
  const primaryCandidate = candidates[preferredProvider];
  const secondaryCandidate = candidates[secondaryProvider];

  const selectedCandidate = primaryCandidate?.passed
    ? primaryCandidate
    : secondaryCandidate?.passed
      ? secondaryCandidate
      : null;
  const componentCandidate = selectedCandidate
    || (primaryCandidate?.reusableComponents
      ? primaryCandidate
      : secondaryCandidate?.reusableComponents
        ? secondaryCandidate
        : null);

  return {
    primaryProvider: preferredProvider,
    selectedProvider: selectedCandidate?.provider ?? 'template',
    primaryCandidate,
    secondaryCandidate,
    selectedCandidate,
    componentCandidate,
    fallbackUsed: selectedCandidate === null,
  };
}

function summarizeCandidateRejection(
  provider: EditorialProvider,
  rawContent: string,
  candidate: EditorialCandidate | null,
  geminiDiagnostics?: DebugGeminiDiagnostics,
): string | null {
  const reasons: string[] = [];

  if (!rawContent.trim()) {
    if (provider === 'gemini') {
      const statusCode = geminiDiagnostics?.statusCode;
      const responseByteLength = geminiDiagnostics?.responseByteLength;
      const extractionPath = geminiDiagnostics?.extractionPath;
      if (typeof responseByteLength === 'number' && responseByteLength > 0) {
        const statusLabel = statusCode !== null && statusCode !== undefined ? `HTTP ${statusCode}` : 'Gemini response';
        const extractionLabel = extractionPath ? ` (${extractionPath})` : '';
        reasons.push(`${statusLabel} — response received (${responseByteLength} bytes) but no Gemini text was extracted${extractionLabel}`);
      } else if (statusCode !== null && statusCode !== undefined) {
        reasons.push(`HTTP ${statusCode} but empty response body`);
      } else {
        reasons.push('empty response body');
      }
    } else {
      reasons.push('empty response body');
    }
  } else if (candidate && candidate.editorial === rawContent) {
    if (provider === 'gemini' && geminiDiagnostics?.statusCode !== null && geminiDiagnostics?.statusCode !== undefined) {
      reasons.push(`HTTP ${geminiDiagnostics.statusCode} — response received (${geminiDiagnostics.responseByteLength ?? '?'} bytes) but editorial field absent or unparseable`);
    } else {
      reasons.push('editorial field absent or unparseable in response JSON');
    }
  }

  if (provider === 'gemini' && geminiDiagnostics?.truncated) {
    reasons.push(`response truncated (${geminiDiagnostics.finishReason || 'incomplete Gemini response'})`);
  }

  if (candidate && !candidate.factualCheck.passed) {
    reasons.push(`factual validation failed: ${candidate.factualCheck.rulesTriggered.join(', ')}`);
  }

  if (candidate && !candidate.editorialCheck.passed) {
    reasons.push(`editorial validation failed: ${candidate.editorialCheck.rulesTriggered.join(', ')}`);
  }

  return reasons.length ? reasons.join('; ') : null;
}

export function buildFallbackAiText(ctx: BriefContext): string {
  const generatedAt = ctx.debugContext?.metadata?.generatedAt;
  if (generatedAt && ctx.windows?.length) {
    const displayPlan = buildWindowDisplayPlan(
      ctx.windows as Parameters<typeof buildWindowDisplayPlan>[0],
      getRunTimeContext(ctx.debugContext as Parameters<typeof getRunTimeContext>[0]).nowMinutes,
    );
    const timeAwareFallback = timeAwareBriefingFallback(displayPlan);
    if (timeAwareFallback) return timeAwareFallback;
  }
  return buildSharedFallbackAiText(ctx);
}

export function resolveEditorial(input: ResolveEditorialInput): ResolveEditorialOutput {
  const {
    preferredProvider,
    ctx,
    groqRawContent,
    geminiRawContent,
    geminiInspire,
    geminiDiagnostics,
    geminiRawPayload,
    nearbyAltNames = [],
    longRangePool = [],
  } = input;
  const editorialChoice = chooseEditorialCandidate(
    preferredProvider,
    ctx,
    groqRawContent,
    geminiRawContent,
  );
  const secondaryProvider: EditorialProvider = preferredProvider === 'groq' ? 'gemini' : 'groq';
  const editorialCandidate = editorialChoice.selectedCandidate;
  const componentCandidate = editorialChoice.componentCandidate;
  const traceCandidate = editorialCandidate
    || componentCandidate
    || editorialChoice.primaryCandidate
    || editorialChoice.secondaryCandidate;
  const bestSpurRaw = componentCandidate?.spurRaw
    || editorialChoice.primaryCandidate?.spurRaw
    || editorialChoice.secondaryCandidate?.spurRaw
    || null;
  const spurOfTheMoment = resolveSpurSuggestion(
    bestSpurRaw,
    nearbyAltNames,
    longRangePool,
  );
  const aiText = editorialCandidate
    ? editorialCandidate.normalizedAiText
    : buildFallbackAiText(ctx);
  const bestWeekInsight = (componentCandidate?.weekInsight || '')
    || editorialChoice.primaryCandidate?.weekInsight
    || editorialChoice.secondaryCandidate?.weekInsight
    || '';
  const resolvedWeekStandout = validateWeekInsight(bestWeekInsight, ctx.dailySummary);
  const rawCompositionBullets: string[] = (
    (componentCandidate?.compositionBullets?.length ? componentCandidate.compositionBullets : null)
    ?? (editorialChoice.primaryCandidate?.compositionBullets?.length
      ? editorialChoice.primaryCandidate.compositionBullets
      : null)
    ?? (editorialChoice.secondaryCandidate?.compositionBullets?.length
      ? editorialChoice.secondaryCandidate.compositionBullets
      : null)
    ?? []
  );
  const safeCompositionBullets = filterCompositionBullets(rawCompositionBullets, ctx);
  const safeGeminiInspire = typeof geminiInspire === 'string' && geminiInspire.trim().length > 0
    ? geminiInspire.trim()
    : undefined;
  const primaryRawContent = preferredProvider === 'gemini' ? geminiRawContent : groqRawContent;
  const secondaryRawContent = secondaryProvider === 'gemini' ? geminiRawContent : groqRawContent;
  const primaryRejectionReason = editorialChoice.selectedProvider === preferredProvider
    ? null
    : summarizeCandidateRejection(
        preferredProvider,
        primaryRawContent,
        editorialChoice.primaryCandidate,
        preferredProvider === 'gemini' ? geminiDiagnostics : undefined,
      );
  const secondaryRejectionReason = editorialChoice.selectedProvider === secondaryProvider
    ? null
    : editorialChoice.selectedProvider === 'template'
      ? summarizeCandidateRejection(
          secondaryProvider,
          secondaryRawContent,
          editorialChoice.secondaryCandidate,
          secondaryProvider === 'gemini' ? geminiDiagnostics : undefined,
        )
      : null;

  return {
    editorial: {
      primaryProvider: editorialChoice.primaryProvider,
      selectedProvider: editorialChoice.selectedProvider,
      fallbackUsed: editorialChoice.fallbackUsed,
      aiText,
      compositionBullets: safeCompositionBullets,
      weekInsight: resolvedWeekStandout.text,
      spurOfTheMoment,
      geminiInspire: safeGeminiInspire,
      rawGroqResponse: groqRawContent || undefined,
      rawGeminiResponse: geminiRawContent || undefined,
      rawGeminiPayload: geminiRawPayload,
    },
    debugAiTrace: {
      primaryProvider: editorialChoice.primaryProvider,
      selectedProvider: editorialChoice.selectedProvider,
      primaryRejectionReason,
      secondaryRejectionReason,
      rawGroqResponse: groqRawContent,
      rawGeminiResponse: geminiRawContent || undefined,
      rawGeminiPayload: geminiRawPayload,
      geminiDiagnostics,
      normalizedAiText: traceCandidate?.normalizedAiText || '',
      factualCheck: traceCandidate?.factualCheck || { passed: false, rulesTriggered: ['missing AI summary'] },
      editorialCheck: traceCandidate?.editorialCheck || { passed: false, rulesTriggered: ['missing AI summary'] },
      spurSuggestion: {
        raw: bestSpurRaw ? `${bestSpurRaw.locationName} (${bestSpurRaw.confidence})` : null,
        confidence: bestSpurRaw?.confidence ?? null,
        resolved: spurOfTheMoment?.locationName || null,
        dropped: Boolean(bestSpurRaw) && !spurOfTheMoment,
        dropReason: resolveSpurDropReason(bestSpurRaw, nearbyAltNames, longRangePool),
      },
      compositionBullets: {
        rawCount: rawCompositionBullets.length,
        resolvedCount: safeCompositionBullets.length,
        sourceProvider: rawCompositionBullets.length > 0
          ? ((componentCandidate?.compositionBullets?.length ? componentCandidate.provider : null)
            ?? (editorialChoice.primaryCandidate?.compositionBullets?.length ? editorialChoice.primaryCandidate.provider : null)
            ?? (editorialChoice.secondaryCandidate?.compositionBullets?.length ? editorialChoice.secondaryCandidate.provider : null))
          : null,
        resolved: safeCompositionBullets,
      },
      weekStandout: {
        parseStatus: componentCandidate?.weekStandoutParseStatus || 'absent',
        rawValue: componentCandidate?.weekStandoutRawValue || null,
        used: resolvedWeekStandout.usedRaw,
        decision: resolvedWeekStandout.decision,
        finalValue: resolvedWeekStandout.text || null,
        fallbackReason: resolvedWeekStandout.fallbackReason,
      },
      fallbackUsed: editorialChoice.fallbackUsed,
      modelFallbackUsed: !editorialChoice.fallbackUsed
        && editorialChoice.selectedProvider !== editorialChoice.primaryProvider
        && editorialChoice.selectedProvider !== 'template',
      finalAiText: aiText,
    },
  };
}
