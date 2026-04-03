import { describe, expect, it } from 'vitest';
import type { CandidateSelectionResult } from './candidate-selection.js';
import { resolveEditorialComponents } from './resolve-components.js';
import type { EditorialCandidate } from './types.js';

function makeCandidate(overrides: Partial<EditorialCandidate> = {}): EditorialCandidate {
  return {
    provider: 'groq',
    rawContent: '{}',
    editorial: 'Conditions improve later.',
    compositionBullets: [],
    weekInsight: '',
    spurRaw: null,
    weekStandoutParseStatus: 'absent',
    weekStandoutRawValue: null,
    normalizedAiText: 'Conditions improve later.',
    factualCheck: { passed: true, rulesTriggered: [] },
    editorialCheck: { passed: true, rulesTriggered: [] },
    passed: true,
    reusableComponents: true,
    ...overrides,
  };
}

describe('resolveEditorialComponents', () => {
  it('keeps reusable fallback components while filtering remote bullets and explaining a dropped spur', () => {
    const componentCandidate = makeCandidate({
      compositionBullets: [
        'Shoot tree silhouettes at sunrise',
        'Capture star trails at Brimham Rocks',
      ],
      spurRaw: {
        locationName: 'Aysgarth Falls',
        hookLine: 'Soft overcast and full flow make the falls worth the drive today.',
        confidence: 0.8,
      },
      passed: false,
    });

    const selection: CandidateSelectionResult = {
      primaryProvider: 'groq',
      selectedProvider: 'template',
      primaryCandidate: componentCandidate,
      secondaryCandidate: null,
      selectedCandidate: null,
      componentCandidate,
      fallbackUsed: true,
    };

    const result = resolveEditorialComponents({
      selection,
      ctx: {
        windows: [{
          label: 'Best chance around sunrise',
          start: '07:00',
          end: '07:00',
          peak: 36,
          tops: ['clear light path'],
          hours: [{ hour: '07:00', score: 36 }],
        }],
        dailySummary: [{ dayIdx: 0, bestPhotoHour: '07:00' }],
        altLocations: [{ name: 'Brimham Rocks', driveMins: 40 }],
      },
      nearbyAltNames: ['Aysgarth Falls'],
    });

    expect(result.bestSpurRaw?.locationName).toBe('Aysgarth Falls');
    expect(result.spurOfTheMoment).toBeNull();
    expect(result.spurDropReason).toBe('already scored in nearby alternatives');
    expect(result.compositionBullets).toContain('Shoot tree silhouettes at sunrise');
    expect(result.compositionBullets.some(bullet => bullet.includes('Brimham Rocks'))).toBe(false);
    expect(result.weekStandout.text).toContain('best bet this week');
  });

  it('falls back to secondary reusable week insight and composition when the selected candidate leaves them empty', () => {
    const primaryCandidate = makeCandidate({
      provider: 'gemini',
      compositionBullets: [],
      weekInsight: '',
    });
    const secondaryCandidate = makeCandidate({
      provider: 'groq',
      compositionBullets: ['Set a dark ridge low in the frame for the cleanest sky late in the slot.'],
      weekInsight: 'Friday is the standout day.',
      weekStandoutParseStatus: 'present',
      weekStandoutRawValue: 'Friday is the standout day.',
    });

    const selection: CandidateSelectionResult = {
      primaryProvider: 'gemini',
      selectedProvider: 'gemini',
      primaryCandidate,
      secondaryCandidate,
      selectedCandidate: primaryCandidate,
      componentCandidate: primaryCandidate,
      fallbackUsed: false,
    };

    const result = resolveEditorialComponents({
      selection,
      ctx: {
        windows: [{
          label: 'Evening astro window',
          start: '21:00',
          end: '23:00',
          peak: 48,
          tops: ['astrophotography'],
          hours: [{ hour: '22:00', score: 48 }],
        }],
        dailySummary: [
          { dayIdx: 0, dayLabel: 'Today', headlineScore: 44 },
          { dayIdx: 1, dayLabel: 'Friday', headlineScore: 57 },
        ],
        altLocations: [],
      },
    });

    expect(result.weekStandout.text).toBe('Friday is the standout day.');
    expect(result.weekStandout.usedRaw).toBe(true);
    expect(result.compositionBullets[0]).toBe('Set a dark ridge low in the frame for the cleanest sky late in the slot.');
    expect(result.compositionBullets).toHaveLength(2);
  });
});
