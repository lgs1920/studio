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
- it renders Cesium frames synchronously when `scene.render()` is available,
  avoiding a fixed double-`requestAnimationFrame` delay on every exported
  frame;
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

- prefer synchronous scene rendering for the map/background;
- wait for the widget publication frame during HQ export so DOM-to-canvas
  mirrors have time to refresh before encoding the frame.

This is enough for the current product goals without turning the draft flow
into a memory-heavy offline pipeline.

## 7. What still belongs to future work

The current architecture prepares the ground for later work such as:

- a dedicated multi-track widgets editor;
- more formal layer caching;
- additional export profiles;
- a more offline-style master render.

Those are valid next steps, but they are deliberately outside the current
scope.

## 8. Practical editing rules

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
