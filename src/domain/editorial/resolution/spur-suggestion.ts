import { LONG_RANGE_LOCATIONS, estimatedDriveMins } from '../../../lib/long-range-locations.js';
import type { SpurSuggestion } from '../../../app/run-photo-brief/contracts.js';
import type {
  LongRangeSpurCandidate,
  SpurRaw,
} from './types.js';

export function resolveSpurSuggestion(
  spurRaw: SpurRaw | null,
  nearbyAltNames: string[] = [],
  longRangePool: LongRangeSpurCandidate[] = [],
): SpurSuggestion | null {
  if (!spurRaw || spurRaw.confidence < 0.7) return null;
  const loc = LONG_RANGE_LOCATIONS.find(location => location.name === spurRaw.locationName);
  if (!loc) return null;
  if (nearbyAltNames.includes(loc.name)) return null;
  const longRangeCandidate = longRangePool.find(candidate => candidate?.name === loc.name);
  if (longRangeCandidate?.shown === true) return null;
  if (typeof longRangeCandidate?.discardedReason === 'string' && longRangeCandidate.discardedReason.trim().length > 0) {
    return null;
  }
  return {
    locationName: loc.name,
    region: loc.region,
    driveMins: estimatedDriveMins(loc),
    tags: loc.tags,
    darkSky: loc.darkSky,
    hookLine: spurRaw.hookLine,
    confidence: spurRaw.confidence,
  };
}

export function resolveSpurDropReason(
  spurRaw: SpurRaw | null,
  nearbyAltNames: string[] = [],
  longRangePool: LongRangeSpurCandidate[] = [],
): string | undefined {
  if (!spurRaw) return undefined;
  if (spurRaw.confidence < 0.7) return `confidence below threshold (${spurRaw.confidence})`;
  if (nearbyAltNames.includes(spurRaw.locationName)) {
    return 'already scored in nearby alternatives';
  }
  const longRangeCandidate = longRangePool.find(candidate => candidate?.name === spurRaw.locationName);
  if (longRangeCandidate?.shown === true) {
    return 'already shown in long-range recommendations';
  }
  if (typeof longRangeCandidate?.discardedReason === 'string' && longRangeCandidate.discardedReason.trim().length > 0) {
    return `long-range candidate rejected: ${longRangeCandidate.discardedReason}`;
  }
  if (!LONG_RANGE_LOCATIONS.find(location => location.name === spurRaw.locationName)) {
    return 'location not found in approved long-range list';
  }
  return undefined;
}
