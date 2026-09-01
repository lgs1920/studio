# Replay Timeline Preparation Implementation

Status: current implementation inventory

Date: 2026-09-01

## Scope

This document describes the linked-video Replay preparation timeline currently
implemented on the `feature/timeline-webcomponent` branch. It records the runtime flow, the
normalized data projection, the user interface, the editor integrations, and
the tests that protect the behavior.

The delivered feature is a controlled preparation projection with local
timeline interactions. The Web Component emits the public interaction events,
while Replay application controllers remain disconnected. It is not yet the
future persisted multi-track authoring model described in
[`CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md`](../../todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md).

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
        +--> public timeline events; application controllers remain external
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

The mandatory `replay` track is fixed and locked. Its actions are contiguous
projections of the canonical phases:

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

Widget rows and clips expose their projected capabilities to the Web Component.
Logo, Credits, and the mandatory Replay row remain fixed; widget rows can be
renamed, hidden, and reordered, and their clips can be moved or resized. Future
application-side row ordering must continue through `WidgetManager.reorderWidgets`, which updates
Valtio widget entries, cache z-index values, live DOM z-index, and persisted
widget positions while excluding Logo and Credits from movement. The ordering
implementation is in
[`WidgetManager.js`](../../../src/core/ui/widget-manager/WidgetManager.js#L562-L610).

Dynamic Replay-driven tracks are resolved through the shared overlay resolver.
The current modes are:

- `dynamic-stats-widget` / `Dynamic Stats`;
- `journey-stats-widget` / `Journey Stats`.

Static video widgets receive a full-duration action. Logo and Credits are
fixed, cannot be reordered, and remain represented with their video widget
metadata. Hidden widget rows retain their action ranges and receive the hidden
visual state; restoring visibility through timeline events remains a future
integration.

The projection and its action-boundary logic live in
[`ReplayPreparationTimeline.js`](../../../src/core/ui/replay/ReplayPreparationTimeline.js#L1-L570).
Replay-driven visibility delegates to
[`ReplayOverlayResolver.js`](../../../src/core/ui/replay/ReplayOverlayResolver.js#L185-L205).

## Timeline UI

[`ReplayTimelinePreview.jsx`](../../../src/components/MainUI/video/ReplayTimelinePreview.jsx)
is a controlled adapter around the `lgs1920-timeline` Web Component.
It keeps Replay as the source of the normalized projection and assigns only
the public `timeline`, `tracks`, `currentTimeMillis`, `playing`, and empty
`clipOptions` properties. It sets `interactive: true` and keeps a dedicated
blank-area drag handle for the widget host.

The displayed timeline surface uses an LGS-style horizontal rail and a vertical
rail dedicated to the tracks viewport; the time ruler is excluded from vertical
scrolling. The title column has a matching vertical rail, and both vertical
scroll views are synchronized bidirectionally so title rows remain aligned with
their tracks. The Web Awesome split-panel keeps its standard themed divider,
constrains the title column between 100 and 200 pixels, truncates overflowing
track names with an ellipsis, and preserves its live divider instance until the
resize gesture finishes.
The rails auto-hide after the configurable inactivity timeout
`--lgs-timeline-scrollbar-auto-hide-delay` (one second by default, matching
`LGSScrollbars`) and stay available while hovered, focused, or actively used.
Native mouse, pointer, touch, wheel, and drag events are stopped at the Web
Component host after the timeline's own listeners have handled them. The
continuation and completion events of an external widget drag or resize are
allowed through while that gesture is active, so desktop, touch, and pen
resizing remains continuous when the pointer crosses the timeline surface. The
preview also marks the timeline host as `lgs-widget-no-drag` so the floating
widget's capture-phase drag, collapse, and context-menu handlers ignore the
timeline surface; the dedicated blank top-area handle remains available for
moving the widget.

Replay application event listeners and timeline controllers are not connected
in this step. The Web Component itself handles the local controls, title
editing, visibility actions, track/clip drags, and emits their public events;
the host still owns persistence and domain commands.

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

The component registry maps the catalog component name in
[`src/core/constants.js`](../../../src/core/constants.js#L480-L535). The
timeline-specific video flag is initialized in
[`src/core/stores/ui.js`](../../../src/core/stores/ui.js#L84-L100).

## Clips and future editor navigation

Pre-Replay and post-Replay clips remain authored by the existing
[`JourneyReplayClipsTab.jsx`](../../../src/components/JourneyReplay/JourneyReplayClipsTab.jsx#L553-L718).
The timeline does not introduce a second clip store. The preview resolves
journey clip instances first, then transient Replay clip state, while the
settings catalog supplies definitions and icons.

Each clip detail receives a stable `replay-clip-<instance-id>` anchor. The
future interactive adapter will send a navigation request for the `clips` tab
on action double-click.
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

## HQ export boundary

The timeline preview does not expose an export action in timeline mode.
The dialog owns
the export lifecycle in
[`VideoDownloadAndShareDialog.jsx`](../../../src/components/MainUI/video/VideoDownloadAndShareDialog.jsx#L495-L620).
It preserves the previous timeline flag, hides the dialog while exporting,
uses the deferred Replay exporter, and restores editing, capture, and timeline
state on both success and failure. The timeline itself does not encode media
or own the HQ clock.

## Styling and dependency

The implementation uses the fixed dependency
`@xzdarcy/react-timeline-editor` at version `1.0.0`, declared in
[`package.json`](../../../package.json#L55-L63) and installed in `bun.lock`.
Web Awesome and FontAwesome remain the application UI and icon authorities.

## Validation coverage

| Area | Tests |
| --- | --- |
| Projection phases, durations, signatures, visibility intervals, track order, fixed rows | [`replay-preparation-timeline.test.js`](../../../src/__tests__/unit/replay/replay-preparation-timeline.test.js) |
| Layout constants, row selectors, legend transform | [`replay-timeline-utils.test.js`](../../../src/__tests__/ui/components/replay-timeline-utils.test.js) |
| Controlled projection rendering, interaction flags, labels, ordering, duration, and cleanup | [`replay-timeline-preview.test.jsx`](../../../src/__tests__/ui/components/replay-timeline-preview.test.jsx) |
| CSS nesting, compact layout parts, drag-area geometry, and interaction selectors | [`replay-timeline-preview-style.test.js`](../../../src/__tests__/ui/components/replay-timeline-preview-style.test.js) |
| Web Component rendering, interactions, drag lifecycle, and event suppression | [`LGS1920Timeline.test.js`](../../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.test.js) |
| Widget host dimensions and runtime invalidation | [`replay-timeline-widget.test.jsx`](../../../src/__tests__/ui/components/replay-timeline-widget.test.jsx) |
| Clip creation, editing, ordering, removal, and stable anchors | [`replay-clips-tab.test.jsx`](../../../src/__tests__/ui/replay/replay-clips-tab.test.jsx) |
| Drawer tabs, nested targets, stacked restoration, and toggle close behavior | [`panel-manager.test.js`](../../../src/__tests__/ui/widgets/panel-manager.test.js) |
| Linked toolbar and video preparation cleanup | [`video-recording-settings-toolbar.test.jsx`](../../../src/__tests__/integration/video/video-recording-settings-toolbar.test.jsx) and `video-editing-cleanup.test.js` |

Run the focused suites before broader validation:

```bash
bunx vitest run \
  src/__tests__/unit/replay/replay-preparation-timeline.test.js \
  src/__tests__/ui/components/replay-timeline-utils.test.js \
  src/__tests__/ui/components/replay-timeline-preview.test.jsx \
  src/__tests__/ui/components/replay-timeline-preview-style.test.js \
  src/__tests__/ui/components/replay-timeline-widget.test.jsx \
  src/__tests__/ui/replay/replay-clips-tab.test.jsx \
  src/__tests__/ui/widgets/panel-manager.test.js
```

Because the timeline changes playback, visibility, and the captured scene
boundary, a real visual Draft or HQ validation remains necessary for changes
that affect generated pixels or timing. See
[`CORE-REPLAY-QUALITY-VALIDATION.md`](CORE-REPLAY-QUALITY-VALIDATION.md).

## Delivered versus future work

Delivered:

- linked Replay preparation without starting Draft recording;
- normalized multi-track projection;
- canonical Replay phase and frame-time reuse;
- interactive Web Component rendering with compact reference geometry;
- movable/resizable transient timeline widget host;
- HQ export handoff with restoration of preparation state.

Future or not delivered by this implementation:

- persisted `journey.replay.timeline` authoring data;
- independent editable item timing as a domain command;
- item trimming, overlap validation, transitions, waits, media tracks, or POI
  tracks;
- replacing the existing pre-Replay/post-Replay clip lists with a complete authoring
  timeline;
- connecting timeline playback, scrubbing, visibility, ordering, menus, clip
  navigation, and editing controllers;
- making Draft recording and HQ export consume a future editable timeline
  model.
