# Replay quality and performance audit

Date: 2026-08-23

Status: diagnostic of the current workspace state

## Scope and evidence

This document audits the replay implementation exactly as it exists in the workspace at the time of writing. It includes the five uncommitted files reported by `git status`, including the current `ReplayDeferredExporter.js` changes. It does not assume that Studio fails to start. The reported problem is the quality and speed of the generated replay videos.

The audit is based on:

- The current replay source under `src/core/ui/replay/` and `src/core/ui/JourneyReplayRunner.js`.
- The current replay configuration in `public/replay.yaml` and `JourneyReplayProgressionStyle.js`.
- The current replay unit and integration tests.
- Static control-flow analysis of Draft playback, Cesium rendering, HQ rendering, camera correction, tile readiness, overlays, and encoding.

No browser capture or visual A/B capture was performed during this audit. Therefore, statements marked as `Confirmed by code` are directly observable in the current implementation. Statements marked as `Likely cause` are strong technical inferences that still need a reproducible capture and trace to be promoted to a measured fact.

The interrupted replay test run is not treated as a passing or failing result. The store contract test did pass: 9 tests passed. This is not evidence that the replay quality is correct.

## Executive conclusion

The current replay is not governed by one cinematic timeline and one authored camera path. It is governed by a stack of independently active mechanisms:

1. A legacy singleton runner driven by `setInterval` and point indexes.
2. A newer replay controller driven by `requestAnimationFrame` and `performance.now()`.
3. A deterministic HQ frame timeline driven by absolute frame timestamps.
4. A live camera tracker that repeatedly recomputes a camera pose.
5. Visibility, terrain, collision, and constrained-path corrections that can replace that pose.
6. Cesium tile readiness waits that can delay the capture of an individual frame.
7. Dynamic Cesium entities and overlay composition that are evaluated again before encoding.

The main problem is therefore architectural, not a single bad easing constant. The implementation tries to repair an unstable camera and an unstable scene at render time. Those repairs are allowed to affect the visible timeline. The result can be a replay that is technically deterministic in isolated functions but not perceptually continuous.

The most damaging current mechanisms are:

- Camera correction is recomputed at every logical frame and may use rendered depth picks and terrain line-of-sight checks.
- The camera is applied with `camera.setView()` while several independent transition and correction states are active.
- HQ export waits for tiles after moving the camera, but does not recompute the camera decision after the awaited scene render.
- Clip frames are classified as settled and can receive the full 5-second tile-readiness budget.
- The tile-readiness coordinator reuses a coarse camera-footprint cache, which can accept a frame before the exact current view has reached the desired visual quality.
- The trace is rendered through multiple clamped-to-ground entity polylines, including up to three completed layers plus a remaining layer and dynamic callback properties.
- The current uncommitted encoder workaround introduces serialized frame submission and microscopic keep-alive frames. It addresses codec liveness, not visual replay quality, and should not be considered a camera or tile-quality fix.

## Current pipeline

The current runtime is best represented as follows:

```text
Draft
  requestAnimationFrame
    -> JourneyReplayPlaybackController
      -> replay events
        -> JourneyReplaySessionSceneController
          -> JourneyReplayCesiumRenderer
          -> camera tracking and correction
          -> Cesium requestRender / continuous render

HQ export
  ReplayFrameTimeline / ReplayVideoTimeline
    -> seek to one deterministic frame
      -> renderReplayExportFrame
        -> update renderer
        -> update camera
        -> wait for tile readiness
        -> compose widgets and overlays
        -> CanvasSource.add()

Legacy fallback
  JourneyReplayRunner.setInterval
    -> lgs.events tick/start, tick/update, tick/stop
      -> marker and profiler updates
```

The application instantiates all three replay-related services in `LGS1920Context.js:417-419`: `JourneyReplayRunner`, `JourneyReplayMode`, and `JourneyReplayVideoSync`. The fallback bridge in `JourneyReplayUtils.js:24-59` uses the newer replay mode when its `start` method exists, but the legacy runner remains part of the runtime and is still referenced by the profiler and journey editor. This is a permanent source of ownership ambiguity, even when the legacy path is not selected for a particular playback.

## Confirmed problem 1: multiple clocks and publication cadences

### Legacy clock

`JourneyReplayRunner.js:271-369` uses `setInterval`, advances by an integer point step, and changes the effective duration when the configured interval is below the minimum profile interval. It emits index-based events and can execute asynchronous marker work from an event listener.

This clock is not frame based. It is not tied to the actual elapsed wall time, the Cesium render loop, or the video frame clock.

### Draft clock

`JourneyReplayPlaybackController.js:224-372` uses `requestAnimationFrame` and `performance.now()`. The controller computes continuous progress from elapsed wall time, emits a local update on every animation frame, requests a Cesium render, and publishes store values at a 250 ms cadence in normal mode.

The same controller also publishes `dynamicFrameState` on every internal tick before applying the 250 ms store publication throttle (`JourneyReplayPlaybackController.js:436-506`). This means the replay has both a high-frequency internal state and a lower-frequency public state.

### HQ clock

`ReplayFrameTimeline.js:29-170` and `ReplayVideoTimeline.js:115-199` define a separate fixed frame sequence. HQ export does not wait for real time between frames. It seeks directly to a frame, updates Cesium, waits for scene readiness, composes overlays, and encodes.

### Why this matters visually

The Draft camera receives wall-clock updates. The HQ camera receives frame-clock updates. The store and widgets can receive another cadence. The legacy runner can still publish index-based events. The current code contains guards such as `renderingReplayExportFrame` to prevent some duplicate updates, but those guards do not turn the system into one clock.

Likely consequence: a camera transition or widget that looks acceptable in Draft can be sampled at a different phase in HQ, while a widget or marker still observes a delayed store publication. This is a continuity problem, not merely a frame-rate problem.

## Confirmed problem 2: the camera is a reactive safety system, not one cinematic trajectory

The camera is resolved in `JourneyReplayCameraTrackingBinding.js:483-850`. For each update it:

- Creates a new per-update camera cache at line 508.
- Computes a nominal tracking view.
- Computes a lookahead sample.
- Runs pitch and visibility correction.
- May inspect rendered depth with `pickPosition`.
- May inspect terrain line of sight through 11 terrain segments.
- Searches an ordered list of 20 redirect candidates in `JourneyReplayCameraShared.js:67-109`.
- Applies a deterministic transition, navigation correction, live correction, or nominal view.

The per-update cache prevents repeated work inside one camera update, but it is discarded after the update. There is no long-lived camera decision cache across frames. HQ therefore repeats the visibility and correction decision for every output frame.

`JourneyReplayCameraVisibility.js:405-515` uses `scene.pickPosition()` or a globe pick to decide whether the marker is hidden by rendered depth. `JourneyReplayCameraVisibility.js:549-589` also checks line of sight for one or more marker and trace targets. These checks are sensitive to the exact Cesium render state at the instant they run.

`JourneyReplayConstrainedCameraPath.js:889-1125` then compiles a constrained path that moves the camera back into screen zones, interpolates corrections, and uses `focusConstrainedReplayFrame()` as a fallback when the zone cannot be satisfied.

### Likely visual consequence

The camera has no single visible owner. A nominal path can be replaced by:

- A pitch correction because the marker is hidden.
- A redirect because the marker or trace leaves the screen zone.
- A terrain clearance correction.
- A constrained path frame.
- A clip transition or landing frame.
- A manual-camera suppression or replay-entry restoration.

Each correction is locally defensible, but their composition can generate small heading, pitch, lateral, and altitude discontinuities. Those discontinuities are exactly what a viewer perceives as derapage, nervous reframing, or an ugly camera jump.

The current default makes correction likely: `public/replay.yaml:33-48` enables drift, hidden-marker correction, roll, and a 12 percent hysteresis margin, with a -65 degree pitch. These options are not inherently wrong, but the code combines them with rendered visibility and terrain correction on the same frame path.

## Confirmed problem 3: tile waiting is inside the visible frame loop

The HQ callback in `ReplayDeferredExporter.js:1871-2020` performs the following sequence for every frame:

1. Resolve the absolute video phase.
2. Move the replay to the frame through `renderReplayExportFrame`.
3. Publish the HQ frame state to widgets.
4. Wait for the tile coordinator.
5. Compose overlays.
6. Submit the frame to the encoder.

`ReplaySceneTileReadiness.js:568-616` waits on Cesium readiness and a post-render boundary. A timeout returns `false`, but the exporter continues with the current scene. Therefore the implementation has two bad outcomes when the scene is slow:

- The export becomes extremely slow while waiting.
- The export continues with a frame that may still be blurry, incomplete, or visually inconsistent.

The current exporter classifies a frame as settled when it is first, last, a final scene frame, a last phase frame, or any clip frame (`ReplayDeferredExporter.js:1938-1944`). The default settled timeout is 5000 ms (`JourneyReplayProgressionStyle.js:150-157`). Consequently, every frame of a start or stop clip can enter the settled branch and receive the maximum wait budget. This is a direct explanation for severe export slowdowns when clips and tile loading are combined.

### The readiness decision is not fully tied to visual quality

The coordinator reuses a successful footprint through `readyFootprints` (`ReplaySceneTileReadiness.js:700-805`). The footprint key quantizes camera position to 50 m and camera direction and up vectors to 0.05 (`ReplaySceneTileReadiness.js:16-18, 183-219`). This is useful for avoiding repeated waits, but it is not an exact view identity.

Likely consequence: two materially different camera views can share the same coarse footprint. The next frame receives only a short post-render wait instead of a full readiness wait. In a terrain or 3D Tiles scene, that can produce a frame with the wrong LOD or a visible tile replacement.

There is a second ordering problem. Camera visibility and occlusion decisions happen while `renderReplayExportFrame` updates the camera. Tile readiness is awaited afterward. If newly requested tiles change the rendered depth, the camera decision for that frame is not recomputed after the new content becomes visible. This can create one-frame hidden markers, late redirects, or correction oscillations. This is a likely race that needs capture instrumentation.

## Confirmed problem 4: prewarming moves the real scene camera

`ReplayDeferredExporter.js:89-205` prewarms a rolling prefix by calling `replayMode.renderReplayExportFrame()` on future frames. This deliberately moves the active Cesium camera through future poses, asks Cesium to load those views, then returns to the first frame.

This is not a passive cache prefetch. Cesium view-dependent requests are being generated by moving the real camera. The approach can help tile availability, but it also:

- Adds extra camera updates before frame zero.
- Adds extra renderer and visibility work.
- Changes the active scene before the first capture.
- Depends on restoring the first pose perfectly.
- Can produce visible scene churn if any UI or render path observes the scene during preparation.

The prewarm horizon defaults to 1000 ms (`JourneyReplayProgressionStyle.js:130-133`) and uses up to three samples. It is therefore a bounded cost, but it is still cost on every HQ export and is another camera traversal separate from the actual export traversal.

## Confirmed problem 5: trace rendering is expensive and visually layered

`JourneyReplayCesiumRenderer.js` uses a `CustomDataSource` and entity polylines. The renderer creates separate completed-track layers for border, inner glow, and fill (`JourneyReplayCesiumRenderer.js:1493-1625`). The default configuration has a border, and the renderer supports glow and neon effects with additional width and material layers (`JourneyReplayCesiumRenderer.js:40-55, 923-950`). Remaining trace geometry adds another polyline (`JourneyReplayCesiumRenderer.js:1682-1759`).

All these polylines are clamped to ground with an 8 m granularity (`JourneyReplayCesiumRenderer.js:1273-1290`). Dynamic lines use `CallbackProperty` (`JourneyReplayCesiumRenderer.js:1419-1490`). During playback, the dynamic progress step is 0.00025, while the non-playing step is 0.002 (`JourneyReplayCesiumRenderer.js:1461-1475`). Long or dense journeys can therefore drive large position arrays through several entity polylines while the camera and tile pipeline are also active.

The renderer limits live trace positions to 2048 points, which is a useful safety limit, but it does not make the path cheap. It still performs repeated coordinate conversion and terrain-related clamped polyline processing. The renderer also rebuilds geometry on a 120 ms cadence or when distance changes enough (`JourneyReplayCesiumRenderer.js:472-494`).

Likely visual consequences:

- Frame pacing suffers when a geometry update coincides with a camera correction and tile processing.
- The glow, border, fill, and remaining trace can dominate the image and make the result look like a debug overlay rather than a clean cinematic route.
- A dynamic callback geometry can be one render behind the logical frame unless the capture path freezes or explicitly synchronizes it.

The current HQ path contains a special final-frame freeze for this reason (`JourneyReplaySessionPlaybackController.js:773-815`). That protects the final frame but does not provide a general frame-accurate geometry contract for the whole video.

## Confirmed problem 6: clip transitions are over-coupled to playback state

Start and stop clips are represented as phases in the shared video timeline. During Draft playback, `JourneyReplaySessionPlaybackController.js:337-421` runs clip playback asynchronously, enables continuous Cesium rendering, hides the journey toolbar, updates replay clip state, and only starts the main controller after start clips complete.

During HQ, `renderReplayExportFrame` handles replay phases and clip phases separately (`JourneyReplaySessionPlaybackController.js:691-827`). The same renderer, camera state, clip continuity state, and replay controller are reused while the export jumps frame by frame.

The design is ambitious, but the state surface is very large. Camera continuity, clip sequence tokens, deferred scene restoration, final-frame logic, cursor visibility, trace visibility, and widget state all interact. A clip can therefore affect not only camera motion but also tile readiness classification, trace mode, cursor visibility, continuous rendering, and overlay composition.

Likely consequence: adding a clip changes the behavior of unrelated systems. This explains why “simple waiting” or a camera clip can make the entire generated video worse rather than only changing the intended segment.

## Current uncommitted exporter changes

The workspace currently contains uncommitted changes in:

- `src/core/ui/replay/ReplayDeferredExporter.js`
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`
- `src/__tests__/integration/replay/replay-deferred-exporter.test.js`
- `src/__tests__/unit/replay/replay-video-overlay-composer.test.js`
- `src/__tests__/ui/widgets/widget-2-canvas-refresh-mode.test.js`

The current exporter change adds:

- A stable intermediate canvas for encoding.
- Serialized `CanvasSource.add()` calls.
- Output cancellation in the `finally` path.
- A five-second codec keep-alive timer.
- Microscopic timestamp steps for duplicate keep-alive frames.

These changes are reasonable as a response to a codec that is reclaimed during a slow offline export, but they do not solve the visual root causes above. They also introduce a second timing mechanism inside the encoder path. The keep-alive must not be allowed to become part of the product-quality contract without verifying duration, timestamps, frame count, audio synchronization, and browser playback in a real MP4. The current tests mock Mediabunny and cannot prove those properties.

## Why existing tests have not prevented the regression

The current test suite is broad in naming but mostly isolates contracts:

- Camera tests validate math, candidate selection, constraints, and state transitions.
- Timeline tests validate frame and phase metadata.
- Renderer tests validate entity existence, visibility, and materials.
- Tile tests validate mocked readiness events and timeout behavior.
- Export tests validate mocked frame sequencing, overlays, and Mediabunny calls.

Those tests do not currently establish perceptual quality or real Cesium frame continuity. They do not measure:

- Maximum camera angular velocity.
- Maximum camera positional acceleration.
- Number of camera corrections per second.
- Number of tile-wait timeouts per export.
- Time spent per camera update, renderer update, tile wait, overlay composition, and encode submission.
- Whether the captured frame contains the LOD that was visible after the readiness wait.
- Whether the same route rendered in Draft and HQ has the same camera trajectory.
- Whether the first frame after every clip is continuous with the last frame before it.

The suite can therefore pass while the result remains ugly or slow.

## Root-cause ranking

### P0: one frame must have one authoritative state

The replay needs a single frame state containing at least:

- Absolute video time.
- Replay progress.
- Phase and clip identity.
- Marker and trace geometry state.
- Camera pose.
- Tile-readiness state.
- Overlay/widget clock.

Every renderer must consume that state. No renderer should derive a different time from wall-clock time, store publication cadence, or a secondary controller during HQ.

### P0: camera corrections must be compiled, not improvised during capture

The camera should be compiled into one continuous trajectory before rendering. Collision and visibility policy should modify the trajectory during compilation, with bounded continuity constraints. The capture loop should sample that trajectory. It should not run depth picks, terrain probes, candidate searches, and transition ownership decisions as part of every output frame unless a deliberate fallback is explicitly recorded.

### P0: tile readiness must be a bounded quality policy

Tile waiting should never silently turn a frame into a five-second blocking operation or accept an arbitrary blurry frame. The export policy needs explicit modes:

- `strict`: fail with a diagnostic when the required view is not ready.
- `quality`: wait up to a bounded per-segment budget and record the degraded frame.
- `fast`: never block, but clearly accept lower LOD.

The policy must be measured per phase, not inferred from `phase.clip` alone.

### P1: replace repeated entity geometry work with a stable capture representation

The trace should be compiled once per replay configuration and sampled by progress. During capture, geometry updates should be data updates, not repeated creation of clamped entity polylines and callback-property evaluation. Visual effects should be limited to the layers that are actually selected.

### P1: make Draft and HQ share the same camera samples

Draft may interpolate between compiled samples for responsiveness. HQ must sample the exact same trajectory at fixed timestamps. A trajectory-difference test should compare the two modes over identical progress values.

### P2: remove or quarantine the legacy runner

`JourneyReplayRunner` should either be removed from the active replay path or isolated as a compatibility adapter. It must not remain a second possible owner of marker, profiler, and replay progression state.

## Required instrumentation before implementation changes

Before changing the algorithms, add a bounded trace that records one row per logical or output frame:

```text
frame index
absolute video time
replay progress
phase and clip id
camera position, heading, pitch, roll
camera correction owner
camera correction magnitude
camera angular and positional delta
tile wait duration
tile wait result: ready, timeout, failed, reused footprint
renderer geometry update duration
renderer visible entity count
overlay composition duration
encoder submission duration
```

The existing `ReplayVideoTraceDebug` hooks are a suitable transport, but the trace needs aggregate summaries as well as individual events. The essential acceptance thresholds should be defined before implementation:

- No unexplained camera pose discontinuity at a clip boundary.
- No repeated correction oscillation over consecutive frames.
- No unbounded per-frame tile wait.
- No frame that is encoded before the post-readiness render has actually completed.
- Draft and HQ camera trajectories remain within a defined positional and angular tolerance.
- Export duration is reported as a multiple of video duration, with separate budgets for scene preparation, tile waits, rendering, composition, and encoding.

## Minimal reproduction matrix

The following matrix should be captured with the same journey, viewport, browser, tile source, and output settings:

| Case | Camera | Clips | Tiles | Purpose |
| --- | --- | --- | --- | --- |
| A | Fixed constant altitude, marker trace mode | None | Flat imagery only | Baseline renderer and timeline |
| B | System tracking, no correction | None | Terrain | Isolate normal tracking and terrain |
| C | System tracking, hidden-marker correction | None | Terrain and 3D Tiles | Isolate depth and terrain correction |
| D | Same as C | Start clip only | Terrain and 3D Tiles | Isolate clip boundary and settled wait |
| E | Same as C | Stop clip only | Terrain and 3D Tiles | Isolate landing and final-frame handling |
| F | Same as C | Start and stop clips | Terrain and 3D Tiles | Full interaction path |
| G | Same as F | Same | Slow or throttled network | Tile readiness policy |

For each case, compare Draft playback, HQ output, camera trace, tile trace, and total export time. A case should be considered fixed only when its measured failure disappears without regressing the simpler cases.

## Final assessment

The current implementation contains a lot of serious engineering work, but it has accumulated compensating mechanisms faster than it has established a single visual contract. The result is a system that can defend individual decisions while producing a poor film.

The correct recovery strategy is to restore visual authority first:

1. One clock.
2. One compiled camera trajectory.
3. One explicit tile quality policy.
4. One stable trace representation.
5. One frame contract shared by Draft, HQ, widgets, and overlays.

Until those contracts are explicit and measured, adding another camera correction, readiness wait, prewarm pass, encoder keep-alive, or overlay workaround will continue to make the system slower and harder to reason about.
