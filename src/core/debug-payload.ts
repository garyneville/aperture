import type { DebugContext, DebugPayloadSnapshot } from './debug-context.js';

function debugPayloadReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return String(value);
  }
  return value;
}

export function serializeDebugPayload(value: unknown): Omit<DebugPayloadSnapshot, 'label'> {
  const json = JSON.stringify(value, debugPayloadReplacer, 2) ?? 'null';
  return {
    json,
    byteLength: Buffer.byteLength(json, 'utf8'),
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
