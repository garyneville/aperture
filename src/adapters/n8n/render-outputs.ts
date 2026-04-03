import { formatSite } from '../../presenters/site/format-site.js';
import { formatTelegram } from '../../presenters/telegram/format-telegram.js';
import { formatDebugEmail, formatEmail } from '../../presenters/email/index.js';
import type { EditorialDecision } from '../../app/run-photo-brief/contracts.js';
import { renderBriefAsJson } from '../../presenters/brief-json/render-brief-json.js';
import type {
  FormatMessagesOutput,
  RenderableRuntimeContext,
} from './contracts/final-runtime-payload.js';
import { toScoredForecastContext } from './mappers/to-scored-forecast.js';

export function renderOutputs(
  ctx: RenderableRuntimeContext,
  editorial: EditorialDecision,
  debugMode: boolean,
  debugEmailTo: string,
): FormatMessagesOutput {
  // Explicitly map from n8n runtime context to strict internal shape
  const scoredContext = toScoredForecastContext(ctx);

  const briefJson = renderBriefAsJson(scoredContext, editorial);
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
