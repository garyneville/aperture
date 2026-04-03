import { SCORE_THRESHOLDS } from '../../shared/brief-primitives.js';

export function sFooterKey(): string {
  return `<div class="footer-key">
    <strong>Key</strong> &middot;
    <strong>Score bands:</strong>
    Excellent &ge; ${SCORE_THRESHOLDS.excellent} &middot;
    Good ${SCORE_THRESHOLDS.good}&ndash;${SCORE_THRESHOLDS.excellent - 1} &middot;
    Marginal ${SCORE_THRESHOLDS.marginal}&ndash;${SCORE_THRESHOLDS.good - 1} &middot;
    Poor &lt; ${SCORE_THRESHOLDS.marginal} &middot;
    AM/PM = sunrise &amp; sunset light quality &middot;
    Astro = night sky potential (clear skies + dark moon) &middot;
    Outdoor comfort = walk/run practicality, independent of photography scoring &middot;
    Certainty: High &lt; 12 pts &middot; Fair 12&ndash;24 pts &middot; Low &ge; 25 pts
  </div>`;
}
