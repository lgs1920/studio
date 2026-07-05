# ScreenMediaRecorder

This document describes the current recording pipeline used by the studio video tools.
It covers the recorder itself, the canvas compositor that feeds it, the sizing policy for retina/mobile devices, the
browser codec strategy, and the metadata exposed to the final dialog.

This README is intentionally practical. It documents what the code does today, not an idealized design.

## Scope

Main files involved in recording:

- `src/core/ui/screen-media-recorder/recorder/ScreenMediaRecorder.js`
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`
- `src/components/MainUI/video/VideoDownloadAndShareDialog.jsx`
- `src/components/MainUI/video/RecordingInfo.jsx`

For the compositor internals, see also:

- `src/core/ui/screen-media-recorder/composer/README.md`

## Current pipeline

The recording flow is:

1. `VideoRecordingScreenArea` resolves the crop area and user settings.
2. It computes a bounded output size from crop dimensions, FPS, quality, browser, and device DPR.
3. `CanvasOverlayComposer` renders the scene crop plus UI overlays into a dedicated output canvas.
4. `ScreenMediaRecorder` uses that composed canvas as the source for `mediabunny` `CanvasSource`.
5. The recorder writes MP4 data into a `BufferTarget`.
6. The final dialog reads `mediaData` from the recorder and exposes preview, download, share, and recording stats.

This is a real-time recorder. It does not intentionally build a delayed frame queue to preserve every frame under
encoder pressure. The priority is:

- keep the UI responsive,
- keep real-time duration coherent,
- avoid memory blowups,
- finalize into a normal MP4 file.

## Why the recorder works this way

Several more aggressive strategies were tested and rejected:

- writing progressively to OPFS during recording:
  - lower RAM,
  - but too much performance cost in the current browser matrix.
- building a delayed video queue to preserve every frame:
  - smoother motion on paper,
  - but unacceptable lag, long catch-up phases, and poor Firefox behavior.
- pushing multiple logical frames from one rendered canvas state:
  - improved nominal FPS counters,
  - but could visually freeze motion near the end of the video.

The retained model is closer to the beta behavior:

- capture in real time,
- gate capture by the user-selected FPS,
- do not `await` encoder writes in the frame loop,
- wait for in-flight writes only when stopping.

## Capture modes

The recorder now accepts an internal `captureMode` flag:

- `speed` keeps the current real-time behavior and is the default.
- `quality` waits for the next ready frame before snapshotting and keeps the replay publication cadence aligned with the selected FPS.

This mode is intentionally kept out of the visible UI for now. It is wired through the recorder and replay sync path so it can be re-enabled later without changing the capture contract again.

## Recorder behavior

### Source types

`ScreenMediaRecorder` supports:

- composed canvas recording for video,
- stream-to-canvas recording,
- canvas snapshot capture for still images.

Video recording in the studio path uses the composed canvas.

### Frame scheduling

The recorder uses `requestAnimationFrame` and a target frame interval:

- `#frameIntervalMs = 1000 / fps`
- `#nextFrameDueMs` tracks when the next frame may be submitted

If the current tick arrives too early, the recorder skips submission and schedules the next tick.
If it is due, it submits one frame to `CanvasSource.add(...)`.

Important detail: frame submission is not awaited inside the render loop.
Instead, the resulting promise is stored in `#pendingFrameWrites`.

This avoids stalling the main capture loop on encoder backpressure, while still allowing the recorder to wait for all
pending writes during finalization.

### Stop / finalize

When `stopVideo()` runs, the recorder:

1. stops scheduling,
2. waits for all pending frame write promises,
3. closes the `CanvasSource`,
4. finalizes the `Output`,
5. creates the MP4 `Blob` from `BufferTarget.buffer`,
6. dispatches the `video/stop` event with final media data.

This is why finalization can be noticeably expensive, especially on Firefox with VP9.

### Metrics emitted by the recorder

The recorder exposes:

- `fps`: target FPS chosen by the user
- `currentFps`: short-window live FPS estimate during recording
- `averageFps`: real average FPS over the captured duration
- `duration`
- `size`
- `codec`
- `dimensions`

`averageFps` is the value that should be treated as the truthful final FPS for the saved clip.

## Browser codec policy

Codec selection is explicit and intentionally conservative:

- Firefox: `vp9` only
- Chromium browsers (`Chrome`, `Edge`, Android Chromium): `avc`, then `vp9`
- `av1` is excluded from the interactive recorder path

Rationale:

- Firefox live recording was unstable or too costly with other strategies.
- Chromium can often do better with AVC, but falls back to VP9 when AVC is not encodable for the current config.
- AV1 is too expensive for an interactive capture workflow.

At start, the recorder logs a codec probe:

- browser
- dimensions
- bitrate
- candidate codecs
- support result per candidate

Then it logs the actual chosen codec when recording starts.

## Output size policy

The recorder does not encode blindly at `cropWidth * devicePixelRatio`.

That naive rule is too expensive on:

- Android devices with high DPR,
- desktop retina displays,
- Firefox,
- higher FPS settings.

Instead, `VideoRecordingScreenArea` computes a bounded output size from:

- crop width/height,
- target FPS,
- quality preset,
- browser factor,
- device DPR,
- high-DPR policy,
- mobile policy.

### Pixel budget

Base budgets are defined per FPS:

- 30 FPS: `2_800_000` pixels
- 45 FPS: `2_250_000` pixels
- 60 FPS: `1_700_000` pixels

Then the budget is adjusted by:

- quality factor,
- Firefox factor,
- high-DPR factor,
- mobile factor.

### High-DPR handling

High-DPR devices are supported on both mobile and desktop.

The code caps usable DPR per platform and FPS:

- desktop caps are higher,
- mobile caps are lower,
- both stay below raw native retina when needed.

This gives a retina-like output without the full cost of encoding at native device DPR.

The result of the calculation is:

- target encoded width/height,
- an `outputDpr` used by the compositor backing canvas.

That means the compositor and the recorder are aligned on the same real output size.

## CanvasOverlayComposer role

`CanvasOverlayComposer` is responsible for producing the actual recording canvas.

It:

- crops the source scene,
- draws overlays,
- reproduces backdrop blur and rounded masks where needed,
- uses `outputDpr` for the output canvas backing store,
- throttles its own work to the selected FPS.

The recorder does not encode the original scene canvas directly. It encodes the composer output.

## Final dialog behavior

`VideoDownloadAndShareDialog` and `RecordingInfo` consume `__.recorder.mediaData`.

Current behavior:

- preview video/image from the final blob URL,
- download via the recorder API,
- share via Web Share when available,
- show recording info in a popup card.

The info popup now uses:

- actual dimensions,
- duration,
- size,
- quality,
- average FPS for video

The final dialog should never present the target FPS as if it were the recorded FPS.

## Logs and diagnostics

The recorder currently logs:

1. codec probe results,
2. recording start info,
3. recording finalize info.

Typical fields:

- browser
- codec
- dimensions
- target FPS
- average FPS
- bitrate / quality
- final size
- duration

These logs are there to answer practical questions quickly:

- Did Chromium really use AVC?
- Did Firefox stay on VP9?
- What exact output size was used?
- Is the recorded average FPS close to the target?

## Known tradeoffs

### Firefox finalization

Firefox can still be slow when finalizing VP9 output.

That cost is mostly structural:

- encoder flush,
- MP4 finalization,
- blob construction from `BufferTarget`.

This is not solved by the current architecture.

### BufferTarget memory usage

Video data stays in memory until finalization completes.

That keeps the runtime path fast enough today, but it means:

- RAM grows with recording duration,
- finalization still has a non-trivial cost.

OPFS / streamed targets were evaluated, but are not enabled in the retained implementation because the runtime cost was
too high for the current browsers and workload.

### Real-time priority

The recorder favors real-time capture stability over guaranteed retention of every conceptual frame under heavy load.

This is deliberate. The alternatives were worse in practice for this product.

## Extension points

If recording quality or performance needs more work, the next safe levers are:

1. adjust pixel budgets by FPS and quality,
2. adjust desktop/mobile DPR caps,
3. inspect codec probe logs per browser,
4. revisit storage strategy only if memory becomes the primary problem.

The first place to tune should be `VideoRecordingScreenArea.jsx`, not the recorder scheduler.

## Summary

The current implementation is built around a few fixed decisions:

- real-time recording,
- bounded output sizing,
- compositor-backed canvas capture,
- explicit browser codec policy,
- truthful final stats in the UI.

That keeps the pipeline understandable and debuggable, which matters more here than chasing theoretical maximum quality
with unstable runtime behavior.
