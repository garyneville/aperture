import { describe, expect, it } from 'vitest';
import { buildInspirePrompt } from './build-inspire-prompt.adapter.js';

describe('buildInspirePrompt', () => {
  it('builds an aurora-aware prompt for the top astro window', () => {
    const prompt = buildInspirePrompt({
      windows: [{
        label: 'Evening astro window',
        start: '21:00',
        end: '23:00',
        peak: 68,
      }],
      altLocations: [{ name: 'Sutton Bank' }, { name: 'Malham Cove' }],
      peakKpTonight: 6.2,
      locationName: 'Leeds',
    });

    expect(prompt).toContain("Today's best window is evening astro window from 21:00–23:00, scoring 68/100.");
    expect(prompt).toContain('Nearby options: Sutton Bank and Malham Cove.');
    expect(prompt).toContain('An active aurora signal is in play tonight (Kp 6.2)');
  });

  it('switches to the poor-conditions framing when dontBother is true', () => {
    const prompt = buildInspirePrompt({
      dontBother: true,
      altLocations: [{ name: 'Aysgarth Falls' }],
      locationName: 'Leeds',
    });

    expect(prompt).toContain('Today the conditions are genuinely poor for photography in Leeds.');
    expect(prompt).toContain('There are better options nearby: Aysgarth Falls.');
    expect(prompt).toContain('Be honest but find inspiration anyway.');
  });
});
