# Flythrough Core

This directory contains the runtime core for the flythrough mode.

The implementation is split into a small set of focused modules:

- `FlythroughPathSampler`: builds a stable playback path from the journey data.
- `FlythroughPlaybackController`: drives play, pause, resume, stop, and progress.
- `FlythroughCesiumRenderer`: draws the cursor, trace, guides, and Cesium overlays.
- `FlythroughMode`: orchestrates sampler, playback, renderer, and camera behavior.
- `FlythroughDebug`: exposes debug snapshots and diagnostic logging.

## Configuration model

Flythrough settings are loaded from `public/settings.yaml` and normalized at runtime.
The JavaScript defaults in `FlythroughProgressionStyle.js` are fallbacks only.

Example:

```yaml
ui:
  flythrough:
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
```

## `FlythroughProgressionStyle.js`

Normalizes flythrough settings and provides runtime fallbacks.

### Exports

- `FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH`
- `FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH`
- `FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH`
- `FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH`
- `FLYTHROUGH_PROFILE_MARKER_FILL_MIN_SIZE`
- `FLYTHROUGH_PROFILE_MARKER_FILL_MAX_SIZE`
- `FLYTHROUGH_PROFILE_MARKER_BORDER_MIN_WIDTH`
- `FLYTHROUGH_PROFILE_MARKER_BORDER_MAX_WIDTH`
- `FLYTHROUGH_LABEL`
- `DEFAULT_FLYTHROUGH_SCOPE`
- `DEFAULT_FLYTHROUGH_DURATION`
- `FLYTHROUGH_TRACE_MODE_PROGRESSIVE`
- `FLYTHROUGH_TRACE_MODE_FULL`
- `FLYTHROUGH_MARKER_MODE_TRACE`
- `FLYTHROUGH_MARKER_MODE_NAVIGATION`
- `FLYTHROUGH_MARKER_MODE_HYSTERESIS`
- `FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT`
- `FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET`
- `DEFAULT_FLYTHROUGH_PROGRESSION`
- `DEFAULT_FLYTHROUGH_PROFILE_INFO`
- `DEFAULT_FLYTHROUGH_TRACE`
- `DEFAULT_FLYTHROUGH_MARKER`
- `DEFAULT_FLYTHROUGH_CAMERA`
- `defaultFlythroughProgressionStyle()`
- `defaultFlythroughProfileInfoStyle()`
- `defaultFlythroughTraceStyle()`
- `defaultFlythroughMarkerStyle()`
- `defaultFlythroughCameraStyle()`
- `defaultFlythroughSettings()`
- `clampFlythroughNumber()`
- `normalizeFlythroughProgressionStyle()`
- `normalizeFlythroughProfileInfo()`
- `normalizeFlythroughTrace()`
- `normalizeFlythroughMarker()`
- `normalizeFlythroughCamera()`
- `normalizeFlythroughSettings()`
- `getFlythroughSettings()`
- `ensureFlythroughSettings()`

### Key rules

- `progression.fill.profileMarker` controls the marker fill size.
- `progression.border.profileMarker` controls the marker border width.
- `profileInfo.color` controls the profile-specific flythrough color.
- `trace.remaining.useDefinedTrackStyle` controls whether the remaining trace uses the defined track style or the flythrough-specific settings.
- `trace.remaining.color` and `trace.remaining.opacity` are only used when `useDefinedTrackStyle` is `false`.

### Example

```js
import { normalizeFlythroughProgressionStyle } from '@Core/ui/flythrough/FlythroughProgressionStyle'

const progression = normalizeFlythroughProgressionStyle({
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

## `FlythroughProfileProgress.js`

Adds flythrough metadata to profile rows and converts between samples and chart rows.

### Exports

- `FLYTHROUGH_PROFILE_DISTANCE`
- `FLYTHROUGH_PROFILE_TRACK_SLUG`
- `FLYTHROUGH_PROFILE_TRACK_INDEX`
- `FLYTHROUGH_PROFILE_POINT_INDEX`
- `extendFlythroughProfileDimensions(dimensions)`
- `appendFlythroughProfileMetadata(row, metadata)`
- `flythroughProfileDimensionIndexes(dimensions)`
- `createFlythroughProfileDatasetLookup(dataset, dimensions)`
- `convertFlythroughDistance(distance, unitSystem)`
- `convertFlythroughElevation(altitude, unitSystem)`
- `buildFlythroughProfileMetricSummary(sample, options)`
- `flythroughProfileRowFromSample(sample, options)`
- `flythroughSampleFromProfileRow(row, dimensions, sampler)`
- `buildFlythroughCompletedProfileSource(options)`

### Responsibilities

- preserve a stable `distanceFromStart` index in profile datasets;
- convert live samples into ECharts rows;
- recover a sample from a profile row;
- build the completed portion of the profile up to the current sample.

### Example

```js
import { flythroughProfileRowFromSample } from '@Core/ui/flythrough/FlythroughProfileProgress'

const row = flythroughProfileRowFromSample(sample, {
    dimensions: ['Distance', 'Elevation', 'Time', 'point'],
    unitSystem: 0,
})

// row[0] => displayed distance
// row[1] => displayed elevation
// row[3] => original sample
```

## `FlythroughPlaybackController.js`

Time-based playback controller, independent of GPS point density.

### Exports

- `FLYTHROUGH_EVENT_START`
- `FLYTHROUGH_EVENT_UPDATE`
- `FLYTHROUGH_EVENT_PAUSE`
- `FLYTHROUGH_EVENT_RESUME`
- `FLYTHROUGH_EVENT_STOP`
- `FLYTHROUGH_EVENT_END`
- `FLYTHROUGH_EVENTS`
- `FlythroughPlaybackController`

### Responsibilities

- manage progress, duration, loop, and direction;
- emit flythrough lifecycle events;
- drive playback through `requestAnimationFrame`;
- keep the current sample in sync with the runtime store.

### Example

```js
const controller = new FlythroughPlaybackController()

controller.configure({
    sampler,
    duration: 60,
    progress: 0,
})

controller.on(FLYTHROUGH_EVENT_UPDATE, sample => {
    console.log(sample?.distanceFromStart)
})

controller.start()
```

## `FlythroughPathSampler.js`

Builds a stable path representation from the journey.

### Exports

- `FLYTHROUGH_SCOPE_VISIBLE_TRACKS`
- `FLYTHROUGH_SCOPE_CURRENT_TRACK`
- `FLYTHROUGH_SCOPE_ALL_TRACKS`
- `FlythroughPathSampler`

### Responsibilities

- normalize visible tracks;
- compute cumulative distances;
- interpolate samples by distance or progress;
- provide a stable source for playback and profile rendering.

### Example

```js
const sampler = new FlythroughPathSampler({
    journey,
    scope: 'all-tracks',
    trackSlug: 'track-a',
})

const sample = sampler.atProgress(0.5)
```

## `FlythroughCesiumRenderer.js`

Cesium rendering layer for flythrough.

### Exports

- `FLYTHROUGH_DATA_SOURCE_PREFIX`
- `FlythroughCesiumRenderer`

### Responsibilities

- manage dedicated Cesium data sources;
- render the cursor marker;
- render the completed and remaining trace;
- draw guides and overlays;
- keep the render tree stable across pause/resume.

### Example

```js
const renderer = new FlythroughCesiumRenderer()

renderer.clear()
renderer.render({
    sample,
    progression,
    trace,
})
```

## `FlythroughMode.js`

High-level orchestration for the flythrough feature.

### Exports

- `FlythroughMode`

### Responsibilities

- create and configure the sampler;
- bind the playback controller and renderer;
- relay `start`, `pause`, `resume`, `stop`, and `seek`;
- keep Cesium camera behavior in sync with the runtime;
- forward profile and debug state.

### Example

```js
import { FlythroughMode } from '@Core/ui/flythrough/FlythroughMode'

const flythrough = new FlythroughMode()

flythrough.configure({
    journey,
    duration: 60,
})

flythrough.start()
```

## `FlythroughDebug.js`

Debug helpers for the flythrough runtime.

### Exports

- `isFlythroughDebugEnabled()`
- `recordFlythroughDebug(event, payload)`

### Responsibilities

- record lifecycle and performance events;
- expose diagnostic snapshots;
- help analyze latency, progress, and render behavior.

### Example

```js
import { recordFlythroughDebug } from '@Core/ui/flythrough/FlythroughDebug'

recordFlythroughDebug('flythrough:update', {
    progress: 0.42,
    distance: 1204.3,
})
```

## Execution flow

1. `ensureFlythroughSettings()` initializes the runtime store.
2. `FlythroughMode.configure()` installs sampler and settings.
3. `FlythroughPlaybackController.start()` begins playback.
4. `FlythroughCesiumRenderer` renders the current state in Cesium.
5. `ProfileChart.jsx` draws the profile and the completed segment.

## Profile integration

The profile widget uses the flythrough helpers to:

- append flythrough metadata to profile rows;
- draw the completed section with a clipped overlay;
- place the current marker on the exact chart coordinates;
- keep the marker size controlled by `progression.fill.profileMarker` and `progression.border.profileMarker`.

Example:

```js
import { flythroughProfileRowFromSample } from '@Core/ui/flythrough/FlythroughProfileProgress'

const row = flythroughProfileRowFromSample(sample, {
    dimensions: profileDimensions,
    unitSystem: lgs.settings.unitSystem.current,
})
```

## Where settings come from

The runtime loads `public/settings.yaml` at startup.

Relevant settings path:

- `ui.flythrough.progression`
- `ui.flythrough.profileInfo`
- `ui.flythrough.trace`
- `ui.flythrough.marker`
- `ui.flythrough.camera`

### Remaining trace behavior

When `trace.remaining.useDefinedTrackStyle` is `true`:

- the remaining trace uses the defined track style;
- the flythrough-specific remaining color and opacity are ignored;
- the profile overlay follows the track-defined look during flythrough playback.

When it is `false`:

- the remaining trace uses `trace.remaining.color` and `trace.remaining.opacity`;
- the profile overlay uses the same custom flythrough color during flythrough playback.

The JS constants in `FlythroughProgressionStyle.js` are fallbacks. They are used when the YAML value is missing or invalid.
