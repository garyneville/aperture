import type { DebugContext, DebugPayloadSnapshot } from './debug-context.js';

function debugPayloadReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return String(value);
  }
  return value;
}

/**
 * Summarize numeric arrays as min/max/mean/count.
 * Returns null if value is not a numeric array.
 */
function summarizeNumericArray(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const nums = value.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  if (nums.length === 1) return `${nums[0]}`;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const mean = Math.round(avg * 10) / 10;
  return `${min}–${max} (mean ${mean}, ${nums.length} items)`;
}

/**
 * Summarize string arrays as count with sample.
 * Returns null if value is not a string array.
 */
function summarizeStringArray(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const strings = value.filter((v): v is string => typeof v === 'string');
  if (strings.length === 0) return null;
  if (strings.length <= 3) return strings.join(', ');
  return `${strings.slice(0, 3).join(', ')} ... (${strings.length - 3} more)`;
}

/**
 * Recursively summarize a payload object, replacing large arrays with statistics.
 * Preserves structure but summarizes verbose data.
 */
function summarizePayload(obj: unknown, key = ''): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    // Check if this is a numeric array that should be summarized
    const numSummary = summarizeNumericArray(obj);
    if (numSummary && obj.length > 5) {
      return `[${numSummary}]`;
    }
    // Check if this is a string array that should be summarized
    const strSummary = summarizeStringArray(obj);
    if (strSummary && obj.length > 5) {
      return `[${strSummary}]`;
    }
    // Recursively summarize array elements (but limit depth for objects)
    if (obj.length > 10 && obj.every(item => typeof item === 'object' && item !== null)) {
      // Array of objects — show first/last with count
      const first = summarizePayload(obj[0]);
      const last = summarizePayload(obj[obj.length - 1]);
      return [first, `... (${obj.length - 2} more objects) ...`, last];
    }
    return obj.map(item => summarizePayload(item));
  }

  // Object — recursively summarize properties
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    // Skip null/undefined values
    if (v === null || v === undefined) continue;
    // Skip empty arrays
    if (Array.isArray(v) && v.length === 0) continue;
    result[k] = summarizePayload(v, k);
  }
  return result;
}

/**
 * Create a concise summary of a payload suitable for debug output.
 */
export function serializeDebugPayload(value: unknown): Omit<DebugPayloadSnapshot, 'label'> {
  const summaryObj = summarizePayload(value);
  const summary = JSON.stringify(summaryObj, debugPayloadReplacer, 2) ?? 'null';
  const fullJson = JSON.stringify(value, debugPayloadReplacer, 2) ?? 'null';
  return {
    summary,
    json: fullJson.length > 5000 ? undefined : fullJson, // Only keep full JSON if reasonably small
    byteLength: Buffer.byteLength(fullJson, 'utf8'),
  };
}

export function upsertDebugPayloadSnapshot(
  debugContext: DebugContext,
  snapshot: DebugPayloadSnapshot,
): void {
  const existing = debugContext.payloadSnapshots || [];
  const next = existing.filter(entry => entry.label !== snapshot.label);
  next.push(snapshot);
  debugContext.payloadSnapshots = next;
}
