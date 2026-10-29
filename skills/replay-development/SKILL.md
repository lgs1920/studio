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
  Store Replay height, pitch, and camera angle in the active Journey's Basic or Expert camera data. Persist Basic settings under `basic`: reads prefer that key and fall back to legacy `simple` only when it is absent, while every write stores `basic` and removes `simple`. Global Replay settings omit height and pitch and keep camera angle at the initial value `0`. A Journey without saved camera pose starts from the active Cesium height and pitch, then saves those values on the Journey; migrate legacy angle fields on the Journey instead of falling back to global settings.
  Entering video preparation stops and awaits normal map rotation and presents
  a North-oriented view of the canonical departure using Replay pitch and height.
  Only this explicit entry boundary frames the map, after successful preparation
  and stale-transition checks.
  Passive guide refreshes do not move the map camera or infer Replay settings
  from that normal view. During preparation, explicit camera-angle guide inputs
  are consumed before Cesium navigation handles them, then the selected Replay
  pose is applied through the Replay camera controller without a camera lease.
  The preparation cone uses a
  fixed CSS-pixel size independent of Cesium zoom and Replay camera height.
  Only fitting the complete guide inside the current crop may reduce its
  displayed size. Never derive that size from Replay altitude or persist crop
  layout adjustments into camera settings.
  Playback saves the current normal view before applying the configured
  Replay pose, then restores that view and its Cesium reference frame on every terminal path. Keep the normal
  return snapshot separate from the Replay entry pose and export context.
- Keep camera-motion smoothing separate from the journey sample used by the
  trace, marker, visibility checks, and crop progression. Scale heading
  anticipation and the short camera-anchor smoothing window from Replay
  duration, and cap the smoothing-pass offset to one quarter of the active
  projected crop width. Preserve the independent tight-zigzag rule: replace a
  camera-only path section with a chord only when its cross-track amplitude is
  below half the projected crop width. Test long untimed journeys at short and
  ordinary durations, then visually inspect a real Replay export.
  Basic Replay keeps Navigation tracking. Its diagnostic overlay must use the
  exact adaptive Navigation trigger zone evaluated by the runtime collision
  check, plus the matching inner recenter threshold; verify the visible zone
  at low and high camera heights and crop sizes.
  Dynamic tracking must confirm a sustained trigger-zone exit with two future
  projections and start correcting before the marker reaches the boundary.
  Navigation must preserve its predictive collision check with a 3-second
  base transition horizon. Live tolerance and visibility corrections need a
  cubic ease-in/out flight of at least 3 seconds and must preserve any longer
  active Ease duration without restarting the same transition on every frame.
  Deterministic Basic Replay must interpolate hard Navigation corrections on
  replay time for at least 3 seconds instead of applying an immediate camera frame.
  Convert tracking lookahead seconds through the configured Replay duration,
  never GPX recording speed; untimed routes must still anticipate. Confirm a
  predicted exit with a sample after the prediction. Verify smoothing through
  the production `renderReplayExportFrame` boundary, including its explicit
  source. A three-second position path is insufficient if its orientation or
  canonical Cesium conversion immediately looks at the final target: preserve
  the transient interpolated aim and test every frame with a real Cesium Camera.
  Keep tracking corrections direct with exact endpoints, retain clip path
  policies, and distinguish explicit scrubs from playback updates.
  Navigation export must hold its applied pose between corrections just like
  live playback. Do not undo a correction by reapplying the nominal pose each
  frame. Ease into the exact final pose during the last three Replay seconds;
  test the penultimate and last frames rather than snapping an unfinished
  transition. Use Replay progress and direction for completion, not clip-offset
  video timestamps or GPX recording duration.
  Keep normal tracking and clip transition timing independent.
  Include prepared Replay height, rendered target altitude, pitch, frustum,
  crop width and route speed in tracking anticipation. Keep current-marker crop
  checks active during transitions and held Navigation poses. A future target
  cannot qualify the current marker. If the eased candidate leaves the crop,
  translate it minimally without resetting its orientation or changing zoom.
  Project with full CSS canvas dimensions and its origin, not crop dimensions
  or physical drawing-buffer pixels. Test a long untimed 10-second route at
  multiple zoom levels with an offset crop, checking every actual Camera pose.
  During video preparation only, explicit mouse tilt and zoom on the map are Replay pitch and height inputs. Compare against gesture-start values, wait for pending wheel movement to settle, and commit the final pose to the active Journey before Record. Flush its debounced database write, then verify playback and export resolve that same Journey pose rather than stale runtime defaults. Preserve the cone angle. Constant altitude stores absolute prepared height and ground offset stores height minus the rendered Replay target height. Automatic camera events, unchanged gestures, playback/capture, and ordinary map navigation never persist Replay configuration. Suspend normal
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

For prepared zoom regressions, observe camera stability across wheel and drag
inertia rather than treating the first input timeout as completion. Interactive
Play and Record must consume that same final pose. Stop and error paths cancel
pending gestures and queued starts before restoring the map. Cleanup may hydrate
runtime controls from the active Journey but must never persist a prior playback
baseline into newer edits or another Journey.
