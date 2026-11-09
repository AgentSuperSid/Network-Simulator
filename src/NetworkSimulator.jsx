import { useEffect, useState } from 'react';
import './lab.css';

const nodes = [
  { id: 'laptop', name: 'Laptop', ip: '192.168.1.10', x: 10, y: 52, icon: '▣' },
  { id: 'switch', name: 'Switch', ip: '', x: 30, y: 52, icon: '▦' },
  { id: 'router', name: 'Router', ip: '192.168.1.1', x: 50, y: 52, icon: '◉' },
  { id: 'gateway', name: 'Gateway', ip: '10.0.0.1', x: 70, y: 52, icon: '◉' },
  { id: 'server', name: 'Server', ip: '10.0.0.20', x: 90, y: 52, icon: '▤' },
];
const bytes = text => [...new TextEncoder().encode(text)];
const bits = n => n.toString(2).padStart(8, '0');
const initial = () => ({ status: 'idle', hop: 0, progress: 0, attempt: 1, dirty: false, data: bytes('Hello'), original: bytes('Hello'), events: ['Ready to send a packet.'] });
const add = (events, message) => [message, ...events].slice(0, 12);

// A deliberately small discrete-event model: one frame per hop and one retry for TCP.
function advance(s, links, protocol) {
  if (s.status !== 'playing') return s;
  if (s.progress < 1) return { ...s, progress: Math.min(1, s.progress + 0.025) };
  if (!links[s.hop]) return { ...s, status: 'dropped', events: add(s.events, `Link to ${nodes[s.hop + 1].name} is down. Frame dropped.`) };
  if (s.dirty) {
    if (protocol === 'TCP' && s.attempt === 1) return { ...s, hop: 0, progress: 0, dirty: false, data: [...s.original], attempt: 2, events: add(s.events, 'Frame failed its integrity check. TCP timeout triggers a simplified retransmission.') };
    return { ...s, status: 'dropped', events: add(s.events, 'Frame failed its integrity check and was discarded.') };
  }
  if (s.hop === nodes.length - 2) return { ...s, status: 'delivered', events: add(s.events, 'Server received the message successfully.') };
  const hop = s.hop + 1;
  return { ...s, hop, progress: 0, events: add(s.events, `${nodes[hop].name} forwarded the frame${hop === 2 || hop === 3 ? '; IP TTL decreased' : ''}.`) };
}

export default function NetworkSimulator() {
  const [sim, setSim] = useState(initial);
  const [protocol, setProtocol] = useState('TCP');
  const [links, setLinks] = useState([true, true, true, true]);
  const [zoom, setZoom] = useState(1);
  const [detail, setDetail] = useState('network');
  const [speed, setSpeed] = useState(1);
  const [message, setMessage] = useState('Hello');
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (sim.status !== 'playing') return;
    const timer = setInterval(() => setSim(s => advance(s, links, protocol)), 40 / speed);
    return () => clearInterval(timer);
  }, [sim.status, links, protocol, speed]);
  const send = () => { const data = bytes(message || 'Hello').slice(0, 32); setSim({ ...initial(), data, original: [...data], status: 'playing', events: [`${protocol} message sent from Laptop to Server.`] }); };
  const reset = () => { setSim(initial()); setLinks([true, true, true, true]); setProtocol('TCP'); setMessage('Hello'); setZoom(1); setDetail('network'); setSelected(null); };
  const flip = (index, bit) => setSim(s => { const data = [...s.data]; data[index] ^= 1 << bit; return { ...s, data, dirty: data.some((n, i) => n !== s.original[i]), events: add(s.events, `Changed payload byte ${index + 1}, bit ${7 - bit}.`) }; });
  const active = ['playing', 'paused'].includes(sim.status);
  const x = nodes[sim.hop].x + (nodes[sim.hop + 1].x - nodes[sim.hop].x) * sim.progress;
  const ttl = 64 - (sim.hop >= 2 ? 1 : 0) - (sim.hop >= 3 ? 1 : 0);
  return <main className="lab">
    <header className="top"><div><span className="eyebrow">INTERACTIVE NETWORK LAB</span><h1>Internet, up close<span>.</span></h1></div><div className="topright"><span className="status"><i /> {sim.status.toUpperCase()}</span><button onClick={reset}>↺ Reset lab</button></div></header>
    <div className="workspace"><section className="world"><div className="worldhead"><div><span className="eyebrow">01 / THE NETWORK</span><h2>Follow the packet</h2><p>Click a link to disconnect it. Select a device to inspect it.</p></div><div className="zoom"><button onClick={() => setZoom(z => Math.max(1, z - .25))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(2, z + .25))}>+</button></div></div>
      <div className="canvas"><div className="map" style={{ transform: `scale(${zoom})` }}><svg viewBox="0 0 1000 500" preserveAspectRatio="none" className="wires">{links.map((on, i) => <g key={i} onClick={() => setLinks(l => l.map ( (v, j) => j === i ? !v : v))} className="wire"><line x1={nodes[i].x * 10} y1="260" x2={nodes[i + 1].x * 10} y2="260" stroke={on ? '#34617a' : '#e45d68'} strokeWidth="3" strokeDasharray={on ? '7 8' : '3 7'} /><line x1={nodes[i].x * 10} y1="260" x2={nodes[i + 1].x * 10} y2="260" stroke="transparent" strokeWidth="35" /></g>)}</svg>
        {nodes.map(n => <button key={n.id} onClick={() => setSelected(n)} className={'node ' + (selected?.id === n.id ? 'selected' : '')} style={{ left: `${n.x}%`, top: `${n.y}%` }}><span className="nodeicon">{n.icon}</span><strong>{n.name}</strong><small>{n.ip || 'Layer 2'}</small></button>)}
        {active && <button className={'packet ' + (sim.dirty ? 'corrupt' : '')} style={{ left: `${x}%`, top: '52%' }} title="Pause and inspect packet" onClick={() => { setSim(s => ({ ...s, status: 'paused' })); setDetail('packet'); }}>◆</button>}
      </div><div className="canvasfoot"><span>● LIVE TOPOLOGY</span><span>Click the glowing packet to inspect</span></div></div>
      <div className="timeline"><div><span className="eyebrow">TRANSMISSION</span><strong>{sim.status === 'idle' ? 'Ready when you are' : `${nodes[sim.hop].name} → ${nodes[sim.hop + 1].name}`}</strong><small>Attempt {sim.attempt} · TTL {ttl}</small></div><div className="controls">{!active ? <button className="primary" onClick={send}>▶ Send packet</button> : <><button className="primary" onClick={() => setSim(s => ({ ...s, status: s.status === 'playing' ? 'paused' : 'playing' }))}>{sim.status === 'playing' ? 'Ⅱ Pause' : '▶ Resume'}</button><button disabled={sim.status !== 'paused'} onClick={() => setSim(s => { let next = { ...s, status: 'playing', progress: 1 }; next = advance(next, links, protocol); return next.status === 'playing' ? { ...next, status: 'paused' } : next; })}>Step hop →</button></>}<select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Simulation speed"><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></div></div>
      <div className="eventlog"><span className="eyebrow">EVENT LOG</span>{sim.events.map((event, i) => <div key={i}><span>{String(sim.events.length - i).padStart(2, '0')}</span>{event}</div>)}</div>
    </section><aside className="panel"><div className="panelhead"><span className="eyebrow">02 / EXPLORE</span><h2>Simulation lab</h2><p>Small network, big questions.</p></div>
      <div className="section"><label>TRANSPORT PROTOCOL</label><div className="choices">{['TCP', 'UDP'].map(p => <button disabled={active} className={protocol === p ? 'chosen' : ''} onClick={() => setProtocol(p)} key={p}>{p}</button>)}</div><p>{protocol === 'TCP' ? 'Reliable delivery, with a simplified retry after corruption.' : 'Connectionless delivery; a damaged frame is discarded.'}</p><label htmlFor="payload">MESSAGE · UP TO 32 UTF-8 BYTES</label><input id="payload" value={message} maxLength={32} disabled={active} onChange={e => setMessage(e.target.value)} /></div>
      <div className="section"><label>INSPECTION LEVEL</label><div className="choices">{['network', 'packet', 'bits'].map(d => <button key={d} onClick={() => setDetail(d)} className={detail === d ? 'chosen' : ''}>{d}</button>)}</div>
      {detail === 'network' ? <div className="card"><span className="eyebrow">{selected ? 'SELECTED DEVICE' : 'HOW TO EXPLORE'}</span><h3>{selected ? selected.name : 'Start a transmission'}</h3><p>{selected ? `${selected.ip || 'Forwards frames within the local network.'}` : 'Send a packet, then pause or click it. Switch to packet or bits to look inside.'}</p><p>Click a dotted connection to toggle it on or off—even during a run.</p></div> : <><div className="card"><span className="eyebrow">ENCAPSULATION · SIMPLIFIED</span><div className="layer"><b>Ethernet</b><span>Frame for current link</span></div><div className="layer"><b>IPv4</b><span>192.168.1.10 → 10.0.0.20 · TTL {ttl}</span></div><div className="layer"><b>{protocol}</b><span>{protocol === 'TCP' ? 'Port 443 · retry modeled' : 'Port 53 · no retry'}</span></div><div className="layer"><b>Payload</b><span>{sim.data.length} bytes · {sim.dirty ? 'modified' : 'original'}</span></div></div>{detail === 'bits' && <div className="bitbox"><label>PAYLOAD BITS</label><p>{sim.status === 'paused' ? 'Click a bit to flip it, then resume.' : 'Pause a packet to edit its bits.'}</p>{sim.data.map((byte, i) => <div className="byte" key={i}><small>{String(i + 1).padStart(2, '0')}</small>{bits(byte).split('').map((bit, j) => <button key={j} disabled={sim.status !== 'paused'} className={bit !== bits(sim.original[i])[j] ? 'flipped' : ''} onClick={() => flip(i, 7 - j)} aria-label={`Flip byte ${i + 1} bit ${j + 1}`}>{bit}</button>)}</div>)}</div>}</>}
      </div><div className="note"><b>A model, not the whole internet.</b> Frames, routing, integrity checks and TCP retries are simplified. Bit edits simulate corruption on the current link; this lab does not send real network traffic.</div></aside></div>
  </main>;
}
