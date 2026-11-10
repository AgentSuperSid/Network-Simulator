import { useState } from 'react';
import { checks, payload, read16 } from './packets.js';

const field = (name, start, length, format = 'number') => ({ name, start, length, format });
function value(frame, f) {
  const b = frame.slice(f.start / 8, (f.start + f.length) / 8);
  if (f.format === 'ip') return b.join('.');
  if (f.format === 'mac') return b.map(v => v.toString(16).padStart(2, '0')).join(':');
  if (f.format === 'text') return new TextDecoder().decode(new Uint8Array(b));
  if (f.format === 'hex') return b.map(v => v.toString(16).padStart(2, '0')).join(' ');
  let n = 0;
  for (let i = f.start; i < f.start + f.length; i++) n = n * 2 + ((frame[i >> 3] >> (7 - i % 8)) & 1);
  return String(n);
}
export default function PacketInspector({ sim, onFlip }) {
  const [selected, setSelected] = useState('Destination MAC');
  const tcp = sim.protocol === 'TCP';
  const transportBytes = tcp ? 20 : 8;
  const dataStart = 34 + transportBytes;
  const dataEnd = 14 + read16(sim.originalFrame, 16);
  const groups = [
    { name: 'Ethernet II', color: 'ether', fields: [field('Destination MAC',0,48,'mac'),field('Source MAC',48,48,'mac'),field('EtherType',96,16,'hex')] },
    { name: 'IPv4', color: 'ipv4', fields: [field('Version',112,4),field('IHL (32-bit words)',116,4),field('DSCP',120,6),field('ECN',126,2),field('Total length',128,16),field('Identification',144,16),field('Flags',160,3),field('Fragment offset',163,13),field('TTL',176,8),field('Protocol',184,8),field('IPv4 checksum',192,16,'hex'),field('Source IP',208,32,'ip'),field('Destination IP',240,32,'ip')] },
    { name: tcp ? 'TCP segment' : 'UDP datagram', color: 'transport', fields: [field('Source port',272,16),field('Destination port',288,16),...(tcp ? [field('Sequence number',304,32),field('Acknowledgment number',336,32),field('Data offset',368,4),field('Reserved',372,4),field('TCP flags',376,8),field('Window',384,16),field('Transport checksum',400,16,'hex'),field('Urgent pointer',416,16)] : [field('UDP length',304,16),field('Transport checksum',320,16,'hex')])] },
    { name: 'Application data', color: 'application', fields: [field('Message',dataStart * 8,(dataEnd - dataStart) * 8,'text')] },
    { name: 'Ethernet trailer', color: 'ether', fields: [...(sim.frame.length - 4 > dataEnd ? [field('Padding',dataEnd * 8,(sim.frame.length - 4 - dataEnd) * 8,'hex')] : []),field('Frame check sequence', (sim.frame.length - 4) * 8,32,'hex')] },
  ];
  const phase = sim.phase;
  const ethernet = ['ethernet','wire'].includes(phase);
  const ip = ethernet || ['ip','route-ip','route-frame','receive-ip'].includes(phase);
  const transport = ip || ['transport','receive-transport'].includes(phase);
  const visible = groups.filter((g, i) => i === 3 || ((i === 0 || i === 4) ? ethernet : i === 1 ? ip : transport));
  const all = visible.flatMap(g => g.fields);
  const chosen = all.find(f => f.name === selected) || all[0];
  const valid = checks(sim.frame);
  const editable = sim.status === 'paused' && sim.phase === 'wire';
  return <section className="packet-lab">
    <div className="structure-title"><div><span className="eyebrow">SERIALIZED PACKET / {phase.replaceAll('-', ' ').toUpperCase()}</span><h2>Inside the frame</h2></div><span>{sim.frame.length} frame bytes</span></div>
    <p className="stage-message" aria-live="polite">{sim.events[0]}</p>
    <div className="packet-nesting"><div className={ethernet ? 'wrapper ether' : 'wrapper absent'}><b>Ethernet {ethernet ? '14 B header + padding + 4 B FCS' : 'not present at this stage'}</b><div className={ip ? 'wrapper ipv4' : 'wrapper absent'}><b>IPv4 {ip ? '20 B header' : 'not present'}</b><div className={transport ? 'wrapper transport' : 'wrapper absent'}><b>{sim.protocol} {transport ? `${transportBytes} B header` : 'not present'}</b><div className="wrapper application">Application · {sim.data.length} B</div></div></div></div></div>
    <div className="field-groups">{visible.map(g => <div className={'field-group ' + g.color} key={g.name}><h3>{g.name}</h3><div className="fields">{g.fields.map(f => <button key={f.name} className={chosen.name === f.name ? 'active-field' : ''} onClick={() => setSelected(f.name)}><b>{f.name}</b><span>{f.length} bits · {value(sim.frame, f)}</span></button>)}</div></div>)}</div>
    <div className="selected-field"><h3>{chosen.name}</h3><p>Frame bit offset {chosen.start} · {chosen.length} bits · Value: {value(sim.frame, chosen)}</p><p>{editable ? 'Click any bit below to corrupt this field. The transmitted checksums stay unchanged.' : 'Pause while the frame is travelling on a link to edit its bits.'}</p><div className="field-bits">{Array.from({ length: chosen.length }, (_, i) => { const offset = chosen.start + i; const bit = (sim.frame[offset >> 3] >> (7 - offset % 8)) & 1; const original = (sim.originalFrame[offset >> 3] >> (7 - offset % 8)) & 1; return <button key={offset} disabled={!editable} className={bit !== original ? 'changed-bit' : ''} onClick={() => onFlip(offset)} aria-label={`Flip ${chosen.name} bit ${i + 1}`}>{bit}</button>; })}</div></div>
    <div className="check-row">{Object.entries(valid).map(([name, good]) => <span className={good ? 'check-good' : 'check-bad'} key={name}>{name === 'ethernet' ? 'Ethernet FCS' : name === 'ip' ? 'IPv4 checksum' : 'Transport checksum'}: {good ? 'valid' : 'invalid'}</span>)}</div><p>Checks above inspect the full stored frame. Layers disappear from the view as the device unwraps it. Decoded payload: “{new TextDecoder().decode(new Uint8Array(payload(sim.frame)))}”</p>
  </section>;
}
