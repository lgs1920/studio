# Replay Render Mode Architecture — Draft vs High Quality

Status: implementation in progress — #410 and #427

Date: 2026-07-28

## Goal

Define a two-mode replay rendering architecture where:

- Draft Mode prioritizes speed by running the replay in real time and recording live
- HQ Mode prioritizes visual fidelity by rendering the replay frame by frame and recording offline

Both modes must consume the same replay inputs and produce the same rendered scene for the same logical frame.

Both replay paths must also start from the same camera view before the actual replay start so the initial framing is identical.

The replay trajectory, track path, and camera path must be computed outside
Cesium. Cesium is only a rendering target for the resolved logical frame,
never the source of truth for the replay path, track geometry, camera
interpolation, timing, or transition completion.

The mode switch must change scheduling and capture strategy, not the visual contract.

## What “identical visual output” means

This requirement needs a precise definition.

The contract should be interpreted as visual determinism:

- same replay sample for the same logical frame
- same crop rectangle and output geometry
- same widget visibility and ordering
- same overlay metrics, transforms, and z-index rules
- same start / replay / stop boundary semantics
- same final-frame behavior before stop and finalize

It should not be interpreted as byte-for-byte identical encoded media, because the encoder, bitrate, and compression path may differ between modes.

If the product later introduces different resolution profiles, that change must be handled as an explicit output profile decision, not as a hidden render-mode side effect.

Temporal determinism is stricter:

- HQ Mode must be temporally deterministic because it advances from a fixed frame timeline
- Draft Mode may remain real time, so it is not temporally deterministic in the strict sense even if its visual contract matches HQ

In other words, both modes should be visually deterministic for a given logical frame, but only HQ should be fully deterministic in how that frame is produced over time.

## Non-blocking path resolution invariant

Neither replay mode may perform a full constrained camera-path compilation
synchronously during replay startup or HQ preparation. A bulk path build can
freeze the UI and delay the first replay frame, so it must never gate:

- Draft startup, with or without start clips
- the transition from start clips to replay playback
- HQ scene preparation or export initialization

This rule applies to navigation and dynamic (`hysteresis`) tracking, including
all Z1/Z2 collision decisions. The shared resolver may compute the logical
camera state needed for the current frame, but it must not require a complete
replay-path compilation before playback can continue.

Any future path precomputation must be incremental, asynchronous, bounded, and
optional. It must never block the first frame or replace the current-frame
fallback. A synchronous `prepareConstrainedReplayCameraPath` step is explicitly
forbidden.

## Camera pitch target and temporary deviations

The pitch target is the pitch of the renderer-independent nominal camera pose
for the current logical replay frame. In Draft this is the current nominal
runtime pose; in HQ it is the pose resolved from the fixed export timestamp.
The Cesium camera pitch is never the replay target.

The replay may temporarily use another pitch only in these cases:

- a start or stop clip explicitly requests a different camera pose;
- the user is actively dragging, orbiting, or zooming the Cesium camera;
- dynamic visibility or terrain collision requires a bounded redirect to keep
  the marker visible;
- the camera settings or the logical replay phase explicitly changes the
  nominal target.

Navigation uses Z1 only; it has no Z2 landing zone. Leaving Navigation Z1
triggers the recenter, which may change the camera position and heading, but
must use the current nominal pitch unless a temporary visibility correction is
active. Dynamic mode is the only mode with a separate Z2 landing zone.

As soon as the user interaction has ended and the active collision or
visibility correction no longer requires a redirect, the controller must clear
the temporary offset and restore the nominal pitch for the current logical
frame. Draft may use the shortest bounded camera transition; HQ applies the
same logical pose at the current export timestamp. Neither mode waits for a
bulk path compilation or a wall-clock flight callback before restoring it.

## Mode matrix

| Concern | Draft Mode | HQ Mode | Shared contract |
| --- | --- | --- | --- |
| Timebase | Real time | Deterministic frame timeline | Replay frame contract |
| Capture strategy | Live recorder | Offline frame-by-frame export | Same render inputs |
| Latency goal | Low | Secondary | N/A |
| Visual goal | Fast validation | Final-quality master | Same scene and overlays |
| Render cadence | Best effort / real time | Explicit per-frame rendering | Same frame state |
| Reuse of warm plan | Allowed | Required when valid | Same invalidation rules |

## Current implementation baseline

The codebase already contains the main building blocks for this architecture:

- `JourneyReplayLogicalFrame` computes the renderer-independent replay frame
- `JourneyReplayLogicalCameraPose` resolves the shared camera pose without Cesium
- `JourneyReplayLogicalTrackPath` prepares replay track geometry outside Cesium
- `ReplayRenderModeContract` exposes the shared Draft/HQ visual contract
- `ReplayVideoRenderSpec` computes the shared crop / FPS / geometry contract
- `ReplayOverlayResolver` decides replay-driven widget visibility
- `ReplayVideoRenderSession` provides deterministic per-frame orchestration
- `ReplayDeferredExporter` already performs offline HQ export
- `ScreenMediaRecorder` already has a `captureMode` concept for live capture
- `JourneyReplayVideoSync` already links replay playback to the draft recording lifecycle
- `JourneyReplayPlaybackController`, `JourneyReplaySessionPlaybackController`, `JourneyReplayCameraBinding`, `JourneyReplayClipController`, and `JourneyReplayPathSampler` already consume the logical replay helpers

The first implementation pass now provides the strict product-level boundary
between Draft Mode and HQ Mode, plus a single named contract that exposes the
logical frame, camera pose, track path, render spec, and overlay set. Remaining
work is focused on field validation and parity coverage for all widget and
camera transition combinations.

Before this implementation pass, the pieces existed, but the mode contract was
distributed across UI, recorder, replay sync, and exporter code.

## Implementation status for #410 and #427

The current implementation addresses the core correction scope:

- #410 preserves the camera state captured before replay entry through Draft,
  HQ preparation, cancellation, and scene restoration. The camera view applied
  to the replay start is no longer saved over the user focus that must be
  restored on exit.
- #427 publishes `ReplayRenderModeContract` data for Draft and HQ, keeps the
  logical replay frame and camera pose renderer-independent, and invalidates a
  warm HQ plan when duration, direction, clips, widgets, crop, camera entry
  state, or render-spec values change.
- Navigation and dynamic (`hysteresis`) collision tracking remains active for
  logical Draft/HQ frames. Collision detection runs before deterministic camera
  application, so a correction can replace the nominal pose without being
  bypassed by the shared render path. The nominal pose is applied only at
  logical camera initialization or after a correction; stable frames do not
  recenter the marker and therefore preserve Z1/Z2 tracking behavior.
- Pitch changes are bounded to explicit start/stop poses, active user camera
  interaction, or temporary dynamic visibility/collision redirects. Once the
  marker is back inside Navigation Z1, or inside Dynamic Z2 with a visible
  nominal view, the redirect is cleared and the current logical nominal pitch
  is restored without waiting for path compilation.
- No complete constrained camera path is compiled synchronously at Draft
  startup or during HQ preparation. Both modes continue from their logical
  frame pipeline without waiting for bulk path compilation.
- Draft remains on the live recorder path, while HQ remains on the sequential
  offline exporter path. The output profile remains separate from render mode.

The implementation is still pending end-to-end product validation and pull
request review.

## Practical implications

### 1. The render contract must become explicit

Draft and HQ must resolve the same:

- crop
- dimensions
- output DPR
- widget set
- widget visibility
- replay phase
- final frame

Any state that affects pixels must live in a shared contract object or in a shared resolver.

Anything mode-specific must stay non-visual:

- scheduling
- encoder selection
- frame pacing
- buffering
- warm-up behavior

Trajectory, camera-pose, and track-path resolution are part of the shared
visual contract, not mode-specific behavior.

### 2. Draft Mode must not delegate trajectory decisions to Cesium

Draft Mode may use Cesium to display and record the resolved scene, but its
replay state must be driven by a renderer-independent logical frame. That
frame must contain at least:

- the replay sample and progress
- the logical frame time
- the resolved camera pose
- the active replay phase and clip state

The Draft path must not use any of the following as the source of replay
trajectory or camera-path truth:

- Cesium `flyTo`, camera-flight completion, or wall-clock flight callbacks
- `journey.focus()` or `sceneManager.focusOnJourney()` completion
- Cesium camera interpolation or `SampledPositionProperty` timing
- the current Cesium camera position as a replacement for the logical replay pose

Cesium remains an output adapter. It receives the resolved pose and renders it;
it must not decide where the replay is, how the camera moves, or when a logical
frame is complete.

The same renderer-independent trajectory and camera-pose resolver must feed
both Draft and HQ. Draft applies the pose on the live clock, while HQ samples
the same pose on its fixed frame timeline.

### 3. Draft Mode must remain real-time

Draft Mode should:

- start quickly
- use the live replay clock
- record from the live compositor
- avoid blocking on deterministic export machinery
- keep the UI responsive even when HQ preparation is slow or unavailable

Draft Mode is for immediate user feedback.

It is not the authoritative final export path.

### 4. HQ Mode must be deterministic

HQ Mode should:

- build a fixed timeline
- seek the replay to each target frame
- rebuild overlays for that frame
- encode exactly one rendered frame at a time
- avoid depending on wall-clock drift or browser throttling

HQ Mode is the authoritative final export path.

### 5. Final-frame handling must be shared

The last visible frame before stop is a critical boundary.

Both modes must agree on:

- when the final replay frame is published
- when stop clips have completed
- when the recorder or exporter may stop
- whether the replay scene is restored before or after finalization

This is a common source of mode drift, so it should be covered by dedicated tests.

### 6. Cache invalidation becomes part of the architecture

HQ preparation can only be reused when the context is still valid.

Any of the following must invalidate the warm plan:

- crop changes
- replay direction changes
- replay duration changes
- clip changes
- widget visibility changes
- widget mount or unmount changes
- render spec changes
- capture mode changes when they affect the output contract

This prevents HQ from reusing stale assumptions after the draft UI has changed.

### 7. Render mode is separate from output profile

This is a likely future source of confusion, so it should be kept explicit.

Render mode decides how the video is produced.

Output profile decides the resulting resolution / quality target.

They are related, but they are not the same decision.

If the product later supports explicit `720p`, `1080p`, or `4K` exports, that should remain an output-profile layer on top of the render-mode layer.

## Contract consumption rules

The contract is consumed by two separate orchestration paths:

- Draft publishes the live `dynamicFrameState` through the recorder path. Its
  camera pose is completed by the live Cesium adapter after each logical update;
  Draft must not call the HQ exporter or wait for a frame-by-frame session.
- HQ publishes the deterministic `runtime.frameState` from the offline export
  timeline. The export frame renderer owns the camera for that timestamp; the
  live replay update listener must not apply a second pose.
- Both paths pass widget overlays through `ReplayOverlayResolver`. HQ must not
  bypass that resolver when composing a frame, because the same phase and
  replay-aware visibility rules must apply to Draft and HQ.

The contract therefore carries the same logical sample, camera pose, track path,
initial camera state, crop/render specification, and visible overlay set. Only
the scheduler and capture owner differ.

## Files likely affected

- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`
- `src/components/MainUI/video/VideoDownloadAndShareDialog.jsx`
- `src/core/ui/replay/JourneyReplayLogicalFrame.js`
- `src/core/ui/replay/JourneyReplayLogicalCameraPose.js`
- `src/core/ui/replay/JourneyReplayLogicalTrackPath.js`
- `src/core/ui/replay/ReplayRenderModeContract.js`
- `src/core/ui/replay/JourneyReplayPlaybackController.js`
- `src/core/ui/replay/JourneyReplaySessionPlaybackController.js`
- `src/core/ui/replay/JourneyReplayCameraBinding.js`
- `src/core/ui/replay/JourneyReplayClipController.js`
- `src/core/ui/replay/JourneyReplayPathSampler.js`
- `src/core/ui/replay/JourneyReplayVideoSync.js`
- `src/core/ui/replay/ReplayVideoRenderSpec.js`
- `src/core/ui/replay/ReplayOverlayResolver.js`
- `src/core/ui/replay/ReplayVideoRenderSession.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`
- `src/core/ui/screen-media-recorder/recorder/ScreenMediaRecorder.js`
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`

## Required implementation work

1. Define a single render-mode contract object.
2. Define a renderer-independent logical replay frame, camera-pose, and track-path contract.
3. Move trajectory, camera-path interpolation, and transition timing into the
   shared resolver without introducing a synchronous full-path compilation step.
4. Add a Cesium output adapter that applies a resolved logical pose without deciding it.
5. Make Draft Mode consume that contract through the live recorder path only.
6. Make HQ Mode consume that contract through the deterministic export path only.
7. Ensure both modes use the same replay visibility resolver.
8. Ensure both modes use the same crop and render-spec calculation.
9. Move all mode-specific behavior into scheduling and capture orchestration.
10. Keep codec, bitrate, and output-profile logic outside the scene contract.
11. Add parity tests for the rendered frame state.
12. Add tests proving Draft does not depend on Cesium flight/focus completion.
13. Add invalidation tests for warm HQ plans.
14. Add end-of-replay and stop-clip tests for both modes.
15. Make collision and dynamic navigation zone sizing adaptive to short replay
    durations. The policy must reduce the active Z1/Z2 zones early enough to
    account for calculation lag and speed discrepancies, while keeping the
    marker inside the designated video capture area. The requested minimum
    targets are 5% and 30%; the implementation must preserve valid nested-zone
    geometry and document which bound applies to Z1 and Z2.
16. Add regression tests proving that neither Draft startup nor HQ preparation
    invokes a blocking full-path compilation.

## Product decisions

These decisions define the target contract for implementation:

1. Resolution selection is a separate output-profile layer, not part of render mode.
2. Draft Mode may prepare lightweight HQ metadata only when replay sync is
   enabled; it must never synchronously compile the complete constrained camera
   path.
3. The parity target is visual parity on the composed frame, not pixel parity after encoding.
4. HQ must never automatically replace the draft blob in the final dialog.
5. Draft and HQ do not have to share the same export FPS.

### Resolution selection as an output-profile layer

Render mode decides how frames are produced.

Output profile decides which resolution is targeted.

That separation matters because the same render mode can produce different output sizes, and the same output profile can be served by different render strategies.

In practice:

- Draft Mode uses the live render path
- HQ Mode uses the offline render path
- The output profile decides the target resolution for each path

### Background HQ warm-up

HQ warm-up is only useful when the replay pipeline is linked.

When replay sync is disabled, Draft Mode should stay lightweight and must not
spend work preparing an HQ export plan that the user will not consume. When
replay sync is enabled, preparation may cache lightweight render metadata, but
it must not synchronously compile a complete camera path or block replay
startup, HQ scene preparation, or the first exported frame.

### Parity target

Parity should be evaluated on the composed frame before encoding.

The important question is whether Draft and HQ render the same scene state for the same logical frame.

That is the correct contract because the encoder can legitimately change the final compressed bytes without changing the scene state.

Pixel parity after encoding is too strict for this architecture because it would make codec behavior, bitrate behavior, and compression artifacts part of the product contract.

### Draft and HQ media coexistence

HQ should remain an explicit target, not a replacement.

The user must be able to:

- keep the draft video
- generate the HQ video separately
- share either one
- download either one

This avoids losing the fast draft artifact when the user wants a final master later.

### Export FPS

Draft Mode should stay at a capped low FPS, with 15 FPS or less as the upper bound.

HQ Mode should use its configured FPS.

That means the two modes may intentionally differ in temporal sampling, while still sharing the same visual contract for each rendered frame.

The practical rule is:

- Draft FPS is a performance ceiling
- HQ FPS is a quality / export setting
- Camera lookahead uses the actual output-frame interval when available; if it
  is missing, Draft falls back to 15 FPS and HQ falls back to 60 FPS.

## Acceptance criteria

- Draft Mode renders the same scene composition as HQ Mode for the same logical frame
- Both replay paths initialize from the same camera view before the actual replay start
- Draft and HQ consume the same renderer-independent trajectory and camera pose for the same logical frame
- Cesium is used only to apply and render the resolved pose, not to calculate replay trajectory or path timing
- HQ Mode does not depend on live playback cadence
- Draft Mode does not depend on frame-by-frame export machinery
- Widget visibility is resolved from one shared authority
- Final-frame behavior is deterministic and tested
- Warm HQ export plans are reused only when the replay and widget context still matches
- The architecture keeps render mode and output profile separated
- Draft and HQ can coexist as independent media artifacts
- Draft Mode remains capped at 15 FPS or below
- HQ uses its configured FPS
- Neither mode performs a blocking full camera-path compilation before its
  first replay frame
- A synchronous `prepareConstrainedReplayCameraPath` call is not part of the
  replay startup or HQ preparation contract

## Reference docs

- [Replay / Video Architecture](CORE-REPLAY-VIDEO-ARCHITECTURE.md)
- [Journey replay / video issues](../specs/JOURNEY-REPLAY-VIDEO-ISSUES.md)
- [HQ video resolution profiles](HQ_4K_VIDEO_EXPORT_SPEC.md)
- [Screen media recorder](../specs/CORE-SCREEN-MEDIA-RECORDER-RECORDER-README.md)
- [Canvas overlay composer](../specs/CORE-SCREEN-MEDIA-RECORDER-COMPOSER-README.md)
- [Replay camera tracking zones](../specs/REPLAY_CAMERA_TRACKING_ZONES.md)
