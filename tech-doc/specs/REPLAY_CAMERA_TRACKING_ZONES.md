# Replay Camera Tracking and Temporary Pitch

Status: current implementation

Date: 2026-08-03

## Scope

This document describes the replay camera behavior implemented for Navigation
and Dynamic (`hysteresis`) marker modes. It is the canonical specification for:

- renderer-independent nominal camera poses;
- Navigation and Dynamic tracking zones;
- temporary visibility pitch correction;
- Draft and HQ camera parity;
- camera-frame ownership during tracking and correction.

Trace mode is outside this contract because it does not track the replay marker
with the camera. Start and stop clips may explicitly define other camera poses
and are also outside the temporary visibility-correction lifecycle.

## 1. Shared Draft and HQ contract

Draft and HQ call the same camera resolver. The render mode changes only the
source of logical time and frame scheduling:

| Concern | Draft | HQ |
| --- | --- | --- |
| Logical time | Live replay playback | Deterministic export frame timestamp |
| Capture | Live recorder | Sequential offline exporter |
| Camera resolver | `JourneyReplayCameraTrackingBinding` | `JourneyReplayCameraTrackingBinding` |
| Nominal pose | `resolveJourneyReplayLogicalCameraPose` | `resolveJourneyReplayLogicalCameraPose` |
| Pitch correction | Shared state machine | Shared state machine |

For identical settings, replay data, viewport, and logical timestamp, both
modes must resolve the same camera decision. Draft is allowed to sample fewer
timestamps because of its lower frame rate; it is not allowed to use a
different visibility, pitch, drift, or tracking algorithm.

No complete constrained camera path is compiled synchronously before replay or
export. The active resolver works from the current logical frame and bounded
look-ahead samples.

## 2. Nominal camera pose

The nominal pose is recalculated from the current logical replay sample. It is
never derived from the current Cesium camera orientation.

The position modes behave as follows:

- `Behind`: route-axis heading plus the configured heading offset;
- `Ahead`: route-axis heading plus 180 degrees and the configured heading
  offset;
- `System`: configured heading, except Navigation may use the route axis when
  an axis heading is available.

The configured heading offset is normalized before use. Pitch comes from the
configured camera pitch. Values at or below -89 degrees use a safe near-top-down
pitch to avoid a singular orientation. Camera height is either the configured
constant altitude or the sample height plus the configured ground offset.

Navigation and Dynamic use this same resolver. Neither tracking mode may force
`Ahead` or bypass the selected `Behind`, `Ahead`, or `System` behavior.

## 3. Temporary visibility correction

Temporary pitch correction is independent from Navigation and Dynamic zone
handling. Both modes use the same visibility observation, candidate search,
state machine, limits, and camera application path.

### 3.1 Activation observation

The controller evaluates the current nominal camera view. A predictive sample
is not used to activate or retain a pitch correction.

The nominal view is considered visible unless either of these checks proves it
hidden:

1. geometric line of sight from the candidate camera frame;
2. rendered visibility of the current marker in the Cesium scene.

The geometric line-of-sight check evaluates the current marker and trailing
trace samples at 6, 12, 18, and 24 metres when available. The marker and the
samples through 12 metres are required; the 18- and 24-metre samples are
advisory and cannot reject an otherwise valid view. Rendered visibility checks
the same required marker and near-trace targets. An unavailable rendered
observation is treated as unknown, not hidden.

This distinction is intentional: the required rendered near trace participates
in current visibility, while predictive samples do not. Prediction may
influence camera tracking, but it may not keep adding or retaining temporary
pitch while the current marker and required near trace are visible.

### 3.2 Candidate selection

When the current nominal view is hidden, the resolver tests a bounded set of:

- pitch-down offsets;
- heading offsets;
- combined heading and pitch offsets.

The current redirect is tested first and reused if it remains valid. The first
search requires geometric visibility for the marker and required near-trace
targets. If that strict search finds no candidate and Cesium has explicitly
reported the current rendered marker as hidden, the resolver repeats the
bounded search for the marker alone. This prevents a hidden trace segment from
blocking every correction capable of restoring the marker. There is no
fallback to an untested pitch change: the marker-only candidate must still
prove geometric marker visibility.

The temporary pitch controller excludes heading-only candidates, including a
previous redirect whose pitch offset is zero. Every candidate accepted by this
controller therefore has a non-zero pitch-down component. Combined heading and
pitch candidates remain valid, but a successful heading-only redirect cannot
start or retain a pitch-correction phase.

Candidates are scored with:

```text
score = 3 × abs(pitch offset) + abs(heading offset)
```

The lowest valid score wins among candidates that contain the required pitch
component. This weighting still avoids an unnecessarily large pitch change and
selects a combined redirect only when it is the smallest proven solution.

The preferred pitch envelope depends on the nominal pitch:

| Nominal pitch | First search envelope | Hard limit |
| --- | ---: | ---: |
| Shallower than -30 degrees | 8 degrees | 20 degrees |
| -30 degrees or steeper | 20 degrees | 20 degrees |

For a grazing view, the resolver first searches within the gentle eight-degree
envelope. If no candidate in that envelope can prove visibility, it repeats the
search with the common twenty-degree hard limit. This prevents the controller
from remaining indefinitely in `pending` when a small correction is
insufficient. All candidates are clamped before they are evaluated and
deduplicated, and the selected wider correction still uses the normal attack.
For example, a nominal -10-degree pitch can never be corrected beyond -30
degrees by this controller.

### 3.3 State machine

The controller uses logical milliseconds and the following phases:

| Phase | Behavior |
| --- | --- |
| `inactive` | Use the exact nominal pose. |
| `pending` | Confirm that invisibility persists before changing the camera. |
| `attack` | Smoothly blend from nominal to the selected correction. |
| `hold` | Keep the proven correction while the nominal view remains hidden. |
| `release` | Smoothly blend back to the current nominal pose. |

Timing constants:

| Rule | Duration |
| --- | ---: |
| Hidden confirmation before activation | 250 ms |
| Attack | 900 ms |
| Visible confirmation before release | 150 ms |
| Release to nominal | 450 ms |

Attack and release use smoothstep easing. A single hidden observation that
clears during `pending` produces no camera change. If visibility is lost again
during `release`, the controller resumes `attack` from the current weight
instead of restarting or stacking another correction.

The weighted redirect is always applied to the newly resolved nominal pose.
Offsets are not added to the previously corrected camera pose. This invariant
prevents cumulative pitch drift and guarantees a return to the configured
target.

Programmatic frame application also suppresses the Cesium-to-settings bridge.
Delayed Cesium camera events produced by a correction cannot persist the
corrected pitch or heading as a new user setting. A real pointer interaction
remains authoritative and may update the replay camera settings during this
suppression window.

The final replay frame clears the correction state and applies the exact
nominal pose. Changing marker mode or resetting camera tracking also clears the
pitch state, redirect state, and visibility-confirmation timestamps.

## 4. Navigation tracking

Navigation uses one centered trigger zone, Z1.

Default geometry:

- regular viewport: 30% width and 30% height;
- narrow crop, where the short-to-long viewport ratio is below 0.75: 22% width
  and 22% height;
- adaptive minimum for a short or ending replay: 5% width and 5% height.

The current camera frame is tested against:

- the current nominal marker sample;
- a predicted sample at the adaptive Navigation horizon;
- a 0.75-second confirmation sample when only the predicted sample is outside
  Z1.

A current hard violation is corrected immediately. A predictive-only violation
must remain confirmed for 250 ms before correction. The predictive transition
target is sampled at the adaptive Navigation transition horizon, whose normal
value is 2 seconds. Navigation has no minimum distance floor, so the look-ahead
remains time-based at low route speeds.

Current hard violations, forced corrections, and immediate startup corrections
apply one complete target-locked frame directly. A confirmed predictive-only
violation during playback starts a deterministic camera transition. If there
is no correction, an already initialized playback camera remains stable rather
than being recentered on every frame.

## 5. Dynamic tracking

Dynamic uses two centered zones:

| Zone | Default | Adaptive minimum | Current role |
| --- | ---: | ---: | --- |
| Z1 trigger | 75% × 75% | 30% × 30% | Classifies the current marker against the outer tracking zone. |
| Z2 target | 30% × 30% | 30% × 30% | Selects extended look-ahead while the current marker is inside Z1 but outside Z2. |

The normal Dynamic look-ahead is:

```text
adaptive transition horizon × 1.25 + one output-frame interval
```

It has a minimum distance of 120 metres. When the current marker is inside Z1
but outside Z2, the time horizon is multiplied by 1.35. Otherwise the normal
future sample is used.

During playback and export, Dynamic resolves and applies the camera pose for
the selected future sample on every logical update. Outside playback it uses
the current nominal sample.

`lastDynamicTargetScreen` is calculated from the current and predicted screen
positions for diagnostics. The active camera resolver does not use that point
as a landing target. Therefore Z2 currently selects the extended look-ahead;
it is not a guarantee that the marker lands inside Z2 after a camera update.

Dynamic does not use the former free-running follower in the active logical
path. Each update applies one complete resolved frame and clears incompatible
transition or follower transport state first.

## 6. Adaptive zones and look-ahead

The adaptive timing budget is renderer-independent. It includes:

- the requested transition duration;
- one output-frame interval;
- a fixed 180 ms calculation-lag allowance;
- playback rate;
- total and remaining replay duration.

As the available replay window becomes too short for the normal transition,
zones interpolate toward their minimum ratios. Dynamic Z2 is always nested
inside Z1. The minimum transition horizon is also limited by the remaining
logical replay time.

The actual logical-frame interval is used when available. Otherwise the active
resolver uses the configured replay capture FPS and falls back to the Draft
look-ahead default of 15 FPS. The math helper also exposes a 60 FPS HQ fallback
for callers that explicitly select `renderMode: 'hq'`, but the active tracking
binding normally receives the HQ frame interval directly. These timing inputs
change temporal sampling only; the camera rules remain shared.

## 7. Turn drift

Navigation and Dynamic request the same drift envelope:

- maximum heading offset: 6 degrees;
- maximum lateral offset: 40 metres;
- minimum sustained turn angle: 12 degrees.

In the active logical camera path, only `headingOffsetRadians` is currently
added to the nominal pose. `lateralOffsetMeters` is calculated by the guide
helper but is not consumed by the logical pose. Documentation and tests must
not claim that the active runtime applies lateral camera displacement.

The constrained-path compiler also uses one shared 1.5-second drift response
for both modes. That compiler is not the active per-frame camera authority and
must not block Draft startup or HQ preparation.

## 8. Camera ownership and frame application

Only one camera mechanism may own a logical replay update:

1. an active temporary pitch correction;
2. an active deterministic Navigation transition;
3. the current tracking-mode resolver.

Temporary pitch correction has priority. While it owns the camera, it cancels
other transition or follower transport and writes one complete target-locked
frame containing destination, direction, and corrected up vector.

A camera view is remembered only after the complete frame is successfully
applied. The controller never records a target pitch or heading that Cesium did
not receive.

Live, non-playback drawer refreshes use the Cesium adapter but still apply a
complete target-locked pose. Manual user camera interaction suspends replay
camera updates until replay tracking regains ownership.

## 9. Diagnostics

The tolerance-zone overlay displays the current runtime zones and timing data
for Navigation and Dynamic. It is diagnostic only and is not a second source of
tracking decisions. HQ composition can capture the overlay canvas even when it
is hidden in the normal DOM layout.

Fine-grained camera traces expose logical time, marker mode, visibility phase,
correction weight, desired heading, and desired pitch. These traces should be
used to distinguish zone tracking from temporary visibility correction.

## 10. Implementation references

- `src/core/ui/replay/JourneyReplayCameraTrackingBinding.js`: active shared
  Navigation/Dynamic resolver and camera ownership.
- `src/core/ui/replay/JourneyReplayCameraPitchController.js`: temporary pitch
  state machine and limits.
- `src/core/ui/replay/JourneyReplayLogicalCameraPose.js`: nominal
  renderer-independent pose and Behind/Ahead/System behavior.
- `src/core/ui/replay/JourneyReplayCameraVisibility.js`: geometric and rendered
  visibility plus redirect candidates.
- `src/core/ui/replay/JourneyReplayCameraMath.js`: runtime zones and adaptive
  timing.
- `src/core/ui/replay/JourneyReplayCameraBinding.js`: live Cesium bridge and
  transition plumbing.
- `src/core/ui/replay/JourneyReplayCameraConstraintBinding.js`: optional
  constrained-path compiler.
- `src/__tests__/unit/replay/replay-camera-path.test.js`: tracking, zones,
  visibility, parity, and ownership regression coverage.
- `src/__tests__/unit/replay/replay-camera-pitch-controller.test.js`: temporary
  pitch lifecycle coverage.
