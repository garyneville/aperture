import { describe, expect, it } from 'vitest';
import { prepareDebugContext } from './prepare-debug-context.js';

describe('prepareDebugContext', () => {
  it('returns a trimmed debug mode source when configured', () => {
    const prepared = prepareDebugContext(
      { context: {} as never },
      {
        preferredProvider: 'groq',
        homeLocation: {
          name: 'Leeds',
          lat: 53.8,
          lon: -1.55,
          timezone: 'Europe/London',
        },
        debug: {
          enabled: true,
          emailTo: 'debug@example.com',
          source: ' manual-trigger ',
        },
        triggerSource: null,
      },
    );

    expect(prepared.debugModeSource).toBe('manual-trigger');
  });

  it('falls back to toggle when the configured source is blank', () => {
    const prepared = prepareDebugContext(
      { context: {} as never },
      {
        preferredProvider: 'groq',
        homeLocation: {
          name: 'Leeds',
          lat: 53.8,
          lon: -1.55,
          timezone: 'Europe/London',
        },
        debug: {
          enabled: true,
          emailTo: 'debug@example.com',
          source: '   ',
        },
        triggerSource: null,
      },
    );

    expect(prepared.debugModeSource).toBe('toggle');
  });
});
