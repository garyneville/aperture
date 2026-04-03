export function auroraVisibleKpThresholdForLat(lat: number): number {
  if (lat >= 57) return 5;
  if (lat >= 53.5) return 6;
  if (lat >= 50) return 7;
  return 8;
}

export function isAuroraLikelyVisibleAtLat(
  lat: number,
  kp: number | null | undefined,
): boolean {
  return typeof kp === 'number' && kp >= auroraVisibleKpThresholdForLat(lat);
}
