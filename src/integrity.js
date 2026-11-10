// CRC-32/ISO-HDLC over payload bytes. This is not a serialized Ethernet frame.
export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export const hex32 = value => value.toString(16).padStart(8, '0').toUpperCase();
export function encodeMessage(text, limit = 32) {
  const data = [];
  for (const character of text) {
    const encoded = [...new TextEncoder().encode(character)];
    if (data.length + encoded.length > limit) break;
    data.push(...encoded);
  }
  return data;
}
