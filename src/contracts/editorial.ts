/**
 * Public contract surface for editorial resolution types.
 *
 * This module exports types shared across app, domain, presenters, and adapters.
 * Import from here rather than from internal implementation paths.
 */

export type {
  BriefContext,
  EditorialCandidatePayload,
  EditorialGatewayOutcome,
  EditorialGatewayParseState,
  EditorialGatewayPayload,
  EditorialGatewayResult,
  EditorialParseResult,
  GeminiEditorialGatewayResult,
  LongRangeSpurCandidate,
  GroqEditorialGatewayResult,
  ResolveEditorialInput,
  ResolveEditorialOutput,
} from '../domain/editorial/resolution/resolve-editorial.js';

export type { SpurSuggestion } from '../app/run-photo-brief/contracts.js';
