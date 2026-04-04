/**
 * Unit tests for finalizeBrief use case.
 *
 * These tests verify the runtime-independent seam of the finalize-brief
 * use case, ensuring proper orchestration of:
 * - Input normalization
 * - Debug context preparation
 * - Editorial resolution
 * - Debug context hydration
 * - Output rendering
 */

import { describe, expect, it } from 'vitest';
import { finalizeBrief } from './finalize-brief.js';
import { buildEditorialGatewayPayload, extractGeminiDiagnostics } from './editorial-gateway.js';
import type { FinalizeConfig, FinalizeRuntimeContext, RawEditorialInput } from './finalize-brief-contracts.js';

// Minimal valid FinalizeRuntimeContext for testing
function createMinimalBriefContext(): FinalizeRuntimeContext {
  return {
    today: '2026-04-03',
    dontBother: false,
    windows: [],
    dailySummary: [
      {
        dayLabel: 'Today',
        dateKey: '2026-04-03',
        dayIdx: 0,
        photoScore: 50,
        headlineScore: 50,
        photoEmoji: '🟡',
        amScore: 40,
        pmScore: 60,
        astroScore: 30,
        bestPhotoHour: '14:00',
        bestAstroHour: '22:00',
        bestTags: 'clear',
        carWash: {
          rating: 'good',
          label: 'Good conditions',
          score: 70,
          start: '14:00',
          end: '16:00',
          wind: 10,
          pp: 5,
          tmp: 15,
        },
      },
    ],
    todayCarWash: {
      rating: 'good',
      label: 'Good conditions',
      score: 70,
      start: '14:00',
      end: '16:00',
      wind: 10,
      pp: 5,
      tmp: 15,
    },
    altLocations: [],
    closeContenders: [],
    noAltsMsg: null,
    sunriseStr: '06:18',
    sunsetStr: '18:11',
    moonPct: 15,
    metarNote: '',
    todayBestScore: 50,
    shSunsetQ: null,
    shSunriseQ: null,
    shSunsetText: null,
    sunDir: null,
    crepPeak: 0,
    longRangeDebugCandidates: [],
    debugContext: {
      hourlyScoring: [],
      windows: [],
      nearbyAlternatives: [],
    },
  };
}

// Minimal valid FinalizeConfig for testing
function createMinimalConfig(): FinalizeConfig {
  return {
    preferredProvider: 'groq',
    homeLocation: {
      name: 'Test Location',
      lat: 53.8,
      lon: -1.5,
      timezone: 'Europe/London',
    },
    debug: {
      enabled: false,
      emailTo: '',
      source: '',
    },
    triggerSource: 'test',
  };
}

function createEditorialGateway(input: {
  groqRawText?: string;
  geminiRawText?: string;
} = {}) {
  return buildEditorialGatewayPayload({
    groqRawText: input.groqRawText,
    geminiRawText: input.geminiRawText,
  });
}

describe('finalizeBrief', () => {
  it('should return a finalized brief with all required outputs', () => {
    const input: RawEditorialInput = {
      context: createMinimalBriefContext(),
      editorialGateway: createEditorialGateway({ groqRawText: 'Test AI response' }),
    };
    const config = createMinimalConfig();

    const result = finalizeBrief(input, config);

    // Verify all required outputs are present
    expect(result.briefJson).toBeDefined();
    expect(result.telegramMsg).toBeDefined();
    expect(result.emailHtml).toBeDefined();
    expect(result.siteHtml).toBeDefined();
    expect(result.editorial).toBeDefined();
    expect(result.debugMode).toBe(false);
    expect(result.debugContext).toBeDefined();
  });

  it('should handle groq-only input', () => {
    const input: RawEditorialInput = {
      context: createMinimalBriefContext(),
      editorialGateway: createEditorialGateway({ groqRawText: 'Groq only response' }),
    };
    const config = createMinimalConfig();

    const result = finalizeBrief(input, config);

    expect(result.editorial.primaryProvider).toBe('primary');
    expect(result.editorial.aiText).toBeDefined();
  });

  it('should handle gemini-only input', () => {
    const input: RawEditorialInput = {
      context: createMinimalBriefContext(),
      editorialGateway: createEditorialGateway({ geminiRawText: 'Gemini only response' }),
    };
    const config = { ...createMinimalConfig(), preferredProvider: 'gemini' as const };

    const result = finalizeBrief(input, config);

    expect(result.editorial.primaryProvider).toBe('fallback');
    expect(result.editorial.aiText).toBeDefined();
  });

  it('should enable debug mode when configured', () => {
    const input: RawEditorialInput = {
      context: createMinimalBriefContext(),
      editorialGateway: createEditorialGateway({ groqRawText: 'Test response' }),
    };
    const config: FinalizeConfig = {
      ...createMinimalConfig(),
      debug: {
        enabled: true,
        emailTo: 'debug@example.com',
        source: 'test',
      },
    };

    const result = finalizeBrief(input, config);

    expect(result.debugMode).toBe(true);
    expect(result.debugEmailTo).toBe('debug@example.com');
    expect(result.debugEmailHtml).toBeDefined();
    expect(result.debugEmailSubject).toContain('Photo Brief Debug');
  });

  it('should populate metadata in debug context', () => {
    const input: RawEditorialInput = {
      context: createMinimalBriefContext(),
      editorialGateway: createEditorialGateway({ groqRawText: 'Test response' }),
    };
    const config = createMinimalConfig();

    const result = finalizeBrief(input, config);

    expect(result.debugContext.metadata).toBeDefined();
    expect(result.debugContext.metadata?.location).toBe('Test Location');
    expect(result.debugContext.metadata?.latitude).toBe(53.8);
    expect(result.debugContext.metadata?.longitude).toBe(-1.5);
    expect(result.debugContext.metadata?.timezone).toBe('Europe/London');
    expect(result.debugContext.metadata?.triggerSource).toBe('test');
  });

  it('should preserve existing debug context data', () => {
    const existingDebugContext = {
      hourlyScoring: [{ hour: '14:00', timestamp: '2026-04-03T14:00:00Z', final: 50, cloud: 20, visK: 20, aod: 0.1, moonAdjustment: 0, moonState: 'up', aodPenalty: 0, astroScore: 30, drama: 40, clarity: 60, mist: 10, moon: { altitudeDeg: 45, illuminationPct: 50, azimuthDeg: 180, isUp: true }, tags: ['clear'] }],
      windows: [{ label: 'Test', start: '14:00', end: '15:00', peak: 50, rank: 1, selected: true, fallback: false, selectionReason: 'test' }],
      nearbyAlternatives: [],
    };

    const input: RawEditorialInput = {
      context: {
        ...createMinimalBriefContext(),
        debugContext: existingDebugContext,
      },
      editorialGateway: createEditorialGateway({ groqRawText: 'Test response' }),
    };
    const config = createMinimalConfig();

    const result = finalizeBrief(input, config);

    expect(result.debugContext.hourlyScoring).toHaveLength(1);
    expect(result.debugContext.windows).toHaveLength(1);
  });
});

describe('extractGeminiDiagnostics', () => {
  it('should return undefined when no diagnostics provided', () => {
    const result = extractGeminiDiagnostics({});
    expect(result).toBeUndefined();
  });

  it('should extract status code', () => {
    const result = extractGeminiDiagnostics({ geminiStatusCode: 200 });
    expect(result?.statusCode).toBe(200);
  });

  it('should extract finish reason', () => {
    const result = extractGeminiDiagnostics({ geminiFinishReason: 'STOP' });
    expect(result?.finishReason).toBe('STOP');
  });

  it('should extract all diagnostic fields', () => {
    const input = {
      geminiStatusCode: 200,
      geminiFinishReason: 'STOP',
      geminiCandidateCount: 1,
      geminiResponseByteLength: 1024,
      geminiResponseTruncated: false,
      geminiExtractionPath: 'candidates[0].content.parts[0].text',
      geminiTopLevelKeys: ['candidates'],
      geminiPayloadKeys: ['content', 'parts'],
      geminiPartKinds: ['text'],
      geminiExtractedTextLength: 500,
      geminiPromptTokenCount: 1000,
      geminiCandidatesTokenCount: 100,
      geminiTotalTokenCount: 1100,
      geminiThoughtsTokenCount: 50,
    };

    const result = extractGeminiDiagnostics(input);

    expect(result).toEqual({
      statusCode: 200,
      finishReason: 'STOP',
      candidateCount: 1,
      responseByteLength: 1024,
      truncated: false,
      extractionPath: 'candidates[0].content.parts[0].text',
      topLevelKeys: ['candidates'],
      payloadKeys: ['content', 'parts'],
      partKinds: ['text'],
      extractedTextLength: 500,
      promptTokenCount: 1000,
      candidatesTokenCount: 100,
      totalTokenCount: 1100,
      thoughtsTokenCount: 50,
      retryAfter: null,
    });
  });

  it('should handle partial diagnostics', () => {
    const result = extractGeminiDiagnostics({
      geminiStatusCode: 500,
      geminiFinishReason: 'ERROR',
    });

    expect(result?.statusCode).toBe(500);
    expect(result?.finishReason).toBe('ERROR');
    expect(result?.candidateCount).toBeNull();
  });

  it('captures retry-after when Gemini exposes it', () => {
    const result = extractGeminiDiagnostics({
      geminiStatusCode: 429,
      geminiRetryAfter: 18,
    });

    expect(result?.statusCode).toBe(429);
    expect(result?.retryAfter).toBe(18);
  });
});

describe('buildEditorialGatewayPayload', () => {
  it('classifies malformed structured provider output at the gateway edge', () => {
    const gateway = buildEditorialGatewayPayload({
      groqRawText: '{"editorial":',
    });

    expect(gateway.groq.outcome).toBe('malformed');
    expect(gateway.groq.parseResult).toBe('malformed-structured');
  });

  it('attaches API call status metadata to provider results', () => {
    const gateway = buildEditorialGatewayPayload({
      geminiRawText: 'Plain text response',
      geminiDiagnostics: {
        statusCode: 200,
        finishReason: 'STOP',
        candidateCount: 1,
        responseByteLength: 512,
        truncated: false,
        candidatesTokenCount: 91,
      },
    });

    expect(gateway.gemini.apiCallStatus?.provider).toBe('gemini');
    expect(gateway.gemini.apiCallStatus?.message).toContain('Success');
  });
});
