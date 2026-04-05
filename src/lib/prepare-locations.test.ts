import { describe, expect, it } from 'vitest';
import { prepareAltLocations } from './prepare-alt-locations.js';
import { prepareLongRangeLocations } from './prepare-long-range.js';

describe('forecast URL builders', () => {
  it('keeps alt location requests on supported Open-Meteo daily fields', () => {
    const locations = prepareAltLocations('Europe/London');

    for (const location of locations) {
      expect(location.url).toContain('daily=sunrise,sunset');
      expect(location.url).not.toContain('moonrise');
      expect(location.url).not.toContain('moonset');
      expect(location.siteDarkness.bortle).toBeGreaterThanOrEqual(1);
      expect(location.siteDarkness.lookupDate).toBe('2026-03-16');
      expect(typeof location.darkSky).toBe('boolean');
    }
  });

  it('excludes precipitation_probability from alt location URLs pinned to ukmo_seamless', () => {
    const locations = prepareAltLocations('Europe/London');

    for (const location of locations) {
      expect(location.url).toContain('models=ukmo_seamless');
      expect(location.url).not.toContain('precipitation_probability');
    }
  });

  it('keeps long-range location requests on supported Open-Meteo daily fields', () => {
    const locations = prepareLongRangeLocations('Europe/London');

    for (const location of locations) {
      expect(location.url).toContain('daily=sunrise,sunset');
      expect(location.url).not.toContain('moonrise');
      expect(location.url).not.toContain('moonset');
      expect(location.siteDarkness.bortle).toBeGreaterThanOrEqual(1);
      expect(location.siteDarkness.lookupDate).toBe('2026-03-16');
      expect(typeof location.darkSky).toBe('boolean');
    }
  });

  it('excludes precipitation_probability from long-range URLs pinned to ukmo_seamless', () => {
    const locations = prepareLongRangeLocations('Europe/London');

    for (const location of locations) {
      expect(location.url).toContain('models=ukmo_seamless');
      expect(location.url).not.toContain('precipitation_probability');
    }
  });
});
