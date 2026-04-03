export const SEASONAL_CONTEXT: Record<number, string> = {
  1:  'January — frost and snow possible on high ground; bare trees; frozen reservoirs.',
  2:  'February — snowdrops in woodland; low sun angle throughout the day.',
  3:  'March — early spring; blossom building; frost on clear nights still likely.',
  4:  'April — bluebells peak late month; lambs in the Dales; dramatic cloud building.',
  5:  'May — full canopy; bluebells finishing; long golden hour windows.',
  6:  'June — longest days; very late sunsets (~21:30); short nights limit astro.',
  7:  'July — summer haze; heather not yet out; long blue hours.',
  8:  'August — heather on the moors; Perseid meteor shower mid-month.',
  9:  'September — golden light returns; mist in valleys from temperature swings.',
  10: 'October — autumn colour; low sun, long shadows; morning frosts returning.',
  11: 'November — bare trees re-emerging; dramatic skies; short days.',
  12: 'December — winter light; snow possible on Pennines; very short days.',
};

export function getSeasonalNote(month: number): string {
  return SEASONAL_CONTEXT[month] || '';
}
