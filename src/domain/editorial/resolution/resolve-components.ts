import type { CandidateSelectionResult } from './candidate-selection.js';
import { filterCompositionBullets } from './composition.js';
import { resolveSpurDropReason, resolveSpurSuggestion } from './spur-suggestion.js';
import type {
  BriefContext,
  EditorialCandidate,
  LongRangeSpurCandidate,
  SpurRaw,
  WeekStandoutResolution,
} from './types.js';
import { resolveWeekStandout } from './week-standout.js';

export interface ResolveEditorialComponentsInput {
  selection: CandidateSelectionResult;
  ctx: BriefContext;
  nearbyAltNames?: string[];
  longRangePool?: LongRangeSpurCandidate[];
}

export interface ResolveEditorialComponentsOutput {
  bestSpurRaw: SpurRaw | null;
  spurOfTheMoment: ReturnType<typeof resolveSpurSuggestion>;
  spurDropReason: string | undefined;
  rawCompositionBullets: string[];
  compositionBullets: string[];
  weekStandout: WeekStandoutResolution;
  weekStandoutHintCandidate: Pick<EditorialCandidate, 'parseResult' | 'weekStandoutRawValue'> | null;
  windowExplanation: string | null;
  sessionComparison: string | null;
  nextDayBridge: string | null;
  altLocationHook: string | null;
}

function pickBestSpurRaw(selection: CandidateSelectionResult): SpurRaw | null {
  return selection.componentCandidate?.spurRaw
    || selection.primaryCandidate?.spurRaw
    || selection.secondaryCandidate?.spurRaw
    || null;
}

function pickWeekStandoutHintCandidate(
  selection: CandidateSelectionResult,
): Pick<EditorialCandidate, 'parseResult' | 'weekStandoutRawValue'> | null {
  return selection.componentCandidate?.weekStandoutRawValue
    ? selection.componentCandidate
    : selection.primaryCandidate?.weekStandoutRawValue
      ? selection.primaryCandidate
      : selection.secondaryCandidate?.weekStandoutRawValue
        ? selection.secondaryCandidate
        : selection.componentCandidate
          ?? selection.primaryCandidate
          ?? selection.secondaryCandidate
          ?? null;
}


function pickStringField(
  field: 'windowExplanation' | 'sessionComparison' | 'nextDayBridge' | 'altLocationHook',
  selection: CandidateSelectionResult,
  preferProvider?: 'groq' | 'gemini',
): string | null {
  // If a preferred provider is specified, try that candidate first
  if (preferProvider) {
    const preferred = [selection.primaryCandidate, selection.componentCandidate, selection.secondaryCandidate]
      .find(c => c?.provider === preferProvider);
    if (preferred?.[field]) return preferred[field];
  }
  // Fall back to best-available ordering
  return selection.primaryCandidate?.[field]
    || selection.componentCandidate?.[field]
    || selection.secondaryCandidate?.[field]
    || null;
}

function pickRawCompositionBulletsWithPreference(
  selection: CandidateSelectionResult,
  preferProvider?: 'groq' | 'gemini',
): string[] {
  if (preferProvider) {
    const preferred = [selection.primaryCandidate, selection.componentCandidate, selection.secondaryCandidate]
      .find(c => c?.provider === preferProvider && c.compositionBullets?.length);
    if (preferred?.compositionBullets?.length) return preferred.compositionBullets;
  }
  return (
    (selection.componentCandidate?.compositionBullets?.length ? selection.componentCandidate.compositionBullets : null)
    ?? (selection.primaryCandidate?.compositionBullets?.length
      ? selection.primaryCandidate.compositionBullets
      : null)
    ?? (selection.secondaryCandidate?.compositionBullets?.length
      ? selection.secondaryCandidate.compositionBullets
      : null)
    ?? []
  );
}

export function resolveEditorialComponents(
  input: ResolveEditorialComponentsInput,
): ResolveEditorialComponentsOutput {
  const {
    selection,
    ctx,
    nearbyAltNames = [],
    longRangePool = [],
  } = input;

  const bestSpurRaw = pickBestSpurRaw(selection);
  const spurOfTheMoment = resolveSpurSuggestion(bestSpurRaw, nearbyAltNames, longRangePool);
  const rawCompositionBullets = pickRawCompositionBulletsWithPreference(selection, 'groq');
  const weekStandoutHintCandidate = pickWeekStandoutHintCandidate(selection);

  return {
    bestSpurRaw,
    spurOfTheMoment,
    spurDropReason: resolveSpurDropReason(bestSpurRaw, nearbyAltNames, longRangePool),
    rawCompositionBullets,
    compositionBullets: filterCompositionBullets(rawCompositionBullets, ctx),
    weekStandout: resolveWeekStandout(
      weekStandoutHintCandidate?.weekStandoutRawValue ?? null,
      ctx.dailySummary,
    ),
    weekStandoutHintCandidate,
    // Narrative fields — prefer Gemini (stronger reasoning)
    windowExplanation: pickStringField('windowExplanation', selection, 'gemini'),
    sessionComparison: pickStringField('sessionComparison', selection, 'gemini'),
    nextDayBridge: pickStringField('nextDayBridge', selection, 'gemini'),
    // Creative field — prefer Groq (faster, punchier hooks)
    altLocationHook: pickStringField('altLocationHook', selection, 'groq'),
  };
}
