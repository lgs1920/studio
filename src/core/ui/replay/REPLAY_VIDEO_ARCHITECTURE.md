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

1. the crop zone is read;
2. the output size is computed from crop, FPS, quality, browser, and DPR;
3. the overlay composer is built;
4. the recorder starts;
5. replay sync may be armed;
6. if replay sync is enabled, a deferred export plan is prepared and warmed in
   the background.

This keeps the draft responsive while also preparing the later HQ export.

### Deferred HQ flow

When the user opens the final dialog and clicks download or share:

1. the dialog checks whether a replay deferred export plan exists;
2. if yes, it launches the HQ export path;
3. the deferred export renders the replay frame-by-frame with the current
   replay controller and overlay visibility rules;
4. the resulting MP4 blob is either downloaded or shared;
5. if no replay export plan exists, the dialog falls back to the recorder blob.

This means the final dialog can prefer HQ output without forcing the live draft
to become expensive.

## 3. File map

### `ReplayOverlayResolver.js`

Responsibilities:

- resolve whether replay-driven widgets should be visible;
- read the live replay state and controller state;
- decide widget visibility for the video board;
- provide a single source of truth for replay/widget visibility.

This replaces scattered visibility checks based on React state or DOM-only
heuristics.

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

### `VideoRecordingScreenArea.jsx`

Responsibilities:

- compute the live recording output size;
- create the canvas compositor;
- filter overlays for the live recorder;
- arm replay sync when requested;
- warm the deferred export plan at draft start.

This file is the live draft entry point.

### `VideoDownloadAndShareDialog.jsx`

Responsibilities:

- receive the recorded media blob;
- decide whether the final action should use the recorder blob or the replay
  HQ export;
- download or share the selected media;
- keep the cleanup path coherent.

This file is the final user-facing export point.

### `JourneyReplayDrawer.jsx`

Responsibilities:

- expose the replay controls;
- offer an explicit master MP4 export action;
- delegate the real work to the replay deferred exporter.

The drawer is a convenience entry point, not the core export system.

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

## 5. Why this is not a full offline render farm

The architecture is intentionally light:

- it does **not** persist every frame;
- it does **not** rebuild the DOM widget tree for each frame;
- it does **not** encode multiple intermediate files just to simulate a cache.

Instead, it keeps:

- a replay timeline;
- a compact export context;
- a warm codec/config when the draft starts;
- a deterministic render session when export is requested.

This is enough for the current product goals without turning the draft flow
into a memory-heavy offline pipeline.

## 6. What still belongs to future work

The current architecture prepares the ground for later work such as:

- a dedicated multi-track widgets editor;
- more formal layer caching;
- additional export profiles;
- a more offline-style master render.

Those are valid next steps, but they are deliberately outside the current
scope.

## 7. Practical editing rules

When changing this area, prefer these rules:

- keep replay visibility logic in `ReplayOverlayResolver`;
- keep frame progression logic in `ReplayFrameTimeline`;
- keep per-frame orchestration in `ReplayVideoRenderSession`;
- keep export planning and codec prep in `ReplayDeferredExporter`;
- keep live recorder behavior generic in `ScreenMediaRecorder`;
- keep the dialog as a consumer of the export result, not as the exporter.

