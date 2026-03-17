import { describe, expect, it } from 'vitest';
import { renderAiBriefingText } from './ai-briefing.js';

describe('renderAiBriefingText', () => {
  const baseCtx = {
    dontBother: false,
    windows: [{
      label: 'Overnight astro window',
      start: '04:00',
      end: '04:00',
      peak: 60,
      hours: [{ hour: '04:00', score: 60 }],
    }],
    dailySummary: [{
      bestPhotoHour: '04:00',
      astroScore: 72,
      bestAstroHour: '04:00',
    }],
    altLocations: [],
  };

  it('replaces a single-sentence card restatement with deterministic fallback copy', () => {
    const result = renderAiBriefingText(
      'Overnight astro window at 04:00 scores 60/100, peak time with 20.5km visibility.',
      baseCtx,
    );

    expect(result.usedFallback).toBe(true);
    expect(result.text).toContain('Best conditions are around 04:00 in the overnight astro window.');
    expect(result.text).toContain('The window tops out at 60/100 overall — cloud or haze weigh it down from the raw astro peak of 72/100 (04:00).');
  });

  it('strips a redundant opener when a useful second sentence follows', () => {
    const result = renderAiBriefingText(
      'Overnight astro window at 04:00 scores 60/100, peak time with 20.5km visibility. Darker skies arrive after moonset, so the wider night still carries more promise than this narrow slot.',
      baseCtx,
    );

    expect(result.usedFallback).toBe(false);
    expect(result.strippedOpener).toBe(true);
    expect(result.text).toBe('Darker skies arrive after moonset, so the wider night still carries more promise than this narrow slot.');
  });

  it('strips an AI sentence that names an alternative location (strict Leeds-only editorial)', () => {
    const ctx = {
      ...baseCtx,
      altLocations: [{ name: 'Sutton Bank', bestScore: 85, driveMins: 75, darkSky: true }],
    };

    const result = renderAiBriefingText(
      'Transparency is improving through the night, making this a solid astro window. Sutton Bank adds 25 points with darker skies at 04:00.',
      ctx,
    );

    expect(result.text).not.toContain('Sutton Bank');
    expect(result.text).toContain('Transparency is improving through the night');
    expect(result.usedFallback).toBe(false);
  });

  it('falls back to deterministic copy when all AI sentences mention an alternative location', () => {
    const ctx = {
      ...baseCtx,
      altLocations: [{ name: 'Malham Cove', bestScore: 90, driveMins: 55, darkSky: true }],
    };

    const result = renderAiBriefingText(
      'Malham Cove is the standout tonight with exceptional skies.',
      ctx,
    );

    expect(result.text).not.toContain('Malham Cove');
    expect(result.usedFallback).toBe(true);
  });

  it('does not filter sentences when altLocations is empty', () => {
    const aiText = 'Transparency holds across the window, giving a clean shot at the rising Milky Way core. The seeing tonight is unusually stable for March.';

    const result = renderAiBriefingText(aiText, baseCtx);

    expect(result.text).toBe(aiText);
    expect(result.usedFallback).toBe(false);
  });

  it('does not strip sentences where the alt name is only a substring of another word (word-boundary safety)', () => {
    const ctx = {
      ...baseCtx,
      // alt name "Bank" should not match "riverbank" or "Bankside"
      altLocations: [{ name: 'Bank', bestScore: 80, driveMins: 90 }],
    };

    const aiText = 'Transparency holds well, and the riverbank at Otley makes an excellent foreground. The window is narrow but rewarding.';

    const result = renderAiBriefingText(aiText, ctx);

    // "riverbank" should NOT trigger the filter — only standalone "Bank" would
    expect(result.text).toBe(aiText);
    expect(result.usedFallback).toBe(false);
  });
});
