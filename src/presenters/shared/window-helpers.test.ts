import { describe, expect, it } from 'vitest';
import { moonAstroContext } from './window-helpers.js';

describe('moonAstroContext', () => {
  // ── Low illumination (unchanged behaviour) ──────────────────────────────

  it('returns dark-skies message for very low moon illumination', () => {
    expect(moonAstroContext(10)).toContain('Dark skies');
  });

  it('returns low-glow message for crescent moon', () => {
    expect(moonAstroContext(35)).toContain('Low moon glow');
  });

  it('returns moderate message for half moon', () => {
    expect(moonAstroContext(60)).toContain('Moderate moon');
  });

  // ── Bright moon with altitude data ──────────────────────────────────────

  it('reports moon below horizon when altitude is negative and astro window exists', () => {
    const result = moonAstroContext(86, true, -19.3);
    expect(result).toContain('below horizon');
    expect(result).toContain('astro viable');
    expect(result).not.toContain('poor for astrophotography');
  });

  it('reports moon below horizon when altitude is negative without astro window flag', () => {
    const result = moonAstroContext(86, false, -10);
    expect(result).toContain('below horizon');
    expect(result).toContain('viable');
    expect(result).not.toContain('poor for astrophotography');
  });

  it('reports moon below horizon for full moon (>90%) when altitude is negative', () => {
    const result = moonAstroContext(95, false, -5);
    expect(result).toContain('below horizon');
    expect(result).not.toContain('avoid astrophotography');
  });

  it('treats moon at exactly 0° as below horizon', () => {
    const result = moonAstroContext(80, true, 0);
    expect(result).toContain('below horizon');
  });

  // ── Bright moon above horizon (existing behaviour preserved) ────────────

  it('falls back to "sets during" message when moon is above horizon with astro window', () => {
    const result = moonAstroContext(86, true, 15);
    expect(result).toContain('sets during late-night astro windows');
  });

  it('shows poor-for-astrophotography when bright moon is above horizon without astro window', () => {
    const result = moonAstroContext(86, false, 15);
    expect(result).toContain('poor for astrophotography');
  });

  it('shows avoid-astrophotography for full moon above horizon', () => {
    const result = moonAstroContext(95, false, 30);
    expect(result).toContain('avoid astrophotography');
  });

  // ── Null altitude (unknown — preserves existing behaviour) ──────────────

  it('preserves existing behaviour when moon altitude is null and astro window exists', () => {
    const result = moonAstroContext(86, true, null);
    expect(result).toContain('sets during late-night astro windows');
  });

  it('preserves existing behaviour when moon altitude is null and no astro window', () => {
    const result = moonAstroContext(86, false, null);
    expect(result).toContain('poor for astrophotography');
  });

  it('preserves existing behaviour when moon altitude is not provided', () => {
    const result = moonAstroContext(86, false);
    expect(result).toContain('poor for astrophotography');
  });

  it('preserves full-moon warning when altitude is null', () => {
    const result = moonAstroContext(95, false, null);
    expect(result).toContain('avoid astrophotography');
  });
});
