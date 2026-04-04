/**
 * Render Outputs
 *
 * Renders all output formats from the finalized brief data.
 */

import type { DebugContext, BriefJson } from '../../contracts/index.js';
import type { EditorialDecision } from './contracts.js';
import type { FinalizeRuntimeContext } from './finalize-brief-contracts.js';
import { toScoredForecastContext } from './mappers/to-scored-forecast.js';
import { formatSite } from '../../presenters/site/format-site.js';
import { formatTelegram } from '../../presenters/telegram/format-telegram.js';
import { formatDebugEmail, formatEmail } from '../../presenters/email/index.js';
import { renderBriefAsJson } from '../../presenters/brief-json/render-brief-json.js';

export interface RenderedOutputs {
  briefJson: BriefJson;
  telegramMsg: string;
  emailHtml: string;
  siteHtml: string;
  debugEmailHtml: string;
  debugEmailSubject: string;
}

/**
 * Render all output formats from the finalized brief data.
 */
export function renderAllOutputs(
  context: FinalizeRuntimeContext,
  editorial: EditorialDecision,
  debugContext: DebugContext,
  debugMode: boolean,
): RenderedOutputs {
  // Map context to scored forecast context for rendering
  const scoredContext = toScoredForecastContext({
    ...context,
    debugContext,
  });

  // Render brief JSON (canonical output)
  const briefJson = renderBriefAsJson(scoredContext, editorial);

  // Render all presentation formats
  const telegramMsg = formatTelegram(briefJson);
  const emailHtml = formatEmail(briefJson);
  const siteHtml = formatSite(briefJson);

  // Render debug email if enabled
  const debugEmailHtml = debugMode ? formatDebugEmail(debugContext) : '';
  const today = context.today;
  const debugEmailSubject = debugContext.metadata?.location
    ? `Photo Brief Debug - ${debugContext.metadata.location} - ${today || 'today'}`
    : `Photo Brief Debug - ${today || 'today'}`;

  return {
    briefJson,
    telegramMsg,
    emailHtml,
    siteHtml,
    debugEmailHtml,
    debugEmailSubject,
  };
}
