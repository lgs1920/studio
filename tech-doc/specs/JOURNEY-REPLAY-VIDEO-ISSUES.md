# Replay / Video / Widgets — Reanalysis and Refactoring Proposal

> Date: 2026-07-14
> Working branch: `fix-replay`
> Comparison baseline:
> - current branch: `1.0.0-beta.3`
> - video simplicity reference: `1.0.0-beta.2`

## 0. Current review status

The first correction pass already introduced several useful building blocks:

- a centralized replay/video visibility resolver;
- a final-frame capture before stopping the recorder;
- a frame-by-frame rendering foundation with `ReplayFrameTimeline` and `ReplayVideoRenderSession`;
- an initial `ReplayDeferredExporter` layer for structuring deferred master exports;
- a `runReplayDeferredMp4Export` path that already produces and downloads a master MP4;
- a `warmReplayDeferredExportPlan` warmup started when the draft begins to pre-resolve the codec and configuration;
- a lightweight context fingerprint (`contextKey`) to invalidate a plan whenever the crop or overlays change.

The correct reading is therefore no longer “everything has to be invented”, but:

**the foundation is in place; the target architecture and export path still need to be decided.**

### 0.1. Repeated-recording stabilization

The second-recording freeze was narrowed to a lifecycle race rather than a
missing replay frame:

- the previous abort or dialog close could still be restoring the replay scene;
- a new recording could start while that restoration was still pending;
- a delayed replay start or stop-clips completion could then affect the newer
  recording;
- the recorder could also finish an asynchronous start after cancellation.

The stabilization now gives each capture a generation and each replay run a
sequence token. Scene restoration is shared and awaited, pending restoration
can be superseded by the next capture, and stale start/stop callbacks are
ignored. A replay without stop clips stops directly after its terminal frames.
The recorder also has a timer fallback for frame scheduling and invalidates
asynchronous starts on cancellation.

The focused regression coverage currently includes:

- replay video sync with and without stop clips;
- recorder startup cancellation and restart;
- recording-screen-area initialization and widget readiness;
- recorder and replay trace-buffer behavior.

The full repository suite still contains unrelated failing UI/replay tests and
is tracked separately from this lifecycle correction.

## 1. Subject

The visible problem is a synchronization gap between:

- the journey replay;
- the captured video;
- video widgets, especially dynamic statistics widgets and end-of-replay widgets.

The conclusion of this reanalysis is:

**the problem is not an isolated widget bug.**

It is an architectural problem: **there is no single frame source of truth for the replay, video, and overlays.**

## 2. What the comparison with `1.0.0-beta.2` shows

### `beta.2`: simple video stack

In `1.0.0-beta.2`, the video stack was still relatively simple:

- `VideoRecordingScreenArea` prepared the crop, `CanvasOverlayComposer`, and `ScreenMediaRecorder`;
- `ScreenMediaRecorder` encoded according to its own real-time clock;
- `Widget2Canvas` already mirrored the DOM to a canvas;
- the `JourneyReplayPlaybackController` / `JourneyReplayMode` / `JourneyReplayVideoSync` layer did not yet exist;
- there was no functional split between the dynamic progression widget and the end-of-replay widget;
- there was no `captureMode: quality` with `frameCaptureReady`.

In short: **video was generic, without specialized replay orchestration.**

### `beta.3`: replay/video orchestration added

Since `beta.2`, several layers have been added:

- `JourneyReplayPlaybackController`;
- `JourneyReplayMode`;
- `JourneyReplayVideoSync`;
- `replayStatsWidgetUtils`;
- `DynamicStatsWidget`;
- `captureMode` `speed` / `quality`;
- replay visibility logic in `JourneyStats`.

The additions are not inherently wrong.

The problem is that they introduced **multiple temporal and visual authorities without unifying them.**

## 3. Current diagnosis

Synchronized replay/video capture currently depends on five different mechanisms:

| Block | Role | Source of truth |
|---|---|---|
| `JourneyReplayPlaybackController` | Advances the replay | Replay clock |
| `ScreenMediaRecorder` | Decides when a video frame is encoded | Recorder clock |
| `CanvasOverlayComposer` | Composes the scene and overlays | Its own composition loop |
| `Widget2Canvas` | Converts the widget DOM into a canvas | Observer / rAF / asynchronous snapshot |
| `JourneyStats` + `replayStatsWidgetUtils` | Decides whether a widget is visible | React replay store |

These five blocks do not work on a shared frame.

### Consequence 1: logical visibility != composed overlay

The statistics widget is hidden on the React side in `JourneyStats`, but:

- `buildComposerOverlays` does not filter overlays through an explicit visibility authority;
- it takes every available `.lgs-widget-canvas`;
- `Widget2Canvas` keeps a mirror canvas that may still contain the last visible state.

The result is:

- when the widget appears, video waits for the mirror canvas to reflect the new state;
- when it disappears, video may continue drawing an already-generated canvas.

### Consequence 2: visibility gating uses a throttled store

The video widget decides its visibility with `shouldShowVideoStatsWidget({mode, replay})`, based on replay store fields.

In `JourneyReplayPlaybackController`:

- `liveSample` is updated very frequently;
- but `progress`, `durationMillis`, and the published `sample` are synchronized to the store at `STORE_SYNC_INTERVAL = 250 ms`.

As a result:

- the map, camera, and some live calculations may be up to date;
- the decision to show or hide a widget may be delayed.

### Consequence 3: `quality` is not truly deterministic rendering

The `quality` mode is a useful improvement, but it does not solve the core issue.

Why:

- `ScreenMediaRecorder` still timestamps frames from `performance.now()`;
- `frameCaptureReady` improves composition readiness before encoding;
- but replay, recorder, and widgets still do not share a single frame timestamp calculated upstream.

Therefore, `quality` reduces some gaps **without turning capture into deterministic frame-by-frame export.**

### Consequence 4: the end of replay remains fragile

The end of replay combines several operations:

- switching from the dynamic widget to the end widget;
- optionally running stop clips;
- automatically stopping the recorder;
- restoring the scene.

This area is structurally fragile because it still relies on a chain of events rather than an explicit final-frame state.

## 4. What to retain from `beta.2`

The answer is not to revert to `beta.2` wholesale.

However, its separation principle should be restored:

- the video stack should remain generic;
- replay logic should not be spread across the recorder, compositing, and widgets at the same time.

In other words:

**`beta.2` is the right mental model for video.**
**`beta.3` contains the right replay functional needs, but not yet the right architectural boundary.**

## 5. Refactoring recommendation

### Guiding principle

Introduce **one shared frame timeline** for everything related to replay/video export.

Each frame must produce one authoritative state:

- `frameIndex`;
- `frameTimeMs`;
- `progress`;
- replay `sample`;
- camera state;
- list of visible overlays;
- logical state of video widgets.

Only then should the system render:

1. the scene;
2. the widgets and overlays;
3. the video frame.

### Proposed building blocks

#### A. `ReplayFrameTimeline`

Responsibilities:

- convert replay duration and FPS into a deterministic frame sequence;
- provide an exact `progress` value for every frame;
- serve both the live draft and deferred export.

Conceptual example:

```js
{
  frameIndex: 137,
  frameTimeMs: 4566.67,
  progress: 0.7611,
  sample: {...},
}
```

#### B. `ReplayOverlayResolver`

Responsibilities:

- decide which widgets exist on a frame;
- decide which widgets are visible;
- provide their mode and order;
- produce an explicit contract for the composer.

Important:

**visibility must no longer be inferred merely from the existence of a `.lgs-widget-canvas`.**

The mirror canvas is a rendering mechanism, not the functional authority.

#### C. `ReplayVideoRenderSession`

Responsibilities:

- take a timeline frame;
- position the replay at the exact `progress`;
- render the scene;
- refresh the required overlays;
- compose the frame;
- send the frame to the recorder or exporter.

This session becomes **the single replay-to-video rendering orchestrator.**

## 6. Architectural impact

### Components that should remain generic

- `ScreenMediaRecorder`;
- `CanvasOverlayComposer`;
- `Widget2Canvas`.

These components should remain reusable, without replay-specific business rules.

### Logic that should become replay-specific

- determining the `progress` to render;
- selecting visible widgets;
- transitioning from the dynamic widget to the end widget;
- determining the exact end of capture;
- handling end-of-replay states with or without stop clips.

This logic should live in an explicit replay/export layer rather than being distributed across multiple UI files.

## 7. Concrete implementation proposal

### Phase 1 — Short-term stabilization

Objective: fix the main symptom without a full refactor.

Actions:

1. add an overlay visibility authority that `buildComposerOverlays` can use;
2. filter video widgets through that authority before `composer.addOverlay(...)`;
3. base that authority on the replay live signal, not only on `replay.progress` throttled to 250 ms;
4. treat the end of replay as an explicit state rather than a simple event sequence.

This phase fixes the most visible delay, but **is not sufficient to make export fully robust.**

### Phase 2 — Extract the replay-to-video contract

Objective: move the logic out of React widgets.

Actions:

1. create a replay/video overlay resolver;
2. stop making appearance and disappearance logic depend only on `JourneyStats`;
3. keep `JourneyStats` as a view, not as the export source of truth.

### Phase 3 — Deterministic frame-by-frame rendering

Objective: one exported frame equals one replay `progress` value.

Actions:

1. introduce explicit per-frame rendering;
2. calculate `progress` from `frameIndex`;
3. seek the replay before rendering the scene;
4. rebuild overlays for that frame;
5. encode only that frame.

### Phase 4 — Deferred high-quality export

Objective: produce a much cleaner final video than live capture.

Actions:

1. record or reconstruct the replay/video context afterward;
2. run an offline rendering session;
3. output at high resolution and quality without depending on real time.

### Phase 5 — Explicit draft/master separation

Objective: avoid imposing the same constraints on live capture and final export.

Actions:

1. keep the current flow as `Live Draft`;
2. warm up the `Deferred Master` as soon as the draft starts;
3. reuse the same timeline and visibility rules in both modes;
4. isolate the points where image quality, frame rate, and resolution diverge;
5. store only a minimal context, never intermediate frames.

## 8. Response to the “live draft + deferred HQ export” need

The stated need is valid and should be included in the design immediately.

Two separate modes are recommended, built on the same timeline.

### Mode A — `Live Draft`

Purpose:

- immediate feedback;
- fast video;
- sufficient quality for validation.

Characteristics:

- may remain based on real time;
- accepts more trade-offs;
- must still use the same overlay visibility logic as the final render;
- may warm up the master export without waiting for recording to finish.

### Mode B — `Deferred Master Export`

Purpose:

- exportable final video;
- very high quality;
- perfect scene / replay / widget synchronization.

Characteristics:

- no real-time clock as an authority;
- frame-by-frame rendering;
- higher resolution and frame rate;
- fully deterministic stops, transitions, and replay completion;
- export context resolved on demand, with invalidation if the replay or widgets change.

The correct direction is therefore:

**live capture = draft**
**deferred export = master**

Not the other way around.

### Practical implication

The current video flow must not be forced to become the final export. It should remain:

- quick to launch;
- easy to troubleshoot;
- good enough to validate replay and widgets.

The deferred export must be able to:

- replay the timeline without depending on real time;
- wait for heavy resources when necessary;
- encode as cleanly as possible, even if it takes longer.

## 9. File impact

### Keep as the foundation

- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`;
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`;
- `src/core/ui/screen-media-recorder/recorder/ScreenMediaRecorder.js`;
- `src/core/ui/widget-manager/widget-2-canvas/Widget2Canvas.js`.

### Review structurally

- `src/core/ui/replay/JourneyReplayVideoSync.js`;
- `src/core/ui/replay/JourneyReplayPlaybackController.js`;
- `src/components/Stats/JourneyStats.jsx`;
- `src/components/Stats/replayStatsWidgetUtils.js`.

### Ideally add

- `src/core/ui/replay/ReplayFrameTimeline.js`;
- `src/core/ui/replay/ReplayOverlayResolver.js`;
- `src/core/ui/replay/ReplayVideoRenderSession.js`;
- `src/core/ui/replay/ReplayDeferredExporter.js`.

## 10. Recommended test strategy

There are already useful tests for:

- logical widget visibility;
- `JourneyReplayVideoSync`;
- `Widget2Canvas`.

What is missing is the decisive test level: **the exported frame**.

Add:

1. tests for `frameIndex -> progress -> sample` mapping;
2. tests for overlay visibility at exact boundaries;
3. replay completion tests with and without stop clips;
4. integration tests for a composed frame with scene and widgets;
5. eventually, deferred export tests over a short deterministic sequence.

## 11. Recommended decision

The recommendation is not to patch the existing system around `JourneyStats` and the mirror canvas.

The recommendation is to:

1. **use the simplicity of `beta.2` video as the foundation**;
2. **rebuild replay/video integration around one frame timeline**;
3. **prepare the `Live Draft` / `Deferred Master Export` separation immediately**.

A quick correction remains possible.

However, if the goal is to make replay video reliable and prepare the way for high-quality deferred export, **refactoring the replay-to-video contract is the right direction.**

## 12. What remains to be done

### Short term

1. validate in the field that the end-of-replay statistics widget disappears and reappears on the correct frame;
2. verify that the final frame encoded before `stopVideo()` matches the final replay state;
3. keep `ReplayOverlayResolver` as the decision source for video overlays;
4. verify that a warmed export plan is reused only when the context has not changed.

### Medium term

1. connect `ReplayVideoRenderSession` to a complete exportable rendering path;
2. factor out an explicit frame contract for live capture and deferred export;
3. document `Live Draft` versus `Deferred Master Export` in the product flow.

### Later

1. implement a complete post-process replay/video export independent of real time;
2. support high-quality rendering without real-time constraints;
3. preserve compatibility with the current video flow for quick capture;
4. avoid persistent storage of intermediate frames while the context is sufficient.

## 13. Recommended split to avoid the cost of complete frame-by-frame rendering

The right model is not to re-render the entire pipeline on every frame.
The right model is layered rendering with caching and selective invalidation.

### Layer 1 — Replay background

Responsibilities:

- calculate the camera position;
- draw the Cesium background, route, and replay markers;
- follow the frame `progress`.

Characteristics:

- dynamic on the timeline;
- not persistent as a raw image;
- must remain derived from `frameIndex` or `progress`.

Useful cache:

- camera presets;
- trace geometries or data;
- stable replay state that does not change on the next frame.

### Layer 2 — Composed scene

Responsibilities:

- display the game/map scene;
- integrate elements that depend on the current replay;
- apply the required transitions.

Characteristics:

- more expensive than the background;
- may be recomposed only when replay changes on that frame;
- must not recalculate stable elements unnecessarily.

Useful cache:

- last applied sample;
- replay state hash;
- last valid scene render.

### Layer 3 — Widgets and overlays

Responsibilities:

- display only the widgets visible on that frame;
- distinguish dynamic, semi-dynamic, and static widgets;
- remove anything that must not appear in the video.

Characteristics:

- some widgets change every frame;
- others change only at a replay threshold;
- static widgets should be served from a cache while their context is unchanged.

Useful cache:

- already-rendered mirror canvas;
- visibility fingerprint;
- layout or crop fingerprint;
- widget content signature.

### Revalidation rule

Recalculate a layer only when its context input changes.

Examples:

- `progress` change: redraw background, scene, and dynamic widgets;
- crop change: invalidate the scene and affected overlays;
- widget visibility change: invalidate only the overlay layer;
- identical static widget: keep it as is.

### What this avoids

This avoids:

- rebuilding every widget on every frame;
- restarting a complete DOM-to-canvas render when nothing changed;
- storing a video or intermediate frames to simulate a cache.

### Architectural translation

The pipeline must distinguish:

1. `frame state` — what changes per frame;
2. `layer cache` — what can be reused;
3. `render invalidation` — what forces a redraw;
4. `export plan` — what prepares the export without consuming frames.

In other words:

**the output frame is recalculated, but not the entire subsystem.**
