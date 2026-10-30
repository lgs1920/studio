# Replay Video Export Performance Optimization Plan

Status: PROPOSED — analysis and implementation plan, not implemented
Date: 2026-10-30
Repository branch reviewed: `1.0.0`
Target release: unassigned; do not infer a release from the branch name

## Purpose and authority

Improve deterministic Replay MP4 export speed, resource consumption, and UI responsiveness without lowering fidelity, FPS, frame count, timestamp accuracy, scene detail, widget correctness, or output resolution. This document is a prioritized investigation plan, not a performance result or authorization to modify runtime behavior.

Read the current `PROJECT_RULES.md`, `AGENTS.md`, and applicable internal skills before implementation:

- `skills/lgs-1920-studio-performance-rendering/SKILL.md`
- `skills/lgs-1920-studio-replay-video-export/SKILL.md`
- `skills/lgs-1920-studio-testing-workflow/SKILL.md`
- `skills/lgs-1920-studio-documentation-maintenance/SKILL.md`
- The browser/WebGL testing skills required by the `1.0.0` project rules for actual browser validation.

All conversation with the user must be in French; project documentation, code comments, JSDoc, and issues must be in English. Implementation code is JavaScript/JSX, with named exports, arrow functions except constructors, no semicolons, full-word `element` and `event` identifiers, project naming conventions, and professional JSDoc for changed or new functions. Reuse Valtio, Web Awesome 3, Font Awesome, and existing Replay component ownership. No separate replay clock, recording pipeline, worker architecture, or user-visible feature may be introduced as an incidental optimization. Do not run `bun run dev`.

Proposed work belongs under `tech-doc/todo/`. Actual implementation documentation belongs under `tech-doc/specs/` after verification. Git history is not documentation status evidence. The project requires a pull request merged to `main` for delivery of documentation changes.

## Branch-specific findings (2026-10-30)

This plan was reviewed against the source on `1.0.0`, not against the older `main` branch. Several optimizations hypothesized in the earlier static audit are ALREADY PRESENT and MUST NOT be proposed as fresh features:

1. `ReplayDeferredExporter.js` uses a single final composition/encoding canvas for `CanvasSource`. The redundant stable encoder-canvas copy and no-op per-frame scaling transform have been removed.
2. The HQ/Replay compositor is initialized with `continuousRendering: false` and an explicit output canvas. Its deterministic `renderFrame()` is intentionally triggered by the export loop.
3. `ReplayVideoOverlayComposer.js` calls `Widget2Canvas.flush(widgetId, {onlyIfDirty: true})` and uses strict, frame-aware widget capture; `Widget2Canvas` has dirty revisions, frame-driven scheduling, reusable buffers, and capture synchronization.
4. `ReplayRecordingPerformance.js` and `ReplayDeferredExporter.js` already instrument encoder, rendering, widget, composition, progress, and related stages. Prefer extending this system to adding another tracing subsystem.
5. `ReplayRecordingMonitor.js` uses synchronous capture publication to avoid a reused frame being cleared before an asynchronous React effect reads it. Preserve that frame-freshness guarantee.
6. The current application uses one deterministic Replay recording/export path. The removed `ScreenMediaRecorder.js` Draft architecture from the older branch is NOT a current implementation target.

All new proposals below are conditional on current `1.0.0` profiling. Historical audit claims from `main` must not be presented as current measured bottlenecks.

## Canonical related documents

- `tech-doc/todo/CORE-REPLAY-ENCODER-PIPELINE-OVERLAP-ANALYSIS.md` — existing bounded producer/encoder experiment; keep it as the detailed source for that design, rather than duplicating it.
- `tech-doc/todo/CORE-REPLAY-WIDGET-LAYER-EXPORT-SPEC.md` — existing widget-layer and Worker design proposal; do not introduce a parallel design here.
- `tech-doc/todo/REPLAY-PARALLEL-EXPORT-WORKSPACE-ANALYSIS.md` — existing interactive-workspace isolation proposals.
- `tech-doc/specs/replay-video/CORE-REPLAY-ARCHITECTURE.md` — current architecture.
- `tech-doc/specs/replay-video/CORE-REPLAY-QUALITY-VALIDATION.md` — existing performance/quality evidence and visual validation.

This document covers measurement, local candidate optimizations, and acceptance gates only. Where another proposed specification already covers architecture, link to it rather than create competing implementation authorities.

## Required fresh baseline

Use the existing `ReplayRecordingPerformance` stages and browser/WebGL preflight, then measure a reproducible export on the exact current commit before selecting any optimization.

Record:

- Browser version, device/OS, GPU, source project, tile-cache state, crop ratio, exact export dimensions, requested FPS/quality, codec and output size.
- Total export seconds and encoded frames per wall-clock second, including setup, frame-loop and finalization time separately.
- Stage time/count for Cesium render and camera update, scene/tile readiness, frame-resolution, overlay capture, overlay layout, composition, encoder submission and queue wait, file-size publication, preview snapshot/copy, UI progress, teardown.
- Median, p95, maximum and cumulative milliseconds for meaningful per-frame stages. Count timeouts, retry attempts, stale/missing widgets and fallback activations.
- Memory peaks where supported, main-thread responsiveness, buffer allocations, and codec-queue behavior.
- Encoded frame count, media timestamps, actual resolution, playback duration, visual sample evidence and cancellation behavior.

Use at least two project sizes (short/simple and long/dense), warmed versus cold tiles, static versus dynamic widgets, and 1080p plus UHD where supported. Include landscape, portrait, and a custom ratio. Re-run the identical fixture after one targeted modification. Do not claim speedup based solely on static code inspection.

The existing `CORE-REPLAY-ENCODER-PIPELINE-OVERLAP-ANALYSIS.md` cites a historical Edge measurement of 1,021 frames, with approximately 182.167 s for the frame loop and 133.863 s around `CanvasSource.add()`/back-pressure. That report predates current optimizations; do not reuse its percentages as a current baseline or assume those waits represent CPU encoding alone.

## Prioritized candidate investigations

### P0 — Identify the dominant current stage

Read and validate the existing timing report. Separate synchronous frame snapshots, WebCodecs queue/back-pressure, render/UI thread work, and scene readiness. Do not optimize a low-cost path while the dominant stage remains elsewhere. Measure whether extra debug/progress bookkeeping materially affects the baseline.

### P1 — Benchmark bounded render/encode overlap only if encoder waiting still dominates

Follow `CORE-REPLAY-ENCODER-PIPELINE-OVERLAP-ANALYSIS.md`. Test immutable snapshots and a bounded producer/consumer queue against the existing serialized `CanvasSource.add()` path only after a fresh trace confirms useful waiting. Do not call `CanvasSource.add()` concurrently. Preserve timestamp order, keyframes, fixed duration, back-pressure, cancellation, memory bound and completion. This is an experiment, not a mandate to switch to a Worker.

### P1 — Reduce preview copying cost where verified

`ReplayRecordingMonitor.js` currently copies composed output pixels synchronously into the monitor's stable surface. Retain synchronous freshness but investigate whether the monitor needs full-resolution pixel buffers for its displayed size and Picture-in-Picture. Benchmark a physical preview size bounded by the actual display/PiP contract and an explicit, safe update cadence. Do not apply preview dimensions to the encoder or Cesium render target. Verify no blank, stale or partial frames; test panel resizing and PiP lifecycle.

### P2 — Profile expensive blur regions in the compositor

`CanvasOverlayComposer.js` uses a whole-frame backing canvas for backdrop blur. With several blurred overlays at UHD sizes, investigate a clipped region-of-interest buffer with filter-radius margins and equivalent transform/clipping rules. Implement only if measured useful and pixel-comparison tests pass. Do not alter stacking, rounded corners, alpha, shadows or crop coordinates.

### P2 — Verify remaining widget invalidations and CSS layout work

The current `Widget2Canvas` dirty-aware flush and frame-driven capture are correct architecture foundations. Investigate excess invalidations, repeated DOM layout/style reads, and uncached SVG/DOM capture only with capture counters and verified frame identity. Improve existing caches/invalidation keys rather than bypassing strict capture. Static widgets must not become stale; dynamic replay-driven widgets must match the canonical frame, including hidden/appearing widgets and CSS animations.

### P2 — Investigate tile-readiness and render-boundary costs

Measure waits separately for new versus known camera footprints, cold versus cached imagery/terrain/3D Tiles, scene boundaries, clips and stops. The current readiness coordinator caches footprints and enforces render boundaries. Any cache or scheduler change must prove required visual LOD and avoid stale/blurred frames. Do not simply disable readiness, reduce timeout globally, or reintroduce a competing viewer render loop.

### P3 — Make diagnostics and UI notification overhead proportional

Review `ReplayVideoTraceDebug` and `ReplayRecordingMonitor` publication overhead on large exports. Preserve critical error/status transitions and frame-accurate instrumentation, but consider opt-in detailed traces, bounded/circular storage and UI cadence coalescing when profiling shows significant cost. These changes must not mutate actual frame processing timestamps or drop encoded frames.

### P3 — Verify lifecycle and memory stability

Track retained canvases, object URLs, widget capture mirrors, Cesium isolated host and tiles, codec objects, intervals, listeners, and `VideoFrame`/`VideoSample` lifetimes. Any worker or snapshot experiment requires explicit memory back-pressure and deterministic ownership. Never change cleanup ordering without tests for failure, cancellation, stop and later exports.

## Implementation sequencing and approval

1. Capture and preserve a current baseline report and reproducible test fixture.
2. Present measured bottlenecks and the selected minimal optimization for explicit solution/plan validation, per `PROJECT_RULES.md`.
3. Implement one reversible, narrowly scoped change using existing modules.
4. Add targeted unit/integration/UI tests as appropriate, including deterministic async scheduling and cleanup.
5. Re-run the focused suite and affected Vitest project with normal CI parallelism, and applicable `bun run lint`, `bun run typecheck`, `bun run build`, `bun run test:lint-config` checks.
6. Run actual browser/WebGL video export validation using the required internal browser skills. Test visual parity, codec support, tile quality, replay continuity and uploaded/produced media playback.
7. Compare time, memory, preview responsiveness and output fidelity; revert unsuccessful or unstable optimizations.
8. For code edits, apply/check the repository source copyright-header script. For docs, update the correct indexes and follow PR-to-`main` delivery.

## Acceptance criteria

- Current `1.0.0` implementation is represented accurately, with no removed Draft recorder assumptions.
- A measured baseline identifies the dominant stage before changes.
- Output dimensions, frame count, FPS, timestamps, duration, codec compatibility, overlays, camera, trace, tile-quality, and end-frame behavior remain correct.
- Performance changes are quantified on comparable browser hardware, with no invented speedup percentages.
- Cancellation, fast repeated exports, worker/resource failures and cleanup remain stable.
- Proposed work remains TODO until the matching implementation and browser tests exist.
