import { describe, expect, it } from 'vitest';
import { extractGeminiFallback } from './extract-gemini-fallback.adapter.js';

describe('extractGeminiFallback', () => {
  it('preserves diagnostics through wrapped response shapes', () => {
    const result = extractGeminiFallback({
      statusCode: 200,
      body: {
        data: {
          candidates: [{
            finishReason: 'MAX_TOKENS',
            content: {
              parts: [
                { text: '{"editorial":"The moon sets before ', thoughtSignature: 'sig-1' },
                { text: 'the midnight astro window begins.","composition":["Face north"]}' },
              ],
            },
          }],
          usageMetadata: {
            promptTokenCount: 124,
            candidatesTokenCount: 178,
            totalTokenCount: 1006,
            thoughtsTokenCount: 704,
          },
        },
      },
    });

    expect(result).toEqual({
      geminiResponse: '{"editorial":"The moon sets before the midnight astro window begins.","composition":["Face north"]}',
      geminiStatusCode: 200,
      geminiFinishReason: 'MAX_TOKENS',
      geminiCandidateCount: 1,
      geminiResponseByteLength: expect.any(Number),
      geminiResponseTruncated: true,
      geminiRawPayload: expect.stringContaining('"thoughtsTokenCount":704'),
      geminiExtractionPath: 'item.body.data',
      geminiTopLevelKeys: ['statusCode', 'body'],
      geminiPayloadKeys: ['candidates', 'usageMetadata'],
      geminiPartKinds: ['text', 'thoughtSignature'],
      geminiExtractedTextLength: expect.any(Number),
      geminiPromptTokenCount: 124,
      geminiCandidatesTokenCount: 178,
      geminiTotalTokenCount: 1006,
      geminiThoughtsTokenCount: 704,
    });
  });

  it('decodes buffered full-response bodies', () => {
    const rawGeminiBody = JSON.stringify({
      candidates: [{
        finishReason: 'STOP',
        content: {
          parts: [
            { text: '{"editorial":"Golden light breaks cleanly through the last clear band.","composition":["Face west across the ridge"],"weekStandout":"Tonight is the cleanest shot this week."}', thoughtSignature: 'sig-2' },
          ],
        },
      }],
      usageMetadata: {
        promptTokenCount: 88,
        candidatesTokenCount: 42,
        totalTokenCount: 130,
        thoughtsTokenCount: 19,
      },
    });
    const splitIndex = Math.floor(rawGeminiBody.length / 2);
    const bufferedBody = {
      _readableState: {
        buffer: [
          { type: 'Buffer', data: Array.from(Buffer.from(rawGeminiBody.slice(0, splitIndex), 'utf8')) },
          { type: 'Buffer', data: Array.from(Buffer.from(rawGeminiBody.slice(splitIndex), 'utf8')) },
        ],
      },
    };

    const result = extractGeminiFallback({
      body: bufferedBody,
      headers: { 'content-type': 'application/json' },
      statusCode: 200,
      statusMessage: 'OK',
    });

    expect(result).toEqual({
      geminiResponse: '{"editorial":"Golden light breaks cleanly through the last clear band.","composition":["Face west across the ridge"],"weekStandout":"Tonight is the cleanest shot this week."}',
      geminiStatusCode: 200,
      geminiFinishReason: 'STOP',
      geminiCandidateCount: 1,
      geminiResponseByteLength: Buffer.byteLength(rawGeminiBody, 'utf8'),
      geminiResponseTruncated: false,
      geminiRawPayload: rawGeminiBody,
      geminiExtractionPath: 'item.body._readableState.buffer (decoded) (parsed)',
      geminiTopLevelKeys: ['body', 'headers', 'statusCode', 'statusMessage'],
      geminiPayloadKeys: ['candidates', 'usageMetadata'],
      geminiPartKinds: ['text', 'thoughtSignature'],
      geminiExtractedTextLength: expect.any(Number),
      geminiPromptTokenCount: 88,
      geminiCandidatesTokenCount: 42,
      geminiTotalTokenCount: 130,
      geminiThoughtsTokenCount: 19,
    });
  });
});
