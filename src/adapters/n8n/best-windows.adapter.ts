import { bestWindows } from '../../core/best-windows.js';

declare const $input: { first(): { json: any }; all(): { json: any }[] };

const { todayHours, dailySummary, metarNote } = $input.first().json;

const result = bestWindows({ todayHours, dailySummary, metarNote });

return [{ json: result }];
