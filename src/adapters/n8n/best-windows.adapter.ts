import { bestWindows } from '../../core/best-windows.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const { todayHours, dailySummary, metarNote, sessionRecommendation, debugContext } = $input.first().json;
  const result = bestWindows({ todayHours, dailySummary, metarNote, sessionRecommendation, debugContext });
  return [{ json: result }];
}
