# Replay Core

This directory contains the runtime core for the replay mode.

The implementation is split into a small set of focused modules:

- `JourneyReplayPathSampler`: builds a stable playback path from the journey data.
- `JourneyReplayPlaybackController`: drives play, pause, resume, stop, and progress.
- `JourneyReplayCesiumRenderer`: draws the cursor, trace, guides, and Cesium overlays.
- `JourneyReplayMode`: orchestrates sampler, playback, renderer, and camera behavior.
- `JourneyReplayVideoSync`: bridges recorder events with replay playback for video capture.
- `ReplayOverlayResolver`: resolves replay-driven widget and overlay visibility for video capture.
- `JourneyReplayCameraPath`: builds replay camera transfers and can switch to a time cadence when draft capture needs wall-clock pacing.
- `JourneyReplayCameraState`: stores the active camera transition handle and cancels RAF, timeout, or function-based cancel tokens.
- `JourneyReplayCameraUpdateCache`: provides the ephemeral per-update memoization buckets used by the replay camera visibility and collision helpers.
- `JourneyReplayCameraBinding`: drives the active replay camera update path, reuses the per-update cache for repeated view and visibility checks, and emits fine-grained update-step traces around the hot branches.
- `JourneyReplayCameraOverlay`: renders the replay diagnostics canvas used by HQ export to capture Z1/Z2 and camera timing traces.
- `JourneyReplaySessionSceneController`: logs the replay update phases at a finer granularity so camera timing, renderer work, and POI sync can be separated in the browser console and trace buffer.
- `ReplayVideoOverlayComposer`: builds the draft/HQ overlay list and keeps replay diagnostics canvases in the HQ composer even when they are hidden in the DOM.
- `ReplayFrameTimeline`: generates deterministic replay frames from duration and fps.
- `ReplayVideoRenderSession`: renders replay frames through a caller-provided pipeline.
- `ReplayDeferredExporter`: wraps the render session and returns a master-export manifest plus rendered frames.
- `captureReplayDeferredExportContext`: records a lightweight, non-frame export context snapshot, including the saved draft camera/focus state used to keep Draft and HQ aligned at export start.
- `warmReplayDeferredExportPlan`: pre-resolves the MP4 codec/config while the draft is starting.
- `resolveReplayDeferredExportPlan`: reuses the warm plan only when the export context still matches, including the captured camera snapshot.
- `exportReplayDeferredMp4`: renders the master MP4 and returns the blob without forcing a download.
- `runReplayDeferredMp4Export`: prepares, renders, encodes, and downloads a master MP4 export. The initial HQ scene restore preserves the draft focus snapshot so the export starts from the same visual target.
- The final video dialog starts the HQ export explicitly and switches its share/download actions to the HQ blob once the export completes.
- `JourneyReplayControlsWidget` exposes the single stop action while an HQ export is running.
- `JourneyReplayDebug`: exposes debug snapshots and diagnostic logging.

For a longer architecture walkthrough that maps the replay/video pipeline end
to end, see [REPLAY_VIDEO_ARCHITECTURE.md](../../../../todo/CORE-REPLAY-VIDEO-ARCHITECTURE.md).

## Configuration model

Replay settings are loaded from `public/replay.yaml` and normalized at runtime.
`public/settings.yaml` contains the broader application defaults, but the replay block itself is sourced from `public/replay.yaml`.
JourneyReplay clip definitions are loaded from `public/replay.yaml`, which is the only source for the clips catalog.
The JavaScript defaults in `JourneyReplayProgressionStyle.js` are normalization defaults for non-catalog settings only.
Clip instances are stored on the current journey as `journey.replay.start` and `journey.replay.stop`.

Example:

```yaml
ui:
  replay:
    duration: 60
    progression:
      fill:
        color: '#ff6a00'
        opacity: 1
        width: 2
        profileMarker: 8
      border:
        color: '#ffffff'
        opacity: 1
        width: 0.75
        profileMarker: 2
    profileInfo:
      color: '#ffffff'
    trace:
      mode: progressive
      remaining:
        useDefinedTrackStyle: true
        color: '#6f7d8c'
        opacity: 0.35
    hideOtherJourneys: false
    hideAllPoisDuringJourneyReplay: false
    animateAllPoisDuringJourneyReplay: false
```

## `JourneyReplayProgressionStyle.js`

Normalizes replay settings and provides runtime fallbacks.

### Exports

- `REPLAY_PROGRESSION_FILL_MIN_WIDTH`
- `REPLAY_PROGRESSION_FILL_MAX_WIDTH`
- `REPLAY_PROGRESSION_BORDER_MIN_WIDTH`
- `REPLAY_PROGRESSION_BORDER_MAX_WIDTH`
- `REPLAY_PROFILE_MARKER_FILL_MIN_SIZE`
- `REPLAY_PROFILE_MARKER_FILL_MAX_SIZE`
- `REPLAY_PROFILE_MARKER_BORDER_MIN_WIDTH`
- `REPLAY_PROFILE_MARKER_BORDER_MAX_WIDTH`
- `REPLAY_LABEL`
- `DEFAULT_REPLAY_SCOPE`
- `DEFAULT_REPLAY_DURATION`
- `REPLAY_TRACE_MODE_PROGRESSIVE`
- `REPLAY_TRACE_MODE_FULL`
- `REPLAY_MARKER_MODE_TRACE`
- `REPLAY_MARKER_MODE_NAVIGATION`
- `REPLAY_MARKER_MODE_HYSTERESIS`
- `REPLAY_CAMERA_ALTITUDE_CONSTANT`
- `REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET`
- `DEFAULT_REPLAY_PROGRESSION`
- `DEFAULT_REPLAY_PROFILE_INFO`
- `DEFAULT_REPLAY_TRACE`
- `DEFAULT_REPLAY_MARKER`
- `DEFAULT_REPLAY_CAMERA`
- `defaultJourneyReplayProgressionStyle()`
- `defaultJourneyReplayProfileInfoStyle()`
- `defaultJourneyReplayTraceStyle()`
- `defaultJourneyReplayMarkerStyle()`
- `defaultJourneyReplayCameraStyle()`
- `defaultJourneyReplaySettings()`
- `clampJourneyReplayNumber()`
- `normalizeJourneyReplayProgressionStyle()`
- `normalizeJourneyReplayProfileInfo()`
- `normalizeJourneyReplayTrace()`
- `normalizeJourneyReplayMarker()`
- `normalizeJourneyReplayCamera()`
- `normalizeJourneyReplaySettings()`
- `getJourneyReplaySettings()`
- `ensureJourneyReplaySettings()`

### Key rules

- `progression.fill.profileMarker` controls the marker fill size.
- `progression.border.profileMarker` controls the marker border width.
- `profileInfo.color` controls the profile-specific replay color.
- `trace.remaining.useDefinedTrackStyle` controls whether the remaining trace uses the defined track style or the replay-specific settings.
- `trace.remaining.color` and `trace.remaining.opacity` are only used when `useDefinedTrackStyle` is `false`.

### Example

```js
import { normalizeJourneyReplayProgressionStyle } from '@Core/ui/replay/JourneyReplayProgressionStyle'

const progression = normalizeJourneyReplayProgressionStyle({
    fill: {
        color: '#ff6a00',
        opacity: 1,
        profileMarker: 10,
    },
    border: {
        color: '#ffffff',
        opacity: 1,
        profileMarker: 2,
    },
})

console.log(progression.fill.profileMarker)   // 10
console.log(progression.border.profileMarker) // 2
```

## `JourneyReplayProfileProgress.js`

Adds replay metadata to profile rows and converts between samples and chart rows.

### Exports

- `REPLAY_PROFILE_DISTANCE`
- `REPLAY_PROFILE_TRACK_SLUG`
- `REPLAY_PROFILE_TRACK_INDEX`
- `REPLAY_PROFILE_POINT_INDEX`
- `extendJourneyReplayProfileDimensions(dimensions)`
- `appendJourneyReplayProfileMetadata(row, metadata)`
- `replayProfileDimensionIndexes(dimensions)`
- `createJourneyReplayProfileDatasetLookup(dataset, dimensions)`
- `convertJourneyReplayDistance(distance, unitSystem)`
- `convertJourneyReplayElevation(altitude, unitSystem)`
- `buildJourneyReplayProfileMetricSummary(sample, options)`
- `replayProfileRowFromSample(sample, options)`
- `replaySampleFromProfileRow(row, dimensions, sampler)`
- `buildJourneyReplayCompletedProfileSource(options)`

### Responsibilities

- preserve a stable `distanceFromStart` index in profile datasets;
- convert live samples into ECharts rows;
- recover a sample from a profile row;
- build the completed portion of the profile up to the current sample.

### Example

```js
import { replayProfileRowFromSample } from '@Core/ui/replay/JourneyReplayProfileProgress'

const row = replayProfileRowFromSample(sample, {
    dimensions: ['Distance', 'Elevation', 'Time', 'point'],
    unitSystem: 0,
})

// row[0] => displayed distance
// row[1] => displayed elevation
// row[3] => original sample
```

## `JourneyReplayPlaybackController.js`

Time-based playback controller, independent of GPS point density.

### Exports

- `REPLAY_EVENT_START`
- `REPLAY_EVENT_UPDATE`
- `REPLAY_EVENT_PAUSE`
- `REPLAY_EVENT_RESUME`
- `REPLAY_EVENT_STOP`
- `REPLAY_EVENT_END`
- `REPLAY_EVENTS`
- `JourneyReplayPlaybackController`

### Responsibilities

- manage progress, duration, loop, and direction;
- emit replay lifecycle events;
- drive playback through `requestAnimationFrame`;
- keep the current sample in sync with the runtime store.

### Example

```js
const controller = new JourneyReplayPlaybackController()

controller.configure({
    sampler,
    duration: 60,
    progress: 0,
})

controller.on(REPLAY_EVENT_UPDATE, sample => {
    console.log(sample?.distanceFromStart)
})

controller.start()
```

## `JourneyReplayVideoSync.js`

Bridges the video recorder lifecycle with replay playback when the user enables sync mode from the drawer.

### Responsibilities

- arm/disarm sync from the UI toggle;
- start the replay on `ScreenMediaRecorder.events.START`;
- mirror recorder pause/resume;
- stop the replay when the recorder stops or cancels;
- stop the recorder when the replay reaches the end and auto-stop is enabled.

## `JourneyReplayPathSampler.js`

Builds a stable path representation from the journey.

### Exports

- `REPLAY_SCOPE_VISIBLE_TRACKS`
- `REPLAY_SCOPE_CURRENT_TRACK`
- `REPLAY_SCOPE_ALL_TRACKS`
- `JourneyReplayPathSampler`

### Responsibilities

- normalize visible tracks;
- compute cumulative distances;
- interpolate samples by distance or progress;
- provide a stable source for playback and profile rendering.

### Example

```js
const sampler = new JourneyReplayPathSampler({
    journey,
    scope: 'all-tracks',
    trackSlug: 'track-a',
})

const sample = sampler.atProgress(0.5)
```

## `JourneyReplayCesiumRenderer.js`

Cesium rendering layer for replay.

### Exports

- `REPLAY_DATA_SOURCE_PREFIX`
- `JourneyReplayCesiumRenderer`

### Responsibilities

- manage dedicated Cesium data sources;
- render the cursor marker;
- render the completed and remaining trace;
- draw guides and overlays;
- keep the render tree stable across pause/resume.

### Example

```js
const renderer = new JourneyReplayCesiumRenderer()

renderer.clear()
renderer.render({
    sample,
    progression,
    trace,
})
```

## `JourneyReplayMode.js`

High-level orchestration for the replay feature.

### Exports

- `JourneyReplayMode`

### Responsibilities

- create and configure the sampler;
- bind the playback controller and renderer;
- relay `start`, `pause`, `resume`, `stop`, and `seek`;
- keep Cesium camera behavior in sync with the runtime;
- detect tolerance-zone exits from the current marker projected in Cesium window coordinates;
- apply a centered dead zone so the camera can stay still while the marker remains near the middle of the frame;
- treat non-projectable markers as outside the safe zone so the camera recenters instead of drifting away;
- keep the visibility correction strict enough to preserve the marker and the trailing sampled trace points during grazing views;
- avoid thrashing by replacing an active recenter only after a short delay when the marker stays outside;
- forward profile and debug state.

### Example

```js
import { JourneyReplayMode } from '@Core/ui/replay/JourneyReplayMode'

const replay = new JourneyReplayMode()

replay.configure({
    journey,
    duration: 60,
})

replay.start()
```

### Camera algorithm

`JourneyReplayMode` uses a two-stage decision tree for the camera.

1. It first builds a nominal camera view from the current playback sample.
2. It then measures whether that view is still inside the tolerance zone and whether the marker and the sampled trace remain visible.
3. If the view is still stable, it does nothing.
4. If the view is outside the dead zone, or if the marker/trace becomes hidden, it recenters the camera.

The dead zone is driven by `camera.hysteresis.marginRatio`. The zone is centered in the viewport, so the camera can drift a little before the algorithm reacts. That prevents the visible "breathing" effect when the marker only moves slightly.
The tolerance zone overlay stays visible during playback for the non-`Trace` tracking modes, so the recenter window is easy to read while the FT runs.
Smaller `marginRatio` values make the hysteresis less sensitive and leave a larger stable zone in the middle of the viewport.
For `Behind` and `Ahead`, the nominal heading also includes `camera.headingOffset` in degrees, clamped between `-90` and `90`. The drawer slider is intentionally reversed: moving it to the left applies a negative offset in the camera model, and moving it to the right applies a positive one. While the slider is being edited, the runtime shows a transparent angle overlay anchored on the first replay sample. The solid axis shows the chosen `Behind` or `Ahead` side, and the dashed line shows the selected camera bias. The overlay disappears after 5 seconds without slider changes, or as soon as the user clicks elsewhere. That offset is applied before the existing heading hysteresis and visibility checks, so it behaves like a simple angular bias on top of the current trace-facing view.

### Visibility model

The visibility checks use three layers:

1. A geometric line-of-sight test against terrain heights.
2. A rendered visibility test against the current Cesium scene.
3. A visibility correction that looks at the marker and at the sampled trace points behind it.

The rendered check first tries `scene.pickPosition()` when it is available. That catches occlusion from 3D tiles or other rendered relief. If it cannot use the depth buffer, the code falls back to `globe.pick()` and terrain height sampling.

For the trace, the algorithm samples the current marker plus trailing points along the path. A point is only considered visible if every sampled point that can be evaluated is visible. This is stricter than the original marker-only check and is meant to keep the line from disappearing at shallow viewing angles.

### Redirect search

When the nominal view fails, the mode tries to recover with a small set of candidate camera offsets:

- a few pitch-down candidates;
- a few heading offsets;
- mixed heading/pitch candidates when a pure pitch change is not enough.

Each candidate is scored so that the smallest useful adjustment wins. The redirect state is reused when possible, which avoids recomputing a new solution on every frame.

If a redirected view is still visible in the Cesium scene, the code applies it directly with `setView()`. Otherwise it uses a short `flyTo()` transition. The transition duration is capped so the correction stays smooth but does not become a long camera move.

### Hysteresis and thrash control

The mode keeps a short-lived recenter timestamp and progress key. This stops the camera from restarting the same recenter on every playback update while the marker is still outside the zone.

When the user interacts with the camera manually, the live sync path is isolated from the playback path. The code cancels the current animated transition before applying a user-driven recenter, then it restores the playback state cleanly when the interaction ends.

### Sampling rules

The path sampler is used twice:

- to drive the nominal camera along the replay path;
- to sample trailing trace points for visibility checks.

The camera logic intentionally uses sampled points rather than only the current marker. That is what keeps the rendered trace from vanishing on long, low-angle views.

## `JourneyReplayDebug.js`

Debug helpers for the replay runtime.

### Exports

- `isJourneyReplayDebugEnabled()`
- `recordJourneyReplayDebug(event, payload)`

### Responsibilities

- record lifecycle and performance events;
- expose diagnostic snapshots;
- help analyze latency, progress, and render behavior.

### Example

```js
import { recordJourneyReplayDebug } from '@Core/ui/replay/JourneyReplayDebug'

recordJourneyReplayDebug('replay:update', {
    progress: 0.42,
    distance: 1204.3,
})
```

## Execution flow

1. `ensureJourneyReplaySettings()` initializes the runtime store.
2. `JourneyReplayMode.configure()` installs sampler and settings.
3. `JourneyReplayPlaybackController.start()` begins playback.
4. `JourneyReplayCesiumRenderer` renders the current state in Cesium.
5. `ProfileChart.jsx` draws the profile and the completed segment.

## Profile integration

The profile widget uses the replay helpers to:

- append replay metadata to profile rows;
- draw the completed section with a clipped overlay;
- place the current marker on the exact chart coordinates;
- keep the marker size controlled by `progression.fill.profileMarker` and `progression.border.profileMarker`.

Example:

```js
import { replayProfileRowFromSample } from '@Core/ui/replay/JourneyReplayProfileProgress'

const row = replayProfileRowFromSample(sample, {
    dimensions: profileDimensions,
    unitSystem: lgs.settings.unitSystem.current,
})
```

## Where settings come from

The runtime loads `public/settings.yaml` at startup.

Relevant settings path:

- `ui.replay.progression`
- `ui.replay.profileInfo`
- `ui.replay.trace`
- `ui.replay.marker`
- `ui.replay.camera`
- `ui.replay.clips.catalog`

### Remaining trace behavior

When `trace.remaining.useDefinedTrackStyle` is `true`:

- the remaining trace uses the defined track style;
- the replay-specific remaining color and opacity are ignored;
- the profile overlay follows the track-defined look during replay playback.

When it is `false`:

- the remaining trace uses `trace.remaining.color` and `trace.remaining.opacity`;
- the profile overlay uses the same custom replay color during replay playback.

The JS constants in `JourneyReplayProgressionStyle.js` are used as normalization defaults when the YAML value is missing or invalid for progression/profile/trace/marker/camera settings.
The replay clips catalog itself comes from `public/replay.yaml`.
