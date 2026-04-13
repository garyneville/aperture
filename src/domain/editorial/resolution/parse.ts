import { splitAiSentences } from '../ai-briefing.js';
import type {
  EditorialCandidatePayload,
  EditorialParseResult,
  SpurRaw,
} from './types.js';

export function stripMarkdownFences(content: string): string {
  return content.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/, '$1').trim();
}

export function normalizeAiText(text: string): string {
  const decimalFixed = text.replace(/(\d)\.\s+(\d)/g, '$1.$2');
  const cleaned = decimalFixed.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(No AI summary)';

  const sentences = splitAiSentences(cleaned);
  const shortened = sentences.slice(0, 2).join(' ').trim();
  const result = shortened.length > 280
    ? `${shortened.slice(0, 277).trimEnd()}...`
    : shortened;

  return result.replace(/(\d)\.\s*(\d)/g, '$1.$2');
}

/**
 * Parse an editorial model response from any AI provider.
 *
 * This function is provider-neutral - it parses the expected JSON contract
 * without tying the parsing logic to specific provider naming (Groq/Gemini/etc).
 *
 * @param rawContent - Raw response content from the AI provider
 * @returns Parsed and normalized editorial candidate payload with explicit parse result state
 */
export function parseEditorialResponse(rawContent: string): EditorialCandidatePayload {
  const stripped = stripMarkdownFences(rawContent);

  // Check if the content looks like it might be JSON (starts with { or [)
  const lookedLikeJson = /^\s*[{\[]/.test(stripped);

  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed === 'object') {
      const parsedRecord = parsed as Record<string, unknown>;
      let spurRaw: SpurRaw | null = null;
      const spur = parsedRecord.spurOfTheMoment;
      const spurRecord = spur && typeof spur === 'object'
        ? spur as Record<string, unknown>
        : null;
      const locationName = typeof spurRecord?.locationName === 'string'
        ? spurRecord.locationName.trim()
        : '';
      const hookLine = typeof spurRecord?.hookLine === 'string'
        ? spurRecord.hookLine.trim()
        : '';
      const confidence = typeof spurRecord?.confidence === 'number' && Number.isFinite(spurRecord.confidence)
        ? spurRecord.confidence
        : null;
      if (
        locationName.length > 0
        && hookLine.length > 0
        && confidence !== null
      ) {
        spurRaw = {
          locationName,
          hookLine,
          confidence,
        };
      }

      const weekStandoutRawValue = typeof parsedRecord.weekStandout === 'string'
        && parsedRecord.weekStandout.trim().length > 0
        ? parsedRecord.weekStandout.trim()
        : null;

      // Extract optional expanded editorial fields
      const windowExplanation = typeof parsedRecord.windowExplanation === 'string'
        && parsedRecord.windowExplanation.trim().length > 0
        ? parsedRecord.windowExplanation.trim()
        : null;
      const sessionComparison = typeof parsedRecord.sessionComparison === 'string'
        && parsedRecord.sessionComparison.trim().length > 0
        ? parsedRecord.sessionComparison.trim()
        : null;
      const nextDayBridge = typeof parsedRecord.nextDayBridge === 'string'
        && parsedRecord.nextDayBridge.trim().length > 0
        ? parsedRecord.nextDayBridge.trim()
        : null;
      const altLocationHook = typeof parsedRecord.altLocationHook === 'string'
        && parsedRecord.altLocationHook.trim().length > 0
        ? parsedRecord.altLocationHook.trim()
        : null;

      // Determine if the structured response was actually valid
      const hasValidEditorial = typeof parsedRecord.editorial === 'string';
      const parseResult: EditorialParseResult = hasValidEditorial ? 'valid-structured' : 'malformed-structured';

      return {
        editorial: hasValidEditorial
          ? parsedRecord.editorial as string
          : '',
        compositionBullets: Array.isArray(parsedRecord.composition)
          ? (parsedRecord.composition as unknown[]).filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : [],
        weekInsight: weekStandoutRawValue ?? '',
        spurRaw,
        parseResult,
        weekStandoutRawValue,
        windowExplanation,
        sessionComparison,
        nextDayBridge,
        altLocationHook,
      };
    }
  } catch {
    // JSON parsing failed
    const parseResult: EditorialParseResult = lookedLikeJson ? 'malformed-structured' : 'raw-text-only';

    return {
      editorial: lookedLikeJson ? '' : rawContent,
      compositionBullets: [],
      weekInsight: '',
      spurRaw: null,
      parseResult,
      weekStandoutRawValue: null,
      windowExplanation: null,
      sessionComparison: null,
      nextDayBridge: null,
      altLocationHook: null,
    };
  }

  // Non-object JSON (e.g. just a string or number)
  const parseResult: EditorialParseResult = lookedLikeJson ? 'malformed-structured' : 'raw-text-only';

  return {
    editorial: lookedLikeJson ? '' : rawContent,
    compositionBullets: [],
    weekInsight: '',
    spurRaw: null,
    parseResult,
    weekStandoutRawValue: null,
    windowExplanation: null,
    sessionComparison: null,
    nextDayBridge: null,
    altLocationHook: null,
  };
}


