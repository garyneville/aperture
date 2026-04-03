/**
 * n8n Format Messages Adapter
 *
 * Thin adapter that bridges n8n runtime to the app layer.
 *
 * This adapter:
 * 1. Reads input from n8n
 * 2. Maps n8n config to app config
 * 3. Calls the finalizeBrief use case
 * 4. Returns output in n8n format
 *
 * All orchestration logic lives in src/app/run-photo-brief/finalize-brief.ts
 */

import {
  getPhotoBriefEditorialPrimaryProvider,
  getPhotoWeatherLat,
  getPhotoWeatherLocation,
  getPhotoWeatherLon,
  getPhotoWeatherTimezone,
} from '../../config.js';
import { finalizeBrief, extractGeminiDiagnostics } from '../../app/run-photo-brief/finalize-brief.js';
import type { FinalRuntimePayload } from './contracts/final-runtime-payload.js';
import { firstInputJson } from './input.js';
import type { N8nRuntime } from './types.js';

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined;
}

export function run({ $input }: N8nRuntime) {
  // Read raw input from n8n
  const input = firstInputJson($input, {} as FinalRuntimePayload);

  // Build config from n8n environment
  const config = {
    preferredProvider: getPhotoBriefEditorialPrimaryProvider(),
    homeLocation: {
      name: getPhotoWeatherLocation(),
      lat: getPhotoWeatherLat(),
      lon: getPhotoWeatherLon(),
      timezone: getPhotoWeatherTimezone(),
    },
    debug: {
      enabled: input.debugMode === true,
      emailTo: typeof input.debugEmailTo === 'string' ? input.debugEmailTo : '',
      source:
        typeof input.debugModeSource === 'string' && input.debugModeSource.trim().length > 0
          ? input.debugModeSource
          : input.debugMode === true
            ? 'workflow toggle'
            : 'workflow default',
    },
    triggerSource:
      typeof input.triggerSource === 'string' && input.triggerSource.trim().length > 0
        ? input.triggerSource.trim()
        : input.debugContext?.metadata?.triggerSource || null,
  };

  // Extract Gemini diagnostics from loose fields or use provided structured diagnostics
  const geminiDiagnostics = input.geminiDiagnostics as import('../../lib/debug-context.js').DebugGeminiDiagnostics | undefined
    ?? extractGeminiDiagnostics({
      geminiStatusCode: input.geminiStatusCode,
      geminiFinishReason: input.geminiFinishReason,
      geminiCandidateCount: input.geminiCandidateCount,
      geminiResponseByteLength: input.geminiResponseByteLength,
      geminiResponseTruncated: input.geminiResponseTruncated,
      geminiExtractionPath: input.geminiExtractionPath,
      geminiTopLevelKeys: input.geminiTopLevelKeys,
      geminiPayloadKeys: input.geminiPayloadKeys,
      geminiPartKinds: input.geminiPartKinds,
      geminiExtractedTextLength: input.geminiExtractedTextLength,
      geminiPromptTokenCount: input.geminiPromptTokenCount,
      geminiCandidatesTokenCount: input.geminiCandidatesTokenCount,
      geminiTotalTokenCount: input.geminiTotalTokenCount,
      geminiThoughtsTokenCount: input.geminiThoughtsTokenCount,
    });

  // Build raw editorial input
  const rawInput = {
    context: input,
    groqChoices: input.choices,
    geminiResponse: typeof input.geminiResponse === 'string' ? input.geminiResponse : undefined,
    geminiRawPayload: typeof input.geminiRawPayload === 'string' ? input.geminiRawPayload : undefined,
    geminiInspire: typeof input.geminiInspire === 'string' ? input.geminiInspire : undefined,
    geminiDiagnostics,
    nearbyAltNames: undefined, // Will be extracted from context
    longRangePool: undefined, // Will be extracted from context
  };

  // Call the app layer use case
  const result = finalizeBrief(rawInput, config);

  // Return in n8n format
  return [{
    json: {
      briefJson: result.briefJson,
      telegramMsg: result.telegramMsg,
      emailHtml: result.emailHtml,
      siteHtml: result.siteHtml,
      debugMode: result.debugMode,
      debugEmailTo: result.debugEmailTo,
      debugEmailHtml: result.debugEmailHtml,
      debugEmailSubject: result.debugEmailSubject,
    },
  }];
}
