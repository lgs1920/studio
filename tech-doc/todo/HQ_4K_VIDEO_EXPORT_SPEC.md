# Technical Specification — HQ 4K Video Export

## Status

Proposal pending validation before implementation.

This specification covers the final video produced by the replay HQ export. It does not concern any individual widget.

## Objective

Allow the user to request an HQ 4K video from the download dialog before the HQ export starts.

The video must be rendered directly at the target resolution. Downscaling or converting an already encoded file is not the primary mechanism: it cannot recover information lost in a lower-resolution source and adds an unnecessary processing step.

## Scope

The feature covers:

- a 4K control in `VideoDownloadAndShareDialog`;
- target resolution calculation based on the video format;
- passing that resolution to the HQ export plan;
- rendering the scene and overlays at the target resolution;
- browser and codec capability checks;
- displaying the effective resolution in the UI and metadata;
- tests for calculation, planning, rendering, and the dialog.

It does not cover:

- converting an already exported file after download;
- changing the default MP4 output format;
- artificially enhancing already compressed external sources;
- creating a 4K profile for real-time Draft recording.

## Current state

The existing pipeline already provides the foundations required for this extension:

1. `VideoDownloadAndShareDialog` prepares HQ rendering through `resolveHqExportRenderSpec()`.
2. `buildReplayVideoRenderSpec()` calculates dimensions from the crop, FPS, quality, and DPR.
3. `exportReplayDeferredMp4()` receives the dimensions and passes them to `ReplayDeferredExporter.exportMp4()`.
4. `ReplayDeferredExporter` creates an encoding canvas with those exact dimensions.
5. Mediabunny probes the available codec and currently produces an MP4 file.

The current behavior uses a pixel budget that depends on FPS and quality. It can therefore produce a resolution below 3840 pixels on the long side. The new mode must provide explicit dimensions instead of allowing the automatic calculation to reduce the target.

### The default resolution is not a fixed 2K output

The current mode does not guarantee a standard `2K` or `QHD` resolution. It calculates an output adapted to the crop, `deviceDpr`, FPS, browser, and quality profile.

For example, for a `1920 × 1080` 16:9 crop:

- with `deviceDpr = 1`, the output may remain `1920 × 1080`;
- with a higher DPR, the pixel budget may produce an intermediate size around `2100 × 1180` at 30 FPS;
- a different quality or FPS setting may produce another size.

This output is therefore neither a fixed DCI 2K size (`2048 × 1080`) nor a fixed QHD size (`2560 × 1440`). The UI should name the mode without the 4K switch `Automatic` or `Standard HQ`, and display the effective resolution after calculation.

The explicit 4K mode is the only mode that guarantees 3840 pixels on the long side, subject to the device's technical capabilities.

Files involved in the current architecture:

- `src/components/MainUI/video/VideoDownloadAndShareDialog.jsx`
- `src/core/ui/replay/ReplayVideoRenderSpec.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`

## 4K definition

The product should use a consistent definition for all ratios: the long side is 3840 pixels, and the other side is calculated while preserving the selected ratio. Dimensions must always be rounded to even values.

| Format | Proposed 4K dimensions |
| --- | ---: |
| 16:9 | 3840 × 2160 |
| 9:16 | 2160 × 3840 |
| 1:1 | 3840 × 3840 |
| 4:5 | 3072 × 3840 |
| 4:3 | 3840 × 2880 |
| Free | 3840 pixels on the long side, preserving the crop ratio |

The user-facing label should be `4K` or `4K UHD`. The actual resolution should be displayed nearby, for example `4K — 3840 × 2160`.

## User experience

### Location

The control is placed in `video-preview-dialog`, above the action bar containing `Create HQ video`. It must be visible before the export starts.

### Proposed control

Use a Web Awesome switch:

- label: `Export in 4K`;
- disabled state: HQ export uses the current automatic resolution;
- enabled state: HQ export uses the calculated 4K resolution;
- short help text: `Rendered directly at 3840 px on the long side. Export may take longer and produce a larger file.`

The recommended default is disabled, preserving the current behavior and avoiding unexpected memory usage. The state should reset when a new video dialog is opened unless the product decides to persist it as a user preference.

When the switch is enabled:

- display the calculated resolution for the current ratio;
- disable the switch when no valid crop or ratio can be resolved;
- display a preparation state before the export actually starts;
- preserve the choice throughout preparation and HQ export;
- prevent changes while `hqExportStatus === 'exporting'`.

Example layout:

```text
Video quality
[ ] Export in 4K
    Direct render: 3840 × 2160 — longer export and larger file

[ Close ]                         [ Create HQ video ]
```

The button may be renamed dynamically to `Create HQ 4K video` when the switch is enabled, making the choice explicit before the export starts.

## Data model

The 4K choice is a temporary export option. It must not be persisted in replay configuration or widget configuration.

The export plan must nevertheless retain the information required for reproducibility:

```js
{
    exportProfile: 'hq-4k',
    requestedResolution: '4k',
    dimensions: {width: 3840, height: 2160},
    outputDpr: 2,
    sourceDimensions: {width: 1920, height: 1080},
    effectiveResolution: '4k',
}
```

`effectiveResolution` may be `4k`, `automatic`, or `fallback`. It must describe the resolution actually encoded, not only the user's initial choice.

## Technical architecture

### 1. Target resolution

Add named, testable, DOM-independent functions to `ReplayVideoRenderSpec.js`:

- `getReplayVideo4kDimensions({cropRect, ratio})`;
- `resolveReplayVideoOutputDimensions({cropRect, resolution, ratio})`;
- optionally `isReplayVideo4kDimensions({width, height})`.

The `4k` resolution must bypass the automatic pixel budget in `computeReplayVideoRecordingOutput()`. The existing budget calculation remains in use for automatic mode.

Pseudo-code:

```js
const REPLAY_VIDEO_4K_LONG_SIDE = 3840

const getReplayVideo4kDimensions = ({width, height}) => {
    const ratio = width / height
    const targetWidth = width >= height
        ? REPLAY_VIDEO_4K_LONG_SIDE
        : toEvenInt(REPLAY_VIDEO_4K_LONG_SIDE * ratio)
    const targetHeight = width >= height
        ? toEvenInt(REPLAY_VIDEO_4K_LONG_SIDE / ratio)
        : REPLAY_VIDEO_4K_LONG_SIDE

    return {width: targetWidth, height: targetHeight}
}
```

The calculation must use the final crop, not the dialog size or window size.

### 2. Plan construction

Update `resolveHqExportRenderSpec()` to receive a `resolution` option:

```js
const renderSpec = buildReplayVideoRenderSpec({
    cropRect,
    sourceCanvas,
    resolution: use4k ? '4k' : 'automatic',
    dimensions: use4k ? getReplayVideo4kDimensions({cropRect}) : null,
    ...
})
```

`buildReplayVideoRenderSpec()` must preserve explicit dimensions through the final plan. The plan must not later recalculate automatic dimensions and replace the 4K target.

### 3. Scene rendering

The HQ encoding canvas must be created directly with the final dimensions, as `ReplayDeferredExporter.exportMp4()` already does.

However, enlarging only that canvas is not enough: if `lgs.canvas` remains at 1920 × 1080, the result is a 4K image interpolated from a 1080p source. During HQ preparation, the Cesium renderer must therefore receive a render target matching the final resolution, within the browser's WebGL limits.

The recommended pipeline is:

1. resolve the crop and 4K dimensions;
2. prepare the replay scene with those dimensions;
3. configure the Cesium drawing buffer at the target resolution;
4. wait for a stable render and ready overlays;
5. compose every frame in the HQ canvas;
6. encode that frame directly into the MP4;
7. restore the original canvas size and scene state after success, cancellation, or error.

CSS dimensions may remain those of the screen. The physical drawing buffer and encoding canvas resolution are independent from the displayed size.

### DPR, screen, and device

4K must not be gated by the device's `devicePixelRatio`.

Three values must be kept separate:

- `deviceDpr`: the pixel density of the screen used for the UI;
- `outputDpr`: the logical scale factor between the crop size and output resolution;
- `outputDimensions`: the physical dimensions actually encoded in the MP4.

Therefore, an HD screen with `deviceDpr = 1` can request a `3840 × 2160` export. The dialog and preview remain displayed in HD, while the renderer and encoding canvas work in an offscreen 4K buffer. In that case, `outputDpr` may be `2` when the logical crop is `1920 × 1080`, even though `deviceDpr` is `1`.

Conversely, a screen with `deviceDpr = 2` does not guarantee a 4K export: automatic mode may reduce the resolution according to the pixel budget, FPS, and browser capabilities.

Expected behavior:

- automatic mode: `deviceDpr` participates in resolution calculation under the current limits;
- explicit 4K mode: 4K dimensions take priority and are independent of `deviceDpr`;
- HD device: 4K is allowed, using an offscreen render when GPU and memory limits permit it;
- mobile device: 4K is allowed on request, but requires strict drawing-buffer, codec, and memory checks;
- technical failure: explicitly fall back to automatic HQ or show an error, according to the product decision.

The 4K switch must not be disabled merely because the screen is HD or `deviceDpr` equals `1`. Availability must be determined by an actual capability check, ideally before the dialog is hidden and HQ rendering begins.

### 4. Overlay composition

`CanvasOverlayComposer` must receive an `outputDpr` derived from the 4K target and crop. Overlays must be composed at physical resolution and drawn into the encoding canvas without an intermediate downscale.

Vector or deterministic DOM sources must be rasterized at composition time for 4K. A previously rasterized low-resolution overlay must not be reused when it can be reconstructed from its source.

### 5. Encoding

The output format remains MP4. Before export, `ReplayDeferredExporter` must probe the codec using the exact 4K dimensions.

Rules:

- if AVC/MP4 accepts the dimensions, start the 4K export;
- otherwise, try the existing fallback if its dimensions are supported;
- if no codec supports the target, do not start a partially 4K export;
- return a structured error stating that 4K is unavailable.

The fallback produces an automatic HQ video and must be explicitly announced to the user. It must not be silent.

## User flow

```text
Recording stops
        ↓
Preview dialog
        ↓
User enables “Export in 4K”
        ↓
Ratio, crop, and target dimensions are calculated
        ↓
Codec / memory / drawing-buffer capability check
        ↓
HQ scene preparation
        ↓
Deterministic frame-by-frame rendering at target resolution
        ↓
MP4 encoding
        ↓
Dialog returns with preview and effective dimensions
```

## Error handling and resource management

4K increases pixel count, GPU memory, canvas memory, and export duration. The system must:

- enforce a configurable safety limit for `width × height`;
- capture drawing-buffer and 2D-context creation errors;
- cancel codec probes and export cleanly;
- release temporary canvases and `ObjectURL` values;
- restore the source canvas and Draft scene on every exit path;
- keep the Draft available if the 4K export fails.

The user-facing error must distinguish:

- unsupported codec;
- insufficient memory or drawing-buffer capacity;
- cancelled export;
- generic generation failure.

## Required tests

### Unit tests

- 4K calculation for every configured ratio;
- ratio preservation and even dimensions;
- 4K calculation from portrait and landscape crops;
- unchanged automatic mode when the switch is disabled;
- 4K mode not reduced by the automatic pixel budget;
- free-ratio calculation based on the crop.

### Export integration tests

- the plan contains `exportProfile: 'hq-4k'` when the switch is enabled;
- `ReplayDeferredExporter.exportMp4()` receives the exact 4K dimensions;
- the encoding canvas has those dimensions;
- the source renderer is prepared with sufficient physical resolution;
- overlays are composed at the target resolution;
- the codec is probed with the final dimensions;
- codec failure triggers the defined fallback or message;
- cancellation and errors restore the scene and release resources.

### UI tests

- the switch is visible before HQ starts;
- the calculated resolution is displayed;
- the button label changes in 4K mode;
- the switch is locked during export;
- the dialog returns with the effective dimensions;
- the choice resets when a new result is opened;
- a fallback is announced to the user.

## Expected files and changes

### Files to modify

- `src/components/MainUI/video/VideoDownloadAndShareDialog.jsx`: switch state, display, resolution passed to the plan, errors, and status.
- `src/core/ui/replay/ReplayVideoRenderSpec.js`: resolution profiles and 4K calculation.
- `src/core/ui/replay/ReplayDeferredExporter.js`: profile, capability validation, fallback, and metadata.
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`: renderer preparation with the physical HQ resolution when required.
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`: validation of composition at target resolution.

### Files to add or complete

- unit tests for `ReplayVideoRenderSpec`;
- HQ 4K export integration tests;
- download-dialog tests;
- optionally, a shared module for resolution limits and export profiles.

## Decisions to validate

1. Should the switch be disabled by default, as proposed here, or persisted per user?
2. If the 4K codec probe fails, should the application automatically offer standard HQ or ask for confirmation before falling back?
3. Should `4K` mean 3840 pixels on the long side for every ratio, or should the term be reserved for `3840 × 2160` 16:9 output?
4. What maximum pixel limit should prevent an export, especially for `1:1` and portrait formats?
5. Should the UI offer only a 4K switch, or a profile selector such as `Automatic / 1080p / 4K`?

## Recommendation

Start with a temporary, disabled-by-default `Export in 4K` switch using explicit dimensions and direct physical rendering. Fallback must be explicit, and the result must display the actual produced resolution. This reuses the existing HQ pipeline while avoiding post-encoding enlargement of a lower-resolution video.
