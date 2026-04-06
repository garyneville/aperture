/**
 * Controlled phrasebook — threshold-to-word mappings for consistent
 * numeric-to-language translation in editorial prompts.
 *
 * These descriptors are injected into the prompt context so the LLM
 * sees pre-mapped words alongside raw numbers, reducing arbitrary
 * variation in how it describes conditions.
 *
 * @see https://github.com/garyneville/aperture/issues/226
 */

// ── Wind ────────────────────────────────────────────────────────
export function windDescriptor(kph: number): string {
  if (kph < 5) return 'calm';
  if (kph < 10) return 'light winds';
  if (kph < 25) return 'breezy';
  if (kph < 40) return 'strong winds';
  return 'gale risk';
}

// ── Cloud cover (%) ─────────────────────────────────────────────
export function cloudDescriptor(pct: number): string {
  if (pct < 10) return 'clear';
  if (pct < 30) return 'mostly clear';
  if (pct < 60) return 'partly cloudy';
  if (pct < 85) return 'mostly cloudy';
  return 'overcast';
}

// ── Visibility (km) ─────────────────────────────────────────────
export function visibilityDescriptor(km: number): string {
  if (km >= 30) return 'exceptional visibility';
  if (km >= 15) return 'good visibility';
  if (km >= 8) return 'moderate visibility';
  if (km >= 3) return 'poor visibility';
  return 'very poor visibility';
}

// ── Overall score quality ───────────────────────────────────────
export function scoreDescriptor(score: number): string {
  if (score < 25) return 'poor';
  if (score < 40) return 'modest';
  if (score < 55) return 'decent';
  if (score < 70) return 'good';
  if (score < 85) return 'strong';
  return 'exceptional';
}

// ── Confidence ──────────────────────────────────────────────────
export function confidenceDescriptor(confidence: string): string {
  if (confidence === 'high') return 'high confidence';
  if (confidence === 'medium') return 'fair confidence';
  if (confidence === 'low') return 'low confidence';
  if (confidence === 'very-low') return 'very low confidence';
  return 'unknown confidence';
}

// ── Aggregate context line for prompt injection ─────────────────
export interface PhrasebookContext {
  windKph: number;
  cloudPct: number;
  visKm: number;
  score: number;
  confidence: string;
}

export function buildPhrasebookLine(ctx: PhrasebookContext): string {
  return [
    `Conditions summary: ${scoreDescriptor(ctx.score)} (${ctx.score}/100)`,
    `${windDescriptor(ctx.windKph)} (${ctx.windKph} km/h)`,
    `${cloudDescriptor(ctx.cloudPct)} (${ctx.cloudPct}%)`,
    `${visibilityDescriptor(ctx.visKm)} (${Math.round(ctx.visKm)} km)`,
    `${confidenceDescriptor(ctx.confidence)}`,
  ].join(', ');
}
