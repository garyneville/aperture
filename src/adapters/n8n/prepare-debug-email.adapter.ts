import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const input = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();

  if (input.debugMode !== true || !input.debugEmailTo || !input.debugEmailHtml) {
    return [];
  }

  return [{
    json: {
      debugEmailTo: input.debugEmailTo,
      debugEmailHtml: input.debugEmailHtml,
      debugEmailSubject: input.debugEmailSubject || 'Photo Brief Debug',
    },
  }];
}
