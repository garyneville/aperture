import { describe, expect, it } from 'vitest';
import { deriveHourFeatures, type DerivedHourFeatureInput } from '../features/derive-hour-features.js';
import {
  evaluateBuiltInSessions,
  evaluateSessionFeatures,
  getBuiltInSessionEvaluators,
  selectBestBuiltInSession,
  selectBestSessionAcrossHours,
  summarizeSessionRecommendations,
} from './index.js';

function makeHour(overrides: Partial<DerivedHourFeatureInput> = {}): DerivedHourFeatureInput {
  return {
    hourLabel: '19:00',
    overallScore: 72,
    dramaScore: 78,
    clarityScore: 68,
    mistScore: 20,
    astroScore: 14,
    cloudLowPct: 20,
    cloudMidPct: 30,
    cloudHighPct: 18,
    cloudTotalPct: 52,
    visibilityKm: 24,
    aerosolOpticalDepth: 0.12,
    precipProbabilityPct: 8,
    humidityPct: 66,
    temperatureC: 9,
    dewPointC: 4,
    windKph: 11,
    gustKph: 18,
    windDirectionDeg: null,
    moonIlluminationPct: 12,
    isGolden: true,
    isBlue: false,
    isNight: false,
    tags: ['dramatic sky', 'golden hour'],
    ...overrides,
  };
}

describe('session scoring foundation', () => {
  it('exposes built-in evaluators for the first two session types', () => {
    expect(getBuiltInSessionEvaluators().map(evaluator => evaluator.session)).toEqual([
      'golden-hour',
      'astro',
      'mist',
      'storm',
      'long-exposure',
      'urban',
      'wildlife',
    ]);
  });

  it('works from the shared derived-feature seam', () => {
    const features = deriveHourFeatures(makeHour());

    expect(features.hourLabel).toBe('19:00');
    expect(features.cloudTotalPct).toBe(52);
    expect(features.transparencyScore).toBeGreaterThan(0);
    expect(features.isGolden).toBe(true);
  });

  it('scores a golden-hour session with a hard pass during low-angle light', () => {
    const result = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour()));

    expect(result.hardPass).toBe(true);
    expect(result.score).toBeGreaterThan(60);
    expect(result.reasons).toContain('Broken cloud cover can catch low-angle light well.');
    expect(result.requiredCapabilities).toContain('sun-geometry');
  });

  it('uses azimuth light-path risk to refine golden-hour scoring', () => {
    const clearPath = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      azimuthOcclusionRiskPct: 18,
      clearPathBonusPts: 8,
    })));
    const blockedPath = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      azimuthOcclusionRiskPct: 78,
      clearPathBonusPts: -10,
    })));

    expect(clearPath.score).toBeGreaterThan(blockedPath.score);
    expect(clearPath.reasons).toContain('Low-angle light path looks relatively clear.');
    expect(blockedPath.warnings).toContain('Low-angle light may be blocked near the horizon.');
  });

  it('fails astro hard gates during daylight hours', () => {
    const result = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({ isNight: false, astroScore: 55, cloudTotalPct: 5 })));

    expect(result.hardPass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.warnings).toContain('This hour is not inside a darkness window.');
  });

  it('ranks astro first for a dark, clear hour', () => {
    const sessions = evaluateBuiltInSessions(deriveHourFeatures(makeHour({
      isGolden: false,
      isNight: true,
      astroScore: 86,
      cloudTotalPct: 9,
      cloudLowPct: 4,
      cloudMidPct: 5,
      cloudHighPct: 6,
      visibilityKm: 30,
      humidityPct: 58,
      aerosolOpticalDepth: 0.06,
      moonIlluminationPct: 8,
      tags: ['astrophotography'],
    })));

    expect(sessions[0]?.session).toBe('astro');
    expect(sessions[0]?.hardPass).toBe(true);
    expect(sessions[0]?.confidence).toBe('high');
  });

  it('treats astro cloud spread as a confidence and score penalty', () => {
    const stable = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isGolden: false,
      isNight: true,
      astroScore: 86,
      cloudTotalPct: 9,
      cloudLowPct: 4,
      cloudMidPct: 5,
      cloudHighPct: 6,
      visibilityKm: 30,
      humidityPct: 58,
      aerosolOpticalDepth: 0.06,
      moonIlluminationPct: 8,
      ensembleCloudStdDevPct: 4,
    })));
    const volatile = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isGolden: false,
      isNight: true,
      astroScore: 86,
      cloudTotalPct: 9,
      cloudLowPct: 4,
      cloudMidPct: 5,
      cloudHighPct: 6,
      visibilityKm: 30,
      humidityPct: 58,
      aerosolOpticalDepth: 0.06,
      moonIlluminationPct: 8,
      ensembleCloudStdDevPct: 22,
    })));

    expect(stable.confidence).toBe('high');
    expect(volatile.confidence).toBe('low');
    expect(volatile.volatility).toBe(22);
    expect(volatile.score).toBeLessThan(stable.score);
  });

  it('hard-gates astro when cloud cover exceeds the tightened 60 % cap', () => {
    const result = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true,
      astroScore: 80,
      cloudTotalPct: 65,
      cloudLowPct: 30,
      cloudMidPct: 20,
      cloudHighPct: 15,
      visibilityKm: 25,
      humidityPct: 55,
      aerosolOpticalDepth: 0.06,
      moonIlluminationPct: 10,
    })));

    expect(result.hardPass).toBe(false);
    expect(result.score).toBe(0);
  });

  it('hard-gates astro when transparency is too poor for imaging', () => {
    const result = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true,
      astroScore: 75,
      cloudTotalPct: 10,
      cloudLowPct: 3,
      cloudMidPct: 4,
      cloudHighPct: 5,
      visibilityKm: 3,
      humidityPct: 97,
      aerosolOpticalDepth: 0.32,
      moonIlluminationPct: 5,
    })));

    expect(result.hardPass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.warnings).toContain('Poor transparency will limit deep-sky contrast.');
  });

  it('applies a steeper non-linear cloud penalty as cloud cover rises', () => {
    const low = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 15, cloudLowPct: 5, cloudMidPct: 5, cloudHighPct: 5,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
    })));
    const moderate = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 35, cloudLowPct: 12, cloudMidPct: 12, cloudHighPct: 11,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
    })));
    const high = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 55, cloudLowPct: 20, cloudMidPct: 20, cloudHighPct: 15,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
    })));

    // penalty gap from moderate→high should be larger than low→moderate (non-linear)
    const dropLowToMod = low.score - moderate.score;
    const dropModToHigh = moderate.score - high.score;
    expect(dropModToHigh).toBeGreaterThan(dropLowToMod);
    expect(low.score).toBeGreaterThan(moderate.score);
    expect(moderate.score).toBeGreaterThan(high.score);
  });

  it('penalises bright moonlight more aggressively via the cubic washout curve', () => {
    const dark = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
    })));
    const quarter = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 50,
    })));
    const full = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 95,
    })));

    // cubic curve means nearly-full moon gets hit much harder than quarter moon
    const dropDarkToQuarter = dark.score - quarter.score;
    const dropQuarterToFull = quarter.score - full.score;
    expect(dropQuarterToFull).toBeGreaterThan(dropDarkToQuarter);
    expect(full.warnings).toContain('Bright moonlight will wash out all but the brightest targets.');
  });

  it('rewards high transparency through the sweet-spot curve', () => {
    const goodTransparency = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 30, humidityPct: 50, aerosolOpticalDepth: 0.05, moonIlluminationPct: 10,
    })));
    const poorTransparency = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 12, humidityPct: 82, aerosolOpticalDepth: 0.20, moonIlluminationPct: 10,
    })));

    expect(goodTransparency.score).toBeGreaterThan(poorTransparency.score);
    expect(goodTransparency.reasons).toContain('Transparency looks strong for clean deep-sky contrast.');
  });

  it('penalises astro when a shallow boundary layer traps haze aloft', () => {
    const trapped = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true,
      astroScore: 80,
      cloudTotalPct: 10,
      cloudLowPct: 3,
      cloudMidPct: 4,
      cloudHighPct: 3,
      visibilityKm: 22,
      humidityPct: 84,
      aerosolOpticalDepth: 0.14,
      moonIlluminationPct: 10,
      boundaryLayerHeightM: 220,
    })));
    const mixed = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true,
      astroScore: 80,
      cloudTotalPct: 10,
      cloudLowPct: 3,
      cloudMidPct: 4,
      cloudHighPct: 3,
      visibilityKm: 22,
      humidityPct: 84,
      aerosolOpticalDepth: 0.14,
      moonIlluminationPct: 10,
      boundaryLayerHeightM: 1600,
    })));

    expect(mixed.score).toBeGreaterThan(trapped.score);
    expect(trapped.warnings).toContain('A shallow boundary layer may be trapping haze despite the cloud forecast.');
  });

  it('reduces moon washout penalty when the moon is low on the horizon', () => {
    const highMoon = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 80,
      moonAltitudeDeg: 60,
    })));
    const lowMoon = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 80,
      moonAltitudeDeg: 8,
    })));

    expect(lowMoon.score).toBeGreaterThan(highMoon.score);
    expect(lowMoon.reasons).toContain('Moon is low on the horizon, limiting its sky-glow impact.');
    expect(highMoon.warnings).toContain('Moon is at high altitude — strong sky-glow impact on deep-sky imaging.');
  });

  it('eliminates moon penalty entirely when the moon is below the horizon', () => {
    const moonUp = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 90,
      moonAltitudeDeg: 45,
    })));
    const moonDown = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 90,
      moonAltitudeDeg: -10,
    })));

    expect(moonDown.score).toBeGreaterThan(moonUp.score);
    expect(moonDown.reasons).toContain('Moon is well below the horizon — bright moonlight is not a factor right now.');
  });

  it('rewards good astronomical seeing for sharp star imaging', () => {
    const goodSeeing = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      seeingScore: 82,
    })));
    const poorSeeing = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      seeingScore: 20,
    })));

    expect(goodSeeing.score).toBeGreaterThan(poorSeeing.score);
    expect(goodSeeing.reasons).toContain('Atmospheric seeing looks steady for sharp star imaging.');
    expect(poorSeeing.warnings).toContain('Poor seeing may bloat stars and reduce fine detail in long exposures.');
  });

  it('penalises light-polluted sites and rewards dark-sky locations', () => {
    const darkSite = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      lightPollutionBortle: 2,
    })));
    const suburbanSite = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      lightPollutionBortle: 5,
    })));
    const urbanSite = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      lightPollutionBortle: 8,
    })));

    expect(darkSite.score).toBeGreaterThan(suburbanSite.score);
    expect(suburbanSite.score).toBeGreaterThan(urbanSite.score);
    expect(darkSite.reasons).toContain('Dark-sky site conditions favour faint deep-sky targets.');
    expect(urbanSite.warnings).toContain('Heavy light pollution limits deep-sky imaging to narrowband or bright targets.');
  });

  it('factors seeing and light pollution into astro confidence', () => {
    const ideal = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 86, cloudTotalPct: 9, cloudLowPct: 4, cloudMidPct: 5, cloudHighPct: 6,
      visibilityKm: 30, humidityPct: 58, aerosolOpticalDepth: 0.06, moonIlluminationPct: 8,
      seeingScore: 75, lightPollutionBortle: 3,
    })));
    const degraded = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 86, cloudTotalPct: 9, cloudLowPct: 4, cloudMidPct: 5, cloudHighPct: 6,
      visibilityKm: 30, humidityPct: 58, aerosolOpticalDepth: 0.06, moonIlluminationPct: 8,
      seeingScore: 30, lightPollutionBortle: 7,
    })));

    expect(ideal.confidence).toBe('high');
    expect(degraded.confidence).not.toBe('high');
  });

  it('applies a graduated twilight ramp between nautical and astronomical darkness', () => {
    const fullDark = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      solarAltitudeDeg: -20,
    })));
    const nautical = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      solarAltitudeDeg: -14,
    })));

    expect(fullDark.score).toBeGreaterThan(nautical.score);
    expect(nautical.score).toBeGreaterThan(0); // still gets partial credit
    expect(nautical.warnings).toContain('Late nautical twilight — sky is darkening but not yet at full astronomical darkness.');
  });

  it('derives a seeing proxy from gustiness and boundary-layer data', () => {
    const calm = deriveHourFeatures(makeHour({
      isNight: true, windKph: 3, gustKph: 5, boundaryLayerHeightM: 300, capeJkg: 0,
    }));
    const turbulent = deriveHourFeatures(makeHour({
      isNight: true, windKph: 20, gustKph: 38, boundaryLayerHeightM: 1400, capeJkg: 1200,
    }));

    expect(calm.seeingScore).toBeGreaterThan(turbulent.seeingScore!);
    expect(calm.seeingScore).toBeGreaterThanOrEqual(60);
    expect(turbulent.seeingScore).toBeLessThan(50);
  });

  it('uses derived seeing proxy in astro scoring when no external seeing is provided', () => {
    const calmNight = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      windKph: 3, gustKph: 5, boundaryLayerHeightM: 300, capeJkg: 0,
    })));
    const turbulentNight = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      windKph: 20, gustKph: 38, boundaryLayerHeightM: 1400, capeJkg: 1200,
    })));

    // Calm conditions should score higher because the proxy produces better seeing
    expect(calmNight.score).toBeGreaterThan(turbulentNight.score);
  });

  it('uses the 5-band moon altitude table for more granular penalty scaling', () => {
    const overhead = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 80,
      moonAltitudeDeg: 55,
    })));
    const midAlt = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 80,
      moonAltitudeDeg: 30,
    })));
    const lowAlt = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 80,
      moonAltitudeDeg: 8,
    })));
    const justBelow = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 80,
      moonAltitudeDeg: -3,
    })));
    const wellBelow = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 80,
      moonAltitudeDeg: -15,
    })));

    // Scores should increase as moon moves lower
    expect(lowAlt.score).toBeGreaterThan(midAlt.score);
    expect(midAlt.score).toBeGreaterThan(overhead.score);
    expect(justBelow.score).toBeGreaterThan(lowAlt.score);
    expect(wellBelow.score).toBeGreaterThan(justBelow.score);
  });

  it('applies stepped Bortle penalties aligned with Milky Way visibility thresholds', () => {
    const bortle2 = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      lightPollutionBortle: 2,
    })));
    const bortle4 = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      lightPollutionBortle: 4,
    })));
    const bortle5 = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      lightPollutionBortle: 5,
    })));
    const bortle6 = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true, astroScore: 80, cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2,
      visibilityKm: 28, humidityPct: 55, aerosolOpticalDepth: 0.06, moonIlluminationPct: 10,
      lightPollutionBortle: 6,
    })));

    // Dark sites should score highest, steep drop from Bortle 5→6
    expect(bortle2.score).toBeGreaterThan(bortle4.score);
    expect(bortle4.score).toBeGreaterThan(bortle5.score);
    expect(bortle5.score).toBeGreaterThan(bortle6.score);
    // The Bortle 5→6 gap (marginal → poor for MW) should be larger than 4→5
    expect(bortle5.score - bortle6.score).toBeGreaterThan(bortle4.score - bortle5.score);
    expect(bortle4.reasons).toContain('Rural-transition site is workable for Milky Way imaging.');
    expect(bortle5.warnings).toContain('Milky Way may look washed out; best results from narrowband or bright targets.');
  });

  it('can surface mist as the best-fit session for a fog-prone hour', () => {
    const sessions = evaluateBuiltInSessions(deriveHourFeatures(makeHour({
      overallScore: 48,
      dramaScore: 25,
      clarityScore: 18,
      mistScore: 86,
      astroScore: 0,
      crepuscularScore: 12,
      cloudTotalPct: 92,
      visibilityKm: 4.5,
      aerosolOpticalDepth: 0.08,
      windKph: 4,
      gustKph: 7,
      temperatureC: 6,
      humidityPct: 95,
      dewPointC: 5,
      precipProbabilityPct: 18,
      isGolden: false,
      isBlue: false,
      isNight: false,
      tags: ['mist', 'atmospheric'],
    })));

    expect(sessions[0]?.session).toBe('mist');
    expect(sessions[0]?.hardPass).toBe(true);
    expect(sessions[0]?.reasons).toContain('Visibility is in a useful misty-landscape range.');
  });

  it('prefers photogenic mist over unusably dense fog', () => {
    const photogenic = evaluateSessionFeatures('mist', deriveHourFeatures(makeHour({
      overallScore: 46,
      dramaScore: 24,
      clarityScore: 20,
      mistScore: 84,
      astroScore: 0,
      crepuscularScore: 10,
      cloudTotalPct: 90,
      visibilityKm: 3.5,
      aerosolOpticalDepth: 0.08,
      windKph: 4,
      gustKph: 7,
      temperatureC: 6,
      humidityPct: 96,
      dewPointC: 5.4,
      precipProbabilityPct: 15,
      isGolden: false,
      isBlue: false,
      isNight: false,
      tags: ['mist', 'atmospheric'],
    })));
    const opaque = evaluateSessionFeatures('mist', deriveHourFeatures(makeHour({
      overallScore: 46,
      dramaScore: 24,
      clarityScore: 20,
      mistScore: 84,
      astroScore: 0,
      crepuscularScore: 10,
      cloudTotalPct: 90,
      visibilityKm: 0.3,
      aerosolOpticalDepth: 0.08,
      windKph: 4,
      gustKph: 7,
      temperatureC: 6,
      humidityPct: 99,
      dewPointC: 5.8,
      precipProbabilityPct: 15,
      isGolden: false,
      isBlue: false,
      isNight: false,
      tags: ['mist', 'atmospheric'],
    })));

    expect(photogenic.hardPass).toBe(true);
    expect(photogenic.score).toBeGreaterThan(opaque.score);
    expect(photogenic.reasons).toContain('Visibility is in a useful misty-landscape range.');
    expect(opaque.hardPass).toBe(false);
    expect(opaque.warnings).toContain('Fog may be too dense for layered scenery rather than simply atmospheric.');
  });

  it('uses boundary-layer depth as an optional mist persistence signal when present', () => {
    const trapped = evaluateSessionFeatures('mist', deriveHourFeatures(makeHour({
      overallScore: 46,
      dramaScore: 24,
      clarityScore: 20,
      mistScore: 78,
      astroScore: 0,
      crepuscularScore: 10,
      cloudTotalPct: 88,
      visibilityKm: 4,
      aerosolOpticalDepth: 0.08,
      windKph: 5,
      gustKph: 8,
      temperatureC: 5,
      humidityPct: 95,
      dewPointC: 4.5,
      precipProbabilityPct: 10,
      boundaryLayerHeightM: 220,
      isGolden: false,
      isBlue: false,
      isNight: false,
      tags: ['mist', 'atmospheric'],
    })));
    const mixedOut = evaluateSessionFeatures('mist', deriveHourFeatures(makeHour({
      overallScore: 46,
      dramaScore: 24,
      clarityScore: 20,
      mistScore: 78,
      astroScore: 0,
      crepuscularScore: 10,
      cloudTotalPct: 88,
      visibilityKm: 4,
      aerosolOpticalDepth: 0.08,
      windKph: 5,
      gustKph: 8,
      temperatureC: 5,
      humidityPct: 95,
      dewPointC: 4.5,
      precipProbabilityPct: 10,
      boundaryLayerHeightM: 1600,
      isGolden: false,
      isBlue: false,
      isNight: false,
      tags: ['mist', 'atmospheric'],
    })));

    expect(trapped.score).toBeGreaterThan(mixedOut.score);
    expect(trapped.reasons).toContain('A low boundary layer should help mist or haze stay trapped near the ground.');
    expect(mixedOut.warnings).toContain('A deep boundary layer may mix out low-level mist before it becomes photogenic.');
  });

  it('can surface storm as the best-fit session for a dramatic showery setup', () => {
    const result = selectBestBuiltInSession(deriveHourFeatures(makeHour({
      overallScore: 64,
      dramaScore: 88,
      clarityScore: 36,
      mistScore: 10,
      astroScore: 0,
      crepuscularScore: 58,
      cloudTotalPct: 74,
      visibilityKm: 16,
      aerosolOpticalDepth: 0.14,
      precipProbabilityPct: 52,
      humidityPct: 82,
      windKph: 22,
      gustKph: 34,
      isGolden: true,
      isBlue: false,
      isNight: false,
      azimuthOcclusionRiskPct: 20,
      clearPathBonusPts: 8,
      capeJkg: 1800,
      lightningRisk: 28,
      tags: ['dramatic sky', 'crepuscular rays'],
    })));

    expect(result?.session).toBe('storm');
    expect(result?.hardPass).toBe(true);
    expect(result?.reasons).toContain('Cloud structure and illumination already look storm-friendly.');
    expect(result?.reasons).toContain('The sun-side gap looks open enough for edge-lit breaks.');
  });

  it('treats storm spread as volatility instead of a flat negative', () => {
    const stable = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      overallScore: 52,
      dramaScore: 72,
      clarityScore: 34,
      mistScore: 10,
      astroScore: 0,
      crepuscularScore: 36,
      cloudTotalPct: 74,
      visibilityKm: 16,
      aerosolOpticalDepth: 0.14,
      precipProbabilityPct: 52,
      humidityPct: 82,
      windKph: 22,
      gustKph: 34,
      isGolden: true,
      isBlue: false,
      isNight: false,
      capeJkg: 1800,
      lightningRisk: 28,
      ensembleCloudStdDevPct: 4,
      tags: ['dramatic sky', 'crepuscular rays'],
    })));
    const volatile = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      overallScore: 52,
      dramaScore: 72,
      clarityScore: 34,
      mistScore: 10,
      astroScore: 0,
      crepuscularScore: 36,
      cloudTotalPct: 74,
      visibilityKm: 16,
      aerosolOpticalDepth: 0.14,
      precipProbabilityPct: 52,
      humidityPct: 82,
      windKph: 22,
      gustKph: 34,
      isGolden: true,
      isBlue: false,
      isNight: false,
      capeJkg: 1800,
      lightningRisk: 28,
      ensembleCloudStdDevPct: 18,
      tags: ['dramatic sky', 'crepuscular rays'],
    })));

    expect(stable.confidence).toBe('high');
    expect(volatile.confidence).toBe('medium');
    expect(volatile.volatility).toBe(18);
    expect(volatile.score).toBeGreaterThanOrEqual(stable.score);
  });

  it('can select the strongest session across multiple candidate hours', () => {
    const result = selectBestSessionAcrossHours([
      deriveHourFeatures(makeHour({
        hourLabel: '06:00',
        overallScore: 42,
        dramaScore: 28,
        clarityScore: 18,
        mistScore: 80,
        visibilityKm: 4,
        humidityPct: 95,
        temperatureC: 5,
        dewPointC: 4,
        windKph: 3,
        isGolden: false,
      })),
      deriveHourFeatures(makeHour({
        hourLabel: '19:00',
        overallScore: 64,
        dramaScore: 88,
        clarityScore: 36,
        mistScore: 10,
        astroScore: 0,
        crepuscularScore: 58,
        cloudTotalPct: 74,
        visibilityKm: 16,
        aerosolOpticalDepth: 0.14,
        precipProbabilityPct: 52,
        humidityPct: 82,
        windKph: 22,
        gustKph: 34,
        isGolden: true,
        isBlue: false,
        isNight: false,
        capeJkg: 1800,
        lightningRisk: 28,
        tags: ['dramatic sky', 'crepuscular rays'],
      })),
    ]);

    expect(result?.session).toBe('storm');
    expect(result?.hourLabel).toBe('19:00');
  });

  it('golden-hour bell-curve: broken cloud scores higher than clear sky or overcast', () => {
    const broken = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ cloudTotalPct: 50, cloudLowPct: 15, cloudMidPct: 20, cloudHighPct: 15 })));
    const clear  = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2 })));
    const overcast = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ cloudTotalPct: 95, cloudLowPct: 40, cloudMidPct: 30, cloudHighPct: 25 })));

    expect(broken.score).toBeGreaterThan(clear.score);
    expect(broken.score).toBeGreaterThan(overcast.score);
    expect(broken.reasons).toContain('Broken cloud cover can catch low-angle light well.');
    expect(clear.warnings).toContain('Clear sky may lack the cloud texture needed for dramatic colour.');
    expect(overcast.warnings).toContain('Featureless overcast may flatten the light.');
  });

  it('golden-hour azimuth penalty scales smoothly with occlusion risk', () => {
    const low    = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ azimuthOcclusionRiskPct: 20, clearPathBonusPts: 4 })));
    const medium = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ azimuthOcclusionRiskPct: 50, clearPathBonusPts: 0 })));
    const high   = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ azimuthOcclusionRiskPct: 80, clearPathBonusPts: -5 })));

    expect(low.score).toBeGreaterThan(medium.score);
    expect(medium.score).toBeGreaterThan(high.score);
  });

  it('golden-hour scores an open horizon gap above a narrow one', () => {
    const openGap = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      azimuthOcclusionRiskPct: 35,
      clearPathBonusPts: 0,
      horizonGapPct: 78,
    })));
    const narrowGap = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      azimuthOcclusionRiskPct: 35,
      clearPathBonusPts: 0,
      horizonGapPct: 18,
    })));

    expect(openGap.score).toBeGreaterThan(narrowGap.score);
    expect(openGap.reasons).toContain('The horizon gap looks open enough for low-angle light to reach the scene.');
    expect(narrowGap.warnings).toContain('The horizon gap looks narrow for reliable low-angle light.');
  });

  it('golden-hour prefers translucent upper cloud over dense low blocking cloud at the same total cover', () => {
    const translucent = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      cloudTotalPct: 58,
      cloudLowPct: 6,
      cloudMidPct: 16,
      cloudHighPct: 48,
    })));
    const blocked = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      cloudTotalPct: 58,
      cloudLowPct: 34,
      cloudMidPct: 12,
      cloudHighPct: 12,
    })));

    expect(translucent.score).toBeGreaterThan(blocked.score);
    expect(translucent.reasons).toContain('Upper cloud looks thin enough to catch colour without sealing the sky.');
    expect(blocked.warnings).toContain('Dense low cloud may block the sun-side glow before it reaches the scene.');
  });

  it('penalises golden-hour scenes when a shallow boundary layer traps haze', () => {
    const trapped = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      cloudTotalPct: 50,
      cloudLowPct: 15,
      cloudMidPct: 20,
      cloudHighPct: 15,
      visibilityKm: 18,
      humidityPct: 90,
      aerosolOpticalDepth: 0.16,
      boundaryLayerHeightM: 220,
      azimuthOcclusionRiskPct: 20,
      clearPathBonusPts: 4,
    })));
    const mixed = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      cloudTotalPct: 50,
      cloudLowPct: 15,
      cloudMidPct: 20,
      cloudHighPct: 15,
      visibilityKm: 18,
      humidityPct: 90,
      aerosolOpticalDepth: 0.16,
      boundaryLayerHeightM: 1600,
      azimuthOcclusionRiskPct: 20,
      clearPathBonusPts: 4,
    })));

    expect(mixed.score).toBeGreaterThan(trapped.score);
    expect(trapped.warnings).toContain('A shallow boundary layer may trap haze and flatten distant contrast.');
  });

  it('storm bell-curve: moderate precip scores higher than dry or heavy rain', () => {
    const moderate = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 75, crepuscularScore: 40, cloudTotalPct: 65, precipProbabilityPct: 45,
      isGolden: true, windKph: 15,
    })));
    const dry = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 75, crepuscularScore: 40, cloudTotalPct: 65, precipProbabilityPct: 5,
      isGolden: true, windKph: 15,
    })));
    const heavy = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 75, crepuscularScore: 40, cloudTotalPct: 65, precipProbabilityPct: 95,
      isGolden: true, windKph: 15,
    })));

    expect(moderate.score).toBeGreaterThan(dry.score);
    expect(moderate.score).toBeGreaterThan(heavy.score);
    expect(moderate.reasons).toContain('Showery conditions could support rain shafts or fast-changing breaks.');
  });

  it('storm scores zero in dry calm conditions with no convective activity', () => {
    const calm = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 78, crepuscularScore: 61, cloudTotalPct: 40, precipProbabilityPct: 0,
      windKph: 9, gustKph: 14, isGolden: true, capeJkg: undefined, lightningRisk: undefined,
    })));

    expect(calm.score).toBe(0);
    expect(calm.hardPass).toBe(false);
    expect(calm.warnings).toContain('No precipitation, wind, or convective activity to support a storm session.');
  });

  it('storm drama-cloud synergy peaks in partial cloud, not in full overcast', () => {
    const partial = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 82, cloudTotalPct: 60, precipProbabilityPct: 45,
      isGolden: true, windKph: 18, crepuscularScore: 44,
    })));
    const overcast = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 82, cloudTotalPct: 92, precipProbabilityPct: 45,
      isGolden: true, windKph: 18, crepuscularScore: 44,
    })));

    expect(partial.score).toBeGreaterThan(overcast.score);
    expect(partial.reasons).toContain('Partial cloud should let dramatic breaks develop rather than flatten the scene.');
    expect(overcast.warnings).toContain('Dense overcast could flatten the scene before breaks appear.');
  });

  it('storm edge-lighting prefers a usable horizon gap during low-angle sessions', () => {
    const openGap = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 82,
      cloudTotalPct: 68,
      precipProbabilityPct: 45,
      isGolden: true,
      windKph: 18,
      crepuscularScore: 44,
      azimuthOcclusionRiskPct: 40,
      clearPathBonusPts: 0,
      horizonGapPct: 72,
    })));
    const narrowGap = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 82,
      cloudTotalPct: 68,
      precipProbabilityPct: 45,
      isGolden: true,
      windKph: 18,
      crepuscularScore: 44,
      azimuthOcclusionRiskPct: 40,
      clearPathBonusPts: 0,
      horizonGapPct: 18,
    })));

    expect(openGap.score).toBeGreaterThan(narrowGap.score);
    expect(openGap.reasons).toContain('A usable horizon gap should help edge-lighting break through.');
    expect(narrowGap.warnings).toContain('A narrow horizon gap may choke off edge-lighting even if cloud structure looks active.');
  });

  it('storm scoring prefers layered storm cloud over a low stratus lid at the same total cover', () => {
    const layered = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 82,
      cloudTotalPct: 72,
      cloudLowPct: 18,
      cloudMidPct: 24,
      cloudHighPct: 30,
      precipProbabilityPct: 45,
      isGolden: true,
      windKph: 18,
      crepuscularScore: 44,
    })));
    const flatLid = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 82,
      cloudTotalPct: 72,
      cloudLowPct: 44,
      cloudMidPct: 16,
      cloudHighPct: 12,
      precipProbabilityPct: 45,
      isGolden: true,
      windKph: 18,
      crepuscularScore: 44,
    })));

    expect(layered.score).toBeGreaterThan(flatLid.score);
    expect(layered.reasons).toContain('Cloud depth looks thick enough for drama without sealing the whole sky.');
    expect(flatLid.warnings).toContain('Dense low cloud could turn the storm sky flat instead of edge-lit.');
  });

  it('astro tolerates a thin high veil better than low blocking cloud at the same total cover', () => {
    const thinVeil = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true,
      isGolden: false,
      isBlue: false,
      cloudTotalPct: 22,
      cloudLowPct: 4,
      cloudMidPct: 8,
      cloudHighPct: 22,
      astroScore: 82,
      moonIlluminationPct: 8,
      visibilityKm: 28,
      humidityPct: 62,
      aerosolOpticalDepth: 0.07,
    })));
    const lowDeck = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isNight: true,
      isGolden: false,
      isBlue: false,
      cloudTotalPct: 22,
      cloudLowPct: 20,
      cloudMidPct: 2,
      cloudHighPct: 2,
      astroScore: 82,
      moonIlluminationPct: 8,
      visibilityKm: 28,
      humidityPct: 62,
      aerosolOpticalDepth: 0.07,
    })));

    expect(thinVeil.score).toBeGreaterThan(lowDeck.score);
    expect(thinVeil.reasons).toContain('Any remaining cloud looks like a thin veil rather than a solid deck.');
    expect(lowDeck.warnings).toContain('Dense low cloud is a bigger risk than the raw cloud-cover total suggests.');
  });

  it('summarizes per-session recommendations without duplicate session winners', () => {
    const summary = summarizeSessionRecommendations([
      deriveHourFeatures(makeHour({
        hourLabel: '06:00',
        overallScore: 42,
        dramaScore: 28,
        clarityScore: 18,
        mistScore: 80,
        visibilityKm: 4,
        humidityPct: 95,
        temperatureC: 5,
        dewPointC: 4,
        windKph: 3,
        isGolden: false,
      })),
      deriveHourFeatures(makeHour({
        hourLabel: '19:00',
        overallScore: 64,
        dramaScore: 88,
        clarityScore: 36,
        mistScore: 10,
        astroScore: 0,
        crepuscularScore: 58,
        cloudTotalPct: 74,
        visibilityKm: 16,
        aerosolOpticalDepth: 0.14,
        precipProbabilityPct: 52,
        humidityPct: 82,
        windKph: 22,
        gustKph: 34,
        isGolden: true,
        isBlue: false,
        isNight: false,
        azimuthOcclusionRiskPct: 20,
        clearPathBonusPts: 8,
        capeJkg: 1800,
        lightningRisk: 28,
        tags: ['dramatic sky', 'crepuscular rays'],
      })),
    ]);

    expect(summary.primary?.session).toBe('storm');
    expect(summary.primary?.hourLabel).toBe('19:00');
    expect(summary.hoursAnalyzed).toBe(2);
    expect(summary.bySession.map(entry => entry.session)).toEqual(['storm', 'long-exposure', 'mist', 'golden-hour', 'urban', 'wildlife', 'astro']);
    expect(summary.runnerUps[0]?.session).toBe('long-exposure');
  });

  it('scores long-exposure highly in calm atmospheric conditions', () => {
    const result = evaluateSessionFeatures('long-exposure', deriveHourFeatures(makeHour({
      overallScore: 50,
      dramaScore: 30,
      mistScore: 60,
      cloudTotalPct: 55,
      visibilityKm: 8,
      aerosolOpticalDepth: 0.1,
      windKph: 4,
      gustKph: 8,
      humidityPct: 88,
      precipProbabilityPct: 10,
      isGolden: false,
      isBlue: true,
      tags: ['atmospheric'],
    })));

    expect(result.hardPass).toBe(true);
    expect(result.score).toBeGreaterThan(65);
    expect(result.reasons).toContain('Calm winds are ideal for tripod stability and smooth exposures.');
    expect(result.reasons).toContain('Low-angle light can produce dramatic long-exposure colour.');
    expect(result.requiredCapabilities).toContain('wind');
  });

  it('hard-gates long-exposure when wind is too high', () => {
    const result = evaluateSessionFeatures('long-exposure', deriveHourFeatures(makeHour({
      windKph: 35,
      gustKph: 50,
    })));

    expect(result.hardPass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.warnings).toContain('Wind or gust levels are too high for reliable long-exposure work.');
  });

  it('penalizes long-exposure for moderate wind and gusts', () => {
    const calm = evaluateSessionFeatures('long-exposure', deriveHourFeatures(makeHour({
      windKph: 5,
      gustKph: 10,
      cloudTotalPct: 55,
      humidityPct: 80,
    })));
    const windy = evaluateSessionFeatures('long-exposure', deriveHourFeatures(makeHour({
      windKph: 22,
      gustKph: 32,
      cloudTotalPct: 55,
      humidityPct: 80,
    })));

    expect(calm.score).toBeGreaterThan(windy.score);
    expect(windy.warnings).toContain('Wind may cause camera shake or tripod vibration on longer exposures.');
    expect(windy.warnings).toContain('Gusts could introduce intermittent vibration during exposures.');
  });

  it('treats long-exposure cloud spread as an uncertainty penalty', () => {
    const stable = evaluateSessionFeatures('long-exposure', deriveHourFeatures(makeHour({
      windKph: 5,
      gustKph: 10,
      cloudTotalPct: 55,
      humidityPct: 80,
      ensembleCloudStdDevPct: 5,
    })));
    const volatile = evaluateSessionFeatures('long-exposure', deriveHourFeatures(makeHour({
      windKph: 5,
      gustKph: 10,
      cloudTotalPct: 55,
      humidityPct: 80,
      ensembleCloudStdDevPct: 22,
    })));

    expect(stable.confidence).toBe('high');
    expect(volatile.confidence).toBe('low');
    expect(volatile.score).toBeLessThan(stable.score);
  });

  it('can surface long-exposure as best session for a calm, misty blue-hour setup', () => {
    const result = selectBestBuiltInSession(deriveHourFeatures(makeHour({
      overallScore: 45,
      dramaScore: 20,
      clarityScore: 22,
      mistScore: 55,
      astroScore: 0,
      crepuscularScore: 18,
      cloudTotalPct: 60,
      visibilityKm: 6,
      aerosolOpticalDepth: 0.12,
      precipProbabilityPct: 5,
      humidityPct: 90,
      temperatureC: 7,
      dewPointC: 6,
      windKph: 3,
      gustKph: 6,
      isGolden: false,
      isBlue: true,
      isNight: false,
      tags: ['atmospheric', 'blue hour'],
    })));

    expect(result?.session).toBe('long-exposure');
    expect(result?.hardPass).toBe(true);
  });

  it('can surface urban as the best-fit session for a wet blue-hour city scene', () => {
    const sessions = evaluateBuiltInSessions(deriveHourFeatures(makeHour({
      overallScore: 40,
      dramaScore: 35,
      clarityScore: 28,
      mistScore: 12,
      astroScore: 0,
      crepuscularScore: 14,
      cloudTotalPct: 75,
      cloudLowPct: 30,
      cloudMidPct: 28,
      cloudHighPct: 17,
      visibilityKm: 7,
      aerosolOpticalDepth: 0.1,
      precipProbabilityPct: 55,
      humidityPct: 88,
      temperatureC: 11,
      dewPointC: 8,
      windKph: 24,
      gustKph: 32,
      moonIlluminationPct: 15,
      isGolden: false,
      isBlue: true,
      isNight: false,
      tags: ['urban', 'wet streets'],
    })));

    expect(sessions[0]?.session).toBe('urban');
    expect(sessions[0]?.hardPass).toBe(true);
    expect(sessions[0]?.reasons).toContain('Recent or active rain should leave wet streets for reflections.');
    expect(sessions[0]?.reasons).toContain('Blue-hour or night light suits moody urban photography.');
  });

  it('scores wildlife conservatively on a calm soft-light daylight setup', () => {
    const result = evaluateSessionFeatures('wildlife', deriveHourFeatures(makeHour({
      overallScore: 58,
      dramaScore: 42,
      clarityScore: 44,
      mistScore: 8,
      astroScore: 0,
      crepuscularScore: 26,
      cloudTotalPct: 58,
      cloudLowPct: 18,
      cloudMidPct: 22,
      cloudHighPct: 18,
      visibilityKm: 18,
      aerosolOpticalDepth: 0.08,
      precipProbabilityPct: 12,
      humidityPct: 72,
      temperatureC: 11,
      dewPointC: 6,
      windKph: 5,
      gustKph: 8,
      moonIlluminationPct: 15,
      isGolden: true,
      isBlue: false,
      isNight: false,
      tags: ['wildlife', 'soft light'],
    })));

    expect(result.hardPass).toBe(true);
    expect(result.confidence).toBe('medium');
    expect(result.score).toBeGreaterThan(60);
    expect(result.reasons).toContain('Lighter winds should make subjects and longer lenses easier to manage.');
    expect(result.reasons).toContain('Soft low-angle light should be kinder on feathers, fur, and contrast.');
    expect(result.warnings).toContain('This wildlife score is a coarse scaffold without species timing, habitat, or scent context.');
  });

  it('keeps wildlife low-confidence when wind and storms make the setup unreliable', () => {
    const result = evaluateSessionFeatures('wildlife', deriveHourFeatures(makeHour({
      overallScore: 46,
      dramaScore: 48,
      clarityScore: 32,
      mistScore: 6,
      astroScore: 0,
      crepuscularScore: 14,
      cloudTotalPct: 24,
      cloudLowPct: 12,
      cloudMidPct: 8,
      cloudHighPct: 4,
      visibilityKm: 5,
      aerosolOpticalDepth: 0.11,
      precipProbabilityPct: 68,
      humidityPct: 70,
      temperatureC: 16,
      dewPointC: 9,
      windKph: 27,
      gustKph: 36,
      capeJkg: 1600,
      lightningRisk: 22,
      moonIlluminationPct: 15,
      isGolden: false,
      isBlue: false,
      isNight: false,
      tags: ['wildlife'],
    })));

    expect(result.confidence).toBe('low');
    expect(result.score).toBeLessThan(40);
    expect(result.warnings).toContain('Wind may keep smaller subjects restless and move perches or foreground cover.');
    expect(result.warnings).toContain('Showery or stormy conditions could make animal movement less predictable.');
    expect(result.warnings).toContain('This wildlife score is a coarse scaffold without species timing, habitat, or scent context.');
  });

  it('scores urban higher when wet surfaces and city light align', () => {
    const wetBlue = evaluateSessionFeatures('urban', deriveHourFeatures(makeHour({
      precipProbabilityPct: 60,
      humidityPct: 90,
      visibilityKm: 6,
      windKph: 5,
      isGolden: false,
      isBlue: true,
      isNight: false,
      cloudTotalPct: 72,
    })));
    const dryClear = evaluateSessionFeatures('urban', deriveHourFeatures(makeHour({
      precipProbabilityPct: 5,
      humidityPct: 45,
      visibilityKm: 28,
      windKph: 5,
      isGolden: false,
      isBlue: true,
      isNight: false,
      cloudTotalPct: 15,
    })));

    expect(wetBlue.score).toBeGreaterThan(dryClear.score);
    expect(wetBlue.reasons).toContain('Recent or active rain should leave wet streets for reflections.');
    expect(dryClear.warnings).toContain('Dry conditions reduce the reflective atmosphere urban shooting benefits from.');
  });

  it('applies urban wind penalty for breezy conditions', () => {
    const calm = evaluateSessionFeatures('urban', deriveHourFeatures(makeHour({
      precipProbabilityPct: 50,
      humidityPct: 85,
      visibilityKm: 8,
      windKph: 8,
      isGolden: false,
      isBlue: true,
      isNight: false,
    })));
    const windy = evaluateSessionFeatures('urban', deriveHourFeatures(makeHour({
      precipProbabilityPct: 50,
      humidityPct: 85,
      visibilityKm: 8,
      windKph: 32,
      isGolden: false,
      isBlue: true,
      isNight: false,
    })));

    expect(calm.score).toBeGreaterThan(windy.score);
    expect(windy.warnings).toContain('Strong wind may make tripod setups or umbrella handling difficult.');
  });

  it('fails urban hard pass when wind is extreme', () => {
    const result = evaluateSessionFeatures('urban', deriveHourFeatures(makeHour({
      precipProbabilityPct: 55,
      humidityPct: 90,
      windKph: 38,
      isGolden: false,
      isBlue: true,
      isNight: false,
    })));

    expect(result.hardPass).toBe(false);
    expect(result.score).toBe(0);
  });

  it('warns about heavy continuous rain for urban sessions', () => {
    const result = evaluateSessionFeatures('urban', deriveHourFeatures(makeHour({
      precipProbabilityPct: 90,
      humidityPct: 95,
      visibilityKm: 5,
      windKph: 8,
      isGolden: false,
      isBlue: true,
      isNight: false,
    })));

    expect(result.hardPass).toBe(true);
    expect(result.warnings).toContain('Heavy continuous rain may obscure scenes more than help reflections.');
  });

  it('gives urban high confidence when wet streets and city light align with low spread', () => {
    const result = evaluateSessionFeatures('urban', deriveHourFeatures(makeHour({
      precipProbabilityPct: 55,
      humidityPct: 85,
      visibilityKm: 8,
      windKph: 6,
      isGolden: false,
      isBlue: true,
      isNight: false,
      ensembleCloudStdDevPct: 5,
    })));

    expect(result.confidence).toBe('high');
    expect(result.volatility).toBe(5);
  });

  it('exposes surface-wetness as a required capability for urban', () => {
    const result = evaluateSessionFeatures('urban', deriveHourFeatures(makeHour()));
    expect(result.requiredCapabilities).toContain('surface-wetness');
    expect(result.requiredCapabilities).toContain('precipitation');
    expect(result.requiredCapabilities).toContain('aerosols');
  });
});
