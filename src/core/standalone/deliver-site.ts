import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StandaloneBriefRun } from './contracts.js';

export interface SitePublishConfig {
  outputDir: string;
  archiveDir?: string;
}

function archiveFilename(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return `${generatedAt.slice(0, 10) || 'unknown'}.html`;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}.html`;
}

export async function deliverSiteOutput(
  run: StandaloneBriefRun,
  config: SitePublishConfig,
): Promise<void> {
  const { siteHtml } = run.outputs;

  if (!siteHtml) {
    console.warn('[deliver-site] siteHtml is absent — skipping site delivery');
    return;
  }

  const archiveDir = config.archiveDir ?? join(config.outputDir, 'archive');

  await Promise.all([
    mkdir(config.outputDir, { recursive: true }),
    mkdir(archiveDir, { recursive: true }),
  ]);

  const filename = archiveFilename(run.generatedAt);

  await Promise.all([
    writeFile(join(config.outputDir, 'index.html'), siteHtml, 'utf8'),
    writeFile(join(archiveDir, filename), siteHtml, 'utf8'),
  ]);
}
