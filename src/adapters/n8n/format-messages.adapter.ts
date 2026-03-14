import { formatTelegram } from '../../core/format-telegram.js';
import { formatEmail } from '../../core/format-email.js';
import type { N8nRuntime } from './types.js';

function normalizeAiText(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '(No AI summary)';

  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(sentence => sentence.trim()) || [cleaned];
  const shortened = sentences.slice(0, 2).join(' ').trim();

  return shortened.length > 280
    ? `${shortened.slice(0, 277).trimEnd()}...`
    : shortened;
}

export function run({ $input }: N8nRuntime) {
  const input = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();
  const { choices, ...ctx } = input;
  const aiText = normalizeAiText(choices?.[0]?.message?.content?.trim() || '');

  const telegramMsg = formatTelegram({ ...ctx, aiText });
  const emailHtml = formatEmail({ ...ctx, aiText });

  return [{ json: { telegramMsg, emailHtml } }];
}
