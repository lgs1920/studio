# Drone Camera Path Architecture

## Goal

Define a reusable camera path system that can move the camera from point A to
point B, or follow a richer route with targets, orbit-like motion, visibility
corrections, and export-safe easing.

The path is a standalone runtime concept. It is not tied to `Journey` by
default and it is not persisted as a product feature in V1. Journey remains the
source of truth for replay-driven camera motion, and replay materializes the
canonical path at runtime from the journey state.

Replay must become a consumer of the same path engine. Draft playback and HQ
export must evaluate the same canonical path definition for a given journey
state. Cesium should only be used by adapters and runtime services.

### Canonical replay geometry

Replay route geometry is prepared by `JourneyReplayTurfPath`. Turf is the
renderer-independent source of truth for geodesic distance, cumulative route
distance, route position, altitude interpolation, local tangent, and
look-ahead. The replay sampler consumes this path by metric distance, so Draft,
HQ, and deferred video rendering receive identical geographic samples.

Cesium is not used to construct, measure, extrapolate, or interpolate the
replay route. It remains an adapter concern for converting a canonical sample
into a render camera frame, projecting a target into the active crop, and
applying the final frame to the scene. A renderer adapter must not replace the
Turf sample with a live-camera position or a linear longitude/latitude
projection.

## Current Implementation

The path architecture is implemented in the current code base. The relevant
runtime files are:

- `src/core/ui/replay/JourneyReplayCameraPath.js`
- `src/core/ui/replay/JourneyReplayConstrainedCameraPath.js`
- `src/core/ui/replay/JourneyReplayCameraConstraintBinding.js`
- `src/core/ui/replay/JourneyReplayCameraCollision.js`
- `src/core/ui/replay/JourneyReplayCameraTransition.js`
- `src/core/ui/replay/JourneyReplayCameraBinding.js`
- `src/Utils/cesium/SceneUtils.js`
- `src/components/MainUI/PanoramaWidget.jsx`

### Non-blocking Draft and HQ runtime policy

Bulk constrained-path compilation is no longer invoked from Draft playback or
HQ frame rendering. Compiling up to 2048 samples on the browser main thread
could keep the recorder `START` event open for tens of seconds, prevent the
`preRecording` UI state from being painted as active recording, and produce a
single long `requestAnimationFrame` task.

Draft now starts replay in a separate browser task after recorder startup and
evaluates the existing bounded live camera correction for each replay update.
HQ evaluates the deterministic camera follower from each explicit export frame
timestamp. Both paths avoid full-route work in one browser callback.

`buildConstrainedReplayCameraPath(...)` remains available as a pure compiler
and is still covered by unit tests. It must not return to the Draft or HQ
critical path until its work is moved off the main thread or split into
cooperative chunks with a strict per-task time budget.

The runtime records `camera.path.compile.skipped`,
`draft.replay.start.scheduled`, and the `draft.recording.*` preparation stages.
The Draft preparation summaries are also written directly to the browser
console so a stall can be located without inspecting the in-memory trace
buffer.

The point-to-point runtime pipeline is:

1. resolve a start camera frame and an end camera frame
2. choose a transfer mode from the configured distance threshold
3. build a reusable sampled camera path
4. attach a replay safety profile when the call comes from a replay fallback
5. resolve visibility corrections when needed
6. apply sampled frames with `camera.setView`

### Current replay corrections (2026-08-01)

Continuous journey replay now uses a bounded per-update evaluator on top of the
same camera frame model. It does not build a complete constrained route during
Draft startup or while an HQ frame is being rendered. The current contract is:

1. resolve the logical Turf sample at the current replay time;
2. resolve the metric look-ahead sample from the same sampler;
3. compute the nominal heading from the real Turf tangent and beta.2-style
   spatial window, then apply time-based smoothing;
4. project the current and look-ahead marker through the current/candidate
   camera frame in crop-local coordinates;
5. treat an invalid projection as a hard Z1 violation;
6. for a current violation, target the current marker with a short bounded
   recovery; for a predictive violation, target `sampleAtTime(t + 2 s)` with a
   `2 s` transition;
7. validate every transition sub-frame before applying it;
8. apply the result through the live Draft adapter or the explicit HQ timestamp.

The target sample and transition duration are deliberately coupled. A target at
`t + 1 s` with a `2 s` transition leaves the marker ahead of the camera and was
the source of the observed lower-right Z1 lag. A hard current violation never
uses the future target, because correcting an already-lost frame against a
future point compounds the lag.

The `ground-offset` altitude has one reference frame: the rendered replay
marker. Its absolute camera height is `markerHeight + configuredOffset`. A
recenter therefore never falls back to `camera.positionCartographic.height`,
because the live camera may be over a different relief while it is displaced
from the marker. If terrain is unavailable, the marker sample altitude is the
deterministic fallback for both the marker and the camera.

Navigation heading uses a minimum `400 m` metric window, a `2.5 s` future chord,
and a nine-sample PCA axis oriented by that chord. The response factor is
clamped to `0.04..0.18`, navigation drift is filtered with a `1.5 s` response,
and lateral/heading drift is limited to `40 m` / `6°`. A turn drift requires a
route turn of at least `12°`. These smoothing limits reduce beta.2-style zigzag
oscillation without weakening the hard crop/Z1 guard.

Cesium is still used only after this evaluation: candidate projection, terrain
visibility checks, and final rendering. It does not construct, measure,
extrapolate, or compile the geographic replay path.

Continuous journey replay therefore evaluates the following shared logic:

1. materialize Turf journey samples at the current logical time
2. smooth nominal heading and pitch sequentially in logical replay time
3. apply terrain redirection through a bounded attack/hold/release envelope
4. advance the nominal logical pose in replay time, including through turns
5. project the current and look-ahead markers through candidate frames without
   using a live-camera position as route geometry
6. start a correction before the marker leaves Z1
7. land in the navigation target or dynamic Z2
8. relax the remaining correction back toward the moving nominal pose
9. validate the candidate against crop-local Z1/Z2 bounds
10. apply one frame through the owner of the current clock: Draft or HQ

That means the route geometry is Turf/path-driven and the camera application is
clock-driven. Cesium `camera.flyTo` is not the core primitive for replay or live
path sampling.

### Root-cause analysis of the stepped replay

The July 26 regression was not caused by the HQ encoder dropping frames. It
was caused by the camera path supplied to those frames.

Four independent discontinuities had accumulated:

| Defect | Exact cause | Visible result |
| --- | --- | --- |
| Angular smoothing bypassed | Constrained compilation requested `cameraViewForSample(...)` with `source: 'drawer'`. That source intentionally bypasses heading hysteresis and `smoothRadians(...)`. Runtime playback still computed a smoothed view, but `JourneyReplayCameraBinding.js` returned early after applying the constrained frame, so that smoothed view was never rendered. | Heading and pitch changes could occur at a compiled node instead of over video time. |
| Path too sparse | The path contained only 128 to 256 intervals. A 60-second replay therefore changed interpolation segment every approximately `0.47 s` to `0.23 s`. | Position and orientation looked like successive sections, even though every HQ frame was encoded. |
| Linear frame interpolation | `destination`, `direction`, and `up` were linearly interpolated between adjacent cached frames. Value continuity was preserved, but velocity changed at every interval boundary. | The camera appeared to advance, pause, and restart at segment junctions. |
| Unbounded terrain redirect | A visible redirect candidate became the new compiled nominal view and could remain active for the complete occluded stretch. There was no mandatory return phase or replay-end release. | A configured pitch near `-45°` could finish near `-66°`. |

The HQ timeline itself is deterministic:

1. `ReplayFrameTimeline` produces monotonically increasing timestamps separated
   by exactly `1000 / fps`
2. `ReplayVideoRenderSession.renderAll(...)` awaits and renders every frame in
   order
3. `renderReplayExportFrame(...)` seeks the exact progress and updates the
   camera once for that frame
4. live camera callbacks are ignored while HQ owns the export camera
5. the offline encoder uses its quality policy after the pose has been rendered

Slower wall-clock rendering can make export take longer, but it does not skip
logical camera frames. Correcting encoder cadence alone therefore cannot fix a
stepped trajectory.

### Core transfer builder

`buildCameraTransferPath(...)` returns a deterministic path object. In the
current implementation it exposes:

- `mode`
- `distanceMeters`
- `sampleCount`
- `samples`
- `sampleAt(ratio)`
- `flyTo({...})`
- `antiCollisionBounds`
- `safetyProfile`

The supported modes are:

- `direct`
- `bezier-3d`
- `elevate-then-move`
- `blur-jump-refocus`
- `spiral-horizontal`
- `spiral-conical`
- `spiral-vertical`

Example:

```js
const safetyProfile = buildReplayTransferSafetyProfile(journey, {
  trackingMode: marker.mode,
  cameraSettings,
  viewport: call.viewportRectForCesiumSurface?.() ?? null,
  clearanceMeters: 500,
})

const path = buildCameraTransferPath({
  start: startFrame.destination,
  end: endFrame.destination,
  mode: 'spiral-conical',
  sampleCount: 80,
  antiCollisionBounds: safetyProfile,
  safetyProfile,
})
```

The `flyTo(...)` method on the returned path is a sampler loop. It is not a
wrapper around Cesium `camera.flyTo`. It exists so live preview can reuse the
same path evaluator as deterministic playback.

The path object also accepts an optional `frameResolver`. Point-to-point
transfers use it for visibility corrections. Continuous replay screen
constraints are compiled by `JourneyReplayConstrainedCameraPath.js`, because a
single start/end transfer cannot guarantee the position of a moving marker.

### Constrained replay compiler

`buildConstrainedReplayCameraPath(...)` materializes the journey-derived replay
camera path in memory. It receives deterministic callbacks for nominal camera
frames, marker targets, and candidate-frame projection.

The compiler exposes:

- `frames`
- `triggerZone`
- `targetZone`
- `durationSeconds`
- `responseSeconds`
- `lookaheadSeconds`
- `constrainedSamples`
- `sampleAt(progress)`

The projection implemented by
`projectReplayTargetInCameraFrame(...)` works from the candidate frame's
`destination`, `direction`, and `up`, plus the Cesium frustum and crop
dimensions. It does not call `worldToWindowCoordinates` on the live camera.
This removes the asynchronous one-frame discrepancy that previously caused
Draft and HQ to disagree about Z1/Z2 collisions.

Compilation density is derived from both journey-guide density and replay
duration. The interval count is:

```text
max(ceil(cameraGuideLength / 2), ceil(durationSeconds * 30), 256)
```

and is capped at `2048`. A normal 60-second replay therefore compiles `1800`
intervals and `1801` frames instead of only 128 or 256 intervals. The cap
prevents unbounded synchronous work on very long journeys.

The raw view is deliberately read without mutable live-camera history, then
smoothed sequentially by the compiler. Heading uses
`replayHeadingEasingFactor(...)`, pitch uses the historical `0.08` factor, and
both factors are normalized from their 60 FPS calibration to the elapsed
logical time between compiled samples. Angular interpolation follows the
shortest signed arc. A 90-degree desired heading change is therefore distributed
over several compiled video-time samples.

The compiler never freezes an otherwise safe camera frame in world space.
Before evaluating Z1, it advances the previously applied frame with the full
position and orientation change between the previous and current nominal
frames. When no correction or residual return offset is present, this produces
the current nominal frame exactly. The camera therefore continues to move at
every compiled journey sample even while both current and look-ahead markers
remain inside Z1.

When either marker threatens Z1, the compiler interpolates toward a future
nominal frame. If smoothing still leaves the current marker outside Z1, a
coarse search followed by binary refinement finds the first interpolated frame
that restores the constraint. Once the applied frame and look-ahead marker
reach the internal navigation landing zone or dynamic Z2, the correction stops
growing and is progressively blended back into the moving nominal frame.

`sampleAt(progress)` repeats the constraint check with the exact journey sample
and rendered marker target at the requested progress. It does not linearly
approximate that target from the two surrounding cached targets. If the
interpolated nominal frame still cannot contain the exact target, the solver
computes the smallest focus correction from the current camera position before
refining the transition. Curved journey segments therefore cannot let the
marker escape between cached samples.

Cached camera frames are not joined with a two-point linear interpolation.
`sampleAt(progress)` reads the previous, start, end, and next frames and
evaluates a cubic Hermite value for `destination`, `direction`, and `up`.
Adjacent intervals share the same tangent at their common frame, so position
and camera-axis velocity are C1-continuous. Direction is normalized and `up`
is orthogonalized after interpolation. This removes the velocity break that
made the camera movement visible as independent sections.

#### Continuous nominal-frame transport

The replay pipeline distinguishes three camera layers:

- the **configured base view**, calculated from the journey and user camera
  settings, including the configured pitch
- the **compiled nominal frame**, which is the base view after turn drift and
  an optional temporary terrain redirect have been baked into it
- the **applied frame**, which is the compiled nominal frame plus any temporary
  Z1/Z2 correction that still has to be preserved

The transport algorithm operates between the compiled nominal frame and the
applied frame. Clearing a terrain redirect changes the compiled nominal frame.
Transport and recovery are then responsible for making that change reach the
applied frame.

For each compiled sample, let:

- `N0` be the previous nominal frame
- `N1` be the current nominal frame
- `A0` be the previously applied frame
- `R0` and `R1` be the orthonormal camera rotations of `N0` and `N1`
- `D = R1 * transpose(R0)` be the nominal rotation delta

The next transported frame is calculated as:

```text
positionOffset = A0.position - N0.position
A1.position = N1.position + D * positionOffset
A1.direction = normalize(D * A0.direction)
A1.up = orthonormalize(D * A0.up, A1.direction)
```

The camera rotation uses the right, up, and backward axes. Applying `D` to both
the correction offset and the camera axes is important on a 90-degree turn: a
correction that was relative to the incoming section rotates with the outgoing
section instead of remaining stuck in the old world direction.

If `A0` equals `N0`, `positionOffset` is zero and the transported result equals
`N1`. This invariant is what prevents the old move-stop-move behavior.

#### Z1/Z2 correction and nominal recovery order

Each compiled sample follows this exact order:

1. transport the previous applied frame with the nominal path delta
2. if a previous correction is returning, preserve its transported full
   offset and reduce its weight with smoothstep over the configured response
   duration
3. project the current and look-ahead targets through the transported frame
4. activate correction if either target threatens Z1
5. interpolate toward the look-ahead nominal frame
6. if the current target is still outside Z1, find the first safe frame through
   coarse search and binary refinement
7. mark the correction as returning after both current and look-ahead targets
   reach the landing zone
8. snap a negligible residual correction to the nominal frame

A returning correction is considered negligible when its camera position is
within `0.5 m` of nominal and both direction and up-vector squared distances
are at most `1e-6`. Only such a negligible residual is snapped exactly to
nominal. A material correction is never snapped on the final sample, because
that would create a visible backward position or angle step.

Here "nominal" means the compiled nominal frame. The terrain redirect weight is
forced to zero at the final replay timestamp, even if terrain classification
still reports the configured base view as occluded. The compiled nominal frame
therefore ends with the configured base pitch. A final Z1 correction may still
change the applied orientation. It is released with a finite smoothstep
duration when the landing condition allows it, but continuity takes priority
over forcing an exact final position.

#### Pitch recovery through the three layers

Pitch recovery requires both temporary correction layers to clear:

```text
configured pitch
    -> optional terrain pitch offset
    -> optional applied Z1/Z2 frame correction
```

Reducing the terrain weight restores the pitch in the compiled nominal frame.
The applied frame must still advance with that new nominal orientation and
release any remaining screen-space correction. Resetting only a redirect
object is insufficient if the applied frame is stationary.

Example sequence:

1. the configured base view starts near `-45°`
2. a 90-degree turn changes the camera line of sight
3. terrain detection selects a negative pitch offset
4. the offset weight rises with smoothstep over `0.75 s`
5. the full offset is held for `0.75 s`, so the compiled nominal frame can
   reach approximately `-65°` or `-66°`
6. the weight falls with smoothstep over `1 s`, regardless of whether terrain
   still classifies the configured view as occluded
7. the replay-end envelope also multiplies the weight to zero during the final
   second
8. the orientation delta carries the resulting return into the applied frame
9. any residual Z1/Z2 correction is blended out
10. when the configured frame is safe in Z1, the applied pitch equals the
    configured pitch again

#### Corrected failure mode

The previous implementation treated the applied camera pose as a stationary
world-space frame while the marker remained safe. Its sequence was effectively:

```text
move camera -> marker reaches landing zone -> freeze camera
            -> marker approaches Z1 edge -> move camera again
```

This produced visible movement by sections in Draft and HQ recordings. It also
prevented a cleared terrain redirect from reaching the applied path. For
example, a nominal pitch near `-45°` could receive a temporary redirect, reach
approximately `-66°`, and remain there after visibility recovered because the
applied frame was frozen.

The corrected sequence is:

```text
advance with nominal path -> apply only the required correction
                          -> transport that correction through turns
                          -> blend correction back to nominal
```

The UI can display pitch magnitude near `45°` and `66°`, while the internal
camera values are negative radians derived from approximately `-45°` and
`-66°`. "Return to the original pitch" means returning to the current
configured nominal pitch, such as `cameraSettings.pitch = -45`, not returning
to zero or to the pitch of the Cesium camera before replay.

The standalone compiler uses a 30-sample-per-second target, a minimum of 256
intervals, and a maximum of 2048 intervals. The final path uses cubic,
velocity-continuous sampling and exact-progress validation. This density is
useful for offline validation, but the cap does not make terrain and
screen-space work safe for one main-thread callback. Runtime Draft and HQ
therefore do not invoke this bulk compiler.

Terrain redirect search runs once for a continuous occlusion episode. The
selected candidate is not retained as an indefinite state: only its heading and
pitch offsets are retained, and a deterministic attack/hold/release envelope
controls their weight. After the cycle has returned to zero, the same
continuous occlusion does not start another cycle. A new search becomes
eligible only after the nominal line of sight has been visible again and a new
occlusion begins. This prevents both a permanent `-66°` pitch and repetitive
pitch pumping over a long ridge.

Compiled paths may still be cached by explicit compiler consumers. The cache is
invalidated when the journey sampler changes, while the cache key also covers
the guide, camera and marker settings, runtime zones, crop, replay timing, and
frustum. Draft preparation and HQ export do not create or wait for this cache.

### Replay safety profile

Replay uses a dedicated helper in `JourneyReplayCameraCollision.js`:

```js
const safetyProfile = buildReplayTransferSafetyProfile(journey, {
  trackingMode,
  cameraSettings,
  viewport,
  clearanceMeters,
})
```

The helper combines:

- the journey world-space bbox
- the active replay zones
- the tracking mode
- the configured camera hysteresis settings

The output contains:

- `mode`
- `zoneScale`
- `clearanceMeters`
- `zones.navigation`
- `zones.dynamic.trigger`
- `zones.dynamic.target`

The safety profile remains useful for point-to-point replay transfers and
fallbacks. It does not itself guarantee screen-space containment. That
guarantee belongs to the constrained replay compiler, which evaluates actual
candidate-frame projections against Z1/Z2.

The practical effect is:

- navigation paths remain smoother and less conservative
- dynamic paths are widened and slowed down so Z1/Z2 are respected more
  aggressively

### Relief masking

When the marker or the camera line of sight is hidden by terrain, the replay
path now contours around the obstruction and then returns to the nominal
trajectory as soon as the geometry allows it.

The visibility stack is still the detection layer:

- `cameraLineOfSightVisibleForFrame(...)` checks the terrain profile between
  the camera and the marker
- `renderedTraceVisibleForSample(...)` checks whether the rendered target is
  actually visible in the scene
- `findCameraRedirectState(...)` searches for a visible fallback framing when
  the nominal view is occluded
- `cameraViewVisibilityForSample(...)` validates both the current and the
  future view before accepting the frame

The runtime behavior is:

1. build the configured nominal view for the current journey sample
2. test the line from the candidate camera frame to the rendered marker height
3. search the bounded redirect candidates once when a new continuous occlusion
   starts
4. multiply the selected heading and pitch offsets by the deterministic
   attack/hold/release weight
5. bake only those weighted offsets into each compiled nominal frame
6. test the unredirected nominal frame at every following sample
7. prevent another redirect cycle until visibility has recovered once
8. force the redirect weight to zero at cycle end and at replay end
9. transport the resulting nominal orientation change into the applied path
10. sample the resulting frames with C1-continuous cubic interpolation

So relief is no longer only a visibility correction. It is now a path
deformation rule with a bounded return-to-nominal behavior.

The terrain redirect state does not redefine the configured pitch. It only adds
a temporary offset to the nominal view. Current pitch-only candidates are
`-4°`, `-6°`, `-8°`, `-10°`, `-14°`, `-18°`, and `-20°`; combined candidates
can also add a heading offset. A configured `-45°` pitch can therefore become
`-65°`, or display approximately `66°` when the underlying nominal value is not
an exact integer. The offset returns to zero after the bounded cycle even if
the unredirected terrain classification remains occluded. The same occlusion
cannot immediately reactivate it.

Candidate selection prefers the smallest visible change with the score:

```text
score = 2 * abs(pitchOffset) + abs(headingOffset)
```

Pitch changes are penalized twice as strongly as heading changes. A pitch
change beginning at a 90-degree turn therefore means that the new line of sight
after the turn required a redirect candidate; the heading turn itself does not
modify the configured pitch.

The constrained path must continue advancing while the redirect is active and
after it clears. Otherwise the final visible result can remain near `-66°` even
though the terrain redirect state has already been cleared. This is why pitch
recovery is implemented together with continuous nominal-frame transport
rather than only by resetting the redirect state.

### Turn anticipation, drift, and journey angle

The replay path includes a real lateral drift in turns when the curvature
justifies it. The camera can take a wider line through the bend instead of
only rotating in place.

The horizontal camera angle must follow the journey direction, while pitch
remains a separate vertical framing control. In practice:

- the journey tangent drives the horizontal angle
- pitch controls only the vertical look
- the path may add a lateral overshoot or drift around bends
- the drift should relax back to the nominal line after the turn

The existing turn sampling and tangent derivation remain the basis for this
behavior. Turn drift is evaluated at adjacent camera-guide points and its
heading and lateral values are joined with four-point cubic Hermite
interpolation. The previous nearest-guide lookup created a discrete drift step
halfway between two guide points; that lookup is no longer used.

A 90-degree journey turn changes the nominal camera rotation but does not
change the configured pitch by itself. The compiler builds the rotation delta
between the incoming and outgoing nominal camera bases and applies that same
delta to the temporary correction. The correction therefore turns with the
journey. After the turn or terrain obstruction ends, its vertical component is
blended out until the applied pitch equals the configured nominal pitch.

### Replay integration

Point-to-point deterministic replay transitions consume the transfer builder:

```js
const transferPath = buildCameraTransferPath({
  start: startFrame.destination,
  end: end.destination,
  mode: transferMode,
  sampleCount: transferMode === 'direct'
    ? 24
    : Math.round((transferMode === 'elevate-then-move' ? 64 : 80) * transferScale),
  liftMeters,
  antiCollisionBounds: transferSafetyProfile,
  safetyProfile: transferSafetyProfile,
})
```

Continuous replay does not create successive point-to-point transitions.
`JourneyReplayCameraBinding.js` currently evaluates one bounded correction per
replay update. Draft uses the live correction cadence and HQ uses the explicit
export frame timestamp with the deterministic follower. The bulk constrained
compiler is not resolved from this binding while it remains synchronous.

### Live focus

Live focus in `SceneUtils.focus(...)` also uses the shared path builder.
During the flight, the code can replan from the current camera pose if the user
moves the camera. The target remains fixed and only the camera pose changes.

The current design split is deliberate:

- focus is interactive and keeps the target fixed
- focus does not use replay anti-collision logic
- replay does use replay anti-collision logic

### Panorama and other direct consumers

`PanoramaWidget.jsx` also uses the path builder instead of calling Cesium
`flyTo` directly. That keeps the panorama entry flight aligned with the same
distance-aware policy as replay and focus.

## Product Direction

- Paths are first-class runtime objects and can be created without a journey.
- The canonical replay path is generated from journey state.
- Focus, orbit, and panorama are not separate imperative camera systems. They
  are path presets or API-generated path policies on top of the same evaluator.
- `fly-to` is not only an instant Cesium call. It is a distance-aware transfer
  policy that can choose between short travel, staged travel, or a far-distance
  jump with a blur/defocus transition.
- `roll` is supported by the engine even if the UI does not expose it everywhere
  in V1.
- Runtime corrections are live-preview behavior by default. Export and HQ can
  bake a correction when necessary to guarantee a deterministic shot.
- Terrain collision avoidance is part of the path contract, not a one-off live
  rescue. When the camera path intersects relief, the compiler must raise the
  camera to a safe altitude, keep sampling ahead until the nominal altitude is
  safe again, and then blend back to the normal path. The resulting correction
  must be serialized in the path definition so replay, Draft, and HQ can reuse
  the same terrain-aware route without recomputing terrain sampling at playback
  time.
- The path engine must support 3D Bezier geometry as a first-class path
  representation, not only as an editor convenience.

## Confirmed Decisions

- Public path coordinates are GPS values: `latitude`, `longitude`, `height`.
- Every public path `height` is an absolute WGS84 ellipsoid height. Terrain
  offsets may be used while authoring, but are resolved before evaluation and
  export.
- Public angles are degrees: `heading`/`yaw`, `pitch`, and optional `roll`.
- The camera can look at one point, a sequence of points, or a group of
  points.
- The camera can perform a real 360-degree move around a point while
  continuing a larger travel path.
- Altitude may be constant or animated, but never with abrupt steps.
- If the target point becomes hidden, the runtime must be able to move the
  camera dynamically so the target becomes visible, then return smoothly to the
  nominal path.
- In turns, the camera can temporarily overshoot the nominal trajectory and
  change its camera angle relative to the journey direction. The effect is
  derived from local curvature, uses easing when entering and leaving the turn,
  and keeps pitch separate from the horizontal journey angle.
- V1 uses `bezier-easing` for CSS-like cubic-bezier temporal easing. The public
  API can accept both named easing values and `[x1, y1, x2, y2]` easing curves.
- A path can represent a direct transfer, a replay-derived route, a focus shot,
  an orbit shot, a panorama-like shot, or a generic motion preset.
- Camera thresholds such as distance transitions live in camera settings and are
  not user-editable in the UI.

## Cesium Building Blocks To Consider

- `camera.setView` for immediate application of a deterministic pose
- `camera.flyTo` only as a behavior reference or optional wrapper, not as the
  core deterministic engine primitive
- `camera.lookAt` and `camera.lookAtTransform` for pivot-based orbit and focus
  behaviors
- `camera.rotate` and `camera.zoom*` as low-level primitives inside a higher
  level evaluator, not as public path API
- `scene.pickFromRay`, `scene.pickFromRayMostDetailed`, and `sampleHeight*`
  for visibility-aware correction
- compositor blur or defocus transitions for long-distance camera transfers

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

The primary mode is a real GPS path. Each keyframe gives the camera position.

```js
{
  mode: "gps-path",
  position: { latitude, longitude, height },
  target: { latitude, longitude, height }
}
```

This mode is the most general. The camera is not constrained to orbit a target.

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

### 3D Bezier Path

The path model must also accept 3D Bezier geometry for smooth authored motion.
This is required for the track editor and for future path presets that need
continuous curvature.

The control data should live in local 3D space, then be resolved to public GPS
poses by the evaluator.

```js
{
  mode: "bezier-3d",
  frame: {
    type: "local-enu",
    origin: {
      latitude: 45.9237,
      longitude: 6.8694,
      height: 2450
    }
  },
  keyframes: [
    {
      at: 0,
      anchor: { x: 0, y: 0, z: 0 },
      handleOut: { x: 120, y: 40, z: 10 }
    },
    {
      at: 0.5,
      anchor: { x: 420, y: 280, z: 80 },
      handleIn: { x: -80, y: -50, z: -10 },
      handleOut: { x: 110, y: 60, z: 20 }
    },
    {
      at: 1,
      anchor: { x: 920, y: 650, z: 130 },
      handleIn: { x: -120, y: -70, z: -20 }
    }
  ]
}
```

Bezier 3D paths must support:

- local ENU control handles
- smooth position interpolation in 3D space
- independent altitude shaping
- deterministic export to sampled poses
- conversion to a canonical runtime path used by Draft, HQ, and replay

### Distance-Aware Camera Transfer

The path model must provide a deterministic transfer between two explicit
camera positions. This is the reusable version of `fly-to`, `focus`,
`panorama`, and other point-to-point camera actions.

The transfer policy should depend on distance, altitude delta, and framing
requirements. For example:

- short transfer: move directly while adjusting altitude and framing smoothly
- medium transfer: climb or descend toward a safe flight altitude, then move
  to the new point and settle into the final framing
- long transfer: blur or defocus, move directly, then refocus and settle on the
  target shot
- spiral transfer: use a vertical, horizontal, or conical spiral to connect two
  shots with a deliberate cinematic move instead of a straight displacement

`X km` is intentionally fixed by camera settings and should not be exposed as a
user-editable control.

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

`fly-to` must use the same deterministic evaluator as every other clip. It must
not call Cesium `flyTo` during playback or export. The runtime samples the
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

The camera transfer policy should choose one of these behaviors based on
distance and framing:

- `direct`: go from A to B with smooth interpolation
- `elevate-then-move`: climb or descend to a travel altitude first, then move
- `blur-jump-refocus`: hide the visual jump for long-distance transfers
- `spiral-vertical`: wrap the transfer around a vertical helix while climbing
  or descending
- `spiral-horizontal`: wrap the transfer around a horizontal orbit while
  moving to the new framing point
- `spiral-conical`: combine radius and height evolution into a conical spiral
- `preset`: a named reusable camera policy such as focus, orbit, panorama, or
  replay-derived move

Spiral variants mean:

- `spiral-vertical`: the camera follows a helical path around the travel axis
  while the altitude changes
- `spiral-horizontal`: the camera circles laterally around the travel axis
  while keeping the altitude mostly stable
- `spiral-conical`: the camera changes radius and altitude together to create
  a cone-like cinematic move

The API should allow parametrable presets so the same policy can be reused with
different targets, radii, distances, or framing rules without changing the
canonical evaluator.

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
progress to another normalized progress. Spatial path geometry belongs to the
separate 3D editor specification.

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

Z1/Z2 tracking is a screen-space correction policy compiled into the canonical
replay path. The nominal path first produces current and predicted poses, then
the compiler decides whether a correction is needed:

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

const constrainedPath = buildConstrainedReplayCameraPath({
  nominalPath,
  tracking,
  crop: videoCropRect,
})

const appliedPose = constrainedPath.sampleAt(progress)
```

Z1 remains the trigger zone. Leaving Z1, or predicting that the target will
leave it, can start a recenter. Z2 remains the promised landing zone for
dynamic tracking. Navigation derives an internal inset landing zone from Z1 to
avoid immediate retriggering. The extended look-ahead must not perturb a target
that is already safely inside the landing zone.

Draft and deterministic HQ export must apply the same tracking policy. The
current non-blocking runtime evaluates that policy incrementally instead of
sampling a bulk-compiled cache. Draft uses wall-clock progress and HQ uses its
explicit export timestamp. The long-term architecture still requires one
cooperatively compiled or off-main-thread path once that compiler can no longer
freeze browser rendering.

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

The generic future visibility resolver can wait `returnDelayMs` after the
target becomes visible from the nominal pose, then fade correction to zero:

```js
correctionWeight: 1 -> 0 over returnDuration
```

The current constrained Journey Replay compiler does not use a separate
wall-clock `returnDelayMs`. Its deterministic equivalent is compiled directly
into replay progress:

- terrain visibility is re-evaluated at every compiled nominal frame
- a terrain candidate follows a `0.75 s` attack, `0.75 s` hold, and `1 s`
  release envelope
- one continuous occlusion can start only one redirect cycle
- the redirect contribution is exactly zero after the release and on the final
  replay frame
- a remaining Z1/Z2 correction is transported with the moving nominal frame
  while a finite smoothstep weight reduces it to zero
- negligible correction is snapped exactly to nominal
- a material residual is preserved rather than snapped on the final frame

The final compiled nominal frame cannot contain a terrain redirect and
therefore contains the configured base pitch. The independent Z1 solver may
still leave a smoothly transported correction in the applied frame.

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
| Camera transition in HQ | Deterministic recentering interpolated camera position and orientation with a smooth scalar easing. | Continuous HQ replay uses the deterministic follower at the explicit frame timestamp; point-to-point clips retain their dedicated transition path. | Move continuous correction back to a canonical compiler only after compilation is cooperative or off the main thread. |
| Navigation and dynamic correction in HQ | Draft transitions and the HQ spring follower could diverge. | Both tracking modes use the same settings, while Draft evaluates live updates and HQ evaluates deterministic export frames without bulk compilation. | Z1/Z2 correction remains part of the canonical path target architecture without blocking current capture startup. |
| Safe-zone camera movement | The constrained compiler retained one absolute applied frame until the marker threatened Z1 again, creating move-stop-move sections. | Every applied frame is transported with the nominal position and orientation delta before constraints are evaluated. | A constrained path must carry correction offsets over a continuously moving nominal path; it must not use a safe zone as a world-space camera hold. |
| Compiled angle changes | The constrained path requested the drawer view, bypassing temporal heading and pitch smoothing. | Raw deterministic views are smoothed sequentially with factors normalized to logical replay time before frame construction. | A canonical path must own its temporal smoothing instead of computing a smoothed runtime view that is discarded. |
| Compiled path cadence | Only 128 to 256 intervals were joined linearly. | Compilation targets 30 samples per second, is bounded to 256–2048 intervals, and runtime sampling is C1-continuous. | Encoder cadence cannot compensate for discontinuous pose velocity. |
| Pitch after relief or a sharp turn | A redirect could remain active for a complete occluded stretch, so a temporary pitch such as `-66°` could survive until replay end. | Redirect offsets use a bounded smoothstep attack/hold/release cycle, cannot repeat during the same occlusion, and are forced to zero at replay end. | Terrain visibility may request a temporary deformation but cannot redefine the configured pitch indefinitely. |
| HQ timing input | Camera updates could fall back to phase or sample time. | Updates use the actual export frame timestamp and normalize heading/pitch smoothing against elapsed video time. | The future path engine should receive one explicit logical timestamp and never infer export time from wall-clock state. |
| HQ recenter duration | Navigation recentering used the normal replay duration. | Continuous Draft and HQ replay share one response duration; the historical `1.8` HQ multiplier remains limited to the legacy fallback. | Keep export-specific timing out of the canonical constrained path. |
| Replay transfer cadence | Draft capture could require a time-paced transfer instead of a frame-paced update. | Replay camera transfers can now opt into time cadence when draft capture needs wall-clock pacing. | Keep cadence selection in the replay transfer helper, not in the canonical path compiler. |
| Transition cancellation | Camera transitions assumed RAF-style cancellation only. | Function-based cancellation handles are accepted alongside RAF and timeout handles. | Treat cancellation as a transport concern of the replay controller. |
| Narrow crop navigation zone | The narrow-crop trigger ratio was `15%`. | The ratio is now `22%`; standard crops remain at `30%`. | This screen-space collision policy stays in replay tracking settings, outside the pure drone path model. |
| Draft stop frame | Completion notification was deferred to a later animation frame. | During recording, completion and the optional final-frame callback run immediately so the recorder can capture the final Cesium state. | Keep this recorder lifecycle behavior outside the pure path evaluator. |
| HQ video encoding | HQ output requested `latencyMode: 'realtime'`. | HQ output requests `latencyMode: 'quality'` because export is offline and must avoid stepped frames under encoder pressure. | Encoding policy remains in `ReplayDeferredExporter`; the path engine only guarantees deterministic poses. |
| Camera timing diagnostics | Camera timing differences between Draft and HQ were difficult to observe. | Replay trace records logical video time, wall time, effective FPS, and camera change start/end durations. | Diagnostics remain outside the pure path evaluator and are removed or disabled for production builds. |

The migration boundary is consequently:

```text
Current:
JourneyReplayMode -> camera view calculation -> Cesium camera.setView
                 -> constrained replay path cache
CameraManager    -> persisted camera state and global camera services

Target:
JourneyReplay progress/time -> constrained DroneCameraPath
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

## 3D Path Editor

The dedicated [Drone camera 3D path editor specification](../../todo/CORE-DRONE-CAMERA-3D-PATH-EDITOR-SPEC.md)
covers the later Three.js authoring surface, local ENU editing, dynamic Bezier
paths, preview boundaries, and runtime export. This architecture document only
defines the reusable runtime path model and its Cesium adapter.

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
and owns the drone-camera path model in custom code.

### Selected Building Blocks

The implementation should stay intentionally small. The retained dependencies
are:

| Component | Status | Responsibility |
| --- | --- | --- |
| `cesium` | Already installed, Apache-2.0 | Runtime camera application, WGS84 conversions, local ENU frames, terrain/tile visibility probes, scene picking, and optional spline primitives. |
| Turf modules | Already installed, MIT | Simple geospatial helpers when useful: bearing, distance, nearest point, and centroid helpers. |
| `bezier-easing` | Selected V1 dependency, MIT | CSS-like cubic-bezier temporal easing for public `[x1, y1, x2, y2]` easing curves. |

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
- every compiled destination advances while the nominal journey advances,
  including while the marker remains safely inside Z1;
- position velocity remains continuous on both sides of a compiled path frame;
- turn drift has no nearest-guide discontinuity;
- a 90-degree desired heading change is distributed over multiple compiled
  video-time frames;
- a constrained path continues advancing while current and look-ahead marker
  containment is enforced;
- terrain redirect weight is exactly zero after its bounded cycle and at replay
  end;
- a temporary terrain-style pitch redirect returns to nominal after a
  90-degree heading change;
- the `-45° -> approximately -65° -> -45°` regression scenario has no
  per-frame pitch step larger than `6°` at 30 FPS;
- the final replay frame never snaps a material position or orientation
  correction;
- a negligible final residual snaps exactly to nominal;
- correction state is stable and does not flip left/right every frame;
- controller pause/resume/seek works with simulated timers.

### Manual Tests

- orbit around a POI;
- GPS multi-point path in mountain terrain;
- target hidden by a ridge, dynamic correction, then nominal return;
- target hidden by 3D tiles/buildings, lateral correction, then nominal return;
- replay starting at a `45°` pitch, temporarily reaching approximately `66°`
  around relief, then visibly returning to `45°`;
- right-angle journey turn with continuous camera translation and no
  move-stop-move sections before or after the turn;
- frame-by-frame comparison of Draft and HQ camera position, heading, and pitch
  at identical replay progresses;
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
The ratio applies independently to width and height: on a `1080 × 1920` crop,
the narrow navigation zone is `237.6 × 422.4` pixels, not a square. Dynamic
tracking keeps its separate Z1/Z2 configuration, with both zones using the
same independent width and height ratios.

The target architecture has Draft and HQ consume the same in-memory constrained
path. The compiler tests current and predicted marker samples against runtime
zones before starting a correction. It projects through candidate frames rather
than through the asynchronously rendered Cesium camera. Before those
projections, the applied frame is advanced by the nominal position and rotation
delta for the current journey sample. A safe target therefore prevents an
unnecessary Z1/Z2 correction but never freezes camera movement.

When a correction is active, its position and orientation offsets rotate with
the nominal frame, including across sharp heading changes. Reaching the landing
zone starts a deterministic finite-duration return toward nominal. The terrain
component ends on the configured base pitch because its envelope is forced to
zero at replay end. A material Z1 correction is not snapped away on the last
sample; preserving camera continuity takes priority over forcing an exact
nominal final position.

When bulk compilation is explicitly used, every `sampleAt(progress)` call
resolves the actual journey marker target and performs a final containment
check, including progresses between cached frames. The cached frames are joined
with shared-tangent cubic interpolation rather than independent linear
segments. Runtime capture does not create or wait for that cache while
compilation remains synchronous.

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

Navigation and dynamic tracking use the replay camera response duration. HQ
currently owns a deterministic spring follower for continuous replay so each
frame stays timestamp-driven without requiring bulk path compilation. Start and
stop clips keep their own phase durations.

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


### V3 - Advanced Timing

- Global `timeRemap`.
- Explicit speed points.
- Holds and pauses.
- JSON import/export for presets.
- Catmull-Rom or Hermite interpolation in local ENU.
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

## Open Questions

- Which canonical path fields are mandatory in V1 versus generated by presets?
- How should the API represent parametrable presets: nested `preset` objects,
  named policy identifiers, or factory helpers?
- Should `focus`, `orbit`, and `panorama` be exposed as public API names, or
  only as generated policies?
- Which 3D Bezier authoring primitives should be exposed in V1:
  anchors only, anchors plus handles, or a higher-level spline editor?
- What maximum correction is acceptable before declaring that a target cannot
  be shown without changing the shot?

## Proposed Plan

1. Define the reusable path core.
   - Generic path entity
   - Position, target, and transfer policies
   - Deterministic evaluator and validation
2. Define path presets.
   - Direct transfer
   - Focus
   - Orbit
   - Panorama
   - Replay-derived path
3. Define replay integration.
   - One path definition for Draft and HQ
   - Replay path generated from journey state
   - Same evaluator in both modes
4. Define the distance-aware transfer policy.
   - Short-distance direct movement
   - Medium-distance climb/move/settle
   - Long-distance blur-jump-refocus
5. Define storage and ownership.
   - Path library location
   - Journey reference model
   - Export/import shape
6. Define authoring and UI follow-up.
   - Path editor
   - Preset selection
   - Replay shot editing

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
