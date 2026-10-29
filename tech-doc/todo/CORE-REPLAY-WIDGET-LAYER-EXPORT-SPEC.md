# Replay Widget-Layer Export Proposal

Status: proposed architecture; implementation pending ([issue #559](https://github.com/lgs1920/studio/issues/559))

Date: 2026-10-29

## Objective

Reduce work on the Replay Cesium frame-rendering path by producing Cesium and
widget pixels as synchronized layers, while preserving the canonical Replay
frame sequence and exact output frame timestamps. Move composition, encoding,
and container finalization to a Worker where browser APIs allow it. The final
video may take longer to finalize if Cesium frame production becomes faster.

This proposal does not use real-time recording as the source of frame timing.
The requested frame rate and frame count remain controlled by the prepared
Replay video timeline.

## Current Studio pipeline

`ReplayDeferredExporter` advances the deterministic Replay export timeline,
updates the Cesium render target and widget state, captures widget canvases,
composes the visible overlays over the Cesium frame, and submits the resulting
canvas to Mediabunny. `Widget2Canvas` uses SnapDOM to rasterize widget DOM parts
and distinguishes cached static parts from dynamic parts.

This makes widget capture and composition part of the same frame loop as Cesium
rendering. The existing `CanvasSource.add()` path already uses explicit frame
timestamps and an asynchronous WebCodecs-backed encoder; moving encoding to a
Worker may improve main-thread availability, but does not automatically reduce
Cesium rendering or tile-readiness time.

Primary implementation areas:

- `src/core/ui/replay/ReplayDeferredExporter.js`
- `src/core/ui/replay/ReplayVideoTimeline.js`
- `src/core/ui/replay/ReplayRecordingPerformance.js`
- `src/core/ui/replay/ReplayOverlayResolver.js`
- `src/core/ui/widget-manager/widget-2-canvas/Widget2Canvas.js`

## Proposed frame contract

Keep one Replay frame coordinator as the only clock. For each canonical frame
`i`, it resolves the frame timestamp `t_i`, publishes the Replay sample and
widget state, resolves the Cesium scene frame, and makes both layer snapshots
available with that same timestamp and output duration.

```text
Replay frame coordinator: frame i, timestamp t_i
  ├─ Cesium render target -> Cesium-only frame i
  └─ Widget DOM/CSS state -> transparent widget frame i
             both snapshots carry timestamp t_i and duration_i
                         ↓
                 bounded transfer queue
                         ↓
        Worker composition, encoding, and finalization
```

The Worker must not advance Replay independently. Both outputs must preserve
the exact frame ordering, timestamp, duration, crop, and output dimensions from
the same Replay video timeline.

## SnapDOM and HTML-in-Canvas findings

Studio currently depends on `@zumer/snapdom` 3.4.0 and does not currently list
`@zumer/snapdom-plugins` as a dependency.

SnapDOM has two related but distinct APIs:

- In the v2 line, `html-in-canvas` was an official plugin using the experimental
  WICG element-drawing API. In v3, that plugin subpath was removed and the
  native renderer is selected through the core `engine: 'html-in-canvas'`
  option. In SnapDOM 3.4.0 this renderer is experimental and omitted from the
  default published build; enabling it requires a compatible custom build.
- SnapDOM 3.4 provides the separate `@zumer/snapdom-plugins/stream` plugin. It
  returns a live canvas, detects running CSS animations, and patches changed
  widget subtrees when its layout rules can prove a patch is safe. Otherwise,
  it captures a full frame. Its `fps` option is a cap on repaint frequency,
  driven by browser rendering opportunities.

The stream plugin therefore looks useful for a real-time widget-layer
prototype and for measuring the cost of full captures versus incremental
patches. Its `recordCanvas()` recorder uses `canvas.captureStream()` and the
browser's `MediaRecorder`; that path is real-time and does not provide the
deterministic frame timestamps required by Replay export.

The plugin's documented public API does not currently expose an explicit
`renderFrame(timestamp)` or manual-step operation. Do not assume that its
automatic animation-frame loop can produce the exact requested Replay frames.
Verify this contract against the selected plugin version before using it in the
deterministic exporter.

The direct Chrome HTML-in-Canvas API and SnapDOM's wrapper must not be treated
as interchangeable. The direct API can expose transferable `ElementImage`
snapshots in compatible Chromium implementations. SnapDOM's stream API exposes
a live canvas and dirty rectangles. Transfer cost, frame freshness, worker
support, and pixel parity must be measured for the chosen path.

## Candidate implementation paths

### A. SnapDOM stream as the live widget layer

Use the official stream plugin to keep an independent transparent widget canvas
updated as CSS animations and Replay-driven DOM state change. Transfer
snapshots to the encoding Worker and use its patch metadata where beneficial.

This is suitable only if the product accepts live timing or if a deterministic
frame-stepping adapter can be added and proven. The stock `recordCanvas()` path
must not be used for deterministic Replay export.

### B. Replay-driven SnapDOM captures

At each canonical Replay frame, publish the widget state and CSS animation
time, capture the widget layer, and transfer an immutable snapshot to the
Worker. This can preserve deterministic frame timestamps, but may retain much
of the current per-frame DOM capture cost. Benchmark the SVG engine and the
experimental HTML-in-Canvas engine rather than assuming the native engine is
faster.

### C. Direct HTML-in-Canvas integration

Place or mirror drawable widget DOM under a compatible canvas and capture the
native element snapshots for transfer to an `OffscreenCanvas` Worker. This may
avoid SnapDOM's clone-and-render pipeline, but requires a supported browser,
HTML-in-Canvas API behavior compatible with the widget DOM, and a carefully
owned paint boundary. It is a feasibility path, not an assumed implementation
choice.

The feature should select a path only after a small prototype measures widget
capture cost, transfer cost, pixel fidelity, animation behavior, and queue
back-pressure using representative Studio widgets.

## Worker responsibilities and boundaries

The main thread retains operations that require the live application:

- advancing the canonical Replay frame coordinator;
- updating Replay stores and React widget content;
- rendering and reading the Cesium export target;
- producing the current HTML-in-Canvas or SnapDOM widget snapshot.

The Worker can own operations that accept transferable frame data:

- drawing Cesium and widget snapshots into separate or final canvases;
- alpha compositing matching timestamps;
- encoding layer artifacts and/or the final video;
- container assembly, progress aggregation, and bounded output buffering.

Mediabunny `CanvasSource` accepts `OffscreenCanvas` and explicit timestamps.
WebCodecs can perform encoding asynchronously, including in Workers. The
existing encoder already uses asynchronous WebCodecs; the expected main-thread
gain must therefore be measured in composition, synchronous frame snapshot,
packet handling, and finalization work rather than attributed to codec work
alone.

Use a bounded FIFO with a small frame-count and pixel-byte limit. Apply
back-pressure before transferring another large frame. Close transferred
`VideoFrame`, `ImageBitmap`, or `ElementImage` resources at the correct owner
boundary on success, cancellation, and failure.

## Timing and CSS animation model

CSS keyframes, easing, and style declarations should remain CSS-authored. For
deterministic output, animation state must be sampled from Replay time rather
than browser wall-clock time. Each supported animation needs a defined Replay
start offset and a mapping from `t_i` to its current animation time.

The implementation may use the Web Animations API to pause and seek CSS
animations, or another explicit adapter. SnapDOM stream's automatic live loop
does not by itself establish this mapping. The capture path must wait for the
widget snapshot corresponding to `t_i` before it is paired with Cesium frame
`i`.

The output frame rate remains deterministic even if frame production and
encoding run at different wall-clock speeds. Do not substitute `MediaRecorder`
for the deterministic timestamped frame encoder.

## Output and finalization

The proposed pipeline creates Cesium-only and transparent widget-layer frame
streams concurrently from the same frame coordinator. The Worker composes
matching timestamps into the existing final video. Intermediate layers may be
temporary; whether users can download or retain them independently is a
separate product decision and must not be assumed by this proposal.

The widget intermediate must preserve alpha. MP4 should be treated as the
flattened final output unless a supported alpha-capable format is explicitly
selected. A transparent WebM/Matroska intermediate or in-memory transferable
frames are candidate representations; codec and container support must be
feature-detected.

Finalization may decode, blend, and re-encode frames after the faster Cesium
render phase. This can increase total export time and memory usage while
shortening time-to-background-video. If final composition is fed directly from
the synchronized frame queue, it may avoid a separate whole-video decode pass.

## Expected gains and limits

Potential gains:

- remove widget DOM capture and overlay composition from the Cesium output
  canvas's critical path;
- overlap Worker composition/encoding with later Cesium frame production;
- avoid SnapDOM full-tree capture when the stream plugin can safely patch only
  changed widget subtrees;
- allow a widget-layer artifact to be finalized independently from the Cesium
  render.

Limits:

- Cesium WebGL rendering, tile readiness, and DOM/CSS state updates remain
  main-thread work in the first implementation;
- the browser's main thread and GPU remain shared resources;
- CSS animation and HTML-in-Canvas paint still require a current DOM rendering
  update;
- the stream plugin's default cadence is tied to browser rendering and is not
  an exact Replay frame scheduler;
- a Worker does not guarantee higher export FPS or lower total export time;
- alpha-capable intermediate codec support varies by browser;
- a second layer introduces transfer, memory, and finalization work.

Measure at minimum Cesium render/readiness, widget state publication, SnapDOM
full and patch capture, frame transfer, Worker queue wait, composition,
encoder submission/back-pressure, total export duration, time to first
Cesium-only artifact, peak queued pixel bytes, and cancellation cleanup.

## Risks and controls

| Risk | Control |
| --- | --- |
| Layer timestamps drift | Use one frame coordinator, one ordered timestamp source, and assert matching frame counts and timestamps before finalization. |
| SnapDOM stream captures live time instead of Replay frame time | Do not use its stock real-time recorder for deterministic export; require an explicit frame-stepping proof or select another capture path. |
| Incremental patch is visually incorrect for a widget layout | Retain the plugin's full-frame fallback and compare patched frames with full captures for representative widgets. |
| Worker queue grows beyond memory limits | Bound frame count and pixel bytes; stop frame admission when full; close all transferred resources. |
| Main-thread capture remains the bottleneck | Profile widget state commit, paint, capture, and transfer separately; do not claim Worker speedups without measured results. |
| Alpha is lost in an intermediate format | Validate actual codec/container support and inspect decoded alpha before enabling the layered path. |
| CSS animation state leaks outside export | Restore original animation play state/current time after export or use isolated capture clones with explicit cleanup. |
| Cancellation leaves workers or media resources alive | Make shutdown idempotent and test success, cancellation, worker errors, and encoder errors. |

## Documentation deliverables

After implementation, update the current Replay export and widget-capture
documentation to describe:

- the common Replay frame/timestamp contract for both layers;
- CSS animation timing and supported triggers;
- Worker ownership, queue limits, and cancellation behavior;
- alpha intermediate and final output formats;
- browser/API capability detection and fallback behavior;
- which files are temporary and whether separate layer downloads are supported;
- measured gains and known limits.

Keep this proposal under `tech-doc/todo/` until the behavior is implemented.
Move or replace it with current architecture documentation under
`tech-doc/specs/` only after the implementation and its actual browser/codec
support have been verified.

## References

- [SnapDOM v3.4 changelog and v2 plugin migration notes](https://github.com/zumerlab/snapdom/blob/v3.4.0/CHANGELOG.md)
- [SnapDOM v3.4 stream plugin source and API](https://github.com/zumerlab/snapdom/blob/v3.4.0/packages/plugins/stream/README.md)
- [SnapDOM v3.4 stream implementation](https://github.com/zumerlab/snapdom/blob/v3.4.0/packages/plugins/stream/src/stream.js)
- [SnapDOM v3 migration and HTML-in-Canvas engine status](https://github.com/zumerlab/snapdom/blob/v3.4.0/CHANGELOG.md)
- [HTML-in-Canvas proposal](https://github.com/WICG/html-in-canvas)
- [Mediabunny `CanvasSource`](https://mediabunny.dev/api/CanvasSource)
- [Mediabunny media sources and alpha](https://mediabunny.dev/guide/media-sources)
- [Chrome WebCodecs and Workers](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)
