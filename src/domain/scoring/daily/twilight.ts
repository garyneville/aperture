/**
 * Twilight and golden/blue hour boundary calculations.
 *
 * Derives session time boundaries from SunsetHue data and sunrise/sunset times.
 */

import type { SunsetHueEntry } from '../contracts.js';

export interface TwilightBoundaries {
  /** Golden hour AM start */
  goldAmS: Date;
  /** Golden hour AM end */
  goldAmE: Date;
  /** Golden hour PM start */
  goldPmS: Date;
  /** Golden hour PM end */
  goldPmE: Date;
  /** Blue hour AM start */
  blueAmS: Date;
  /** Blue hour PM end */
  bluePmE: Date;
  /** Quality score 0-1 for sunrise (null if no data) */
  shSunriseQ: number | null;
  /** Quality score 0-1 for sunset (null if no data) */
  shSunsetQ: number | null;
  /** Text description of sunset quality */
  shSunsetText: string | null;
  /** Sun direction in degrees (null if no data) */
  sunDirection: number | null;
  /** Golden hour AM duration in minutes */
  goldAmMins: number;
  /** Golden hour PM duration in minutes */
  goldPmMins: number;
  /** Total golden hour duration bonus (0-8 points) */
  durationBonus: number;
}

export interface TwilightInput {
  dateKey: string;
  sunriseD: Date;
  sunsetD: Date;
  shByDay: Record<string, SunsetHueEntry>;
}

/**
 * Compute twilight session boundaries and related metadata.
 *
 * Uses SunsetHue data when available, falls back to reasonable defaults
 * based on sunrise/sunset times.
 */
export function computeTwilightBoundaries(input: TwilightInput): TwilightBoundaries {
  const { dateKey, sunriseD, sunsetD, shByDay } = input;

  const shSunrise = shByDay[`${dateKey}_sunrise`];
  const shSunset = shByDay[`${dateKey}_sunset`];

  const shSunriseQ = shSunrise?.quality ?? null;
  const shSunsetQ = shSunset?.quality ?? null;
  const shSunsetText = shSunset?.quality_text || null;

  // Golden hour boundaries - use SunsetHue data or fallback to calculated windows
  const goldAmS = shSunrise?.magics?.golden_hour?.[0]
    ? new Date(shSunrise.magics.golden_hour[0])
    : new Date(+sunriseD - 10 * 60000);

  const goldAmE = shSunrise?.magics?.golden_hour?.[1]
    ? new Date(shSunrise.magics.golden_hour[1])
    : new Date(+sunriseD + 65 * 60000);

  const goldPmS = shSunset?.magics?.golden_hour?.[0]
    ? new Date(shSunset.magics.golden_hour[0])
    : new Date(+sunsetD - 65 * 60000);

  const goldPmE = shSunset?.magics?.golden_hour?.[1]
    ? new Date(shSunset.magics.golden_hour[1])
    : new Date(+sunsetD + 5 * 60000);

  // Blue hour boundaries
  const blueAmS = shSunrise?.magics?.blue_hour?.[0]
    ? new Date(shSunrise.magics.blue_hour[0])
    : new Date(+sunriseD - 30 * 60000);

  const bluePmE = shSunset?.magics?.blue_hour?.[1]
    ? new Date(shSunset.magics.blue_hour[1])
    : new Date(+sunsetD + 30 * 60000);

  // Sun direction from SunsetHue data
  const sunDirection = shSunset?.direction != null
    ? (parseFloat(String(shSunset.direction)) || null)
    : null;

  // Golden hour duration bonus - longer twilight = more opportunity
  // Baseline 90 min total; +1pt per 8 min above that, capped at +8
  const goldAmMins = (+goldAmE - +goldAmS) / 60000;
  const goldPmMins = (+goldPmE - +goldPmS) / 60000;
  const totalGoldMins = goldAmMins + goldPmMins;
  const durationBonus = Math.min(8, Math.round(Math.max(0, (totalGoldMins - 90) / 8)));

  return {
    goldAmS,
    goldAmE,
    goldPmS,
    goldPmE,
    blueAmS,
    bluePmE,
    shSunriseQ,
    shSunsetQ,
    shSunsetText,
    sunDirection,
    goldAmMins: Math.round(goldAmMins),
    goldPmMins: Math.round(goldPmMins),
    durationBonus,
  };
}
