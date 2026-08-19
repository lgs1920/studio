# Journey-Driven Cesium Time, Sunlight, Moonlight, Darkness and Shadows

Status: proposed for validation

Target release: `1.1.0`

## 1. Context and objective

LGS1920 Studio already imports journey and track timestamps and uses them in the replay sampler. Cesium still renders regular journey geometry as mostly static data, the Cesium animation and timeline widgets are hidden, and globe lighting is disabled.

This feature makes the active journey the temporal source of truth for the Cesium scene. Journey time controls the Cesium clock, sun position, day and night rendering, terrain lighting, supported object shadows, time-dependent markers, replay, and deterministic video export.

The implementation must distinguish between recorded time, user-defined absolute time, and synthetic relative time. It must never invent an absolute date, movement, altitude, or astronomical state when the source data is insufficient.

## 2. Current implementation

- Cesium animation and timeline widgets are disabled in [`src/components/cesium/Viewer.jsx`](../../src/components/cesium/Viewer.jsx).
- Globe lighting is currently disabled through `lgs.scene.globe.enableLighting = false`.
- Scene shadows are enabled by default, although camera render-quality management may disable them temporarily.
- Track import already detects `feature.properties.coordinateProperties.times` in [`src/Utils/cesium/TrackUtils.js`](../../src/Utils/cesium/TrackUtils.js).
- The replay sampler already extracts point times and computes journey start, stop, elapsed time, and duration in [`src/core/ui/replay/JourneyReplayPathSampler.js`](../../src/core/ui/replay/JourneyReplayPathSampler.js).
- The replay controller publishes a logical frame timeline, but it does not yet make `viewer.clock.currentTime` the shared Cesium time source.

The feature must integrate with the current replay controller instead of introducing a competing playback clock.

## 3. Scope

### Included

- A normalized journey time domain.
- Synchronization between journey time and `viewer.clock`.
- Static representative time for a displayed journey.
- Time-dynamic journey markers and paths.
- Sun-based globe lighting.
- Day, night, sunrise, sunset, twilight, and darkness rendering.
- Moon position and visibility.
- Terrain and supported object shadows.
- Explicit fallback behavior for incomplete data.
- Custom time and lighting controls because native Cesium time widgets are hidden.
- Deterministic replay and video export time.
- Unit, component, integration, and export tests.

### Excluded from the initial version

- Physically accurate moonlight illumination of the terrain.
- Moon-cast terrain shadows.
- Automatic replacement of imagery with a night imagery provider.
- Historical weather reconstruction.
- Automatic correction of invalid source timestamps.
- Treating file creation or import time as recorded journey time.
- Full temporal catalog discovery for imagery providers.

## 4. Temporal source of truth

### 4.1 Source priority

The application must resolve time using this priority:

1. Valid timestamps attached to journey track points.
2. Explicit journey-level `startTime` and `stopTime`.
3. A user-provided journey date, start time, and time zone.
4. A synthetic relative timeline when no absolute date is available.

The application must not use the file import date as the journey date unless the user explicitly selects that behavior.

### 4.2 Journey time range

For a journey containing multiple tracks:

- `journeyStartTime` is the earliest valid timestamp.
- `journeyStopTime` is the latest valid timestamp.
- `journeyDuration` is the difference between those values.
- Each track keeps its own temporal availability when its timestamps are known.
- Gaps between tracks remain gaps and must not silently become movement.

### 4.3 Time zones

Internal values must use ISO 8601 timestamps with an explicit time zone or UTC offset. Cesium values must be represented as `JulianDate` instances.

The UI may display UTC, the journey recording time zone, or the user local time zone. The active display time zone must always be visible.

## 5. Fallback policy for insufficient data

The fallback policy is normative. Every fallback must expose its source and confidence to the UI and must avoid presenting simulated values as recorded facts.

| Data situation | Required fallback | Astronomical guarantee |
| --- | --- | --- |
| No valid timestamps | Use relative journey time only | No real sun, moon, or darkness claim |
| One valid timestamp | Use it as the absolute anchor | Date is known, duration is not known unless supplied |
| Two or more valid timestamps | Use the earliest and latest valid timestamps | Absolute sun and moon time is supported |
| Journey-level start and stop only | Map the journey onto that interval | Absolute sun and moon time is supported |
| Missing journey stop | Use track-derived stop when available, otherwise require user input | No invented absolute stop time |
| Invalid journey date | Ask for correction or switch to relative mode | No astronomical claim until corrected |
| Sparse positions | Interpolate between valid samples inside the known interval | No extrapolation outside the known interval by default |
| Missing position between samples | Hold the previous valid marker position or hide the marker | Path geometry remains independently visible |
| Missing altitude | Use terrain height when available, otherwise use height `0` | Lighting remains available, altitude accuracy is limited |
| Missing terrain provider | Keep globe lighting and day/night rendering | Terrain shadows are disabled |
| Missing terrain normals | Keep globe lighting, reduce terrain shadow quality or use receive-only shadows | Sun direction remains valid, terrain shadow precision is reduced |
| Large timestamp gap | Preserve the gap and pause or interpolate only according to the selected policy | No artificial movement is created silently |
| Invalid sample | Ignore the sample and continue if enough valid samples remain | A warning is exposed when samples are discarded |
| No usable geometry | Keep temporal controls available but do not render a journey marker or path | Celestial rendering may still be displayed if time is known |
| Static imagery with baked shadows | Keep the imagery unchanged and apply Cesium lighting separately | Visual double-darkening is possible and must be documented |
| Missing sun or moon rendering support | Keep the journey clock and replay functional | Celestial visuals may be unavailable |

### 5.1 Minimum data rules

- A valid absolute interval requires either two valid point timestamps or a valid journey-level start and stop.
- A single timestamp may anchor a journey but cannot define a real duration by itself.
- A relative duration may be used only when its simulated status is explicit.
- The application must not extrapolate positions beyond the first or last known sample unless a future product decision explicitly enables hold or extrapolation.
- A temporal gap must not be silently compressed into continuous real-world movement.

### 5.2 Relative simulation mode

When no absolute date is available:

- The journey uses a relative timeline.
- The user may provide a simulation date and time.
- The UI labels the result as simulated.
- The application must not store the simulated date as the journey recording date unless the user explicitly confirms it.
- Current system time may be offered as a convenience preview, but it must be labelled as a simulation.

## 6. Cesium clock behavior

### 6.1 Static journey display

When a journey is displayed without playback:

- `clock.startTime` is the normalized journey start.
- `clock.stopTime` is the normalized journey stop.
- `clock.currentTime` defaults to the temporal midpoint.
- `clock.shouldAnimate` is `false`.
- `clock.clockRange` is `CLAMPED`.

The midpoint is only a representative visual time. It must not be used to animate the journey. The user must be able to select another time manually.

### 6.2 Replay

During replay:

- Replay starts at the journey start time.
- Replay ends at the journey stop time.
- Replay progress maps to an absolute `JulianDate`.
- `viewer.clock.currentTime` follows the active replay sample.
- Pause freezes both journey and environment rendering.
- Resume continues from the same time.
- Seek updates the journey, sun, moon, and shadows immediately.
- Stop restores the configured static display time.

The existing replay controller remains responsible for progression. A Cesium time adapter converts its logical sample time or progress to `JulianDate` and updates the Cesium clock.

### 6.3 Playback modes

The implementation may support real-time playback, accelerated playback, slow motion, deterministic frame playback, reverse playback where supported, loop playback, clamped playback, and manual time scrubbing.

For video export, time must be driven by the export frame index rather than wall-clock time.

## 7. Time-dynamic journey rendering

### 7.1 Journey marker

The journey marker should use a `SampledPositionProperty` when enough valid samples exist. Samples should include absolute timestamp, longitude, latitude, altitude when available, optional orientation, optional speed, and optional activity state.

Interpolation must remain inside the known temporal interval. Sparse data must not create unbounded extrapolation.

### 7.2 Track availability

Track entities should expose a Cesium availability interval when their time range is known. Entities must not be visible outside their availability in temporal playback mode.

### 7.3 Path rendering

The implementation may support full journey path, past path, future path, moving trail, moving lead, completed and remaining path colors, activity phase colors, speed-based colors, elevation-based colors, and time-dependent path materials.

Cesium path portions should be used when past and future sections need different visual treatment.

### 7.4 Orientation

Moving models and directional markers may derive orientation from movement direction. Degenerate points, duplicate positions, invalid samples, large time gaps, pause, and reverse playback must not produce unstable orientation.

## 8. Sunlight, moon, day, night, and atmosphere

### 8.1 Sun-based lighting

The first implementation must enable globe lighting and use the Cesium sun as the scene light source. The current `enableLighting = false` configuration must become time-dependent or be replaced by a journey environment controller.

Changing `viewer.clock.currentTime` must update sun direction, globe illumination, terrain illumination, supported object shadows, atmospheric lighting, and the day/night terminator.

### 8.2 Day and night phases

The scene should support daylight, civil twilight, nautical twilight, astronomical twilight, and night.

Cesium globe lighting provides the primary day/night transition. More detailed twilight labels may require a small astronomical calculation helper.

### 8.3 Moon

The moon may be displayed at the position corresponding to the current Cesium time. The application may expose moon visibility, phase, moonrise, moonset, azimuth, and altitude.

The visible moon does not automatically provide physically accurate moonlight illumination for terrain. Moonlight and moon-cast shadows are outside the initial implementation.

### 8.4 Atmosphere and sky

The scene may include dynamic atmosphere, stars, horizon glow, and fog. These settings must remain configurable because they affect performance and may behave differently in 2D, Columbus View, and 3D modes.

## 9. Shadows

### 9.1 Dynamic shadows

Supported terrain, 3D Tiles, models, ground primitives, and other shadow-capable objects may cast or receive shadows from the sun. Shadow direction must follow the active sun direction.

### 9.2 Terrain requirements

Terrain shadow quality depends on terrain provider, terrain normals, shadow maps, camera distance, and device capability.

Terrain providers should request vertex normals when terrain lighting and shadows are enabled.

If terrain normals are unavailable, the fallback is to keep sun-based illumination but reduce terrain shadow quality, use receive-only shadows, or disable terrain shadows.

### 9.3 Shadow quality

The application may expose shadows disabled, receive-only shadows, full shadow casting, soft shadows, shadow darkness, shadow distance, shadow fade, and low, standard, and high quality presets.

Disabling shadows must not disable day/night globe lighting. Disabling globe lighting must not remove imagery layers.

### 9.4 Imagery with baked shadows

Imagery layers remain unchanged when Cesium lighting is enabled. Shadows already baked into imagery remain part of the texture and may be darkened again by Cesium lighting.

The implementation must validate aerial, road, topographic, and high-contrast imagery for double-darkening.

### 9.5 Moon shadows

Moon visibility and moon shadows are separate concerns. The initial implementation supports sun-based shadows only.

## 10. Imagery and temporal layers

Standard imagery remains static with respect to the Cesium clock. Cesium must not automatically switch to a night imagery provider.

Future integrations may support explicit temporal imagery dimensions such as WMS or WMTS `TIME`. Such behavior must be configured per provider and must not be assumed for ordinary imagery.

## 11. Time-dependent POIs and overlays

POIs may optionally define a timestamp, a start and stop interval, a visibility interval, a duration, or a replay phase.

POIs without temporal data remain governed by their existing visibility settings.

## 12. User interface

Because the native Cesium timeline and animation widgets are hidden, the application should provide custom journey time controls:

- Current date and time
- Active time zone
- Journey start and stop
- Play, pause, stop, and restart
- Seek slider
- Playback speed
- Loop mode
- Lighting toggle
- Sun visibility toggle
- Moon visibility toggle
- Atmosphere toggle
- Dynamic shadows toggle
- Shadow quality
- Time source indicator
- Data confidence or fallback warning

The UI must identify whether the current time comes from recorded data, journey metadata, user input, or simulation.

## 13. Replay and export

The same time domain must be used by live replay, screenshots, draft video export, and high-quality video export.

For a frame at progress `p`:

`absoluteTime = startTime + p × (stopTime - startTime)`

When recorded sample timestamps are available, the interpolated sample timestamp should take precedence over a purely linear global mapping.

Every captured frame must be rendered after updating Cesium time and before the capture operation.

Export must preserve sun position, day/night state, shadow direction, atmosphere, moon position, temporal POIs, and temporal path materials.

## 14. Performance requirements

The implementation must remain compatible with `requestRenderMode`, request a render after programmatic time changes, avoid unnecessary per-frame allocations, prefer `SampledPositionProperty` for dense temporal positions, reuse `JulianDate` result objects in hot loops, limit shadow map distance, avoid high-detail terrain normals when lighting is disabled, provide a low-quality fallback for weak devices, and preserve camera render-quality behavior without silently breaking replay correctness.

## 15. Accessibility and clarity

The UI must show exact current date and time, time zone, recorded or simulated source, lighting state, shadow state, day/night phase, whether the marker is interpolated, and whether data gaps or samples were discarded.

Synthetic time must never be presented as recorded reality.

## 16. Technical modules

### Journey time domain

Responsible for timestamp extraction, normalization, source selection, fallback behavior, time zones, and conversion between relative and absolute time.

### Cesium journey time adapter

Responsible for configuring `viewer.clock`, updating `currentTime`, mapping replay samples to `JulianDate`, and requesting scene renders.

### Cesium temporal entities

Responsible for sampled positions, availability, orientation, path progression, and time-dependent POIs.

### Cesium environment controller

Responsible for globe lighting, sun, moon, atmosphere, sky, fog, terrain shadows, and shadow quality.

### Journey time controls

Responsible for time display, playback, seeking, speed, representative static time, time zone, fallbacks, and lighting controls.

## 17. Acceptance criteria

### Time resolution

- A journey with valid track timestamps resolves the correct earliest and latest times.
- Journey-level start and stop values are respected.
- ISO 8601 offsets are preserved.
- A journey with no absolute date enters an explicit relative or user-defined mode.
- Import time is never silently used as recorded time.

### Fallbacks

- Zero valid timestamps does not claim real sun or moon position.
- One timestamp can anchor a date but cannot invent a real duration.
- Sparse positions interpolate only inside known bounds.
- Invalid samples are discarded only when enough valid data remains.
- Large gaps are preserved or visibly flagged.
- Missing altitude, terrain, normals, or imagery capabilities degrade gracefully.
- No fallback silently invents movement or an absolute date.

### Static display

- The Cesium interval uses the journey start and stop.
- The default static time is the midpoint.
- The user can select another time.
- Sun, moon, lighting, and shadows update immediately.

### Replay

- Replay starts at journey start.
- Replay ends at journey stop.
- Cesium time follows replay progress.
- Pause, resume, stop, and seek remain synchronized.
- Export frames use deterministic Cesium times.

### Day, night, and shadows

- Daylight and night are visible at the correct absolute time.
- Sunrise and sunset change the scene progressively.
- The sun follows the journey date and time.
- The moon follows the journey date and time when enabled.
- Terrain and supported objects follow the sun direction for shadows.
- Shadow quality can be reduced independently from globe lighting.
- Imagery remains present and is validated for double-darkening.

## 18. Test plan

Tests must cover zero, one, and multiple valid timestamps, journey-level start and stop, invalid timestamps and dates, UTC and non-UTC offsets, multiple tracks and large gaps, sparse and duplicate positions, missing altitude, missing terrain and terrain normals, midpoint calculation, Cesium clock configuration, replay mapping, pause, resume, stop, seek, day, night, sunrise, sunset, midnight, lighting and shadow toggles, imagery with baked shadows, deterministic export frame times, request-render behavior, and low-quality fallback behavior.

## 19. Proposed feature issues

The following feature issues are proposed for the LGS1920 project and target release `1.1.0`. They must be validated before creation.

### Feature 1: Add a normalized journey time domain

**Context**

Journey data may contain track timestamps, journey-level start and stop times, or no absolute time information.

**Requested behavior**

Create a normalized journey time domain that resolves start, stop, duration, source, time zone, data gaps, and fallback mode.

**Acceptance criteria**

- Track timestamps are detected and normalized.
- Earliest and latest valid timestamps define the global interval.
- One timestamp does not create a fake duration.
- Missing timestamps enter an explicit relative or user-defined mode.
- UTC offsets are preserved.
- Data source and fallback state are exposed to the UI.

### Feature 2: Synchronize the Cesium clock with the active journey

**Context**

The replay system currently has a logical timeline that is not yet the shared Cesium clock source.

**Requested behavior**

Synchronize `viewer.clock` with the selected journey and replay progression.

**Acceptance criteria**

- Static journeys configure start, stop, and midpoint current time.
- Replay updates `viewer.clock.currentTime`.
- Pause, resume, stop, and seek remain synchronized.
- Relative mode remains explicitly simulated.
- Only one system owns replay progression.

### Feature 3: Render journey tracks as time-dynamic Cesium entities

**Context**

Regular journey tracks are mainly rendered as static geometry.

**Requested behavior**

Expose time-aware positions, availability, orientation, and path progression.

**Acceptance criteria**

- Markers follow recorded timestamps.
- Track availability is respected.
- Sparse samples do not extrapolate by default.
- Past and future path sections can be distinguished.
- Invalid samples do not break the scene.

### Feature 4: Add journey-driven sun, moon, and day/night rendering

**Context**

Globe lighting is currently disabled, so the Cesium scene does not follow journey time for day and night.

**Requested behavior**

Use journey time to control sun position, moon position, atmospheric state, twilight, and darkness.

**Acceptance criteria**

- Globe lighting follows Cesium clock time.
- Day and night match the journey date and time.
- Sunrise and sunset are visible.
- The moon follows the current time when enabled.
- Moon visibility is not presented as physically accurate moonlight terrain illumination.
- The UI exposes the current day/night phase and time source.

### Feature 5: Add terrain and object shadow synchronization

**Context**

Scene shadows exist, but they are not yet part of a journey-driven environment policy and may be changed by quality management.

**Requested behavior**

Make supported dynamic shadows follow the journey-driven sun while preserving quality controls and graceful fallbacks.

**Acceptance criteria**

- Terrain and supported objects cast or receive shadows according to settings.
- Shadow direction changes with journey time.
- Missing terrain normals reduce quality without breaking lighting.
- Missing terrain disables terrain shadows without breaking day/night.
- Low, standard, and high shadow modes are supported.
- Replay does not silently lose shadow correctness.

### Feature 6: Add journey time, lighting, and fallback controls

**Context**

Native Cesium time widgets are hidden and incomplete data requires explicit user feedback.

**Requested behavior**

Add custom controls for date, time, time zone, replay, lighting, shadows, and fallback state.

**Acceptance criteria**

- Current date, time, and time zone are visible.
- Play, pause, stop, seek, and speed controls are available.
- Recorded and simulated time are distinguishable.
- Lighting and shadow states are visible.
- Data gaps and fallback modes are announced accessibly.

### Feature 7: Make replay and video export time-deterministic

**Context**

Sun position, darkness, and shadows must match the journey time of every exported frame.

**Requested behavior**

Drive Cesium clock time from the logical replay or export frame timeline.

**Acceptance criteria**

- Every frame maps to a deterministic Cesium time.
- Lighting, shadows, marker position, and overlays use the same time.
- Export does not depend on wall-clock timing.
- Re-rendering the same frame produces the same temporal state.

### Feature 8: Validate imagery and lighting interactions

**Context**

Imagery may contain baked shadows that can become darker when Cesium lighting is enabled.

**Requested behavior**

Validate existing imagery providers and document expected visual behavior.

**Acceptance criteria**

- Imagery remains visible with globe lighting enabled.
- Baked imagery shadows remain intact.
- Double-darkening cases are identified and documented.
- The application does not assume that a provider has a night imagery variant.

## 20. Project planning proposal

- Repository: `lgs1920/studio`
- GitHub Project: `LGS1920`
- Target release: `1.1.0`
- Proposed issue type: feature
- Proposed common labels: `enhancement`, `Core`, `Journey`
- Additional labels: `UI` for Feature 6, `Video / shots` for Feature 7, and `Layers` for Feature 8 if the final scope includes temporal imagery validation
- Proposed initial status: to be validated against the project available status options
- Priority: to be validated per issue
- Assignee: to be validated before issue creation

No issue should be created until the proposed issue bodies, priorities, labels, status, assignee, and target release are explicitly validated.
