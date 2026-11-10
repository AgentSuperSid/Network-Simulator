import { useEffect, useState } from 'react';
import './lab.css';
import { initial, advance, nextEvent, flipFrameBit } from './packets.js';
import PacketInspector from './PacketInspector.jsx';

const nodes = [
  { id: 'laptop', name: 'Laptop', ip: '192.168.1.10', x: 10, y: 52, icon: '▣' },
  { id: 'switch', name: 'Switch', ip: '', x: 30, y: 52, icon: '▦' },
  { id: 'router', name: 'Router', ip: '192.168.1.1', x: 50, y: 52, icon: '◉' },
  { id: 'gateway', name: 'Gateway', ip: '10.0.0.1', x: 70, y: 52, icon: '◉' },
  { id: 'server', name: 'Server', ip: '10.0.0.20', x: 90, y: 52, icon: '▤' },
];
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
  const send = () => setSim({ ...initial(protocol, message || 'Hello'), status: 'playing' });
  const reset = () => { setSim(initial()); setLinks([true, true, true, true]); setProtocol('TCP'); setMessage('Hello'); setZoom(1); setDetail('network'); setSelected(null); };
  const flip = offset => setSim(s => flipFrameBit(s, offset));
  const active = ['playing', 'paused'].includes(sim.status);
  const x = nodes[sim.hop].x + (nodes[sim.hop + 1].x - nodes[sim.hop].x) * (sim.phase === 'wire' ? sim.progress : sim.phase.startsWith('receive') || sim.phase === 'delivered' ? 1 : 0);
  const ttl = sim.frame[22];
  return <main className="lab">
    <header className="top"><div><span className="eyebrow">INTERACTIVE NETWORK LAB</span><h1>Internet, up close<span>.</span></h1></div><div className="topright"><span className="status"><i /> {sim.status.toUpperCase()}</span><button onClick={reset}>↺ Reset lab</button></div></header>
    <div className="workspace"><section className="world"><div className="worldhead"><div><span className="eyebrow">01 / THE NETWORK</span><h2>Follow the packet</h2><p>Click a link to disconnect it. Select a device to inspect it.</p></div><div className="zoom"><button onClick={() => setZoom(z => Math.max(1, z - .25))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(2, z + .25))}>+</button></div></div>
      <div className="canvas"><div className="map" style={{ transform: `scale(${zoom})` }}><svg viewBox="0 0 1000 500" preserveAspectRatio="none" className="wires">{links.map((on, i) => <g key={i} onClick={() => setLinks(l => l.map ( (v, j) => j === i ? !v : v))} className="wire"><line x1={nodes[i].x * 10} y1="260" x2={nodes[i + 1].x * 10} y2="260" stroke={on ? '#34617a' : '#e45d68'} strokeWidth="3" strokeDasharray={on ? '7 8' : '3 7'} /><line x1={nodes[i].x * 10} y1="260" x2={nodes[i + 1].x * 10} y2="260" stroke="transparent" strokeWidth="35" /></g>)}</svg>
        {nodes.map(n => <button key={n.id} onClick={() => setSelected(n)} className={'node ' + (selected?.id === n.id ? 'selected' : '')} style={{ left: `${n.x}%`, top: `${n.y}%` }}><span className="nodeicon">{n.icon}</span><strong>{n.name}</strong><small>{n.ip || 'Layer 2'}</small></button>)}
        {active && <button className={'packet ' + (sim.dirty ? 'corrupt' : '')} style={{ left: `${x}%`, top: '52%' }} title="Pause and inspect packet" onClick={() => { setSim(s => ({ ...s, status: 'paused' })); setDetail('packet'); }}>◆</button>}
      </div><div className="canvasfoot"><span>● LIVE TOPOLOGY</span><span>Click the glowing packet to inspect</span></div></div>
      <div className="timeline"><div><span className="eyebrow">TRANSMISSION</span><strong>{sim.status === 'idle' ? 'Ready when you are' : `${nodes[sim.hop].name} → ${nodes[sim.hop + 1].name}`}</strong><small>Attempt {sim.attempt} · TTL {ttl}</small></div><div className="controls">{!active ? <><button className="primary" onClick={send}>▶ Send packet</button><button onClick={() => setSim({ ...initial(protocol, message || 'Hello'), status: 'paused' })}>Start paused</button></> : <><button className="primary" onClick={() => setSim(s => ({ ...s, status: s.status === 'playing' ? 'paused' : 'playing' }))}>{sim.status === 'playing' ? 'Ⅱ Pause' : '▶ Resume'}</button><button disabled={sim.status !== 'paused'} onClick={() => setSim(s => { let next = nextEvent({ ...s, status: 'playing' }, links); return next.status === 'playing' ? { ...next, status: 'paused' } : next; })}>Step event →</button></>}<select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Simulation speed"><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></div></div>
      <PacketInspector sim={sim} onFlip={flip} /><div className="eventlog"><span className="eyebrow">EVENT LOG</span>{sim.events.map((event, i) => <div key={i}><span>{String(sim.events.length - i).padStart(2, '0')}</span>{event}</div>)}</div>
    </section><aside className="panel"><div className="panelhead"><span className="eyebrow">02 / EXPLORE</span><h2>Simulation lab</h2><p>Small network, big questions.</p></div>
      <div className="section"><label>TRANSPORT PROTOCOL</label><div className="choices">{['TCP', 'UDP'].map(p => <button disabled={active} className={protocol === p ? 'chosen' : ''} onClick={() => setProtocol(p)} key={p}>{p}</button>)}</div><p>{protocol === 'TCP' ? 'Reliable delivery, with a simplified retry after corruption.' : 'Connectionless delivery; a damaged frame is discarded.'}</p><label htmlFor="payload">MESSAGE · UP TO 32 UTF-8 BYTES</label><input id="payload" value={message} maxLength={32} disabled={active} onChange={e => setMessage(e.target.value)} /></div>
      <div className="section"><label>INSPECTION LEVEL</label><div className="choices">{['network', 'packet', 'bits'].map(d => <button key={d} onClick={() => setDetail(d)} className={detail === d ? 'chosen' : ''}>{d}</button>)}</div>
      {detail === 'network' ? <div className="card"><span className="eyebrow">{selected ? 'SELECTED DEVICE' : 'HOW TO EXPLORE'}</span><h3>{selected ? selected.name : 'Start a transmission'}</h3><p>{selected ? `${selected.ip || 'Forwards frames within the local network.'}` : 'Send a packet, then pause or click it. Switch to packet or bits to look inside.'}</p><p>Click a dotted connection to toggle it on or off—even during a run.</p></div> : <div className="card"><h3>Inspect actual packet bytes</h3><p>The packet structure below the network shows each header field and its exact bits. Select a field, pause on a link, and change a bit to see which checks fail.</p><p>Use Step event to watch headers added at the source, replaced at routers, and removed at the destination.</p></div>}
      </div><div className="note"><b>A model, not the whole internet.</b> Ethernet II, fixed 20-byte IPv4 headers, and UDP or fixed 20-byte TCP headers are serialized. Checksums use those bytes. TCP represents data in an assumed established connection with one simplified retry; no handshake, TLS, DNS, ARP, fragmentation or physical signalling is simulated. Port 9000 carries a plain demonstration message. No real network traffic is sent.</div></aside></div>
  </main>;
}



