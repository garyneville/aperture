import { splitAiSentences } from '../../../core/ai-briefing.js';
import type {
  ParsedEditorialResponse,
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

export function parseGroqResponse(rawContent: string): ParsedEditorialResponse {
  const stripped = stripMarkdownFences(rawContent);
  let parseFailure = false;

  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed === 'object') {
      let spurRaw: SpurRaw | null = null;
      const spur = (parsed as Record<string, unknown>).spurOfTheMoment;
      if (
        spur
        && typeof spur === 'object'
        && typeof (spur as Record<string, unknown>).locationName === 'string'
        && typeof (spur as Record<string, unknown>).hookLine === 'string'
        && typeof (spur as Record<string, unknown>).confidence === 'number'
      ) {
        spurRaw = {
          locationName: (spur as Record<string, unknown>).locationName as string,
          hookLine: (spur as Record<string, unknown>).hookLine as string,
          confidence: (spur as Record<string, unknown>).confidence as number,
        };
      }

      const weekStandoutRawValue = typeof (parsed as Record<string, unknown>).weekStandout === 'string'
        ? (parsed as Record<string, unknown>).weekStandout as string
        : null;
      const weekStandoutParseStatus = weekStandoutRawValue !== null ? 'present' : 'absent';

      return {
        editorial: typeof (parsed as Record<string, unknown>).editorial === 'string'
          ? (parsed as Record<string, unknown>).editorial as string
          : rawContent,
        compositionBullets: Array.isArray((parsed as Record<string, unknown>).composition)
          ? ((parsed as Record<string, unknown>).composition as unknown[]).filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : [],
        weekInsight: weekStandoutRawValue ?? '',
        spurRaw,
        weekStandoutParseStatus,
        weekStandoutRawValue,
      };
    }
  } catch {
    parseFailure = true;
  }

  return {
    editorial: rawContent,
    compositionBullets: [],
    weekInsight: '',
    spurRaw: null,
    weekStandoutParseStatus: parseFailure ? 'parse-failure' : 'absent',
    weekStandoutRawValue: null,
  };
}
