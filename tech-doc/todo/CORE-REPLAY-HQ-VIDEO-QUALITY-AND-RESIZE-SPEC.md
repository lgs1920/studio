# Replay Video Quality and Resolution Extension

Status: PROPOSED — complementary design, not implemented
Date: 2026-10-30
Repository branch reviewed: `1.0.0`
Feature target: retain existing resolution-spec target `1.1.0` until explicitly changed

## Document ownership and relationship

This document extends, but MUST NOT replace or fork, the existing canonical planned specification:

- `tech-doc/todo/REPLAY_VIDEO_RESOLUTION_PROFILES_SPEC.md` — current proposal for Automatic, 720p, 1080p and 4K profile selection.
- `tech-doc/specs/replay-video/CORE-REPLAY-ARCHITECTURE.md` — current single Replay video export architecture.
- `tech-doc/todo/CORE-REPLAY-HQ-VIDEO-EXPORT-PERFORMANCE-OPTIMIZATION-PLAN.md` — separate speed/memory audit.

The original specification remains the source of truth for shared sizing semantics, current proposals, and the release target. This document adds requested 1440p and arbitrary Custom output, manual increase/decrease, image-quality rules, and final-canvas architecture constraints. If implementation is approved, consolidate these requirements into the original resolution spec or its successor instead of maintaining two competing runtime policies.

Per `PROJECT_RULES.md`: English project documentation, JavaScript/JSX implementation, named exports, no semicolons, arrow functions, full English JSDoc, Valtio where state applies, Web Awesome 3 UI components with native events and `label-at-start` labels, project design tokens, targeted Vitest tests, proper browser/WebGL preflight, and documented PR delivery to `main`. Do not run `bun run dev`.

## Existing runtime and user intent

Branch `1.0.0` uses one deterministic Replay MP4 export pipeline. Do not refer to the removed older `ScreenMediaRecorder` Draft mode, add another encoder, or propose post-encoding MP4 resizing.

Relevant modules include:

- `src/core/ui/replay/ReplayVideoRenderSpec.js` — crop-aware output sizing and adaptive Automatic behavior.
- `src/core/ui/replay/ReplayVideoSettings.js` — frame-rate and encoding-quality settings independent of resolution.
- `src/core/ui/replay/ReplayDeferredExporter.js` — frame generation, optional isolated Cesium render host, composition and MediaBunny `CanvasSource`.
- `src/core/ui/replay/IsolatedHqReplayRenderHost.js` — export render-target resolution.
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js` — scene plus overlay composition into the selected final canvas.
- `src/core/ui/replay/ReplayVideoOverlayComposer.js` and `src/core/ui/widget-manager/widget-2-canvas/Widget2Canvas.js` — overlay capture, visibility and alignment.
- `src/components/MainUI/video/VideoDownloadAndShareDialog.jsx` — completed video preview/handoff; inspect the current Replay recording start/settings UI to locate the canonical resolution selection point before modifying a dialog.

The user creates frames from a WebGL/Cesium canvas mixed with a second canvas/composition layer. The two principal source canvases have matching pixel dimensions within a given project, but projects may use any aspect ratio or pixel size. Individual widget surfaces can differ. Source canvases must not each receive independent/uncoordinated scaling. Output physical dimensions may differ when explicitly selected.

## Resolution modes and independence

- `Automatic`: preserve the current adaptive behavior from `ReplayVideoRenderSpec.js`, including crop, DPR, browser, device, quality and FPS budget. Automatic does NOT promise unchanged source-pixel dimensions and MUST NOT force a named 720p/1080p/4K target.
- `720p`: generic 1280-pixel long-side master target.
- `1080p`: generic 1920-pixel long-side master target.
- `1440p`: proposed generic 2560-pixel long-side master target.
- `4K UHD`: generic 3840-pixel long-side master target. Do not silently equate UHD with DCI 4096 × 2160.
- `Custom`: explicit user-supplied physical width/height, subject to encoder, GPU, memory and aspect-ratio constraints, allowing enlargement and reduction.

All explicit dimensions are an opt-in choice and are independent of FPS and encoder compression quality. The user must see the EXACT effective width × height before export and afterward in metadata.

The existing generic resolution-spec convention is LONG-SIDE based, not universal 720/1080 pixels on the vertical axis. Preserve its meaning and show the real dimensions, especially for portrait, 4:5 and square projects. Publication-specific dimensions (such as Instagram 1080 × 1350) are a separate named publishing profile, not a silent override of generic 1080p.

| Crop aspect | Generic 720p | Generic 1080p | Generic 1440p | 4K UHD |
| --- | --- | --- | --- | --- |
| 16:9 | 1280 × 720 | 1920 × 1080 | 2560 × 1440 | 3840 × 2160 |
| 9:16 | 720 × 1280 | 1080 × 1920 | 1440 × 2560 | 2160 × 3840 |
| 4:5 | 1024 × 1280 | 1536 × 1920 | 2048 × 2560 | 3072 × 3840 |
| 1:1 | 1280 × 1280 | 1920 × 1920 | 2560 × 2560 | 3840 × 3840 |

These are generic master sizes, not platform publishing guarantees. For ratios such as 3:2, 4:3, 21:9, 32:9, 1000:1733 or a free crop, calculate from the ACTUAL final crop ratio. Do not snap a free ratio to a known preset, stretch content or crop it without explicit user action. Even-pixel rounding may introduce a minimal relative aspect-ratio error; show the effective size.

## Custom dimensions and scaling policy

User-selected `Custom` accepts positive finite integers. Default to preserving the original crop ratio with a ratio lock: when width is edited derive height, and vice versa. Validate the actual computed dimensions and codec-compatible even alignment before rendering. Do not invent a 2 × 2 fallback for invalid input or silently alter requested dimensions.

A distinct future UX request may allow the user to unlock the crop ratio and explicitly select `contain`, `cover` or `stretch`. This is NOT part of the initial approved scope: do not add cropping, black bars or distortion by default. Keep crop geometry, overlay scale and positioning authoritative.

Named presets and Custom dimensions MAY be larger or smaller than current preview/source canvas pixels because the user explicitly selected them. Automatic does not add a new arbitrary upscaling rule. Preserve the same crop/frustum and composition mapping across any chosen physical output size.

## Full-quality rendering instead of pixel-only enlargement

The exported video is produced from frames, not resized after MP4 encoding:

1. Freeze the final crop and selected pixel dimensions before the first logical frame.
2. Render Cesium in the isolated export target at the requested drawing-buffer resolution whenever supported. Keep screen CSS pixels, device DPR, export pixel dimensions and crop-coordinate scale as distinct concepts.
3. Re-rasterize source vector/text/SVG/DOM overlays at suitable output pixel density when their renderer supports it. Avoid scaling a stale low-resolution bitmap as if it were original detail.
4. Composite the two principal layers together with the existing crop projection and widget alignment, directly onto the selected final canvas; preserve existing z-order, blur, clipping, alpha, colors and overlays.
5. Encode each canonical Replay frame exactly once through the existing MediaBunny path at the selected output dimensions and frame timestamps. Do not add a second transcode or independently resize the principal source canvases.

If full-detail re-rendering is not possible, an explicitly requested output may still be larger in pixels, but communicate that it cannot recover missing source detail. No artificial sharpening claim or silent super-resolution mode.

## MediaBunny and device limitations

Probe browser-supported encoding for exact dimensions, codec configuration, quality/bitrate and FPS before allocating the full export pipeline. For explicit targets, check available Cesium/WebGL drawing buffer and practical memory limits, plus intermediate buffers and large square/portrait 4K workloads. Rejections must clearly identify codec versus rendering-resource limitations; fallback to Automatic or another resolution requires explicit communication or user choice, never silent substitution.

Preserve the existing output container behavior, track support, metadata, frame count, timestamps and finalization/cancellation contract. Do not introduce a new video converter, double encoding, a second timeline or worker pipeline just to expose more preset sizes. Preserve the current replay camera and rendering ownership under the selected target.

## User interface integration

Before implementation, inspect the current `1.0.0` Replay Record workflow and completed-video dialog. Add a single coherent resolution option at the point where output is planned, not duplicated across playback, Timeline, export monitor and media download UI. Do not claim `VideoDownloadAndShareDialog` contains the old “Create HQ” button.

Use supported Web Awesome components and React wrappers. Use labeled controls with `label-at-start`, accessible descriptions, and exact displayed pixel dimensions. Keep the resolution choice transient in the export request and immutable once recording starts. Do not persist a second Replay state model or let the live preview window size determine encoded pixels.

Recommended labels: `Automatic`, `720p`, `1080p`, `1440p`, `4K UHD`, `Custom`. Expose requested versus effective dimensions and the upscale/downscale consequence. For Custom mode show a ratio lock; a different aspect ratio policy must be separately approved.

## Acceptance tests before a runtime implementation can be accepted

Unit tests in the project unit suite:

- Exact dimensions for the four table ratios at all named presets; check arbitrary/custom ratios and even rounding without distortion.
- Custom width/height positive integer validation, ratio lock, downscale, upscale, unsupported output and invalid input.
- Automatic returns to the pre-existing adaptive behavior for identical crop/device/FPS/quality settings.
- Resolution geometry is independent of FPS and compression-quality selector for explicit targets.

UI/integration tests in the appropriate Vitest projects:

- Profile and Custom selection, visible effective resolution, choice locking during export, cancellation and return to Automatic.
- Propagation from chosen profile to frame plan, isolated WebGL target, composition canvas and MediaBunny `CanvasSource` with the SAME pixel dimensions and canonical timestamps.
- Dynamic widgets, text, logo, Credits, animations, clip boundaries, first/final frames and visibility match the chosen crop.
- No extra transcode, no silently changed ratio or codec, correct failure and cleanup for unsupported 4K and out-of-memory conditions.
- The existing progress, preview, final MP4 handoff and cancellation behavior remain intact.

Browser validation must follow the specific `1.0.0` browser/WebGL skills. Test real MP4 duration, playability, frame timing, target dimensions, Cesium tile quality, aspect ratio, overlay alignment and visual parity across landscape, portrait, square and a custom crop. Test representative 720p, 1080p, 1440p and 4K where supported. Do not claim image-quality improvements from a higher pixel count alone.

## Approval and delivery

This proposal does not change the runtime. Read `PROJECT_RULES.md` and obtain explicit validation of the detailed solution/plan before implementing. When the release is agreed, incorporate the extensions into `REPLAY_VIDEO_RESOLUTION_PROFILES_SPEC.md` and document only implemented behavior under `tech-doc/specs/`. Keep indexes synchronized. Documentation in `tech-doc/` must be delivered via a pull request merged to `main`. A commit on release branch `1.0.0` does not by itself complete that delivery.
