import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Router, Server, Monitor, Network, Play, Pause, Send, Binary, Info, Activity, Search } from 'lucide-react';

// --- Helper Functions ---
const generateMac = () => Array.from({length: 6}, () => Math.floor(Math.random()*256).toString(16).padStart(2, '0').toUpperCase()).join(':');
const generateEphemeralPort = () => Math.floor(Math.random() * (65535 - 1024) + 1024);

const toBinary = (text, type, showBits) => {
  if (!showBits) return text;
  try {
    if (type === 'ip') {
      return text.split('.').map(n => parseInt(n).toString(2).padStart(8, '0')).join('.');
    } else if (type === 'mac') {
      return text.split(':').map(n => parseInt(n, 16).toString(2).padStart(8, '0')).join(':');
    } else {
      return parseInt(text).toString(2).padStart(8, '0');
    }
  } catch {
    return text;
  }
};

// --- Static Topology Definition ---
// Using percentages for highly responsive layout
const NETWORK_NODES_TEMPLATE = [
  { id: 'R1', type: 'router', label: 'Core Router', ip: '10.0.0.1', x: 50, y: 15, subnet: 'gateway' },
  { id: 'S1', type: 'switch', label: 'Subnet A Switch', ip: '192.168.10.254', x: 25, y: 45, subnet: '192.168.10' },
  { id: 'S2', type: 'switch', label: 'Subnet B Switch', ip: '192.168.20.254', x: 75, y: 45, subnet: '192.168.20' },
  { id: 'PC1', type: 'pc', label: 'PC-Alpha', ip: '192.168.10.11', x: 10, y: 80, subnet: '192.168.10' },
  { id: 'PC2', type: 'pc', label: 'PC-Beta', ip: '192.168.10.12', x: 35, y: 80, subnet: '192.168.10' },
  { id: 'SRV1', type: 'server', label: 'Web Server', ip: '192.168.20.11', x: 65, y: 80, subnet: '192.168.20' },
  { id: 'SRV2', type: 'server', label: 'DB Server', ip: '192.168.20.12', x: 90, y: 80, subnet: '192.168.20' },
];

const NETWORK_EDGES = [
  { from: 'R1', to: 'S1' },
  { from: 'R1', to: 'S2' },
  { from: 'S1', to: 'PC1' },
  { from: 'S1', to: 'PC2' },
  { from: 'S2', to: 'SRV1' },
  { from: 'S2', to: 'SRV2' },
];

// Simple BFS Pathfinding for the tree topology
const getPath = (start, end) => {
  const adj = {};
  NETWORK_EDGES.forEach(e => {
    if(!adj[e.from]) adj[e.from] = [];
    if(!adj[e.to]) adj[e.to] = [];
    adj[e.from].push(e.to);
    adj[e.to].push(e.from);
  });
  const q = [[start]];
  const visited = new Set([start]);
  while(q.length > 0) {
    const p = q.shift();
    const curr = p[p.length-1];
    if (curr === end) return p;
    for(let n of adj[curr] || []) {
      if(!visited.has(n)) {
        visited.add(n);
        q.push([...p, n]);
      }
    }
  }
  return [];
};

export default function NetworkSimulator() {
  // Initialize nodes with persistent random MAC addresses
  const nodes = useMemo(() => {
    return NETWORK_NODES_TEMPLATE.map(n => ({...n, mac: generateMac()}));
  }, []);

  const [sourceId, setSourceId] = useState('PC1');
  const [destId, setDestId] = useState('SRV1');
  const [protocol, setProtocol] = useState('TCP');
  
  const [simState, setSimState] = useState('idle'); // idle, playing, paused
  const [showBits, setShowBits] = useState(false);
  const [packetVisual, setPacketVisual] = useState(null); // Used strictly for UI rendering
  const [inspectorData, setInspectorData] = useState(null);

  // Mutable refs for animation loop to avoid dependency staleness
  const simStateRef = useRef(simState);
  const packetStateRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    simStateRef.current = simState;
  }, [simState]);

  // Main Animation Loop
  const handleSend = () => {
    if (sourceId === destId) return;
    const path = getPath(sourceId, destId);
    if (!path.length) return;

    packetStateRef.current = {
      sourceId,
      destId,
      protocol,
      srcPort: generateEphemeralPort(),
      path,
      pathIdx: 0,
      progress: 0
    };
    
    setSimState('playing');
    updateInspector(packetStateRef.current);
  };

  const togglePlayPause = () => {
    if (simState === 'playing') setSimState('paused');
    else if (simState === 'paused') setSimState('playing');
  };

  // Dynamically calculate encapsulation headers based on the current hop
  const updateInspector = useCallback((pState) => {
    if (!pState) return;
    const { path, pathIdx, sourceId, destId, protocol } = pState;
    const srcNode = nodes.find(n => n.id === sourceId);
    const dstNode = nodes.find(n => n.id === destId);
    const router = nodes.find(n => n.id === 'R1');
    
    const currentHopStartId = path[pathIdx];
    const currentHopEndId = path[pathIdx + 1];

    // Determine MAC addresses for current segment (Hop-by-Hop encapsulation)
    let frameSrcMac, frameDstMac;
    
    if (srcNode.subnet === dstNode.subnet) {
      // Intra-subnet routing (Switch just forwards, MACs remain original)
      frameSrcMac = srcNode.mac;
      frameDstMac = dstNode.mac;
    } else {
      // Inter-subnet routing via Router
      const routerIndex = path.indexOf('R1');
      if (pathIdx < routerIndex) {
        // Going TO the router
        frameSrcMac = srcNode.mac;
        frameDstMac = router.mac;
      } else {
        // Going FROM the router
        frameSrcMac = router.mac;
        frameDstMac = dstNode.mac;
      }
    }

    // IP TTL decrements when passing through the router
    const passedRouter = path.indexOf('R1') > -1 && pathIdx >= path.indexOf('R1');
    const ttl = passedRouter ? 63 : 64;

    setInspectorData({
      layer2: {
        srcMac: frameSrcMac,
        dstMac: frameDstMac,
        type: '0x0800 (IPv4)'
      },
      layer3: {
        srcIp: srcNode.ip,
        dstIp: dstNode.ip,
        ttl: ttl,
        proto: protocol === 'TCP' ? 6 : protocol === 'UDP' ? 17 : 1,
        flags: '0x00',
        length: '40'
      },
      layer4: {
        srcPort: pState.srcPort,
        dstPort: protocol === 'TCP' ? 443 : protocol === 'UDP' ? 53 : 'N/A',
        protocol: protocol
      },
      meta: {
        hop: `${nodes.find(n=>n.id===currentHopStartId).label} -> ${nodes.find(n=>n.id===currentHopEndId).label}`
      }
    });
  }, [nodes]);

  useEffect(() => {
    const animate = (time) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (simStateRef.current === 'playing' && packetStateRef.current) {
        const packet = packetStateRef.current;
        packet.progress += 0.0006 * deltaTime;

        if (packet.progress >= 1) {
          packet.progress = 0;
          packet.pathIdx++;
          if (packet.pathIdx >= packet.path.length - 1) {
            setSimState('idle');
            setPacketVisual(null);
            packetStateRef.current = null;
            requestRef.current = requestAnimationFrame(animate);
            return;
          }
          updateInspector(packet);
        }

        const fromNode = nodes.find(n => n.id === packet.path[packet.pathIdx]);
        const toNode = nodes.find(n => n.id === packet.path[packet.pathIdx + 1]);
        const x = fromNode.x + (toNode.x - fromNode.x) * packet.progress;
        const y = fromNode.y + (toNode.y - fromNode.y) * packet.progress;

        setPacketVisual({ x, y });
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [nodes, updateInspector]);

  const renderNodeIcon = (type) => {
    switch (type) {
      case 'router': return <Router size={24} className="text-orange-400" />;
      case 'switch': return <Network size={24} className="text-purple-400" />;
      case 'server': return <Server size={24} className="text-green-400" />;
      default: return <Monitor size={24} className="text-cyan-400" />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 text-slate-300 font-sans overflow-hidden">
      
      {/* LEFT PANEL: NETWORK TOPOLOGY MAP */}
      <div className="flex-grow relative border-b md:border-b-0 md:border-r border-slate-800 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950 shadow-inner overflow-hidden">
        
        {/* Background Grid for Cybersecurity Vibe */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.3 }}></div>

        {/* SVG Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {NETWORK_EDGES.map((e, idx) => {
            const from = nodes.find(n => n.id === e.from);
            const to = nodes.find(n => n.id === e.to);
            return (
              <line 
                key={idx} 
                x1={`${from.x}%`} y1={`${from.y}%`} 
                x2={`${to.x}%`} y2={`${to.y}%`} 
                stroke="#334155" 
                strokeWidth="3" 
                strokeDasharray="6 4"
                className="opacity-50"
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((n) => (
          <div 
            key={n.id}
            className="absolute flex flex-col items-center justify-center group"
            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%, -50%)', zIndex: 10 }}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border border-slate-700 bg-slate-800/80 backdrop-blur-sm transition-transform group-hover:scale-110 
              ${n.id === sourceId ? 'ring-2 ring-cyan-500' : ''} 
              ${n.id === destId ? 'ring-2 ring-green-500' : ''}`}
            >
              {renderNodeIcon(n.type)}
            </div>
            
            {/* Tooltip / Label */}
            <div className="absolute top-16 flex flex-col items-center opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-xs font-bold text-slate-200 whitespace-nowrap bg-slate-900/80 px-2 py-0.5 rounded">{n.label}</span>
              <span className="text-[10px] text-cyan-300 font-mono mt-1">{n.ip}</span>
              <span className="text-[10px] text-slate-500 font-mono hidden group-hover:block">{n.mac}</span>
            </div>
          </div>
        ))}

        {/* Animated Packet */}
        {packetVisual && (
          <div 
            className="absolute w-5 h-5 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_15px_#22d3ee] flex items-center justify-center cursor-pointer transition-transform hover:scale-150"
            style={{ left: `${packetVisual.x}%`, top: `${packetVisual.y}%`, transform: 'translate(-50%, -50%)', zIndex: 50 }}
            onClick={() => setSimState('paused')}
            title="Click to Pause and Inspect"
          >
            <Activity size={12} className="text-slate-900 animate-pulse" />
          </div>
        )}
      </div>

      {/* RIGHT PANEL: CONTROLS & INSPECTOR */}
      <div className="w-full md:w-96 flex flex-col bg-slate-900/95 shadow-2xl z-20 overflow-y-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <h2 className="font-bold text-lg text-slate-100 flex items-center gap-2">
            <Search size={18} className="text-cyan-400"/> Packet Inspector
          </h2>
        </div>

        {/* Control Panel */}
        <div className="p-4 space-y-4 border-b border-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Source Node</label>
              <select 
                className="w-full bg-slate-800 border border-slate-700 text-sm rounded p-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                disabled={simState !== 'idle'}
              >
                {nodes.filter(n => n.type === 'pc' || n.type === 'server').map(n => (
                  <option key={n.id} value={n.id}>{n.label} ({n.ip})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Dest Node</label>
              <select 
                className="w-full bg-slate-800 border border-slate-700 text-sm rounded p-1.5 text-slate-200 focus:outline-none focus:border-green-500"
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                disabled={simState !== 'idle'}
              >
                {nodes.filter(n => (n.type === 'pc' || n.type === 'server') && n.id !== sourceId).map(n => (
                  <option key={n.id} value={n.id}>{n.label} ({n.ip})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Protocol</label>
            <div className="flex gap-2">
              {['TCP', 'UDP', 'ICMP'].map(p => (
                <button 
                  key={p}
                  className={`flex-1 py-1 text-xs rounded border ${protocol === p ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  onClick={() => setProtocol(p)}
                  disabled={simState !== 'idle'}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {simState === 'idle' ? (
              <button 
                onClick={handleSend}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded flex items-center justify-center gap-2 transition-colors shadow-lg shadow-cyan-900/50"
              >
                <Send size={16} /> Send Packet
              </button>
            ) : (
              <>
                <button 
                  onClick={togglePlayPause}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded flex items-center justify-center gap-2 transition-colors"
                >
                  {simState === 'playing' ? <Pause size={16} /> : <Play size={16} />}
                  {simState === 'playing' ? 'Pause' : 'Resume'}
                </button>
                <button 
                  onClick={() => {
                    setSimState('idle');
                    setPacketVisual(null);
                    packetStateRef.current = null;
                  }}
                  className="flex-none px-4 bg-slate-700 hover:bg-red-600 text-white py-2 rounded transition-colors"
                  title="Stop Simulation"
                >
                  Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Deep Zoom Toggle */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
          <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Binary size={16} className="text-green-400"/> Deep Zoom (Bits)
          </span>
          <button 
            onClick={() => setShowBits(!showBits)}
            className={`w-10 h-5 rounded-full relative transition-colors ${showBits ? 'bg-green-500' : 'bg-slate-600'}`}
          >
            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${showBits ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Packet Data Inspector Panels */}
        <div className="p-4 flex-grow overflow-y-auto space-y-4">
          
          {!packetVisual && simState === 'idle' ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center space-y-2">
               <Info size={32} className="opacity-50" />
               <p className="text-sm">Initiate a transfer to inspect packet layers in transit.</p>
             </div>
          ) : (
            <>
              {/* Context Tag */}
              <div className="bg-slate-800 p-2 rounded text-xs text-center border border-slate-700 text-cyan-300 font-medium">
                Current Segment: {inspectorData?.meta.hop}
              </div>

              {/* Layer 2: Ethernet Frame */}
              <div className={`rounded-md border overflow-hidden ${showBits ? 'border-green-500/50' : 'border-slate-700'}`}>
                <div className={`px-3 py-1.5 text-xs font-bold flex justify-between ${showBits ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-200'}`}>
                  <span>Layer 2: Ethernet II Frame</span>
                </div>
                <div className={`p-3 space-y-2 text-xs font-mono break-all ${showBits ? 'bg-black text-green-500' : 'bg-slate-900 text-slate-300'}`}>
                  <div>
                    <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">Destination MAC (Next Hop)</span>
                    {toBinary(inspectorData?.layer2.dstMac, 'mac', showBits)}
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">Source MAC (Current Sender)</span>
                    {toBinary(inspectorData?.layer2.srcMac, 'mac', showBits)}
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">EtherType</span>
                    {toBinary('0800', 'hex', showBits)} {showBits ? '' : '(IPv4)'}
                  </div>
                </div>
              </div>

              {/* Layer 3: IP Packet */}
              <div className={`rounded-md border overflow-hidden ${showBits ? 'border-green-500/50' : 'border-slate-700'}`}>
                <div className={`px-3 py-1.5 text-xs font-bold flex justify-between ${showBits ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-200'}`}>
                  <span>Layer 3: IPv4 Packet</span>
                </div>
                <div className={`p-3 grid grid-cols-2 gap-3 text-xs font-mono break-all ${showBits ? 'bg-black text-green-500' : 'bg-slate-900 text-slate-300'}`}>
                  <div className="col-span-2">
                    <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">Source IP</span>
                    {toBinary(inspectorData?.layer3.srcIp, 'ip', showBits)}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">Destination IP</span>
                    {toBinary(inspectorData?.layer3.dstIp, 'ip', showBits)}
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">TTL</span>
                    {toBinary(inspectorData?.layer3.ttl, 'num', showBits)}
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">Protocol</span>
                    {toBinary(inspectorData?.layer3.proto, 'num', showBits)} {showBits ? '' : `(${inspectorData?.layer4.protocol})`}
                  </div>
                </div>
              </div>

              {/* Layer 4: Transport Segment */}
              <div className={`rounded-md border overflow-hidden ${showBits ? 'border-green-500/50' : 'border-slate-700'}`}>
                <div className={`px-3 py-1.5 text-xs font-bold flex justify-between ${showBits ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-200'}`}>
                  <span>Layer 4: {inspectorData?.layer4.protocol} Segment</span>
                </div>
                <div className={`p-3 grid grid-cols-2 gap-3 text-xs font-mono break-all ${showBits ? 'bg-black text-green-500' : 'bg-slate-900 text-slate-300'}`}>
                  {inspectorData?.layer4.protocol === 'ICMP' ? (
                    <div className="col-span-2 text-slate-500 italic">ICMP Does not use ports</div>
                  ) : (
                    <>
                      <div>
                        <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">Source Port</span>
                        {toBinary(inspectorData?.layer4.srcPort, 'num', showBits)}
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5 text-[10px] uppercase">Dest Port</span>
                        {toBinary(inspectorData?.layer4.dstPort, 'num', showBits)}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payload Data */}
              <div className={`rounded-md border overflow-hidden ${showBits ? 'border-green-500/50' : 'border-slate-700'}`}>
                 <div className={`px-3 py-1.5 text-xs font-bold flex justify-between ${showBits ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-200'}`}>
                  <span>Layer 7: Data Payload</span>
                </div>
                <div className={`p-3 text-xs font-mono break-all ${showBits ? 'bg-black text-green-500' : 'bg-slate-900 text-slate-300'}`}>
                  {showBits 
                    ? '01001000 01100101 01101100 01101100 01101111 00100000 01010111 01101111 01110010 01101100 01100100'
                    : '"Hello World" (Application Data)'}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}