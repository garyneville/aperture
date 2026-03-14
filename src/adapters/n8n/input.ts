import type { N8nInputAccessor } from './types.js';

export function firstInputJson<T>($input: N8nInputAccessor, fallback: T): T {
  try {
    return ($input.first().json as T) ?? fallback;
  } catch {
    return fallback;
  }
}
