import { formatTelegram } from '../../core/format-telegram.js';
import { formatEmail } from '../../core/format-email.js';
import type { N8nRuntime } from './types.js';

export function run({ $, $input }: N8nRuntime) {
  const ctx = $('Code: Build Prompt').first().json;
  const aiText = $input.first().json.choices?.[0]?.message?.content?.trim() || '(No AI summary)';

  const telegramMsg = formatTelegram({ ...ctx, aiText });
  const emailHtml = formatEmail({ ...ctx, aiText });

  return [{ json: { telegramMsg, emailHtml } }];
}
