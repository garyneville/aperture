import { describe, it, expect } from 'vitest';
import { formatSite } from './format-site.js';
import type { AltLocation, BriefJsonLocation, BriefRenderInput, CarWash, DaySummary, Window } from '../../contracts/index.js';
import type { DebugContext } from '../../lib/debug-context.js';

function createMockLocation(name: string = 'Glasgow'): BriefJsonLocation {
  return {
    name,
    timezone: 'Europe/London',
    latitude: 55.86,
    longitude: -4.25,
  };
}

function createMockDebugContext(location: string = 'Glasgow'): DebugContext {
  return {
    metadata: {
      // Keep the mock window in the future so the site renderer uses the
      // provided editorial copy instead of the time-aware fallback path.
      generatedAt: '2026-04-03T12:00:00Z',
      location,
      latitude: 55.86,
      longitude: -4.25,
      timezone: 'Europe/London',
      debugModeEnabled: false,
    },
    hourlyScoring: [],
    windows: [],
    nearbyAlternatives: [],
  };
}

function createMockCarWash(): CarWash {
  return {
    score: 80,
    rating: '✅',
    label: 'Good',
    start: '10:00',
    end: '14:00',
    wind: 8,
    pp: 5,
    tmp: 12,
  };
}

function createMockDaySummary(): DaySummary {
  return {
    dateKey: '2025-04-03',
    dayLabel: 'Today',
    dayIdx: 0,
    hours: [],
    photoScore: 75,
    headlineScore: 75,
    photoEmoji: '✅',
    amScore: 65,
    pmScore: 75,
    astroScore: 45,
    bestPhotoHour: '19:00',
    bestTags: 'golden, clear',
    carWash: createMockCarWash(),
    confidence: 'medium',
    confidenceStdDev: 18,
    bestAstroHour: '22:00',
    darkSkyStartsAt: '21:30',
  };
}

function createMockWindow(): Window {
  return {
    label: 'Evening golden hour',
    start: '18:30',
    end: '20:00',
    peak: 75,
    hours: [{
      hour: '19:00',
      score: 75,
      ch: 10,
      visK: 20,
      wind: 8,
      pp: 5,
      crepuscular: 55,
      tpw: 18,
      tmp: 12,
    }],
    tops: ['golden', 'clear'],
  };
}

function createMockInput(overrides: Partial<BriefRenderInput> = {}): BriefRenderInput {
  return {
    today: 'Friday 3 April',
    todayBestScore: 75,
    dontBother: false,
    location: createMockLocation(),
    sunriseStr: '06:45',
    sunsetStr: '19:30',
    moonPct: 45,
    shSunriseQ: 65,
    shSunsetQ: 72,
    shSunsetText: 'Good sunset potential with scattered clouds.',
    sunDir: 285,
    crepPeak: 55,
    peakKpTonight: null,
    auroraSignal: null,
    aiText: 'Good conditions for photography today with clear skies in the evening.',
    compositionBullets: ['Look for reflections in water', 'Golden hour at west-facing locations'],
    weekInsight: 'The weekend looks promising with stable high pressure.',
    geminiInspire: 'Try long exposures during blue hour.',
    windows: [createMockWindow()],
    dailySummary: [createMockDaySummary()],
    todayCarWash: createMockCarWash(),
    altLocations: [],
    closeContenders: [],
    noAltsMsg: 'No nearby alternatives today.',
    debugContext: createMockDebugContext(),
    ...overrides,
  };
}

describe('formatSite', () => {
  it('renders a complete HTML document', () => {
    const input = createMockInput();
    const html = formatSite(input);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });

  it('renders the hero section with location name', () => {
    const input = createMockInput({
      location: createMockLocation('Edinburgh'),
      debugContext: createMockDebugContext('Edinburgh'),
    });
    const html = formatSite(input);

    expect(html).toContain('Edinburgh');
    expect(html).toContain('Aperture');
  });

  it('renders the hero score', () => {
    const input = createMockInput({ todayBestScore: 82 });
    const html = formatSite(input);

    expect(html).toContain('82');
    expect(html).toContain('/ 100');
  });

  it('renders window information when present', () => {
    const input = createMockInput();
    const html = formatSite(input);

    expect(html).toContain('Evening golden hour');
    expect(html).toContain('18:30');
    expect(html).toContain('20:00');
  });

  it('renders sunrise and sunset times', () => {
    const input = createMockInput({ sunriseStr: '06:30', sunsetStr: '19:45' });
    const html = formatSite(input);

    expect(html).toContain('Sunrise');
    expect(html).toContain('06:30');
    expect(html).toContain('Sunset');
    expect(html).toContain('19:45');
  });

  it('renders moon information', () => {
    const input = createMockInput({ moonPct: 67 });
    const html = formatSite(input);

    expect(html).toContain('Moon');
    expect(html).toContain('67%');
  });

  it('renders session scores', () => {
    const input = createMockInput();
    const html = formatSite(input);

    expect(html).toContain('AM light');
    expect(html).toContain('PM light');
    expect(html).toContain('Peak astro');
  });

  it('renders the AI briefing section', () => {
    const input = createMockInput({
      aiText: 'Great conditions for landscape photography.',
    });
    const html = formatSite(input);

    expect(html).toContain('AI briefing');
    expect(html).toContain('Great conditions');
  });

  it('renders days ahead section', () => {
    const input = createMockInput();
    const html = formatSite(input);

    expect(html).toContain('Days ahead');
  });

  it('renders footer with key', () => {
    const input = createMockInput();
    const html = formatSite(input);

    expect(html).toContain('Key');
    expect(html).toContain('Score bands');
  });

  it('handles dontBother mode gracefully', () => {
    const input = createMockInput({
      dontBother: true,
      windows: [],
    });
    const html = formatSite(input);

    // When dontBother is true and no windows, we should see alternative summary
    expect(html).toContain('Aperture');
    expect(html).not.toContain("Today's window");
  });

  it('renders alternative locations when present', () => {
    const altLocation: AltLocation = {
      name: 'Loch Lomond',
      driveMins: 45,
      bestScore: 82,
      amScore: 70,
      pmScore: 82,
      astroScore: 60,
      bestDayHour: '19:30',
      bestAstroHour: '22:00',
      isAstroWin: false,
      darkSky: false,
    };

    const input = createMockInput({
      altLocations: [altLocation],
    });
    const html = formatSite(input);

    expect(html).toContain('Out of town options');
    expect(html).toContain('Loch Lomond');
  });

  it('renders signal cards for sunset hue data', () => {
    const input = createMockInput({
      shSunriseQ: 70,
      shSunsetQ: 80,
    });
    const html = formatSite(input);

    expect(html).toContain('SunsetHue');
  });

  it('renders composition bullets when present', () => {
    const input = createMockInput({
      compositionBullets: ['Use a polarizer', 'Watch for reflections'],
    });
    const html = formatSite(input);

    expect(html).toContain('Shot ideas');
    expect(html).toContain('polarizer');
  });
});
