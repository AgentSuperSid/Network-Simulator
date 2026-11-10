import { crc32, encodeMessage } from './integrity.js';
export const read16 = (b, i) => (b[i] << 8) | b[i + 1];
const write16 = (b, i, n) => { b[i] = (n >>> 8) & 255; b[i + 1] = n & 255; };
export function checksum(b) {
  let sum = 0;
  for (let i = 0; i < b.length; i += 2) sum += (b[i] << 8) | (b[i + 1] || 0);
  while (sum >>> 16) sum = (sum & 65535) + (sum >>> 16);
  return (~sum) & 65535;
}
const pseudo = (ip, length) => [...ip.slice(12, 20), 0, ip[9], length >>> 8, length & 255];
const macs = [ [2,0,0,0,1,10], [2,0,0,0,1,1], [2,0,0,0,2,1], [2,0,0,0,2,2], [2,0,0,0,3,1], [2,0,0,0,3,20] ];
export function framePacket(ip, hop = 0) {
  const pair = hop < 2 ? 0 : hop === 2 ? 2 : 4;
  const body = [...macs[pair + 1], ...macs[pair], 8, 0, ...ip];
  while (body.length < 60) body.push(0);
  const crc = crc32(body);
  return [...body, crc & 255, (crc >>> 8) & 255, (crc >>> 16) & 255, crc >>> 24];
}
export function makeFrame(data, protocol = 'TCP') {
  const tcp = protocol === 'TCP';
  const transport = Array(tcp ? 20 : 8).fill(0);
  write16(transport, 0, 49152); write16(transport, 2, 9000);
  if (tcp) { transport[7] = 1; transport[11] = 1; transport[12] = 0x50; transport[13] = 0x18; write16(transport, 14, 4096); }
  else write16(transport, 4, transport.length + data.length);
  transport.push(...data);
  const ip = [0x45,0,0,0,0x12,0x34,0x40,0,64,tcp ? 6 : 17,0,0,192,168,1,10,10,0,0,20];
  write16(ip, 2, 20 + transport.length);
  let transportCheck = checksum([...pseudo(ip, transport.length), ...transport]);
  if (!tcp && transportCheck === 0) transportCheck = 65535;
  write16(transport, tcp ? 16 : 6, transportCheck);
  write16(ip, 10, checksum(ip));
  return framePacket([...ip, ...transport]);
}
export function checks(frame) {
  const end = frame.length - 4;
  const received = (frame[end] | (frame[end + 1] << 8) | (frame[end + 2] << 16) | (frame[end + 3] << 24)) >>> 0;
  const ip = frame.slice(14, 34);
  const length = read16(ip, 2);
  const transport = frame.slice(34, 14 + length);
  return { ethernet: crc32(frame.slice(0, end)) === received,
    ip: checksum(ip) === 0,
    transport: checksum([...pseudo(ip, transport.length), ...transport]) === 0 };
}
export function routeFrame(frame, hop) {
  const ip = frame.slice(14, 14 + read16(frame, 16));
  ip[8]--; ip[10] = 0; ip[11] = 0;
  write16(ip, 10, checksum(ip.slice(0, 20)));
  return framePacket(ip, hop);
}
export function payload(frame) {
  const size = frame[23] === 6 ? 20 : 8;
  return frame.slice(34 + size, 14 + read16(frame, 16));
}
const names = ['Laptop', 'Switch', 'Router', 'Gateway', 'Server'];
const event = (s, text, update = {}) => ({ ...s, ...update, progress: 0, events: [text, ...s.events].slice(0, 30) });
export function initial(protocol = 'TCP', text = 'Hello') {
  const data = encodeMessage(text);
  const frame = makeFrame(data, protocol);
  return { status: 'idle', protocol, phase: 'application', frame, originalFrame: [...frame], data, hop: 0, progress: 0, attempt: 1, dirty: false, events: ['Ready. Start a transmission to build the packet layer by layer.'] };
}
export function nextEvent(s, links) {
  if (s.phase === 'application') return event(s, `Transport: added ${s.protocol === 'TCP' ? 20 : 8} header bytes and calculated the transport checksum.`, { phase: 'transport' });
  if (s.phase === 'transport') return event(s, 'Network: added 20 IPv4 header bytes, including TTL and header checksum.', { phase: 'ip' });
  if (s.phase === 'ip') return event(s, 'Link: added Ethernet addresses, padding if needed, and a calculated frame check sequence.', { phase: 'ethernet' });
  if (s.phase === 'ethernet') return event(s, 'Sending the serialized frame onto the link.', { phase: 'wire' });
  if (s.phase === 'route-ip') {
    const frame = routeFrame(s.frame, s.hop);
    return event(s, `${names[s.hop]}: decreased TTL and updated the IPv4 checksum. Transport bytes stay unchanged.`, { frame, originalFrame: [...frame], phase: 'route-frame' });
  }
  if (s.phase === 'route-frame') return event(s, `${names[s.hop]}: added outgoing Ethernet addresses and a new FCS.`, { phase: 'wire' });
  if (s.phase === 'receive-ip') return event(s, 'Server: validated IPv4 and removed its 20-byte header.', { phase: 'receive-transport' });
  if (s.phase === 'receive-transport') return event(s, 'Server: validated the transport checksum and removed its header.', { phase: 'receive-data' });
  if (s.phase === 'receive-data') return event(s, 'Application received the decoded message.', { phase: 'delivered', status: 'delivered' });
  if (!links[s.hop]) return event(s, 'Link disconnected: frame lost.', { status: 'dropped' });
  const valid = checks(s.frame);
  if (!valid.ethernet) {
    if (s.protocol === 'TCP' && s.attempt === 1) {
      const frame = makeFrame(s.data, s.protocol);
      return event(s, 'Bad Ethernet FCS: receiver discarded frame. Simplified TCP timeout/retry starts at sender.', { frame, originalFrame: [...frame], hop: 0, attempt: 2, dirty: false, phase: 'application' });
    }
    return event(s, 'Bad Ethernet FCS: receiver discarded frame.', { status: 'dropped' });
  }
  const receiver = s.hop + 1;
  if (receiver === 1) return event(s, 'Switch: checked FCS and forwarded the same frame. IP and transport headers remain enclosed.', { hop: 1 });
  if (!valid.ip) return event(s, 'Invalid IPv4 checksum: packet discarded.', { status: 'dropped' });
  if (receiver === 4) {
    if (!valid.transport) return event(s, 'Invalid transport checksum: message discarded.', { status: 'dropped' });
    return event(s, 'Server: checked FCS and removed Ethernet framing and padding.', { phase: 'receive-ip', progress: 1 });
  }
  if (s.frame[22] <= 1) return event(s, 'TTL expired: router discarded packet.', { status: 'dropped' });
  return event(s, `${names[receiver]}: checked FCS, removed incoming Ethernet framing, and inspected the IPv4 header.`, { hop: receiver, phase: 'route-ip' });
}
export function advance(s, links) {
  if (s.status !== 'playing') return s;
  if (s.progress < 1) return { ...s, progress: Math.min(1, s.progress + .025) };
  return nextEvent(s, links);
}
export function flipFrameBit(s, offset) {
  if (s.status !== 'paused' || s.phase !== 'wire') return s;
  const frame = [...s.frame]; frame[Math.floor(offset / 8)] ^= 1 << (7 - offset % 8);
  return { ...s, frame, dirty: !checks(frame).ethernet, events: [`Flipped frame bit ${offset}. Checksums were intentionally left unchanged.`, ...s.events].slice(0, 30) };
}
