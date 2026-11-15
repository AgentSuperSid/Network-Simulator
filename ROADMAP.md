# Network Simulator Roadmap

## Experience target

The learner should be able to answer three questions without reading a wall of text:

1. Where is the data now?
2. What wrapping or transformation is happening here?
3. What happens when this link, field, or bit changes?

The visual depth model is: **topology → device/link → protocol layers → fields/bytes → bits**. Zoom changes semantic detail, not merely the size of the same drawing.

## Milestone 0 — Stabilize the prototype

- `DONE — CODEX`: document product boundaries, roles, and conflict rules.
- `TODO — COPILOT`: extract the discrete-event rules and packet helpers from `NetworkSimulator.jsx` into pure modules; add focused tests for delivery, link loss, corruption, TCP retry, and UDP discard.
- `TODO — CODEX`: fix state and edge-case defects found during extraction; add a visible simulation clock/event identity so stepping is deterministic.
- `REVIEW — ANTIGRAVITY`: propose and implement the first semantic zoom states without changing the engine: topology at 100%, packet/layers at 125–150%, bytes/bits at 175–200%.
- Exit: clean build/lint, deterministic engine tests, keyboard-usable controls, no runtime errors.

## Milestone 1 — Packet journey

- Model Ethernet, IPv4, and TCP/UDP as structured educational headers.
- Render the IPv4 datagram as a field and bit view inspired by standard header diagrams: version, header length, service/DSCP, total length, identification, flags and fragment offset, TTL, protocol, header checksum, source IPv4 address, destination IPv4 address, optional fields, and payload. Show each field's width and its current bits; allow a learner to drill down from a readable value to individual bits.
- Permit edits to simulated header bits as well as payload bits. A field edit must decode back to a value and update the structured packet, and a value edit must update the visible bits. Clearly distinguish raw bit corruption in transit from a deliberately rebuilt packet with valid checksums.
- Make header edits produce realistic educational outcomes: destination changes can select another reachable simulated host or fail routing; source changes can affect replies or be rejected by a modeled policy; TTL changes can expire; invalid lengths, versions, fragmentation combinations, and checksums can be discarded. Include a fictional attacker-controlled endpoint in the local sandbox so redirection can be explored without real traffic.
- Explain the boundary of the attack model: a party cannot generally alter an arbitrary packet on a remote link without a position or capability that grants access to that traffic. Plain bit tampering usually fails integrity checks; forged or rebuilt packets and network policy have different outcomes. Show the actor's placement and the reason each action succeeds or fails.
- Show encapsulation at the laptop, forwarding/TTL changes at routers, and decapsulation at the server.
- Make the current device, link, layer action, and changed fields visually obvious.
- Add checksum/integrity state derived from packet data rather than a single `dirty` flag.
- Add a timeline scrubber with play, pause, previous event, next event, and restart.
- Exit: a learner can replay every transformation and explain why it occurred.

## Milestone 2 — Topology sandbox

- Add/remove hosts, switches, routers, and links on a bounded canvas.
- Configure names, IPv4 addresses, subnet masks, gateways, and selected application ports.
- Validate topology and configuration with short, actionable visual feedback.
- Compute paths from the topology instead of using a fixed node array.
- Save/load versioned scenarios locally; ship a small scenario gallery.
- Exit: at least LAN, routed LAN, broken gateway, and redundant-path scenarios work.

## Milestone 3 — Safe attacker perspective

- Add fictional attacker nodes and explicitly simulated actions: observation, spoofing demonstration, bit corruption, dropped packets, and traffic flooding as counters/animations.
- Pair every action with a defense view: segmentation, integrity checks, authentication concept, rate limiting, or encrypted payload visibility.
- Never generate real traffic, scan networks, store credentials, or provide executable exploitation steps.
- Exit: attacker/defender lessons are sandboxed, reversible, and clearly labeled as models.

## Milestone 4 — Learning and polish

- Guided challenges with hints and explain-why feedback.
- Compare TCP/UDP and healthy/faulty runs side by side.
- Accessibility: keyboard operation, reduced motion, non-color status cues, screen-reader summaries.
- Responsive layouts and performance budgets for larger topologies.
- Export/import scenario JSON and shareable lesson snapshots.

## Architecture direction

- `src/sim/`: pure domain types, packet construction, events, reducers/state machine, routing, validation.
- `src/components/`: topology, inspector, timeline, controls, challenge UI.
- `src/scenarios/`: versioned scenario data only.
- `src/styles/`: tokens and component styles when the current stylesheet becomes unwieldy.

React should render state and dispatch intents. It should not contain protocol rules. Simulation events should be immutable, serializable, deterministic, and carry both a concise learner-facing label and structured before/after data.

## Decisions still to validate

- 2D with depth cues is the default; true 3D is deferred until it proves educational value.
- IPv4 comes first; IPv6 follows after the field/encapsulation model is stable.
- Browser-only local persistence comes before accounts or cloud sync.
- Protocol accuracy is increased in layers, with every simplification disclosed.

