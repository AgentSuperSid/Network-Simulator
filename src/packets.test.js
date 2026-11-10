import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checksum, makeFrame, checks, routeFrame, payload, initial, nextEvent, flipFrameBit, read16 } from './packets.js';
import { encodeMessage } from './integrity.js';
const links = [true,true,true,true];
test('IPv4 checksum agrees with a known header vector', () => {
  const header = [0x45,0,0,0x73,0,0,0x40,0,0x40,0x11,0,0,0xc0,0xa8,0,1,0xc0,0xa8,0,0xc7];
  assert.equal(checksum(header), 0xb861);
});
for (const protocol of ['TCP','UDP']) {
  test(`${protocol}: serialization lengths, checksums, padding and payload`, () => {
    for (const message of ['', 'Hello', '🌍', 'x'.repeat(32)]) {
      const data = encodeMessage(message);
      const f = makeFrame(data, protocol);
      const header = protocol === 'TCP' ? 20 : 8;
      assert.equal(read16(f,16), 20 + header + data.length);
      assert.equal(f.length, Math.max(60, 14 + 20 + header + data.length) + 4);
      assert.deepEqual(payload(f), data);
      assert.deepEqual(checks(f), { ethernet:true, ip:true, transport:true });
    }
  });
  test(`${protocol}: router replaces link addresses and IPv4 TTL/checksum only`, () => {
    const f = makeFrame(encodeMessage('Hello'), protocol);
    const next = routeFrame(f,2);
    assert.notDeepEqual(next.slice(0,12),f.slice(0,12));
    assert.equal(next[22],63);
    assert.deepEqual(next.slice(26,34),f.slice(26,34));
    assert.deepEqual(next.slice(34,-4),f.slice(34,-4));
    assert.deepEqual(checks(next), {ethernet:true,ip:true,transport:true});
  });
  test(`${protocol}: every frame bit corruption is detected by FCS`, () => {
    const f = makeFrame(encodeMessage('Hello'), protocol);
    for(let offset=0;offset<f.length*8;offset++) {
      const changed=[...f]; changed[offset>>3]^=1<<(7-offset%8);
      assert.equal(checks(changed).ethernet,false);
    }
  });
  test(`${protocol}: complete lifecycle unwraps the destination message`, () => {
    let s={...initial(protocol),status:'playing'};
    const phases=[];
    for(let i=0;i<30 && s.status==='playing';i++){ phases.push(s.phase); s=nextEvent(s,links); }
    assert.equal(s.status,'delivered');
    assert.equal(s.frame[22],62);
    for(const phase of ['application','transport','ip','ethernet','wire','route-ip','route-frame','receive-ip','receive-transport','receive-data']) assert.ok(phases.includes(phase),phase);
  });
}
test('switch preserves exact frame bytes',()=>{
  const s={...initial(),status:'playing',phase:'wire'};
  const next=nextEvent(s,links); assert.equal(next.hop,1); assert.deepEqual(next.frame,s.frame);
});
test('corruption retry restores original bytes; UDP drops instead',()=>{
  for(const protocol of ['TCP','UDP']){
    let s={...initial(protocol),status:'paused',phase:'wire'};
    s=flipFrameBit(s,300);
    assert.equal(checks(s.frame).ethernet,false);
    s=nextEvent({...s,status:'playing'},links);
    if(protocol==='UDP') assert.equal(s.status,'dropped');
    else {assert.equal(s.attempt,2); assert.equal(s.phase,'application');assert.ok(checks(s.frame).ethernet);}
  }
});
test('bit edits are restricted to paused frames in transit',()=>{
  const s=initial(); assert.equal(flipFrameBit(s,0),s);
});
