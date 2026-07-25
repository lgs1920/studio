# Technical Specification — HQ Video Resolution Profiles

## Status

Proposal pending validation before implementation.

This specification covers the final video produced by the replay HQ export. It does not concern any individual widget.
The supported explicit output profiles are `720p`, `1080p`, and `4K`.

## Objective

Allow the user to select an explicit HQ output profile (`720p`, `1080p`, or `4K`) from the download dialog before the HQ export starts.

The video must be rendered directly at the target resolution. Downscaling or converting an already encoded file is not the primary mechanism: it cannot recover information lost in a lower-resolution source and adds an unnecessary processing step.

## Scope

The feature covers:

- a resolution profile control in `VideoDownloadAndShareDialog`;
- target resolution calculation based on the video format;
- passing that resolution to the HQ export plan;
- rendering the scene and overlays at the target resolution;
- browser and codec capability checks;
- displaying the selected and effective resolution in the UI and metadata;
- tests for calculation, planning, rendering, and the dialog.

It does not cover:

- converting an already exported file after download;
- changing the default MP4 output format;
- artificially enhancing already compressed external sources;
- changing the real-time Draft recording profile in the first phase;
- post-encoding upscaling or transcoding.

## Current state

The existing pipeline already provides the foundations required for this extension:

1. `VideoDownloadAndShareDialog` prepares HQ rendering through `resolveHqExportRenderSpec()`.
2. `buildReplayVideoRenderSpec()` calculates dimensions from the crop, FPS, quality, and DPR.
3. `exportReplayDeferredMp4()` receives the dimensions and passes them to `ReplayDeferredExporter.exportMp4()`.
4. `ReplayDeferredExporter` creates an encoding canvas with those exact dimensions.
5. Mediabunny probes the available codec and currently produces an MP4 file.

The current behavior uses a pixel budget that depends on FPS and quality. It can therefore produce a resolution below 1280, 1920, or 3840 pixels on the long side. An explicit profile must provide dimensions instead of allowing the automatic calculation to reduce the target.

The first implementation should apply explicit profiles to deferred HQ export. Real-time Draft recording keeps the current automatic calculation until the renderer, memory limits, and UX for Draft profiles have been validated separately.

### The default resolution is not a fixed 2K output

The current mode does not guarantee a standard `2K` or `QHD` resolution. It calculates an output adapted to the crop, `deviceDpr`, FPS, browser, and quality profile.

For example, for a `1920 × 1080` 16:9 crop:

- with `deviceDpr = 1`, the output may remain `1920 × 1080`;
- with a higher DPR, the pixel budget may produce an intermediate size around `2100 × 1180` at 30 FPS;
- a different quality or FPS setting may produce another size.

This output is therefore neither a fixed DCI 2K size (`2048 × 1080`) nor a fixed QHD size (`2560 × 1440`). The UI should name the mode `Automatic` or `Standard HQ`, and display the effective resolution after calculation.

The explicit profiles are the only modes that guarantee their target long side, subject to the device's technical capabilities. `Automatic` remains the compatibility-preserving mode.

Files involved in the current architecture:

- `src/components/MainUI/video/VideoDownloadAndShareDialog.jsx`
- `src/core/ui/replay/ReplayVideoRenderSpec.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`

## Resolution profile definitions

The product should use a consistent definition for all ratios: the profile sets the long side, and the other side is calculated while preserving the selected ratio. Dimensions must always be rounded to even values.

| Profile | Long side | 16:9 | 9:16 | 1:1 | 4:5 | 4:3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `720p` | 1280 | 1280 × 720 | 720 × 1280 | 1280 × 1280 | 1024 × 1280 | 1280 × 960 |
| `1080p` | 1920 | 1920 × 1080 | 1080 × 1920 | 1920 × 1920 | 1536 × 1920 | 1920 × 1440 |
| `4K` | 3840 | 3840 × 2160 | 2160 × 3840 | 3840 × 3840 | 3072 × 3840 | 3840 × 2880 |

`Free` uses the same long-side rule while preserving the actual crop ratio. `Automatic` does not use a fixed target and continues to use the existing pixel budget.

### Instagram 4:5 output

The configured `4x5` format is intended for Instagram Feed. It must therefore have a platform-aware publishing profile instead of relying only on the generic long-side rule above. Instagram's official guidance keeps uploads up to 1080 pixels wide and supports portrait ratios down to 3:4; a 4:5 publication is therefore best exported at `1080 × 1350`. [Instagram image resolution guidance](https://www.facebook.com/help/1631821640426723/)

Use these distinct targets:

| Use | Target for 4:5 |
| --- | ---: |
| Instagram Feed publish | 1080 × 1350 |
| Lower-size Instagram-compatible export | 720 × 900 |
| 4:5 generic 1080p master | 1536 × 1920 |
| 4:5 generic 4K master | 3072 × 3840 |

The UI must not silently label `1536 × 1920` as an Instagram-ready `1080p` file. Recommended labels are `Instagram 4:5 — 1080 × 1350` for publishing and `1080p 4:5 master — 1536 × 1920` for a generic high-resolution master. The same distinction applies to `720p`: for Instagram it means `720 × 900`, not `1024 × 1280`.

| Format | Proposed 4K dimensions |
| --- | ---: |
| 16:9 | 3840 × 2160 |
| 9:16 | 2160 × 3840 |
| 1:1 | 3840 × 3840 |
| 4:5 | 3072 × 3840 |
| 4:3 | 3840 × 2880 |
| Free | 3840 pixels on the long side, preserving the crop ratio |

The user-facing labels should be `Automatic`, `720p`, `1080p`, and `4K` (or `4K UHD`). The actual resolution should be displayed nearby, for example `1080p — 1920 × 1080`.

## User experience

### Location

The control is placed in `video-preview-dialog`, above the action bar containing `Create HQ video`. It must be visible before the export starts.

### Proposed control

Use a Web Awesome select or segmented control with these choices:

- `Automatic`: current adaptive resolution;
- `720p`: direct render with 1280 pixels on the long side;
- `1080p`: direct render with 1920 pixels on the long side;
- `4K`: direct render with 3840 pixels on the long side.

The recommended default is `Automatic`, preserving the current behavior and avoiding unexpected memory usage. The state should reset when a new video dialog is opened unless the product decides to persist it as a user preference.

When an explicit profile is selected:

- display the calculated resolution for the current crop ratio;
- disable the control when no valid crop or ratio can be resolved;
- display a preparation state before the export actually starts;
- preserve the choice throughout preparation and HQ export;
- prevent changes while `hqExportStatus === 'exporting'`.

Example layout:

```text
Video quality
[ Automatic v ]
    Effective resolution: automatic, currently 2100 × 1180
    [or]
[ 1080p      ]
    Direct render: 1920 × 1080

[ Close ]                         [ Create HQ video ]
```

The button may be renamed dynamically to `Create HQ 1080p video` or `Create HQ 4K video` when an explicit profile is selected, making the choice explicit before the export starts.

## Data model

The resolution choice is a temporary export option. It must not be persisted in replay configuration or widget configuration.

The export plan must nevertheless retain the information required for reproducibility:

```js
{
    exportProfile: 'hq-1080p',
    requestedResolution: '1080p',
    dimensions: {width: 1920, height: 1080},
    outputDpr: 1,
    sourceDimensions: {width: 1920, height: 1080},
    effectiveResolution: '1080p',
    qualityIndex: 1,
}
```

The example dimensions must match the selected profile; for a 1080p 16:9 export they are `{width: 1920, height: 1080}`. `effectiveResolution` may be `720p`, `1080p`, `4k`, `automatic`, or `fallback`. It must describe the resolution actually encoded, not only the user's initial choice. `qualityIndex` remains an encoding-quality setting and is not replaced by `requestedResolution`.

The explicit profile is temporary export state. It must not be persisted in replay configuration or widget configuration. The current FPS and quality settings are copied into the export plan so that a reproducible export does not depend on later UI changes.

## Relationship with FPS, quality, and video presets

Resolution, FPS, and encoding quality are three independent axes:

| Setting | Current responsibility | Effect on an explicit profile |
| --- | --- | --- |
| Resolution profile | Output pixel dimensions | Fixes the target dimensions; it does not change the bitrate by itself |
| FPS | Frames per second | Increases frame count, render work, export time, and usually file size |
| Quality | Encoder bitrate and perceived compression quality | Keeps the selected dimensions and changes bitrate/detail |

The current automatic mode has one additional coupling: `qualityIndex` also modifies the pixel budget used to calculate dimensions. Its current factors are approximately `0.9` for Medium, `1.0` for High, and `1.12` for Ultra. This coupling must remain for `Automatic` to preserve existing behavior, but an explicit `720p`, `1080p`, or `4K` profile must bypass that dimension calculation.

The quality setting must still be passed to the encoder for explicit profiles. Mediabunny's current AVC-oriented reference is approximately:

| 16:9 target | Medium | High | Ultra High |
| --- | ---: | ---: | ---: |
| 720p — 1280 × 720 | 1.4 Mbps | 2.8 Mbps | 5.6 Mbps |
| 1080p — 1920 × 1080 | 3.0 Mbps | 6.0 Mbps | 12.0 Mbps |
| 4K — 3840 × 2160 | 11.2 Mbps | 22.4 Mbps | 44.8 Mbps |

These are estimates from the current Mediabunny quality model. The effective bitrate remains codec-dependent and must be measured from the encoded output. For square and portrait profiles, the bitrate scales with the actual pixel count, not only the profile name.

For the Instagram publishing target `1080 × 1350`, the same model gives approximately `2.1 Mbps` Medium, `4.3 Mbps` High, and `8.6 Mbps` Ultra High. This is the quality setting applied to the Instagram-ready output; exporting a `1536 × 1920` generic master would require a higher bitrate and would still be reduced by Instagram on upload.

The current `ScreenMediaRecorder.VIDEO_PRESETS` are not resolution presets:

| Preset | FPS | Quality | Current role |
| --- | ---: | --- | --- |
| `15-medium` | 15 | Medium | Low-cost recording |
| `medium` | 30 | Medium | Default recording |
| `high` | 45 | High | Higher motion and bitrate |
| `Ultra` | 60 | Ultra High | Highest current Draft preset |
| `custom` | User-selected | User-selected | Manual FPS and quality |

The recommended design is to keep resolution as a separate HQ export selector. Adding a resolution field directly to `VIDEO_PRESETS` would make each preset control three axes, change Draft behavior, multiply combinations, and make names such as `High` ambiguous. If the product later wants named complete profiles, they should be explicit combinations such as `1080p / 30 FPS / High`, with resolution, FPS, and quality stored as separate fields underneath.

## Technical architecture

### 1. Target resolution

Add named, testable, DOM-independent functions to `ReplayVideoRenderSpec.js`:

- `getReplayVideoProfileDimensions({cropRect, profile, ratio})`;
- `getReplayVideo4kDimensions({cropRect, ratio})` as a compatibility wrapper or profile-specific helper;
- `resolveReplayVideoOutputDimensions({cropRect, resolution, ratio})`;
- optionally `isReplayVideo4kDimensions({width, height})`.

The `720p`, `1080p`, and `4k` resolutions must bypass the automatic pixel budget in `computeReplayVideoRecordingOutput()`. The existing budget calculation remains in use for `automatic` mode. Explicit dimensions must remain independent from `qualityIndex` and FPS for geometry, while both values remain available to the encoder and timeline.

Pseudo-code:

```js
const REPLAY_VIDEO_RESOLUTION_LONG_SIDES = {
    '720p': 1280,
    '1080p': 1920,
    '4k': 3840,
}

const getReplayVideoProfileDimensions = ({width, height, profile}) => {
    const ratio = width / height
    const longSide = REPLAY_VIDEO_RESOLUTION_LONG_SIDES[profile]
    if (!longSide) {
        return null
    }
    const targetWidth = width >= height
        ? longSide
        : toEvenInt(longSide * ratio)
    const targetHeight = width >= height
        ? toEvenInt(longSide / ratio)
        : longSide

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
    resolution: selectedProfile,
    dimensions: selectedProfile === 'automatic'
                ? null
                : getReplayVideoProfileDimensions({cropRect, profile: selectedProfile}),
    ...
})
```

`buildReplayVideoRenderSpec()` must preserve explicit dimensions through the final plan. The plan must not later recalculate automatic dimensions and replace the selected target. It must expose both `resolution` and `qualityIndex` so that the UI and exporter can distinguish geometry from encoding quality.

### 3. Scene rendering

The HQ encoding canvas must be created directly with the final dimensions, as `ReplayDeferredExporter.exportMp4()` already does.

However, changing only that canvas is not enough. If the source scene remains at a lower physical resolution than the selected target, an upscaled export cannot recover missing detail. During HQ preparation, the Cesium renderer must therefore receive a render target matching the final resolution when the target is larger than the current source, within the browser's WebGL limits. When the target is lower, the downsample must happen deterministically in the compositor rather than by re-encoding an already produced file.

The recommended pipeline is:

1. resolve the crop and profile dimensions;
2. prepare the replay scene with those dimensions;
3. configure the Cesium drawing buffer at the target resolution;
4. wait for a stable render and ready overlays;
5. compose every frame in the HQ canvas;
6. encode that frame directly into the MP4;
7. restore the original canvas size and scene state after success, cancellation, or error.

CSS dimensions may remain those of the screen. The physical drawing buffer and encoding canvas resolution are independent from the displayed size.

### DPR, screen, and device

Explicit profiles must not be gated by the device's `devicePixelRatio`.

Three values must be kept separate:

- `deviceDpr`: the pixel density of the screen used for the UI;
- `outputDpr`: the logical scale factor between the crop size and output resolution;
- `outputDimensions`: the physical dimensions actually encoded in the MP4.

Therefore, an HD screen with `deviceDpr = 1` can request a `3840 × 2160` export. The dialog and preview remain displayed in HD, while the renderer and encoding canvas work in an offscreen 4K buffer. In that case, `outputDpr` may be `2` when the logical crop is `1920 × 1080`, even though `deviceDpr` is `1`. The same separation applies to 720p and 1080p; an explicit profile is a physical output target, not a screen-size test.

Conversely, a screen with `deviceDpr = 2` does not guarantee a 4K export: automatic mode may reduce the resolution according to the pixel budget, FPS, and browser capabilities.

Expected behavior:

- automatic mode: `deviceDpr` participates in resolution calculation under the current limits;
- explicit profile mode: selected dimensions take priority and are independent of `deviceDpr`;
- HD device: explicit profiles are allowed, using an offscreen render when GPU and memory limits permit it;
- mobile device: explicit profiles require drawing-buffer, codec, and memory checks, especially for 4K;
- technical failure: explicitly fall back to automatic HQ or show an error, according to the product decision.

The profile control must not be disabled merely because the screen is HD or `deviceDpr` equals `1`. Availability must be determined by an actual capability check, ideally before the dialog is hidden and HQ rendering begins.

### 4. Overlay composition

`CanvasOverlayComposer` must receive an `outputDpr` derived from the selected target and crop. Overlays must be composed at physical resolution and drawn into the encoding canvas without an unnecessary intermediate downscale.

Vector or deterministic DOM sources must be rasterized at composition time for the selected profile. A previously rasterized low-resolution overlay must not be reused when it can be reconstructed from its source.

### 5. Encoding

The output format remains MP4. Before export, `ReplayDeferredExporter` must probe the codec using the exact selected dimensions.

Rules:

- if AVC/MP4 accepts the dimensions, start the selected-profile export;
- otherwise, try the existing fallback if its dimensions are supported;
- if no codec supports the target, do not start a partially matching export;
- return a structured error stating that the selected profile is unavailable.

The fallback produces an automatic HQ video and must be explicitly announced to the user. It must not be silent.

## User flow

```text
Recording stops
        ↓
Preview dialog
        ↓
User selects `720p`, `1080p`, or `4K`
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

Higher profiles increase pixel count, GPU memory, canvas memory, and export duration. For the standard 16:9 profiles, the encoded pixel counts are approximately:

| Profile | Pixels per frame | Relative to 720p |
| --- | ---: | ---: |
| 720p | 0.92 million | 1× |
| 1080p | 2.07 million | 2.25× |
| 4K | 8.29 million | 9× |

The system must:

- enforce a configurable safety limit for `width × height`;
- capture drawing-buffer and 2D-context creation errors;
- cancel codec probes and export cleanly;
- release temporary canvases and `ObjectURL` values;
- restore the source canvas and Draft scene on every exit path;
- keep the Draft available if an explicit-profile export fails.

The user-facing error must distinguish:

- unsupported codec;
- insufficient memory or drawing-buffer capacity;
- cancelled export;
- generic generation failure.

## Required tests

### Unit tests

- 720p, 1080p, and 4K calculation for every configured ratio;
- ratio preservation and even dimensions;
- profile calculation from portrait and landscape crops;
- unchanged automatic mode when `Automatic` is selected;
- explicit profiles not reduced by the automatic pixel budget;
- free-ratio calculation based on the crop.

### Export integration tests

- the plan contains the selected resolution profile;
- `ReplayDeferredExporter.exportMp4()` receives the exact profile dimensions;
- the encoding canvas has those dimensions;
- the source renderer is prepared with sufficient physical resolution for the selected profile;
- overlays are composed at the target resolution;
- the codec is probed with the final dimensions;
- codec failure triggers the defined fallback or message;
- cancellation and errors restore the scene and release resources.

### UI tests

- the profile control is visible before HQ starts;
- the calculated resolution is displayed for each profile;
- the button label changes for an explicit profile;
- the profile control is locked during export;
- the dialog returns with the effective dimensions;
- the choice resets when a new result is opened;
- a fallback is announced to the user.

## Expected files and changes

### Files to modify

- `src/components/MainUI/video/VideoDownloadAndShareDialog.jsx`: profile state, display, resolution passed to the plan, errors, and status.
- `src/core/ui/replay/ReplayVideoRenderSpec.js`: resolution profiles and target calculation.
- `src/core/ui/replay/ReplayDeferredExporter.js`: profile, capability validation, fallback, and metadata.
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`: renderer preparation with the physical HQ resolution when required.
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`: validation of composition at target resolution.

### Files to add or complete

- unit tests for `ReplayVideoRenderSpec`;
- HQ resolution-profile export integration tests;
- download-dialog tests;
- optionally, a shared module for resolution limits and export profiles.

## Decisions to validate

1. Should `Automatic` be the default, as proposed here, or should the last selected profile be persisted per user?
2. If an explicit-profile codec probe fails, should the application automatically offer standard HQ or ask for confirmation before falling back?
3. Should `720p`, `1080p`, and `4K` mean the stated long side for every ratio, or should the labels be reserved for 16:9 output?
4. What maximum pixel limit should prevent an export, especially for `1:1` and portrait formats?
5. Should the UI offer `Automatic / 720p / 1080p / 4K` only for HQ export, or should the same profiles also control real-time Draft recording?
6. Should quality remain coupled to the automatic pixel budget, while explicit profiles use quality only for bitrate, as proposed here?

## Recommendation

Start with a temporary `Automatic / 720p / 1080p / 4K` selector for deferred HQ export, defaulting to `Automatic`. Explicit profiles use direct physical rendering, while the current Draft presets remain unchanged. Fallback must be explicit, and the result must display the actual produced resolution. This reuses the existing HQ pipeline while avoiding post-encoding enlargement of a lower-resolution video.
