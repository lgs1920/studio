# Replay Quality Validation

Status: validation contract for interactive Replay and deterministic Replay
video export

Date: 2026-08-24

## Purpose

Simple and Expert configure the same Replay mechanism and use the active mode's
camera settings. Capture paths consume that Replay state; they are not
user-facing Replay modes. Linked Replay video uses the deterministic deferred
MP4 exporter. Product export advances the main Studio Cesium viewer, then copies
that viewer's canvas into the video composer. Replay correctness is visual and
temporal. Mock-only validation cannot establish
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
- Interactive playback and deferred-export intents match at selected
  timestamps.
- Scrub requests are latest-request-wins and obsolete qualification is aborted.
- Holds preserve logical time and fixed camera state.
- First, phase-boundary, last replay, and final scene frames are exact.

### Camera

- The first replay camera does not depend on an unrelated preview pose.
- Every deterministic export frame applies its resolved camera command.
- Start clip endpoints equal the replay-entry command.
- Stop clips preserve continuity and land on their declared endpoint.
- Navigation and Dynamic crop decisions are deterministic for the same inputs.
- Replay camera height, pitch, and heading/offset resolve to the expected
  target-relative camera range and angle in both Simple and Expert.
- Each product export frame applies its camera command to the main Studio
  viewer before the viewer canvas is copied into the output frame.
- The export camera does not come from a second Cesium viewer or a stale
  preparation pose.
- Obsolete cleanup cannot move the camera after session replacement.

### Trace and marker

- A non-zero export frame contains visible completed trace geometry.
- Export rendering does not use interactive-playback wall-clock throttling.
- The marker follows the same sample used by the trace.
- Start and stop visibility rules do not leak into the replay phase.
- The final captured frame contains the declared completed trace.

### Render target and lifecycle

- Product export camera, scene, canvas, and replay trace resolve to the main
  Studio viewer and its canvas.
- The canvas copied to each encoded frame is the same main Cesium canvas that
  displays the Replay trace and applies its camera command.
- The recording monitor copies each composed frame before the exporter reuses
  its working canvas; the preview does not flash black between frames.
- Explicit isolated-render workflows resolve to the owner-scoped target and do
  not move the interactive Studio camera.
- Success, cancellation, encoding failure, and readiness failure release any
  explicit target and destroy an isolated host when one was allocated.

### Composition and encoding

- Crop and widget coordinates scale from logical viewport to physical output.
- Dynamic widgets receive canonical logical frame time.
- Encoded frame count and duration match the declared timeline.
- Encoder keep-alive behavior does not add product frames or alter duration.

## Required visual validation

### Simple Replay Dry run

- Traverse every configured logical frame and start/stop phase with the normal
  camera, trace, and published widget state.
- Keep tile-cache preparation, prewarming, and bounded per-frame tile waits.
- Recheck readiness after a synchronous ready-view render; keep missing-tile
  waits asynchronous and preserve normal recording render scheduling.
- Use the same ordered worker-prepared journey samples in Dry run and Record;
  verify frames start after the first batch without waiting for the full route.
- Do not allocate a working capture canvas, wait for widget bitmap readiness,
  capture widget pixels, compose images, probe codecs, or create encoded output.
- Publish progress and frame counts without a monitor image preview.
- Preserve pause, cancellation, and terminal camera/scene restoration.
- Visually inspect a real Dry run with imagery and terrain/3D Tiles before
  declaring its scene appearance and completion/cancellation cleanup validated.

### Video export

For every change affecting camera, trace, clips, readiness, crop, overlays,
render hosts, or encoding:

1. generate a real deferred-export video from an applicable reference journey;
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
- Deferred-export frame work may increase export wall time but must not change
  video time.
- Long-journey tests must measure maximum main-thread task duration and memory.
- Isolated host creation and destruction must not leak WebGL contexts.

## Handoff checklist

- Architecture document still matches the changed ownership and data flow.
- Implementation status distinguishes delivered, partial, and planned work.
- Focused tests cover the regression or feature.
- Replay test suites and type checking pass, with flakes reported separately.
- Real visual validation is complete when pixels or timing changed.
- No claim of completion exceeds the evidence collected.
