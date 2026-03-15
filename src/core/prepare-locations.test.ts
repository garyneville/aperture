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
    }
  });

  it('keeps long-range location requests on supported Open-Meteo daily fields', () => {
    const locations = prepareLongRangeLocations('Europe/London');

    for (const location of locations) {
      expect(location.url).toContain('daily=sunrise,sunset');
      expect(location.url).not.toContain('moonrise');
      expect(location.url).not.toContain('moonset');
    }
  });
});
