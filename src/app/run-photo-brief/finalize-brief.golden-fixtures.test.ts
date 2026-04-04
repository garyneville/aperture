/**
 * Golden Fixture Tests for finalizeBrief
 *
 * These tests provide baseline and guardrails for editorial behavior.
 * They use fixture files to test specific scenarios and verify:
 * - final briefJson structure (snapshot-style assertions)
 * - debug output invariants
 * - provider selection and fallback behavior
 *
 * Part of Phase 0 — Baseline and guardrails (Issue #169)
 */

import { describe, expect, it } from 'vitest';
import { finalizeBrief } from './finalize-brief.js';
import type { FinalizeConfig, RawEditorialInput, FinalizeRuntimeContext } from './finalize-brief-contracts.js';
import { buildEditorialGatewayPayload } from './editorial-gateway.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to golden fixtures
const FIXTURES_DIR = join(__dirname, '../../../fixtures/golden');

/**
 * Load a golden fixture file
 */
type GoldenFixtureFile = {
  scenario: string;
  description: string;
  context: FinalizeRuntimeContext;
  groqChoices?: Array<{ message?: { content?: string } }>;
  geminiResponse?: string;
  geminiRawPayload?: string;
  geminiInspire?: string;
  preferredProvider?: string;
  homeLocation?: {
    name?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
  };
  debug?: {
    enabled?: boolean;
    emailTo?: string;
  };
};

function loadFixture(name: string): RawEditorialInput & GoldenFixtureFile {
  const path = join(FIXTURES_DIR, `${name}.json`);
  const content = readFileSync(path, 'utf-8');
  const fixture = JSON.parse(content) as GoldenFixtureFile;

  return {
    ...fixture,
    editorialGateway: buildEditorialGatewayPayload({
      groqRawText: fixture.groqChoices?.[0]?.message?.content,
      geminiRawText: fixture.geminiResponse,
      geminiRawPayload: fixture.geminiRawPayload,
    }),
  };
}

/**
 * Create base config from fixture data
 */
function createConfigFromFixture(fixture: GoldenFixtureFile): FinalizeConfig {
  return {
    preferredProvider: fixture.preferredProvider === 'gemini' ? 'gemini' : 'groq',
    homeLocation: {
      name: fixture.homeLocation?.name || 'Test Location',
      lat: fixture.homeLocation?.lat ?? 53.8,
      lon: fixture.homeLocation?.lon ?? -1.5,
      timezone: fixture.homeLocation?.timezone || 'Europe/London',
    },
    debug: {
      enabled: fixture.debug?.enabled ?? false,
      emailTo: fixture.debug?.emailTo || '',
      source: 'golden-fixture-test',
    },
    triggerSource: 'golden-fixture-test',
  };
}

describe('Golden Fixtures - finalizeBrief E2E', () => {
  describe('Scenario: good-local-window', () => {
    const fixture = loadFixture('good-local-window');
    const config = createConfigFromFixture(fixture);
    const result = finalizeBrief(fixture, config);

    it('should produce a valid briefJson with editorial content', () => {
      expect(result.briefJson).toBeDefined();
      expect(result.briefJson.aiText).toBeTruthy();
      expect(result.briefJson.aiText.length).toBeGreaterThan(0);
    });

    it('should use groq as selected provider (preferred provider succeeded)', () => {
      expect(result.editorial.selectedProvider).toBe('groq');
      expect(result.editorial.primaryProvider).toBe('groq');
    });

    it('should NOT use fallback', () => {
      expect(result.editorial.fallbackUsed).toBe(false);
    });

    it('should have composition bullets from AI response', () => {
      expect(result.briefJson.compositionBullets).toBeDefined();
      expect(Array.isArray(result.briefJson.compositionBullets)).toBe(true);
    });

    it('should have week insight present', () => {
      expect(result.editorial.weekInsight).toBeTruthy();
      expect(result.editorial.weekInsight.length).toBeGreaterThan(0);
    });

    it('should have debug context with correct provider info', () => {
      expect(result.debugContext.ai).toBeDefined();
      expect(result.debugContext.ai?.selectedProvider).toBe('groq');
      expect(result.debugContext.ai?.fallbackUsed).toBe(false);
    });

    it('should have window info in briefJson', () => {
      expect(result.briefJson.windows).toBeDefined();
      expect(result.briefJson.windows.length).toBeGreaterThan(0);
      expect(result.briefJson.windows[0].peak).toBe(78);
    });

    it('should NOT have dontBother flag set', () => {
      expect(result.briefJson.dontBother).toBe(false);
    });
  });

  describe('Scenario: dont-bother', () => {
    const fixture = loadFixture('dont-bother');
    const config = createConfigFromFixture(fixture);
    const result = finalizeBrief(fixture, config);

    it('should produce a valid briefJson', () => {
      expect(result.briefJson).toBeDefined();
    });

    it('should have dontBother flag set', () => {
      expect(result.briefJson.dontBother).toBe(true);
    });

    it('should use groq as selected provider', () => {
      expect(result.editorial.selectedProvider).toBe('groq');
    });

    it('should NOT use fallback (AI response is valid)', () => {
      expect(result.editorial.fallbackUsed).toBe(false);
    });

    it('should include alternative location info in editorial', () => {
      // Should mention alternative locations since dontBother is true
      expect(result.editorial.aiText).toBeTruthy();
    });

    it('should have empty windows array in briefJson', () => {
      expect(result.briefJson.windows).toBeDefined();
      expect(result.briefJson.windows.length).toBe(0);
    });

    it('should have low headline score in context', () => {
      expect(result.briefJson.todayBestScore).toBeLessThan(40);
    });

    it('should have debug context with fallbackUsed false', () => {
      expect(result.debugContext.ai?.fallbackUsed).toBe(false);
    });
  });

  describe('Scenario: groq-succeeds-gemini-empty', () => {
    const fixture = loadFixture('groq-succeeds-gemini-empty');
    const config = createConfigFromFixture(fixture);
    const result = finalizeBrief(fixture, config);

    it('should produce a valid briefJson with editorial from Groq', () => {
      expect(result.briefJson).toBeDefined();
      expect(result.briefJson.aiText).toBeTruthy();
    });

    it('should use groq as selected provider (gemini empty)', () => {
      expect(result.editorial.selectedProvider).toBe('groq');
      expect(result.editorial.primaryProvider).toBe('groq');
    });

    it('should NOT use fallback (Groq succeeded)', () => {
      expect(result.editorial.fallbackUsed).toBe(false);
    });

    it('should have debug context showing gemini response was empty', () => {
      expect(result.debugContext.ai?.rawGeminiResponse).toBe('');
    });

    it('should have editorial.aiText derived from Groq response', () => {
      expect(result.editorial.aiText).toContain('16:00');
    });
  });

  describe('Scenario: groq-malformed-gemini-usable', () => {
    const fixture = loadFixture('groq-malformed-gemini-usable');
    const config = createConfigFromFixture(fixture);
    const result = finalizeBrief(fixture, config);

    it('should produce a valid briefJson with editorial content', () => {
      expect(result.briefJson).toBeDefined();
      expect(result.briefJson.aiText).toBeTruthy();
    });

    it('should use gemini as selected provider (model fallback)', () => {
      // Groq is preferred but malformed, so should fallback to Gemini
      expect(result.editorial.selectedProvider).toBe('gemini');
      expect(result.editorial.primaryProvider).toBe('groq');
    });

    it('should NOT use template fallback (Gemini usable)', () => {
      expect(result.editorial.fallbackUsed).toBe(false);
    });

    it('should have modelFallbackUsed in debug trace', () => {
      expect(result.debugContext.ai?.modelFallbackUsed).toBe(true);
    });

    it('should have week insight from Gemini response', () => {
      expect(result.editorial.weekInsight).toContain('Monday morning');
    });

    it('should have composition bullets from Gemini', () => {
      expect(result.briefJson.compositionBullets?.length).toBeGreaterThan(0);
    });

    it('should capture groq rejection reason in debug trace', () => {
      expect(result.debugContext.ai?.primaryRejectionReason).toBeTruthy();
    });
  });

  describe('Scenario: both-fail-template-fallback', () => {
    const fixture = loadFixture('both-fail-template-fallback');
    const config = createConfigFromFixture(fixture);
    const result = finalizeBrief(fixture, config);

    it('should produce a valid briefJson', () => {
      expect(result.briefJson).toBeDefined();
    });

    it('should use template as selected provider (both AI failed)', () => {
      expect(result.editorial.selectedProvider).toBe('template');
    });

    it('should use fallback (template fallback)', () => {
      expect(result.editorial.fallbackUsed).toBe(true);
    });

    it('should have fallback text in editorial.aiText', () => {
      expect(result.editorial.aiText).toBeTruthy();
      // Template fallback should mention the window
      expect(result.editorial.aiText).toContain('evening');
    });

    it('should have fallbackUsed true in debug trace', () => {
      expect(result.debugContext.ai?.fallbackUsed).toBe(true);
    });

    it('should have primaryRejectionReason in debug trace', () => {
      expect(result.debugContext.ai?.primaryRejectionReason).toBeTruthy();
    });

    it('should have secondaryRejectionReason in debug trace', () => {
      expect(result.debugContext.ai?.secondaryRejectionReason).toBeTruthy();
    });

    it('should still have window info in briefJson', () => {
      expect(result.briefJson.windows).toBeDefined();
      expect(result.briefJson.windows.length).toBeGreaterThan(0);
    });
  });
});

describe('Golden Fixtures - Debug Output Invariants', () => {
  describe('Debug trace structure validation', () => {
    const fixture = loadFixture('good-local-window');
    const config = createConfigFromFixture(fixture);
    const result = finalizeBrief(fixture, config);

    it('should have debugAiTrace with required fields', () => {
      const trace = result.debugContext.ai;
      expect(trace).toBeDefined();

      // Provider info
      expect(trace?.primaryProvider).toBeDefined();
      expect(trace?.selectedProvider).toBeDefined();
      expect(['groq', 'gemini', 'template']).toContain(trace?.selectedProvider);

      // Fallback info
      expect(typeof trace?.fallbackUsed).toBe('boolean');
      expect(typeof trace?.modelFallbackUsed).toBe('boolean');

      // Check info
      expect(trace?.factualCheck).toBeDefined();
      expect(trace?.editorialCheck).toBeDefined();
      expect(typeof trace?.factualCheck?.passed).toBe('boolean');
      expect(Array.isArray(trace?.factualCheck?.rulesTriggered)).toBe(true);

      // Raw responses
      expect(typeof trace?.rawGroqResponse).toBe('string');

      // Final text
      expect(typeof trace?.finalAiText).toBe('string');
    });

    it('should have spurSuggestion debug info', () => {
      const spur = result.debugContext.ai?.spurSuggestion;
      expect(spur).toBeDefined();
      expect(typeof spur?.dropped).toBe('boolean');
      // raw, confidence, resolved may be null
    });

    it('should have weekStandout debug info', () => {
      const weekStandout = result.debugContext.ai?.weekStandout;
      expect(weekStandout).toBeDefined();
      expect(weekStandout?.parseResult).toMatch(/^(valid-structured|raw-text-only|malformed-structured)$/);
      expect(typeof weekStandout?.used).toBe('boolean');
    });

    it('should have compositionBullets debug info', () => {
      const bullets = result.debugContext.ai?.compositionBullets;
      expect(bullets).toBeDefined();
      expect(typeof bullets?.rawCount).toBe('number');
      expect(typeof bullets?.resolvedCount).toBe('number');
      expect(Array.isArray(bullets?.resolved)).toBe(true);
    });
  });

  describe('Week insight presence/absence detection', () => {
    it('should detect week insight present when groq provides it', () => {
      const fixture = loadFixture('good-local-window');
      const config = createConfigFromFixture(fixture);
      const result = finalizeBrief(fixture, config);

      expect(result.editorial.weekInsight).toBeTruthy();
      expect(result.debugContext.ai?.weekStandout?.parseResult).toBe('valid-structured');
      expect(result.debugContext.ai?.weekStandout?.used).toBe(true);
    });

    it('should handle week insight absence', () => {
      const fixture = loadFixture('groq-succeeds-gemini-empty');
      const config = createConfigFromFixture(fixture);
      const result = finalizeBrief(fixture, config);

      // Empty weekStandout should be handled gracefully
      expect(result.debugContext.ai?.weekStandout).toBeDefined();
    });
  });

  describe('Spur dropped/kept detection', () => {
    it('should track spur suggestion status in debug trace', () => {
      const fixture = loadFixture('good-local-window');
      const config = createConfigFromFixture(fixture);
      const result = finalizeBrief(fixture, config);

      const spur = result.debugContext.ai?.spurSuggestion;
      expect(spur).toBeDefined();
      expect(typeof spur?.dropped).toBe('boolean');
      // dropReason should be present when dropped
      if (spur?.dropped) {
        expect(spur?.dropReason).toBeDefined();
      }
    });
  });
});

describe('Golden Fixtures - briefJson Snapshot Assertions', () => {
  describe('briefJson structure validation', () => {
    const fixture = loadFixture('good-local-window');
    const config = createConfigFromFixture(fixture);
    const result = finalizeBrief(fixture, config);
    const json = result.briefJson;

    it('should have all required top-level fields', () => {
      expect(json.windows).toBeDefined();
      expect(json.altLocations).toBeDefined();
      expect(json.aiText).toBeDefined();
      expect(json.compositionBullets).toBeDefined();
      expect(json.weekInsight).toBeDefined();
      expect(json.dontBother).toBeDefined();
      expect(json.todayCarWash).toBeDefined();
      expect(json.sunriseStr).toBeDefined();
      expect(json.sunsetStr).toBeDefined();
      expect(json.moonPct).toBeDefined();
      expect(json.location).toBeDefined();
      expect(json.generatedAt).toBeDefined();
    });

    it('should have correct top-level scoring structure', () => {
      expect(json.todayBestScore).toBe(78);
      expect(json.dailySummary[0]?.photoScore).toBe(78);
      expect(json.dailySummary[0]?.dayLabel).toBe('Today');
    });

    it('should have correct window structure', () => {
      expect(json.windows.length).toBeGreaterThan(0);
      const window = json.windows[0];
      expect(window.label).toBe('Evening golden hour');
      expect(window.start).toBe('18:30');
      expect(window.end).toBe('19:30');
      expect(window.peak).toBe(78);
      expect(Array.isArray(window.hours)).toBe(true);
    });

    it('should have correct altLocations structure', () => {
      expect(json.altLocations.length).toBeGreaterThan(0);
      const alt = json.altLocations[0];
      expect(alt.name).toBe('Ilkley Moor');
      expect(alt.bestScore).toBe(82);
      expect(alt.driveMins).toBe(25);
    });

    it('should have correct sun timing structure', () => {
      expect(json.sunriseStr).toBe('06:15');
      expect(json.sunsetStr).toBe('19:45');
    });

    it('should have correct moon and car-wash structure', () => {
      expect(json.moonPct).toBeDefined();
      expect(json.todayCarWash.score).toBeDefined();
      expect(json.todayCarWash.label).toBeDefined();
    });
  });

  describe('briefJson for dont-bother scenario', () => {
    const fixture = loadFixture('dont-bother');
    const config = createConfigFromFixture(fixture);
    const result = finalizeBrief(fixture, config);
    const json = result.briefJson;

    it('should have dontBother flag set', () => {
      expect(json.dontBother).toBe(true);
    });

    it('should have alternative location suggestions', () => {
      expect(json.altLocations.length).toBeGreaterThan(0);
    });

    it('should have empty or minimal windows', () => {
      expect(json.windows.length).toBe(0);
    });

    it('should have low headline score', () => {
      expect(json.todayBestScore).toBeLessThan(40);
    });
  });
});

describe('Golden Fixtures - Provider Selection Matrix', () => {
  const scenarios = [
    { name: 'good-local-window', expectedProvider: 'groq', fallbackUsed: false },
    { name: 'dont-bother', expectedProvider: 'groq', fallbackUsed: false },
    { name: 'groq-succeeds-gemini-empty', expectedProvider: 'groq', fallbackUsed: false },
    { name: 'groq-malformed-gemini-usable', expectedProvider: 'gemini', fallbackUsed: false },
    { name: 'both-fail-template-fallback', expectedProvider: 'template', fallbackUsed: true },
  ] as const;

  scenarios.forEach(({ name, expectedProvider, fallbackUsed }) => {
    describe(`Scenario: ${name}`, () => {
      const fixture = loadFixture(name);
      const config = createConfigFromFixture(fixture);
      const result = finalizeBrief(fixture, config);

      it(`should select provider: ${expectedProvider}`, () => {
        expect(result.editorial.selectedProvider).toBe(expectedProvider);
      });

      it(`should have fallbackUsed: ${fallbackUsed}`, () => {
        expect(result.editorial.fallbackUsed).toBe(fallbackUsed);
      });

      it('should have matching debug trace values', () => {
        expect(result.debugContext.ai?.selectedProvider).toBe(expectedProvider);
        expect(result.debugContext.ai?.fallbackUsed).toBe(fallbackUsed);
      });
    });
  });
});
