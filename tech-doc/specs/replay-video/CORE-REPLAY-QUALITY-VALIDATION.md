# Replay Quality Validation

Status: validation contract for interactive Replay and deterministic Replay
video export

Date: 2026-10-14

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
- The first exported frame resolves at the preparation range start, the final
  frame resolves at its end, and clips intersecting either boundary retain
  their source-local phase time.

### Camera

- The first replay camera does not depend on an unrelated preview pose.
- Every deterministic export frame applies its resolved camera command.
- Start clip endpoints equal the replay-entry command.
- Stop clips preserve continuity and land on their declared endpoint.
- Navigation and Dynamic crop decisions are deterministic for the same inputs.
- Dynamic tracking anticipates a sustained trigger-zone exit from two future
  projections before the marker reaches the boundary. Navigation confirms its
  predictive collision with a 3-second base transition horizon. Live tolerance
  and visibility corrections use a cubic ease-in/out flight of at least 3
  seconds, preserve a longer configured Ease duration, and do not restart while
  the same transition remains active. Deterministic Simple Replay capture must
  interpolate hard Navigation corrections over at least 3 replay-time seconds
  rather than applying them as an immediate camera frame.
- Untimed routes and GPX recordings spanning many hours use the selected Replay
  duration for prediction. Confirmation samples lie after the predicted exit.
- Exercise `renderReplayExportFrame` itself and verify it invokes camera-anchor
  smoothing. With a real Cesium Camera, inspect every frame of a correction:
  the first frame preserves position and orientation, subsequent movement is
  gradual, and the canonical adapter preserves the interpolated aim.
- Explicit seeks cancel transitions and apply the requested sample without
  playback anticipation. Camera smoothing bounds use rendered terrain height.
- Validate current-marker containment during every Navigation transition and
  held pose at low, medium and high prepared heights, using a long untimed
  10-second route and an offset crop smaller than the canvas. Anticipation must
  respond to the height/pitch-derived ground span and route speed. Crop checks
  use CSS canvas dimensions and origin even at high drawing-buffer DPR. Safety
  translation must preserve orientation, frustum and camera height and must
  never qualify a future or smoothed marker in place of the rendered marker.
- Navigation holds the same applied pose between corrections in live playback
  and export. Check the last three seconds image by image: final alignment must
  be eased and retain the exact endpoint, including reverse playback. Absolute
  video time containing start clips does not imply Replay completion.
- Replay camera height, pitch, and heading/offset resolve to the expected
  target-relative camera range and angle in both Simple and Expert.
- Long untimed journeys remain smooth at both short and ordinary Replay
  durations. Check per-frame camera-anchor movement and heading, confirm the
  smoothing-pass offset stays within one quarter of the projected crop width,
  and confirm the trace and marker remain on the unmodified route sample.
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
3. inspect camera movement and phase transitions, comparing a 10-second Replay
   of a long untimed route with a normal-duration Replay and reviewing tight
   turns and elevation changes at both speeds;
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
