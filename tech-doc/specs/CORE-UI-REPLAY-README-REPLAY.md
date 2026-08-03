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
- `JourneyReplayCameraTrackingBinding`: drives the active shared Navigation/Dynamic camera resolver, reuses the per-update cache, and emits fine-grained traces around visibility and tracking decisions.
- `JourneyReplayCameraPitchController`: owns the logical-time temporary pitch lifecycle shared by Draft and HQ.
- `JourneyReplayCameraBinding`: provides the live Cesium camera bridge and transition plumbing, and re-exports the active tracking entry points.
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
to end, see
[Replay / Video Architecture](../todo/CORE-REPLAY-VIDEO-ARCHITECTURE.md).

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
- resolve the shared logical camera pose for Draft and HQ;
- run Navigation Z1 prediction or Dynamic Z1/Z2 look-ahead selection;
- run the shared temporary pitch state machine when the current nominal marker view is hidden;
- apply one complete target-locked camera frame through the Cesium adapter;
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

`JourneyReplayCameraTrackingBinding` is the active camera authority for both
Draft and HQ. It resolves a nominal renderer-independent pose from the current
logical sample, then gives temporary visibility correction first priority. If
no pitch correction owns the frame, it applies the selected tracking behavior:

- Navigation keeps an initialized camera stable while the marker remains in
  Z1. A current hard exit is corrected directly; a predictive exit must remain
  confirmed for 250 ms before a deterministic transition starts.
- Dynamic selects a normal or extended future sample from the current marker's
  Z1/Z2 classification and applies that resolved pose on every logical update.

Both modes respect the selected `Behind`, `Ahead`, or `System` position. The
`Behind` and `Ahead` headings include the configured heading offset. Turn drift
uses the same limits in both modes; the active logical path applies its heading
component and speed-dependent roll (lateral displacement remains diagnostic).

The camera capability flags are normalized with `true` defaults and gate their
features independently: `canDrift` enables turn drift, `canFixHiddenMarker`
enables temporary hidden-marker pitch/terrain correction, and `canRoll` enables
speed/curvature banking. Draft and HQ use the same flag values.

### Temporary pitch correction

Navigation and Dynamic use one logical-time state machine. Correction is based
on the visibility of the current nominal view, not on a predictive sample. A
hidden observation must persist for 250 ms and a geometrically valid bounded
candidate must exist before the camera changes.

The selected heading/pitch redirect blends in over 900 ms. Once the nominal
view has remained visible for 150 ms, it blends back to the current nominal pose
over 450 ms. Shallow nominal views above -30 degrees are limited to 8 degrees
for the first candidate search. If that gentle envelope cannot restore
visibility, the search expands to the common 20-degree hard limit. The selected
correction still uses the same 900 ms attack, so this fallback cannot create an
instantaneous pitch jump.

This controller accepts only redirects with a non-zero pitch-down component.
Heading-only candidates remain available to other camera mechanisms, but they
cannot activate or retain temporary pitch correction. A combined heading and
pitch redirect remains eligible when it is the smallest candidate that proves
visibility.

The correction is always recomputed as an offset from the current nominal pose.
It is never accumulated from the previously corrected pitch. Losing visibility
during release resumes the correction from its current weight. The final frame,
a tracking-mode change, or a tracking reset clears the state and restores the
exact nominal pitch.

Automatic frame writes are isolated from the Cesium control synchronization
bridge. Camera events caused by tracking or visibility correction cannot be
stored as user pitch or heading changes; only an actual pointer interaction may
override the nominal replay camera settings during that protection window.

### Visibility model

Geometric visibility checks the current marker and available trailing trace
samples. The marker and near trace through 12 metres are required; more distant
samples are advisory. Rendered visibility checks the same required marker and
near-trace targets with `pickPosition()` and falls back to `globe.pick()` when
necessary. An unavailable rendered result is treated as unknown rather than
hidden. A rendered near-trace occlusion therefore activates the same debounced
pitch correction in Navigation and Dynamic even if the marker centre is still
detected.

Redirect candidates first preserve the required near trace. If none succeeds
and the rendered marker is explicitly hidden, the same bounded search retries
against the marker alone. This fallback is shared by Navigation and Dynamic and
still requires proven geometric marker visibility; it is not a forced
maximum-pitch correction.

### Camera ownership

Pitch correction, a deterministic Navigation transition, and normal tracking
are mutually exclusive frame owners. The active owner writes one complete
target-locked camera frame. A resolved view is remembered only after that write
succeeds. Manual user interaction temporarily suspends replay camera updates.

The detailed zone geometry, adaptive timing, candidate limits, and ownership
rules are specified in
[Replay Camera Tracking and Temporary Pitch](REPLAY_CAMERA_TRACKING_ZONES.md).

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
