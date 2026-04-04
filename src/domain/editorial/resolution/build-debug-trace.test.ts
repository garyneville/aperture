import { describe, expect, it } from 'vitest';
import { buildEditorialGatewayPayload } from '../../../app/run-photo-brief/editorial-gateway.js';
import { buildDebugAiTrace } from './build-debug-trace.js';

describe('buildDebugAiTrace', () => {
  it('maps slot-based debug fields from the configured primary provider', () => {
    const trace = buildDebugAiTrace({
      selection: {
        primaryProvider: 'primary',
        selectedProvider: 'fallback',
        primaryCandidate: {
          provider: 'groq',
          rawContent: 'groq raw',
          editorial: 'Groq editorial',
          compositionBullets: ['Groq bullet'],
          weekInsight: 'Groq week insight',
          spurRaw: null,
          parseResult: 'valid-structured',
          weekStandoutRawValue: 'Groq week insight',
          normalizedAiText: 'Normalized text',
          factualCheck: { passed: true, rulesTriggered: [] },
          editorialCheck: { passed: true, rulesTriggered: [] },
          passed: false,
          reusableComponents: true,
        },
        secondaryCandidate: {
          provider: 'gemini',
          rawContent: 'gemini raw',
          editorial: 'Gemini editorial',
          compositionBullets: ['Gemini bullet'],
          weekInsight: 'Gemini week insight',
          spurRaw: null,
          parseResult: 'valid-structured',
          weekStandoutRawValue: 'Gemini week insight',
          normalizedAiText: 'Normalized text',
          factualCheck: { passed: true, rulesTriggered: [] },
          editorialCheck: { passed: true, rulesTriggered: [] },
          passed: true,
          reusableComponents: true,
        },
        selectedCandidate: {
          provider: 'gemini',
          rawContent: 'gemini raw',
          editorial: 'Gemini editorial',
          compositionBullets: ['Gemini bullet'],
          weekInsight: 'Gemini week insight',
          spurRaw: null,
          parseResult: 'valid-structured',
          weekStandoutRawValue: 'Gemini week insight',
          normalizedAiText: 'Normalized text',
          factualCheck: { passed: true, rulesTriggered: [] },
          editorialCheck: { passed: true, rulesTriggered: [] },
          passed: true,
          reusableComponents: true,
        },
        componentCandidate: {
          provider: 'gemini',
          rawContent: 'gemini raw',
          editorial: 'Gemini editorial',
          compositionBullets: ['Gemini bullet'],
          weekInsight: 'Gemini week insight',
          spurRaw: null,
          parseResult: 'valid-structured',
          weekStandoutRawValue: 'Gemini week insight',
          normalizedAiText: 'Normalized text',
          factualCheck: { passed: true, rulesTriggered: [] },
          editorialCheck: { passed: true, rulesTriggered: [] },
          passed: true,
          reusableComponents: true,
        },
        fallbackUsed: false,
      },
      finalAiText: 'Final AI text',
      editorialGateway: buildEditorialGatewayPayload({
        groqRawText: 'groq raw',
        groqDiagnostics: {
          statusCode: 503,
          responseByteLength: 17,
        },
        geminiRawText: 'gemini raw',
        geminiRawPayload: '{"candidates":[]}',
        geminiDiagnostics: {
          statusCode: 200,
          finishReason: 'STOP',
          candidateCount: 1,
          responseByteLength: 33,
          truncated: false,
        },
      }),
      primaryRejectionReason: 'groq rejected',
      secondaryRejectionReason: null,
      bestSpurRaw: null,
      spurOfTheMoment: null,
      spurDropReason: null,
      rawCompositionCount: 1,
      resolvedCompositionBullets: ['Resolved bullet'],
      weekStandout: {
        text: 'Today is the best bet this week.',
        used: true,
        decision: 'deterministic-used',
        hintAligned: false,
        note: 'Used deterministic fallback.',
      },
      weekStandoutHintCandidate: {
        parseResult: 'valid-structured',
        weekStandoutRawValue: 'Gemini week insight',
      },
    });

    expect(trace.rawPrimaryResponse).toBe('groq raw');
    expect(trace.rawFallbackResponse).toBe('gemini raw');
    expect(trace.rawPrimaryPayload).toBeUndefined();
    expect(trace.primaryDiagnostics?.statusCode).toBe(503);
    expect(trace.fallbackDiagnostics?.statusCode).toBe(200);

    expect(trace.rawGroqResponse).toBe('groq raw');
    expect(trace.rawGeminiResponse).toBe('gemini raw');
    expect(trace.rawGeminiPayload).toBe('{"candidates":[]}');
    expect(trace.geminiDiagnostics?.statusCode).toBe(200);
    expect(trace.groqDiagnostics?.statusCode).toBe(503);
    expect(trace.compositionBullets?.resolved).toEqual(['Resolved bullet']);
  });
});
