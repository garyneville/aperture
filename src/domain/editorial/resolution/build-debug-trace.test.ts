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
      templateFallbackUsed: false,
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

  it('sets templateFallbackUsed=false when time-aware fallback is used (fallbackUsed=true)', () => {
    const trace = buildDebugAiTrace({
      selection: {
        primaryProvider: 'primary',
        selectedProvider: 'template',
        primaryCandidate: null,
        secondaryCandidate: null,
        selectedCandidate: null,
        componentCandidate: null,
        fallbackUsed: true,
      },
      finalAiText: 'Local peak is around 04:00 in the overnight astro window.',
      templateFallbackUsed: false,
      editorialGateway: buildEditorialGatewayPayload({
        groqRawText: '',
        geminiRawText: '',
      }),
      primaryRejectionReason: 'empty response body',
      secondaryRejectionReason: 'empty response body',
      bestSpurRaw: null,
      spurOfTheMoment: null,
      rawCompositionCount: 0,
      resolvedCompositionBullets: [],
      weekStandout: { text: null, used: false, decision: 'deterministic-used', hintAligned: false },
      weekStandoutHintCandidate: null,
    });

    // fallbackUsed is true because both providers failed
    expect(trace.fallbackUsed).toBe(true);
    // but templateFallbackUsed is false because time-aware fallback produced text
    expect(trace.templateFallbackUsed).toBe(false);
  });

  it('sets templateFallbackUsed=true when generic template fallback is used', () => {
    const trace = buildDebugAiTrace({
      selection: {
        primaryProvider: 'primary',
        selectedProvider: 'template',
        primaryCandidate: null,
        secondaryCandidate: null,
        selectedCandidate: null,
        componentCandidate: null,
        fallbackUsed: true,
      },
      finalAiText: 'No strong local photo window in Leeds today.',
      templateFallbackUsed: true,
      editorialGateway: buildEditorialGatewayPayload({
        groqRawText: '',
        geminiRawText: '',
      }),
      primaryRejectionReason: 'empty response body',
      secondaryRejectionReason: 'empty response body',
      bestSpurRaw: null,
      spurOfTheMoment: null,
      rawCompositionCount: 0,
      resolvedCompositionBullets: [],
      weekStandout: { text: null, used: false, decision: 'deterministic-used', hintAligned: false },
      weekStandoutHintCandidate: null,
    });

    expect(trace.fallbackUsed).toBe(true);
    expect(trace.templateFallbackUsed).toBe(true);
  });

  it('sets both fallbackUsed and templateFallbackUsed to false when a candidate is selected', () => {
    const trace = buildDebugAiTrace({
      selection: {
        primaryProvider: 'primary',
        selectedProvider: 'primary',
        primaryCandidate: {
          provider: 'groq',
          rawContent: 'groq raw',
          editorial: 'Editorial text',
          compositionBullets: [],
          weekInsight: null,
          spurRaw: null,
          parseResult: 'valid-structured',
          weekStandoutRawValue: null,
          normalizedAiText: 'Normalized text',
          factualCheck: { passed: true, rulesTriggered: [] },
          editorialCheck: { passed: true, rulesTriggered: [] },
          passed: true,
          reusableComponents: true,
        },
        secondaryCandidate: null,
        selectedCandidate: {
          provider: 'groq',
          rawContent: 'groq raw',
          editorial: 'Editorial text',
          compositionBullets: [],
          weekInsight: null,
          spurRaw: null,
          parseResult: 'valid-structured',
          weekStandoutRawValue: null,
          normalizedAiText: 'Normalized text',
          factualCheck: { passed: true, rulesTriggered: [] },
          editorialCheck: { passed: true, rulesTriggered: [] },
          passed: true,
          reusableComponents: true,
        },
        componentCandidate: null,
        fallbackUsed: false,
      },
      finalAiText: 'Normalized text',
      templateFallbackUsed: false,
      editorialGateway: buildEditorialGatewayPayload({
        groqRawText: 'groq raw',
        geminiRawText: '',
      }),
      primaryRejectionReason: null,
      secondaryRejectionReason: 'empty response body',
      bestSpurRaw: null,
      spurOfTheMoment: null,
      rawCompositionCount: 0,
      resolvedCompositionBullets: [],
      weekStandout: { text: null, used: false, decision: 'deterministic-used', hintAligned: false },
      weekStandoutHintCandidate: null,
    });

    expect(trace.fallbackUsed).toBe(false);
    expect(trace.templateFallbackUsed).toBe(false);
  });
});
