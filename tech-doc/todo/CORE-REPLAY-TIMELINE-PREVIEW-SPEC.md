# Replay Timeline Preview Specification

Status: proposed, pending product validation

Target release: `1.0.0`

Date: 2026-08-25

This specification is the 1.0.0 delivery slice of the broader
[Replay Track Timeline Editor Evolution](CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md).
It does not replace the future editable multi-track authoring model.

## Purpose

Replace the linked-video Draft recording step with a non-recording Replay
preview during video preparation.

The preview gives the user one compact multi-track timeline. Its playhead can
seek and play the Replay so the user can verify:

- the Replay marker;
- the completed and remaining trace;
- the visibility transition between Dynamic Stats and Journey Stats.

The preview must not produce a Draft video, encode frames, or introduce a
second replay clock.

## Product scope

### Linked video mode

When video preparation is opened with Replay/video synchronization enabled:

1. The existing Draft recording action is removed from this path.
2. The video editor remains in preparation mode.
3. A transient `Timeline` widget is displayed.
4. The user can move the playhead forwards and backwards.
5. The user can play, pause, and replay the synchronized Replay.
6. The scene reacts to the canonical Replay frame at the playhead position.
7. No `ScreenMediaRecorder` is initialized or started.
8. No Draft media blob or Draft export dialog is created.

### Non-linked video mode

The current generic video recording flow remains unchanged by this
specification. Removing Draft recording globally is a separate product
decision and must not be inferred from this proposal.

## First version timeline

The first version allows moving existing time actions and widget rows. It does
not support:

- resizing an item;
- creating or deleting an item;
- changing a widget start or end time;
- changing Replay duration;
- changing camera commands or camera-path points;
- adding or removing tracks;
- moving the mandatory Replay track row.

It contains one mandatory Replay track and one separate visible track for each
Replay-driven widget that has an active visibility interval.

### Track 1: Replay

The Replay track represents the complete logical video timeline. It renders
phase segments inside the same track:

- `Start`, when start clips exist;
- `Replay`, for the journey replay itself;
- `Stop`, when stop clips exist.

The `Start`, `Replay`, and `Stop` segments are contiguous projections of the
same normalized video timeline. They are not editable independently in the
first version. A missing Start or Stop clip produces no corresponding segment.

The phase data comes from `ReplayVideoTimeline` and `ReplayFrameTimeline`. The
timeline must not rebuild phase boundaries from UI duration fields.

The marker and trace are scene effects of the current Replay frame. They are
not independent timeline clocks or independent timeline items.

### Tracks 2+: Replay widgets

Each active video widget has its own track, ordered by the widget stack. The
currently supported Replay-driven widgets use these visibility rules:

- `dynamic-stats-widget` during the active Replay interval, except for the
  terminal Replay frame window;
- `journey-stats-widget` during the terminal Replay frame window and the
  declared stop phase, when applicable.

The intervals must be derived from `ReplayOverlayResolver`. The Timeline is a
visual projection of widget visibility and must not become a second visibility
authority. If both widgets are active, two separate widget tracks are shown.
Static video widgets occupy the full preparation range.

The editor displays the mandatory Replay track at the bottom. Widget rows can
be dragged above or below one another; the resulting order is persisted through
the widget manager's z-index ordering. Changes made in the widget ordering
panel are reflected back into the timeline. The compact legend uses a route
icon for Replay and a widget icon plus the widget name for every widget row;
it does not display numeric track labels.

## Programmatic visibility and branding

The application owns which timeline actions exist. It builds the controlled
`editorData` from the normalized Replay timeline and can therefore add or
remove a Start, Replay, Stop, Dynamic Stats, or Journey Stats segment when the
underlying Replay definition or visibility projection changes.

For a true hidden segment, the adapter must omit the action from `editorData`.
Returning an empty custom renderer or applying `display: none` only to the
action content would leave the action range and its interaction surface in the
timeline. Visual dimming is allowed for a deliberately muted phase, but it is
not equivalent to hiding the phase.

Branding is application-owned through the package rendering hooks:

- `getActionRender(action, row)` renders branded action content, labels,
  icons, colors, gradients, borders, and phase-specific classes;
- `getScaleRender(scale)` renders the branded time ruler;
- the Timeline container style and application CSS define the background,
  grid, row separators, cursor, typography, and spacing.

The initial visual mapping is:

| Action | Proposed visual role |
| --- | --- |
| Start | Branded intro color and `Start` label |
| Replay | Primary brand color and `Replay` label |
| Stop | Branded outro color and `Stop` label |
| Dynamic Stats | Secondary widget color and `Dynamic Stats` label |
| Journey Stats | Highlight widget color and `Journey Stats` label |

The exact colors must come from the LGS1920 theme tokens. The package must not
be allowed to introduce a second color system.

## Cursor and transport behavior

The Timeline has one playhead representing the canonical logical time.

### Seek

Dragging the playhead submits the latest requested position to the existing
Replay scrub contract:

```text
Timeline pointer movement
  -> normalized logical time
  -> Replay seek with source=scrub
  -> canonical frame resolution
  -> camera, marker, trace, and widget publication
```

Transient movement applies the frame immediately and coalesces obsolete
requests. Pointer release requests bounded settled qualification. A drag must
not synchronously compile a complete camera trajectory.

The Timeline package, if used, only displays and reports the playhead. It must
not use its own playback runner as the Replay authority.

### Play and pause

Play and pause call the existing interactive Replay session controller. The
Timeline package must not run its own animation loop for the scene.

The interactive preparation preview uses the Draft-style wall-clock policy
because it is a live preview. It is not an export clock. HQ export continues to
use fixed frame timestamps after the user starts the final export action.

### End and replay

When playback reaches the end, the playhead remains on the terminal logical
frame. A subsequent Play action restarts or resumes according to the existing
Replay controller contract. The exact restart behavior must be kept identical
to the existing Replay Play action.

## Lifecycle

### Enter preparation

For linked video preparation:

1. Keep `video.editing` active.
2. Mount the video crop board and the configured video widgets.
3. Initialize the Timeline projection from the shared Replay timeline.
4. Position the Replay at the beginning and leave it paused.
5. Show the Dynamic Stats and Journey Stats visibility according to the
   beginning frame.

The initial paused-at-zero behavior is the proposed default and requires
product validation if another initial position is preferred.

### During preparation

The Timeline remains visible while the linked video editor is active. The
video widgets remain available on the video crop board so that their real
rendered state can be inspected while the playhead changes.

The Timeline itself must be outside `VIDEO_WIDGETS_BOARD` and outside the
captured crop surface. It is a transient control surface, similar to the
Replay recording monitor, and must never appear in the resulting video.

It should use the existing `Widget` host lifecycle for placement and bounds,
but it should not be added to `public/widgets.yaml` as a user-composable video
widget. Its position and reduction behavior require product validation before
being persisted.

### Leave preparation

On cancel, close, or transition to final export:

- pause the interactive Replay;
- cancel pending scrub qualification;
- remove the Timeline widget;
- restore the normal video preparation or export surface;
- prevent an obsolete asynchronous seek from moving the camera afterward.

The cleanup must be ownership-guarded by the Replay session lifecycle.

## Replay and renderer integration

The feature must reuse the current authorities:

| Concern | Authority |
| --- | --- |
| Logical phases and duration | `ReplayVideoTimeline` and `ReplayFrameTimeline` |
| Frame resolution | `ReplayFrameResolver` |
| Scrub coalescing and cancellation | `ReplayScrubScheduler` |
| Settled scene qualification | `ReplaySceneFrameQualifier` |
| Camera application | Replay camera command and Cesium adapter |
| Marker and trace | Active Replay session renderer |
| Stats visibility | `ReplayOverlayResolver` |
| Dynamic widget frame | Published canonical Replay frame |
| Preview playback | Interactive Replay session controller |
| Final video export | `ReplayDeferredExporter` and fixed frame timeline |

The preparation flag must be distinct from capture activity. The current
`recordingSync` flag describes the video/Replay link and is also used by parts
of the renderer to identify capture behavior. The implementation must add an
explicit preparation-preview state or equivalent derived predicate so that:

- linked preparation can play and update the live trace;
- active recording/export remains governed by its capture rules;
- the renderer does not mistake an idle preparation link for an active
  recording.

The existing conditions that suppress live trace geometry whenever
`recordingSync` is true must be reviewed as part of this change.

## Proposed state contract

The Timeline should not own a clock. The minimum additional state is a
projection describing the preparation surface, for example:

```js
video.timelinePreviewActive
```

The canonical progress, sample, phase, playing state, and paused state remain
owned by the Replay store and published frame state. No `timeline.currentTime`
store may be introduced as a competing source of truth.

The exact state name is an implementation detail to validate during planning.

## Removing the linked Draft path

The linked preparation path must stop doing the following:

- calling `ScreenMediaRecorder.initialize()`;
- calling `ScreenMediaRecorder.startVideo()`;
- arming `JourneyReplayVideoSync` for recorder lifecycle events;
- warming a Draft-dependent export plan solely because preparation started;
- publishing a Draft recording monitor as if frames were being encoded;
- opening the final media dialog from a Draft stop event.

The existing HQ export needs a direct entry point from the prepared Timeline.
This specification does not choose the final product action. Two possible
labels are:

- `Create video`;
- `Export HQ`.

That action, its output profile, and whether the existing media dialog remains
the final destination must be validated before implementation.

## Timeline package evaluation

The package must be treated as a rendering and pointer-interaction adapter.
Its internal playback engine, if any, must remain disabled or unused.

### Option A: `@xzdarcy/react-timeline-editor`

This is the closest conceptual match to the future product. Its data model is
based on rows and time-ranged actions, and its documented API exposes a
playhead, play/pause, seek, playback rate, custom action rendering, and a
separate timeline engine. It is MIT licensed. See the
[project README](https://github.com/xzdarcy/react-timeline-editor),
[timeline API documentation](https://zdarcy.com/guide/intro/2-props.html),
and [npm package](https://www.npmjs.com/package/%40xzdarcy/react-timeline-editor).

Advantages:

- Direct row/action model for Replay, widgets, POIs, clips, and effects.
- Video-editor visual language rather than calendar language.
- Custom action rendering and a natural path to editable ranges.
- Relative seconds match the Replay domain better than calendar dates.

Risks:

- Its built-in runner must not become a fourth Replay clock.
- The package is young compared with calendar-oriented alternatives and needs
  an integration spike for fully controlled external time.
- The first version would use only its visual rows and playhead adapter, not
  its playback engine.

The package provides the controls needed for the first-version interaction:
action dragging remains enabled, while `onActionResizing` returns `false` as a
defensive guard. Cursor interaction remains available through `onCursorDrag`,
`onCursorDragStart`,
`onCursorDragEnd`, and `onClickTimeArea`. These controls must be connected to
the Replay scrub contract rather than to the package runner. See the
[official props documentation](https://zdarcy.com/guide/intro/2-props.html).

The same documented props expose `editorData`, `getActionRender`, and
`getScaleRender`, which provide the controlled data and rendering boundaries
required for programmatic visibility and LGS1920 branding.

### Option B: `react-calendar-timeline`

This is a mature React timeline organized around groups and items. It supports
read-only items, custom item rendering, custom markers, controlled visible
time, and later item movement/resizing. The current repository documents React
19 support in its 0.30 beta and keeps 0.28 as the latest stable release. It is
MIT licensed. See the
[official repository and API](https://github.com/namespace-ee/react-calendar-timeline).

Advantages:

- Strong group/item model for the first two tracks.
- External control of visible time and custom playhead markers.
- Editing can be disabled initially and enabled per item later.
- Larger community and longer operating history than the video-specific
  alternatives.

Risks:

- It is designed as a calendar timeline and uses a date/dayjs model.
- It brings additional layout and interaction behavior that is not needed in
  the first version.
- A video-editor visual treatment would require substantial CSS adaptation.
- The stable and React 19-compatible lines are currently different release
  tracks.

### Option C: `@gravity-ui/timeline`

This is a React timeline visualization rendered on canvas. It provides axes
with track counts, events, markers, sections, custom rendering, zoom/pan, and
virtualized rendering. It is MIT licensed. See the
[official documentation](https://gravity-ui.com/libraries/timeline) and
[repository](https://github.com/gravity-ui/timeline).

Advantages:

- Canvas rendering is attractive for a future dense timeline with many POIs,
  widgets, markers, and sections.
- Its axis/track/event model maps well to a normalized Replay timeline.
- Custom markers and sections can represent the playhead and phase intervals.

Risks:

- It is lower-level than a video editor and would require more adapter code for
  item selection, editing, and resize handles.
- Its current project footprint and community are small compared with
  `react-calendar-timeline`.
- Canvas accessibility and text selection require deliberate application work.

## Recommendation

Do not install a dependency before the timeline-domain adapter is specified.

The preferred implementation candidate is
`@xzdarcy/react-timeline-editor`, provided a short spike proves that the
playhead can be fully driven by the existing Replay controller without its
internal runner becoming authoritative. It has the best future fit for a
video-style multi-track editor.

The fallback candidate is `react-calendar-timeline` if external controlled time
and stable read-only behavior are more important than video-editor styling.

`@gravity-ui/timeline` should remain a performance-oriented alternative if the
future timeline becomes large enough that DOM rendering is a measured problem.

Regardless of the package selected, the application-owned normalized timeline
model and Replay frame contract must be implemented first. The package must be
replaceable without changing Replay, camera, trace, or widget authorities.

## Implementation phases

### Phase 1: domain adapter

- Define the normalized preview timeline model in application code.
- Resolve Start, Replay, and Stop phase intervals and widget visibility from
  existing authorities.
- Add unit tests for phase boundaries, terminal widget visibility, and reverse
  direction handling.
- Do not add a package yet unless the spike requires it.

### Phase 2: linked preparation lifecycle

- Replace the linked Draft start action with Timeline preparation.
- Add explicit preview lifecycle state and guarded cleanup.
- Keep non-linked recording behavior unchanged.
- Add tests proving that the recorder is untouched in linked preparation.

### Phase 3: Timeline surface

- Mount the transient Timeline widget outside the captured crop.
- Render one Replay track and one track per active video widget.
- Connect the playhead to latest-request-wins scrub and settled qualification.
- Connect Play/Pause to the interactive Replay session.
- Verify marker, trace, widget stacking, and Stats transitions.

### Phase 4: direct final export

- Add the validated user action that starts HQ export after preparation.
- Reuse the fixed-frame HQ pipeline.
- Keep the Timeline as a read-only monitor while export is active, or replace it
  with the recording monitor according to the validated UX.

### Phase 5: editable timeline evolution

- Add widget, POI, clip, wait, and media tracks to the normalized model.
- Introduce editing commands and validation outside the render loop.
- Compile qualified camera and visibility plans before deterministic HQ export.
- Keep the package as a replaceable presentation adapter.

## Acceptance criteria for the first implementation

- Linked video preparation never initializes or starts the Draft recorder.
- A Timeline surface appears only during linked video preparation.
- The surface has one Replay track and one separate track per active video widget.
- The Replay track displays the configured Start, Replay, and Stop segments.
- Start, Replay, Stop, and widget segments can be moved but not resized.
- Widget rows can be reordered, excluding the mandatory Replay row, and the
  order is persisted through the widget manager.
- The application can add or remove a segment by updating controlled timeline
  data.
- Timeline colors, labels, scale, grid, cursor, and action appearance follow
  LGS1920 branding.
- The playhead can seek in both directions.
- Play and pause operate on the existing Replay session.
- Dragging coalesces requests and does not block the main thread with full
  trajectory compilation.
- The marker and trace follow the canonical Replay frame.
- The legend uses compact colored route/widget icons and widget names without
  numeric track labels.
- Dynamic Stats and Journey Stats visibility matches
  `ReplayOverlayResolver` at start, middle, terminal Replay frames, and stop
  phase.
- Leaving preparation cancels pending seek work and restores the prior scene
  safely.
- The Timeline is absent from the captured video surface.
- Non-linked video recording behavior is unchanged.
- A real browser validation checks camera movement, trace progression, widget
  transitions, cancellation, and direct final-export handoff.

## Decisions required before implementation

1. Does “remove Draft recording” apply only to linked video mode, or to all
   video recording modes?
2. What exact action starts the final HQ export from the prepared Timeline?
3. The Timeline widget remains movable through its standard widget host, while
   timeline actions can move in time but cannot be resized.
4. Should Play restart from zero after reaching the end, or resume the final
   frame until the user seeks?
5. Which package should pass the controlled-playhead spike: Option A or Option
   B?
