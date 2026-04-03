import type { CandidateSelectionResult } from './candidate-selection.js';
import { filterCompositionBullets } from './composition.js';
import { resolveSpurDropReason, resolveSpurSuggestion } from './spur-suggestion.js';
import type {
  BriefContext,
  LongRangeSpurCandidate,
  SpurRaw,
  WeekStandoutResolution,
} from './types.js';
import { validateWeekInsight } from './week-standout.js';

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
}

function pickBestSpurRaw(selection: CandidateSelectionResult): SpurRaw | null {
  return selection.componentCandidate?.spurRaw
    || selection.primaryCandidate?.spurRaw
    || selection.secondaryCandidate?.spurRaw
    || null;
}

function pickBestWeekInsight(selection: CandidateSelectionResult): string {
  return (selection.componentCandidate?.weekInsight || '')
    || selection.primaryCandidate?.weekInsight
    || selection.secondaryCandidate?.weekInsight
    || '';
}

function pickRawCompositionBullets(selection: CandidateSelectionResult): string[] {
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
  const rawCompositionBullets = pickRawCompositionBullets(selection);

  return {
    bestSpurRaw,
    spurOfTheMoment,
    spurDropReason: resolveSpurDropReason(bestSpurRaw, nearbyAltNames, longRangePool),
    rawCompositionBullets,
    compositionBullets: filterCompositionBullets(rawCompositionBullets, ctx),
    weekStandout: validateWeekInsight(pickBestWeekInsight(selection), ctx.dailySummary),
  };
}
