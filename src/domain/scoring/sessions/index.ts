import type {
  DerivedHourFeatures,
  SessionEvaluator,
  SessionHourSelection,
  SessionId,
  SessionRecommendation,
  SessionRecommendationSummary,
  SessionScore,
} from '../../../types/session-score.js';
import { goldenHourEvaluator } from './evaluators/golden-hour.js';
import { astroEvaluator } from './evaluators/astro.js';
import { mistEvaluator } from './evaluators/mist.js';
import { stormEvaluator } from './evaluators/storm.js';
import { longExposureEvaluator } from './evaluators/long-exposure.js';
import { urbanEvaluator } from './evaluators/urban.js';
import { wildlifeEvaluator } from './evaluators/wildlife.js';

const BUILT_IN_SESSION_EVALUATORS: SessionEvaluator[] = [
  goldenHourEvaluator,
  astroEvaluator,
  mistEvaluator,
  stormEvaluator,
  longExposureEvaluator,
  urbanEvaluator,
  wildlifeEvaluator,
];

export function getBuiltInSessionEvaluators(): SessionEvaluator[] {
  return [...BUILT_IN_SESSION_EVALUATORS];
}

export function getSessionEvaluator(session: SessionId): SessionEvaluator | undefined {
  return BUILT_IN_SESSION_EVALUATORS.find(evaluator => evaluator.session === session);
}

export function evaluateSessionFeatures(session: SessionId, features: DerivedHourFeatures): SessionScore {
  const evaluator = getSessionEvaluator(session);
  if (!evaluator) {
    throw new Error(`Unknown session evaluator: ${session}`);
  }
  return evaluator.evaluateHour(features);
}

export function evaluateBuiltInSessions(features: DerivedHourFeatures): SessionScore[] {
  return BUILT_IN_SESSION_EVALUATORS
    .map(evaluator => evaluator.evaluateHour(features))
    .sort((a, b) => b.score - a.score);
}

export function selectBestSessionScore(scores: SessionScore[]): SessionScore | null {
  return scores.reduce<SessionScore | null>((best, score) => {
    if (!best) return score;
    return score.score > best.score ? score : best;
  }, null);
}

export function selectBestBuiltInSession(features: DerivedHourFeatures): SessionScore | null {
  return selectBestSessionScore(evaluateBuiltInSessions(features));
}

export function selectBestSessionAcrossHours(hours: DerivedHourFeatures[]): SessionHourSelection | null {
  return hours.reduce<SessionHourSelection | null>((best, hour) => {
    const sessionScore = selectBestBuiltInSession(hour);
    if (!sessionScore) return best;
    const candidate: SessionHourSelection = { ...sessionScore, hourLabel: hour.hourLabel };
    if (!best) return candidate;
    return candidate.score > best.score ? candidate : best;
  }, null);
}

export function summarizeSessionRecommendations(hours: DerivedHourFeatures[]): SessionRecommendationSummary {
  const bestBySession = new Map<SessionId, SessionRecommendation>();

  for (const hour of hours) {
    for (const score of evaluateBuiltInSessions(hour)) {
      const candidate: SessionRecommendation = { ...score, hourLabel: hour.hourLabel };
      const current = bestBySession.get(score.session);
      if (!current || candidate.score > current.score) {
        bestBySession.set(score.session, candidate);
      }
    }
  }

  const bySession = [...bestBySession.values()].sort((a, b) => b.score - a.score);
  return {
    primary: bySession[0] ?? null,
    runnerUps: bySession.slice(1),
    bySession,
    hoursAnalyzed: hours.length,
  };
}
