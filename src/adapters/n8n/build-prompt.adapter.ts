import { buildPrompt } from '../../domain/editorial/prompt/build-prompt.js';
import {
  getPhotoBriefEditorialPromptMode,
  getPhotoBriefInspireEnabled,
  PHOTO_BRIEF_WORKFLOW_VERSION,
  getPhotoWeatherIcao,
  getPhotoWeatherLat,
  getPhotoWeatherLocation,
  getPhotoWeatherLon,
  getPhotoWeatherTimezone,
} from '../../config.js';
import type { EditorialPromptMode } from '../../config.js';
import type { N8nRuntime } from './types.js';

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseEditorialPromptMode(value: unknown): EditorialPromptMode | null {
  return value === 'structured-output' || value === 'legacy-json'
    ? value
    : null;
}

function resolveEditorialPromptMode(input: Record<string, unknown>): EditorialPromptMode {
  const triggerRequest = objectOrNull(input.triggerRequest);
  const body = objectOrNull(triggerRequest?.body);
  const query = objectOrNull(triggerRequest?.query);

  return parseEditorialPromptMode(body?.editorialPromptMode)
    ?? parseEditorialPromptMode(query?.editorialPromptMode)
    ?? getPhotoBriefEditorialPromptMode();
}

export function run({ $input }: N8nRuntime) {
  const input = $input.first().json;

  if (!Array.isArray(input.dailySummary)) {
    console.warn('[build-prompt] input.dailySummary is not an array — prompt quality may be degraded');
  }

  const result = buildPrompt({
    homeLocation: {
      name: getPhotoWeatherLocation(),
      lat: getPhotoWeatherLat(),
      lon: getPhotoWeatherLon(),
      timezone: getPhotoWeatherTimezone(),
      icao: getPhotoWeatherIcao(),
    },
    workflowVersion: PHOTO_BRIEF_WORKFLOW_VERSION,
    windows: input.windows,
    dontBother: input.dontBother,
    todayBestScore: input.todayBestScore,
    todayCarWash: input.todayCarWash,
    dailySummary: input.dailySummary,
    altLocations: input.altLocations,
    closeContenders: input.closeContenders,
    noAltsMsg: input.noAltsMsg,
    metarNote: input.metarNote,
    sessionRecommendation: input.sessionRecommendation,
    sunrise: input.sunrise,
    sunset: input.sunset,
    moonPct: input.moonPct,
    kpForecast: input.kpForecast,
    auroraSignal: input.auroraSignal,
    debugContext: input.debugContext,
    longRangeTop: input.longRangeTop,
    longRangeCardLabel: input.longRangeCardLabel,
    darkSkyAlert: input.darkSkyAlert,
    longRangeCandidates: input.longRangeCandidates,
    longRangeDebugCandidates: input.longRangeDebugCandidates,
  });

  const editorialPromptMode = resolveEditorialPromptMode(input as Record<string, unknown>);

  return [{
    json: {
      ...result,
      editorialPromptMode,
      inspireEnabled: getPhotoBriefInspireEnabled(),
    },
  }];
}
