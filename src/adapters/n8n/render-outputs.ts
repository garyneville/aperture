import { formatSite } from '../../core/format-site.js';
import { formatTelegram } from '../../core/format-telegram.js';
import { formatDebugEmail, formatEmail } from '../../core/format-email.js';
import type { EditorialDecision } from '../../core/standalone/contracts.js';
import type { ScoredForecastContext } from '../../types/scored-forecast.js';
import { renderBriefAsJson } from '../../renderers/brief-json.js';
import type {
  FormatMessagesOutput,
  RenderableRuntimeContext,
} from './contracts/final-runtime-payload.js';

export function renderOutputs(
  ctx: RenderableRuntimeContext,
  editorial: EditorialDecision,
  debugMode: boolean,
  debugEmailTo: string,
): FormatMessagesOutput {
  const briefJson = renderBriefAsJson(ctx as unknown as ScoredForecastContext, editorial);
  const telegramMsg = formatTelegram(briefJson);
  const emailHtml = formatEmail(briefJson);
  const siteHtml = formatSite(briefJson);
  const debugEmailHtml = debugMode ? formatDebugEmail(ctx.debugContext) : '';
  const debugEmailSubject = ctx.debugContext.metadata?.location
    ? `Photo Brief Debug - ${ctx.debugContext.metadata.location} - ${ctx.today || 'today'}`
    : `Photo Brief Debug - ${ctx.today || 'today'}`;

  return {
    briefJson,
    telegramMsg,
    emailHtml,
    siteHtml,
    debugMode,
    debugEmailTo,
    debugEmailHtml,
    debugEmailSubject,
  };
}
