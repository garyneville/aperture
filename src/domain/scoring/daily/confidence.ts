/**
 * Ensemble confidence calculation for daily scoring.
 *
 * Computes confidence levels (high/medium/low/unknown) based on ensemble spread
 * for different time-of-day sessions (AM, PM, astro/night).
 */

export interface EnsEntry {
  mean: number;
  stdDev: number;
}

export interface ConfidenceResult {
  confidence: string;
  confidenceStdDev: number | null;
}

/**
 * Compute confidence from a list of ensemble entries.
 * High: stdDev < 15, Medium: 15–29, Low: 30–39, Very Low: stdDev >= 40
 */
function computeFromEnsemble(ens: EnsEntry[]): ConfidenceResult {
  if (!ens.length) return { confidence: 'unknown', confidenceStdDev: null };
  const avgStdDev = ens.reduce((s, e) => s + e.stdDev, 0) / ens.length;
  return {
    confidence: avgStdDev < 15 ? 'high' : avgStdDev < 30 ? 'medium' : avgStdDev < 40 ? 'low' : 'very-low',
    confidenceStdDev: Math.round(avgStdDev),
  };
}

export interface SessionBoundaries {
  goldAmS: Date;
  goldAmE: Date;
  goldPmS: Date;
  goldPmE: Date;
  blueAmS: Date;
  bluePmE: Date;
}

export interface ConfidenceInput {
  dateKey: string;
  byDate: Record<string, { ts: string; i: number }[]>;
  ensIdx: Record<string, EnsEntry>;
  boundaries: SessionBoundaries;
}

export interface SessionConfidence {
  am: ConfidenceResult;
  pm: ConfidenceResult;
  astro: ConfidenceResult;
  overall: ConfidenceResult;
}

/**
 * Compute confidence for all sessions (AM, PM, astro) and overall golden-hour confidence.
 */
export function computeConfidence(input: ConfidenceInput): SessionConfidence {
  const { dateKey, byDate, ensIdx, boundaries } = input;
  const { goldAmS, goldAmE, goldPmS, goldPmE, blueAmS, bluePmE } = boundaries;

  const dayEntries = byDate[dateKey] || [];

  // AM golden hour timestamps
  const amTimesEns = dayEntries
    .filter(({ ts }) => {
      const t = new Date(ts);
      return t >= goldAmS && t <= goldAmE;
    })
    .map(({ ts }) => ts);

  // PM golden hour timestamps
  const pmTimesEns = dayEntries
    .filter(({ ts }) => {
      const t = new Date(ts);
      return t >= goldPmS && t <= goldPmE;
    })
    .map(({ ts }) => ts);

  // Night/astro timestamps (outside blue hours)
  const nightTimesEns = dayEntries
    .filter(({ ts }) => {
      const t = new Date(ts);
      return t < blueAmS || t > bluePmE;
    })
    .map(({ ts }) => ts);

  // Overall golden hour confidence (AM + PM combined)
  const goldTimes = [...amTimesEns, ...pmTimesEns];
  const goldEns = goldTimes.map(ts => ensIdx[ts]).filter(Boolean) as EnsEntry[];

  return {
    am: computeFromEnsemble(amTimesEns.map(ts => ensIdx[ts]).filter(Boolean) as EnsEntry[]),
    pm: computeFromEnsemble(pmTimesEns.map(ts => ensIdx[ts]).filter(Boolean) as EnsEntry[]),
    astro: computeFromEnsemble(nightTimesEns.map(ts => ensIdx[ts]).filter(Boolean) as EnsEntry[]),
    overall: computeFromEnsemble(goldEns),
  };
}
