---
name: replay-development
description: Implement, diagnose, review, or document LGS1920 Studio Replay playback and export, replay camera, trace, clips, scrubbing, scene readiness, overlays, or replay-synchronized widgets.
---

# Replay Development

Read these documents before changing replay behavior:

1. [`CORE-REPLAY-ARCHITECTURE.md`](../../tech-doc/specs/replay-video/CORE-REPLAY-ARCHITECTURE.md)
   for current authorities and invariants.
2. [`CORE-REPLAY-IMPLEMENTATION-STATUS.md`](../../tech-doc/specs/replay-video/CORE-REPLAY-IMPLEMENTATION-STATUS.md)
   to distinguish implemented, partial, and planned work.
3. [`CORE-REPLAY-QUALITY-VALIDATION.md`](../../tech-doc/specs/replay-video/CORE-REPLAY-QUALITY-VALIDATION.md)
   for the applicable validation matrix.

If a referenced local document has moved, search for its filename in the
repository before requesting help. Ask only if the missing information remains
necessary after discovery.

Inspect the current code before relying on line numbers or implementation claims
from the audit. Treat the audit as rationale, not as a substitute for source
inspection.

Preserve these boundaries:

- Interactive playback uses wall-clock scheduling, export uses fixed frame timestamps, and scrub is
  a latest-request-wins policy over the shared frame contract.
- Linked video preparation uses a read-only canonical timeline projection for
  start, replay, stop, and widget actions. Timeline editing must not create a
  second replay clock or mutate persisted widget configuration implicitly.
- User widget visibility and transient replay/capture masking are separate
  concerns. Resolve replay-driven visibility through the shared overlay
  resolver and restore transient composition state on every terminal path.
- Camera, scene, canvas, and data-source writes resolve through the replay
  session's active render target.
- Export camera and trace decisions never depend on wall-clock throttling.
- The interactive viewer must remain independent while an isolated export target is
  active.
- Stores, export events, widgets, and compatibility runner state are consumers or
  compatibility projections, not new replay clocks.
- Qualification and readiness work must be cancellable and bounded; slider
  interaction must not synchronously compile a complete trajectory.
- Follow [the normal Cesium and Replay camera ownership rules](../../PROJECT_RULES.md#normal-cesium-and-replay-camera-ownership).
  Store Replay height, pitch, and camera angle in the active Journey's Simple or Expert camera data. Global Replay settings omit height and pitch and keep camera angle at the initial value `0`. A Journey without saved camera pose starts from the active Cesium height and pitch, then saves those values on the Journey; migrate legacy angle fields on the Journey instead of falling back to global settings.
  Entering video preparation stops and awaits normal map rotation and presents
  a North-oriented view of the canonical departure using Replay pitch and height.
  Only this explicit entry boundary frames the map, after successful preparation
  and stale-transition checks.
  Subsequent preparation edits and guide refreshes do not move the map camera
  or infer Replay settings from that normal view. Playback saves the current normal view before applying the configured
  Replay pose, then restores that view and its Cesium reference frame on every terminal path. Keep the normal
  return snapshot separate from the Replay entry pose and export context.
  During video preparation only, explicit mouse tilt and zoom on the map are Replay pitch and height inputs. Compare against gesture-start values and flush pending wheel changes before Record. Preserve the cone angle. Constant altitude stores absolute prepared height and ground offset stores height minus the rendered Replay target height. Automatic camera events, unchanged gestures, playback/capture, and ordinary map navigation never persist Replay configuration. Suspend normal
  map persistence while Replay borrows its camera and reject overlapping async
  reads. Validate public drawer refresh, timeline seek, start, pause, resume, stop,
  and disposal with a real Cesium `Camera`. Test repeated starts, stale cleanup,
  cancellation, and isolated export.

Add focused tests for every fix or feature. If a change can alter generated
pixels, camera motion, trace progression, timing, or composition, do not report
it complete without the real visual validation required by the quality document.
Perform that validation using available authorized tools and applicable reference
scenarios. If a prerequisite is unavailable, complete independent implementation
and automated checks, identify the exact blocked validation and missing
prerequisite, and request only what is needed to resume. Do not claim completion
or waive visual validation. Do not run `bun run dev` manually.
Update architecture or status documentation when ownership, contracts, or
delivery state changes.
