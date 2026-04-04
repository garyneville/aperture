import { describe, expect, it } from 'vitest';
import { inspectGroqPrimary } from './inspect-groq-primary.adapter.js';

describe('inspectGroqPrimary', () => {
  it('keeps a usable primary Groq response on the fast path', () => {
    const content = JSON.stringify({
      editorial: 'Clear air holds through blue hour with the best light right at 19:40.',
      composition: ['Face west across the ridge line'],
      weekStandout: 'Tonight is the cleanest edge of the week.',
    });

    const result = inspectGroqPrimary({
      statusCode: 200,
      body: {
        choices: [{ message: { content } }],
      },
    });

    expect(result).toEqual({
      choices: [{ message: { content } }],
      groqStatusCode: 200,
      groqResponseByteLength: Buffer.byteLength(JSON.stringify({ choices: [{ message: { content } }] }), 'utf8'),
      groqRetryAfter: null,
      groqFallbackRequired: false,
      groqFallbackReason: null,
    });
  });

  it('requires fallback for rate-limited Groq responses', () => {
    const result = inspectGroqPrimary({
      statusCode: 429,
      headers: {
        'retry-after': '12',
      },
      body: {
        error: { message: 'Rate limited' },
      },
    });

    expect(result.groqStatusCode).toBe(429);
    expect(result.groqRetryAfter).toBe(12);
    expect(result.groqFallbackRequired).toBe(true);
    expect(result.groqFallbackReason).toBe('rate-limited');
  });

  it('requires fallback for malformed structured Groq output', () => {
    const result = inspectGroqPrimary({
      statusCode: 200,
      body: {
        choices: [{ message: { content: '{"editorial":' } }],
      },
    });

    expect(result.groqFallbackRequired).toBe(true);
    expect(result.groqFallbackReason).toBe('malformed-structured-output');
  });
});
