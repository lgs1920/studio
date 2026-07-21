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
- Every public path `height` is an absolute WGS84 ellipsoid height. Terrain
  offsets may be used while authoring, but are resolved before evaluation and
  export.
- Public angles are degrees: `heading`/`yaw`, `pitch`, and optional `roll`.
- The drone can look at one point, a sequence of points, or a group of points.
- The drone can perform a real 360-degree move around a point while continuing a
  larger travel path.
- Altitude may be constant or animated, but never with abrupt steps.
- If the target point becomes hidden, the runtime must be able to move the drone
  dynamically so the target becomes visible, then return smoothly to the
  nominal path.
- In turns, the drone can temporarily overshoot the nominal trajectory and
  change its camera angle relative to the track. The effect is derived from
  local curvature and uses easing when entering and leaving the turn.
- V1 uses `bezier-easing` for CSS-like cubic-bezier temporal easing. The public
  API can accept both named easing values and `[x1, y1, x2, y2]` easing curves.
- A later authoring phase can add a simple Three.js preview/editor outside
  Cesium. It must render both the Cesium route/reference path and the drone
  camera path, and it must allow the drone path to be traced dynamically with 3D
  Bezier segments. Cesium remains the runtime map and camera engine.

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

### Free Fly-To Between Two Positions

The path model must also provide a deterministic equivalent of a Cesium
`flyTo` between two explicit camera positions. This mode is useful when the
camera must travel from point A to point B without looking at a fixed target.

The public positions remain GPS coordinates with absolute WGS84 ellipsoid
height:

```js
{
  type: "fly-to",
  duration: 6,
  from: {
    latitude: 45.9000,
    longitude: 6.8000,
    height: 900
  },
  to: {
    latitude: 45.9300,
    longitude: 6.8600,
    height: 1800
  },
  orientation: {
    mode: "preserve-current",
    heading: 1.2,
    pitch: -0.9,
    roll: 0
  },
  easing: "ease-in-out-sine"
}
```

`fly-to` must use the same deterministic evaluator as every other clip. It
must not call Cesium `flyTo` during playback or export. The runtime samples the
position at logical time, applies the selected easing, and sends the resulting
pose to the Cesium adapter with `camera.setView`.

An immediate `fly-to` is represented by `duration: 0` (or an explicit
`transition: "instant"`). It is a direct camera repositioning:

```js
{
  type: "fly-to",
  duration: 0,
  to: {
    latitude: 45.9300,
    longitude: 6.8600,
    height: 1800
  },
  orientation: {
    mode: "fixed",
    heading: 1.2,
    pitch: -0.9,
    roll: 0
  }
}
```

For an immediate `fly-to`:

- no `requestAnimationFrame` loop is created;
- no easing is evaluated;
- the destination and orientation are applied in one `camera.setView` call;
- the current camera state is not used as an animated start pose;
- the clip is completed at logical time `0`.

An immediate repositioning is allowed at an explicit clip boundary, but it
must be declared intentionally. Default clip-to-clip transitions remain
interpolated so that a normal clip cannot introduce an accidental camera jump.

The orientation policy is explicit:

- `preserve-current`: keep the current heading, pitch, and roll while the
  camera moves; no fixed target is evaluated;
- `fixed`: interpolate an explicitly provided heading, pitch, and roll;
- `follow-tangent`: derive heading and pitch from the current movement tangent,
  then apply optional heading/pitch offsets;
- `look-at`: use the target system described above when a target is explicitly
  requested.

For `preserve-current`, the current orientation is captured at the clip start
and remains the orientation baseline for the whole clip. It is not recomputed
from the destination point and cannot accidentally turn the camera toward a
POI.

### Direct 3D Bezier Camera Path

The same free-orientation behavior is available with a directly editable 3D
Bezier path. The path controls the camera position; orientation is independent
unless the definition selects `follow-tangent`.

```js
{
  type: "bezier-camera",
  duration: 10,
  positionPath: {
    frame: "local-enu",
    points: [
      {
        at: 0,
        position: { x: 0, y: 0, z: 900 },
        controlOut: { x: 180, y: 0, z: 980 }
      },
      {
        at: 0.5,
        position: { x: 520, y: 260, z: 1450 },
        controlIn: { x: 340, y: 100, z: 1250 },
        controlOut: { x: 700, y: 420, z: 1600 }
      },
      {
        at: 1,
        position: { x: 1100, y: 600, z: 1800 },
        controlIn: { x: 920, y: 560, z: 1780 }
      }
    ]
  },
  orientation: {
    mode: "preserve-current",
    pitch: -0.9,
    heading: 1.2,
    roll: 0
  },
  easing: [0.22, 1, 0.36, 1]
}
```

The editor must allow the user to move anchors and handles directly. The
runtime samples the cubic Bezier position at eased progress and combines it
with the orientation policy:

```js
const easedProgress = ease(progress, path.easing)
const position = bezierPositionAt(path.positionPath, easedProgress)
const orientation = orientationAt(path.orientation, easedProgress, position)
return {position, orientation}
```

With `preserve-current`, the camera follows the Bezier movement while keeping
its current heading/pitch/roll. With `follow-tangent`, it follows the direction
of the curve without requiring a fixed target. In both cases, the camera
orientation is part of the deterministic pose and must be interpolated across
clip boundaries.

The public editor may expose local ENU coordinates for comfortable 3D editing,
but exported runtime definitions must convert positions back to GPS with
absolute heights. The local `z` coordinate is an editing coordinate only; it
must resolve to the public absolute `height` before serialization for runtime
playback.

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

## Turn Anticipation and Corner Overshoot

The drone path may apply a temporary turn maneuver derived from the curvature
of the reference route. On an almost straight segment, the correction is zero.
When the route bends, the drone can take a slightly wider line and rotate the
camera temporarily relative to the nominal track heading.

This is not a new camera mode and does not replace `positionTrack`. It is a
post-processing layer applied to the nominal pose before visibility correction
and Cesium application:

```text
positionTrack -> nominal pose -> turn anticipation -> visibility correction
              -> final drone pose -> Cesium adapter
```

Recommended V1 definition:

```js
{
  motionProfile: {
    turnAnticipation: {
      enabled: true,
      lookBehind: 120,
      lookAhead: 260,
      maxHeadingOffset: 12,
      maxLateralOffset: 80,
      blendIn: {
        duration: 0.8,
        easing: [0.22, 1, 0.36, 1]
      },
      blendOut: {
        duration: 1.4,
        easing: [0.65, 0, 0.35, 1]
      },
      intensityEasing: "smootherstep"
    }
  }
}
```

The evaluator samples a point behind and a point ahead of the current drone
position, then derives the signed change in heading:

```js
const turnAngle = angularDelta(previousHeading, futureHeading)
const turnStrength = clamp(abs(turnAngle) / maxTurnAngle, 0, 1)
const turnSide = sign(turnAngle)

const entering = ease(blendInProgress, blendIn.easing)
const leaving = ease(blendOutProgress, blendOut.easing)
const envelope = min(entering, leaving)
const intensity = smootherstep(turnStrength) * envelope

const headingOffset = turnSide * maxHeadingOffset * intensity
const lateralOffset = turnSide * maxLateralOffset * intensity
```

`headingOffset` changes the camera angle relative to the track. `lateralOffset`
is optional and moves the drone slightly toward the outside of the turn, making
the overshoot visible in the camera position as well as in its orientation.
The sign must be computed in a local ENU frame so left and right turns remain
correct regardless of latitude or route heading.

The temporal envelope must be smooth on both sides of the maneuver:

```text
straight      -> 0%
turn entry    -> eased increase
turn apex     -> maximum offset
turn exit     -> eased decrease
straight      -> 0%
```

The recommended starting values are a `8-12` degree maximum heading offset and
a `40-80` metre maximum lateral offset. The lateral displacement should be
clamped independently from the heading correction and disabled by default if
the first implementation only needs the visual angle effect.

The same easing evaluator used by segment timing must be reused here. Named
profiles such as `smoothstep` and `smootherstep`, as well as cubic-bezier
`[x1, y1, x2, y2]` values evaluated with `bezier-easing`, are supported. Easing
controls the temporal envelope; it does not change the geometric calculation
of the route curvature.

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
with segment easing. Global `timeRemap` should move into a later advanced
timing version after the runtime and Journey Replay integration are stable.

## Altitude

Altitude may be constant or animated. It must always be smooth. Every public
path coordinate uses an absolute WGS84 ellipsoid height. Relative terrain
offsets are authoring inputs only and must be resolved into absolute heights
before the path is evaluated or exported.

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

### Terrain Offset Authoring

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

The runtime may sample terrain height and add the authoring offset, then smooth
the result. The resolved value becomes an absolute `height` in the evaluated
path. A `terrain-offset` value must never leak into the public pose format or
replace the absolute height stored in a deterministic export.

### Hard Rule

No altitude change may be applied as an instant step during an interpolated
clip. Even a terrain correction must be damped over several frames or a
minimum duration. The explicit `fly-to` `duration: 0`/`transition: "instant"`
case is the intentional exception for direct camera repositioning.

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

### Journey Replay target and angle continuity

Journey Replay must preserve the current camera semantics when it is represented
as a `DroneCameraPath`. The path engine does not replace the replay target with
new POIs by default. It receives the same replay sample or marker position that
the current camera implementation follows, including the rendered terrain
height when that is part of the existing behavior.

The generated replay pose keeps the existing angle rules:

- `navigation` derives heading from the replay route and its look-ahead;
- `hysteresis` keeps the existing smoothed heading, pitch, and tolerance state;
- `system` keeps the user-defined heading and pitch;
- the target track follows the current replay sample or marker unless an
  explicit target or target group is configured.

This makes the path model an extraction of the current camera calculation, not
an implicit change of what the replay looks at. New target behaviors such as a
POI sequence, a group centroid, or an orbit are opt-in path definitions.

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

Z1/Z2 tracking is a screen-space tracking policy layered on top of this loop;
it is not a second camera path. The nominal path first produces the current and
predicted poses, then the tracking policy decides whether a recenter is needed:

```js
const nominalPose = path.poseAtProgress(progress)
const predictedPose = path.poseAtTime(time + lookaheadSeconds)

const tracking = trackingResolver.evaluate({
  nominalPose,
  predictedPose,
  z1: triggerZone,
  z2: targetZone,
  crop: videoCropRect,
})

const appliedPose = tracking.correction
  ? blend(nominalPose, tracking.correction, tracking.correctionWeight)
  : nominalPose
```

Z1 remains the trigger zone. Leaving Z1, or predicting that the target will
leave it, can start a recenter. Z2 remains the promised landing zone for
dynamic tracking. The extended look-ahead between Z1 and Z2 must not perturb a
target that is already safely inside Z2. This preserves the current navigation
and hysteresis behavior while keeping the path evaluator independent of screen
projection and Cesium state.

The same tracking decision must be used by Draft and deterministic HQ export.
Draft may use live wall-clock time and HQ may use the export frame timestamp,
but both must evaluate the same nominal path, target, crop, zones, look-ahead,
and correction state. If Cesium visibility or terrain loading can produce
different results, the correction must either be baked into the export path or
be explicitly treated as runtime-only behavior.

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

### Public and Private Method Surface

The public API must remain small and independent from Cesium. Public methods
are the stable contract used by Journey Replay, clips, the editor, and tests.
All interpolation, correction, coordinate conversion, and Cesium lifecycle
details remain private implementation methods.

#### `DroneCameraPath` public methods

```js
class DroneCameraPath {
  constructor(definition)

  get duration()
  get definition()

  poseAtTime(time)
  poseAtProgress(progress)
  samplePositionAtProgress(progress)
  sampleOrientationAtProgress(progress)
  validate()
  toJSON()
}
```

Responsibilities:

- `poseAtTime(time)`: return one deterministic final pose for a real duration;
- `poseAtProgress(progress)`: return one deterministic final pose for normalized
  progress `[0, 1]`;
- `samplePositionAtProgress(progress)`: evaluate GPS, fly-to, vertical,
  spiral, or Bezier position without applying Cesium state;
- `sampleOrientationAtProgress(progress)`: evaluate fixed, preserved-current,
  tangent-following, or look-at orientation;
- `validate()`: return structured validation errors and warnings;
- `toJSON()`: export a serializable definition with absolute public heights.

`DroneCameraPath` must not expose public methods that mutate a Cesium camera,
start an animation loop, read `lgs`, or depend on browser time.

#### `DroneCameraPathController` public methods

```js
class DroneCameraPathController {
  constructor(options)

  load(definitionOrPath)
  play()
  pause()
  resume()
  stop()
  seek(timeOrProgress)
  poseAtTime(time)
  isPlaying()
  get currentTime()
  get currentPose()
}
```

Responsibilities:

- `load(...)`: validate and prepare a path or clip definition;
- `play()`, `pause()`, `resume()`, `stop()`: manage runtime playback;
- `seek(...)`: evaluate and apply a deterministic pose without requiring a
  complete playback run;
- `poseAtTime(...)`: expose the current path evaluator to replay/export code;
- `isPlaying`, `currentTime`, and `currentPose`: expose read-only runtime state.

`DroneCameraPathController` is the only layer allowed to coordinate the pure
path, the correction resolver, the Cesium adapter, and continuous rendering.

#### `DroneCameraPathCesiumAdapter` public methods

```js
class DroneCameraPathCesiumAdapter {
  applyPose(pose)
  requestRender()
  captureCameraState()
  restoreCameraState(state)
  setControlsEnabled(enabled)
}
```

The adapter converts absolute GPS positions and degree angles into Cesium
objects and applies them with `camera.setView`. It must not calculate path
geometry or choose clip transitions.

#### `DroneCameraVisibilityResolver` public methods

```js
class DroneCameraVisibilityResolver {
  resolve(pose, context)
  reset()
  get state()
}
```

`resolve(...)` may return the nominal pose unchanged or a smoothly corrected
pose. Visibility correction remains deterministic when the context contains a
deterministic timestamp and scene query result.

#### Private methods and helpers

The following methods are implementation details and must remain private
(`#method` in class code, or unexported module functions):

```js
// Path evaluation
#normalizeTime(time)
#normalizeProgress(progress)
#resolveActiveClip(progress)
#evaluateClipBoundary(previousClip, nextClip, progress)
#interpolatePose(startPose, endPose, progress, easing)
#interpolateAngleShortestPath(start, end, progress)

// Position and orientation
#evaluateGpsPath(progress)
#evaluateFlyTo(progress)
#evaluateBezierPosition(progress)
#evaluateVerticalTrajectory(progress)
#evaluateSpiralTrajectory(progress)
#evaluateOrientation(progress, position)
#evaluateTurnAnticipation(progress)

// Timing and constraints
#evaluateEasing(progress, easing)
#evaluateZoomProfile(progress, profile)
#resolveAbsoluteHeight(position, context)
#validateContinuity(previousPose, nextPose)

// Runtime and Cesium lifecycle
#scheduleFrame()
#applyCurrentPose()
#cancelFrame()
#enableContinuousRender()
#restoreContinuousRender()
#applyCorrection(pose, context)
```

Private helpers must not be imported by Journey Replay, the clip editor, or
tests. If a behavior needs to be tested independently, extract it into a pure
named module function with a deliberate public contract instead of reaching
into a private class method.

## Project Integration

Proposed files:

```text
src/core/ui/camera/DroneCameraPath.js
src/core/ui/camera/DroneCameraPathController.js
src/core/ui/camera/DroneCameraPathCesiumAdapter.js
src/core/ui/camera/DroneCameraVisibilityResolver.js
src/core/ui/camera/DroneCameraBezier3DPath.js        // later authoring helper
src/core/ui/camera/DroneCameraPathThreePreview.js    // later preview surface
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
- existing `trace`, `navigation`, and `hysteresis` modes remain available;
  navigation export behavior now uses deterministic follower smoothing and the
  narrow-crop threshold described below.

Later, `track-follow` and `bezier-camera` can become generated
`DroneCameraPath` definitions.

### Difference from the Existing Camera Implementation

The current implementation is not yet a reusable drone-camera engine. Camera
evaluation and replay-specific correction remain inside `JourneyReplayMode`,
while `CameraManager` owns persisted global camera state, camera observation,
orbit behavior, flight locks, and continuous-render optimization. The existing
replay camera is therefore a sample-driven runtime camera, not an independent
time-based path model.

The current local camera changes should be understood as an incremental
stabilization layer for this existing architecture:

| Concern | Existing behavior | Current change | Consequence for the drone architecture |
| --- | --- | --- | --- |
| Camera transition in HQ | Deterministic recentering interpolated camera position and orientation with a smooth scalar easing. | Deterministic transitions use cubic Hermite interpolation and carry the previous frame velocity into the next transition. | Preserve this continuity rule in `DroneCameraPathController`; it is still implemented inside replay today. |
| Navigation and dynamic correction in HQ | A deterministic recenter could be replaced by successive export-frame transitions and appear stepped. | Both tracking modes use the same deterministic follower with persistent velocity and a `1.5 s` response. | This is a correction/follow policy, not a path definition; it belongs behind a future correction resolver. |
| HQ timing input | Camera updates could fall back to phase or sample time. | Updates use the actual export frame timestamp and normalize heading/pitch smoothing against elapsed video time. | The future path engine should receive one explicit logical timestamp and never infer export time from wall-clock state. |
| HQ recenter duration | Navigation recentering used the normal replay duration. | HQ multiplies the recenter duration by `1.8` to make offline movement less abrupt. | Make this an explicit export or motion-profile parameter instead of a replay-only multiplier. |
| Narrow crop navigation zone | The narrow-crop trigger ratio was `15%`. | The ratio is now `22%`; standard crops remain at `30%`. | This screen-space collision policy stays in replay tracking settings, outside the pure drone path model. |
| Draft stop frame | Completion notification was deferred to a later animation frame. | During recording, completion and the optional final-frame callback run immediately so the recorder can capture the final Cesium state. | Keep this recorder lifecycle behavior outside the pure path evaluator. |
| HQ video encoding | HQ output requested `latencyMode: 'realtime'`. | HQ output requests `latencyMode: 'quality'` because export is offline and must avoid stepped frames under encoder pressure. | Encoding policy remains in `ReplayDeferredExporter`; the path engine only guarantees deterministic poses. |
| Camera timing diagnostics | Camera timing differences between Draft and HQ were difficult to observe. | Replay trace records logical video time, wall time, effective FPS, and camera change start/end durations. | Diagnostics remain outside the pure path evaluator and are removed or disabled for production builds. |

The migration boundary is consequently:

```text
Current:
JourneyReplayMode -> camera view calculation -> Cesium camera.setView
                 -> replay collision/recenter state
CameraManager    -> persisted camera state and global camera services

Target:
JourneyReplay progress/time -> DroneCameraPath -> correction policy
                             -> Cesium adapter -> camera.setView
CameraManager                 -> global camera services and lifecycle
Replay                         -> phase selection, recorder/export timing
```

The current changes do not justify replacing `JourneyReplayMode` or
`CameraManager` yet. They establish behaviors that the future separation must
retain: deterministic frame timestamps, continuity at transition boundaries,
smooth correction toward a predicted target, and preservation of the final
recorded frame.

### Replay, start clips, and stop clips

The complete camera sequence is one logical timeline composed of three ordered
phases:

```text
start clips -> replay -> stop clips
```

Each phase has a local path and an exact duration. A timeline evaluator maps the
global time to the active phase and evaluates that phase with its local
progress:

```js
const phase = timeline.phaseAtTime(time)
const pose = phase.path.poseAtProgress(phase.localProgress)
```

The phase boundaries are explicit continuity contracts:

- the last pose of the final start clip equals the replay pose at `progress: 0`;
- the first pose of the first stop clip equals the replay pose at `progress: 1`;
- heading, pitch, roll, position, target, and target distance must not jump at a
  boundary.

### Clip-to-Clip Interpolation

Every adjacent pair of clips must have an explicit interpolation interval. A
clip is not allowed to end on one camera angle and let the next clip start with
an abrupt heading, pitch, height, zoom, or target change.

The timeline compiler resolves each boundary in this order:

1. evaluate the final pose of the current clip;
2. evaluate the first requested pose of the next clip or replay phase;
3. create a transition pose between both states;
4. apply the transition easing before entering the next clip.

The transition must preserve at least:

- absolute camera position and height;
- heading, including shortest-path angular interpolation;
- pitch and roll;
- target and target distance;
- zoom/range;
- the tangent direction when the next phase follows the journey track.

Example:

```js
{
  clips: [
    {
      id: "take-off",
      type: "take-off",
      duration: 5,
      endPosePolicy: "next-clip"
    },
    {
      id: "replay",
      type: "replay",
      path: replayPath,
      transitionIn: {
        duration: 1.2,
        easing: "ease-in-out-sine"
      }
    },
    {
      id: "landing",
      type: "landing",
      duration: 6,
      startPosePolicy: "previous-clip",
      endPosePolicy: "next-clip"
    }
  ]
}
```

`next-clip` means that the clip endpoint is solved from the next clip's first
camera pose, including its absolute height and camera angle. If the next item
is the replay, the endpoint is solved from replay progress `0`. If the next
item is another clip, the endpoint is solved from that clip instead. This
prevents a take-off or landing shot from finishing with a camera orientation
that is incompatible with the shot that follows.

### Zoom Profiles

Zoom is a separate temporal track. It must not be inferred from altitude, even
when a shot changes both height and camera range. The public zoom track changes
camera `distance`/`range` and supports three V1 profiles:

- `linear`: constant zoom speed;
- `slow-fast-slow`: eased departure, fast middle, eased arrival;
- `fast-slow`: fast initial zoom followed by a slow final approach.

```js
{
  zoomTrack: {
    from: 1800,
    to: 700,
    profile: "slow-fast-slow",
    easing: "smootherstep"
  }
}
```

The profile is evaluated over the clip's local progress and is interpolated
again by the clip boundary transition. Thus a clip cannot end with one range
and make the next clip jump to another range.

### Take-off and Landing Trajectories

Take-off and landing are regular clips with a constrained trajectory. Their
vertical endpoint is always solved from the following or preceding phase:

- take-off starts from the current camera pose and ends at the next clip or
  replay start pose;
- landing starts from the replay end pose or the preceding clip and ends at the
  next clip's requested pose;
- both endpoints use absolute WGS84 heights;
- heading, pitch, target, and zoom are interpolated toward the destination pose.

The supported movement shapes are:

```js
{
  type: "take-off",
  duration: 5,
  trajectory: {
    mode: "spiral",
    radius: { from: 0, to: 140 },
    direction: "clockwise",
    height: { from: 820, to: 1480 },
    easing: "smootherstep"
  },
  endPosePolicy: "next-clip"
}
```

Take-off and landing also have a variable speed profile, independent from the
zoom profile. The profile is applied to the normalized trajectory progress, so
it controls the vertical movement, the spiral radius, and the final camera
alignment without changing the absolute endpoint heights.

Supported V1 profiles are:

- `linear`: constant vertical and spatial speed;
- `slow-fast-slow`: gentle departure, faster middle, gentle arrival;
- `fast-slow`: strong initial movement followed by a slow final approach.

```js
{
  type: "take-off",
  duration: 6,
  trajectory: {
    mode: "spiral",
    radius: { from: 0, to: 160 },
    direction: "clockwise",
    height: { from: 820, to: 1480 },
    speedProfile: "slow-fast-slow",
    easing: "smootherstep"
  },
  zoomTrack: {
    from: 900,
    to: 1500,
    profile: "fast-slow"
  },
  endPosePolicy: "next-clip"
}
```

The evaluator must use one shared eased progress for the trajectory unless a
clip explicitly requests independent tracks:

```js
const movementProgress = ease(localProgress, trajectory.easing)
const height = interpolateAbsoluteHeight(heightFrom, heightTo, movementProgress)
const radius = interpolate(radiusFrom, radiusTo, movementProgress)
const pose = alignToNextClipPose(movementProgress)
```

This guarantees that a spiral does not arrive at the correct height while its
camera angle is still changing abruptly. The final part of the eased movement
must reserve enough time to match the next clip's heading, pitch, target,
range, and absolute height.

`mode: "vertical"` keeps the horizontal position fixed. `mode: "spiral"`
adds a horizontal circular displacement while height changes monotonically.
The radius may be signed or represented by an explicit direction:

- positive radius or `clockwise` produces one side of the spiral;
- negative radius or `counterclockwise` produces the opposite side;
- `radius.from` and `radius.to` may differ to create a tightening or widening
  spiral.

The landing clip uses the same model with a descending absolute height track.
Its final radius must return to zero unless the next clip explicitly requests a
non-zero lateral offset. The last part of the spiral is blended toward the
next clip's heading and height, so the landing always finishes aligned with
the following camera pose rather than with an arbitrary vertical orientation.

The endpoint solver must reject a clip definition when its requested duration,
height change, or radius would require an impossible discontinuity. It should
clamp the trajectory or emit a validation warning before runtime playback.

Clip operations such as `take-off`, `landing`, and `focus` must eventually be
represented by path definitions or sampled poses. They must not rely on an
independent imperative `flyTo`, `focus`, or camera animation that can produce a
different live trajectory from the deterministic export trajectory.

The replay controller remains the owner of replay progress. The same timeline
and pose evaluator are used by the interactive preview, live Draft recording,
and frame-by-frame HQ export. Cesium only applies the resulting pose through
the adapter.

## Later Three.js Path Preview and 3D Bezier Drone Path

The Three.js preview/editor should be the last major phase, after the runtime,
Journey Replay integration, timing controls, and visibility behavior are
stable. This environment is an editing surface, not the authoritative runtime.
The core path definition remains independent and the Cesium adapter remains
responsible for applying the final camera pose in the real scene.

The preview must render:

- the Cesium route or journey path as a reference line;
- the drone camera path as a separate line;
- target points and target groups;
- 360 maneuver pivots, radii, and blend windows;
- optional debug overlays for visibility correction candidates.

### Simplest 3D Editor Shape

The first useful 3D editor should stay deliberately small. It should be a single
Three.js view using a local ENU meter frame, with a gray reference journey path,
a colored drone path, visible target points, and handles only for the selected
segment. The user can drag the segment start/end points and the two cubic
Bezier handles, while a compact side panel edits exact values: GPS position,
height, duration, easing curve, target policy, and orbit parameters when the
segment is an `orbit360`. There should be no embedded Cesium scene, no terrain
mesh, no full video timeline, and no separate animation package in the first
version. The editor simply regenerates preview samples from the same
`DroneCameraPath` model and exports a path definition back to the runtime.

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

The Three.js layer should not call `viewer.camera` directly. It should emit a
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
keeps Three.js for the final external 3D preview/editor phase, and owns the
drone-camera path model in custom code.

### Selected Building Blocks

The implementation should stay intentionally small. The retained dependencies
are:

| Component | Status | Responsibility |
| --- | --- | --- |
| `cesium` | Already installed, Apache-2.0 | Runtime camera application, WGS84 conversions, local ENU frames, terrain/tile visibility probes, scene picking, and optional spline primitives. |
| Turf modules | Already installed, MIT | Simple geospatial helpers when useful: bearing, distance, nearest point, and centroid helpers. |
| `bezier-easing` | Selected V1 dependency, MIT | CSS-like cubic-bezier temporal easing for public `[x1, y1, x2, y2]` easing curves. It does not define spatial 3D Bezier geometry. |
| `three` | Selected final-phase dependency, MIT | External 3D preview/editor, rendering of the Cesium reference path and drone path, and dynamic 3D Bezier curve authoring. |

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
- future Three.js authoring/export logic;
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

### V2 - Journey Replay Integration

- Replay controls `progress`.
- Drone target can follow the replay sample.
- Existing `trace`, `navigation`, and `hysteresis` modes remain available;
  navigation export behavior now uses deterministic follower smoothing and the
  narrow-crop threshold described below.
- Start and stop clips can be expressed as generated drone path definitions.
- Start clips, replay, and stop clips share one ordered phase timeline with
  continuous pose boundaries.
- Draft preview, live recording, and HQ export evaluate the same phase pose at
  the same logical time or frame timestamp.
- Deterministic frame-by-frame video export uses the same path evaluation.
- Minimal preset selection for replay use, without a 3D editor.

### Navigation Z1/Z2 and narrow crops

Navigation recentering uses a centered Z1 trigger zone. For a standard crop,
the navigation zone keeps the existing 30% ratio. When the video crop is narrow
(its short axis is less than 75% of its long axis), the navigation ratio is
reduced to 22%. This applies to both horizontal and vertical narrow crops.
Dynamic tracking keeps its separate Z1/Z2 configuration.

Draft recording and replay/HQ navigation use the same Z1 collision path: both
test the current and predicted marker samples against the runtime zone before
starting a recenter. Draft keeps its live Cesium timing, while replay/HQ keeps
deterministic frame timing; this timing difference must not change the
collision decision.

### Deterministic HQ camera ownership

During deferred HQ export, the video timeline is the only clock that advances
the replay camera. Each encoded frame supplies an explicit logical timestamp
and the camera is evaluated at that timestamp. The wall-clock duration of the
Cesium render, widget composition, or video encoding does not change the camera
trajectory.

The normal live replay update remains active in the application, but its camera
application is ignored while HQ owns the export camera. This prevents a delayed
live callback from overwriting the camera pose selected for the current video
frame and causing jitter or non-deterministic transitions.

Camera transitions and navigation/dynamic followers must use complete Cartesian frames:
`destination`, `direction`, and `up`. Before interpolation or
`camera.setView`, the runtime validates that every component is finite. If a
transition endpoint is incomplete, the runtime keeps the valid endpoint rather
than passing an undefined vector to Cesium. This is required because Cesium
rejects invalid interpolation operands and aborts the whole HQ export.

`cameraRecenterFrame` exposes its orthogonalized vertical vector as
`correctedUp`. The deterministic follower must normalize this external frame
shape to its internal `up` field before integrating the spring state. Reading
`endFrame.up` directly leaves the follower target undefined and causes Cesium's
`Cartesian3.subtract` validation to abort the export.

Navigation and dynamic tracking share a `1.5 s` deterministic follower response
during HQ export. This value controls the spring response toward a moving
target; it does not change start/stop clip durations or Draft camera easing.

The same validation applies to the smoothed replay trace used by the renderer.
An incomplete left or right trace position is skipped or replaced by the
available valid position before interpolation.

HQ may render more slowly than real time. A large wall-clock delta between two
successive frames is therefore a performance signal, not a camera timing
change, as long as the logical frame timestamps remain monotonic and use the
configured frame interval.

After HQ cleanup, the exact Cesium camera state captured before playback is
restored after the journey focus cleanup. This prevents the focus angle from
becoming the starting angle of a subsequent video export.

The first HQ start-clip frame also uses that captured initial heading, pitch,
and height, rather than the live camera state after export preparation. Stop
clips continue to use the live end-of-replay camera state.


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

### V4 - Advanced Visibility and Terrain Safety

- Terrain and 3D tile occlusion checks.
- Height, distance, or lateral position correction.
- Smoothed return to nominal path.
- Debug view showing camera-target ray, hit point, and chosen candidate.
- Minimum clearance above terrain.
- Ability to bake runtime corrections into deterministic export paths.

### V5 - Preset Library and Simple Map Authoring

- Keyframe editing on the Cesium map.
- Numeric editing for duration, easing, altitude, and target policy.
- Preset library: orbit, reveal, pass, follow, pull-away.
- Import/export of reusable path presets.
- No Three.js dependency required at this phase.

### V6 - Three.js Path Preview and 3D Bezier Authoring

- External Three.js scene outside Cesium.
- Render the Cesium route/reference path.
- Render the drone camera path separately.
- Render target points, target groups, and orbit pivots.
- Dynamic 3D Bezier curve drawing in local ENU coordinates.
- Convert Bezier preview samples back to GPS path definitions.
- Optional visibility-correction debug overlays.

## Open Questions

- Should terrain-offset authoring be exposed in V1, while keeping resolved
  public path heights absolute WGS84 values?
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
- Should the final Three.js editor persist 3D Bezier control points as
  first-class path data, or export only sampled GPS keyframes for runtime
  compatibility?
- How should the final Three.js editor choose its local ENU origin for long
  journeys: first drone point, journey centroid, main target, or
  segment-by-segment origins?

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
