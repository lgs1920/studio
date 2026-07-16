# Drone Camera Path Architecture

## Goal

Add a camera manager able to play a drone-like camera trajectory over an exact
duration. The camera is treated as a drone: it has its own GPS position, smooth
motion constraints, an orientation, and one or more points of interest to look
at while it moves.

This must not be implemented as another block of camera logic inside Journey
Replay. The path model should be reusable, deterministic, and testable without a
live Cesium scene. Cesium should only be used by adapters and runtime services.

## Confirmed Decisions

- The first deliverable is an architecture document.
- Public path coordinates are GPS values: `latitude`, `longitude`, `height`.
- Public angles are degrees: `heading`/`yaw`, `pitch`, and optional `roll`.
- The drone can look at one point, a sequence of points, or a group of points.
- The drone can perform a real 360-degree move around a point while continuing a
  larger travel path.
- Altitude may be constant or animated, but never with abrupt steps.
- If the target point becomes hidden, the runtime must be able to move the drone
  dynamically so the target becomes visible, then return smoothly to the
  nominal path.
- V1 uses `bezier-easing` for CSS-like cubic-bezier temporal easing. The public
  API can accept both named easing values and `[x1, y1, x2, y2]` easing curves.
- V2 adds a Three.js authoring and preview environment outside Cesium. It must
  render both the Cesium route/reference path and the drone camera path, and it
  must allow the drone path to be traced dynamically with 3D Bezier segments.
  Cesium remains the runtime map and camera engine.

## Core Concepts

### Pose

A pose is the full camera state at a given time.

```js
{
  time: 4.2,
  progress: 0.35,
  position: {
    latitude: 45.9237,
    longitude: 6.8694,
    height: 2450
  },
  effectiveTarget: {
    latitude: 45.9241,
    longitude: 6.8702,
    height: 1900
  },
  heading: 82,
  pitch: -28,
  roll: 0,
  distance: 900
}
```

`position` is the actual drone location. `effectiveTarget` is the target point
after target interpolation, group-centroid calculation, or runtime correction.
The Cesium adapter converts positions to `Cartesian3` and angles to radians.

### Separate Tracks

The drone path and the look-at path must be separate. This keeps cases such as
"move forward while doing a 360 around a point" understandable.

```js
{
  duration: 18,
  positionTrack: {
    keyframes: [
      { at: 0, position: { latitude, longitude, height } },
      { at: 1, position: { latitude, longitude, height } }
    ]
  },
  targetTrack: {
    mode: "sequence",
    keyframes: [
      { at: 0, target: firstPoi },
      { at: 0.45, target: firstPoi },
      { at: 0.75, target: secondPoi },
      { at: 1, target: thirdPoi }
    ]
  }
}
```

`at` is normalized in `[0, 1]`. The runtime maps it to real time using
`duration`.

## Target Model

The target system must support:

- `single`: one point is looked at for the whole path.
- `sequence`: the target changes over time and is interpolated smoothly.
- `group-centroid`: a group of points is reduced to a geometric center.
- `group-weighted`: a weighted group keeps an important point dominant while
  still considering the surrounding points.
- `dynamic`: an external runtime source provides the target, for example the
  current Journey Replay sample.

For groups, centroid calculations should be done in a local ENU frame, then
converted back to GPS. Averaging latitude/longitude directly is only acceptable
for very small areas.

Example weighted target group:

```js
{
  targetTrack: {
    mode: "group-weighted",
    points: [
      { id: "summit", latitude: 45.8326, longitude: 6.8652, height: 4808, weight: 3 },
      { id: "ridge", latitude: 45.8300, longitude: 6.8700, height: 4100, weight: 1 },
      { id: "glacier", latitude: 45.8260, longitude: 6.8580, height: 3400, weight: 1 }
    ],
    framingRadius: 1600
  }
}
```

`framingRadius` is not applied directly by Cesium in V1. It is metadata for a
future editor or auto-framing feature.

## Position Modes

### GPS Path

The primary mode is a real GPS path. Each keyframe gives the drone position.

```js
{
  mode: "gps-path",
  position: { latitude, longitude, height },
  target: { latitude, longitude, height }
}
```

This mode is the most general. The drone is not constrained to orbit a target.

### Derived Orbit

For authoring convenience, a keyframe may also be derived from a target,
heading, pitch, and distance.

```js
{
  mode: "orbit",
  target: { latitude, longitude, height },
  heading: 90,
  pitch: -30,
  distance: 1200
}
```

The engine converts this to the same final pose as a GPS path. `orbit` is an
authoring shortcut, not a separate runtime.

## 360-Degree Maneuver During Travel

A 360-degree move around a point should be modeled as a maneuver overlaid on the
main trajectory, not as a special camera mode.

Two variants exist:

- `look360`: the drone follows the main GPS path while the view rotates around
  or stays locked to a point.
- `orbit360`: the drone position performs a real circular move around a pivot,
  then rejoins the main path.

For a drone-like result, `orbit360` should be the default interpretation.

```js
{
  duration: 22,
  positionTrack: {
    keyframes: [
      { at: 0, position: approachPoint },
      { at: 1, position: exitPoint }
    ]
  },
  targetTrack: {
    mode: "single",
    target: summit
  },
  maneuvers: [
    {
      type: "orbit360",
      from: 0.32,
      to: 0.62,
      pivot: summit,
      turns: 1,
      direction: "clockwise",
      radius: { from: 1200, to: 900, easing: "smootherstep" },
      height: { from: 2900, to: 3100, easing: "smootherstep" },
      blendIn: 0.08,
      blendOut: 0.1,
      targetPolicy: "pivot"
    }
  ]
}
```

Composition rules:

- outside the maneuver, the drone follows `positionTrack`;
- during `orbit360`, the position is computed in a local frame around `pivot`;
- `blendIn` and `blendOut` join the maneuver without a visible break;
- `turns` may be `0.5`, `1`, `1.5`, etc.;
- `targetPolicy: "pivot"` keeps the camera looking at the point being orbited;
- dynamic pivots can be supported later for Journey Replay integration.

V1 can support only fixed pivots. Dynamic pivots can be a later replay feature.

## Timing, Acceleration, and Drone Motion Profiles

The total duration is exact. A `duration: 18` path lasts 18 seconds.

The motion model must avoid abrupt changes in:

- horizontal position;
- altitude;
- heading/yaw;
- pitch;
- roll;
- target distance in orbit-derived segments.

Recommended V1 easing profiles:

- `linear`: debug only, or very short utility moves;
- `smoothstep`: smooth start and stop;
- `smootherstep`: recommended default for drone-like movement;
- `ease-in-out-sine`: natural for reveal and orbit shots;
- `hold`: a constant value that still blends smoothly when entering or leaving
  the hold.

Example:

```js
{
  motionProfile: {
    defaultEasing: "smootherstep",
    maxYawRate: 45,
    maxPitchRate: 20,
    maxVerticalSpeed: 6,
    maxVerticalAcceleration: 2
  }
}
```

V1 can treat `max*` values as validation warnings. A later version can use them
to compute minimum feasible segment durations.

### Segment Easing

Each segment may specify its own easing.

```js
{
  at: 0.55,
  easing: "ease-out"
}
```

Recommended V1 values:

- `linear`
- `smoothstep`
- `smootherstep`
- `ease-in`
- `ease-out`
- `ease-in-out`
- `ease-in-out-sine`
- cubic-bezier `[x1, y1, x2, y2]`, evaluated with `bezier-easing`

`bezier-easing` is only a temporal easing tool. It maps a normalized segment
progress to another normalized progress. It does not define the spatial 3D
Bezier geometry used later for the drone path preview/editor.

### Global Time Remapping

For more detailed acceleration control, a path can define a global time remap.

```js
{
  duration: 20,
  timeRemap: [
    { time: 0, progress: 0 },
    { time: 0.25, progress: 0.06 },
    { time: 0.65, progress: 0.82 },
    { time: 1, progress: 1 }
  ]
}
```

This allows slow departure, fast middle motion, and a slow ending. V1 can start
with segment easing. Global `timeRemap` should move into the later advanced
timing version after the V2 path preview exists.

## Altitude

Altitude may be constant or animated. It must always be smooth.

### Constant Altitude

```js
{
  heightTrack: {
    mode: "constant",
    height: 2800
  }
}
```

The drone keeps the same world height for the whole path.

### Keyframed Altitude

```js
{
  heightTrack: {
    mode: "keyframes",
    keyframes: [
      { at: 0, height: 2200 },
      { at: 0.4, height: 3100, easing: "smootherstep" },
      { at: 1, height: 2800, easing: "ease-in-out-sine" }
    ]
  }
}
```

Height can also be stored directly inside `positionTrack`, but a separate
`heightTrack` is cleaner for presets and automatic corrections.

### Terrain Offset Altitude

Useful in mountains:

```js
{
  heightTrack: {
    mode: "terrain-offset",
    offset: 350,
    smoothingWindow: 1.5,
    easing: "smootherstep"
  }
}
```

The runtime samples terrain height, adds the offset, then smooths the resulting
height curve to avoid jumps caused by terrain relief or late tile loading.

### Hard Rule

No altitude change may be applied as an instant step during playback. Even a
terrain correction must be damped over several frames or a minimum duration.

## Interpolation

### GPS Coordinates

Public coordinates stay in `latitude`, `longitude`, `height`. For non-trivial
paths, interpolation should not be simple degree interpolation.

Recommended approach:

- convert GPS points to Cesium `Cartesian3` or a local ENU frame;
- interpolate in that frame;
- convert back to GPS only when a public pose is requested.

For mountain-scale paths, a local ENU frame centered on the first target or path
centroid is stable and easy to edit.

### Angles

`heading` must use shortest-path angular interpolation, so `350 -> 10` degrees
does not turn almost a full circle.

`pitch` and `roll` can be linearly interpolated in V1 with clamps:

- `pitch`: recommended `[-89, 0]` degrees;
- `roll`: recommended `[-45, 45]` degrees.

### Look-At Strategy

Two strategies should exist:

- `lookAtTarget: true`: the actual camera direction is computed from
  `position -> effectiveTarget`;
- `lookAtTarget: false`: the runtime applies `heading`, `pitch`, and `roll`
  directly.

For the drone-looking-at-a-point use case, V1 should default to
`lookAtTarget: true`.

### Multi-Target Look-At

When the logical target changes, the camera must not snap. The engine computes
one effective target:

```js
effectiveTarget = blendTargets(targetA, targetB, easedRatio)
```

For target groups, the effective target may be:

- an ENU centroid;
- a weighted ENU centroid;
- a primary point, with other points only used for framing metadata;
- a moving point on a polyline.

The camera always looks at `effectiveTarget`.

## Target Visibility and Dynamic Correction

The drone must react if the looked-at point becomes hidden. The user-defined path
remains the nominal path. The runtime computes a temporary corrected pose to
make the target visible, then returns smoothly to the nominal path.

Visibility states:

- `visible`: the target is visible and in the useful frame area;
- `occluded`: the line camera -> target is blocked by terrain, 3D tiles, or
  another rendered object;
- `out-of-frame`: the target is not inside the useful screen or video crop area;
- `uncertain`: the scene cannot confirm visibility, often because terrain or 3D
  tiles are not fully loaded.

### Runtime Loop

First compute the nominal pose:

```js
const nominalPose = path.poseAtProgress(progress)
```

Then evaluate target visibility:

```js
const visibility = visibilityResolver.evaluate({
  cameraPosition: nominalPose.position,
  target: nominalPose.effectiveTarget,
  crop: videoCropRect,
  scene
})
```

If the target is hidden, propose a corrected pose:

```js
const correctedPose = visibilityResolver.correct({
  nominalPose,
  previousCorrection,
  constraints: visibilityPolicy
})
```

The applied pose is a smooth blend:

```js
appliedPose = blend(nominalPose, correctedPose, correctionWeight)
```

`correctionWeight` must be eased. It must never jump instantly from `0` to `1`.

### Occlusion Detection

Recommended Cesium approach:

- convert `position` and `effectiveTarget` to `Cartesian3`;
- cast a ray from camera to target;
- use `scene.pickFromRay` or `scene.pickFromRayMostDetailed` when available;
- use `scene.sampleHeight` or `sampleHeightMostDetailed` on intermediate points
  when ray picking is unavailable or too costly;
- project the target to screen coordinates to verify it stays inside the useful
  frame or video crop.

The detection should be conservative. If Cesium cannot confirm visibility, the
status should be `uncertain`, not `visible`.

### Dynamic Correction Candidates

The correction engine should search for the smallest acceptable correction.

V1 candidates:

- raise the drone;
- increase distance to target;
- lateral left/right offset in the target local frame;
- slight orbit around the target;
- height + lateral combination.

Example policy:

```js
{
  visibilityPolicy: {
    enabled: true,
    mode: "soft-correction",
    testIntervalMs: 120,
    returnDelayMs: 500,
    returnDuration: 1.5,
    maxHeightDelta: 600,
    maxHorizontalDelta: 900,
    maxDistanceDelta: 1200,
    candidateHeights: [80, 160, 320, 600],
    candidateLaterals: [-450, -220, 220, 450],
    candidateRadiusDeltas: [200, 500, 1000],
    easing: "smootherstep"
  }
}
```

Scoring should prefer:

- smallest correction;
- continuity with the previous correction;
- reasonable altitude;
- vertical speed compatible with a drone;
- easy return to the nominal path.

### Return to Nominal Path

When the target becomes visible from the nominal pose, the runtime waits
`returnDelayMs` to avoid oscillation, then fades correction to zero:

```js
correctionWeight: 1 -> 0 over returnDuration
```

The return must preserve:

- smooth latitude/longitude/height;
- smooth pitch;
- smooth yaw;
- smooth target distance.

The corrected path is not persisted by default. It may be stored as debug data
or baked into a deterministic export path if the user requests it.

### Correction State

The controller must keep correction state:

```js
{
  active: true,
  reason: "occluded",
  startedAt: 8.4,
  lastVisibleAt: 10.2,
  correctionWeight: 0.72,
  offsetENU: { east: 120, north: -40, up: 260 },
  candidateScore: 0.34
}
```

This avoids left/right correction flipping from one frame to the next.

## Proposed API

### Pure Engine

```js
const path = new DroneCameraPath(definition)

path.duration
path.poseAtTime(6.5)
path.poseAtProgress(0.4)
path.validate()
```

The pure engine:

- does not read `lgs`;
- does not mutate Cesium camera state;
- returns deterministic poses;
- is testable with Vitest.

### Runtime Controller

```js
const controller = new DroneCameraPathController({
  camera: lgs.viewer.camera,
  scene: lgs.scene,
  cameraManager: __.ui.cameraManager
})

controller.load(pathDefinition)
controller.play()
controller.pause()
controller.resume()
controller.stop()
controller.seek(0.5)
```

The controller:

- uses `requestAnimationFrame`;
- applies the pose with `camera.setView`;
- calls `scene.requestRender()`;
- enables `cameraManager.optimizeContinuousCameraRender()` during playback;
- restores `cameraManager.restoreContinuousCameraRender()` on stop;
- restores Cesium controls if it disabled them.

## Project Integration

Proposed files:

```text
src/core/ui/camera/DroneCameraPath.js
src/core/ui/camera/DroneCameraPathController.js
src/core/ui/camera/DroneCameraPathCesiumAdapter.js
src/core/ui/camera/DroneCameraVisibilityResolver.js
src/core/ui/camera/DroneCameraBezier3DPath.js        // V2 authoring helper
src/core/ui/camera/DroneCameraPathThreePreview.js    // V2 preview surface
src/core/ui/camera/DRONE_CAMERA_PATH_ARCHITECTURE.md
src/__tests__/drone-camera-path.test.js
src/__tests__/drone-camera-visibility.test.js
```

### Relation with CameraManager

`CameraManager` should remain responsible for global camera state:

- save/restore;
- existing orbit mode;
- continuous-render optimization;
- camera flight locking.

The new controller should be a client of `CameraManager`, not a replacement.

Minimal future integration:

```js
__.ui.cameraManager.dronePath.load(definition)
__.ui.cameraManager.dronePath.play()
__.ui.cameraManager.dronePath.stop()
```

Alternative:

```js
__.ui.droneCameraPath.play(definition)
```

The second option avoids making `CameraManager` larger, but introduces another
UI manager.

### Relation with JourneyReplayMode

Journey Replay already contains substantial camera logic. The drone path engine
should prevent further growth inside `JourneyReplayMode`.

Recommended integration:

- replay owns `progress` in `[0, 1]`;
- the drone engine computes the pose for that progress;
- the replay controller applies the pose through the Cesium adapter;
- existing `trace`, `navigation`, and `hysteresis` modes remain unchanged.

Later, `track-follow` and `bezier-camera` can become generated
`DroneCameraPath` definitions.

## V2 Three.js Path Preview and 3D Bezier Drone Path

V2 should add a 3D authoring and preview environment outside Cesium. This
environment is an editing surface, not the authoritative runtime. The core path
definition remains independent and the Cesium adapter remains responsible for
applying the final camera pose in the real scene.

The V2 preview must render:

- the Cesium route or journey path as a reference line;
- the drone camera path as a separate line;
- target points and target groups;
- 360 maneuver pivots, radii, and blend windows;
- optional debug overlays for visibility correction candidates.

### Coordinate Frame

The Three.js scene should use a local ENU frame in meters:

- choose an origin from the journey path centroid, the first drone point, or the
  main target point;
- convert GPS `latitude`/`longitude`/`height` to ENU for editing;
- render all reference paths, targets, and drone points in that local frame;
- keep the public path source in WGS84 GPS coordinates;
- convert edited ENU points back to GPS when exporting a `DroneCameraPath`
  definition.

This avoids editing directly in longitude/latitude degrees and gives predictable
control handles in a standard 3D scene.

### Dynamic 3D Bezier Authoring

The drone path can be authored as cubic Bezier segments in the local ENU frame.
The editor updates the rendered path dynamically whenever a point or handle
moves.

```js
{
  authoring: {
    mode: "bezier-3d",
    frame: "local-enu",
    origin: { latitude, longitude, height },
    segments: [
      {
        from: { x: 0, y: 0, z: 120 },
        control1: { x: 180, y: 30, z: 180 },
        control2: { x: 420, y: 260, z: 220 },
        to: { x: 680, y: 320, z: 160 },
        easing: [0.42, 0, 0.58, 1]
      }
    ]
  }
}
```

`x`, `y`, and `z` are local meters. `z` is height in the local up direction.
The segment `easing` is temporal and is evaluated by `bezier-easing`; the 3D
curve itself is spatial geometry.

Implementation options:

- use Three.js `CubicBezierCurve3` for preview rendering;
- keep a small local cubic Bezier evaluator for deterministic export and tests;
- resample the curve by arc length for visual markers and speed analysis;
- export either sampled GPS keyframes for V1 runtime compatibility or preserve
  Bezier control points for a later native curve runtime.

### Cesium Path Versus Drone Path

The preview must show both paths because they answer different questions:

- the Cesium path is the subject, replay, or reference route being filmed;
- the drone path is the camera/drone trajectory;
- the target track defines what the drone looks at over time.

A simple journey replay may therefore display three related curves: the subject
path, the drone path, and the target interpolation path. They should not be
merged in the data model.

### Runtime Boundary

The V2 Three.js layer should not call `viewer.camera` directly. It should emit a
`DroneCameraPath` definition and preview samples. Runtime playback still goes
through:

```text
DroneCameraPath -> DroneCameraPathController -> DroneCameraPathCesiumAdapter
```

This keeps Cesium-specific scene state out of the editor and keeps video export
deterministic.

## Useful Presets

### Orbit Around One Point

```js
{
  duration: 12,
  keyframes: [
    { at: 0, mode: "orbit", target, heading: 0, pitch: -30, distance: 1200 },
    { at: 1, mode: "orbit", target, heading: 360, pitch: -30, distance: 1200 }
  ]
}
```

### Reveal

```js
{
  duration: 8,
  keyframes: [
    {
      at: 0,
      position: { latitude, longitude, height: 1200 },
      target,
      easing: "ease-in"
    },
    {
      at: 1,
      position: { latitude, longitude, height: 2600 },
      target,
      easing: "ease-out"
    }
  ]
}
```

### GPS Travelling

```js
{
  duration: 24,
  keyframes: [
    { at: 0, position: startDrone, target: firstTarget },
    { at: 0.4, position: midDrone, target: firstTarget },
    { at: 0.75, position: passDrone, target: secondTarget },
    { at: 1, position: endDrone, target: secondTarget }
  ]
}
```

### 360 Orbit During Travelling

```js
{
  duration: 20,
  targetTrack: { mode: "single", target: poi },
  positionTrack: {
    keyframes: [
      { at: 0, position: approach },
      { at: 1, position: exit }
    ]
  },
  maneuvers: [
    {
      type: "orbit360",
      from: 0.4,
      to: 0.7,
      pivot: poi,
      turns: 1,
      radius: { from: 1000, to: 1000 },
      height: { from: 2600, to: 2600 },
      easing: "ease-in-out-sine"
    }
  ]
}
```

### Reveal With Hidden Target

```js
{
  duration: 14,
  targetTrack: { mode: "single", target: summit },
  positionTrack: {
    keyframes: [
      { at: 0, position: lowValleyPoint },
      { at: 1, position: ridgeExitPoint }
    ]
  },
  heightTrack: {
    mode: "keyframes",
    keyframes: [
      { at: 0, height: 1600 },
      { at: 0.6, height: 2600, easing: "smootherstep" },
      { at: 1, height: 2400, easing: "smootherstep" }
    ]
  },
  visibilityPolicy: {
    enabled: true,
    mode: "soft-correction",
    maxHeightDelta: 700,
    maxHorizontalDelta: 600,
    returnDuration: 1.8
  }
}
```

If the summit is initially hidden by terrain, the drone raises or shifts
progressively. Once the nominal trajectory has line-of-sight again, the
correction fades out and the drone returns to the original path.

## Dependency Decision

Decision date: 2026-07-16.

### Summary

The dependency decision is intentionally narrow. The project keeps Cesium for
runtime map/camera work, uses `bezier-easing` for temporal cubic-bezier easing,
uses Three.js for the V2 external 3D preview/editor, and owns the drone-camera
path model in custom code.

### Selected Building Blocks

The implementation should stay intentionally small. The retained dependencies
are:

| Component | Status | Responsibility |
| --- | --- | --- |
| `cesium` | Already installed, Apache-2.0 | Runtime camera application, WGS84 conversions, local ENU frames, terrain/tile visibility probes, scene picking, and optional spline primitives. |
| Turf modules | Already installed, MIT | Simple geospatial helpers when useful: bearing, distance, nearest point, and centroid helpers. |
| `bezier-easing` | Selected V1 dependency, MIT | CSS-like cubic-bezier temporal easing for public `[x1, y1, x2, y2]` easing curves. It does not define spatial 3D Bezier geometry. |
| `three` | Selected V2 dependency, MIT | External 3D preview/editor, rendering of the Cesium reference path and drone path, and dynamic 3D Bezier curve authoring. |

Everything else should be custom project code.

### Custom Code Boundary

The following parts should remain owned by this project:

- `DroneCameraPath` data model and validation;
- deterministic clock and progress evaluation;
- independent position, target, angle, distance, and altitude tracks;
- `orbit360` maneuver composition and blending;
- smooth altitude and correction profiles;
- line-of-sight visibility correction state;
- return to nominal trajectory;
- Cesium adapter and controller lifecycle;
- Three.js V2 authoring/export logic;
- 3D Bezier path serialization and deterministic sampling.

No additional animation, timeline, tweening, camera-control, or drone-path
package is proposed for this architecture.

## Validation

### Unit Tests

- validate a minimal path definition;
- reject invalid coordinates;
- `poseAtTime(0)` returns the first keyframe;
- `poseAtTime(duration)` returns the last keyframe;
- GPS path interpolation is monotonic on a simple path;
- heading uses shortest-path angular interpolation;
- easing functions return stable `[0, 1]` results;
- single-target orbit supports `heading: 0 -> 360`;
- `orbit360` blends in and out without jumps;
- target changes produce continuous `effectiveTarget` values;
- constant altitude does not oscillate;
- keyframed altitude has no instant step;
- hidden target activates correction progressively;
- visible-again target returns progressively to nominal path;
- correction state is stable and does not flip left/right every frame;
- controller pause/resume/seek works with simulated timers.

### Manual Tests

- orbit around a POI;
- GPS multi-point path in mountain terrain;
- target hidden by a ridge, dynamic correction, then nominal return;
- target hidden by 3D tiles/buildings, lateral correction, then nominal return;
- strong acceleration followed by slow final approach;
- stop during playback restores Cesium controls;
- replay video with drone camera disabled and enabled.

## Proposed Roadmap

### V1 - Runtime Foundation

- `gps-path` mode.
- Derived `orbit` mode.
- Fixed-target `orbit360`.
- Segment easing.
- `bezier-easing` for cubic-bezier temporal easing.
- Smooth altitude track.
- Cesium adapter using `camera.setView`.
- Basic visibility resolver with soft correction.
- Unit tests for the pure model and correction state.
- No complex UI.

### V2 - Three.js Path Preview and 3D Bezier Authoring

- External Three.js scene outside Cesium.
- Render the Cesium route/reference path.
- Render the drone camera path separately.
- Render target points, target groups, and orbit pivots.
- Dynamic 3D Bezier curve drawing in local ENU coordinates.
- Convert Bezier preview samples back to GPS path definitions.
- Optional visibility-correction debug overlays.

### V3 - Advanced Timing and Native Spatial Curves

- Global `timeRemap`.
- Explicit speed points.
- Holds and pauses.
- JSON import/export for presets.
- Catmull-Rom or Hermite interpolation in local ENU.
- Native 3D Bezier runtime evaluation if sampled V1 keyframes are not enough.
- Tangent control.
- Height smoothing.
- Optional `lookAtTarget: false`.

### V4 - Timeline Editor and Preset Library

- Keyframe editing on the map.
- 3D curve handles.
- Timeline with duration/easing preview.
- Preset library: orbit, reveal, pass, follow, pull-away.
- Custom Three.js-based authoring UI.

### V5 - Journey Replay Integration

- Replay controls `progress`.
- Drone target can follow the replay sample.
- Start/stop clips can use drone presets.
- Deterministic frame-by-frame video export.

### V6 - Advanced Visibility and Terrain Safety

- Terrain and 3D tile occlusion checks.
- Height, distance, or lateral position correction.
- Smoothed return to nominal path.
- Debug view showing camera-target ray, hit point, and chosen candidate.
- Minimum clearance above terrain.
- Advanced runtime debug overlays in Cesium and the Three.js preview.

## Open Questions

- Is `height` always WGS84 ellipsoid height, or should V1 support
  terrain-plus-offset?
- Should paths be stored in `journey.cameraPaths`,
  `journey.replay.cameraPaths`, or user settings?
- Is there one active path per journey, or a named path library?
- During playback, should user controls be fully disabled or only ignored until
  stop?
- Should `roll` be exposed in V1 UI, or only kept in the model?
- Should visibility corrections remain runtime-only, or can they be baked into a
  deterministic export path?
- What maximum correction is acceptable before declaring that a target cannot be
  shown without changing the shot?
- Should V2 persist 3D Bezier control points as first-class path data, or export
  only sampled GPS keyframes for V1 runtime compatibility?
- How should the V2 local ENU origin be chosen for long journeys: first drone
  point, journey centroid, main target, or segment-by-segment origins?

## Sources

- Cesium Camera documentation:
  https://cesium.com/learn/ion-sdk/ref-doc/Camera.html
- Cesium camera guide:
  https://cesium.com/learn/cesiumjs-learn/cesiumjs-camera/
- Cesium CatmullRomSpline:
  https://cesium.com/learn/cesiumjs/ref-doc/CatmullRomSpline.html
- Cesium EasingFunction:
  https://cesium.com/learn/cesiumjs/ref-doc/EasingFunction.html
- Cesium SampledPositionProperty:
  https://cesium.com/learn/ion-sdk/ref-doc/SampledPositionProperty.html
- Turf destination:
  https://turfjs.org/docs/api/destination
- Turf bearing:
  https://turfjs.org/docs/api/bearing
- bezier-easing:
  https://github.com/gre/bezier-easing
- three.js CatmullRomCurve3:
  https://threejs.org/docs/#api/en/extras/curves/CatmullRomCurve3
- three.js CubicBezierCurve3:
  https://threejs.org/docs/pages/CubicBezierCurve3.html
