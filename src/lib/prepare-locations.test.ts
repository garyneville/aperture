import { describe, expect, it } from 'vitest';
import { ALT_LOCATIONS, prepareAltLocations } from './prepare-alt-locations.js';
import { prepareLongRangeLocations } from './prepare-long-range.js';
import { haversineKm } from './long-range-locations.js';

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

  it('excludes long-range locations that overlap with alt-locations', () => {
    const longRange = prepareLongRangeLocations('Europe/London');
    const longRangeNames = longRange.map(l => l.name);

    // These locations exist in both registries at identical coordinates
    const knownOverlaps = ['Ribblehead Viaduct', 'Mam Tor', 'Stanage Edge', 'Ladybower Reservoir', 'Sutton Bank'];
    for (const name of knownOverlaps) {
      expect(longRangeNames).not.toContain(name);
    }
  });

  it('verifies no long-range location is within 2 km of an alt-location', () => {
    const longRange = prepareLongRangeLocations('Europe/London');

    for (const lr of longRange) {
      for (const alt of ALT_LOCATIONS) {
        const km = haversineKm(lr.lat, lr.lon, alt.lat, alt.lon);
        expect(km, `${lr.name} is ${km.toFixed(1)} km from alt-location ${alt.name}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
