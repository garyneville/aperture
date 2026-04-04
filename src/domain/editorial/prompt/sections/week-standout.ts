export function weekStandoutSchemaHint(): string {
  return '<1 sentence max 30 words — if one day scores clearly higher, call it standout; if today wins only on certainty while another day scores higher, call it most reliable and name the higher-scoring day>';
}

export function weekStandoutInstructionBlock(): string {
  return `WEEK STANDOUT (1 sentence, max 30 words):
If one day scores clearly higher than others, call it the "standout" day.
If today wins only on certainty (lower spread) while another day scores higher, call today the "most reliable" day and briefly name the higher-scoring day with its uncertainty (e.g. "Today is the most reliable forecast; Wednesday may score higher but with much lower certainty").
Use only the supplied 5-day outlook labels, scores, and spreads. Do not invent a different higher-scoring day.`;
}

/**
 * Alias for weekStandoutInstructionBlock to match the naming convention
 * used by other prompt block builder functions.
 */
export function buildWeekStandoutInstructions(): string {
  return weekStandoutInstructionBlock();
}
