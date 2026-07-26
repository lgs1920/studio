# POI Animation During Replay

## Status

Proposed specification for milestone `1.1.0`.

The existing tracking item is [GitHub issue #395](https://github.com/lgs1920/studio/issues/395).

## Context

Replay POIs are currently expanded when the replay reaches their projected
distance. The runtime uses `displayDurationSeconds` and a wall-clock timeout to
collapse them again. Replay start and stop POIs follow different visibility
rules, and the stop POI is hidden when it is too close to the start POI.

The current implementation does not provide a complete start/stop animation
contract, does not schedule animations from replay time, and does not provide
field-level control for the information displayed by an animated POI.

Relevant implementation areas are:

- `src/core/ui/replay/JourneyReplaySessionPOIController.js`
- `src/core/ui/replay/JourneyReplayVisibilityController.js`
- `src/core/ui/replay/JourneyReplayPlaybackController.js`
- `src/core/ui/replay/JourneyReplayPOISettings.js`
- `src/components/MainUI/MapPOI/MapPOIContent.jsx`
- `src/components/cesium/MapPOI.jsx`
- `src/core/Journey.js`

## Confirmed product decisions

- In this specification, animation means the existing automatic POI opening and
  closing behavior. A separate visual motion effect is not part of this
  milestone.
- When `tooClose === false`, the start POI opens at the beginning and the stop
  POI opens at the end.
- When `tooClose === true`, the start POI is the single visible endpoint. It
  opens with start data at the beginning and opens again with the complete stop
  data at the end.
- The complete POI data set is available during the `tooClose === true` end
  presentation, subject to the selected field visibility configuration.
- `Pause replay` is a per-POI setting and applies to every POI category.
- Users can choose the fields displayed by each POI. When `tooClose === true`,
  the same field selection is used for the start and end presentations. When
  `tooClose === false`, the start and stop POIs may use different selections.

## Goals

- Define deterministic start and stop POI animation behavior.
- Keep start and stop endpoint visibility coherent in both `tooClose` modes.
- Allow field-level display selection for every POI, independently of category.
- Support animation while replay playback is paused when enabled for that POI.
- Validate animation duration against the complete replay timeline.
- Stop active and pending animations at replay completion and restore the
  pre-replay POI state.
- Keep live replay, clip playback, pause/resume, and video export on one timing
  model.

## Non-goals

- Changing POI geometry, iconography, or the existing manual POI editor outside
  replay-specific settings.
- Making `tooClose` a user-editable setting.
- Persisting temporary stop data into the start POI.
- Adding a second animation engine based on CSS clocks or independent timers.
- Adding a new POI category solely for the co-located start/end presentation.

## 1. Start and stop animation

### Problem analysis

The journey model creates start and stop flag POIs for track boundaries. The
journey visibility rules normally keep the first start and final stop visible.
When the endpoints are close, `tooClose` is set on the final stop POI and the
scene hides that stop POI, leaving the start POI as the visible representation.

The existing replay controller expands a POI when its distance trigger is
reached, but it does not model the endpoint pair as a single animation flow.
This creates several risks:

- start and stop presentations can disagree about whether they are animated;
- the co-located end cannot show the stop data without mutating persisted start
  data;
- the field selection is incomplete because date/time is not currently part of
  the replay hidden-field configuration;
- the stop presentation can be lost when the stop POI is masked by `tooClose`;
- asynchronous collapse timers can outlive the replay phase that created them.

### Solution A: paired endpoint presentation model — selected

Introduce a transient replay presentation model for endpoint POIs. It is derived
from the source POIs and is never persisted as a replacement for the POIs.

For `tooClose === false`:

1. Resolve the first visible start POI and the final visible stop POI.
2. At replay start, schedule the start presentation using the start POI's
   replay settings and field selection.
3. At the end of the replay and after the last stop clip has completed, schedule
   the stop presentation using the stop POI's replay settings and field
   selection.
4. Keep the two presentations linked to the same replay lifecycle, while
   retaining distinct source IDs, data, settings, and display masks.

For `tooClose === true`:

1. Resolve the visible start POI and the hidden/co-located stop POI.
2. At replay start, present the start POI using start data.
3. At the end of the replay and after the last stop clip has completed, present
   the same visible start POI using a transient snapshot containing all stop
   data.
4. Apply the start POI's selected fields to both presentations.
5. Restore the original start POI data, expansion state, visibility, and source
   identity when the replay ends.

The transient snapshot must include all fields available on the stop POI,
including title, display type, category, location, coordinates, altitude, and
date/time. Field selection controls whether an individual field is rendered;
it must not remove data from the source POI.

The display type for the co-located presentation must be runtime-only. Proposed
neutral display label: `Journey endpoint`. This label must not replace the
persisted `start` or `stop` POI type. Product validation may select a different
display-only label before implementation.

#### Alternative B: copy stop fields into the start POI

At the end of a too-close replay, mutate the start POI with the stop POI's
fields, then restore it later.

This is simpler for existing React rendering, but it risks persistence races,
database writes, stale map snapshots, and accidental loss of the original
start data. It is rejected for this milestone.

#### Alternative C: render a second temporary POI

Create a temporary visual POI at the end position and remove it after the
animation.

This avoids mutating the start POI but introduces a second entity, duplicate
event handling, additional visibility restoration, and a mismatch with the
requirement that the start POI is the visible endpoint when `tooClose === true`.
It is rejected unless the paired presentation model cannot be integrated with
the existing canvas renderer.

### Field selection

Replay POI settings must support an explicit selection for every rendered POI
field. The current `hiddenFields` configuration should be extended or migrated
to cover at least:

- title;
- display type/category;
- location;
- altitude;
- coordinates;
- date/time.

The user-facing editor must expose these controls per POI, regardless of the
POI category. Existing persisted `hiddenFields` values must remain compatible.
The implementation may retain `hiddenFields` as the storage representation or
introduce a normalized `visibleFields` representation, but the normalized
runtime contract must be unambiguous.

The field mask rules are:

| Endpoint mode | Start presentation | Stop presentation |
| --- | --- | --- |
| `tooClose === false` | Start POI field selection | Stop POI field selection |
| `tooClose === true` | Start POI field selection | Same Start POI field selection applied to stop data |

When a field is hidden, it must be excluded from the scene card and any canvas
snapshot generated from that card. The title and date/time fields must follow
the same selection rules as location, category, altitude, and coordinates.

### Default visibility and animation

- With `tooClose === false`, both the start and stop endpoint POIs are visible
  by default and can be animated independently through their per-POI settings.
- With `tooClose === true`, only the start endpoint is visible by default. The
  stop endpoint remains available as the end-data source for the start
  presentation.
- A POI with animation disabled remains visible when its visibility setting is
  enabled, but it is not automatically opened by the replay scheduler.
- Global hide and global animate settings continue to act as overrides, subject
  to the existing replay behavior contract.

## 2. Synchronous and asynchronous animation

### Problem analysis

The current POI opening path is asynchronous relative to replay playback. A
`setTimeout` collapses the POI while the replay controller continues to advance.
This means an animation can remain active when the replay reaches its end or
when the final stop clip completes. The playback controller already exposes
start, update, pause, resume, stop, and end lifecycle events, while the scene
controller exposes a stop-clip completion event. These lifecycle boundaries can
provide a single cancellation path.

The current playback controller excludes manual pause time from active replay
elapsed time. Supporting animation during pause requires an explicit policy for
which clock drives the POI animation and how pause time contributes to the
timeline.

### Solution A: replay-clock scheduler with pause-aware POIs — selected

Replace independent collapse timers with a replay animation scheduler owned by
the replay session. The scheduler tracks each active or pending endpoint/nearby
POI animation by POI ID and presentation phase.

Each animation record should contain:

```js
{
  poiId,
  phase: 'start' | 'nearby' | 'stop',
  startedAtReplayMillis,
  durationMillis,
  pauseReplay: false,
  state: 'pending' | 'active' | 'completed' | 'canceled',
}
```

The scheduler must use replay lifecycle time rather than a browser wall-clock
timeout:

- `replay/start` initializes the scheduler and starts eligible start POIs;
- `replay/update` advances animations using the current replay elapsed time;
- `replay/pause` freezes animations whose `pauseReplay` setting is false;
- `replay/pause` keeps the POI configured with `pauseReplay` displayed and
  blocks every other active or pending POI animation;
- `replay/resume` releases the blocked animations and resumes them without
  resetting their elapsed animation time;
- `replay/stop` cancels all active and pending animations and restores the
  pre-replay state;
- `replay/end` completes the final lifecycle transition and cancels anything
  still active;
- the stop-clip completion event provides the final stop presentation boundary.

For a POI with `pauseReplay === true`, the POI remains displayed while playback
is paused. Its presentation is held open for the whole pause interval. Every
other active animation is frozen and every pending animation remains queued.
No other POI may open, close, or replace the displayed presentation during the
pause. When playback resumes, the pause owner continues according to its
remaining duration and the blocked animations are released according to their
original replay order.

The pause interval is included in the effective replay/clip total so that
duration checks and export timing use the same timeline. A POI with
`pauseReplay === false` does not become the pause owner; its active animation is
frozen and its pending animation remains queued until resume.

If more than one POI with `pauseReplay === true` is eligible at the same pause
boundary, the scheduler must select one deterministic pause owner and expose
the collision in diagnostics. The selection policy remains an implementation
decision and must not allow multiple independent animations to progress during
the same pause.

The scheduler must be used by live replay and deterministic video export. It
must not depend on CSS animation clocks, untracked `setTimeout` callbacks, or
the frequency of browser repaint events.

#### Alternative B: retain timers and cancel them at lifecycle boundaries

Keep `setTimeout` for each POI but register every timer and clear all timers on
pause, resume, stop, end, and stop-clip completion.

This is a smaller change, but it cannot accurately continue a selected
animation during a replay pause or produce deterministic HQ export frames. It
is rejected as the final architecture, but may be used as a short-lived
compatibility layer during migration.

#### Alternative C: block replay until each animation completes

Pause replay progression until all endpoint animations have completed.

This makes duration accounting straightforward, but changes the current
non-blocking behavior and can make a replay feel unresponsive when multiple
POIs are animated. It is rejected for the default mode. A future explicit
synchronous mode could be considered separately if a product requirement
appears.

### Duration validation

Before replay starts, calculate the effective available timeline:

```text
effective timeline = start clip duration
                   + replay duration
                   + stop clip duration
                   + eligible replay-pause duration
```

The calculation must use the normalized duration of every enabled clip and the
same replay duration source used by the playback controller and exporter.

Validate the total duration of the animations that are scheduled for the same
replay phase. At minimum, validate:

- start endpoint animations against the start boundary and available replay
  timeline;
- nearby POI animations against the replay timeline;
- stop endpoint animations against the final stop-clip boundary;
- the co-located start/end presentation as two phases of one POI.

If the configured animation duration exceeds its available phase, the replay
must remain usable. The selected behavior is to clamp the presentation to the
available phase and show a non-blocking warning in the replay UI. The original
per-POI duration must not be silently overwritten.

If the product instead intends the sum of all animated POI durations to be
validated globally, the validator must expose both values: the configured sum
and the effective available timeline. The implementation must not silently
switch between sequential and concurrent interpretations.

### Forced stop behavior

At the end of the replay or when the last stop clip completes:

1. Cancel every active endpoint and nearby POI animation.
2. Cancel every pending animation that has not started.
3. Clear scheduler records and registered lifecycle callbacks.
4. Restore the POI visibility, expansion, presentation data, and field mask
   captured before replay.
5. Ensure no delayed callback can reopen a POI after replay teardown.

The same cancellation path must be idempotent and safe when `replay/stop` is
followed by `replay/end` or by a new replay start.

## State contract

Persisted POIs continue to own their normal source data and replay settings.
Transient runtime state should contain:

- the source POI ID;
- the current presentation phase;
- the source data snapshot used for restoration;
- the temporary display data snapshot, when `tooClose === true`;
- the selected field mask;
- the animation scheduler record;
- the pre-replay visibility and expansion state.

The runtime must never persist the temporary stop-data projection onto the
start POI.

## Acceptance criteria

1. With `tooClose === false`, Start opens at replay start and Stop opens after
   the last stop clip.
2. With `tooClose === true`, the visible Start POI opens with start data first
   and with the complete stop data at the end.
3. The co-located end presentation restores the original Start POI data after
   replay.
4. Default visibility is Start and Stop for `tooClose === false`, and Start
   only for `tooClose === true`.
5. POI field selection is configurable per POI and applies to scene rendering
   and canvas snapshots.
6. With `tooClose === true`, the Start field selection is used for both start
   and stop data presentations.
7. With `tooClose === false`, Start and Stop may use different field selections.
8. The date/time field can be independently hidden or displayed.
9. `Pause replay` is available per POI, regardless of POI category.
10. A POI with `Pause replay` enabled remains displayed during a replay pause.
11. All other active and pending POI animations are blocked while the pause
    owner is displayed.
12. On resume, the pause owner and blocked animations continue with their
    remaining durations and original ordering.
13. The pause interval is included in timeline calculations.
14. Duration validation uses the same clip, replay, pause, and export timeline
    calculations.
15. Active and pending animations are canceled at replay end, stop, and final
    stop-clip completion.
16. No delayed timer or callback can reopen a POI after teardown.
17. The proposed co-located display label remains runtime-only and does not
    overwrite persisted Start or Stop types.

## Test plan

Add or update tests for:

- endpoint resolution for both `tooClose` modes;
- start and stop lifecycle triggers;
- complete stop-data projection onto the visible Start POI;
- restoration of source data after cancellation and completion;
- default visibility rules;
- per-POI field selection for every rendered field;
- shared field masks in `tooClose === true` mode;
- independent field masks in `tooClose === false` mode;
- date/time rendering and hiding;
- pause-aware and pause-frozen animations;
- animation duration validation and non-blocking warnings;
- enabled and disabled clip duration aggregation;
- cancellation of active and pending animations;
- replay stop followed by replay end and replay restart;
- deterministic live and deferred video export behavior.

## Implementation plan

1. Extend `JourneyReplayPOISettings.js` with normalized field selection and the
   per-POI `pauseReplay` setting, preserving compatibility with `hiddenFields`.
2. Add pure endpoint-resolution helpers for start, stop, and too-close runtime
   presentations.
3. Add a replay-clock POI animation scheduler to the replay session state.
4. Replace endpoint and nearby-POI wall-clock collapse timers with scheduler
   records and lifecycle cancellation.
5. Update `MapPOIContent.jsx` and its canvas snapshot path to render the
   selected transient presentation data and fields.
6. Add the `Pause replay` control to the POI replay settings editor using the
   requested label-at-start and `xs` size.
7. Integrate duration validation with clip phase construction, playback, and
   deferred export timing.
8. Add the runtime-only co-located display label after product confirmation.
9. Add focused unit, UI, integration, and export tests before implementation
   is considered complete.

## Open product decision

The runtime-only display label for `tooClose === true` still needs final product
validation. The current proposal is `Journey endpoint`; it must not be persisted
as a replacement for the `start` or `stop` type.
