---
name: replay-development
description: Implement, diagnose, review, or document LGS1920 Studio replay, Draft recording, HQ export, replay camera, trace, clips, scrubbing, scene readiness, overlays, or replay-synchronized widgets.
---

# Replay Development

Read these documents before changing replay behavior:

1. [`REPLAY-AUDIT.md`](../../../tech-doc/specs/replay-video/REPLAY-AUDIT.md) for historical findings and
   architectural rationale.
2. [`CORE-REPLAY-ARCHITECTURE.md`](../../../tech-doc/specs/replay-video/CORE-REPLAY-ARCHITECTURE.md)
   for current authorities and invariants.
3. [`CORE-REPLAY-IMPLEMENTATION-STATUS.md`](../../../tech-doc/specs/replay-video/CORE-REPLAY-IMPLEMENTATION-STATUS.md)
   to distinguish implemented, partial, and planned work.
4. [`CORE-REPLAY-QUALITY-VALIDATION.md`](../../../tech-doc/specs/replay-video/CORE-REPLAY-QUALITY-VALIDATION.md)
   for the applicable validation matrix.

Inspect the current code before relying on line numbers or implementation claims
from the audit. Treat the audit as rationale, not as a substitute for source
inspection.

Preserve these boundaries:

- Draft uses wall-clock scheduling, HQ uses fixed frame timestamps, and scrub is
  a latest-request-wins policy over the shared frame contract.
- Camera, scene, canvas, and data-source writes resolve through the replay
  session's active render target.
- HQ camera and trace decisions never depend on wall-clock throttling.
- The interactive viewer must remain independent while an isolated HQ target is
  active.
- Stores, recorder events, widgets, and legacy runner state are consumers or
  compatibility projections, not new replay clocks.
- Qualification and readiness work must be cancellable and bounded; slider
  interaction must not synchronously compile a complete trajectory.

Add focused tests for every fix or feature. If a change can alter generated
pixels, camera motion, trace progression, timing, or composition, do not report
it complete without the real visual validation required by the quality document.
Update architecture or status documentation when ownership, contracts, or
delivery state changes.
