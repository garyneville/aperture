import { splitAiSentences } from '../ai-briefing.js';
import type { WeekStandoutParseStatus } from '../../../lib/debug-context.js';
import type {
  EditorialCandidatePayload,
  EditorialModelResponse,
  EditorialParseResult,
  SpurRaw,
} from './types.js';

/**
 * Convert new provider-neutral parse result to legacy weekStandoutParseStatus.
 * @deprecated This is for backward compatibility only. Use parseResult directly.
 *
 * Note: For backward compatibility with the original parseGroqResponse behavior,
 * both 'malformed-structured' and 'raw-text-only' return 'parse-failure'.
 * Only 'valid-structured' differentiates between present/absent.
 */
function toWeekStandoutParseStatus(
  parseResult: EditorialParseResult,
  hasWeekStandout: boolean,
): WeekStandoutParseStatus {
  switch (parseResult) {
    case 'valid-structured':
      return hasWeekStandout ? 'present' : 'absent';
    case 'malformed-structured':
    case 'raw-text-only':
    default:
      // For backward compatibility: any non-valid parse result is 'parse-failure'
      return 'parse-failure';
  }
}

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

      // Determine if the structured response was actually valid
      const hasValidEditorial = typeof parsedRecord.editorial === 'string';
      const parseResult: EditorialParseResult = hasValidEditorial ? 'valid-structured' : 'malformed-structured';

      return {
        editorial: hasValidEditorial
          ? parsedRecord.editorial as string
          : rawContent,
        compositionBullets: Array.isArray(parsedRecord.composition)
          ? (parsedRecord.composition as unknown[]).filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : [],
        weekInsight: weekStandoutRawValue ?? '',
        spurRaw,
        parseResult,
        weekStandoutParseStatus: toWeekStandoutParseStatus(parseResult, weekStandoutRawValue !== null),
        weekStandoutRawValue,
      };
    }
  } catch {
    // JSON parsing failed
    const parseResult: EditorialParseResult = lookedLikeJson ? 'malformed-structured' : 'raw-text-only';

    return {
      editorial: rawContent,
      compositionBullets: [],
      weekInsight: '',
      spurRaw: null,
      parseResult,
      weekStandoutParseStatus: toWeekStandoutParseStatus(parseResult, false),
      weekStandoutRawValue: null,
    };
  }

  // Non-object JSON (e.g. just a string or number)
  const parseResult: EditorialParseResult = lookedLikeJson ? 'malformed-structured' : 'raw-text-only';

  return {
    editorial: rawContent,
    compositionBullets: [],
    weekInsight: '',
    spurRaw: null,
    parseResult,
    weekStandoutParseStatus: toWeekStandoutParseStatus(parseResult, false),
    weekStandoutRawValue: null,
  };
}

/**
 * @deprecated Use parseEditorialResponse instead. This function is kept for backward compatibility.
 */
export const parseGroqResponse = parseEditorialResponse;
