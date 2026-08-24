# Drone Camera 3D Path Editor Specification

Status: **TODO**

Target release: `1.1.0`

The serializable runtime camera contracts exist, but the Three.js editor is not
implemented.

## Goal

Provide a dedicated visual editor for authoring drone camera trajectories in
3D. The editor is a later authoring surface on top of the deterministic drone
path runtime described in [Drone camera path architecture](CORE-DRONE-CAMERA-PATH-ARCHITECTURE.md).

The editor must let users shape a camera path visually, compare it with the
journey route, position targets and orbit pivots, and export a runtime-safe
path definition. It must not move camera or Cesium scene responsibilities into
the authoring surface.

## Scope

The first 3D editor version includes:

- an external Three.js preview/editor outside the Cesium scene;
- the Cesium journey route as a reference path;
- a separate drone camera path;
- editable 3D Bezier anchors and control handles;
- target points, target groups, and orbit pivots;
- local ENU editing coordinates;
- numeric editing for exact GPS positions, altitude, duration, and easing;
- deterministic preview sampling and runtime export.

It does not include a second playback engine, video encoding, terrain
visibility correction, or direct mutation of Cesium camera state.

## Editor Layout

The editor should remain deliberately small for its first version:

- the main viewport displays the journey reference route, drone path, anchors,
  handles, targets, and the current camera pose;
- selecting an anchor or handle enables direct manipulation in 3D;
- a side panel exposes exact values for GPS position, absolute height, timing,
  easing, orientation, and target policy;
- playback scrubs the same logical path time used by the runtime evaluator;
- reset and frame actions keep the complete path visible without changing the
  saved definition.

The visual editor is an authoring tool. The runtime definition remains the
source of truth and must be serializable without Three.js objects.

## Coordinate Frame

The editor uses a local East-North-Up frame for stable 3D manipulation. The
origin should be selected from the active path or journey context and stored as
editor metadata, not as a replacement for public GPS coordinates.

```js
{
  authoring: {
    mode: "bezier-3d",
    frame: {
      type: "local-enu",
      origin: {
        latitude: 45.9237,
        longitude: 6.8694,
        height: 1200
      }
    }
  }
}
```

Local coordinates are used only for editing and preview. Before runtime
serialization, every point is converted to `latitude`, `longitude`, and an
absolute WGS84 ellipsoid `height`. Terrain offsets must be resolved before
export.

## 3D Bezier Path Model

The path controls the camera position. Orientation remains independent unless
the definition selects `follow-tangent`.

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

The editor must support moving anchors and handles independently, with
optional handle symmetry as an authoring convenience. The runtime samples the
cubic Bezier position at eased progress and combines it with the orientation
policy:

```js
const easedProgress = ease(progress, path.easing)
const position = bezierPositionAt(path.positionPath, easedProgress)
const orientation = orientationAt(path.orientation, easedProgress, position)
return {position, orientation}
```

The editor may expose `preserve-current`, `fixed`, `follow-tangent`, and
`look-at` orientation policies. All resulting poses must remain deterministic
at a given logical time.

## Cesium Route and Drone Path

The preview must render both paths because they answer different questions:

- the Cesium journey route shows the subject being filmed;
- the drone path shows the camera movement and framing trajectory.

The two paths must have distinct visual styles and selectable visibility. The
drone path may be edited without modifying the journey geometry. Target points,
target groups, and orbit pivots must remain identifiable even when their
associated journey layer is hidden.

## Runtime Boundary

The editor produces a `DroneCameraPath` definition and preview samples. It
does not call Cesium camera methods during editing or playback. Runtime
playback remains owned by `DroneCameraPathController` and
`DroneCameraPathCesiumAdapter` from the architecture specification.

The export boundary must:

1. validate anchors, handles, timing, easing, orientation, and coordinates;
2. convert local ENU points to public GPS coordinates and absolute heights;
3. remove Three.js objects and editor-only metadata from the runtime payload;
4. preserve enough precision for deterministic preview, draft recording, and
   HQ export to evaluate the same poses.

## Proposed Files

```text
src/core/ui/camera/DroneCameraBezier3DPath.js
src/core/ui/camera/DroneCameraPathThreePreview.js
tech-doc/todo/CORE-DRONE-CAMERA-3D-PATH-EDITOR-SPEC.md
src/__tests__/drone-camera-bezier-3d-path.test.js
```

The pure Bezier evaluator should be usable without React, Three.js, Cesium, or
browser state. Three.js should be limited to viewport rendering and pointer
interaction.

## Validation

- anchors and handles remain stable when the viewport is resized;
- moving a handle changes the preview path without changing the journey route;
- scrubbing the editor and evaluating the exported path produce matching poses;
- local ENU points export to valid GPS coordinates and absolute WGS84 heights;
- invalid control points, timing, or easing values are rejected before export;
- the exported definition contains no Three.js instances or editor-only fields;
- target points and orbit pivots remain visible and selectable;
- preview, draft recording, and HQ export use identical deterministic samples.

## Roadmap

### V1 — Preview and Editing Foundation

- local ENU viewport;
- Cesium route and drone path rendering;
- anchor and handle manipulation;
- numeric property editing;
- deterministic path sampling and runtime export.

### V2 — Authoring Quality

- handle symmetry and snapping;
- path and target presets;
- camera framing tools;
- terrain-aware authoring offsets resolved to absolute heights;
- visibility-correction previews.

### V3 — Advanced 3D Authoring

- multi-segment path composition;
- path-level time remapping and speed visualization;
- animated target groups and orbit maneuvers;
- optional correction baking for deterministic exports.

## Open Questions

- Should the editor persist 3D Bezier control points as first-class path data or
  export only sampled GPS keyframes for runtime compatibility?
- How should the local ENU origin be selected for long journeys: first drone
  point, journey centroid, main target, or segment-by-segment origins?
- Should terrain-offset authoring be available in the first editor version?

## Sources

- [Three.js `CubicBezierCurve3`](https://threejs.org/docs/pages/CubicBezierCurve3.html)
- [Drone camera path architecture](CORE-DRONE-CAMERA-PATH-ARCHITECTURE.md)
