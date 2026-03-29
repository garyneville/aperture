import type { DebugContext, DebugLongRangeCandidate } from '../core/debug-context.js';
import type { AltLocation, BriefRenderInput, LongRangeCard } from './brief.js';
import type { SessionRecommendationSummary } from './session-score.js';

type SharedBriefFields = Omit<
  BriefRenderInput,
  'aiText'
  | 'compositionBullets'
  | 'weekInsight'
  | 'spurOfTheMoment'
  | 'geminiInspire'
  | 'location'
  | 'altLocations'
  | 'noAltsMsg'
  | 'metarNote'
  | 'shSunsetText'
  | 'debugContext'
>;

export interface ScoredForecastContext extends SharedBriefFields {
  altLocations?: AltLocation[];
  noAltsMsg?: string | null;
  metarNote: string;
  shSunsetText: string | null;
  sessionRecommendation?: SessionRecommendationSummary;
  debugContext: DebugContext;
  longRangeCandidates?: LongRangeCard[];
  longRangeDebugCandidates?: DebugLongRangeCandidate[];
}
