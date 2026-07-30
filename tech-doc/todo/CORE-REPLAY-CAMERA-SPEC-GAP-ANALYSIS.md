# Replay Camera Spec Gap Analysis and Alignment Plan

Status: draft proposal — aligns #425, #428, #429, #431

Date: 2026-07-30

## Scope

This document compares `tech-doc/specs/REPLAY_CAMERA_TRACKING_ZONES.md` with the
current replay camera implementation and lists the remaining gaps that still
need code changes or stronger contract coverage.

The intent is to close the remaining inconsistencies with one aligned camera
contract across Draft and HQ replay, while keeping the current split between:

- logical replay data
- camera/path resolution
- screen-space tracking and visibility
- render-mode orchestration

## Current implementation baseline

The code already contains most of the replay-camera building blocks:

- `JourneyReplayCameraMath.js` implements zone geometry, adaptive Z1/Z2 sizing,
  look-ahead, correction windows, and collision helpers
- `JourneyReplayCameraBinding.js` coordinates navigation and dynamic updates
  and already uses shared logical frame data
- `JourneyReplayCameraConstraintBinding.js` compiles a constrained in-memory
  camera path and applies terrain redirect cycles
- `JourneyReplayLogicalCameraPose.js` resolves a renderer-independent nominal
  pose
- `ReplayRenderModeContract.js` publishes a shared Draft/HQ visual contract
- `ReplayDeferredExporter.js` consumes the logical frame and render contract for HQ export
- `JourneyReplayCameraVisibility.js` keeps the visibility and redirect logic
  separate from the pose resolver

There is also already good coverage for the shared timing and zone math in the
unit test matrix.

## What is already aligned

These parts of the spec are effectively implemented and should be treated as
guardrails, not as open work:

- hidden-track visibility must remain hidden during recentering and redirect
  logic
- navigation Z1 has no Z2 landing zone
- dynamic Z1/Z2 adaptation exists and preserves nesting
- the minimum adaptive ratios are already expressed in the math layer
- Draft and HQ use the same logical frame contract when the shared path is
  available

## Observed gaps

| Issue | Spec expectation | Current code state | Gap | Required alignment |
| --- | --- | --- | --- | --- |
| #425 | Terrain collision avoidance must be recorded in the replay camera path and reused without recomputation | Terrain redirects exist, but they are kept in session memory through the constrained path cache | The correction is not yet a first-class persisted replay-path artifact | Serialize the terrain-correction result into the replay path model and make HQ/Draft consume that stored data |
| #428 | Draft and HQ must use the same normalized clip timeline | Clip flow is normalized through controller and exporter orchestration, but the timeline is not a shared first-class object in the replay contract | Clip alignment still depends on orchestration details instead of an explicit logical clip timeline | Promote clip phases, boundary timestamps, and clip identity into the shared logical frame / render contract |
| #429 | Short replays must adapt Z1/Z2 early enough to absorb calculation lag and speed differences | Adaptive zone math exists and is already covered by unit tests | The adaptive decision is still mostly runtime-local and not yet exposed as a reusable replay-frame contract with full end-to-end validation | Keep the math, expose the active adaptive geometry as contract data, and add integration coverage for short captures and delayed updates |
| #431 | Replay camera turns must bank with speed-dependent roll, capped at 45° | Logical pose resolution currently returns heading, pitch, and altitude only | No renderer-independent roll model exists yet | Add curvature/speed-based roll to the logical camera pose, path compiler, and render contract |

## Gap details by issue

### #425 — Terrain collision avoidance in the replay path

The current implementation already detects terrain-related redirects, but the
result lives in transient controller state and compiled path memory. That is not
enough for the spec, because the correction should be part of the replayable
camera path itself.

The remaining gap is therefore not the collision detection primitive. The gap
is persistence and replayability:

- the correction needs a durable path annotation or path segment
- Draft and HQ must consume the same stored correction
- replay export must not need to redo the terrain lookup to reproduce the path

### #428 — Clip timeline alignment between Draft and HQ

The current replay orchestration already tries to keep Draft and HQ on the same
logical frame, but clip timing still sits across controller, playback, and
exporter code.

What is missing is a single normalized clip timeline contract that can be
validated independently of the execution mode.

The contract should carry:

- clip phase order
- clip start / stop boundaries
- clip identity and duration fingerprint
- the logical frame anchor used for replay, start, and stop transitions

Without that, parity can still be correct in practice while remaining fragile
under refactors or mode-specific scheduling changes.

### #429 — Adaptive Z1/Z2 stability for short replays

The core adaptive-zone math is present. The remaining gap is the contract
boundary and the validation surface.

The spec requires the adaptive geometry and the correction budget to be
coherent across:

- short replay durations
- delayed calculations
- varying playback speeds
- final-frame behavior

The implementation should therefore expose the active adaptive zones and their
pressure metrics at the replay-frame boundary, not only in trace logging.

### #431 — Speed-dependent roll on tight turns

This feature is still missing from the renderer-independent camera pose.

Current code resolves heading, pitch, and altitude, then applies camera
redirects and path corrections. It does not compute a stable roll model from
path curvature and speed.

To satisfy the issue, roll must:

- be computed from the logical path, not from Cesium camera state
- follow turn direction and speed
- stay bounded to 45 degrees
- ease in and out around straight segments
- be serialized through the same logical frame contract used by Draft and HQ

## Implementation plan

### Phase 1 — Expand the shared logical camera contract

Make the replay frame carry every camera-relevant field that needs to be
consistent across Draft and HQ.

Required changes:

- add `roll` to the logical camera pose and render contract
- add a path-correction payload for terrain redirects
- add a clip-timeline payload for replay / start / stop sequencing
- add a stable fingerprint for adaptive tracking geometry when needed for
  invalidation or diagnostics

Primary files:

- `src/core/ui/replay/JourneyReplayLogicalCameraPose.js`
- `src/core/ui/replay/JourneyReplayLogicalFrame.js`
- `src/core/ui/replay/ReplayRenderModeContract.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`

### Phase 2 — Persist terrain collision corrections in the replay path

Move issue #425 from transient runtime correction to replayable path data.

Required changes:

- annotate the constrained replay path with terrain redirect segments
- keep the compiled path reusable without recalculating terrain on every frame
- make Draft and HQ sample the same correction object
- ensure replay export reads the stored correction rather than recomputing it

Primary files:

- `src/core/ui/replay/JourneyReplayCameraConstraintBinding.js`
- `src/core/ui/replay/JourneyReplayConstrainedCameraPath.js`
- `src/core/ui/replay/JourneyReplayCameraBinding.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`

### Phase 3 — Promote clip timing to a shared timeline contract

Move issue #428 from controller-only orchestration to explicit logical data.

Required changes:

- represent replay, start, and stop phases in a normalized timeline object
- use one clip boundary source for Draft playback and HQ export
- include the timeline fingerprint in warm-plan invalidation when it affects
  visual output
- keep the timeline independent from the render mode scheduler

Primary files:

- `src/core/ui/replay/JourneyReplaySessionPlaybackController.js`
- `src/core/ui/replay/ReplayProgress.js`
- `src/core/ui/replay/ReplayRenderModeContract.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`

### Phase 4 — Hard-bind adaptive Z1/Z2 behavior to the logical frame

Keep the current adaptive-zone math, but make it visible at the contract
boundary so parity can be validated and reused consistently.

Required changes:

- expose the active Z1/Z2 geometry and pressure on the frame or contract
- keep the 30% and 5% minimums explicit in the implementation surface
- preserve the two-second navigation correction window
- keep short-replay behavior identical between Draft and HQ

Primary files:

- `src/core/ui/replay/JourneyReplayCameraMath.js`
- `src/core/ui/replay/JourneyReplayCameraBinding.js`
- `src/core/ui/replay/ReplayRenderModeContract.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`

### Phase 5 — Add speed-dependent roll

Implement issue #431 as a renderer-independent camera-path rule.

Required changes:

- derive turn curvature from the logical path samples
- map speed to a bounded roll magnitude
- clamp the roll to 45 degrees
- smooth the roll into and out of turns
- preserve zero roll on straight and near-zero-speed segments
- reuse the same roll in Draft and HQ

Primary files:

- `src/core/ui/replay/JourneyReplayLogicalCameraPose.js`
- `src/core/ui/replay/JourneyReplayCameraGuide.js`
- `src/core/ui/replay/JourneyReplayCameraMath.js`
- `src/core/ui/replay/JourneyReplayCameraBinding.js`
- `src/core/ui/replay/JourneyReplayCameraTransition.js`

### Phase 6 — Validation and regression coverage

Add tests that prove the contract instead of only the math helpers.

Required test coverage:

- terrain correction persists in replayable path data
- Draft and HQ resolve the same clip timeline
- short replays keep the marker inside the capture area
- delayed calculations still produce the same adaptive zones
- speed changes increase or reduce roll predictably
- roll never exceeds the 45-degree clamp
- hidden-track visibility still survives recentering and redirect

Primary test files:

- `src/__tests__/unit/replay/replay-camera-path.test.js`
- `src/__tests__/unit/replay/replay-camera-constraint-binding.test.js`
- `src/__tests__/unit/replay/replay-regression-matrix.test.js`
- `src/__tests__/unit/replay/replay-visibility-clips.test.js`
- `src/__tests__/unit/replay/replay-logical-camera-pose.test.js`
- `src/__tests__/unit/replay/replay-render-mode-contract.test.js`

## Suggested delivery order

1. Expand the shared logical frame and render contract
2. Persist terrain corrections in the replay path
3. Normalize the clip timeline contract
4. Expose adaptive zone diagnostics at the contract boundary
5. Add speed-dependent roll
6. Close the parity and regression tests

This order minimizes rework because the later items need the contract fields
introduced by the earlier ones.

## Acceptance criteria for the follow-up implementation

- The replay path no longer relies on transient-only terrain correction state
- Draft and HQ consume the same clip timeline and the same logical camera pose
- Adaptive Z1/Z2 behavior remains stable for short replays and delayed updates
- Roll is present, bounded, and deterministic across both render modes
- Regression tests cover the gap matrix end to end

## References

- `tech-doc/specs/REPLAY_CAMERA_TRACKING_ZONES.md`
- `tech-doc/todo/CORE-REPLAY-RENDER-MODE-ARCHITECTURE.md`
- `https://github.com/lgs1920/studio/issues/425`
- `https://github.com/lgs1920/studio/issues/428`
- `https://github.com/lgs1920/studio/issues/429`
- `https://github.com/lgs1920/studio/issues/431`
