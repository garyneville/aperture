import { bestWindows } from '../../core/best-windows.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const { todayHours, dailySummary, metarNote } = $input.first().json;
  const result = bestWindows({ todayHours, dailySummary, metarNote });
  return [{ json: result }];
}
