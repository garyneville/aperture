import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

const DEBUG_EMAIL_TO = '__PHOTO_WEATHER_DEBUG_EMAIL_TO__';

function isPlaceholder(value: string): boolean {
  return /^__.+__$/.test(value);
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function run({ $input }: N8nRuntime) {
  const triggerInput = firstInputJson($input, {} as Record<string, unknown>);
  const debugEmailTo = isPlaceholder(DEBUG_EMAIL_TO) ? '' : DEBUG_EMAIL_TO.trim();
  const debugMode = debugEmailTo.length > 0;
  const body = objectOrEmpty(triggerInput.body);
  const query = objectOrEmpty(triggerInput.query);
  const params = objectOrEmpty(triggerInput.params);
  const headers = objectOrEmpty(triggerInput.headers);
  const hasWebhookRequest = Object.keys(body).length > 0
    || Object.keys(query).length > 0
    || Object.keys(params).length > 0
    || Object.keys(headers).length > 0;
  const triggerSource = hasWebhookRequest
    ? firstNonEmptyString(
        body.triggerSource,
        query.triggerSource,
        headers['x-trigger-source'],
        headers['x-photo-brief-trigger-source'],
      ) || 'webhook'
    : 'schedule';

  return [{
    json: {
      debugMode,
      debugModeSource: debugMode ? 'debug recipient configured' : 'debug recipient missing',
      debugEmailTo,
      triggerSource,
      triggerRequest: hasWebhookRequest ? { body, query, params } : null,
    },
  }];
}
