# Network Simulator Collaboration Brief

## Product direction

Build an educational network simulator that starts with a readable topology and progressively reveals frames, packets, segments, bytes, and bits as the learner zooms in. It must remain visual and low-text, while making failures, corruption, forwarding, and recovery understandable.

This is a teaching model, not a security tool and not a wire-accurate protocol stack. Any attacker interactions must be safe, local simulations with no real scanning, traffic generation, credential capture, or exploit execution.

## Shared rules

- Read `README.md` and `ROADMAP.md` before changing code.
- Do not overwrite unrelated or uncommitted work.
- Keep simulation rules separate from React rendering.
- Every simulated simplification must be disclosed in the UI or documentation.
- Prefer deterministic state transitions that can later be unit-tested.
- Run `npm run build` and `npm run lint` before handing work off.
- Record assumptions and changed files in `HANDOFF.md`.

## Roles and ownership

### Codex — integrator and simulation architecture

Owns the roadmap, state-machine/domain model, integration, accessibility, verification, and final conflict resolution. Codex may edit any area while integrating, but should preserve work already recorded in `HANDOFF.md`.

### GitHub Copilot — focused implementation and tests

Start with the first unclaimed `COPILOT` item in `ROADMAP.md`. Prefer small, reviewable changes in pure JavaScript modules and tests. Do not redesign the page or edit the same files as Antigravity. Before editing, mark the item `IN PROGRESS — COPILOT`; after verification, mark it `REVIEW — COPILOT` and add a handoff note.

### Antigravity / Gemini — UX exploration and visual systems

Start with the first unclaimed `ANTIGRAVITY` item in `ROADMAP.md`. Focus on information hierarchy, progressive zoom behavior, topology interaction, and concise educational copy. Avoid simulation-engine files. Before editing, mark the item `IN PROGRESS — ANTIGRAVITY`; after verification, mark it `REVIEW — ANTIGRAVITY` and add a handoff note.

## Conflict boundaries

- Simulation/domain modules: Codex or Copilot.
- React presentation and CSS: Codex or Antigravity.
- `ROADMAP.md` status and `HANDOFF.md`: append or narrowly edit only.
- If a task crosses boundaries, write a proposal in `HANDOFF.md` before changing the other owner's files.

