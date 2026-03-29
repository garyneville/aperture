import { describe, expect, it } from 'vitest';
import { deriveHourFeatures, type DerivedHourFeatureInput } from './features/derive-hour-features.js';
import {
  evaluateBuiltInSessions,
  evaluateSessionFeatures,
  getBuiltInSessionEvaluators,
  selectBestBuiltInSession,
  selectBestSessionAcrossHours,
  summarizeSessionRecommendations,
} from './session-scoring.js';

function makeHour(overrides: Partial<DerivedHourFeatureInput> = {}): DerivedHourFeatureInput {
  return {
    hourLabel: '19:00',
    overallScore: 72,
    dramaScore: 78,
    clarityScore: 68,
    mistScore: 20,
    astroScore: 14,
    crepuscularScore: 61,
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
    expect(volatile.score).toBeGreaterThan(stable.score);
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
    expect(summary.bySession.map(entry => entry.session)).toEqual(['storm', 'long-exposure', 'mist', 'golden-hour', 'urban', 'astro']);
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
