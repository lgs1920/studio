# Replay Start Camera Editor and Start Clip Synchronization

Status: proposal

Date: 2026-08-05

Target release: 1.0.0

## 1. Purpose

Improve the beginning of Journey Replay video playback by making the replay
start sample the authoritative camera anchor. The user must be able to edit
the replay start camera manually while keeping the camera centered on the
replay start point. Start clips must adapt to the resulting replay start pose
instead of defining a competing starting camera state.

The same camera state must be editable from both the Replay drawer and the
Cesium map. Both surfaces must remain synchronized without timing-based
conflict resolution.

## 2. Current implementation

### 2.1 Replay camera settings

The normalized replay camera currently contains:

- `positionMode`: `system`, `behind`, or `ahead`;
- `heading` for `system` mode;
- `headingOffset` for `behind` and `ahead` modes;
- `pitch`;
- one `altitude` value interpreted as absolute altitude or ground offset;
- camera behaviour capabilities and sensitivities;
- hysteresis tracking settings.

The renderer-independent pose resolver already derives a camera pose from a
replay sample and the selected position mode. It can therefore provide the
foundation for an anchored start camera editor.

### 2.2 Start sequence

At replay start, the runtime currently:

1. samples the replay at the requested progress, normally zero;
2. captures the current Cesium camera state;
3. defers replay camera recentering when start clips exist;
4. runs the configured start clips;
5. starts the replay controller after the clips complete.

Start clip plans independently resolve their `startView` and `endView`.
Several clips use the current camera orientation for their initial view while
using the replay camera settings for their final view.

This makes the visible beginning depend on the camera state before replay
started and allows a start clip and the replay camera to use different poses.

### 2.3 Drawer and map synchronization

The Replay drawer writes both the persisted replay settings and the runtime
replay store. Cesium camera interactions can also read the live camera and
write both values back.

The current bridge uses several transient guards and timers:

- `cameraUpdateSource`;
- `cameraApplyingView`;
- `cameraAutoTrackingIgnoreUntil`;
- `cameraUserAdjusting`;
- a short drawer update-source clearing timer.

These guards reduce feedback loops but do not provide an atomic update
contract. The drawer may be rendered from a different snapshot than the one
used by the runtime camera update. A delayed Cesium camera event can also
arrive after a drawer update.

### 2.4 Missing camera fields

The replay start camera defaults to a `roll` of `0`, but the value must remain
available in persisted camera and start-clip data. The start camera editor must
not expose a direct roll control. A start clip may override the roll, and the
effective roll at the end of the last start clip becomes the roll of the first
replay frame. Automatic replay banking may still derive roll later in the
journey when the existing replay camera behaviour enables it.

Zoom is also indirect. The camera range is derived from camera altitude and
pitch, so changing the apparent zoom is coupled to the altitude model.

When `positionMode` is `behind` or `ahead`, manual heading changes from the
Cesium camera are not persisted as a direct heading. The current bridge only
persists heading for `system` mode, which prevents reliable manual adjustment
of the angle relative to the trace axis.

## 3. Product contract

### 3.1 Replay start anchor

The replay sample at `progress = 0` is the canonical start anchor.

The anchor contains:

- the replay start longitude and latitude;
- the replay start altitude or rendered marker height;
- the route tangent used to resolve the trace axis;
- the replay start progress and sample identity where available.

The anchor is derived from the replay sampler and must not be replaced by the
current Cesium camera position.

### 3.2 Manual camera editing

When replay start camera editing is active:

1. the camera is focused on the replay start anchor;
2. `behind` and `ahead` remain respected;
3. the user can change heading, pitch, and zoom/range;
4. the user can change the heading offset relative to the trace axis;
5. the anchor remains fixed;
6. map panning or any interaction that changes the anchor is rejected or
   converted into a heading, pitch, or range change;
7. the drawer and the map immediately display the same normalized values.

The editor must not silently turn a manual `behind` or `ahead` adjustment into
`system` mode.

### 3.3 Automatic replay ownership

During automatic replay playback, the replay runtime owns the canonical replay
camera pose. During HQ export, the recording camera owns the rendered export
pose. Automatic camera poses must not overwrite the persisted manual start
camera settings.

Manual editing during playback must be possible through an explicit editor
override. While the override is active, user camera changes have priority over
automatic replay tracking. The replay timeline continues to advance, but the
automatic camera resolver must not immediately replace the user's current
camera pose. Closing the editor override resumes automatic tracking from the
current logical replay frame.

When the override is used during live replay, the editor anchor is the current
logical replay sample. When the drawer is opened outside live replay, the
editor anchor is the replay start sample.

### 3.4 Start clip contract

Start clips are transitions relative to one canonical replay start anchor and
must respect the replay camera positioning. The camera settings provide a base
start pose, and the ordered start clips may produce the effective final replay
start pose.

Every start clip must:

- keep the replay start anchor as its geographic target;
- preserve the replay camera's `behind`, `ahead`, or `system` positioning;
- preserve the replay camera's trace-relative heading offset, pitch, and range
  at the effective replay endpoint;
- use clip parameters only for intermediate camera values or explicit clip
  effects;
- preserve the effective start roll: `0` by default, or the final roll produced
  by the configured start clips;
- end at the exact effective `replayStartPose`;
- never use the previous unrelated Cesium camera as the replay camera anchor.

Examples:

- `TakeOff` starts at the replay anchor with its configured intermediate
  movement, then reaches the replay camera start pose;
- `ZoomIn` starts at the same anchor with an intermediate range, then reaches
  the replay camera start pose;
- a sequence of start clips passes the same canonical endpoint from one clip
  to the next.

The old camera state may still be captured for restoration after replay, but it
must not define the replay start pose.

### 3.5 HQ recording modes

HQ replay must use an offscreen recording camera by default. This camera follows
the canonical replay pose and the resolved start clip plan independently from
the camera shown in the interactive map.

The user may choose a visible recording mode before starting the HQ export. The
selected mode must not change during an active export, because switching the
render target or camera ownership mid-export could create discontinuities in
the resulting video.

Both modes must expose the same progress state, including preparation,
rendering, encoding, completion, and failure. The progress UI must identify the
active mode and must not imply that moving the interactive map camera changes
the offscreen recording.

When the offscreen mode is active, navigation in the interactive map affects
only the preview camera. It must not alter replay timing, start clips, the
recording camera, or the exported video. The visible recording mode may instead
capture the interactive camera by explicit user choice.

## 4. Proposed camera model

### 4.1 Camera ownership

The implementation must distinguish the logical replay/recording camera from
the interactive preview camera:

```text
replay settings + clips -> recordingCamera -> HQ export
user map interaction    -> previewCamera   -> interactive map
```

Cesium still renders one camera per `Viewer`. Therefore, true simultaneous
offscreen recording and interactive preview require a dedicated recording
render path, such as a second render target or recorder scene. Reusing the
visible viewer by swapping cameras during capture is not the default design,
because it risks preview flicker and frame-synchronization errors.

The recording camera must use the same canonical pose resolver and start clip
plan as Draft playback. The preview camera may temporarily diverge through the
editor override without changing the recording camera.

### 4.2 Persisted settings

Extend `ui.replay.camera` with an explicit persisted range value:

```js
{
  positionMode: 'behind',
  heading: 0,
  headingOffset: 20,
  pitch: -65,
  roll: 0,
  range: 1200,
  altitudeMode: 'constant',
  altitude: 1200
}
```

`range` is the canonical persisted distance because it is an explicit distance
from the fixed replay target, expressed in metres, and maps directly to
Cesium's `HeadingPitchRange`. A drawer control may use the product label
`Zoom`, but it must read and write `camera.range`.

Backward-compatible normalization must keep existing `altitude` settings
working for profiles created before this feature. When `range` is absent, the
runtime derives it from the legacy altitude and pitch model once, then uses the
normalized range for the anchored editor and replay start pose.

The persisted `roll` value has a default of `0` and has no direct drawer or map
control. Start clip data may provide a non-zero roll. The start clip planner
must preserve the final effective roll in the replay start pose rather than
replacing it with the camera default. Automatic banking remains an independent
derived behaviour after the replay has started.

### 4.3 Runtime editor state

Keep transient editor state separate from persisted settings:

```js
{
  active: false,
  anchor: null,
  source: null,
  revision: 0,
  userAdjusting: false
}
```

The runtime state is used for interaction ownership, event suppression, and
revision checks. It must not be stored in the user's replay configuration.

### 4.4 Canonical camera command

All camera writes must go through one core command, conceptually:

```js
setReplayCameraSettings(updates, {source})
```

The command must:

1. merge and normalize the update;
2. update the persisted settings;
3. update the runtime snapshot;
4. increment a monotonic revision;
5. resolve the camera pose against the active replay anchor;
6. apply the pose without generating a feedback write;
7. publish the source for diagnostics and UI state.

The drawer, Cesium bridge, replay runtime, and clips must call this command
instead of writing the two camera objects independently.

## 5. Map interaction design

### 5.1 Anchored setView

Camera application must use the replay start target and reconstruct the camera
frame from heading, pitch, roll, and range. The target must remain fixed when
the user rotates, tilts, or zooms. The editor does not modify roll; the applied
start frame uses the effective roll resolved from persisted camera and start
clip data.

Programmatic `setView` calls must carry a suppression transaction or revision
so their resulting Cesium `changed` event cannot be interpreted as a new user
edit.

### 5.2 User interaction extraction

After an authorized map interaction completes, the bridge must extract:

- heading relative to the local replay anchor frame;
- pitch;
- range/zoom;
- heading offset when `behind` or `ahead` is active.

It must not extract a new geographic target or roll from the live camera. The
existing effective roll must be preserved.

### 5.3 Drawer behaviour

The drawer should expose the same canonical values as the map editor:

- position mode;
- angle relative to trace axis for `behind` and `ahead`;
- pitch;
- zoom/range;
- altitude mode only where it remains meaningful for the product.

The drawer must not expose a standalone roll field. Roll remains editable only
through persisted start-clip data or other existing clip configuration.

Text input drafts may remain local while a field is focused. A remote map
update must not overwrite an active text draft. On commit, the value must pass
through the canonical camera command.

Opening the Replay drawer automatically focuses the camera editor on the
appropriate anchor. Outside live replay this is the replay start sample. During
live replay it is the current logical replay sample and activates the temporary
camera override. An explicit focus action may still be provided to re-establish
the replay start sample on demand.

## 6. Start clip implementation

Resolve the canonical pose before constructing the start clip sequence:

```text
sampler.atProgress(0)
    -> resolveReplayStartBasePose(settings, sample)
    -> buildStartClipPlans(basePose, clips)
    -> resolve effective replayStartPose from the final start clip endpoint
    -> render start phases
    -> render replay phase from the same pose contract
```

The clip planner must receive the base pose and the replay start anchor
explicitly. It must not call the live camera state as a substitute for either
value. A start clip may provide a persisted non-zero roll parameter; the final
clip endpoint must carry that roll into the effective replay start pose.

The HQ renderer and Draft playback must use the same start clip plan and the
same final replay start pose. Only their frame scheduling and capture path may
differ.

The first replay frame after the last start clip must be continuous in:

- target position;
- heading;
- pitch;
- roll;
- range/zoom.

If no start clip overrides roll, the first replay frame uses the persisted
default roll of `0`. If the last start clip ends with a non-zero roll, that roll
must be used by the first replay frame and persisted as part of the replay
start/clip state.

## 7. Synchronization and ownership rules

| Situation | Authority | Persist settings? |
| --- | --- | --- |
| Drawer camera edit | Canonical camera command | Yes |
| Authorized map camera edit | Canonical camera command | Yes |
| Preview navigation during HQ export | Preview camera | No |
| Replay tracking frame | Replay camera resolver | No |
| Start clip frame | Start clip planner | No |
| HQ offscreen export frame | Recording camera and shared replay resolver | No |
| HQ visible recording frame | Explicitly selected recording mode | No |
| Programmatic Cesium event | No authority | No |
| Camera restoration after replay | Saved scene state | No, unless explicitly edited by user |

User interaction must have higher priority than programmatic camera events.
Replay tracking must have higher priority than ordinary map changes while
playback owns the camera, unless the explicit editor mode is active.

## 8. Implementation plan

### Phase 1: Define and test the pure pose contract

- Add persisted `roll` and explicit `range/zoom` normalization with
  backward-compatible defaults.
- Keep the direct roll editor control absent while retaining roll in the data
  model.
- Add a pure resolver for the replay start anchor and pose.
- Add tests for `system`, `behind`, and `ahead`.
- Add tests proving that heading offset is relative to the trace axis.

### Phase 2: Introduce the canonical camera command

- Add one core camera update service.
- Remove independent drawer/runtime writes.
- Replace timer-based source clearing with revision and transaction guards.
- Keep automatic replay poses separate from persisted settings.

### Phase 3: Implement anchored map editing

- Add explicit start-camera edit mode.
- Lock the replay start target.
- Extract heading, pitch, and zoom/range from authorized map interactions.
- Preserve the effective roll resolved from the persisted camera and start clips.
- Prevent programmatic Cesium events from creating feedback updates.

### Phase 4: Synchronize the Replay drawer

- Route all drawer controls through the canonical command.
- Add the start-anchor focus action.
- Add heading, pitch, and zoom controls consistent with the map editor.
- Do not add a standalone roll control.
- Preserve focused text drafts during external updates.

### Phase 5: Adapt start clips

- Resolve `replayStartPose` before start clip planning.
- Make each start clip target the replay start anchor.
- Make the last start clip frame equal the canonical replay start pose.
- Remove the current deferred replay recenter as a competing authority.

### Phase 6: Validate Draft and HQ parity

- Verify Draft and HQ use the same pose and clip plan.
- Make offscreen recording the default HQ mode.
- Add an explicit visible-recording mode selected before export starts.
- Expose preparation, rendering, encoding, completion, and failure progress for
  both HQ modes.
- Verify preview camera navigation does not alter offscreen export output.
- Verify no camera setting is persisted by automatic playback.
- Validate restoration after cancellation, replay stop, and completed replay.

## 9. Tests and acceptance criteria

### Unit tests

- Start pose resolution for all position modes.
- Heading offset and trace-axis angle conversion.
- Pitch, roll, and range/zoom normalization, including default roll inheritance.
- Anchored camera frame reconstruction.
- Start clip endpoint resolution.
- Revision and source ownership rules.

### UI tests

- Drawer edits update the map state.
- Map edits update the drawer state.
- Map pan cannot move the replay start anchor.
- Drawer drafts survive external Cesium notifications while focused.
- `Behind` and `Ahead` preserve their mode when heading is edited.

### Integration tests

- Replay without start clips begins on the canonical start pose.
- Replay with one or more start clips ends the clips on the canonical pose.
- Draft and HQ produce the same logical camera poses.
- HQ defaults to offscreen recording with a dedicated recording camera.
- The user can choose visible recording before starting HQ export.
- Export progress identifies the current phase and advances for either mode.
- Moving the preview camera during offscreen HQ export does not change the
  exported camera path or replay timing.
- Automatic camera frames do not overwrite persisted settings.
- Manual camera editing is not lost after pause/resume.
- Replay cancellation and scene restoration do not leave stale editor state.

### Product acceptance

- The first replay image is centered on the replay start point.
- The user can adjust heading, pitch, and zoom without moving the replay anchor.
- The replay start roll defaults to `0` and has no direct editor field.
- A non-zero roll produced by a start clip is preserved and used by the first
  replay frame.
- `Behind` and `Ahead` remain usable and the trace-relative angle is editable.
- Drawer and map show the same camera values after every committed edit.
- Start clips visibly adapt to the configured replay start camera.
- The first replay frame is visually continuous with the end of the start clips.

## 10. Decisions confirmed during issue refinement

1. `range` is the canonical persisted distance field. The UI may call it
   `Zoom`, but the stored value is a metric camera-to-target range.
2. The editor may override the live replay camera while the override is active.
   The replay timeline continues, and automatic tracking resumes when the
   override closes.
3. `TakeOff` and `ZoomIn` must respect the replay camera positioning and keep the
   replay start anchor. No separate external arrival camera is required.
4. Opening the Replay drawer automatically focuses the camera editor on the
   relevant replay anchor.
5. For Replay HQ, offscreen recording with a dedicated recording camera is the
   default. A visible-recording mode may be selected before export, with shared
   progress reporting. The recording mode cannot be switched during an active
   export.
