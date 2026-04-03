import { C, FONT, SCORE_THRESHOLDS } from '../shared.js';

export function footerKey(): string {
  return `<div style="padding:12px 4px;border-top:1px solid ${C.outline};font-family:${FONT};font-size:11px;line-height:1.6;color:${C.subtle};">
    <b>Key</b> &middot;
    <b>Score bands</b> Excellent &ge; ${SCORE_THRESHOLDS.excellent} &middot; Good ${SCORE_THRESHOLDS.good}&ndash;${SCORE_THRESHOLDS.excellent - 1} &middot; Marginal ${SCORE_THRESHOLDS.marginal}&ndash;${SCORE_THRESHOLDS.good - 1} &middot; Poor &lt; ${SCORE_THRESHOLDS.marginal} &middot;
    AM/PM = sunrise &amp; sunset light quality &middot;
    Astro = night sky potential (clear skies + dark moon) &middot;
    Outdoor comfort = walk/run practicality, independent of photography scoring &middot;
    Crepuscular rays = shafts of light through broken cloud near the horizon &middot;
    Spread = how much forecast models disagree (lower is more reliable) &middot;
    Certainty bands = High &lt; 12 pts &middot; Fair 12&ndash;24 pts &middot; Low &ge; 25 pts &middot;
    Daylight spread = based on golden-hour ensemble &middot; Astro spread = based on night-hour ensemble
  </div>`;
}
