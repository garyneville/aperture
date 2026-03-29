import { formatSite } from '../../core/format-site.js';
import { formatTelegram } from '../../core/format-telegram.js';
import type { ScoredForecastContext } from '../../core/standalone/contracts.js';
import { formatDebugEmail, formatEmail } from '../../core/format-email.js';
import {
  emptyDebugContext,
  type DebugContext,
} from '../../core/debug-context.js';
import {
  getPhotoBriefEditorialPrimaryProvider,
  getPhotoWeatherLat,
  getPhotoWeatherLocation,
  getPhotoWeatherLon,
  getPhotoWeatherTimezone,
} from '../../config.js';
import { resolveEditorial } from '../../editorial/resolve-editorial.js';
import { renderBriefAsJson } from '../../renderers/brief-json.js';
import type { N8nRuntime } from './types.js';

function normaliseLongRangeCandidate(candidate: Record<string, unknown>, rank: number) {
  return {
    name: typeof candidate.name === 'string' ? candidate.name : '(unknown)',
    region: typeof candidate.region === 'string' ? candidate.region : '—',
    tags: Array.isArray(candidate.tags) ? (candidate.tags as string[]) : [],
    bestScore: typeof candidate.bestScore === 'number' ? candidate.bestScore : 0,
    dayScore: typeof candidate.dayScore === 'number' ? candidate.dayScore : 0,
    astroScore: typeof candidate.astroScore === 'number' ? candidate.astroScore : 0,
    driveMins: typeof candidate.driveMins === 'number' ? candidate.driveMins : 0,
    darkSky: candidate.darkSky === true,
    rank,
    deltaVsLeeds: typeof candidate.deltaVsLeeds === 'number' ? candidate.deltaVsLeeds : 0,
    shown: candidate.shown === true,
    discardedReason: typeof candidate.discardedReason === 'string' ? candidate.discardedReason : undefined,
  };
}

export function run({ $input }: N8nRuntime) {
  const input = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();
  const {
    choices,
    geminiResponse,
    geminiInspire,
    geminiStatusCode,
    geminiFinishReason,
    geminiCandidateCount,
    geminiResponseByteLength,
    geminiResponseTruncated,
    ...ctx
  } = input;
  const rawContent = choices?.[0]?.message?.content?.trim() || '';
  const geminiRawContent = typeof geminiResponse === 'string' ? geminiResponse.trim() : '';
  const geminiDiagnostics = (
    geminiRawContent
    || typeof geminiStatusCode === 'number'
    || (typeof geminiFinishReason === 'string' && geminiFinishReason.trim().length > 0)
    || typeof geminiCandidateCount === 'number'
    || typeof geminiResponseByteLength === 'number'
    || typeof geminiResponseTruncated === 'boolean'
  )
    ? {
        statusCode: typeof geminiStatusCode === 'number' && Number.isFinite(geminiStatusCode) ? geminiStatusCode : null,
        finishReason: typeof geminiFinishReason === 'string' && geminiFinishReason.trim().length > 0 ? geminiFinishReason.trim() : null,
        candidateCount: typeof geminiCandidateCount === 'number' && Number.isFinite(geminiCandidateCount) ? geminiCandidateCount : null,
        responseByteLength: typeof geminiResponseByteLength === 'number' && Number.isFinite(geminiResponseByteLength) ? geminiResponseByteLength : null,
        truncated: geminiResponseTruncated === true,
      }
    : undefined;
  const longRangeDebugPool = Array.isArray(ctx.longRangeDebugCandidates)
    ? ctx.longRangeDebugCandidates
    : Array.isArray(ctx.longRangeCandidates)
      ? ctx.longRangeCandidates
      : [];
  const nearbyAltNames = [
    ...(ctx.altLocations || []).map((alt: { name?: string }) => alt?.name),
    ...((ctx.debugContext?.nearbyAlternatives || []).map((alt: { name?: string }) => alt?.name)),
  ].filter((name: string | undefined): name is string => Boolean(name));

  const debugContext: DebugContext = ctx.debugContext || emptyDebugContext();
  const debugMode = ctx.debugMode === true;
  const debugEmailTo = typeof ctx.debugEmailTo === 'string' ? ctx.debugEmailTo : '';
  const debugModeSource = typeof ctx.debugModeSource === 'string' && ctx.debugModeSource.trim().length > 0
    ? ctx.debugModeSource
    : (debugMode ? 'workflow toggle' : 'workflow default');

  const { editorial, debugAiTrace } = resolveEditorial({
    preferredProvider: getPhotoBriefEditorialPrimaryProvider(),
    ctx: {
      ...ctx,
      debugContext,
      homeLatitude: getPhotoWeatherLat(),
      homeLocationName: getPhotoWeatherLocation(),
    },
    groqRawContent: rawContent,
    geminiRawContent,
    geminiInspire: typeof geminiInspire === 'string' ? geminiInspire : undefined,
    geminiDiagnostics,
    nearbyAltNames,
    longRangePool: longRangeDebugPool,
  });

  debugContext.metadata = {
    ...(debugContext.metadata || {}),
    generatedAt: debugContext.metadata?.generatedAt || new Date().toISOString(),
    location: debugContext.metadata?.location || getPhotoWeatherLocation(),
    latitude: debugContext.metadata?.latitude ?? getPhotoWeatherLat(),
    longitude: debugContext.metadata?.longitude ?? getPhotoWeatherLon(),
    timezone: debugContext.metadata?.timezone || getPhotoWeatherTimezone(),
    workflowVersion: debugContext.metadata?.workflowVersion || null,
    debugModeEnabled: debugMode,
    debugModeSource,
    debugRecipient: debugMode ? debugEmailTo : null,
  };

  if (Array.isArray(longRangeDebugPool)) {
    debugContext.longRangeCandidates = (longRangeDebugPool as Array<Record<string, unknown>>)
      .map((candidate, index) => normaliseLongRangeCandidate(candidate, index + 1));
  }

  debugContext.ai = debugAiTrace;

  const briefJson = renderBriefAsJson({ ...(ctx as ScoredForecastContext), debugContext }, editorial);
  const telegramMsg = formatTelegram(briefJson);
  const emailHtml = formatEmail(briefJson);
  const siteHtml = formatSite(briefJson);
  const debugEmailHtml = debugMode ? formatDebugEmail(debugContext) : '';
  const debugEmailSubject = debugContext.metadata?.location
    ? `Photo Brief Debug - ${debugContext.metadata.location} - ${ctx.today || 'today'}`
    : `Photo Brief Debug - ${ctx.today || 'today'}`;

  return [{ json: {
    briefJson,
    telegramMsg,
    emailHtml,
    siteHtml,
    debugMode,
    debugEmailTo,
    debugEmailHtml,
    debugEmailSubject,
  } }];
}
