# Replay Timeline Preparation Implementation

Status: current implementation inventory

Date: 2026-08-30

## Scope

This document describes the linked-video Replay preparation timeline currently
implemented on the `add-timeline` branch. It records the runtime flow, the
normalized data projection, the user interface, the editor integrations, and
the tests that protect the behavior.

The delivered feature is a controlled, read-only preparation projection. It is
not yet the future persisted multi-track authoring model described in
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
ReplayTimeline package
        |
        +--> ReplayScrubScheduler -> replay.seek() -> replay.refresh()
        +--> widget manager visibility and z-index updates
        +--> PanelManager navigation to widget or clip editors
        +--> lgs:video:start-hq-export -> VideoDownloadAndShareDialog
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

- `start` actions for configured start clips;
- one `replay` action for the journey Replay;
- `stop` actions for configured stop clips.

Action ranges retain both millisecond fields and package-facing second fields.
The Replay action remains present even when its duration is the only positive
range.

### Widget tracks

The projection accepts the video widget stack in bottom-to-top order and
creates one track per eligible widget. The package adapter reverses only the
visual row order, so the Replay track remains the lowest canonical row.

When a widget row is reordered, `ReplayTimelinePreview` converts the package
row order back to the widget manager's expected order. `WidgetManager.reorderWidgets`
then updates Valtio widget entries, cache z-index values, live DOM z-index, and
persisted widget positions while excluding Logo and Credits from movement. The
ordering implementation is in
[`WidgetManager.js`](../../../src/core/ui/widget-manager/WidgetManager.js#L562-L610).

Dynamic Replay-driven tracks are resolved through the shared overlay resolver.
The current modes are:

- `dynamic-stats-widget` / `Dynamic Stats`;
- `journey-stats-widget` / `Journey Stats`.

Static video widgets receive a full-duration action. Logo and Credits are
fixed, cannot be reordered, and remain represented with their video widget
metadata. Hidden widget rows retain their action ranges and receive the hidden
visual state so the user can restore them through the track legend.

The projection and its action-boundary logic live in
[`ReplayPreparationTimeline.js`](../../../src/core/ui/replay/ReplayPreparationTimeline.js#L1-L570).
Replay-driven visibility delegates to
[`ReplayOverlayResolver.js`](../../../src/core/ui/replay/ReplayOverlayResolver.js#L185-L205).

## Timeline UI

[`ReplayTimelinePreview.jsx`](../../../src/components/MainUI/video/ReplayTimelinePreview.jsx#L394-L847)
is a controlled adapter around `@xzdarcy/react-timeline-editor`.

Implemented controls and interactions:

- play/pause, replay from the direction-aware start, and `Create HQ`;
- current logical time and total duration display;
- playhead dragging and time-area seeking;
- cancellable/coalesced scrubbing through `ReplayScrubScheduler`;
- a fixed Replay row and draggable widget rows;
- widget visibility links in the external track legend;
- a mouse-resizable track-title area constrained between `120px` and `300px`;
- an `Add widget` popup using the existing widget panel groups;
- widget-row drag and reorder propagated to the widget manager z-index order;
- double-click on a widget action to toggle its widget editor;
- double-click on a start or stop clip action to open the Clips tab and focus
  the stable clip anchor;
- an external legend synchronized with the package's vertical scroll position;
- action previews using FontAwesome icons, labels, and Web Awesome palette
  classes.

The timeline package is used for rendering and pointer interaction. Its
internal playback engine is not started. Replay remains the sole owner of
playback and frame time.

Timeline action resizing is explicitly rejected. Action movement is not wired
to a persisted domain command; the application mutation currently connected to
the timeline is widget-row reordering. This is why the preview remains a
read-only normalized timeline projection even though the package exposes drag
interactions.

The shared layout constants, row decoration, legend alignment, drag relay, and
ruler zoom adapter are in
[`replayTimelineUtils.js`](../../../src/components/MainUI/video/replayTimelineUtils.js#L1-L188).
The current working tree additionally contains a local ruler zoom range of
`-50%` to `500%`, stepped by `20%`, with wheel and unmodified arrow-key input
handled by the preview surface. These local changes were not part of `HEAD`
when this document was written.

The nested CSS layout, track legend, action previews, cursor, and capture
exclusion styling are in
[`replay-timeline-preview.css`](../../../src/components/MainUI/video/replay-timeline-preview.css#L1-L430).

## Widget host and catalog

[`ReplayTimelineWidget.jsx`](../../../src/components/MainUI/widgets/list/ReplayTimelineWidget.jsx#L1-L130)
places the preview inside the normal widget manager. The host is:

- movable through its header;
- resizable but not aspect-ratio constrained;
- persisted for position and dimensions;
- transient as application UI;
- limited to the timeline's content height and a minimum width;
- invalidated on unmount so widget runtime dimensions are recalculated.

The catalog entry is
[`public/widgets.yaml`](../../../public/widgets.yaml#L190-L205). It declares
the `replay-timeline-widget` component, scene-board availability, journey
requirement, one-instance limit, and timeline color.

The component registry maps the catalog component name in
[`src/core/constants.js`](../../../src/core/constants.js#L480-L535). The
timeline-specific video flag is initialized in
[`src/core/stores/ui.js`](../../../src/core/stores/ui.js#L84-L100).

## Clips and editor navigation

Start and stop clips remain authored by the existing
[`JourneyReplayClipsTab.jsx`](../../../src/components/JourneyReplay/JourneyReplayClipsTab.jsx#L553-L718).
The timeline does not introduce a second clip store. The preview resolves
journey clip instances first, then transient Replay clip state, while the
settings catalog supplies definitions and icons.

Each clip detail receives a stable `replay-clip-<instance-id>` anchor. The
preview sends a navigation request for the `clips` tab on action double-click.
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

The `Create HQ` action dispatches `lgs:video:start-hq-export`. The dialog owns
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
| Rendering, controls, scrubbing, zoom, legend, visibility, drag, editor navigation, icons, and capture exclusion | [`replay-timeline-preview.test.jsx`](../../../src/__tests__/ui/components/replay-timeline-preview.test.jsx) |
| CSS nesting and cursor selector scope | [`replay-timeline-preview-style.test.js`](../../../src/__tests__/ui/components/replay-timeline-preview-style.test.js) |
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
- normalized read-only multi-track projection;
- canonical Replay phase and frame-time reuse;
- controlled playhead, playback, and scrubbing;
- widget track visibility and stacking integration;
- clip and widget editor navigation;
- movable/resizable transient timeline widget host;
- HQ export handoff with restoration of preparation state.

Future or not delivered by this implementation:

- persisted `journey.replay.timeline` authoring data;
- independent editable item timing as a domain command;
- item trimming, overlap validation, transitions, waits, media tracks, or POI
  tracks;
- replacing the existing start/stop clip lists with a complete authoring
  timeline;
- making Draft recording and HQ export consume a future editable timeline
  model.
