import { HOME_SITE_DARKNESS } from '../../../../lib/site-darkness.js';
import type { AltLocationResult } from '../build-prompt.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Milky Way galactic core is usefully above the horizon from UK latitudes roughly April–September. */
function isMilkyWaySeason(month: number): boolean {
  return month >= 4 && month <= 9;
}

/**
 * Generates sky-quality constraints for the COMPOSITION prompt section.
 * Conditions local shot ideas on Bortle class, season, moon phase, and whether
 * a dark-sky alternative exists, without letting the composition drift away
 * from the named local window.
 */
export function skyQualityConstraints(
  homeLocationName: string,
  month: number,
  moonPct: number,
  topAlt: AltLocationResult | undefined,
  isAstroWin: boolean,
  auroraVisibleLocally: boolean,
  auroraThreshold: number,
  peakKpTonight: number | null,
): string {
  if (!isAstroWin) return '';

  const milkyWaySeason = isMilkyWaySeason(month);
  const homeBortle = HOME_SITE_DARKNESS.bortle;
  const parts: string[] = [
    'Composition bullets must stay focused on the named local window and local conditions. Do not turn them into travel or remote-location shot plans.',
  ];

  parts.push(
    `Home location (${homeLocationName}) is Bortle ${homeBortle} — significant light pollution. ` +
    `Do NOT suggest Milky Way core shots for the home session; bias toward: star trails with a ` +
    `silhouetted landmark foreground, wide-field constellation framing, moonlit architecture, or light-painting.`,
  );

  if (!milkyWaySeason) {
    parts.push(
      `Milky Way core is NOT seasonally visible from UK in ${MONTH_NAMES[month - 1]} ` +
      `(core only viable roughly April–September from UK latitudes). ` +
      `Do not suggest Milky Way photography at any location this month. ` +
      `Instead consider: star trails, aurora potential (if Kp elevated), constellation framing, ` +
      `or moonlit architecture.`,
    );
  }

  if (moonPct > 60) {
    parts.push(
      `Moon is ${moonPct}% illuminated — prioritise moonlit architecture or illuminated landscape silhouettes ` +
      `over faint-star or deep-sky work.`,
    );
  } else if (moonPct < 20 && milkyWaySeason) {
    parts.push(
      `Moon is ${moonPct}% — dark enough for wide-field star work or Milky Way if at a dark-sky site.`,
    );
  }

  if (topAlt?.darkSky) {
    if (milkyWaySeason) {
      parts.push(
        `${topAlt.name} is a genuine dark-sky alternative where Milky Way work may be viable, ` +
        `but keep the composition bullets about the local session rather than the remote alternative.`,
      );
    } else {
      parts.push(
        `${topAlt.name} is a dark-sky alternative but Milky Way core is out of season — ` +
        `suggest wide-field star trails or aurora if Kp permits rather than Milky Way, and keep composition bullets local.`,
      );
    }
  }

  if (auroraVisibleLocally) {
    parts.push(
      `Aurora is realistically visible from ${homeLocationName} tonight (Kp ${peakKpTonight?.toFixed(1) ?? 'unknown'} meets the local threshold of Kp ${auroraThreshold}). ` +
      `Make the first bullet aurora-led: face north, leave a low horizon, and avoid generic star-trail-only bullets as the primary idea.`,
    );
  }

  return `Sky quality constraints for shot ideas:\n${parts.map(p => `- ${p}`).join('\n')}`;
}
