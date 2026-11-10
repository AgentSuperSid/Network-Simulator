import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, encodeMessage } from './integrity.js';
test('CRC-32 matches the standard check vector', () => {
  assert.equal(crc32(encodeMessage('123456789')), 0xcbf43926);
  assert.equal(crc32([]), 0);
});
test('every single bit change in Hello is detected and reversing it restores the check', () => {
  const original = encodeMessage('Hello');
  const check = crc32(original);
  for (let i = 0; i < original.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const damaged = [...original];
      damaged[i] ^= 1 << bit;
      assert.notEqual(crc32(damaged), check);
      damaged[i] ^= 1 << bit;
      assert.equal(crc32(damaged), check);
    }
  }
});
test('UTF-8 length limit never slices a character', () => {
  const input = 'a'.repeat(30) + '🌍';
  const data = encodeMessage(input);
  assert.equal(data.length, 30);
  assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(data)), 'a'.repeat(30));
});
