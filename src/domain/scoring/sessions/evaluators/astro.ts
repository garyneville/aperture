import { clamp } from '../../../../lib/utils.js';
import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  ASTRO_CAPABILITIES,
  astroConfidence,
  astroUncertaintyPenalty,
  completeScore,
  spreadVolatility,
  sweetSpotScore,
} from '../shared.js';

export const astroEvaluator: SessionEvaluator = {
  session: 'astro',
  requiredCapabilities: ASTRO_CAPABILITIES,
  evaluateHour(features) {
    // HARD GATES – cloud cap, transparency floor, and at least nautical twilight
    const sunAlt = features.solarAltitudeDeg ?? null;
    const hardPass = features.isNight
      && features.cloudTotalPct <= 60
      && features.transparencyScore >= 15;

    // TWILIGHT DARKNESS RAMP – graduated factor from nautical (-12°) to
    // astronomical (-18°) twilight.  Full score only under true astronomical
    // darkness; partial credit during late nautical twilight.
    const darknessFactor = sunAlt != null
      ? (sunAlt <= -18 ? 1.0
        : sunAlt <= -12 ? (-12 - sunAlt) / 6.0
          : 0)
      : (features.isNight ? 1.0 : 0);

    // NON-LINEAR CLOUD PENALTY – quadratic ramp starting at 10 %
    const effectiveCloudOpacity = Math.round((features.cloudTotalPct * 0.65) + (features.cloudOpticalThicknessPct * 0.35));
    const cloudFrac = clamp(effectiveCloudOpacity - 10, 0, 50) / 50;   // 0-1 above 10 %
    const cloudPenalty = Math.round(cloudFrac * cloudFrac * 30);         // 0-30

    // ALTITUDE-AWARE MOON WASHOUT – uses a stepped altitude factor
    // modeled on Krisciunas–Schaefer sky-brightness principles:
    // higher moon = less atmospheric extinction of moonlight = more sky-glow.
    // The 5-band table from the research report (interpolated within bands):
    //   ≤-6°     → 0.00           (well below horizon, no moonlight)
    //   -6° – 0° → 0.05           (just below, faint horizon glow for bright moons)
    //   0° – 15° → 0.10 – 0.25    (low: heavy atmospheric extinction)
    //   15° – 45°→ 0.25 – 0.60    (mid: moderate extinction)
    //   ≥45°     → 0.60 – 1.00    (high/overhead: minimal extinction, max sky-glow)
    const moonAlt = features.moonAltitudeDeg ?? null;
    const moonAltFactor = moonAlt != null
      ? (moonAlt <= -6 ? 0
        : moonAlt <= 0 ? 0.05
          : moonAlt <= 15 ? 0.10 + (moonAlt / 15) * 0.15
            : moonAlt <= 45 ? 0.25 + ((moonAlt - 15) / 30) * 0.35
              : 0.60 + (clamp(moonAlt - 45, 0, 25) / 25) * 0.40)
      : 1; // unknown → assume worst
    const moonIllumFrac = clamp(features.moonIlluminationPct - 25, 0, 75) / 75;
    const moonPenalty = Math.round(moonIllumFrac * moonIllumFrac * moonIllumFrac * 35 * moonAltFactor);

    // NON-LINEAR TRANSPARENCY BONUS – sweet-spot curve (best between 65-95)
    const transparencySweetSpot = sweetSpotScore(features.transparencyScore, 65, 95, 20, 100);
    const thinVeilBonus = clamp(Math.round(features.highCloudTranslucencyScore * 0.05), 0, 5);
    const lowCloudPenalty = features.lowCloudBlockingScore >= 35
      ? clamp(Math.round((features.lowCloudBlockingScore - 35) * 0.18), 0, 10)
      : 0;

    // SEEING – astronomical seeing measures turbulence-induced star bloat.
    // 0-100 scale: higher is better (steadier atmosphere).
    const seeing = features.seeingScore ?? null;
    const seeingBonus = seeing != null ? clamp(Math.round((seeing - 40) * 0.12), -5, 8) : 0;

    // LIGHT POLLUTION (Bortle 1-9) – stepped curve aligned with report thresholds:
    // Bortle ≤3: excellent dark-sky → strong bonus
    // Bortle 4:  rural/suburban transition → moderate bonus
    // Bortle 5:  marginal for Milky Way → slight penalty
    // Bortle 6+: Milky Way barely/not visible → steep penalty
    const bortle = features.lightPollutionBortle ?? null;
    const bortlePenalty = bortle != null
      ? (bortle <= 2 ? -12
        : bortle === 3 ? -8
          : bortle === 4 ? -3
            : bortle === 5 ? 2
              : bortle === 6 ? 10
                : bortle === 7 ? 14
                  : bortle === 8 ? 16
                    : 16) // Bortle 9
      : 0;

    const spread = spreadVolatility(features);
    const uncertaintyPenalty = astroUncertaintyPenalty(spread);

    const rawScore =
      (features.astroScore * 0.55)
      + (transparencySweetSpot * 0.2)
      + (features.transparencyScore * 0.1)
      + (Math.max(0, 100 - features.moonIlluminationPct) * 0.15)
      + thinVeilBonus
      + seeingBonus
      - moonPenalty
      - cloudPenalty
      - lowCloudPenalty
      - bortlePenalty
      - uncertaintyPenalty;

    // Apply twilight ramp — scores decrease proportionally during
    // nautical twilight when the sky is not yet fully dark.
    const score = rawScore * darknessFactor;

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (features.cloudTotalPct <= 15) reasons.push('Cloud cover is excellent for deep-sky imaging.');
    else if (features.cloudTotalPct <= 25) reasons.push('Cloud cover is low enough for a plausible dark-sky run.');
    if (features.moonIlluminationPct <= 15) reasons.push('Near-new-moon darkness favours faint nebulae and galaxies.');
    else if (features.moonIlluminationPct <= 30) reasons.push('Moonlight should stay subdued for darker skies.');
    if (moonAlt != null && moonAlt <= -6 && features.moonIlluminationPct > 25) reasons.push('Moon is well below the horizon — bright moonlight is not a factor right now.');
    else if (moonAlt != null && moonAlt <= 0 && features.moonIlluminationPct > 25) reasons.push('Moon is below the horizon — bright moonlight is not a factor right now.');
    if (moonAlt != null && moonAlt > 0 && moonAlt <= 15 && features.moonIlluminationPct > 40) reasons.push('Moon is low on the horizon, limiting its sky-glow impact.');
    if (features.transparencyScore >= 75) reasons.push('Transparency looks strong for clean deep-sky contrast.');
    else if (features.transparencyScore >= 55) reasons.push('Current haze and humidity look workable for transparency.');
    if (features.highCloudTranslucencyScore >= 70 && features.cloudOpticalThicknessPct <= 35) reasons.push('Any remaining cloud looks like a thin veil rather than a solid deck.');
    if (seeing != null && seeing >= 70) reasons.push('Atmospheric seeing looks steady for sharp star imaging.');
    if (bortle != null && bortle <= 3) reasons.push('Dark-sky site conditions favour faint deep-sky targets.');
    else if (bortle != null && bortle === 4) reasons.push('Rural-transition site is workable for Milky Way imaging.');
    if (sunAlt != null && sunAlt > -18 && sunAlt <= -12) warnings.push('Late nautical twilight — sky is darkening but not yet at full astronomical darkness.');
    if (!features.isNight) warnings.push('This hour is not inside a darkness window.');
    if (features.cloudTotalPct > 45) warnings.push('Cloud cover is approaching an astro deal-breaker.');
    else if (features.cloudTotalPct > 30) warnings.push('Moderate cloud may interrupt longer exposures.');
    if (features.lowCloudBlockingScore >= 30) warnings.push('Dense low cloud is a bigger risk than the raw cloud-cover total suggests.');
    if (features.moonIlluminationPct > 70 && moonAltFactor > 0.3) warnings.push('Bright moonlight will wash out all but the brightest targets.');
    else if (features.moonIlluminationPct > 45 && moonAltFactor > 0.3) warnings.push('Moonlight may wash out faint targets.');
    if (moonAlt != null && moonAlt >= 45 && features.moonIlluminationPct > 50) warnings.push('Moon is at high altitude — strong sky-glow impact on deep-sky imaging.');
    if (features.transparencyScore < 30) warnings.push('Poor transparency will limit deep-sky contrast.');
    if ((features.hazeTrapRisk ?? 0) >= 60) warnings.push('A shallow boundary layer may be trapping haze despite the cloud forecast.');
    if (seeing != null && seeing < 30) warnings.push('Poor seeing may bloat stars and reduce fine detail in long exposures.');
    if (bortle != null && bortle >= 7) warnings.push('Heavy light pollution limits deep-sky imaging to narrowband or bright targets.');
    else if (bortle != null && bortle >= 5) warnings.push('Milky Way may look washed out; best results from narrowband or bright targets.');

    return completeScore(
      'astro',
      ASTRO_CAPABILITIES,
      hardPass,
      score,
      astroConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};
