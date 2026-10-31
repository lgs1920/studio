# Replay Quality Validation

Status: validation contract for interactive Replay and deterministic Replay
video export

Date: 2026-10-22

## Purpose

Basic and Expert configure the same Replay mechanism and use the active mode's
camera settings. Capture paths consume that Replay state; they are not
user-facing Replay modes. Linked Replay video uses the deterministic deferred
MP4 exporter. Dry run and product export advance the main Studio Cesium viewer.
Product export explicitly renders each frame during tile readiness and copies
the main viewer's canvas into the video composer. Replay correctness is visual and
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
- Expert Timeline pre/post clip duration, enable, and removal edits reach the
  Journey clip arrays consumed by interactive playback and deferred export.
- Expert Timeline widget event ranges and visibility control the matching
  widget on the corresponding interactive and export frames. Basic Replay has
  no preparation Timeline.

### Camera

- The first replay camera does not depend on an unrelated preview pose.
- Compare `replay.camera.transfer` and `camera.view.apply` trace values at
  preparation, playback/export startup, and the first Replay frame. Configured
  altitude, pitch, and angle must resolve to the same camera-to-marker range
  across crop positioning and the first camera command.
- Save the departure marker's crop-relative screen position in Basic and Expert
  Journey Replay data, reload the Journey, and verify preparation, playback, and
  export preserve that position when present.
- Preparation and interactive Play wait for the final inertial wheel or drag
  zoom, including movement that continues beyond the first input debounce.
  Verify constant altitude and ground offset in Basic and Expert. Cancellation
  resolves pending preparation/start requests without applying or saving the
  restored map view. Stop and rendering errors must preserve newer Journey
  camera values, including when the selected Journey changes before cleanup.
- Every deterministic export frame applies its resolved camera command.
- Start clip endpoints equal the replay-entry command.
- Stop clips preserve continuity and land on their declared endpoint.
- Navigation and Dynamic crop decisions are deterministic for the same inputs.
- Dynamic tracking anticipates a sustained trigger-zone exit from two future
  projections before the marker reaches the boundary. Navigation confirms its
  predictive collision with a 3-second base transition horizon. Live tolerance
  and visibility corrections use a cubic ease-in/out flight of at least 3
  seconds, preserve a longer configured Ease duration, and do not restart while
  the same transition remains active. Deterministic Basic Replay capture must
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
  translation must preserve orientation, frustum and camera-to-target range,
  and must never qualify a future or smoothed marker in place of the rendered
  marker.
- Navigation holds the same applied pose between corrections in live playback
  and export. Check the last three seconds image by image: final alignment must
  be eased and retain the exact endpoint, including reverse playback. Absolute
  video time containing start clips does not imply Replay completion.
- Replay camera height, pitch, and heading/offset resolve to the expected
  target-relative camera range and angle in both Basic and Expert.
- Long untimed journeys remain smooth at both short and ordinary Replay
  durations. Check per-frame camera-anchor movement and heading, confirm the
  smoothing-pass offset stays within one quarter of the projected crop width,
  and confirm the trace and marker remain on the unmodified route sample.
- Each product export frame applies its resolved camera command to the main
  Cesium viewer before that viewer's canvas is copied into the output frame.
- While recording, the main scene continues to display the current Replay
  camera and trace; export cleanup restores the saved return view.
- The product export uses the active Replay camera command, not a stale
  preparation pose.
- Obsolete cleanup cannot move the camera after session replacement.

### Trace and marker

- Expert Replay draws its trace on the first playback frame and progresses it
  during playback; pause resolves exact trace geometry at the paused sample.
- A non-zero export frame contains visible completed trace geometry.
- Export rendering does not use interactive-playback wall-clock throttling.
- Dry run draws the trace during its Replay phase even when pre-Replay clips
  hide it, and its first, phase-boundary, and final trace geometry is exact.
- The marker follows the same sample used by the trace.
- The Start flag animates at Replay startup and the Stop flag at route arrival
  only when global Replay and per-POI animation settings allow it; a `tooClose`
  Stop stays hidden and the Start animates again at route arrival. Hold the
  departure and arrival samples for one second each, only when their endpoint
  animations are enabled, in both interactive playback and deterministic export.
- Start and stop visibility rules do not leak into the replay phase.
- The final captured frame contains the declared completed trace.

### Render target and lifecycle

- Product export camera, scene, canvas, and replay trace resolve to the main
  Studio viewer.
- The main Cesium scene remains in the application during recording and follows
  the same Replay frames used by the encoded video.
- The canvas copied to each encoded frame is the main Cesium canvas after its
  synchronous render boundary.
- Basic and Expert recording suspend the main viewer's default render loop and explicitly
  updates the viewer before each capture. Dynamic entity positions must reach
  that same frame without relying on a browser animation callback. Success,
  cancellation, and encoder failure restore the original loop setting. Pending
  tile waits must advance through bounded explicit renders with browser-task
  yields; cancellation removes pending render timers and event listeners.
- Product recording does not allocate an isolated host or redirect the main
  Replay renderer.
- The recording monitor copies each composed frame before the exporter reuses
  its working canvas; the preview does not flash black between frames.
- Recording while the browser window is fully covered still advances the main
  scene and captures visible trace geometry in the output.
- Success, cancellation, encoding failure, and readiness failure restore the
  main viewer and its camera to the saved return view.

### Composition and encoding

- Crop and widget coordinates scale from logical viewport to physical output.
- Dynamic widgets receive canonical logical frame time.
- Encoded frame count and duration match the declared timeline.
- Encoder keep-alive behavior does not add product frames or alter duration.

## Required visual validation

### Basic Replay Dry run

- Traverse every configured logical frame and start/stop phase with the normal
  camera, trace, and published widget state.
- Keep tile-cache preparation and prewarming. Bound phase-boundary and final
  readiness checkpoints to 250 ms and omit intermediate synchronous scene
  flushes and tile waits.
- Recheck readiness after a synchronous checkpoint render; keep missing-tile
  waits asynchronous and preserve normal recording render scheduling.
- Apply each export frame through the guarded callback without a preliminary
  interactive seek. Check camera/trace update counts and ordered prepared
  samples in both Dry run and Record.
- Reuse normalized supplied trace-guide positions across frames. Verify guide
  replacement, edited-guide reinstallation, clearing, and exact final endpoints.
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
6. repeat a recording with the browser window fully covered and confirm the
   trace remains present;
7. record output dimensions, frame count, duration, export time, and browser;
8. compare with the accepted baseline when one exists.

The validation result must state what was inspected. “Tests pass” is not a
substitute for visual evidence.

## Performance and responsiveness

- Each real Record export publishes one `[Replay video] Recording performance:`
  report and a console table after encoding cleanup, including graceful stop,
  cancellation, or failure. Dry run does not produce these recording timings.
- Read the latest JSON report from
  `lgs.stores.replay.deferredExportPlan.runtime.recordingPerformance`. The direct
  `ReplayDeferredExporter.exportMp4()` result also exposes `recordingPerformance`.
  To copy a UI Record report from browser DevTools, use:

  ```javascript
  copy(JSON.stringify(lgs.stores.replay.deferredExportPlan.runtime.recordingPerformance, null, 2))
  ```

- Compare repeated real exports with the same journey, timeline, crop, dimensions,
  output FPS, quality, codec, widgets, render host, and browser. The context records
  encoder configuration and output characteristics. Open DevTools after recording
  when collecting an unprofiled baseline, so debugging does not affect the run.
- Timing rows distinguish route sample/intent resolution, Replay camera/trace updates,
  scene-tile readiness waits, synchronous Cesium rendering, whole-frame rendering
  before encoding, composition-canvas initialization, widget synchronous frame publication, bitmap capture/waits,
  overlay layout, source layout, canvas composition, backdrop blur, frame transfers,
  monitor snapshot/preview copies and synchronous notifications, the encoder-canvas
  copy, submission queue/backpressure waits, progress/file-size publication,
  encoder close/drain, MP4 finalization, and Blob creation.
- `wallMillis` starts at encoder setup after scene preparation and ends after
  encoder cleanup. It includes frame resolution, rendering, and tile waits, with
  separate rows for these operations. `activeMillis` subtracts user
  pause waits. `frameProductionFps` measures actual completed timeline frames per
  active frame-loop second, rather than the output video's playback FPS. Keep-alive
  submissions and encoded packets are counted separately.
- The report context also includes the sampled-route point count, source-canvas
  dimensions, and active smoothing settings for comparisons at identical quality.
- Read `scope` rows as the measured recording operations. `detail` rows overlap
  enclosing spans: blur is inside composition, preview copies/notifications are
  inside publication, Cesium renders can occur during tile readiness, and packet-driven file-size updates can occur during encoder
  submission or drain. `context` rows include whole-frame rendering before encoding, the whole frame loop, and pause or
  cancellation waits. Do not add all row totals or percentages.
- `CanvasSource.add()` timings describe submission and writer/encoder backpressure,
  not isolated codec CPU time. Background encoding finishes during close/drain.
  Canvas and Cesium timings measure browser command duration, not deferred GPU completion.
  Composition timing excludes the separately measured Cesium flush callback. Notification timings
  include synchronous listeners, not later asynchronous React commits.
- Reports include totals, counts, means, maxima, and approximate P50/P95 histogram
  upper bounds with about 1% precision in `(1 + durationMillis)`. Timing storage is
  bounded independently of frame count, with no retained frame samples, extra
  timers, or per-frame console logging.
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
