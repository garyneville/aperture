import { serializeDebugPayload } from '../../core/debug-payload.js';
import {
  getPhotoBriefEditorialPrimaryProvider,
  getPhotoWeatherLat,
  getPhotoWeatherLocation,
  getPhotoWeatherLon,
  getPhotoWeatherTimezone,
} from '../../config.js';
import { resolveEditorial } from '../../editorial/resolve-editorial.js';
import type { FinalRuntimePayload } from './contracts/final-runtime-payload.js';
import { prepareDebugContext, hydrateDebugContext } from './hydrate-debug-context.js';
import { firstInputJson } from './input.js';
import { normalizeAiDiagnostics } from './normalize-ai-diagnostics.js';
import { renderOutputs } from './render-outputs.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const input = firstInputJson($input, {} as FinalRuntimePayload);
  const normalized = normalizeAiDiagnostics(input);
  const preparedDebug = prepareDebugContext(normalized.ctx);
  const runtimePayloadSnapshot = serializeDebugPayload(input);
  const { editorial, debugAiTrace } = resolveEditorial({
    preferredProvider: getPhotoBriefEditorialPrimaryProvider(),
    ctx: {
      ...normalized.ctx,
      debugContext: preparedDebug.debugContext,
      homeLatitude: getPhotoWeatherLat(),
      homeLocationName: getPhotoWeatherLocation(),
    },
    groqRawContent: normalized.groqRawContent,
    geminiRawContent: normalized.geminiRawContent,
    geminiInspire: normalized.geminiInspire,
    geminiDiagnostics: normalized.geminiDiagnostics,
    geminiRawPayload: normalized.geminiRawPayload,
    nearbyAltNames: normalized.nearbyAltNames,
    longRangePool: normalized.longRangePool,
  });
  const debugContext = hydrateDebugContext(preparedDebug, {
    debugAiTrace,
    runtimePayloadSnapshot,
    longRangePool: normalized.longRangePool,
    location: getPhotoWeatherLocation(),
    latitude: getPhotoWeatherLat(),
    longitude: getPhotoWeatherLon(),
    timezone: getPhotoWeatherTimezone(),
  });
  const output = renderOutputs(
    { ...normalized.ctx, debugContext },
    editorial,
    preparedDebug.debugMode,
    preparedDebug.debugEmailTo,
  );

  return [{ json: output }];
}
