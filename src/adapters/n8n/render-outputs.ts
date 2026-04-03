import { formatSite } from '../../presenters/site/format-site.js';
import { formatTelegram } from '../../presenters/telegram/format-telegram.js';
import { formatDebugEmail, formatEmail } from '../../presenters/email/index.js';
import type { EditorialDecision } from '../../app/run-photo-brief/contracts.js';
import type { ScoredForecastContext } from '../../types/scored-forecast.js';
import { renderBriefAsJson } from '../../presenters/brief-json/render-brief-json.js';
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
