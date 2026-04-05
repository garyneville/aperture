import { clamp, solarElevation, aodClarity, astroAodPenalty } from '../../../lib/utils.js';
import { getMoonMetrics, getSolarAltitude, moonScoreAdjustment } from '../../../lib/astro.js';
import { HOME_SITE_DARKNESS, astroDarknessBonus } from '../../../lib/site-darkness.js';
import type { DerivedHourFeatureInput } from '../features/derive-hour-features.js';
import type { ScoredHour, AzimuthScanResult } from '../contracts.js';

// Degrees below horizon at which astronomical twilight ends (sky is truly dark)
const ASTRO_DARK_ELEVATION = -18;

export interface ScoreHourParams {
  ts: string;
  i: number;
  lat: number;
  lon: number;
  timezone: string;
  // Weather fields
  cl: number;
  cm: number;
  ch: number;
  ct: number;
  visK: number;
  tmp: number;
  hum: number;
  dew: number;
  pp: number;
  pr: number;
  spd: number;
  gst: number;
  wdir: number | null;
  cap: number;
  vpd: number;
  prev: number;
  tpw: number;
  blh: number | null;
  drad: number | null;
  frad: number | null;
  st0: number | null;
  aod: number;
  dust: number;
  aqi: number;
  uv: number;
  // Phase flags
  isGolden: boolean;
  isGoldAm: boolean;
  isGoldPm: boolean;
  isBlue: boolean;
  isBlueAm: boolean;
  isBluePm: boolean;
  isNight: boolean;
  isPostSunset: boolean;
  // Azimuth data
  azimuthRisk: number | null;
  azimuthLowRisk: number | null;
  azimuthScan: AzimuthScanResult | null;
  horizonGapPct: number | null;
  // Lightning
  lightningRisk: number | null;
  // SunsetHue
  shQ: number | null;
}

export interface ScoreHourResult {
  hour: ScoredHour;
  featureInput: DerivedHourFeatureInput;
}

export function scoreHour(p: ScoreHourParams): ScoreHourResult {
  const t = new Date(p.ts);
  const moonMetrics = getMoonMetrics(+t, p.lat, p.lon);
  const moon = moonMetrics.illumination;
  const solarAltDeg = getSolarAltitude(+t, p.lat, p.lon);
  const shBoost = p.shQ !== null ? Math.round(p.shQ * 25) : 0;

  // ── DRAMA ──────────────────────────────────────────────────────────────────
  let drama = 0;
  if (p.isGolden) drama += 30;
  if (p.isBlue)   drama += 18;

  // High cloud: post-sunset gets a bigger reward — cirrus still glowing
  if (p.isPostSunset) {
    if (p.ch >= 15 && p.ch <= 80) drama += 25; else if (p.ch > 80) drama += 10;
  } else {
    if (p.ch >= 20 && p.ch <= 70) drama += 20; else if (p.ch > 70) drama += 8;
  }

  if (p.cm >= 10 && p.cm <= 50) drama += 10; else if (p.cm > 80) drama -= 5;

  // Low cloud: temporal asymmetry
  if (p.isPostSunset) {
    if (p.cl > 85) drama -= 5;
  } else {
    if (p.cl < 20) drama += 10; else if (p.cl > 70) drama -= 15;
  }

  if (p.cap > 500) drama += 5;
  if (p.prev > 0.5 && p.pr < 0.1) drama += 10;
  if (p.pr > 0.5)  drama -= 20;

  // Clear-sky bonus: near-cloudless golden/blue hours still produce clean, directional light
  if ((p.isGolden || p.isBlue) && p.ct < 15) drama += 12;
  else if ((p.isGolden || p.isBlue) && p.ct < 30) drama += 5;

  // Solar azimuth scan
  if (p.azimuthRisk !== null) {
    if (p.azimuthRisk > 75) drama -= 22;
    else if (p.azimuthRisk > 60) drama -= 14;
    else if (p.azimuthRisk > 45) drama -= 8;
    else if (p.azimuthRisk < 20) drama += 8;
    else if (p.azimuthRisk < 32) drama += 4;
    drama += p.azimuthScan?.clearPathBonus ?? 0;
  }
  drama = clamp(drama + shBoost);

  // ── CLARITY ────────────────────────────────────────────────────────────────
  let clarity = 0;
  if (p.visK > 30) clarity += 25; else if (p.visK > 15) clarity += 15; else if (p.visK < 2) clarity -= 15;
  clarity += aodClarity(p.aod);
  if (p.dust > 20) clarity -= 10;
  if (p.hum < 60)  clarity += 5;  else if (p.hum > 85) clarity -= 5;
  if (p.uv > 7)    clarity -= 10;
  if (p.isGolden)  clarity += 10;
  if (p.tpw < 15)       clarity += 5;
  else if (p.tpw > 30)  clarity -= Math.round((p.tpw - 30) / 4);
  if (p.azimuthLowRisk !== null && p.azimuthLowRisk > 60) clarity -= 4;
  // Clear-sky visibility bonus: cloudless sky + good visibility partially offsets cloud drama deficit
  if (p.ct < 20 && p.visK > 10) clarity += 12;
  else if (p.ct < 20 && p.visK > 5) clarity += 6;
  clarity = clamp(clarity);

  // ── MIST / MOOD ───────────────────────────────────────────────────────────
  const visM = p.visK * 1000;
  let mist = 0;
  if (visM >= 200 && visM <= 1500)  mist += 30;
  else if (visM > 1500 && visM <= 4000) mist += 10;
  if ((p.tmp - p.dew) < 2)  mist += 20; else if ((p.tmp - p.dew) < 4) mist += 10;
  if (p.spd < 5)          mist += 15; else if (p.spd < 10) mist += 5;
  if (p.prev > 0.5 && p.pr < 0.1) mist += 10;
  mist = clamp(mist);

  // ── ASTRO ─────────────────────────────────────────────────────────────────
  let astro = 0;
  if (p.isNight && solarAltDeg < ASTRO_DARK_ELEVATION) {
    astro += moonScoreAdjustment(moonMetrics);
    if (p.ct < 10)    astro += 30; else if (p.ct < 30)    astro += 10; else if (p.ct > 60)    astro -= 20;
    if (p.visK > 25)  astro += 15;
    astro -= astroAodPenalty(p.aod);
    if (p.aqi < 20)   astro += 10;
    astro += astroDarknessBonus(HOME_SITE_DARKNESS);
    astro = clamp(astro);
  }

  // ── CREPUSCULAR RAYS ──────────────────────────────────────────────────────
  // Now derived in derive-hour-features.ts via estimateCrepuscularScore().
  // Kept here only for the ScoredHour legacy field and tag logic.
  let crepuscular = 0;
  if (p.isGolden) {
    const elev = solarElevation(+t, p.lat, p.lon);
    if (elev >= -2 && elev <= 12) crepuscular += 30; else if (elev > 12 && elev <= 20) crepuscular += 10;
    if (p.cl >= 15 && p.cl <= 55)     crepuscular += 25; else if (p.cl >= 55 && p.cl <= 75)    crepuscular += 10;
    else if (p.cl < 15)             crepuscular -= 10; else if (p.cl > 80)                 crepuscular -= 20;
    if (p.aod >= 0.05 && p.aod <= 0.3) crepuscular += 15; else if (p.aod > 0.3) crepuscular += 5;
    if (p.visK > 15) crepuscular += 10; else if (p.visK < 5) crepuscular -= 10;
    if (p.cap > 300) crepuscular += 5;
    if (p.azimuthRisk !== null && p.azimuthRisk < 35) crepuscular += 5;
    crepuscular = clamp(crepuscular);
  }

  // ── FINAL SCORE ───────────────────────────────────────────────────────────
  let score: number;
  if (p.isNight) {
    score = Math.round(astro * 0.75 + mist * 0.15 + drama * 0.10);
  } else if (p.isGoldAm || p.isBlueAm) {
    score = Math.round(drama * 0.30 + clarity * 0.40 + mist * 0.30);
  } else if (p.isGoldPm || p.isBluePm) {
    score = Math.round(drama * 0.55 + clarity * 0.30 + mist * 0.15);
  } else {
    const [a, b, c] = [drama, clarity, mist].sort((x, y) => y - x);
    score = Math.round(a * 0.55 + b * 0.35 + c * 0.10);
  }
  score = clamp(score);

  // ── TAGS ──────────────────────────────────────────────────────────────────
  const tags: string[] = [];
  if (p.isGolden && clarity > 45)  tags.push('landscape');
  if (p.isGolden && drama > 50)    tags.push('golden hour');
  if (p.isBlue)                    tags.push('blue hour');
  if (mist > 40)                   tags.push('atmospheric');
  if (p.isNight && astro > 35)     tags.push('astrophotography');
  if (p.prev > 0.5 && p.pr < 0.1) tags.push('reflections');
  if (crepuscular > 45)            tags.push('crepuscular rays');
  if ((p.azimuthRisk ?? 100) < 25 && (p.isGolden || p.isBlue)) tags.push('clear light path');
  if (!tags.length)                tags.push(score > 40 ? 'general' : 'poor');

  const hourLabel = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: p.timezone });

  const featureInput: DerivedHourFeatureInput = {
    hourLabel,
    overallScore: score,
    dramaScore: drama,
    clarityScore: clarity,
    mistScore: mist,
    astroScore: astro,
    cloudLowPct: p.cl,
    cloudMidPct: p.cm,
    cloudHighPct: p.ch,
    cloudTotalPct: p.ct,
    visibilityKm: Math.round(p.visK * 10) / 10,
    aerosolOpticalDepth: Math.round(p.aod * 100) / 100,
    precipProbabilityPct: p.pp,
    humidityPct: p.hum,
    temperatureC: Math.round(p.tmp * 10) / 10,
    dewPointC: Math.round(p.dew * 10) / 10,
    windKph: Math.round(p.spd),
    gustKph: Math.round(p.gst),
    windDirectionDeg: p.wdir != null ? Math.round(p.wdir) : null,
    moonIlluminationPct: Math.round(moon * 100),
    moonAltitudeDeg: Math.round(moonMetrics.altitudeDeg * 10) / 10,
    solarAltitudeDeg: Math.round(solarAltDeg * 10) / 10,
    isNight: p.isNight,
    isGolden: p.isGolden,
    isBlue: p.isBlue,
    tags,
    azimuthOcclusionRiskPct: p.azimuthRisk !== null ? Math.round(p.azimuthRisk) : null,
    azimuthLowCloudRiskPct: p.azimuthLowRisk !== null ? Math.round(p.azimuthLowRisk) : null,
    clearPathBonusPts: p.azimuthScan?.clearPathBonus ?? null,
    boundaryLayerHeightM: p.blh != null ? Math.round(p.blh) : null,
    horizonGapPct: p.horizonGapPct !== null ? Math.round(p.horizonGapPct) : null,
    capeJkg: Math.round(p.cap),
    lightningRisk: p.lightningRisk,
    directRadiationWm2: p.drad != null ? Math.round(p.drad) : null,
    diffuseRadiationWm2: p.frad != null ? Math.round(p.frad) : null,
    soilTemperature0cmC: p.st0 != null ? Math.round(p.st0 * 10) / 10 : null,
    ensembleCloudStdDevPct: null, // populated by orchestrator
    ensembleCloudMeanPct: null,   // populated by orchestrator
  };

  const hour: ScoredHour = {
    ts: p.ts, t: t.toISOString(),
    hour: hourLabel,
    score, drama, clarity, mist, astro, crepuscular, shQ: p.shQ,
    cl: p.cl, cm: p.cm, ch: p.ch, ct: p.ct,
    visK: Math.round(p.visK * 10) / 10,
    aod: Math.round(p.aod * 100) / 100,
    tpw: Math.round(p.tpw),
    wind: Math.round(p.spd), windDir: p.wdir != null ? Math.round(p.wdir) : null, gusts: Math.round(p.gst),
    tmp: Math.round(p.tmp * 10) / 10, hum: p.hum, dew: Math.round(p.dew * 10) / 10,
    pp: p.pp, pr: p.pr, vpd: p.vpd,
    boundaryLayerHeightM: p.blh != null ? Math.round(p.blh) : null,
    horizonGapPct: p.horizonGapPct !== null ? Math.round(p.horizonGapPct) : null,
    azimuthRisk: p.azimuthRisk !== null ? Math.round(p.azimuthRisk) : null,
    isGolden: p.isGolden, isGoldAm: p.isGoldAm, isGoldPm: p.isGoldPm,
    isBlue: p.isBlue, isBlueAm: p.isBlueAm, isBluePm: p.isBluePm, isNight: p.isNight,
    moon: Math.round(moon * 100), moonAltDeg: Math.round(moonMetrics.altitudeDeg * 10) / 10,
    solarAltDeg: Math.round(solarAltDeg * 10) / 10, uv: p.uv, tags,
    directRadiationWm2: p.drad != null ? Math.round(p.drad) : null,
    diffuseRadiationWm2: p.frad != null ? Math.round(p.frad) : null,
    soilTemperature0cmC: p.st0 != null ? Math.round(p.st0 * 10) / 10 : null,
  };

  return { hour, featureInput };
}
