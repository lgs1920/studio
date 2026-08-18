# Replay / Video Architecture

This document explains the current replay/video architecture in English and
maps the modified files to their responsibilities.

The goal is to keep the live draft flow fast, while also supporting a higher
quality deferred MP4 export built on the same replay timeline and visibility
rules.

## 1. Big picture

The replay/video stack is split into three layers:

1. **Replay state and visibility**
   - decides which replay widgets should be visible on a given frame;
   - exposes a deterministic timeline for the replay;
   - keeps the replay controller and the recorder aligned.

2. **Render orchestration**
   - seeks the replay to an exact progress value;
   - renders the scene and overlays for that frame;
   - feeds the result either to the live recorder or to the deferred export.

3. **Video output**
   - produces the interactive live draft recording;
   - optionally generates a higher quality MP4 later;
   - exposes the final blob to download or share.

The key rule is simple:

**the rendered frame is recomputed, but the whole subsystem is not rebuilt
every frame.**

Only the pieces whose context changed are invalidated.

## 2. Runtime flows

### Live draft flow

The live draft flow starts from `VideoRecordingScreenArea`:

1. the capture UI is prepared through `prepareVideoCaptureUi()`;
2. video widgets on `VIDEO_WIDGETS_BOARD` are waited for before the recorder is
   initialized;
3. the crop zone is synced from the mounted crop element;
4. the output size is computed from crop, FPS, quality, browser, and DPR;
5. the overlay composer is built from the shared render spec;
6. the recorder starts;
7. replay sync may be armed;
8. if replay sync is enabled, a deferred export plan is prepared and warmed in
   the background.

The widget wait has one important guard: if all expected video widgets are
already ready when `preRecording` becomes true, the recorder starts immediately.
It does not wait for an additional DOM mutation. This prevents the draft from
remaining in the "starting" state when the board is already hydrated.

This keeps the draft responsive while also preparing the later HQ export.

### Repeated draft recordings

A second recording is a new capture lifecycle. It must not inherit asynchronous
work from the previous recording or from an aborted dialog:

1. abort and user dialog-close paths may schedule an asynchronous replay-scene
   restoration;
2. before initializing the recorder, `VideoRecordingScreenArea` waits for that
   restoration and verifies that its recording start token is still current;
3. when the new recorder starts, `JourneyReplayVideoSync` invalidates any
   pending scene restoration and camera flight from the previous lifecycle;
4. replay start is awaited and guarded by a capture generation, so a stale
   start cannot activate a newer recording;
5. stop-clips completion is associated with the replay `clipSequenceToken` and
   cannot stop a later recording;
6. when the replay has no stop clips, the recorder stops directly after the
   terminal frames are published instead of waiting for a clip event that will
   never arrive.

Recorder cancellation also invalidates an in-flight asynchronous start. A
`startVideo()` continuation must therefore verify its lifecycle token before
dispatching `START` or scheduling frames. This prevents the first recording's
encoder setup from turning into a second recording after an abort.

### Deferred HQ flow

When the user opens the final dialog:

1. the dialog always exposes the live recorded blob for share and download;
2. the user can start an explicit HQ creation pass from the dialog footer;
3. the dialog recomputes the current crop/render spec before export, so HQ does
   not reuse stale dimensions from the warm plan;
4. the dialog switches the app into the video finalizing state so the cropper
   and video widgets are visible to the composer, while editing menus stay
   hidden;
5. the deferred export renders the replay frame-by-frame with the current
   replay controller, a controlled export frame state, and overlay visibility
   rules;
6. while the HQ export is running, the final dialog is programmatically hidden
   without running the dialog cleanup, and the replay controls widget becomes
   the centered abort surface;
7. start and stop clip frames explicitly hide the replay marker before the clip
   camera move is rendered;
8. once the HQ blob is ready, share and download switch to the HQ version;
9. if no HQ blob exists yet, the dialog continues to use the recorded draft.

This keeps the draft cheap by default and makes HQ an opt-in action at the end.

The HQ MP4 uses the selected video FPS:

- if the video setting resolves to `30`, the export track runs at `30 fps`;
- if the video setting resolves to `60`, the export track runs at `60 fps`.

The exporter therefore emits roughly twice as many frames for `60 fps` as for
`30 fps` on the same duration, assuming the same replay length.

When the final dialog is closed by the user, the replay scene must be restored
to the normal journey scene. Programmatic dialog hiding during HQ creation does
not run that cleanup; only the user close path releases the live blob and
restores the playback scene.

## 3. File map

### `ReplayOverlayResolver.js`

Responsibilities:

- resolve whether replay-driven widgets should be visible;
- read the live replay state and controller state;
- read the controlled HQ export frame state when an offline export is running;
- normalize draft and HQ replay ticks into the same visible replay state;
- decide widget visibility for the video board;
- provide a single source of truth for replay/widget visibility.

This replaces scattered visibility checks based on React state or DOM-only
heuristics.

Dynamic widget synchronization:

- live draft replay frames are exposed through `replay.dynamicFrameState`;
- HQ export frames are exposed through `replay.deferredExportPlan.runtime.frameState`;
- `resolveReplayVisibilityState()` gives priority to the HQ frame state, then
  the live draft frame state, then the replay controller/store snapshot.

Every replay-driven widget should consume this resolver instead of subscribing
to controller events directly or running its own timer.

### `JourneyReplayPlaybackController.js`

Responsibilities:

- drive live replay playback;
- publish `liveSample` and `dynamicStatsTick` for legacy consumers;
- publish `dynamicFrameState` on each replay frame.

`dynamicFrameState` is the shared live draft tick. It includes the current
sample, progress, direction, playback flags, and frame id. Both the Profile
widget and dynamic Stats widget now react to that same store update, so they do
not drift because of different event sources.

### `ReplayFrameTimeline.js`

Responsibilities:

- convert duration + FPS into a deterministic frame sequence;
- provide exact frame indices, progress values, timestamps, and direction;
- include the final frame so end-of-replay transitions can be encoded
  explicitly.

This is the replay/video time base.

### `ReplayVideoRenderSession.js`

Responsibilities:

- seek the replay controller to the exact frame progress;
- resolve the current replay sample for that frame;
- call the render pipeline for each frame;
- emit hooks before and after rendering;
- iterate over the whole timeline for export.

This is the per-frame orchestration layer.

### `ReplayVideoRenderSpec.js`

Responsibilities:

- compute the shared draft/HQ render spec from crop, FPS, quality, DPR, and
  capture mode;
- normalize the crop rectangle once;
- provide the exact output dimensions and compositor clip used by both paths;
- keep the deferred HQ plan tied to the same dimensions as the live draft.

This is the shared video geometry contract.

### `ReplayVideoOverlayComposer.js`

Responsibilities:

- build the `CanvasOverlayComposer` overlay list for both live draft and HQ;
- resolve widget visibility through `ReplayOverlayResolver`;
- compute the same overlay metrics, scale, shadow, blur, radius, and z-order in
  both paths;
- keep replay diagnostics canvases marked `data-replay-video-overlay-canvas="true"`
  in the HQ composer even when the DOM node is hidden, so Z1/Z2 diagnostics stay
  visible in deferred exports;
- expose the shared widget readiness predicate used before recording/export.

This is the shared overlay composition adapter.

### `ReplayDeferredExporter.js`

Responsibilities:

- build a deferred export plan;
- prepare and warm the MP4 codec/config;
- capture a lightweight export context snapshot;
- invalidate the plan when the context changes;
- render the HQ MP4 with mediabunny;
- optionally download the resulting blob.

Important:

- it does not store frames as persistent assets;
- it stores only a compact export context and runtime plan;
- it can be reused from both the live draft and the final dialog.
- it must advance Cesium through `requestRender()` and an asynchronous render
  boundary. A direct `scene.render()` call must not be used as the retry signal
  of the tile-readiness loop, because it can starve network callbacks and
  produce a timeout on every frame. A controlled synchronous render is only
  acceptable as a final, non-retrying render boundary when the scene API
  explicitly supports it;
- it publishes `runtime.frameState` before each encoded frame so dynamic
  replay widgets read the same journey sample;
- it waits for widget publication before compositing, then uses the same
  `CanvasOverlayComposer` path as the live draft recording;
- it reuses the draft render spec dimensions instead of falling back to the
  full scene canvas.
- it sizes the `CanvasOverlayComposer` from the MP4 output dimensions and the
  resolved output DPR. This keeps the physical composer canvas equal to the
  encoded MP4 size even when the crop ratio and output ratio differ.

The HQ export does not rely on a free-running widget timer. Dynamic widgets are
fed by the current deterministic export frame. That keeps `dynamic-stats-widget`
and other journey-based widgets aligned with the exact MP4 frame being encoded.
Before the first deferred frame is encoded, `preparePlaybackSceneForExport()`
configures the replay sampler and calls the Cesium renderer `show()` method. The
replay data source must already exist before clip frames are rendered; creating it
inside the first captured clip frame is too late for reliable HQ composition.

For timeline clips, `renderReplayExportFrame()` seeks to the clip anchor sample
and applies the clip camera. Start and stop clip frames pass `hideCursor: true`
to the Cesium renderer, so the replay marker is not visible before the clip has
started or after the replay has ended. Stop clip frames also request a final
geometry rebuild as a static completed trace, and suppress the `remaining` trace
layer so the final clip only shows the completed replay trace with the replay
progression colors. Stop clips must not rebuild a dynamic trace and freeze it on
every captured frame, because that can remove/recreate Cesium ground polylines
while HQ capture is reading the scene. The stop-clip completed trace is rendered
as an immediate 3D polyline, slightly above the terrain and with a matching
`depthFailMaterial`, instead of a `clampToGround` ground polyline. Live replay
and normal replay frames keep the ground-clamped path. HQ stop frames also add a
projected 2D completed-trace overlay to the `CanvasOverlayComposer`, below video
widgets, so the MP4 does not depend on Cesium ground/polyline primitive readiness
for the final clip trace.

### `JourneyReplayMode.js`

Responsibilities:

- orchestrate replay playback, camera behavior, runtime clip playback, and HQ
  export frame rendering;
- prepare the playback scene for HQ export without treating programmatic dialog
  hiding as a user close;
- configure the sampler and prepare the Cesium replay renderer before deferred
  frames begin;
- render replay export frames through the same sampler/controller data as live
  playback;
- pass explicit cursor and static completed-trace flags to the renderer for
  start and stop clip frames.

Draft and HQ must use the same sampler and camera settings. If HQ needs a
frame, `renderReplayExportFrame()` seeks the active controller or sampler to the
phase progress/anchor progress instead of reconstructing a parallel replay
state.

### `JourneyReplayCesiumRenderer.js`

Responsibilities:

- draw the replay trace and marker in a dedicated Cesium data source;
- freeze dynamic trace lines when playback pauses or reaches a clip boundary;
- render stop clip frames with a static completed trace and no remaining trace,
  using a non-ground Cesium polyline so HQ capture does not wait on ground
  primitive preparation;
- expose a completed-trace video overlay for HQ stop frames by projecting the
  same replay path through the active Cesium camera;
- keep the replay marker visible only when trace entities are visible, unless a
  caller explicitly passes `hideCursor`;
- hide the marker for HQ start/stop clip frames;
- keep hidden trace entities hidden when dynamic polylines are frozen.

The marker follows the trace visibility rule. It is not an independent overlay
that can remain visible when the trace is hidden or absent.

### `JourneyStats.jsx` and `ProfileChart.jsx`

Responsibilities:

- render dynamic replay widgets from the normalized replay frame state;
- avoid widget-local replay timers;
- keep draft and HQ rendering paths aligned.

`JourneyStats.jsx` resolves dynamic metrics from the shared replay frame state.
During live draft recording it also asks `Widget2Canvas` to refresh the widget
mirror on that same tick. This is required because Stats is text-based DOM,
while Profile is already backed by an ECharts canvas. Without this explicit
publication step the live draft recorder can composite an older Stats canvas
even when the React widget has received the right replay sample.
The dynamic Stats widget therefore keeps its live mirror loop and also receives
an explicit replay-tick refresh request.

`ProfileChart.jsx` resolves the current marker and replay overlay from the same
state instead of listening to replay controller events directly. This is what
keeps the Profile marker dynamic during HQ export instead of leaving it at the
final live replay position.

### `Widget2Canvas.js`

Responsibilities:

- maintain the hidden `.lgs-widget-canvas` used by the live draft composer;
- copy nested canvas widgets directly when possible;
- snapshot DOM-based widgets through `snapdom`;
- coalesce refreshes instead of dropping updates that arrive while a snapshot
  is still running.

This matters for `dynamic-stats-widget`: replay frames can arrive faster than a
DOM snapshot completes. A new refresh requested during an active refresh is now
queued and replayed, so the draft recording gets the latest Stats state instead
of a stale mirror.

### `VideoRecordingScreenArea.jsx`

Responsibilities:

- prepare the capture UI before draft recording or snapshot capture;
- wait for expected video widgets to be ready, with an immediate readiness
  check before installing the mutation observer;
- build the shared replay video render spec;
- create the canvas compositor;
- compose overlays through `ReplayVideoOverlayComposer`;
- arm replay sync when requested;
- warm the deferred export plan at draft start.

This file is the live draft entry point.

The start gate is lifecycle-aware: it waits for pending scene restoration,
checks the current recording start token after each asynchronous preparation
step, and cancels the pending finish action when the mount-timeout dialog is
cancelled. This keeps a cancelled first attempt from completing during a later
recording.

### `JourneyReplayVideoSync.js`

Responsibilities:

- mirror recorder start, pause, resume, stop, and cancel to the replay;
- maintain a capture generation for each arm/start/stop lifecycle;
- ignore stale replay starts and stale stop-clip completion events;
- stop immediately after terminal frames when the active replay has no stop
  clips;
- disable replay continuous rendering when capture ends.

The sync object is deliberately stateful, but it must not become a second
timeline. The recorder remains the owner of capture lifecycle events and the
replay controller remains the owner of replay state.

### `JourneyReplaySessionSceneController.js`

Responsibilities:

- serialize scene restoration requests;
- expose `waitForSceneRestore()` to capture initialization;
- expose `cancelPendingSceneRestore()` when a new capture supersedes a pending
  restoration;
- ignore a stale restoration finalizer after a newer replay lifecycle starts.

Scene restoration is therefore reusable between dialog close and the next
recording without allowing an old camera restore to overwrite the new replay
scene.

### `VideoDownloadAndShareDialog.jsx`

Responsibilities:

- receive the recorded media blob;
- present the live share/download actions;
- trigger the explicit HQ creation pass from the final dialog;
- recompute the current HQ render spec immediately before launching HQ export;
- hide the dialog programmatically during HQ export without running the user
  close cleanup;
- switch the final actions to HQ once the export has completed;
- restore the normal journey scene only on the real user close path;
- keep the cleanup path coherent.

This file is the final user-facing export point.

### `videoEditingCleanup.js`

Responsibilities:

- hide non-video-board widgets when entering video editing or capture;
- hide the context menu only for capture, not for plain video editing;
- close cropper submenus (`ratioEditor`, `presetEditor`, `widgetEditor`) when a
  capture starts;
- mark `replay.mainUiHidden` while capture is active.

This helper deliberately does not hide the whole `MainUI` during the editing
phase. Context menu and double-click widget interactions must remain available
while the user is arranging video widgets.

### `Cropper.jsx`

Responsibilities:

- render the crop zone and optional ratio editor;
- render the video widget menu only while the user is editing the video layout;
- keep `VideoSceneWidgetsPortal` mounted for the video board.

The widget menu is hidden locally in `Cropper` during `preRecording`,
`recording`, `snapshot`, and `finalizing`. This is intentionally local: it must
not change `WidgetsPanel`, `DefinedCropZone`, or `VideoSceneWidgetsPortal`
semantics, because those components also participate in widget mounting and
board hydration.

### `VideoSceneWidgetsPortal.jsx`

Responsibilities:

- render video-board widgets into the crop board portal;
- rehydrate the video board while the video editor is open;
- invalidate the board runtime when the editor portal unmounts.

The portal is not used as a capture UI mask. It should not be broadened to run
because `preRecording` or `finalizing` is true; the capture flow waits for the
widgets through `VideoRecordingScreenArea`, and the widget menu visibility is
handled by `Cropper`.

### `WidgetCropper.js`

Responsibilities:

- synchronize crop dimensions from the actual crop element;
- store crop `left` and `top` relative to the board/container, not the viewport;
- preserve a crop rect that can be reused when the cropper is not mounted.

This is part of the render-spec contract: draft and HQ must use the same crop
geometry source.

### `JourneyReplayDrawer.jsx`

Responsibilities:

- expose the replay controls;
- keep the replay configuration and navigation tools available.

The drawer no longer launches HQ export directly.

### `JourneyReplayControlsWidget.jsx`

Responsibilities:

- expose replay progress while replay mode is active;
- provide the single stop action for an in-flight HQ creation pass;
- keep the widget surface minimal during export.

## 4. Context invalidation

The deferred export plan stores a compact context key. The context includes:

- capture mode;
- FPS;
- target dimensions;
- crop rectangle;
- replay direction;
- replay progress;
- replay sync state;
- visible overlay ids;
- widget signature.

The plan is reused only if the new context matches the stored one.

That is how we avoid stale HQ exports without storing the entire video or a
huge amount of frame history.

## 5. Capture UI contract

The video capture UI has two different surfaces that must not be confused:

1. **the video board and its widgets**, which must remain mountable and
   composable for draft and HQ;
2. **editing menus and drawers**, which must be hidden during capture.

Rules:

- `prepareVideoEditingUi()` hides non-video-board widgets but keeps regular
  editor interactions alive;
- `prepareVideoCaptureUi()` additionally hides the context menu, closes cropper
  submenus, and marks replay main UI as hidden;
- the widget deck/menu is hidden by `Cropper` during capture states;
- `VideoSceneWidgetsPortal` remains responsible for video-board widget
  rendering and must not be repurposed as a menu visibility switch;
- `VideoRecordingScreenArea` owns the "are video widgets ready?" gate before
  draft recording and snapshot capture;
- if expected widgets are already ready, recording starts immediately without
  waiting for another DOM mutation.

This keeps capture surfaces clean without breaking widget mounting, double
click, context menus, or replay/HQ composition.

## 6. Why this is not a full offline render farm

The architecture is intentionally light:

- it does **not** persist every frame;
- it does **not** rebuild the DOM widget tree for each frame;
- it does **not** encode multiple intermediate files just to simulate a cache.

Instead, it keeps:

- a replay timeline;
- a compact export context;
- a warm codec/config when the draft starts;
- a deterministic render session when export is requested.

Performance rule:

- prefer Cesium's `requestRender()` and the normal render loop for map and tile
  progression;
- never use synchronous `scene.render()` as a busy retry loop while tiles are
  pending;
- wait for a `postRender` boundary only after the current frame is ready;
- wait for the widget publication frame during HQ export so DOM-to-canvas
  mirrors have time to refresh before encoding the frame.

This is enough for the current product goals without turning the draft flow
into a memory-heavy offline pipeline.

## 7. HQ Cesium tile readiness and pre-warming

HQ export has a separate readiness problem from codec warm-up. The exporter
must not encode a frame while visible Cesium terrain, imagery, or 3D Tiles are
still being refined, but it must also avoid paying a full tile timeout for
every frame.

This section records the Cesium-specific analysis and the target architecture.
It is intentionally kept in the replay/video architecture document because
tile readiness affects camera ownership, frame scheduling, cache retention,
and capture correctness at the same time.

### 7.1 Current HQ readiness flow

The current HQ path is:

1. `ReplayDeferredExporter` resolves one deterministic replay frame;
2. `renderReplayExportFrame()` applies the replay sample, trace, marker, and
   camera pose;
3. `prepareReplaySceneTilesForCapture()` inspects the active Cesium scene;
4. the readiness helper checks the globe and every visible 3D tileset;
5. the exporter composes the source canvas and the overlays;
6. the encoded frame is submitted to the MP4 output.

The relevant implementation files are:

- [`ReplayDeferredExporter.js`](../../src/core/ui/replay/ReplayDeferredExporter.js)
- [`ReplaySceneTileReadiness.js`](../../src/core/ui/replay/ReplaySceneTileReadiness.js)
- [`JourneyReplaySessionPlaybackController.js`](../../src/core/ui/replay/JourneyReplaySessionPlaybackController.js)
- [`Viewer.jsx`](../../src/components/cesium/Viewer.jsx)
- [`IonLayerUtils.js`](../../src/Utils/cesium/IonLayerUtils.js)

The current helper returns `false` after its timeout and the exporter
continues. This is important for resilience, but a non-fatal timeout is not a
performance solution. If the helper spends five seconds on most frames, the
export remains unusably slow even though it eventually completes.

### 7.2 Cesium readiness semantics

Cesium exposes view-based readiness signals. They must not be interpreted as
permanent cache flags.

`Globe.tilesLoaded` means that the globe's terrain and imagery load queues are
empty for the current Cesium view. It covers the complete viewport, not the
video crop rectangle. A tile outside the crop or near the viewport edge can
keep this value `false`.

`Cesium3DTileset.tilesLoaded` means that the tileset has loaded the content
needed to meet the current screen-space-error target for the current view. A
camera move can make it `false` again even when previously visible tile
content remains resident in the tileset cache.

Neither property means:

- that all tiles along the replay path are loaded;
- that all previously displayed tiles are still resident;
- that a tile will never be refined or requested again;
- that the final crop has been independently checked.

Both properties are read-only runtime observations. The application must not
set `tilesLoaded` manually to bypass a wait. It may maintain its own
per-export residency and readiness state, but Cesium must remain the authority
on whether the current view has completed its requests.

The relevant Cesium events are:

- `globe.tileLoadProgressEvent` for terrain and imagery queue changes;
- `tileset.loadProgress` for pending and processing 3D tile counts;
- `tileset.tileVisible` for content selected for rendering;
- `tileset.tileUnload` for cache eviction;
- `tileset.tileFailed` for content failures;
- `tileset.allTilesLoaded` for completion of the current 3D tileset view.

### 7.3 Critical readiness failure: synchronous `scene.render()`

The Cesium viewer is configured with `scene.requestRenderMode = true`. In this
mode, `scene.requestRender()` asks the normal Cesium render loop to process one
render opportunity. The browser remains free to process network responses,
decoding callbacks, and timers.

The readiness helper currently contains a direct `scene.render()` path. When
the current view is not ready, the sequence can become:

```text
wait for readiness
  -> scene.render()
  -> postRender resolves the wait immediately
  -> tilesLoaded is still false
  -> scene.render() again
  -> postRender resolves immediately
  -> repeat until timeout
```

This creates a microtask-heavy loop. Network callbacks and Cesium's normal
render scheduling do not get a reliable opportunity to progress. The result
is a timeout on every frame even when the missing tile requests could have
completed normally.

There is a second problem: `scene.render()` is not a guaranteed forced render
in request-render mode. If Cesium has not marked a render as requested, it can
return without producing a `postRender` event. The helper then waits through
polling intervals without necessarily advancing the tile queues.

This direct render path can also re-enter Cesium while the camera or scene mode
is still changing. That increases the risk of camera/frustum errors such as
`A PerspectiveFrustum or OrthographicFrustum is required in 3D and Columbus
view`.

The required rule is therefore:

- use `scene.requestRender()` to advance an asynchronous readiness wait;
- use `postRender` as the proof that the requested frame reached Cesium's
  render boundary;
- do not call `scene.render()` repeatedly while a tile queue is pending;
- if a forced synchronous render is ever required, use it once at a controlled
  boundary, never as the retry mechanism.

### 7.4 The current readiness scope is wider than the crop

The current readiness check is conservative but expensive:

- it checks the complete globe viewport rather than the crop footprint;
- it checks every visible tileset found in the scene primitive collection;
- it can include a visible 3D tileset that is not materially present in the
  final crop;
- it repeats the check for every exported frame;
- it waits for a post-render boundary even when the view has not changed in a
  meaningful way.

Cesium does not expose a stable public API for the exact visible imagery tile
IDs of a crop. Reaching into private globe surface queues would be brittle and
would couple the application to Cesium internals. The first implementation
should therefore avoid pretending to have exact crop-level imagery readiness.
It should reduce unnecessary waits through cache retention, camera-footprint
reuse, event-based invalidation, and bounded time budgets.

### 7.5 Cache layers and retention policy

There are three different cache layers:

1. **Cesium terrain and imagery cache**
   - controlled in part by `globe.tileCacheSize`;
   - retains Cesium globe tile records and their associated imagery state;
   - should be enlarged for the lifetime of an HQ export and restored after
     cleanup;
   - does not make every future view ready automatically.

2. **Cesium 3D Tiles cache**
   - controlled by `tileset.cacheBytes` and
     `tileset.maximumCacheOverflowBytes`;
   - retains decoded 3D tile content until memory pressure or cache policy
     causes eviction;
   - should use a bounded export-specific increase only when memory usage is
     monitored and the device budget allows it;
   - is separate from the globe's `tileCacheSize`.

3. **Browser and PWA HTTP cache**
   - may avoid downloading the same URL again;
   - does not guarantee that Cesium will avoid parsing, decoding, uploading,
     or refining the tile again;
   - does not replace Cesium's in-memory and GPU-side retention policy.

Restoring `tileCacheSize` after export must not be treated as deleting all
loaded tiles. It restores the future eviction policy. Existing data may remain
until Cesium trims it, while the browser/PWA cache follows its own policy.

The export must never remove, destroy, or recreate a tileset merely because a
frame is being captured. A tile that is already resident should be reused by
Cesium. A tile can legitimately be requested again after eviction, a layer
replacement, a tileset destruction, a provider error, or a change in the
required screen-space-error level.

### 7.6 Dedicated HQ camera ownership

HQ should have a dedicated logical camera state, even though the application
continues to use one active Cesium camera in the main scene.

The logical HQ camera owns:

- the deterministic camera trajectory;
- the target pose for each export frame;
- the sampled future poses used for pre-warming;
- the camera-footprint key used by readiness reuse;
- the saved user camera state that must be restored after export.

A second `Cesium.Camera` object by itself is not enough. Cesium only evaluates
tile visibility and request priorities for the camera attached to the active
scene. A detached camera does not populate the scene's tile cache.

The recommended first architecture is:

```text
user camera state  -> restored before and after export
HQ logical camera  -> deterministic replay trajectory
active Scene.camera -> temporarily applies the HQ pose for Cesium loading
```

This separates ownership and timing without immediately creating a second
WebGL context.

A separate hidden Cesium scene would isolate visual camera movement, but it
would also duplicate scene setup, tileset decoding, GPU memory, and cache
management. The browser may also impose WebGL context limits. It should only
be considered if the single-scene approach cannot prevent visible camera
changes during warm-up.

### 7.7 Bounded pre-warming of future replay views

Pre-warming must not mean loading every video frame. At 30 fps, that would
create thousands of view changes and make the cache and request scheduler
compete with the actual capture.

The target is a rolling look-ahead window:

```text
current frame: 100
capture now:   100
pre-warm:      representative views 101 -> 160

current frame: 101
capture now:   101
pre-warm:      representative views 161 -> 220
```

The pre-warm scheduler should:

- sample a camera pose every 250–500 ms of replay time;
- add samples when heading, pitch, altitude, or visible footprint changes
  materially;
- keep an initial look-ahead of roughly 1 second;
- expand up to 3 seconds only when the request queues remain healthy;
- keep only 4–8 pending representative views;
- deduplicate equivalent camera-footprint keys;
- stop or reduce pre-warming when the current capture is waiting on new tiles;
- never block the first frame or the live Draft path.

The camera moves between pre-warm samples sequentially because one Cesium
scene has one active camera. The network work remains parallel inside Cesium:
each selected view can schedule multiple 2D and 3D resource requests through
Cesium's request scheduler.

Pre-warming must not compete with the current capture. If the current frame
has pending requests or its readiness budget is being consumed, the pre-warm
queue must pause until the current frame is submitted.

### Adaptive 3D detail during camera movement

Waiting for the maximum 3D Tiles detail at every video frame is too expensive
when the camera is continuously moving. `Cesium3DTileset.tilesLoaded` is tied
to the tileset's current screen-space-error target, so a camera move can
trigger a new refinement cycle even when an acceptable parent tile is already
visible.

The future HQ policy should distinguish between two states:

- **moving view**: keep the currently usable content and allow Cesium to refine
  asynchronously while the export continues;
- **settled or key view**: wait for the configured final screen-space-error
  target before capture when the frame is important enough to justify it.

The implementation may temporarily use a more permissive
`maximumScreenSpaceError` or keep Cesium's foveated and movement culling
optimizations enabled while the camera is moving. Any temporary quality change
must be restored before the next settled/key capture and after the export.

This policy must not mark a tileset as loaded manually. It only changes how
much work is requested while the camera is moving and keeps Cesium's own
`tilesLoaded` and tile events authoritative.

Running several camera mutations in parallel is explicitly forbidden. The
last camera mutation would win, request priorities would become unstable, and
the readiness result would no longer identify the view that is being captured.

For 3D Tiles, pre-warming must be driven by Cesium's tileset selection and
events. Manually fetching guessed `.b3dm` URLs is insufficient because the
tileset hierarchy, implicit tiling, refinement rules, culling, and screen-space
error determine which content is needed. Manual HTTP prefetch may populate the
browser cache but does not guarantee Cesium cache or GPU readiness.

For 2D imagery and terrain, pre-warming through the active Cesium scene is
also preferable to a raw URL fetch because Cesium must select the correct
levels and attach the imagery to the terrain tile records used for rendering.

### 7.8 Per-export residency and readiness cache

The exporter should own a short-lived readiness coordinator for one HQ pass.
It should not cache `tilesLoaded = true` forever. Instead, it should cache the
fact that a camera footprint has already been observed as ready and invalidate
that fact when the scene can no longer rely on it.

A readiness entry should contain at least:

```js
{
    footprintKey,
    sceneMode,
    cameraHeight,
    visibleTilesetKeys,
    readyAt,
    lastPostRenderFrame,
}
```

The entry must be invalidated when:

- the camera footprint changes beyond the configured tolerance;
- a visible tileset is added, removed, hidden, or shown;
- `tileUnload` reports eviction of tracked 3D content;
- `tileFailed` reports a failure;
- a globe tile progress event indicates new work for the current footprint;
- imagery or terrain providers change;
- the scene mode or render resolution changes;
- the export cache is restored or the export is cancelled.

For 3D Tiles, `tileVisible` and `tileUnload` can provide useful application
level residency observations. For 2D imagery, the public Cesium API is less
granular, so the coordinator must combine the camera footprint, the globe
queue progress event, and the enlarged globe cache rather than use private
tile IDs.

The capture decision becomes:

```text
known ready footprint + no invalidation
    -> request one render boundary and capture

new or invalidated footprint
    -> request Cesium rendering
    -> wait for progress/events up to a short budget
    -> capture the best available frame and continue if the budget expires
```

This removes the current five-second full-scene wait from every frame while
preserving a readiness check when the camera actually enters new content.

### 7.9 Atomic marker and trace capture

Tile readiness and replay geometry readiness are separate concerns, but they
must be completed before the same capture boundary.

For every HQ frame:

1. resolve the logical replay sample and camera pose;
2. update the marker and trace from that same sample;
3. apply the HQ camera pose;
4. request Cesium rendering asynchronously;
5. wait for the required tile readiness budget;
6. wait for the `postRender` boundary associated with that pose;
7. compose and encode the canvas.

The marker must never be rendered for sample `N + 1` while the trace still
represents sample `N`. The trace must also not be destroyed and recreated on
every frame merely to update its endpoint. Dynamic geometry should be updated
in place or reused, and the readiness coordinator must not trigger an
additional scene replacement pass.

### 7.10 Failure and timeout policy

A tile timeout is a frame-level degradation signal, not a reason to abort the
whole replay export.

When a bounded wait expires:

- record the frame index, camera footprint, globe queue state, and tileset
  progress state;
- keep the current Cesium cache and tileset instances alive;
- encode the current rendered frame or the last stable frame according to the
  selected export policy;
- continue with the next replay frame;
- keep testing later frames when their footprint or tile state changes;
- do not permanently disable readiness checks after one timeout.

Repeated timeouts must be visible in diagnostics, but they must not create a
new five-second delay for every subsequent frame without evidence that the
camera entered new content.

The recommended readiness budgets are:

- known, valid camera footprint: 0–250 ms for the post-render boundary;
- new camera footprint: 500–1000 ms for tile progress;
- settled/key frame: the configured final-quality budget when the export policy
  explicitly requests maximum detail;
- timed-out frame: continue immediately with the best stable content available.

These are budgets, not sleeps. A readiness event or a completed `postRender`
must release the frame as soon as the required state is available.

### 7.11 Runtime readiness controls

Replay settings expose a controlled readiness contract instead of forcing one
fixed HQ policy on every export. The normalized configuration is:

```js
{
    enabled: true,
    policy: 'adaptive',
    knownFootprintTimeoutMs: 250,
    movingTimeoutMs: 1000,
    settledTimeoutMs: 5000,
    prewarmEnabled: true,
}
```

The supported policies are:

- `off`: do not block frame capture on tile readiness; camera pre-warming can
  still remain enabled independently;
- `adaptive`: use shorter budgets while the camera moves and the settled
  budget for key frames;
- `strict`: use the complete frame budget for every new footprint;
- `custom`: use the configured moving and settled budgets directly.

The setting is intentionally split into two concepts. `enabled` controls
whether the readiness gate is used. The coordinator's internal invalidation
state remains active so tile unloads, failures, source changes, and new Cesium
work can invalidate a previously ready footprint when readiness is enabled
again.

The Replay drawer also exposes the camera playback setting
`camera.playback.tilePreloadHorizonMs`. It controls how far ahead the HQ
camera path is sampled for bounded tile pre-warming. A value of zero disables
pre-warming without disabling readiness for the current frame.
The current implementation applies this lookahead to the initial export prefix;
it does not walk the complete replay before encoding starts.

The drawer's `Wait for visible tiles` switch is the master switch for both
features. While it is enabled, readiness policy and camera pre-warming can be
disabled independently. When the policy is `off` and the preload horizon is
zero, the drawer automatically turns the master switch off. Re-enabling the
master switch restores the safe defaults (`adaptive` readiness and a 1-second
preload horizon), so the switch cannot appear enabled while both mechanisms
are inactive.

Adaptive budgets use deterministic replay progress rather than wall-clock
export time. The coordinator classifies camera movement as `slow`, `normal`,
`fast`, or `jump` and scales only the non-settled moving budget. The default
configuration remains readiness-enabled and adaptive, so existing exports keep
their quality gate while avoiding a full wait for every unchanged footprint.

### 7.12 Required diagnostics

The readiness coordinator should publish per-frame timing data for at least:

- time spent before readiness;
- time spent waiting for a tile event;
- time spent waiting for `postRender`;
- initial and final `globe.tilesLoaded` values;
- globe tile queue progress when available;
- each visible tileset's `tilesLoaded` value;
- each visible tileset's pending and processing counts from `loadProgress`;
- whether the footprint was reused or invalidated;
- whether the frame timed out;
- whether a tile failure or unload caused invalidation.

This separates four different performance problems that must not be confused:

1. network download latency;
2. Cesium tile processing and GPU upload;
3. readiness scheduling or event-loop starvation;
4. overlay composition and canvas encoding.

### 7.13 Target acceptance criteria

The future implementation is acceptable only when:

- 2D and 3D tiles use the same readiness contract;
- the readiness loop never calls synchronous `scene.render()` repeatedly;
- a pending network request gets normal browser and Cesium scheduling time;
- a tile already resident in Cesium is not intentionally removed or recreated
  between frames;
- readiness is reused for an unchanged camera footprint;
- readiness is invalidated after relevant tile unloads, layer changes, or
  camera-footprint changes;
- one timeout does not abort the export or disable all later checks;
- the marker and trace come from the same logical replay sample;
- the HQ camera is independent from user camera state;
- pre-warming is bounded and never blocks Draft startup or the first HQ frame;
- memory usage remains bounded for both 2D and 3D caches;
- diagnostics identify whether a delay came from network, processing,
  scheduling, or composition.

## 8. What still belongs to future work

The current architecture prepares the ground for later work such as:

- a dedicated multi-track widgets editor;
- more formal layer caching;
- additional export profiles;
- a more offline-style master render.

Those are valid next steps, but they are deliberately outside the current
scope.

## 9. Practical editing rules

When changing this area, prefer these rules:

- keep replay visibility logic in `ReplayOverlayResolver`;
- keep frame progression logic in `ReplayFrameTimeline`;
- keep per-frame orchestration in `ReplayVideoRenderSession`;
- keep export planning and codec prep in `ReplayDeferredExporter`;
- keep live recorder behavior generic in `ScreenMediaRecorder`;
- keep the dialog as a consumer of the export result, not as the exporter.
- keep the HQ stop control in the replay widget, not the drawer or dialog.
- keep widget-board hydration in `VideoSceneWidgetsPortal`; do not use that
  component to hide editing menus.
- hide the video widget menu locally in `Cropper`, because that is where the
  menu is rendered.
- keep the draft start gate in `VideoRecordingScreenArea`; it must handle both
  "widgets already ready" and "widgets become ready later".
- keep marker visibility in `JourneyReplayCesiumRenderer`, derived from trace
  visibility plus explicit clip overrides.
- when HQ export starts, restore the editor/cropper surface so the user can
  abort from the same visual context they started from.
- distinguish a user dialog close from a programmatic HQ hide; only the user
  close path should release the live blob and restore the replay scene.
- keep Cesium tile readiness in a short-lived HQ coordinator rather than in the
  generic recorder;
- use `requestRender()` for asynchronous tile progression and keep synchronous
  forced rendering outside readiness retry loops;
- treat 2D globe cache, 3D tileset cache, and browser/PWA HTTP cache as
  separate layers;
- pre-warm representative future camera footprints through a bounded rolling
  queue, never every video frame;
- keep the logical HQ camera separate from user camera state, while using the
  active Cesium scene camera to populate Cesium's view-dependent caches;
- never set Cesium's read-only `tilesLoaded` property manually;
- keep tile timeout handling frame-local and non-fatal, with later readiness
  checks still enabled after a timeout.
