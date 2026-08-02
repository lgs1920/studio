# Replay Camera Tracking Zones

This document describes the camera tracking zones used by replay video
recording and deferred HQ export.

## 1. Purpose

The replay camera follows a moving marker without continuously moving. It waits
until the marker reaches a defined trigger zone, then recenters the camera so
the marker remains comfortably visible.

The same camera-tracking rules are used by Draft recording and HQ export. HQ
does not use a different visual configuration: it evaluates the same Turf-based
sampler and collision policy at deterministic export timestamps. Draft evaluates
the same policy on the live Cesium camera frame without compiling the complete
route on the browser main thread.

## 2. Zone definitions

Coordinates are normalized to the viewport: `(0, 0)` is the top-left and
`(1, 1)` is the bottom-right. A centered zone of ratio `r` has:

```text
left   = (1 - r) / 2
top    = (1 - r) / 2
width  = r
height = r
```

The ratio applies independently to the viewport width and height. The zone is
not forced to be square in pixels. For example, a `30% × 30%` zone on a
`1080 × 1920` portrait crop is `324 × 576` pixels.

### Navigation mode

Navigation uses one zone only:

| Zone | Ratio | Normalized bounds | Meaning |
| --- | ---: | --- | --- |
| Z1 | 30% × 30% | `left=35%`, `top=35%`, `right=65%`, `bottom=65%` | Trigger zone for camera recentering |

There is no Z2 in navigation mode. When the marker leaves Z1, the camera aims
at the predicted marker position. On a narrow crop, Z1 uses `22% × 22%`; its
pixel dimensions therefore follow the crop aspect ratio instead of becoming a
square.

### Dynamic mode

Dynamic mode uses two nested concepts:

| Zone | Ratio | Normalized bounds | Meaning |
| --- | ---: | --- | --- |
| Z1 | 75% × 75% | `left=12.5%`, `top=12.5%`, `right=87.5%`, `bottom=87.5%` | Outer trigger zone |
| Z2 | 30% × 30% | `left=35%`, `top=35%`, `right=65%`, `bottom=65%` | Recenter landing zone |

Z1 is deliberately large: dynamic tracking starts early, before the marker
reaches the viewport edge. Z2 is the stable central area where the marker is
placed after a correction.

## 3. Trigger algorithm

For each replay update, the implementation projects the current and predicted
marker samples into Cesium window coordinates, then converts them into the
active video-crop coordinate space. This crop-local conversion is mandatory for
every video format, including landscape, square, and portrait 9:16 crops.

1. Project the marker into Cesium window coordinates.
2. Subtract the active crop's `left` and `top` offsets when a crop is active.
3. Convert the configured normalized zone into pixel bounds using the crop's
   width and height.
4. Treat a point on or beyond any bound as outside the zone.
5. In navigation mode, leave Z1 when the current or predicted point is outside
   the navigation zone.
6. In dynamic mode, use the same test against dynamic Z1. Z2 is not used as
   the initial trigger condition.
7. If a point cannot be projected, it is treated as outside the zone so that
   visibility is not silently lost.

The current and predicted samples are both checked because Cesium projection
can be updated asynchronously while Draft playback is running. Draft and HQ
use the same normalized Z1/Z2 definitions and collision decisions; only their
camera clocks and frame-application adapters differ. A missing viewport,
non-finite screen point, or target behind the candidate camera is a hard
collision, never an implicit safe result.

The look-ahead also includes one output-frame interval. Draft resolves that
interval from `replay.captureFps`; HQ resolves it from the export timeline FPS.
Therefore a 15 FPS capture anticipates `66.67 ms`, while a 60 FPS capture
anticipates `16.67 ms`. This compensates for the larger position jump between
low-FPS frames without changing the visual size of Z1 or Z2.

Navigation additionally uses a fixed two-second predictive horizon. A predicted
Z1 violation starts a two-second recenter transition before the marker leaves
the zone, and the transition target is the route sample at that same `t + 2 s`
horizon. An already violated Z1 targets the current anchor and uses a short
bounded recovery transition. Every transition sub-frame is checked against the
candidate camera frame: hard recovery validates the current anchor, while a
predictive recovery validates the route sample at the corresponding fraction
of the two-second horizon. A candidate that is invalid or outside Z1 is
replaced with a safe frame before it is rendered.

## 4. Predictive processing

Predictive processing is used to compensate for camera movement, easing and
Cesium projection latency. It does not move the replay timeline forward. It
only selects a future path sample to decide whether the camera should start
moving and where it should aim.

### 4.1 Anchor and normal future sample

For every camera update, the nominal camera view first produces an `anchor`
sample: the marker position at the current replay time. The implementation then
computes a normal future sample:

```text
futureSample = sample at current distance + lookahead distance
predictedSample = futureSample or anchorSample
```

The look-ahead duration is the configured camera recenter duration. The path
sampler converts that duration to distance. To avoid an insignificant or zero
look-ahead, the selected distance is at least the greater of:

- the duration-derived distance;
- `120 m`.

The sampler clamps the requested distance at the end of the path. The runtime
uses a minimum metric horizon of `120 m` when the time-derived distance is too
small. If no later sample exists, the current anchor is retained.

This normal future sample is used in both navigation and dynamic mode. In
navigation mode, leaving Z1 is tested with both the current and predicted
positions. The camera aims at the predicted position when a correction is
needed, except for an already hard current violation, which is corrected
against the current anchor to remove the marker lag at the Z1 corner.

### 4.1.1 Navigation heading and drift smoothing

Navigation heading is derived from the Turf path tangent and a symmetric
spatial window, not from the last rendered Cesium camera heading. The default
window follows the beta.2 behavior: a `2.5 s` future chord, a minimum `400 m`
metric window, and a nine-sample PCA axis oriented by the future chord. This
filters short alternating zigzags while still turning before a sustained bend.

The resulting heading is applied with frame-rate-independent response factors
clamped to `0.04..0.18`. The navigation drift offset is also low-pass filtered
with a `1.5 s` response and limited to `6°` / `40 m`; a turn drift is only
enabled once the route turn exceeds `12°`. These limits affect heading and
lateral motion only. They never relax the hard Z1/crop collision.

### 4.2 Extended dynamic look-ahead

Dynamic mode has a second, stronger prediction used only for a tight camera
angle near the crop boundary. It is enabled only when the current projected
marker is:

- inside dynamic Z1; and
- outside dynamic Z2.

This is the ring between Z1 and Z2. In that ring:

```text
extendedLookaheadSeconds = recenterDuration × 1.35
extendedTrackingSample  = sample at extended look-ahead distance
```

The `1.35` multiplier lets the camera lead the marker far enough for a closed
or steep pitch, where the marker can keep moving toward the crop edge while the
camera is still easing.

The multiplier is intentionally not applied in either of these cases:

- the marker is already inside Z2: use the normal `predictedSample`;
- the marker is already outside Z1: use the normal `predictedSample` and handle
  the active correction directly.

This makes the extended prediction an early-warning mechanism in the Z1–Z2
band, rather than a permanent acceleration of dynamic tracking.

### 4.3 Current and predicted screen positions

The current anchor and the selected tracking sample are projected into Cesium
window coordinates:

```text
currentScreen   = project(anchorSample)
predictedScreen = project(trackingSample)
```

The algorithm uses both positions because the current marker may still be
inside Z1 while its predicted position is already leaving it. This is also a
guard against asynchronous projection updates in live Draft playback.

If a screen position cannot be projected, it is treated as a hard collision and
therefore outside the relevant zone. The camera prefers a visibility correction
over silently allowing the marker to disappear. The same rule is applied to a
live Draft projection and to every candidate frame of a deterministic HQ
transition.

### 4.4 Predictive collision and visibility checks

The current and selected future samples are tested against the camera's
configured trigger-zone collision model:

```text
currentCollision   = collision(anchorSample, Z1)
predictedCollision = collision(trackingSample, Z1)
outsideTolerance   = currentCollision.hard OR predictedCollision.hard
```

For Navigation, the selected camera target and duration are deterministic:

```text
if currentCollision.hard:
    targetSample     = anchorSample
    transition       = min(0.24 s, configuredRecenterDuration)
else if predictedCollision.hard:
    targetSample     = sampleAtTime(currentTime + 2 s)
    transition       = 2 s
```

The two values in the predictive branch are intentionally coupled. Reducing
the target lead while keeping a two-second transition makes the live marker
outrun the camera and appear late in the lower-right or upper-right part of Z1.

Dynamic mode separately tests the selected tracking sample against Z2. This
second test is not the initial trigger; it validates whether the promised
landing position was actually reached:

```text
outsideTargetZone = collision(trackingSample, Z2).hard
```

After the recenter duration has elapsed, an additional correction is allowed
if `outsideTargetZone` is still true. This catches cases where a steep camera
angle lets the marker continue toward the crop edge during the transition.

The future sample is used for Z1/Z2 positioning. Draft may also use it to
prepare a heading/position visibility redirect, but its pitch offset is removed
when the current nominal view is already visible. HQ uses the current marker
for visibility redirects. When the nominal current view is visible again, the
redirect is cleared and the nominal pitch is restored at the next camera
update.

### 4.5 Predictive Z2 target point

When a dynamic correction is required, the target point is selected inside Z2:

1. Compute the movement vector from the current screen point to the predicted
   screen point.
2. Reverse that vector so the camera moves against the marker's apparent
   screen movement.
3. Offset the center of Z2 by up to `35%` of Z2's width and height.
4. Clamp the result to Z2 bounds.
5. If there is no meaningful movement vector, use the center of Z2.

The offset is opposite to the marker's screen movement. For example, if the
marker is predicted to move right, the camera target is biased left within Z2.
This gives the marker room to continue moving after the camera correction and
avoids immediately triggering another correction.

The target point is used for the dynamic camera target calculation. When no
terrain/3D-tiles redirect is required, the camera flight itself uses the
tracking sample so that the geographic camera position remains synchronized
with the replay path. When a redirect is required for visibility, the redirect
view takes precedence.

## 5. Camera recentering and hysteresis

The camera transition uses the configured replay easing and recenter duration.
The implementation keeps the last recenter progress and timestamp to avoid
replacing an active transition on every frame.

Dynamic mode also validates the Z2 landing after the nominal transition has
completed. If the marker is still outside Z2, a corrective recenter is allowed.
This is especially important for non-top-down camera pitches, where the marker
can continue moving toward a crop edge while the camera is easing.

Visibility correction is separate from ordinary tracking. If terrain or 3D
tiles hide the rendered marker, the camera may recenter for visibility. Z1
still governs ordinary framing corrections, but rendered-depth or terrain
line-of-sight occlusion is an independent visibility constraint: a marker can
be centered inside Z1 and still trigger a temporary pitch/heading redirect.
The redirect is locked during its transition, escalates only when the marker
remains hidden, and returns to the nominal pitch after visibility recovers.

The replay marker itself always remains depth-tested. Its Cesium point uses
`disableDepthTestDistance = 0`, so terrain relief and 3D tiles can mask it when
they are between the camera and the marker. Camera visibility correction must
not turn the marker into an overlay rendered above the relief.

## 6. Z1/Z2 diagnostic overlay

The replay mode draws a visual overlay for the configured tracking zones. This
overlay is intentionally useful beyond the current UI: it can be reused later
as a debugging surface for camera-tracking investigations.

The overlay has the following structure:

```text
.replay-tolerance-zone-overlay
└── .replay-tolerance-zone-overlay-outer [data-zone="z1"]
    └── .replay-tolerance-zone-overlay-inner [data-zone="z2"]
```

The outer element represents the active trigger zone. The inner element is
present only for dynamic mode and represents the target zone. The parent also
publishes the active mode through `data-mode`.

The overlay is positioned from normalized zone bounds and the current Cesium
surface rectangle, so it remains meaningful when the video crop or viewport
changes. It has `pointer-events: none`, which means it cannot interfere with
camera controls or replay interaction.

The overlay is visible by default during replay, Draft playback, and HQ preview
so the active crop-local Z1/Z2 decision can be inspected directly. It remains
non-interactive and is excluded from captured output through the existing
overlay/capture rules. It can be hidden at runtime with:

```js
globalThis.__?.ui?.replay?.setToleranceZoneOverlayVisible?.(false)
```

and shown again with the same method called with `true`.

For future debugging, the overlay can be extended with diagnostic attributes or
additional layers such as:

- the current marker screen position;
- the normal predicted position;
- the extended `1.35` look-ahead position;
- the current and predicted collision states;
- the selected Z2 target point;
- the reason for a recenter (`Z1 exit`, `Z2 correction`, or visibility loss).

Keeping the zone overlay separate from the camera algorithm allows these
diagnostic additions without changing replay behavior. Existing selectors and
`data-zone` attributes should remain stable so automated tests and debugging
tools can continue to identify Z1 and Z2.

## 7. Final Draft frame and trace lifetime

At replay end, the completed trace must remain rendered while the recorder
captures the final Draft frame. The final-frame sequence is:

1. render the replay at progress `1` and keep the completed trace visible;
2. wait for the final widget/render frames;
3. notify the video synchronizer to capture the final frame;
4. clear the replay renderer and restore the normal journey scene.

The notification must happen before renderer cleanup. Clearing the renderer
first produces a last video frame without the trace, even though all preceding
Draft frames contain it. Stop clips already follow the same ordering: the final
frame notification is emitted before the replay scene is finalized.

The video synchronizer starts `stopVideo({captureFinalFrame: true})`
immediately after the final-frame notification. Replay cleanup is also guarded
while the recorder reports that it is still recording. This is necessary
because final-frame capture and video encoding are asynchronous; returning from
the notification handler does not mean that the source canvas has already been
read.

Before the recorder submits that final frame, the video compositor is explicitly
rendered again from the current Cesium canvas. This final recomposition is used
for Draft and HQ. Without it, Draft can submit the previous compositor frame:
the Cesium trace may still be visible on screen while the encoded last frame
still contains stale composition data.

This ordering applies to the visible Cesium trace; it is not replaced by a
separate video trace overlay. Keeping the trace terrain-clamped ensures that
the final frame has the same geometry as the preceding Draft frames.

## 8. Draft and HQ execution

Draft playback receives live Cesium render-loop updates. HQ export advances the
replay to an exact logical timestamp before each encoded frame. The HQ runtime
publishes that frame state to dynamic widgets and the renderer.

`recordingSync` identifies a live Draft controlled by the replay toolbar. It
must not select the deterministic HQ camera clock; otherwise collision
transitions are created but never advanced by the Draft render loop.

During HQ export, `controller.seek()` publishes frame state but its normal live
update listener must not apply the camera. The export frame renderer is the
single owner of the deterministic camera update; applying both paths on the
same frame produces visible camera jitter. Draft remains the owner of live
camera application and uses the live candidate frame for collision checks.

Consequently:

- navigation uses Z1 = 30% × 30% normally, or 22% × 22% for a narrow crop, in
  both Draft and HQ;
- dynamic mode uses Z1 = 75% × 75% and Z2 = 30% × 30% in both Draft and HQ;
- camera look-ahead includes one output-frame interval in both Draft and HQ;
- Navigation predictive corrections use a coupled `2 s` route horizon and
  transition; current hard violations use the current anchor;
- navigation drift uses the beta.2-style spatial heading window and a `1.5 s`
  lateral response filter;
- no free-running widget timer is required during HQ export;
- the same Turf marker sample, crop-local projection, collision, and recentering
  policy are reproduced from the export timeline; only the camera application
  clock is live in Draft and explicit in HQ.

The deferred HQ export also captures the saved Cesium camera/focus snapshot
from the draft start and feeds it into playback-scene preparation. This keeps
HQ from starting on a different visual focus than the Draft that prepared it.

## 9. Implementation references

- `src/core/ui/replay/JourneyReplayCameraBinding.js`: Draft/HQ camera ownership,
  Navigation target selection, and hard transition guards;
- `src/core/ui/replay/JourneyReplayCameraState.js`: crop-local live and
  candidate-frame collision evaluation;
- `src/core/ui/replay/JourneyReplayCameraMath.js`: normalized zones, projection,
  and collision geometry;
- `src/core/ui/replay/JourneyReplayPathSampler.js`: Turf metric samples,
  look-ahead, and route tangent heading;
- `src/core/ui/replay/JourneyReplayTurfPath.ts`: renderer-independent Turf path
  construction;
- `src/core/ui/replay/JourneyReplayPlaybackController.js`: live replay ticks
  and dynamic frame state;
- `src/core/ui/replay/ReplayDeferredExporter.js`: deterministic HQ frame
  publication;
- `src/__tests__/replay-phase1.test.js`: zone geometry and tracking behavior
  tests.
