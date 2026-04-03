#!/usr/bin/env node
/**
 * CLI Runner for Finalize Brief Use Case
 *
 * This script demonstrates that the core application logic can run
 * independently of n8n. It loads a forecast fixture from a JSON file
 * and runs the finalize-brief use case.
 *
 * Usage:
 *   npx ts-node src/app/run-photo-brief/finalize-brief-cli.ts <fixture-path>
 *
 * Example:
 *   npx ts-node src/app/run-photo-brief/finalize-brief-cli.ts ./fixtures/sample-forecast.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { finalizeBrief } from './finalize-brief.js';
import type { RawEditorialInput, FinalizeConfig } from './finalize-brief-contracts.js';

interface FixtureFile {
  /** Scored forecast context */
  context: RawEditorialInput['context'];

  /** Groq response choices */
  groqChoices?: RawEditorialInput['groqChoices'];

  /** Gemini response text */
  geminiResponse?: string;

  /** Optional Gemini inspire text */
  geminiInspire?: string;

  /** Home location configuration */
  homeLocation?: {
    name?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
  };

  /** Debug configuration */
  debug?: {
    enabled?: boolean;
    emailTo?: string;
  };

  /** AI provider preference */
  preferredProvider?: 'groq' | 'gemini';
}

function loadFixture(fixturePath: string): FixtureFile {
  const fullPath = resolve(fixturePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as FixtureFile;
}

function runCli() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Finalize Brief CLI Runner

Runs the photo brief finalization use case against a fixture file.
This demonstrates the app layer running independently of n8n.

Usage:
  npx ts-node src/app/run-photo-brief/finalize-brief-cli.ts <fixture-path>

Arguments:
  fixture-path    Path to JSON fixture file containing forecast data

Example:
  npx ts-node src/app/run-photo-brief/finalize-brief-cli.ts ./fixtures/sample-forecast.json

Fixture format:
  {
    "context": { /* BriefContext */ },
    "groqChoices": [ { "message": { "content": "..." } } ],
    "geminiResponse": "...",
    "homeLocation": { "name": "Leeds", "lat": 53.8, "lon": -1.5, "timezone": "Europe/London" },
    "debug": { "enabled": true, "emailTo": "debug@example.com" },
    "preferredProvider": "groq"
  }
`);
    process.exit(args[0] === '--help' || args[0] === '-h' ? 0 : 1);
  }

  const fixturePath = args[0];

  try {
    console.log(`Loading fixture: ${fixturePath}`);
    const fixture = loadFixture(fixturePath);

    // Build raw input
    const rawInput: RawEditorialInput = {
      context: fixture.context,
      groqChoices: fixture.groqChoices,
      geminiResponse: fixture.geminiResponse,
      geminiInspire: fixture.geminiInspire,
    };

    // Build config
    const config: FinalizeConfig = {
      preferredProvider: fixture.preferredProvider ?? 'groq',
      homeLocation: {
        name: fixture.homeLocation?.name ?? 'Unknown Location',
        lat: fixture.homeLocation?.lat ?? 0,
        lon: fixture.homeLocation?.lon ?? 0,
        timezone: fixture.homeLocation?.timezone ?? 'UTC',
      },
      debug: {
        enabled: fixture.debug?.enabled ?? false,
        emailTo: fixture.debug?.emailTo ?? '',
        source: 'cli',
      },
      triggerSource: 'cli',
    };

    console.log('Running finalize-brief use case...\n');
    const result = finalizeBrief(rawInput, config);

    // Output summary
    console.log('=== RESULT SUMMARY ===\n');
    console.log(`AI Text: ${result.editorial.aiText.substring(0, 100)}...`);
    console.log(`Provider: ${result.editorial.selectedProvider}`);
    console.log(`Fallback used: ${result.editorial.fallbackUsed}`);
    console.log(`\nOutput lengths:`);
    console.log(`  Email HTML: ${result.emailHtml.length} chars`);
    console.log(`  Telegram: ${result.telegramMsg.length} chars`);
    console.log(`  Site HTML: ${result.siteHtml.length} chars`);
    console.log(`  Brief JSON: ${JSON.stringify(result.briefJson).length} chars`);

    if (result.debugMode) {
      console.log(`\nDebug email: ${result.debugEmailSubject}`);
      console.log(`Debug HTML: ${result.debugEmailHtml.length} chars`);
    }

    console.log('\n=== SUCCESS ===');
    process.exit(0);
  } catch (error) {
    console.error('\n=== ERROR ===');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runCli();
