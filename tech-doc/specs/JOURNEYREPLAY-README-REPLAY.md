# JourneyReplay Component Notes

This document is the canonical spec for the Journey Replay journey mode.
It consolidates the component notes and the replay/video issue analysis into
one source of truth.

## 1. Goal

JourneyReplay replays a journey as a continuous, time-based experience:

- a visible cursor that follows the real trace;
- a fixed total duration, independent of GPS point density;
- a camera that can follow the trace or a derived 3D camera path;
- synchronization with the profile widget, overlays, and video recording.

The product name should remain `JourneyReplay`. The older `JourneyReplayRunner`
can continue to exist as a compatibility layer while the runtime is refactored
toward a cleaner replay core.

## 2. Current implementation status

The codebase already has the basic building blocks for Journey Replay:

- `src/core/ui/JourneyReplayRunner.js` advances the replay and emits tick
  events for the legacy flow;
- `src/Utils/cesium/JourneyReplayUtils.js` initializes the current replay mode;
- `src/core/ui/Profiler.js` prepares profile data and shows the current sample
  on the chart;
- `src/components/Profile/ProfileChart.jsx` renders the profile chart and can
  host replay hover interactions;
- `src/components/MainUI/PanoramaWidget.jsx` is the best current reference for
  continuous camera control;
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx` is the correct
  integration point for replay/video synchronization because the actual video
  start is `ScreenMediaRecorder.events.START`, not the user click.

The current replay loop is still too dependent on point count and timer ticks.
For reliable video, it must be driven by an absolute clock through
`requestAnimationFrame`.

## 3. Canonical architecture

JourneyReplay should be split into a small set of focused modules:

1. `JourneyReplayPathSampler`
   - builds a stable playback path from the journey data
   - interpolates between samples by distance or progress

2. `JourneyReplayPlaybackController`
   - manages play, pause, resume, stop, duration, direction, and looping
   - exposes the current replay progress and sample

3. `JourneyReplayCesiumRenderer`
   - draws the cursor, trace, completed path, guides, and Cesium overlays

4. `JourneyReplayCameraController`
   - drives the camera in marker-only, track-follow, or Bezier-camera modes

5. `JourneyReplayVideoSync`
   - bridges recorder events with replay playback for live capture

6. `ReplayFrameTimeline`
   - converts duration and FPS into deterministic replay frames

7. `ReplayOverlayResolver`
   - resolves which overlays and widgets are visible on a given frame

8. `ReplayVideoRenderSession`
   - renders one frame at a time for live draft capture or deferred export

This split keeps replay, overlays, and capture aligned without letting each
subsystem invent its own time source.

## 4. Shared frame contract

The main correction from the replay/video analysis is simple:

**there must be one authoritative frame contract for replay, widgets, and
video export.**

Each frame should resolve the same logical state:

```js
{
  frameIndex,
  frameTimeMs,
  progress,
  sample,
  camera,
  visibleOverlays,
  widgetState,
}
```

That frame state must then drive the scene render, the overlays, and the video
encoder. It should not be reconstructed independently by the recorder, the
composer, and the widgets.

## 5. Data model

The sampler should normalize the journey into a stable row format:

```js
{
  progress,
  trackSlug,
  trackIndex,
  pointIndex,
  longitude,
  latitude,
  altitude,
  distanceFromStart,
  remainingDistance,
  segmentDistance,
}
```

Important rules:

- include the real first point with `distanceFromStart = 0`;
- preserve track boundaries for multi-track journeys;
- keep a global cumulative distance;
- use binary search for frame lookup instead of scanning the full path on each
  update;
- interpolate between samples for smooth playback.

## 6. Playback rules

The playback controller should compute progress from elapsed time:

```js
elapsed = now - startedAt - pausedDuration
progress = clamp(elapsed / duration, 0, 1)
sample = sampler.atProgress(progress)
```

It should not advance point by point.

This gives:

- exact duration control;
- pause and resume without drift;
- consistent output for video capture;
- smoother animation at 30, 45, or 60 FPS.

Useful lifecycle events:

- `replay/start`
- `replay/pause`
- `replay/resume`
- `replay/update`
- `replay/hover`
- `replay/stop`
- `replay/end`

## 7. Cesium rendering

The Cesium renderer should own the replay-specific scene data.

Typical entities:

- `cursor`: the current replay marker
- `completedLine`: the part of the path already traversed
- `cameraCurve`: the optional 3D camera path
- `cameraPoint`: the current camera position on that path
- `bezierHandles`: editable control points

The cursor should stay readable without hiding the trace. A small configurable
radius, a clear border, and a trace-derived color are the right defaults.

## 8. Camera behavior

Recommended camera modes:

- `marker-only`: the map stays fixed and only the cursor advances
- `track-follow`: the camera follows the real trace
- `bezier-camera`: the camera follows a 3D curve and keeps looking at the
  trace sample

Camera parameters to keep:

- total duration;
- camera height;
- absolute or relative altitude mode;
- pitch and heading offsets;
- optional orbit distance.

Implementation notes:

- follow the `PanoramaWidget` pattern for continuous camera updates;
- use `requestAnimationFrame`;
- avoid calling `flyTo` on every frame;
- call `setView` with an orientation derived from the camera and target point;
- map wheel input to camera height and drag input to pitch / heading.

## 9. 3D Bezier editor

The Bezier editor should stay in React and use Three.js for the local editing
surface.

Recommended model:

```js
{
  mode: 'bezier-camera',
  altitudeMode: 'relative',
  heightOffset: 300,
  controlPoints: [
    { progress: 0, position: {...}, in: null, out: {...} },
    { progress: 0.35, position: {...}, in: {...}, out: {...} },
    { progress: 1, position: {...}, in: {...}, out: null }
  ]
}
```

The editor should:

- convert WGS84 to a local ENU space for editing;
- display the journey trace and a simplified relief mesh;
- allow the user to move Bezier control points;
- save the result back as a replay camera model.

## 10. Profile widget integration

When the profile widget is visible:

- the completed part of the profile should be highlighted;
- the current sample should be visible on the chart;
- hover on the profile should emit `replay/hover`;
- hover on the map should resolve the nearest sample and emit the same event.

The chart should not rely on a separate visibility heuristic. It should consume
the same replay sample that drives the map and the video capture.

## 11. Overlay and video synchronization

The replay/video analysis exposed one core problem:

**widget visibility and video composition cannot be inferred from DOM presence
alone.**

The system needs an explicit overlay resolver.

That resolver should decide:

- which widgets exist on a frame;
- which widgets are visible;
- which order they are composed in;
- which state is active for live draft capture versus deferred export.

The recorder, composer, and widgets should remain generic. Replay-specific
logic belongs in the replay layer.

The correct sync point for video is `ScreenMediaRecorder.events.START`.
Replay playback must follow the recorder lifecycle:

1. prepare the replay and the video UI;
2. start replay playback when the recorder starts;
3. mirror pause and resume;
4. stop replay when recording stops or cancels;
5. stop the recorder automatically when replay reaches the end and auto-stop
   is enabled.

## 12. Validation notes

The earlier video issue analysis did not contradict the component notes. It
identified a missing frame authority.

The validated conclusion is:

- live draft capture and deferred export should share the same replay timeline;
- the video stack should stay generic;
- replay-specific visibility must be resolved before composition;
- the end of replay should be an explicit final-frame state, not just a chain
  of delayed events.

This is the main design rule that keeps JourneyReplay reliable.

## 13. UI integration points

Likely integration points remain:

- a JourneyReplay entry in the main toolbar;
- a persistent replay widget in the main UI;
- a dedicated replay drawer;
- a replay metric overlay;
- a replay controls widget for playback and recording control.

The exact UI shape can evolve, but the replay state model should remain stable.

## 14. Acceptance criteria

JourneyReplay is considered coherent when:

- the replay runs on exact duration rather than point count;
- the cursor starts at the true beginning and ends at the true end;
- pause and resume do not drift;
- profile hover and map hover resolve the same sample;
- recorder start is the replay sync point;
- the final frame captured before stop matches the replay state;
- overlay visibility does not depend on stale DOM state.
