import { readFileSync } from 'fs';

const data = readFileSync('debug/gemini-output.md', 'utf8');
const obj = JSON.parse(data);
const buf = obj.body._readableState.buffer;
console.log('buffer has', buf.length, 'chunks');
console.log('buffer isArray:', Array.isArray(buf));

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
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

function decodeReadableStateBuffer(value) {
  if (!isRecord(value) || !isRecord(value._readableState)) {
    console.log('FAIL: not a record or no _readableState');
    return null;
  }
  const chunks = value._readableState.buffer;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    console.log('FAIL: buffer not array or empty', typeof chunks, Array.isArray(chunks));
    return null;
  }
  const buffers = chunks
    .map(entry => toBuffer(isRecord(entry) && 'chunk' in entry ? entry.chunk : entry))
    .filter(buffer => buffer !== null);
  console.log('decoded', buffers.length, 'of', chunks.length, 'chunks');
  if (buffers.length === 0) return null;
  return Buffer.concat(buffers).toString('utf8');
}

// Test with obj.body (the stream object)
const decoded = decodeReadableStateBuffer(obj.body);
if (decoded) {
  console.log('SUCCESS - decoded length:', decoded.length);
  const parsed = JSON.parse(decoded);
  console.log('Parsed keys:', Object.keys(parsed));
  console.log('Has candidates:', Array.isArray(parsed.candidates));
  if (parsed.candidates) {
    console.log('First candidate text (first 200 chars):', parsed.candidates[0]?.content?.parts?.[0]?.text?.substring(0, 200));
  }
} else {
  console.log('FAILED to decode');
}

// Now test the full unwrapHttpPayload flow
console.log('\n--- Testing full unwrapHttpPayload flow ---');
// Simulate getHttpResponseBodySource
const bodySource = obj.body !== undefined ? { value: obj.body, path: 'item.body' } : { value: obj, path: 'item' };
console.log('bodySource path:', bodySource.path);

// The unwrapHttpPayload would first be called on obj.body
// But wait - does it first try the 'body' key on the outer object?
// Let's check what happens when called on the full item (obj)
console.log('\nTesting on full item (obj):');
console.log('obj has body?', 'body' in obj);
console.log('obj._readableState?', '_readableState' in obj);

// When unwrapHttpPayload is called on obj.body:
const streamObj = obj.body;
console.log('\nTesting on obj.body (stream object):');
console.log('is string?', typeof streamObj === 'string');
console.log('toBuffer result:', toBuffer(streamObj));
console.log('Array.isArray?', Array.isArray(streamObj));
console.log('isRecord?', isRecord(streamObj));
console.log('has _readableState?', '_readableState' in streamObj);

// So decodeReadableStateBuffer should be called here
const result = decodeReadableStateBuffer(streamObj);
console.log('decodeReadableStateBuffer result length:', result?.length);
