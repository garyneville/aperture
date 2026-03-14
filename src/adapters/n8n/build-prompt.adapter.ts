import { buildPrompt } from '../../core/build-prompt.js';

declare const $input: { first(): { json: any }; all(): { json: any }[] };

const input = $input.first().json;

const result = buildPrompt({
  windows: input.windows,
  dontBother: input.dontBother,
  todayBestScore: input.todayBestScore,
  todayCarWash: input.todayCarWash,
  dailySummary: input.dailySummary,
  altLocations: input.altLocations,
  noAltsMsg: input.noAltsMsg,
  metarNote: input.metarNote,
  sunrise: input.sunrise,
  sunset: input.sunset,
  moonPct: input.moonPct,
});

return [{ json: result }];
