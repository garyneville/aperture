type UnknownRecord = Record<string, unknown>;

export interface UnwrappedHttpPayload<T> {
  payload: T | null;
  path: string | null;
  transportText: string | null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getObjectKeys(value: unknown): string[] | null {
  return isRecord(value) ? Object.keys(value) : null;
}

export function toBuffer(value: unknown): Buffer | null {
  if (typeof Buffer === 'undefined' || value === null || value === undefined) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (isRecord(value)) {
    if (value.type === 'Buffer' && Array.isArray(value.data)) {
      return Buffer.from(value.data);
    }

    if (Array.isArray(value.data) && value.data.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      return Buffer.from(value.data);
    }
  }

  return null;
}

export function decodeReadableStateBuffer(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value._readableState)) {
    return null;
  }

  const chunks = value._readableState.buffer;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return null;
  }

  const buffers = chunks
    .map(entry => toBuffer(isRecord(entry) && 'chunk' in entry ? entry.chunk : entry))
    .filter((buffer): buffer is Buffer => buffer !== null);

  if (buffers.length === 0) {
    return null;
  }

  return Buffer.concat(buffers).toString('utf8');
}

export function unwrapHttpPayload<T extends UnknownRecord>(
  value: unknown,
  path: string,
  isPayload: (value: UnknownRecord) => value is T,
  depth = 0,
): UnwrappedHttpPayload<T> {
  if (depth > 8 || value === null || value === undefined) {
    return { payload: null, path: null, transportText: null };
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      const resolved = unwrapHttpPayload(parsed, `${path} (parsed)`, isPayload, depth + 1);
      return {
        payload: resolved.payload,
        path: resolved.path,
        transportText: resolved.transportText ?? value,
      };
    } catch {
      return { payload: null, path: null, transportText: value };
    }
  }

  const bufferedValue = toBuffer(value);
  if (bufferedValue) {
    const decoded = bufferedValue.toString('utf8');
    const resolved = unwrapHttpPayload(decoded, `${path} (decoded)`, isPayload, depth + 1);
    return {
      payload: resolved.payload,
      path: resolved.path,
      transportText: resolved.transportText ?? decoded,
    };
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const resolved = unwrapHttpPayload(value[index], `${path}[${index}]`, isPayload, depth + 1);
      if (resolved.payload || resolved.transportText) {
        return resolved;
      }
    }
    return { payload: null, path: null, transportText: null };
  }

  if (!isRecord(value)) {
    return { payload: null, path: null, transportText: null };
  }

  const decodedReadableState = decodeReadableStateBuffer(value);
  if (typeof decodedReadableState === 'string' && decodedReadableState.trim().length > 0) {
    const resolved = unwrapHttpPayload(
      decodedReadableState,
      `${path}._readableState.buffer (decoded)`,
      isPayload,
      depth + 1,
    );
    return {
      payload: resolved.payload,
      path: resolved.path,
      transportText: resolved.transportText ?? decodedReadableState,
    };
  }

  if (isPayload(value)) {
    return { payload: value, path, transportText: null };
  }

  for (const key of ['body', 'data', 'response', 'result']) {
    if (key in value) {
      const resolved = unwrapHttpPayload(value[key], `${path}.${key}`, isPayload, depth + 1);
      if (resolved.payload || resolved.transportText) {
        return resolved;
      }
    }
  }

  return { payload: null, path: null, transportText: null };
}

export function getHttpResponseBodySource(item: unknown): { value: unknown; path: string } {
  if (!isRecord(item)) {
    return { value: item, path: 'item' };
  }

  if (item.body !== undefined) {
    return { value: item.body, path: 'item.body' };
  }

  if (item.data !== undefined) {
    return { value: item.data, path: 'item.data' };
  }

  const error = isRecord(item.error) ? item.error : null;
  const response = error && isRecord(error.response) ? error.response : null;
  if (response?.body !== undefined) {
    return { value: response.body, path: 'item.error.response.body' };
  }

  return { value: item, path: 'item' };
}

export function getHttpResponseStatusCode(item: unknown): number | null {
  if (!isRecord(item)) {
    return null;
  }

  if (typeof item.statusCode === 'number') return item.statusCode;
  if (typeof item.status === 'number') return item.status;

  const error = isRecord(item.error) ? item.error : null;
  if (typeof error?.statusCode === 'number') return error.statusCode;

  const response = error && isRecord(error.response) ? error.response : null;
  if (typeof response?.statusCode === 'number') return response.statusCode;

  return null;
}

export function getUtf8ByteLength(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  if (typeof Buffer === 'undefined') {
    return value.length;
  }

  return Buffer.byteLength(value, 'utf8');
}

export function safeJsonStringify(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
