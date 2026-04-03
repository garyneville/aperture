import { describe, expect, it } from 'vitest';
import { extractGeminiInspire } from './extract-gemini-inspire.adapter.js';

describe('extractGeminiInspire', () => {
  it('trims trailing partial sentences from Gemini inspire text', () => {
    const inspire = extractGeminiInspire({
      candidates: [{
        content: {
          parts: [
            { text: 'Follow the last amber band over the moor. Let the ridge line hold the frame while ' },
            { text: 'the valley starts to hush' },
          ],
        },
      }],
    });

    expect(inspire).toBe('Follow the last amber band over the moor.');
  });

  it('returns the full text when no sentence terminator is present', () => {
    const inspire = extractGeminiInspire({
      body: {
        candidates: [{
          content: {
            parts: [{ text: 'Chase the stillness above the reservoir' }],
          },
        }],
      },
    });

    expect(inspire).toBe('Chase the stillness above the reservoir');
  });
});
