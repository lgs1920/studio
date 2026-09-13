# Replay Quality Validation

Status: required replay validation contract

Date: 2026-08-24

## Purpose

Replay correctness is visual and temporal. Mock-only validation cannot establish
that a generated video contains the trace, follows the camera, waits for the
right scene, or preserves phase continuity. Apply this matrix proportionally to
every replay change.

## Fixed reference scenarios

Maintain representative journeys for:

1. imagery only;
2. terrain;
3. terrain with the active 3D Tiles layer;
4. a long and dense journey.

Exercise each relevant scene with no clips, start clips, waits, stop clips,
narrow crop, and at least one high-resolution output profile.

## Required automated checks

### Frame and timeline

- A logical timestamp resolves the expected phase and progress.
- Draft and HQ intents match at selected timestamps.
- Scrub requests are latest-request-wins and obsolete qualification is aborted.
- Holds preserve logical time and fixed camera state.
- First, phase-boundary, last replay, and final scene frames are exact.

### Camera

- The first replay camera does not depend on an unrelated preview pose.
- Every deterministic HQ frame applies its resolved camera command.
- Start clip endpoints equal the replay-entry command.
- Stop clips preserve continuity and land on their declared endpoint.
- Navigation and Dynamic crop decisions are deterministic for the same inputs.
- Moving the interactive camera cannot change isolated HQ camera poses.
- Obsolete cleanup cannot move the camera after session replacement.

### Trace and marker

- A non-zero HQ replay frame contains visible completed trace geometry.
- HQ bypasses Draft wall-clock geometry throttling.
- The marker follows the same sample used by the trace.
- Start and stop visibility rules do not leak into the replay phase.
- The final captured frame contains the declared completed trace.

### Render target and lifecycle

- Camera, scene, canvas, and data sources resolve to the explicit HQ target.
- Interactive viewer camera and entities remain unchanged during isolated HQ.
- Initialization failure announces and tests the visible-scene fallback.
- Success, cancellation, encoding failure, and readiness failure all clear the
  target and destroy the isolated host.

### Composition and encoding

- Crop and widget coordinates scale from logical viewport to physical output.
- Dynamic widgets receive canonical logical frame time.
- Encoded frame count and duration match the declared timeline.
- Encoder keep-alive behavior does not add product frames or alter duration.

## Required visual validation

For every change affecting camera, trace, clips, readiness, crop, overlays,
render hosts, or encoding:

1. generate a real HQ video from an applicable reference journey;
2. inspect trace visibility and progression;
3. inspect camera movement and phase transitions;
4. inspect first and final frames;
5. inspect terrain and 3D Tiles replacement or missing-detail artifacts;
6. record output dimensions, frame count, duration, export time, and browser;
7. compare with the accepted baseline when one exists.

The validation result must state what was inspected. “Tests pass” is not a
substitute for visual evidence.

## Performance and responsiveness

- Slider dragging must not compile a complete trajectory or block the main
  thread.
- Settled scrub qualification must be cancellable and bounded.
- HQ frame work may increase export wall time but must not change video time.
- Long-journey tests must measure maximum main-thread task duration and memory.
- Isolated host creation and destruction must not leak WebGL contexts.

## Handoff checklist

- Architecture document still matches the changed ownership and data flow.
- Implementation status distinguishes delivered, partial, and planned work.
- Focused tests cover the regression or feature.
- Replay test suites and type checking pass, with flakes reported separately.
- Real visual validation is complete when pixels or timing changed.
- No claim of completion exceeds the evidence collected.
