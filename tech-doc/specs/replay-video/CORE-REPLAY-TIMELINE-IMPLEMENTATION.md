# Replay Timeline Preparation Implementation

Status: current implementation inventory

Date: 2026-10-18

## Scope

This document describes the linked-video Replay preparation timeline currently
implemented in Studio. It records the runtime flow, the
normalized data projection, the user interface, the editor integrations, and
the tests that protect the behavior.

The delivered feature is a controlled Expert Replay preparation projection
with editable widget rows, per-Journey timeline state, and an adapter for
pre-Replay and post-Replay clip duration edits. Basic Replay has no Timeline.
The sibling `@lgs1920/timeline` package provides the generic multi-track
editing surface. The remaining Studio integration work is documented in
[`CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md`](../../todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md).
It defines the future canonical domain model and its full authoring workflow.

This document is also the current record of the former 1.0.0 Replay Timeline
preview scope. In linked video preparation, the timeline provides a
non-recording preparation surface before any video capture. Expert Replay uses
the Timeline; Basic Replay does not. The canonical Replay clock remains the
authority for the playhead, scrubbing, playback, and visibility projection.
Replay preparation is the only video creation flow; Basic and Expert both
export from this Replay state.

The preparation surface does not encode a video. It stays outside the captured
video board, while the surrounding Replay editor keeps ownership of settings,
export, and cleanup. Each Journey stores a lightweight preparation snapshot in
`journey.replay.videoTimeline`, including widget row membership, order,
visibility, event ranges, Replay phase clips, and playhead. The React adapter
routes Replay-row duration edits into that Journey's existing `replay.start`
and `replay.stop` clip instances. Interactive Expert playback and deferred
export therefore consume the same updated clip configuration. Widget event
ranges and track visibility are resolved by Replay's overlay authority during
linked playback and export. Widget configuration and screen placement remain
global. This adapter keeps the existing Replay clip configuration as the
runtime authority; it does not introduce the future canonical timeline domain
model. The Timeline package remains a controlled, domain-neutral editor and
owns neither the Replay clock nor persistence.

## Runtime flow

```text
MainUI.startReplayVideo
        |
        v
ui.video.timelinePreviewActive + replay.recordingSync
        |
        v
ToolsUI -> DynamicWidget(replay-timeline-widget)
        |
        v
ReplayTimelineWidget -> ReplayTimelinePreview
        |
        v
buildReplayPreparationTimeline()
        |
        v
LGS1920Timeline Web Component
        |
        +--> controlled display of projected tracks and clips
        +--> public timeline events routed through the React adapter
        +--> interactive Replay transport and scrub commands
```

The linked entry point is started in
[`MainUI.jsx`](../../../src/components/MainUI/MainUI.jsx#L93-L102). The
timeline host is mounted only while the video editor is active, the timeline
flag is true, and Replay/video synchronization is enabled in
[`ToolsUI.jsx`](../../../src/components/MainUI/ToolsUI.jsx#L100-L115).

The normal scene widget renderer excludes the timeline widget while the video
scene is active in
[`SceneWidgetsRenderer.jsx`](../../../src/components/MainUI/widgets/SceneWidgetsRenderer.jsx#L32-L40).
This prevents the preparation control surface from becoming part of the
captured video scene.

## Data model and authorities

### Canonical source

[`ReplayPreparationTimeline.js`](../../../src/core/ui/replay/ReplayPreparationTimeline.js)
builds a versioned projection with:

- `version`, `signature`, `direction`, `fps`, and total duration;
- a canonical millisecond `range` and `playhead`;
- `source` metadata containing the clip signature, Replay duration, frame
  count, and frame interval;
- `tracks` in canonical bottom-to-top order;
- package-facing `editorData` generated from those tracks.

The builder reuses an existing `videoTimeline` when its clip signature is
still valid. Otherwise it rebuilds the source through
`buildReplayVideoTimeline`. It always creates a `ReplayFrameTimeline` for frame
boundaries.

### Replay track

The mandatory `replay` track is always present in the canonical projection.
The projection may retain source metadata for classification, but the timeline
adapter exposes one `editable` capability per track. The global
`timeline.editable` flag remains the master switch; a track with
`editable: false` cannot be dragged, renamed, edited, or removed. Its actions
are contiguous projections of the canonical phases:

- `pre-replay` actions for configured pre-Replay clips;
- one `replay` action for the journey Replay;
- `post-replay` actions for configured post-Replay clips.

Action ranges retain both millisecond fields and package-facing second fields.
The Replay action remains present even when its duration is the only positive
range.

### Widget tracks

The projection accepts the video widget stack in bottom-to-top order and
creates one track per eligible widget. The package adapter reverses only the
visual row order, so the Replay track remains the lowest canonical row.

Widget rows and clips expose their projected data to the Web Component. The
timeline adapter combines the global `timeline.editable` master switch with
each track's `editable` capability for track dragging, track-name editing,
clip editing, and track removal. It does not use per-track `locked`, `movable`,
or `fixed` flags. The Replay track remains read-only for track-level operations
through `editable: false`. Its Pre-Replay and Post-Replay actions remain
selectable and resizable through their per-action capabilities, while the
Replay action is neither selectable nor resizable. Other clips are resizable by
default and can opt out through their `resizable` input.
Timeline row order is stored on the owning Journey and does not change the
global widget stack. Changes to widget placement on the screen continue through
`WidgetManager.reorderWidgets`, which updates Valtio widget entries, cache
z-index values, live DOM z-index, and persisted widget positions while
excluding Logo and Credits from movement. The global ordering implementation
is in
[`WidgetManager.js`](../../../src/core/ui/widget-manager/WidgetManager.js#L562-L610).

Dynamic Replay-driven tracks are resolved through the shared overlay resolver.
The current modes are:

- `dynamic-stats-widget` / `Dynamic Stats`;
- `journey-stats-widget` / `Journey Stats`.

Static video widgets receive a full-duration action. Logo and Credits retain
their canonical projection metadata. Hidden widget rows retain their action
ranges and receive the hidden visual state. Timeline visibility events update
the Journey snapshot and the shared Replay visibility resolver. Widgets in the
Journey manifest are registered for Replay even when their first visible time
occurs later in the timeline. When clip deletion leaves only one distinct
widget on a grouped track, the group membership is cleared and the remaining
widget is projected as a standalone track.

The projection and its action-boundary logic live in
[`ReplayPreparationTimeline.js`](../../../src/core/ui/replay/ReplayPreparationTimeline.js#L1-L570).
Replay-driven visibility delegates to
[`ReplayOverlayResolver.js`](../../../src/core/ui/replay/ReplayOverlayResolver.js#L185-L205).

The sibling `@lgs1920/timeline` package is pinned to version `1.4.1`. It
provides generic track and clip editing, including movement, trimming,
snapping, collision handling, ordering, visibility actions, duplication, and
undo/redo. Studio enables a constrained subset through its adapter and persists
the resulting preparation snapshot on the Journey.

The Web Component renders hidden-track tinting on a dedicated background layer
below the clip elements, so the disabled color remains continuous across the
whole track instead of being repeated once per clip. A hidden or read-only
track title is presented as disabled. During track reordering, the source row
stays in place while synchronized legend and timeline ghosts follow the
pointer and share the same accepted or rejected insertion marker.
During the initial mount, an optional persistent opaque themed overlay is
installed before the timeline structure, with a Web Awesome paintbrush using
the `wag` animation. `timeline.showBuildingOverlay` defaults to `true` and can
disable it. Its `overlay-text` slot falls back to `Building...`, while
`--lgs-timeline-building-overlay-gap` controls the explicit spacing between the
icon and label. The overlay is removed after the first layout settles and is
never recreated by controlled updates, resizing, or dragging.

## Timeline UI

[`ReplayTimelinePreview.jsx`](../../../src/components/MainUI/video/ReplayTimelinePreview.jsx)
is a controlled adapter around the `lgs1920-timeline` Web Component.
It keeps Replay as the source of the normalized projection and assigns only
the public `timeline`, `tracks`, `currentTimeMillis`, `playing`, and null
`clipOptions` properties. Playback synchronization uses the lightweight
`setPlayheadTimeMillis` helper, while ruler seeks still use the controlled
`currentTimeMillis` path. It sets `interactive: true` and keeps a dedicated
blank-area drag handle for the widget host.

Committed clip edits are persisted from `after-clip-change`, after the drag
transaction has finished. Playback synchronization holds a requested Replay
timeline time while the published frame catches up, so an older frame cannot
move the visible playhead backward during a seek or playback start.

The displayed timeline surface uses an LGS-style horizontal rail and a vertical
rail dedicated to the tracks viewport; the time ruler is excluded from vertical
scrolling. The title column has a matching vertical rail, and both vertical
scroll views are synchronized bidirectionally so title rows remain aligned with
their tracks. The Web Awesome split-panel keeps its standard themed divider,
constrains the title column between 50 and 250 pixels, opens it at 150 pixels,
truncates overflowing track names with an ellipsis, and preserves its live
divider instance until the resize gesture finishes.
The rails auto-hide after the configurable inactivity timeout
`--lgs-timeline-scrollbar-auto-hide-delay` (one second by default, matching
`LGSScrollbars`) and stay available while hovered, focused, or actively used.
Track rows retain their compact, layout-driven height. During row reordering,
the source legend row and track row are hidden while their synchronized ghosts
represent the proposed insertion position.
Native mouse, pointer, touch, wheel, and drag events are stopped at the Web
Component host after the timeline's own listeners have handled them. The
split-panel divider always keeps its drag-start events inside the timeline, so
it cannot initiate a parent widget gesture. The native divider's document-level
continuation events remain available to Web Awesome after that local start.
The continuation and completion events of an external widget drag or resize are
allowed through while that gesture is active, so desktop, touch, and pen
resizing remains continuous when the pointer crosses the timeline surface. The
preview also marks the timeline host as `lgs-widget-no-drag` so the floating
widget's capture-phase drag, collapse, and context-menu handlers ignore the
timeline surface; the dedicated blank top-area handle remains available for
moving the widget.

The timeline accepts generic `additional-content` and
`additional-content-label` slots. It renders that content in a local
expandable `wa-drawer` above the header, preserving the timeline's generic
API. The Replay preview uses this drawer for the ratio and quality/FPS
controls, while the Settings, Replay, recording, and cancel actions remain in
the header toolbar. The drawer controls use a horizontal layout that becomes
vertical when the drawer is narrow.

Replay transport, seek, zoom, visibility, row ordering, Journey snapshot
persistence, and preparation cleanup are connected. Timeline playback uses
interactive Replay only; it does not start video capture. The Record action is disabled
while linked Replay is playing or paused. The camera angle guide and Replay
angle metric are hidden during that dry run. Double-click navigation and the
full canonical `journey.replay.timeline` domain model remain future work. The
Web Component handles local controls, title editing, visibility actions, and
track/clip drags, then emits public events for the host adapter.

Clip pointer movement and resizing snap the edited edge to the nearest major
ruler unit inside an eight-pixel magnetic threshold. Holding `Shift` while
moving or resizing a clip switches the snap unit to the currently rendered
secondary ruler divisions. The closest edge is used for movement so clip
duration remains unchanged, including cross-track moves.

The ruler uses at most five subdivisions per major unit and targets at most
twelve major intervals in the visible surface. The minimum spacing for a major
interval is the visible ruler width divided by twelve. The major unit follows a
readable progression of 250 ms, 500 ms, 1 s, 2 s, 5 s, 10 s, 30 s, 1 min, 2 min,
5 min, 10 min, 30 min, 1 h, and 2 h until that spacing is reached. For example,
a 10 h timeline in a 500-pixel view uses 30-minute major units at its minimum
zoom. The 50 ms interval is the finest rendered graduation. The Replay preview
persists horizontal zoom and vertical scroll in Replay settings. The Journey
snapshot stores that Journey's playhead; it takes precedence over the shared
Replay playhead setting when the Journey is reopened. Ruler labels use `SS.XX`
below one minute, omitting trailing zeroes in the fractional part, `MmSS` from
one minute
through 59 minutes, and `HhMM` from one hour onward. When the major interval
is below one minute, hour labels include seconds as `HhMM:SS` so adjacent
labels remain distinct.
Controlled track updates preserve the timeline's local horizontal zoom; a new
explicit `zoomPercent` value still applies normally.
During an active clip-edge resize, a transient blue diamond is centered on the
ruler's lower border at the edited edge's current time and protrudes halfway
into the track area. During a clip move, a diamond is shown at each clip
endpoint with the same ruler-border positioning. Resize
ripple shifts clips on the same track on the edited side: the start edge shifts
clips to its left and the end edge shifts clips to its right.

The shared layout constants and projection adapter remain in
[`replayTimelineUtils.js`](../../../src/components/MainUI/video/replayTimelineUtils.js#L1-L188).
The nested CSS integration removes the component card chrome, preserves the
reference's blank top drag area, aligns the ruler at the surface origin, and
styles the Web Component through its public CSS parts and custom properties in
[`replay-timeline-preview.css`](../../../src/components/MainUI/video/replay-timeline-preview.css).

## Widget host and catalog

[`ReplayTimelineWidget.jsx`](../../../src/components/MainUI/widgets/list/ReplayTimelineWidget.jsx#L1-L130)
places the preview inside the normal widget manager. The host is:

- movable through the dedicated blank top-area handle;
- resizable but not aspect-ratio constrained;
- persisted for position and dimensions;
- transient as application UI;
- constrained to show one to three rows at its minimum height, depending on
  the number of tracks;
- constrained to show at least five seconds with the track legend at its
  minimum width at the minimum width of 352 pixels;
- invalidated on unmount so widget runtime dimensions are recalculated.

The catalog entry is
[`public/widgets.yaml`](../../../public/widgets.yaml#L190-L205). It declares
the `replay-timeline-widget` component, scene-board availability, journey
requirement, one-instance limit, and timeline color.

The host actions keep the same timeline instance while changing its surface:
the scene widget exposes Picture-in-Picture and drawer actions, the PIP window
can reattach to the scene widget or move into the drawer, and the drawer can
reattach to the scene widget or open Picture-in-Picture. These transitions use
the widget window and dock managers, so they preserve the existing widget
configuration and dock dimensions.

The component registry maps the catalog component name in
[`src/core/constants.js`](../../../src/core/constants.js#L480-L535). The
timeline-specific video flag is initialized in
[`src/core/stores/ui.js`](../../../src/core/stores/ui.js#L84-L100).

## Clip editing and drawer navigation

Pre-Replay and post-Replay clips remain defined by the existing
[`JourneyReplayClipsTab.jsx`](../../../src/components/JourneyReplay/JourneyReplayClipsTab.jsx#L553-L718).
The Replay row permits resizing its pre-Replay and post-Replay clip actions.
The React adapter converts each edited event's seconds-based bounds into
`params.duration`, preserves the configured catalog entry, updates the owning
Journey's clip instances, and rebuilds the projection while retaining widget
row edits. Interactive Replay startup and deferred export then read those
updated Journey clip instances. The Journey's timeline snapshot also retains
the event ranges so the editor can restore them. The settings catalog remains
the source for clip definitions and icons.

Clip double-clicks have no default editing action. Web Component integrations
listen for `lgs1920-timeline-dblclick`; the React adapter exposes the same
interaction as the `onClipDoubleClick` callback.

Each clip detail receives a stable `replay-clip-<instance-id>` anchor. Studio
does not yet route the timeline's double-click event to the `clips` tab; the
adapter can add that navigation request when this interaction is implemented.
[`PanelManager.toggleNavigation`](../../../src/core/ui/panels/PanelManager.js#L499-L585)
activates the requested tab, opens nested details after rendering, closes a
previous unrelated details target, scrolls the target into view, and focuses
it. Toggling the same target closes the drawer. This navigation engine also
preserves drawer state when the Replay drawer is stacked on mobile or another
drawer.

The linked video settings toolbar exposes the Replay settings drawer while
timeline preparation is active in
[`VideoRecordingSettingsToolbar.jsx`](../../../src/components/MainUI/video/toolbox/VideoRecordingSettingsToolbar.jsx#L240-L264).
Cancelling linked preparation clears the timeline flag, pauses Replay, leaves
Replay preparation, and restores the regular video UI through
`videoEditingCleanup.js`.

## Deterministic export boundary

The linked Replay recording action consumes the prepared timeline and launches
the deferred Replay exporter. The timeline itself does not encode media or own
a capture clock. The exporter resolves each output frame from the shared
timeline and hands the resulting MP4 to the video preview dialog; see
[`CORE-REPLAY-IMPLEMENTATION-STATUS.md`](CORE-REPLAY-IMPLEMENTATION-STATUS.md).

## Styling and dependency

The implementation uses the fixed dependency
`@lgs1920/timeline` at version `1.4.1`, declared in
[`package.json`](../../../package.json#L45) and installed in `bun.lock`.
Web Awesome and FontAwesome remain the application UI and icon authorities.

## Validation coverage

| Area | Tests |
| --- | --- |
| Projection phases, durations, signatures, visibility intervals, track order, fixed rows | [`replay-preparation-timeline.test.js`](../../../src/__tests__/unit/replay/replay-preparation-timeline.test.js) |
| Layout constants, row selectors, legend transform | [`replay-timeline-utils.test.js`](../../../src/__tests__/ui/components/replay-timeline-utils.test.js) |
| Controlled projection rendering, per-Journey event restoration, Replay clip duration handoff, widget registration, playhead, ordering, transport, and cleanup | [`replay-timeline-preview.test.jsx`](../../../src/__tests__/ui/components/replay-timeline-preview.test.jsx) |
| Journey timeline snapshot normalization, phase-event conversion, deserialization, manifest, and track restoration | [`replay-timeline-persistence.test.js`](../../../src/__tests__/unit/replay/replay-timeline-persistence.test.js) |
| Manifest-aware widget visibility and concrete widget-instance resolution | [`replay-stats-widget-visibility.test.js`](../../../src/__tests__/ui/replay/replay-stats-widget-visibility.test.js) |
| CSS integration, compact layout parts, drag-area geometry, and interaction selectors | [`replay-timeline-preview.test.jsx`](../../../src/__tests__/ui/components/replay-timeline-preview.test.jsx) |
| Web Component rendering, interactions, drag lifecycle, and event suppression | [`LGS1920Timeline.test.js`](../../../../timeline/test/LGS1920Timeline.test.js) |
| Widget host dimensions and runtime invalidation | [`replay-timeline-widget.test.jsx`](../../../src/__tests__/ui/components/replay-timeline-widget.test.jsx) |
| Clip creation, editing, ordering, removal, and stable anchors | [`replay-clips-tab.test.jsx`](../../../src/__tests__/ui/replay/replay-clips-tab.test.jsx) |
| Drawer tabs, nested targets, stacked restoration, and toggle close behavior | [`panel-manager.test.js`](../../../src/__tests__/ui/widgets/panel-manager.test.js) |
| Linked toolbar, dry-run recording lockout, and video preparation cleanup | [`video-recording-settings-toolbar.test.jsx`](../../../src/__tests__/integration/video/video-recording-settings-toolbar.test.jsx) and `video-editing-cleanup.test.js` |

Run the focused suites before broader validation:

```bash
bunx vitest run \
  src/__tests__/unit/replay/replay-preparation-timeline.test.js \
  src/__tests__/ui/components/replay-timeline-utils.test.js \
  src/__tests__/ui/components/replay-timeline-preview.test.jsx \
  src/__tests__/ui/components/replay-timeline-widget.test.jsx \
  src/__tests__/ui/replay/replay-clips-tab.test.jsx \
  src/__tests__/ui/widgets/panel-manager.test.js
```

Because the timeline changes playback, visibility, and the captured scene
boundary, a real visual Replay and live-capture validation remains necessary
for changes that affect generated pixels or timing. See
[`CORE-REPLAY-QUALITY-VALIDATION.md`](CORE-REPLAY-QUALITY-VALIDATION.md).

## Delivered versus future work

Delivered:

- linked Replay preparation without starting video capture;
- generic controlled editing surface provided by `@lgs1920/timeline` 1.4.1;
- per-Journey widget row order, membership, visibility, and playhead persistence;
- Replay pre/post clip duration edits applied to the owning Journey's existing clip configuration;
- widget event visibility and Replay phase clip events consumed by linked playback/export;
- Replay registration of timeline widgets before their first visible frame;
- normalized multi-track projection;
- canonical Replay phase and frame-time reuse;
- interactive Web Component rendering with compact reference geometry;
- native clip editing that prevents overlap by default and fits clips to free intervals;
- movable/resizable transient timeline widget host;
- preparation-state cleanup and restoration;
- deferred-export handoff from the linked Replay recording action.

Future or not delivered by this implementation:

- replacing the preparation snapshot and existing clip arrays with a canonical
  Studio timeline domain model;
- independent editable item timing and track commands in that domain model;
- transitions, waits, media tracks, or POI tracks (planned in the
  [Replay Timeline Editor Evolution](../../todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md));
- migrating the existing pre-Replay/post-Replay clip configuration into that
  canonical model;
- clip double-click navigation and menu commands;
- supporting deterministic transitions and effects in video export.
