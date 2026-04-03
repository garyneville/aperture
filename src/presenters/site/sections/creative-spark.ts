import { esc } from '../../../lib/utils.js';

export interface CreativeSparkInput {
  text: string;
}

export function sCreativeSpark(input: CreativeSparkInput): string {
  const { text } = input;
  return `<div class="card">
    <div class="spark-overline">&#x2736; Creative spark</div>
    <div class="spark-quote-mark">&ldquo;</div>
    <div class="spark-text">${esc(text)}</div>
  </div>`;
}
