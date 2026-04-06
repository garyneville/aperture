#!/usr/bin/env node
/**
 * dump-pipeline.ts — Replay an API snapshot through the Aperture pipeline
 * and write each stage's output to debug/pipeline-dump-<timestamp>/
 *
 * Stages dumped:
 *   01-normalized-inputs.json   — adapter-normalized payloads (what scoring sees)
 *   02-scoring-output.json      — scoreAllDays() result (hours, daily summary, sessions)
 *   02b-alt-scoring-output.json — scoreAlternatives() result (alt locations, contenders)
 *   03-editorial-request.json   — prompt + context sent to AI providers
 *
 * Usage:
 *   node --loader ts-node/esm scripts/dump-pipeline.ts [snapshot-dir]
 *
 * If snapshot-dir is omitted, uses the most recent debug/api-snapshot-* directory.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, join, basename } from 'path';

// Domain
import { scoreAllDays } from '../src/domain/scoring/score-all-days.js';
import { scoreAlternatives } from '../src/domain/scoring/score-alternatives.js';

// Lib — alt locations
import { prepareAltLocations } from '../src/lib/prepare-alt-locations.js';

// Lib — aurora parsing
import {
  parseAuroraWatchUK,
  parseNasaDonkiCme,
  fuseAuroraSignals,
} from '../src/lib/aurora-providers.js';

// Config defaults
import { DEFAULT_HOME_LOCATION } from '../src/lib/home-location.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJsonFromMd(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf-8');
  // Extract content between first ``` and last ```
  const match = raw.match(/```\n?([\s\S]*?)```/);
  if (!match) {
    console.warn(`  ⚠ No fenced code block in ${basename(filePath)}`);
    return null;
  }
  const body = match[1].trim();
  if (!body) return null;

  // Try JSON parse; if it's XML (aurorawatch), return raw string
  try {
    return JSON.parse(body);
  } catch {
    return body; // raw text (XML etc.)
  }
}

function findLatestSnapshot(debugDir: string): string {
  const entries = readdirSync(debugDir)
    .filter(e => e.startsWith('api-snapshot-'))
    .map(e => ({ name: e, mtime: statSync(join(debugDir, e)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);

  if (entries.length === 0) {
    throw new Error(`No api-snapshot-* directories found in ${debugDir}`);
  }
  return join(debugDir, entries[0].name);
}

function parseKpRows(raw: unknown): Array<{ time: string; kp: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> =>
      row != null && typeof row === 'object' && 'time_tag' in row && 'kp' in row,
    )
    .map(row => ({
      time: String(row.time_tag),
      kp: typeof row.kp === 'number' ? row.kp : parseFloat(String(row.kp)),
    }))
    .filter(r => !isNaN(r.kp));
}

function writeStage(dir: string, filename: string, data: unknown): void {
  const path = join(dir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  const size = statSync(path).size;
  const sizeStr = size > 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)}MB`
    : size > 1024
      ? `${(size / 1024).toFixed(0)}KB`
      : `${size}B`;
  console.log(`  ✓ ${filename} (${sizeStr})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const debugDir = resolve('debug');
  const snapshotDir = process.argv[2]
    ? resolve(process.argv[2])
    : findLatestSnapshot(debugDir);

  console.log(`Snapshot: ${snapshotDir}`);

  // Derive timestamp from directory name
  const dirName = basename(snapshotDir);
  const stamp = dirName.replace('api-snapshot-', '');
  const outDir = join(debugDir, `pipeline-dump-${stamp}`);
  mkdirSync(outDir, { recursive: true });

  console.log(`Output:   ${outDir}/\n`);

  // ── Load raw API responses ──────────────────────────────────────────────

  const allFiles = readdirSync(snapshotDir).filter(f => f.endsWith('.md')).sort();

  function findFile(substring: string): string | undefined {
    const match = allFiles.find(f => f.includes(substring));
    return match ? join(snapshotDir, match) : undefined;
  }

  function loadFile(substring: string): unknown {
    const path = findFile(substring);
    if (!path) {
      console.warn(`  ⚠ No file matching "${substring}" in snapshot`);
      return null;
    }
    return extractJsonFromMd(path);
  }

  const raw = {
    weather:     loadFile('weather-ukmo'),
    airQuality:  loadFile('air-quality'),
    metar:       loadFile('metar'),
    sunsetHue:   loadFile('sunsethue'),
    precipProb:  loadFile('precip-prob'),
    ensemble:    loadFile('ensemble'),
    azimuth:     loadFile('azimuth'),
    kpIndex:     loadFile('kp-index'),
    auroraWatch: loadFile('aurorawatch'),
    nasaDonki:   loadFile('nasa-donki'),
  };

  // ── Stage 1: Normalize (replicate adapter layer) ────────────────────────

  console.log('Stage 1: Normalizing inputs...');

  const EMPTY_HOURLY = { hourly: { time: [] as string[] } };
  const EMPTY_WEATHER = { hourly: { time: [] as string[] }, daily: { sunrise: [] as string[], sunset: [] as string[], moonrise: [] as string[], moonset: [] as string[] } };

  const weather     = raw.weather ?? EMPTY_WEATHER;
  const airQuality  = raw.airQuality ?? EMPTY_HOURLY;
  const metarRaw    = Array.isArray(raw.metar) ? raw.metar : [];
  const sunsetHueRaw = raw.sunsetHue as any;
  const sunsetHue   = Array.isArray(sunsetHueRaw?.data)
    ? sunsetHueRaw.data
    : (Array.isArray(sunsetHueRaw) ? sunsetHueRaw : []);
  const precipProb  = raw.precipProb ?? EMPTY_HOURLY;
  const ensemble    = raw.ensemble ?? EMPTY_HOURLY;
  const kpForecast  = parseKpRows(raw.kpIndex);

  // Aurora: parse from raw provider responses
  const nearTermAurora = parseAuroraWatchUK(raw.auroraWatch);
  const longRangeAurora = parseNasaDonkiCme(raw.nasaDonki);
  const auroraSignal = fuseAuroraSignals(nearTermAurora, longRangeAurora);

  // Azimuth: the snapshot only has one sample point (25km west).
  // In the real pipeline, prepare-azimuth generates multiple sample points and
  // aggregate-azimuth merges them. We pass an empty azimuthByPhase here since
  // we can't reconstruct the full multi-point scan from a single sample.
  const azimuthByPhase = {};

  const normalizedInputs = {
    weather,
    airQuality,
    metarRaw,
    sunsetHue,
    precipProb,
    ensemble,
    azimuthByPhase,
    kpForecast,
    auroraSignal,
  };

  writeStage(outDir, '01-normalized-inputs.json', normalizedInputs);

  // ── Stage 2: Score ──────────────────────────────────────────────────────

  console.log('Stage 2: Running scoreAllDays...');

  const scoreResult = scoreAllDays({
    lat: DEFAULT_HOME_LOCATION.lat,
    lon: DEFAULT_HOME_LOCATION.lon,
    timezone: DEFAULT_HOME_LOCATION.timezone,
    weather: weather as any,
    airQuality: airQuality as any,
    precipProb: precipProb as any,
    metarRaw: metarRaw as any,
    sunsetHue: sunsetHue as any,
    ensemble: ensemble as any,
    azimuthByPhase: azimuthByPhase as any,
  });

  // Extract the serializable parts (debugContext can be large)
  const scoringOutput = {
    todayHours: scoreResult.todayHours,
    dailySummary: scoreResult.dailySummary,
    metarNote: scoreResult.metarNote,
    sessionRecommendation: scoreResult.sessionRecommendation,
    debugContext: {
      metadata: scoreResult.debugContext.metadata,
      hourlyScoring: scoreResult.debugContext.hourlyScoring,
      windows: scoreResult.debugContext.windows,
      // Omit payloadSnapshots (huge) — they're in the normalized-inputs file
    },
  };

  writeStage(outDir, '02-scoring-output.json', scoringOutput);

  // ── Stage 2b: Score alternative locations ────────────────────────────────

  console.log('Stage 2b: Scoring alt locations...');

  const altLocationMeta = prepareAltLocations(DEFAULT_HOME_LOCATION.timezone);

  // Discover alt-weather snapshot files dynamically
  const altWeatherFiles = allFiles.filter(f => f.includes('alt-weather-'));

  const altWeatherData = altLocationMeta.map(loc => {
    const slug = loc.name.toLowerCase().replace(/\s+/g, '-');
    const file = altWeatherFiles.find(f => f.includes(`alt-weather-${slug}`));
    if (!file) return null;
    return extractJsonFromMd(join(snapshotDir, file));
  }).filter(Boolean);

  // Build a location meta list matching only the locations we have data for
  const matchedAltMeta = altLocationMeta.filter(loc => {
    const slug = loc.name.toLowerCase().replace(/\s+/g, '-');
    return altWeatherFiles.some(f => f.includes(`alt-weather-${slug}`));
  });

  const altResult = scoreAlternatives({
    altWeatherData: altWeatherData as any[],
    altLocationMeta: matchedAltMeta,
    homeContext: {
      dailySummary: scoreResult.dailySummary as any[],
      todayBestScore: scoreResult.todayHours.reduce((max, h) => Math.max(max, h.score), 0),
      debugContext: scoreResult.debugContext,
      windows: scoreResult.debugContext.windows,
      dontBother: false,
      todayCarWash: false,
      metarNote: scoreResult.metarNote,
      sunrise: null,
      sunset: null,
      moonPct: null,
    },
  });

  const altScoringOutput = {
    altLocations: altResult.altLocations,
    closeContenders: altResult.closeContenders,
    noAltsMsg: altResult.noAltsMsg,
    augmentedSummary: altResult.augmentedSummary,
    snapshotFilesMatched: altWeatherFiles,
    locationsScored: matchedAltMeta.map(l => l.name),
  };

  writeStage(outDir, '02b-alt-scoring-output.json', altScoringOutput);

  // ── Stage 3: Editorial request context ──────────────────────────────────

  console.log('Stage 3: Building editorial request context...');

  // The editorial request is built from scored context. We capture what would
  // be sent as the editorial prompt context (the key fields the AI sees).
  const editorialContext = {
    _note: 'This is the scored context that feeds the editorial prompt builder. The actual prompt text is generated at runtime by src/domain/editorial/.',
    dailySummary: scoreResult.dailySummary,
    todayHours: scoreResult.todayHours.map(h => ({
      hour: h.hour,
      score: h.score,
      ct: h.ct,
      visK: h.visK,
      aod: h.aod,
      comfort: h.comfort,
    })),
    sessionRecommendation: scoreResult.sessionRecommendation,
    metarNote: scoreResult.metarNote,
    aurora: auroraSignal,
    kpForecast,
    location: DEFAULT_HOME_LOCATION,
    altLocations: altResult.altLocations,
    closeContenders: altResult.closeContenders,
    noAltsMsg: altResult.noAltsMsg,
  };

  writeStage(outDir, '03-editorial-context.json', editorialContext);

  console.log(`\nDone. 4 pipeline stages dumped to ${outDir}/`);
}

main();
