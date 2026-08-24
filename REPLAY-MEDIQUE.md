# Replay quality and performance audit

Date: 2026-08-24

Status: current-code diagnostic, target architecture, and implementation plan

## Scope and evidence

This document audits the replay implementation exactly as it exists in the workspace at the time of writing. It includes the five uncommitted files reported by `git status`, including the current `ReplayDeferredExporter.js` changes. It does not assume that Studio fails to start. The reported problem is the quality and speed of the generated replay videos.

The audit is based on:

- The current replay source under `src/core/ui/replay/` and `src/core/ui/JourneyReplayRunner.js`.
- The current replay configuration in `public/replay.yaml` and `JourneyReplayProgressionStyle.js`.
- The current replay unit and integration tests.
- Static control-flow analysis of Draft playback, Cesium rendering, HQ rendering, camera correction, tile readiness, overlays, and encoding.
- Open Studio issues in the LGS1920 organization project whose project-level `Target release` is `1.0.0` or `1.1.0`.

No browser capture or visual A/B capture was performed during this audit. Therefore, statements marked as `Confirmed by code` are directly observable in the current implementation. Statements marked as `Likely cause` are strong technical inferences that still need a reproducible capture and trace to be promoted to a measured fact.

The interrupted replay test run is not treated as a passing or failing result. The store contract test did pass: 9 tests passed. This is not evidence that the replay quality is correct.

## Open issue inventory

This issue inventory is a snapshot taken on 2026-08-24 from the private [LGS1920 organization project](https://github.com/orgs/lgs1920/projects/2). It uses the project-level `Target release` field, not the GitHub milestone or a release name found in an issue body. Within the camera/replay scope, only open Studio issues with project status `Backlog` are treated as remaining work.

### Target 1.0.0

| Issue | Architectural responsibility | Dependency reading |
| --- | --- | --- |
| [#457 — Anchor replay start camera and synchronize start clips](https://github.com/lgs1920/studio/issues/457) | Canonical persisted camera model, replay-start anchor, one camera update command, start-clip endpoint, Draft/HQ pose parity | Foundation for #458 and the camera side of #459 |
| [#458 — Isolate Replay HQ recording camera from interactive preview](https://github.com/lgs1920/studio/issues/458) | Independent HQ render host and recording-camera ownership | Depends on #457; foundation for #479 and HQ monitoring in #459 |
| [#459 — Add Replay recording monitor widget with live frame progress](https://github.com/lgs1920/studio/issues/459) | Read-only monitoring of the final composed frame and export state | Depends on the canonical camera contract and HQ render host; must never become a render authority |
| [#471 — Journey focus always returns to the journey focus point](https://github.com/lgs1920/studio/issues/471) | Replay lifecycle containment and camera-state cleanup | Must be fixed while introducing explicit camera/session ownership, not as another focus exception |
| [#479 — Make Replay HQ tile readiness crop-aware](https://github.com/lgs1920/studio/issues/479) | Crop-sized Cesium viewport/frustum and view-specific 2D/3D readiness | Depends on the independent HQ render host from #458 |

These five issues are not independent features. The critical dependency chain is:

```text
#457 canonical camera and start contract
  -> #458 independent HQ render host
       -> #479 crop-aware readiness
       -> #459 HQ frame monitoring

#471 lifecycle containment applies across every stage above
```

### Target 1.1.0

| Issue | Architectural responsibility | Dependency reading |
| --- | --- | --- |
| [#395 — POI animation during replay](https://github.com/lgs1920/studio/issues/395) | Replay-clock POI track, deterministic pause ownership, cleanup | Must consume the canonical timeline and frame state |
| [#396 — Add explicit 4K UHD mode to HQ video export](https://github.com/lgs1920/studio/issues/396) | Explicit physical output profile and capability probing | Must reuse the HQ render host; it is not a new render mode |
| [#398 — Implement the replay-synchronized Video visual widget](https://github.com/lgs1920/studio/issues/398) | Time-indexed media track and deterministic decoded-frame composition | Depends on normalized timeline and shared frame publication |
| [#402 — Align clip altitude data across replay sequences](https://github.com/lgs1920/studio/issues/402) | Compile-time clip continuity validation | Belongs in timeline validation, before runtime camera evaluation |
| [#403 — Implement the 3D drone camera path editor](https://github.com/lgs1920/studio/issues/403) | Authoring adapter for serializable camera-path definitions | Must use the runtime camera evaluator and must not introduce another playback engine |
| [#404 — Replace Replay clips UI with a synchronized track timeline editor](https://github.com/lgs1920/studio/issues/404) | Normalized timeline model and authoring UI | Foundation for clip, POI, widget, wait, and media tracks |
| [#438 — Keep the replay marker inside the video crop](https://github.com/lgs1920/studio/issues/438) | Camera containment constraint for Navigation and Dynamic modes | Must be resolved by the shared camera plan for identical Draft/HQ decisions |
| [#450 — Synchronize dynamic widgets on replay](https://github.com/lgs1920/studio/issues/450) | Shared logical-frame publication for dynamic widgets | The issue's proposed recorder timestamp source must be replaced by the canonical replay frame source |

Two additional open 1.1.0 issues touch the boundary without defining the replay architecture:

- [#397 — Implement the repeatable Arrow visual widget](https://github.com/lgs1920/studio/issues/397) is a deterministic composition consumer. It validates the widget host and capture contract but should not change replay timing.
- [#406 — Clean up obsolete Main UI camera settings and geocoding dependency](https://github.com/lgs1920/studio/issues/406) should follow the canonical camera command migration, when obsolete settings and consumers can be proved unused.

### Coverage gaps in the current backlog

The open issues do not fully cover the root causes confirmed below. Before implementation begins, focused issues should be created for these missing deliverables:

1. Define one immutable replay frame intent and make Draft, HQ, widgets, POIs, and overlays consume it.
2. Replace capture-time camera improvisation with an incrementally compiled and qualified camera trajectory.
3. Replace the current per-frame readiness behavior with an explicit bounded quality policy, including the five-second clip-frame classification and readiness-cache identity.
4. Compile the replay trace into a stable capture representation instead of reevaluating several dynamic clamped entity polylines.
5. Add visual continuity, Draft/HQ parity, tile-quality, and export-performance acceptance tests.
6. Quarantine and then retire `JourneyReplayRunner` as a second replay authority.

#457 contains part of the first two items and #479 contains the crop portion of the third, but neither issue owns the complete recovery. Treating those issues as complete substitutes would leave the current failure modes in place.

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

The camera should be represented by one continuous trajectory before rendering. Here, "compiled" means a versioned, lazy sampler plus a bounded set of correction keyframes. It explicitly does not mean eagerly materializing every camera sample for the complete journey. Collision and visibility policy should modify the trajectory through incremental qualification, with bounded continuity constraints. The capture loop should sample that trajectory. It should not run depth picks, terrain probes, candidate searches, and transition ownership decisions as part of every output frame unless a deliberate fallback is explicitly recorded.

### P0: full-route synchronous compilation is forbidden

A previous attempt to compile the complete trajectory blocked the application long enough that it had to be abandoned. The replacement architecture must therefore make UI responsiveness a contract, not an optimization:

- `sampleAt(timeMs)` must remain immediately available from the nominal mathematical trajectory;
- scene-dependent qualification operates on a bounded rolling window around the requested time;
- long work is chunked, yields to the browser, and is cancellable by plan revision or session disposal;
- seeking invalidates stale queued work and prioritizes the new window;
- no start, slider, pause, or export action may synchronously enumerate the full route;
- HQ may prepare bounded future key views, but it cannot require all route samples to exist in memory before frame zero.

The useful compiled artifacts are sparse keyframes, segment coefficients, interval indexes, resource manifests, and diagnostics. A per-output-frame camera array is neither required nor allowed as the primary runtime representation.

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

## Target functional architecture

### Product objective

Replay must behave like a small deterministic film renderer, not like an interactive camera session being screen-recorded. The user authors one replay definition, validates one preview, and receives a Draft or HQ rendering of the same visual decisions. Draft and HQ may take different amounts of real time to produce a frame, but a logical timestamp must mean the same camera, trace, marker, clip, POI, widget, and media state in both modes.

The functional boundary is:

```text
Journey + replay settings + timeline + crop + output profile
                         |
                         v
                Validate and compile
                         |
                         v
                 Replay render plan
                  /              \
                 v                v
       real-time Draft       deterministic HQ
                 \                /
                  v              v
             same logical frame contract
                         |
                         v
                scene + overlays + media
                         |
                         v
               composed frame and report
```

### Functional invariants

The target system must enforce the following invariants:

1. **One logical timeline.** Start clips, waits, the main replay, stop clips, POI pauses, widget intervals, and media intervals are segments or tracks on the same absolute timeline.
2. **One pixel intent per logical time.** Every visible subsystem consumes one immutable frame intent. It cannot derive a second time from `performance.now()`, a DOM timer, `__.recorder`, Cesium flight completion, or a throttled store update.
3. **One camera pose contract.** A frame contains the effective recording pose. Cesium applies it; Cesium does not decide it during capture.
4. **Draft/HQ visual parity.** The scheduler may differ, but the frame resolver, camera sampler, track evaluators, visibility rules, and composition geometry are shared.
5. **Explicit recording-camera ownership.** Linked HQ defaults to an isolated recording render host. Main-map interaction cannot affect the export. Visible recording is an explicit mode selected before the session and fixed until it ends.
6. **Quality waiting never changes story time.** Tile or media readiness may delay production of a frame, but it does not advance or rewrite its logical timestamp or camera pose.
7. **No invisible degradation.** A frame is reported as ready, degraded, failed, or cancelled. Timeout is not silently treated as success.
8. **Authoring data is serializable.** Persisted camera paths, clips, tracks, and output settings contain no Cesium, Three.js, canvas, DOM, or encoder objects.
9. **A replay session owns its side effects.** Camera overrides, listeners, timers, render hosts, media decoders, object URLs, streams, and store projections are released on success, failure, cancellation, and scene replacement.

### User-facing capabilities

| Capability | Functional contract |
| --- | --- |
| Camera authoring | Edit a replay anchor, heading, pitch, range, trace-relative angle, and camera path without moving the geographic target accidentally. Committed map and drawer edits update the same model. |
| Timeline authoring | Arrange start, replay, wait, stop, POI, widget, and media behavior on one time axis, with continuity and overlap validation before playback. |
| Scrubbing and preview | Resolve any logical timestamp without starting timers or mutating persisted settings. A slider can drive this resolver in real time. Intermediate pointer events may be coalesced, stale scene work is cancelled, and the latest requested logical time always wins. Scrubbing shows the same logical frame that Draft and HQ will consume. |
| Draft playback | Use wall time only to select the current logical timestamp. Frames may be skipped to remain interactive, but their content is resolved from the same render plan. |
| HQ export | Iterate every required output frame, prepare resources, render, compose, and encode sequentially from an isolated recording scene. |
| Quality policy | Let the user select a named quality policy. Report readiness outcomes and degraded frames instead of hiding timeouts. |
| Monitoring | Display the latest composed frame and progress as a read-only surface outside the captured widget board. |
| Diagnostics | Produce a session summary that explains camera corrections, readiness waits, degraded resources, phase timings, and cleanup failures. |

### Authoring and execution workflow

#### 1. Capture an immutable definition

When playback or export is requested, the application snapshots the current journey revision, normalized timeline, camera settings, crop, visible layer configuration, widget configuration, and output profile. Later editor changes invalidate the plan but do not mutate a running session.

#### 2. Validate and compile a render plan

Compilation performs pure validation first:

- normalize the timeline and all absolute durations;
- validate clip order, altitude continuity, overlaps, mandatory replay track, and media ranges;
- compile journey samples and trace progress;
- compile the nominal camera trajectory and start/stop continuity;
- compile POI, widget, and media visibility tracks;
- calculate output geometry independently from browser DPR.

Camera preparation then runs as a cancellable, incremental qualification pass over bounded time windows. Scene-dependent containment, terrain, and 3D visibility observations may produce deterministic correction keyframes, but they must not be recomputed as hidden decisions inside the final capture loop. This pass must yield regularly and must not synchronously freeze Draft startup or enumerate the complete route. An interactive editing preview may display a clearly marked nominal or last-qualified plan while qualification continues. A recording session locks one plan id and qualification level before its first frame; linked Draft and later HQ parity comparisons must reuse that same camera track unless the user explicitly recompiles and accepts a new plan.

#### 3. Resolve an immutable frame intent

For any absolute timeline time, the resolver returns all data needed to produce pixels:

```js
{
  planId,
  frameIndex,
  timeMs,
  phase,
  replaySample,
  cameraPose,
  markerState,
  traceState,
  poiStates,
  widgetStates,
  mediaStates,
  outputGeometry,
  qualityRequirements
}
```

This is the visual authority. Readiness and encoder metadata belong to a separate frame result so that execution cannot mutate the intent after it was resolved.

#### 4. Apply the frame to a render host

Draft applies the intent to the interactive scene. HQ applies it to the isolated recording scene. Both use the same scene adapter and overlay evaluators. The HQ host renders at the physical target dimensions, and its viewport or off-center frustum maps exactly to the exported crop rather than asking Cesium to prepare a larger unrelated visible view.

#### 5. Prepare resources without changing logical state

The readiness coordinator observes the recording host for the exact camera, frustum, dimensions, layers, and output profile. It waits according to a bounded policy and returns a result. It cannot modify the camera or advance the timeline. Media widgets similarly seek and decode the frame for `timeMs`; a deadline miss produces a declared fallback result.

#### 6. Publish, compose, and encode

Before composition, the immutable frame intent is published to dynamic consumers and the session waits for their bounded render acknowledgement. The scene canvas, static widget layers, dynamic widget layers, and media frames are then composed in deterministic z-order at physical output resolution. The same final canvas is sent to the encoder and to the optional monitor. After composition, a separate read-only frame result is published for progress, monitoring, and diagnostics.

#### 7. Finalize and restore

The session finalizes the encoder, publishes the artifact and diagnostics, destroys the isolated host, releases media and monitor resources, clears transient store projections, and restores preview ownership. Every terminal path uses the same idempotent cleanup routine.

### Camera functional model

The camera model has three separate concepts:

- **Authored pose or path:** persisted user intent, including anchor, position mode, heading offset, pitch, range, roll generated by clips, path points, targets, easing, and duration.
- **Qualified recording trajectory:** deterministic samples after clip continuity, crop containment, and permitted terrain/visibility corrections have been applied.
- **Interactive override:** runtime-only preview ownership while the user edits or navigates. It does not modify the recording trajectory until the user commits an edit.

The first replay sample is the geographic start anchor. Ordered start clips must end on the effective first replay pose. Stop clips start from the last replay pose. Wait clips hold an already resolved pose; they do not ask the camera system to resolve the pose repeatedly for every held frame.

For #438, containment is an output-space constraint evaluated while qualifying the trajectory. If a pose cannot keep the marker inside the crop without violating configured camera limits, the plan must carry an explicit validation error or degraded decision. The final capture loop must not start a late recenter transition whose outcome depends on previous rendered frames.

### Timeline functional model

The normalized timeline contains one mandatory replay-main track and optional typed tracks:

| Track | Examples | Evaluation result |
| --- | --- | --- |
| Main replay | start clips, replay segment, waits, stop clips | phase, local time, replay progress, clip state |
| Camera | anchor, takeoff, path, orbit, landing | effective camera pose |
| POI | endpoint animation, pause owner, field mask | POI visibility and presentation |
| Widget | Stats, Profile, Arrow, other visual widgets | visibility and logical data state |
| Media | synchronized video assets | source time and decoded-frame request |
| Diagnostics | warnings and plan annotations | non-captured session metadata |

The 1.0.0 implementation does not need the complete 1.1.0 timeline editor. It does need the normalized runtime model behind an adapter from the existing start/replay/stop settings. #404 can then replace the authoring surface without replacing the runtime clock.

## Target software architecture

### Architectural layers

```text
React editors / drawer / map interaction
                |
                v
       Replay application commands
                |
                v
  Domain definitions and normalized timeline
                |
                v
        Replay plan compilation
                |
                v
       Immutable ReplayRenderPlan
                |
                v
  DraftScheduler or HqFrameScheduler
                |
                v
       ReplayFrameResolver (pure)
                |
        +-------+--------+
        |                |
        v                v
 Cesium render host   overlay/media evaluators
        |                |
        +-------+--------+
                v
          frame compositor
                |
        +-------+--------+
        |                |
        v                v
      encoder        monitor/events
                |
                v
      artifact + diagnostics + cleanup
```

The dependency direction points downward. Domain and planning code never imports React, Valtio, Cesium scene objects, DOM nodes, Mediabunny, or widget hosts.

### Core contracts

#### `ReplayDefinition`

Serializable input snapshot containing journey revision, authoring timeline, camera definition, crop, layer references, widgets, media references, and output profile. It is versioned and hashable so a prepared plan can be invalidated correctly.

#### `ReplayRenderPlan`

Immutable compiled result containing:

- normalized absolute timeline;
- replay and trace sample tracks;
- qualified camera track;
- POI, widget, and media tracks;
- scene/layer descriptor;
- output geometry and profile;
- quality policy and resource manifest;
- warnings, degraded decisions, compiler version, and source hash.

It contains plain data and pure samplers. It contains no active scene, camera, canvas, DOM node, stream, timer, or encoder.

#### `ReplayFrameIntent`

Immutable result of `ReplayFrameResolver.resolve(plan, timeMs)`. It replaces the current pattern where Draft publishes a partial `dynamicFrameState`, the Cesium adapter computes a camera later, and HQ reconstructs related state through another path.

#### `ReplayFrameResult`

Execution report containing readiness status, wait duration, rendered frame identity, overlay/media fallback status, composition duration, encoder submission status, and diagnostics. It points back to exactly one frame intent.

#### `ReplaySession`

Explicit state machine and resource owner:

```text
idle -> preparing -> ready -> rendering -> encoding -> finalizing -> completed
                    |           |           |
                    +-----------+-----------+-> cancelled / failed -> disposed
```

Pause is a scheduler state, not a second timeline. Cleanup is idempotent and always reaches `disposed`.

### Proposed module ownership

The current flat replay directory should be migrated incrementally behind existing exports. A target layout is:

```text
src/core/ui/replay/
  domain/
    ReplayDefinition.js
    ReplayTimeline.js
    ReplayCameraDefinition.js
    ReplayOutputProfile.js
  planning/
    ReplayPlanCompiler.js
    ReplayTimelineCompiler.js
    ReplayCameraTrajectoryPlanner.js
    ReplayCameraQualification.js
    ReplayTraceCompiler.js
    ReplayTrackCompiler.js
  runtime/
    ReplaySession.js
    ReplayFrameResolver.js
    DraftReplayScheduler.js
    HqReplayScheduler.js
    ReplayFramePublisher.js
  render/
    ReplayRenderHost.js
    InteractiveReplayRenderHost.js
    IsolatedHqReplayRenderHost.js
    ReplayCesiumSceneAdapter.js
    ReplaySceneReadinessCoordinator.js
    ReplayTraceRenderer.js
  composition/
    ReplayOverlayRenderer.js
    ReplayMediaFrameResolver.js
    ReplayFrameComposer.js
  export/
    ReplayExportController.js
    ReplayVideoEncoder.js
    ReplayRecordingMonitorController.js
  adapters/
    ReplayStoreProjection.js
    LegacyJourneyReplayAdapter.js
  diagnostics/
    ReplayDiagnostics.js
    ReplayQualityReport.js
```

This is an ownership map, not a requirement for one large file move. Each extraction should leave a compatibility export until consumers and tests have migrated.

### Current-to-target component map

| Current component | Target responsibility | Required change |
| --- | --- | --- |
| `ReplayVideoTimeline` and `ReplayFrameTimeline` | `ReplayTimelineCompiler` and deterministic HQ frame enumeration | Keep the useful phase math, add all typed tracks, and make Draft select time from the same normalized timeline. |
| `JourneyReplayPlaybackController` | `DraftReplayScheduler` | Keep wall-clock pacing and controls; stop deriving visual state or publishing partial frames before camera resolution. |
| `JourneyReplayRuntime.buildReplayFrameState` and `ReplayRenderModeContract` | `ReplayFrameIntent` plus `ReplayFramePublisher` | Expand the contract into the complete immutable pixel intent; make stores and recorder events projections of it. |
| `JourneyReplayCamera*` modules | Camera definition, trajectory planner, qualifier, sampler, and Cesium application adapter | Separate pure path decisions from scene observation and from `camera.setView()`. Preserve focused math modules; remove capture-time ownership competition. |
| `JourneyReplayClipController` | Timeline clip compiler and camera-track compiler | Resolve clip endpoints and holds once per plan; do not run asynchronous camera authority inside each output frame. |
| `JourneyReplaySession*` controllers | `ReplaySession` plus scene/lifecycle adapters | Replace shared mutable flags and delayed cleanup paths with one explicit owner and idempotent teardown. |
| `JourneyReplayCesiumRenderer` | `ReplayCesiumSceneAdapter` and `ReplayTraceRenderer` | Apply complete frame intents. Compile trace buffers once and avoid dynamic `CallbackProperty` evaluation during HQ capture. |
| `ReplaySceneTileReadiness` | `ReplaySceneReadinessCoordinator` owned by the HQ render host | Key readiness by exact recording view and layer revision; return declared quality outcomes; never move the preview camera. |
| `ReplayOverlayResolver`, `ReplayVideoOverlayComposer`, and `CanvasOverlayComposer` | Overlay track evaluator and final frame compositor | Preserve stable widget DOM and geometry, but resolve dynamic content only from frame intent time. |
| `ReplayDeferredExporter` | Export controller, HQ scheduler, render host, composer, and encoder adapter | Split orchestration from Cesium readiness and Mediabunny liveness. The encoder must not invent product timeline frames. |
| Valtio replay store and `__.recorder` events | `ReplayStoreProjection` and `ReplayFramePublisher` consumers | Publish canonical state outward. Neither may be read back as the visual clock. |
| `JourneyReplayRunner` | `LegacyJourneyReplayAdapter` | Isolate old profiler/editor consumers, then remove it when all consumers use the canonical publisher. |

### Scheduling model

There are two schedulers but only one timeline:

- `DraftReplayScheduler` maps monotonic wall time to timeline time. It may skip intermediate render opportunities under load. It may interpolate between qualified camera samples, but it may not create a new camera decision.
- `HqReplayScheduler` enumerates every required output timestamp from frame index and FPS. It waits for each frame result before advancing. Tile waits increase export wall time only.

Both call the same `ReplayFrameResolver`. A parity test should resolve both modes at an identical list of timestamps and compare the resulting frame intents before rendering.

Scrubbing is a third scheduling policy over the same resolver, not a third replay engine. `ReplayScrubScheduler` accepts absolute timeline requests from the slider, coalesces pointer events to at most one scene application per animation frame, cancels obsolete readiness or qualification work, and applies only the newest completed intent. On pointer release it requests one settled-quality frame for the exact selected time. It never starts the playback clock, mutates persisted camera settings, or compiles the complete trajectory.

### Recording render hosts

Use one interface with three ownership modes:

```js
ReplayRenderHost {
  prepare(sceneDescriptor, outputGeometry, signal)
  apply(frameIntent)
  waitUntilReady(qualityPolicy, signal)
  render()
  captureSource()
  dispose()
}
```

- `InteractiveReplayRenderHost` wraps the existing visible Cesium scene for normal replay and linked Draft recording.
- `IsolatedHqReplayRenderHost` owns a second hidden Cesium viewer or equivalent scene/render target for default linked HQ export.
- A visible HQ host may wrap the main scene only when the user explicitly selects visible recording before export.

The isolated host is the correct target for #458 because Cesium evaluates visibility for the camera attached to a scene. A detached `Camera` object cannot provide independent rendering or tile selection. The host must be built from the same canonical scene/layer configuration as the preview, but it owns separate Cesium objects and GPU resources. Browser HTTP caches may be reused; GPU and Cesium runtime caches must not be assumed to be shared.

Before committing to the full implementation, a capability spike must measure context creation, terrain and 3D Tiles duplication, memory pressure, context-loss behavior, exact-resolution rendering, and teardown on the supported browser matrix. Failure to allocate the isolated host must produce an explicit capability error or an announced visible-mode fallback. It must never silently export the interactive camera.

This decision supersedes the single-scene recommendation still present in `tech-doc/todo/CORE-REPLAY-VIDEO-ARCHITECTURE.md`. That recommendation cannot satisfy #458 while the user moves the preview camera during export.

### Camera planning and qualification

Camera work is split into four stages:

1. `ReplayCameraDefinition` normalizes persisted start settings, position mode, range, heading offset, pitch, roll, and optional authored path.
2. `ReplayCameraTrajectoryPlanner` produces a continuous nominal trajectory with clip endpoints and continuity constraints. It is renderer-independent.
3. `ReplayCameraQualification` evaluates crop containment and scene-dependent terrain/visibility constraints incrementally against the intended render geometry. It emits deterministic correction segments and diagnostics.
4. `ReplayCesiumSceneAdapter` samples the qualified trajectory and applies the resulting pose. It does not run candidate search, easing ownership, or transition selection.

Qualification must be cancellable and versioned. Its cache identity includes at least plan revision, journey path, camera definition, timeline, crop, output dimensions, terrain/layer revision, and relevant tileset quality settings. A coarse camera-position bucket is not sufficient to establish visual equivalence.

Qualification storage is sparse and windowed. A default implementation should retain segment coefficients and correction keyframes, evaluate nominal poses in constant or logarithmic time, and keep only a small look-behind/look-ahead working set for scene observations. Work is scheduled in short tasks with an `AbortSignal`; a new seek, definition revision, render-host replacement, or session disposal aborts stale tasks. Performance tests must prove bounded main-thread slices and bounded memory on the long reference journey before this path replaces the current camera runtime.

An emergency runtime observation may detect that the qualified result is no longer valid because a provider or scene changed. Its allowed action is to mark the frame degraded, abort under strict policy, or invalidate and requalify the plan. It must not silently create a different recording trajectory.

### Scene readiness and quality policy

The readiness coordinator belongs to the render host and evaluates only the actual recording view. The HQ render surface should use the physical output dimensions, with a viewport or off-center frustum derived from the canonical crop projection. Cesium's view-based globe and 3D Tiles readiness then observes the crop view instead of the complete interactive viewport.

The coordinator must:

- listen to public globe and 3D Tiles readiness/progress events;
- request asynchronous renders and wait for a verified render boundary;
- use separate preparation, moving-frame, and settled-segment budgets;
- classify only actual segment boundaries or held poses as settled, not every frame whose phase happens to be a clip;
- include camera pose, frustum, output dimensions, layer revision, tileset settings, and render host identity in readiness reuse;
- invalidate reuse on tile unload, layer/provider replacement, quality-setting change, context loss, or host recreation;
- return `ready`, `degraded`, `failed`, or `cancelled` with metrics;
- never lower 3D Tiles quality silently to solve waiting time.

Prewarming, when enabled, runs only on the isolated HQ host. It samples bounded future key views from the compiled camera trajectory and cannot move the interactive scene or publish replay frames.

### Trace, widgets, POIs, and media

The journey trace is compiled once into immutable route positions and progress ranges. The render adapter should update a draw range, segment visibility, or equivalent stable geometry state. The exact Cesium primitive implementation should be selected through a benchmark, but HQ must not depend on per-frame `CallbackProperty` geometry rebuilding.

Widgets remain mounted through preparation, rendering, finalization, and cleanup. Static and dynamic layers are separated. Dynamic widgets, including Stats and Profile, receive the current `ReplayFrameIntent` through `ReplayFramePublisher`; they do not subscribe to independent timers. This changes the proposed implementation direction in #450: `__.recorder` may relay frame publications for compatibility, but recorder timestamps are not the source of truth.

POI animation and pauses become timeline tracks, satisfying #395 without wall-clock collapse timers. The synchronized video widget in #398 resolves media source time from frame intent time, waits for a decoded frame under a declared deadline, and reports whether it used the requested or retained frame. The recording monitor from #459 reads the final composed canvas and session progress outside the captured board; it cannot affect composition or session pacing.

### Output profiles and encoding

Render mode and output profile remain orthogonal:

- render mode selects Draft real-time or HQ deterministic scheduling;
- output profile selects dimensions, FPS, codec preferences, bitrate policy, and quality policy.

The 4K profile from #396 supplies exact even physical dimensions through the complete plan, render host, compositor, and encoder. Capability checks happen before rendering starts. DPR is not a substitute for target resolution.

Mediabunny receives exactly one product frame for each HQ timeline frame. Codec keep-alive or backpressure workarounds may exist inside the encoder adapter, but they must not add microscopic product timestamps or change the declared video timeline. Any workaround must be verified against actual output duration, frame count, cancellation, browser playback, and memory behavior.

## Implementation plan

### Delivery rule

Do not rewrite the replay stack in one branch. Introduce contracts at existing seams, migrate one owner at a time, and keep old entry points as adapters until their consumers are proved migrated. Every phase must leave Draft playback, HQ cancellation, and scene restoration testable.

### Implementation status on `refactor/replay-architecture`

The first two Phase 1 seams are now present in the current branch:

- versioned `ReplayDefinition` and lazy `ReplayRenderPlan` contracts containing clock metadata but no materialized frame array;
- versioned `ReplayFrameIntent` and `ReplayFrameResult` plain-data contracts;
- a shared `ReplayFrameResolver` that resolves exactly one requested timestamp for Draft, HQ, or scrub;
- lightweight track-path descriptors that invalidate plans from segment identity and revisions without serializing or cloning every coordinate;
- a `ReplayFramePublisher` that distinguishes pending Draft state from the last completely resolved frame;
- Draft camera application completes and publishes the canonical frame instead of exposing a partially patched frame to captured dynamic widgets;
- HQ export publishes the same canonical intent shape after applying its effective camera pose;
- overlay resolution and captured Stats data prefer the canonical resolved publication;
- the normal replay controls expose a real-time slider backed by a coalesced, latest-request-wins scrub scheduler; synchronized recording keeps it disabled;
- unit, integration, exporter, widget-composition, and store-contract tests cover the compatibility seam.

This is a foundation, not the isolated HQ camera implementation. Scene-qualified settled scrubbing, camera qualification, and the isolated render host remain subsequent slices below. The current slider avoids input floods, resolves only the latest requested timestamp through the canonical resolver, and exposes cancellation to its adapter, but scene application still passes through the compatibility `seek()` path.

### Phase 0 — Establish evidence and split missing work

1. Create the six focused backlog items listed in the coverage-gap section and link them to #457, #458, #479, #404, #438, and #450 as appropriate.
2. Add three fixed reference journeys: simple imagery, terrain, and terrain plus 3D Tiles. Include no clips, start/wait/stop clips, narrow crop, and long replay variants.
3. Extend `ReplayVideoTraceDebug` into a structured per-session report using the instrumentation fields below.
4. Record Draft and HQ baseline videos and metrics from the current code before changing camera or readiness behavior.
5. Define product-owned continuity and performance thresholds from that baseline. Do not declare success from unit tests alone.

Exit gate: failures are reproducible, artifacts are retained, and every following phase can be compared with the same inputs.

### Phase 1 — Introduce the canonical frame seam for 1.0.0

1. Add versioned `ReplayDefinition`, `ReplayRenderPlan`, `ReplayFrameIntent`, and `ReplayFrameResult` contracts using plain data.
2. Adapt the existing `ReplayVideoTimeline`, `ReplayFrameTimeline`, logical frame, camera pose, track path, and overlay contract into one `ReplayFrameResolver` without changing UI behavior.
3. Publish a frame only after camera, marker, trace, and dynamic overlay states have been resolved. Remove the current Draft pattern that publishes a partial frame and patches its render contract later.
4. Make Valtio, Profile, Stats, POI, and recorder events consumers of `ReplayFramePublisher`.
5. Add Draft/HQ parity tests that compare frame intents at identical logical timestamps.
6. Add the timer-free scrub request API and latest-request-wins scheduler against the canonical resolver; keep scene qualification asynchronous and windowed.

Exit gate: one logical timestamp produces one complete frame intent, and no dynamic replay consumer needs its own timer.

### Phase 2 — Canonical camera and lifecycle for 1.0.0

Issues: #457 and #471.

1. Implement one persisted camera definition with start anchor, position mode, heading offset, pitch, metric range, and roll.
2. Route drawer edits, committed map edits, start planning, playback, and export through one canonical camera command/evaluator.
3. Compile start clips so their final pose exactly equals the first replay pose; compile holds as fixed poses.
4. Separate interactive override state from committed camera state and automatic replay ownership.
5. Introduce explicit `ReplaySession` ownership and gate restoration on that session, fixing replay focus leakage outside playback.
6. Add boundary tests for no clips, each start clip, wait clips, stop clips, pause, cancellation, failure, and scene replacement.

Exit gate: no unrelated pre-replay camera defines frame zero, no automatic update overwrites persisted manual settings, and cleanup cannot move the camera after the replay session has ended.

### Phase 3 — Isolated HQ render host for 1.0.0

Issue: #458.

1. Prototype `IsolatedHqReplayRenderHost` with the project's real imagery, terrain, 3D Tiles, lighting, trace, and marker configuration.
2. Measure memory, context loss, initialization, exact output dimensions, and teardown on supported browsers and representative hardware.
3. Build a canonical scene descriptor/factory so preview and HQ hosts receive equivalent layers without copying global scene objects.
4. Apply frame intents to the HQ host while leaving the interactive camera untouched.
5. Add fixed recording-mode selection, capability errors, explicit visible fallback, cancellation, completion, failure, and resource cleanup.

Exit gate: moving the visible map throughout an HQ export produces no change in frame intents or encoded camera poses, and every terminal path destroys HQ resources.

### Phase 4 — Bounded crop-aware readiness for 1.0.0

Issue: #479 plus the missing readiness-policy issue.

1. Render the isolated HQ host at the final physical dimensions and derive its viewport or off-center frustum from the canonical crop projection.
2. Replace phase-wide clip settlement with boundary/hold classification so ordinary moving clip frames cannot receive the full settled timeout.
3. Replace coarse footprint success with an exact view/layer/profile readiness identity and event-based invalidation.
4. Introduce named `strict`, `quality`, and `fast` outcomes without changing logical time.
5. Move prewarm to the isolated host and sample only bounded compiled key views.
6. Verify marker, trace, terrain, imagery, and 3D Tiles in the same post-readiness render.

Exit gate: tiles outside the recording viewport do not block export, no clip causes repeated maximum waits, and every non-ready encoded frame is declared in the session report.

### Phase 5 — Monitoring and the 1.0.0 release gate

Issue: #459.

1. Publish session phase, frame counts, elapsed export time, encoded bytes, errors, and the latest final composed canvas.
2. Implement Picture-in-Picture only behind explicit user activation and provide the transient fallback surface.
3. Keep both surfaces outside the video widget board and make closure independent from recording cancellation unless the user selects stop.
4. Release streams, tracks, canvas references, listeners, and transient state through session cleanup.

The 1.0.0 replay gate should require:

- fixed reference videos reviewed against the baseline;
- exact Draft/HQ frame-intent parity at sampled timestamps;
- no unexplained camera discontinuity at phase boundaries;
- deterministic first and last camera poses;
- no replay camera restoration outside session lifecycle;
- independent HQ output while the preview camera moves;
- bounded and reported readiness behavior;
- successful cancellation and cleanup at every export phase;
- an export timing report separated into planning, readiness, scene render, composition, and encoding.

### Phase 6 — Normalized authoring timeline for 1.1.0

Issues: #404 and #402.

1. Introduce the normalized runtime timeline and migration from existing start/replay/stop configuration before replacing the UI.
2. Add absolute clip altitude continuity and sequence validation to the compiler.
3. Build the synchronized timeline editor against the same model, including accessible overlap and continuity feedback.
4. Keep a temporary legacy serialization adapter until migrated journeys round-trip without data loss.

Exit gate: existing journeys migrate and round-trip, and Draft/HQ consume the same normalized timeline without a compatibility-only runtime clock.

### Phase 7 — Replay-synchronized tracks for 1.1.0

Issues: #395, #398, and #450.

1. Move POI animations, pause ownership, widget visibility, Stats/Profile data, and media intervals onto typed tracks.
2. Make every dynamic consumer resolve from `ReplayFrameIntent.timeMs`.
3. Add deterministic video seeking/decoded-frame readiness and explicit retained-frame diagnostics.
4. Verify stable widget mounting, capture exclusion of controls, scene replacement, and cleanup.

Exit gate: pause, seek, reverse direction where supported, Draft, and HQ show the same POI/widget/media state for the same logical timestamp.

### Phase 8 — Camera trajectory completion and 3D authoring for 1.1.0

Issues: #438 and #403.

1. Move Navigation and Dynamic crop containment into camera trajectory qualification and remove late recenter ownership from capture.
2. Validate current, predicted, final-frame, narrow-crop, and active-transition cases through deterministic trajectory tests.
3. Stabilize a pure serializable camera-path evaluator before building the Three.js editor.
4. Implement the 3D editor as an authoring adapter using local ENU coordinates and persisted WGS84 definitions.
5. Reuse the runtime evaluator for editor scrubbing; do not create a Three.js playback engine.

Exit gate: the marker remains inside the crop under the defined policy, Draft/HQ camera samples match, and saved paths contain no renderer objects.

### Phase 9 — Output and composition extensions for 1.1.0

Issues: #396, #397, and #406.

1. Add the 4K output profile only after isolated-host capability and exact-size rendering are proven.
2. Add deterministic visual widgets through the existing host and frame compositor without changing replay timing.
3. Remove obsolete CameraManager settings after all camera consumers have migrated to the canonical command and persistence model.
4. Complete the stable trace renderer and compare entity/primitive alternatives on the reference journeys before selecting the implementation.

Exit gate: 4K is either produced at the declared physical dimensions or rejected/fallen back explicitly, visual widgets remain deterministic in capture, obsolete camera settings have no consumers, and trace rendering meets the agreed continuity/performance budgets.

### Final cleanup

After both release trains have migrated their consumers:

1. Remove `JourneyReplayRunner` from replay ownership and retain only a temporary compatibility publisher if an unmigrated profiler consumer remains.
2. Remove compatibility serialization and duplicated camera constants only after migration tests prove they are unused.
3. Split the current large exporter and session controllers along the ownership boundaries above.
4. Update or retire the older replay architecture documents that conflict with the accepted render-host and frame-authority decisions.

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
