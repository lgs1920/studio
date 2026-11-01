# Replay Export: Dependency and Encoder Addendum for Codex

Status: PROPOSED - implementation brief, not implemented or benchmarked
Date: 2026-11-01
Repository: https://github.com/lgs1920/studio
Reviewed branch: `1.0.0`
Reviewed commit: `f64ab01b162d28810de2ee68b78bc79e731ce8f8`
Target release: unassigned

## 1. Purpose and execution boundary

Address dependency maintenance and concrete encoder-configuration inconsistencies without duplicating the existing Replay recording performance plan. This document is an addendum, not a replacement architecture or a second performance backlog.

The user requested this document. Runtime implementation, issue creation, commits, pushes, and publication are not authorized by this document alone. Before implementation, follow the current project approval workflow and validate the selected solution and plan. Do not treat proposed version targets as an installed or validated upgrade.

Read `AGENTS.md`, the shared baseline it references, `PROJECT_RULES.md`, and the current Replay export, performance, testing, and documentation skills. Conversation is in French; repository documentation and source comments are in English. Do not run `bun run dev`.

Repository location: `tech-doc/todo/CORE-REPLAY-EXPORT-DEPENDENCIES-AND-ENCODER-ADDENDUM.md`. This proposal describes the reviewed `1.0.0` commit, not the older runtime on `main`. Related-document paths refer to that reviewed commit; use the pinned source links below when those documents are absent from the current branch. Documentation integration follows the required PR workflow.

## 2. Canonical documents reviewed and deduplication decisions

All paths below refer to the reviewed commit. Resolve them from the repository root.

| Existing document | Authority retained by that document | Treatment in this addendum |
| --- | --- | --- |
| `tech-doc/todo/CORE-REPLAY-HQ-VIDEO-EXPORT-PERFORMANCE-OPTIMIZATION-PLAN.md` | Fresh baseline, preview copies, blur, widget invalidation, tile readiness, diagnostics, lifecycle and memory | Keep as the primary performance plan. Do not recreate these work packages. |
| `tech-doc/todo/CORE-REPLAY-ENCODER-PIPELINE-OVERLAP-ANALYSIS.md` | Bounded producer/consumer experiment, immutable snapshots, ordering, keep-alives and backpressure | Reference only. No second queue design or concurrent `CanvasSource.add()` proposal. |
| `tech-doc/todo/CORE-REPLAY-WIDGET-LAYER-EXPORT-SPEC.md` | Widget layers, SnapDOM stream feasibility, HTML-in-Canvas alternatives and Worker boundaries | Add only version-sensitive maintenance findings. Keep the architecture and issue #559 there. |
| `tech-doc/todo/CORE-REPLAY-RECORDING-LOOPS-AND-TIME-RANGED-OBJECTS.md` | Broader object classification, visibility authoring and loop concepts | Do not import its historical recorder assumptions into current runtime work. |
| `tech-doc/todo/REPLAY-PARALLEL-EXPORT-WORKSPACE-ANALYSIS.md` | Workspace isolation and Worker alternatives | No new Worker proposal. Revalidate historical architecture statements before reuse. |

### Already implemented: do not reopen

- One deterministic Replay video-export path; the removed `ScreenMediaRecorder` Draft implementation on `main` is not the target.
- Explicit compositor calls with `continuousRendering: false`.
- Final composition directly into the encoding canvas; no redundant stable encoder-canvas copy or identical-size transform.
- Dirty-aware widget flushing, frame-driven mirrors, reusable buffers and cached unchanged SnapDOM rasters.
- Sequential encoder submission with `await source.add()` and `latencyMode: 'quality'`.
- Scoped Cesium render-loop ownership and existing recording performance measurements.

### Already proposed: link instead of duplicating

Preview downscaling/cadence, region-of-interest blur, excess widget invalidations, tile-wait optimization, UI notification coalescing, lifecycle cleanup, output buffering and render/encode overlap remain owned by the existing plans above. They are not new deliverables in this addendum.

## 3. Verified baseline and limits of this review

| Item | Reviewed state |
| --- | --- |
| `@zumer/snapdom` | Manifest and lockfile resolve to `3.4.0` |
| `mediabunny` | Manifest specifies `^1.62.1`; lockfile resolves to `1.62.1` |
| Official SnapDOM stream plugin | Not declared in the reviewed package manifest; the reviewed capture path uses `Widget2Canvas` |
| Video source | `CanvasSource`, explicit timeline timestamps, `quality` latency mode |
| Container target | MP4, `fastStart: false`, `BufferTarget` |
| Diagnostics | `ReplayRecordingPerformance`; completed report also stored in `plan.runtime.recordingPerformance` |

This is a static source review. No Studio browser session, test suite, exported video, or current device benchmark was executed. No speedup percentage is established. Recheck the branch HEAD and relevant diffs before implementation; retire findings already fixed upstream.

## 4. New bounded work package A: encoder configuration consistency

Primary file: `src/core/ui/replay/ReplayDeferredExporter.js`.

### A1. Probe the configuration actually used by the export

Verified finding: `resolveReplayExportVideoOutput()` probes AVC using `latencyMode: 'realtime'`, while `#encodeMp4()` constructs its `CanvasSource` with `latencyMode: 'quality'`. The VP9 probe already uses `quality`.

Requested behavior:

- Derive the probe and final encoder options from one immutable, session-owned configuration.
- Keep deterministic export in `quality` mode. Do not use realtime mode, frame dropping or concurrent submissions as a speed shortcut.
- Preserve the existing codec fallback behavior unless a separately approved compatibility change is needed.
- Verify selected-version API support before passing frame-rate or other capability fields; do not guess option names.
- Key any prepared configuration reuse by all relevant session settings, including dimensions, FPS, selected quality, codec/profile and acceleration hint.

Acceptance:

- A deterministic test proves the AVC capability probe and instantiated source receive the same latency mode and relevant encoder settings.
- Unsupported candidates proceed to the existing fallback; stale prepared configurations are not reused after a relevant setting changes.
- A real supported-browser export validates the chosen codec, exact dimensions, timestamps, frame count, duration, cancellation and finalization.

### A2. Resolve AVC profile/level from the export session

Verified finding: `getAvcCandidates()` calculates macroblocks per second with `defaultReplayExportFps()`, which reads current global UI state rather than receiving the export timeline FPS explicitly.

Requested behavior:

- Pass the effective FPS from the immutable export timeline into candidate resolution.
- Freeze quality selection at the same session boundary instead of relying on mutable UI reads when selecting or reselecting an encoder.
- Review the existing level-selection thresholds against the supported output dimension/FPS matrix. Do not assume the current two-level heuristic covers every future output.
- Retain a supported automatic codec-string fallback.

Acceptance:

- Tests set different UI and export-session FPS/quality values and prove the export uses its session values.
- Mutating UI settings after preparation does not silently change the export codec configuration.
- Cover 1080p30, 1080p60 and supported UHD cases, including automatic fallback and failure when no candidate is valid.

### A3. Candidate selection is a measurement question

The current candidate order is Baseline, Main, High, then MediaBunny default. First supported does not establish fastest or most efficient.

Do not reorder profiles or force hardware acceleration without evidence. Extend the canonical baseline experiment, if encoder work is significant, to compare supported profiles and `no-preference` versus `prefer-hardware` at identical dimensions, FPS and declared compression settings. Evaluate output size and visual fidelity as well as wall time. Retain `no-preference` as the default unless a verified policy is explicitly approved.

This is a configuration experiment within work package A, not a new encoder architecture.

### A4. Use the supported Quality API, already available in 1.62.1

This is a verified maintenance correction, not dependent on upgrading MediaBunny.

The released `v1.62.1` and `v1.65.0` sources both expose `VideoEncodingConfig.quality?: Quality` and mark the legacy `bitrate?: number | Quality` field as deprecated. The `QUALITY_MEDIUM`, `QUALITY_HIGH` and `QUALITY_VERY_HIGH` exports are already `Quality` instances, constructed from the matching named level, and are themselves deprecated in favor of `new Quality(...)`.

Consequently, Studio's current `bitrate: QUALITY_HIGH` is not a fixed numeric bitrate. It already requests an abstract quality through the legacy field. Comments describing these values as bits per second are inaccurate. Replacing the field at the same level is primarily an API/semantic cleanup, not evidence of faster encoding.

Requested behavior:

- Keep existing preset indices and user-facing choices compatible. Persist a plain preset identifier or normalized plain configuration; do not persist a library class instance, put it in a Valtio proxy, or assume JSON preserves its prototype.
- Resolve the chosen preset to a session-owned `Quality` at the encoder boundary: `medium`, `high`, or `very-high` as appropriate.
- Pass that resolved value through `quality` in both `canEncodeVideo` / `getEncodableVideoCodecs` and `CanvasSource`. Remove the legacy top-level `bitrate` field from those calls; the API rejects specifying both.
- Rename internal fields such as `outputConfig.bitrate` when they actually carry an abstract quality. Replace inaccurate bits-per-second documentation in `ReplayVideoSettings.js` and related diagnostics.
- Persist/report the requested preset separately from the actual encoder rate-control configuration. A requested quality is not an observed numeric bitrate.
- Retain `latencyMode: 'quality'`: this selects latency/frame-dropping behavior and is distinct from the `Quality` compression request.

Illustrative configuration, using APIs present in the installed 1.62.1 release:

```js
import {CanvasSource, Quality} from 'mediabunny'

const source = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality('high'),
    latencyMode: 'quality',
    hardwareAcceleration: 'no-preference',
})
```

This snippet is not a replacement for the complete session/probe configuration or metadata lifecycle.

For ordinary Replay exports, retain named quality presets as the default. MediaBunny maps qualitative quality to a bitrate or quantizer according to codec, media properties and available support. It does not guarantee equal visual quality, file size or speed across all codecs and devices.

Only add an explicit bitrate setting if the user needs a delivery-rate or approximate-size constraint, as a separately approved product option. The modern API can express it with `quality: new Quality({bitrate: requestedBitsPerSecond})`. Constant bitrate mode belongs inside `Quality`; it is not a strict final file-size guarantee. An explicit quantizer is codec-dependent and should not become a universal cross-codec slider without compatibility and fidelity validation.

Acceptance:

- Presets resolve to the same named quality levels as before and existing persisted settings still load.
- Tests assert that probes and sources receive `quality` and no deprecated top-level `bitrate`; shared session settings remain stable across preparation and export.
- No `Quality` instance is deep-proxied or round-tripped through persistence as if it were plain data.
- Logs distinguish the requested preset, encoder configuration, output bytes and duration. Compute observed average encoded-file bitrate from finalized bytes/duration when useful and label it as measured file bitrate, including container overhead.
- Real-export validation compares time, decoded visual quality and output size before changing default levels. Do not claim that a field rename alone improves speed.

## 5. New bounded work package B: dependency maintenance

Versions below were verified as available during the 2026-11-01 review. Recheck official releases and installed API compatibility when executing the work. Upgrade one dependency at a time so regressions and gains remain attributable.

### B1. SnapDOM 3.4.0 to 3.7.0 evaluation

Relevant upstream changes:

- 3.5: font embedding/warm-up improvements and clipping/dirty-region corrections.
- 3.6: HTML-in-Canvas included in the default build; stream `animations: false` option.
- 3.7: stream clip-window handling, hover invalidation, task scheduling and `busyMs` reporting; additional clone/clipping performance work.

Integration rules:

- Keep the current SVG engine as the speed baseline. The official HTML-in-Canvas guide describes extra paint-boundary latency; native rendering is not an assumed throughput improvement.
- Preserve capture geometry, offsets, transforms, shadows, font fidelity, Shadow DOM and unchanged-result raster reuse in `Widget2Canvas`.
- Do not add `@zumer/snapdom-plugins` solely to claim a stream optimization. Its adoption and deterministic frame-stepping feasibility remain owned by the widget-layer specification.
- If stream is later evaluated, use `busyMs` for its own main-thread work and wall time separately. Neither metric measures the whole Replay export.
- `animations: false` stops following running animations; it is not a deterministic animation-seek API.
- Do not globally disable font embedding, reconciliation or visual effects to improve timing without an approved fidelity change.

Acceptance: existing widget capture and overlay tests pass; actual browser comparisons cover static text, dynamic statistics, canvas/SVG charts, fonts, crops, transforms, appearing/disappearing widgets and first/final frames. Compare warm and cold captures separately.

### B2. MediaBunny 1.62.1 to 1.65.0 evaluation

Relevant upstream changes:

- 1.63: reduced memory retained by `BufferTarget`, WebKit AVC stall workaround, and audio/video synchronization fixes.
- 1.64: Chrome Android stale-frame workaround and MP4 chunk-order corrections; conversion acceleration improvements do not automatically benefit this canvas-export path.
- 1.65: reservation-related conversion/muxer fixes, metadata improvements and other correctness fixes. The current `fastStart: false` path does not exercise every reservation change.

Integration rules:

- Check the public source/probe configuration APIs against the selected released version, including quality/bitrate fields, metadata and callbacks. Do not copy documentation for unreleased main blindly.
- Keep current timestamp ordering, backpressure, source closure and finalization behavior.
- Keep the codec keep-alive behavior initially. The WebKit stall workaround warrants a separate regression experiment, not automatic removal of a tested application workaround.
- Validate MP4 playback for every selected fallback codec; do not change the container or add audio as incidental maintenance.
- Update the manifest and lockfile coherently. Apply the repository dependency-inventory requirements if the change is later committed.

Acceptance: real video output and lifecycle regressions pass, especially Safari/WebKit where supported and Chrome Android if supported by the product. Compare memory and actual export time; do not promise a generic speed increase from release notes.

## 6. Refinements to route into existing work, not duplicate tasks

| Finding | Existing owner | Precise refinement to consider |
| --- | --- | --- |
| `#encodeMp4()` uses `renderAll()` plus `renderedFrames` | Primary performance plan, lifecycle/memory section | Evaluate existing `renderEach()` and aggregate metadata for long exports. Audit artifact consumers first; these are retained objects, not proof of retained image bitmaps. |
| Readiness coordinator returns `false`, but export caller does not inspect it | Primary performance plan, tile-readiness section | Count expiration outcomes and capture frame/phase diagnostics. Define existing quality-policy behavior explicitly before introducing retries or failure. Do not globally shorten waits. |
| `BufferTarget` retains the encoded file | Primary plan memory section and widget-layer proposal | Measure the 1.63+ improvement first. Progressive output is a separately scoped follow-up only if long-export memory remains a problem. |
| Output size depends on crop CSS size and DPR; budget cannot downscale below CSS crop size | Existing output-budget discussion; separate product decision | Document current behavior. Explicit resolution controls and reduced-resolution presets are NOT part of this fidelity-preserving optimization. |
| Some older proposals mention removed realtime Draft recording or obsolete SnapDOM options | Documentation maintenance | Correct only the affected claims when the owning document is updated. Preserve proposed versus implemented status; do not perform an unrelated documentation rewrite. |

The explicit-resolution observation follows `Math.max(basePixels, Math.min(nativePixels, pixelBudget))` in `ReplayVideoRenderSpec.js`. It is not sufficient evidence to silently lower existing output resolution. Likewise, changing 60 FPS to 30 FPS is a user-visible output choice, not an equivalent-performance optimization.

## 7. Suggested execution sequence

1. Reconcile branch HEAD, existing proposals and code. Present the selected solution/plan for required validation.
2. Reuse the primary performance plan's fixture and timing collector. Record one unchanged baseline with exact output settings and at least three comparable runs.
3. Implement and validate configuration consistency A1/A2/A4 as one focused change, including the Quality API migration available before any upgrade.
4. Evaluate SnapDOM maintenance B1 separately; preserve the baseline path for comparison.
5. Evaluate MediaBunny maintenance B2 separately; repeat codec and lifecycle validation.
6. Run profile/acceleration comparison A3 only when baseline evidence justifies it.
7. Route any remaining measured bottleneck to its existing canonical work package; do not open duplicate issues or plans.

Suggested existing test locations to extend:

- `src/__tests__/integration/replay/replay-deferred-exporter.test.js`
- `src/__tests__/integration/replay/replay-video-render-session.test.js`
- `src/__tests__/ui/widgets/widget-2-canvas-refresh-mode.test.js`
- `src/__tests__/unit/replay/replay-video-overlay-composer.test.js`
- `src/__tests__/integration/video/canvas-overlay-composer.test.js`
- Applicable browser export/render-loop coverage.

Use deterministic scheduling, restore global state and mocks, run focused tests before the affected Vitest project at normal CI parallelism, and apply the current project-required lint/type/build checks. Browser validation must follow the repository WebGL/browser skill preflight. Static inspection and mocked tests do not establish successful WebCodecs output.

## 8. Final acceptance and Codex handoff

- No duplicate preview, blur, Worker, widget-layer or overlap implementation is introduced.
- AVC probes match actual export configuration and consume immutable session FPS/quality.
- Compression presets use the supported `quality` field without mislabeling `Quality` objects as numeric bitrates.
- Dependency changes preserve encoded dimensions, frame count, ordering, timestamps, duration, scene quality and widget fidelity.
- Stop, cancel, pause/resume, failure, keep-alives, final frame and repeated exports remain correct.
- Before/after reports separate rendering, capture, preview, encoder submission, drain and finalization. Do not sum overlapping timing rows.
- Improvements are measured on comparable hardware and settings; failures and unsupported platforms are reported explicitly.
- Report files changed, versions selected, tests actually run, benchmark results and remaining decisions. Keep unmeasured proposals marked TODO.

## 9. References

- [Reviewed source tree](https://github.com/lgs1920/studio/tree/f64ab01b162d28810de2ee68b78bc79e731ce8f8)
- [Primary existing performance plan](https://github.com/lgs1920/studio/blob/f64ab01b162d28810de2ee68b78bc79e731ce8f8/tech-doc/todo/CORE-REPLAY-HQ-VIDEO-EXPORT-PERFORMANCE-OPTIMIZATION-PLAN.md)
- [Existing overlap experiment](https://github.com/lgs1920/studio/blob/f64ab01b162d28810de2ee68b78bc79e731ce8f8/tech-doc/todo/CORE-REPLAY-ENCODER-PIPELINE-OVERLAP-ANALYSIS.md)
- [Existing widget-layer proposal](https://github.com/lgs1920/studio/blob/f64ab01b162d28810de2ee68b78bc79e731ce8f8/tech-doc/todo/CORE-REPLAY-WIDGET-LAYER-EXPORT-SPEC.md)
- [SnapDOM releases](https://github.com/zumerlab/snapdom/releases)
- [SnapDOM 3.6 to 3.7 changes](https://github.com/zumerlab/snapdom/compare/v3.6.0...v3.7.0)
- [SnapDOM HTML-in-Canvas guide](https://snapdom.dev/how-to/html-in-canvas/)
- [SnapDOM cache behavior](https://snapdom.dev/docs/cache/)
- [MediaBunny 1.63 release](https://github.com/Vanilagy/mediabunny/releases/tag/v1.63.0)
- [MediaBunny releases](https://github.com/Vanilagy/mediabunny/releases)
- [MediaBunny media sources](https://mediabunny.dev/guide/media-sources)
- [MediaBunny 1.62.1 released encoding API and Quality presets](https://github.com/Vanilagy/mediabunny/blob/v1.62.1/src/encode.ts)
- [MediaBunny 1.65.0 released encoding API](https://github.com/Vanilagy/mediabunny/blob/v1.65.0/src/encode.ts)
