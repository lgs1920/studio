# Replay Track Timeline Editor Evolution

Status: **TODO — Studio canonical authoring model and integration**

Target release: `1.0.0` preparation surface (delivered) and `1.1.0` Studio authoring integration (planned)

Date: 2026-10-28

## Goal

Complete Studio's Replay authoring workflow on top of the generic timeline
editor provided by the sibling `@lgs1920/timeline` project. Replace the
separated `start` / `replay` / `stop` clip UI with a domain-backed track
timeline in the Replay drawer.

The replay itself must remain mandatory. The main replay track should contain:

- optional start clips before the replay;
- one locked replay clip;
- optional stop clips after the replay.

Additional tracks, capped at 20, should contain widget clips. A widget track may contain a single widget clip or multiple widget clips. Moving and resizing a widget clip controls its visible time range. Widget screen position, scale, and bounds should continue to use the existing video widget board and widget manager. Each widget clip may define an enter effect and an exit effect. The default effect is an immediate cut with no animation.

The editor must work in the existing Replay drawer, including the stacked/mobile drawer mode.

## Delivery split

The work tracked by this specification is delivered in two compatible slices.
The generic editing surface is maintained in the sibling Timeline project;
this document tracks Studio's projection, domain model, persistence, and Replay
integration.

### 1.0.0 — Linked video preparation preview

- Keep Replay video export as an explicit action after preparation.
- Display a transient `Timeline` widget with one Replay track and one track per
  active video widget, while keeping Logo and Credits fixed at the top.
- Show `Start`, `Replay`, and `Stop` phase segments on the replay track.
- Show Dynamic Stats and Journey Stats visibility intervals on the widget track.
- Allow playhead movement, play, pause, and the local projection interactions
  supported by the Timeline component.
- Persist a preparation snapshot in `journey.replay.videoTimeline` for widget
  row membership, row order, visibility, and the selected Journey's playhead.
- Drive the scene from the canonical Replay frame contract without creating a second clock.
- Keep the Timeline outside the captured video board.

The delivered preparation behavior is documented in the
[Replay Timeline preparation implementation](../specs/replay-video/CORE-REPLAY-TIMELINE-IMPLEMENTATION.md).

### 1.1.0 — Canonical Studio authoring integration

- Define and persist the canonical `journey.replay.timeline` model.
- Migrate the current `journey.replay.videoTimeline` preparation snapshot and
  the existing `journey.replay.start` / `journey.replay.stop` configuration.
- Replace the separate start/stop clip lists with domain-backed authoring on
  the existing multi-track editor.
- Add domain validation and commands for widget tracks, clip movement,
  trimming, overlap rules, and the supported effects.
- Add a read-only POI timing projection with fixed-duration clips, automatic
  overlap lanes, and total duration derived from the canonical Replay speed
  profile.
- Make interactive playback and deterministic export consume the normalized timeline.

The 1.0.0 surface already persists an editor snapshot. Treat that snapshot as
migration input, not as the canonical source for all Replay authoring,
playback, and export. Keep widget screen geometry separate from timeline row
order and clip visibility.

## Current State

The current replay/video implementation already has several useful building blocks:

- `public/replay.yaml` defines the replay defaults and the current start/stop clip catalog.
- `JourneyReplayClips.js` normalizes clip catalog entries and clip instances.
- `JourneyReplayClipsTab.jsx` edits two independent clip lists: `journey.replay.start` and `journey.replay.stop`.
- `JourneyReplayDrawer.jsx` owns the Replay drawer tabs and already supports stacked drawer behavior through `drawerManager.isStacked(REPLAY_DRAWER)`.
- `ReplayFrameTimeline.js` generates deterministic frame progress from duration and FPS.
- `ReplayDeferredExporter.js` already builds a start/replay/stop phase sequence for export.
- `ReplayOverlayResolver.js` already distinguishes replay video phases and controls replay-driven widget visibility.
- The widget stack already supports board-scoped widget geometry through `VIDEO_WIDGETS_BOARD`, persisted ratios, `react-moveable`, and the video overlay composer.
- `CanvasOverlayComposer` already composites video widgets into deferred Replay exports.
- The sibling [`@lgs1920/timeline`](https://github.com/lgs1920/timeline) project
  provides a controlled, domain-neutral editing surface. Studio currently pins
  version `1.4.1`, which supports generic track and clip editing, snapping,
  collision policies, visibility, duplicate/cut operations, undo/redo, and
  namespaced host events.
- Studio stores the linked-preparation state in
  `journey.replay.videoTimeline` and uses its widget manifest and tracks to
  restore rows and resolve Replay visibility. Widget configuration and screen
  position remain global.

The generic editor surface is implemented. The remaining work is defining a
stable Studio domain model and making interactive playback and Replay export
consume the same validated clip state.

Once the canonical Studio model is delivered, it will be the single source of
truth for playback and export:

- Interactive playback uses the timeline for Replay synchronization, phase changes, and widget visibility.
- MP4 export uses the same timeline for deterministic frame generation, Replay phases, and widget visibility.
- Playback and export contain the same single Replay clip; output resolution, FPS, and encoding settings belong to export configuration.

## Product Model

### Track Types

`replay-main`

- Always exists.
- Cannot be deleted.
- Always stays as low as possible in the timeline, below widget tracks.
- Contains exactly one `replay` clip.
- May contain zero or more `start` clips before the replay clip.
- May contain zero or more `stop` clips after the replay clip.
- Does not allow widget clips.

`widget`

- User-created.
- Maximum count: 20 widget tracks.
- Can be reordered by dragging the track header.
- Contains zero or more widget clips.
- Never allows overlapping clips on the same track.
- Visual stacking must be represented by placing clips on separate tracks.

### POI Timing Projection

POI timing clips are a derived, read-only view of the canonical Replay speed
profile. They are not user-authored clips and do not create a second playback
clock.

- Create one fixed-duration clip for each POI that participates in Replay
  slowdown. Its interval is mapped to elapsed video time through the same
  Replay speed profile used by interactive playback and export.
- Keep the current crawl interval at two seconds. The clip cannot be moved,
  trimmed, or resized by the user.
- Recompute POI projections, clip intervals, and the total Replay duration
  whenever a POI moves or relevant Replay settings or route data change.
- Place overlapping clips on separate, automatically allocated POI lanes.
  Reuse the lowest available lane when a prior clip has ended. Do not merge
  overlapping clips; preserve one identifiable clip per POI.
- Treat the time covered by overlapping clips as shared elapsed time. For
  intervals `[TA, TB]` and `[TC, TD]`, where `TC` falls within the first
  interval, the combined visual span is `[TA, TD]`; do not add the overlap or
  either clip duration a second time.
- Derive the timeline end from the final Replay speed profile, not by summing
  POI clip durations. Lane assignment affects only layout, never playback
  timing.

Keep POI-specific projection and labels in Studio's adapter/domain layer. The
generic Timeline component should receive ordinary read-only tracks and clips
without Replay-specific behavior.

### Clip Types

`replay`

- Mandatory and locked by default. Exactly one replay clip must exist.
- Its duration defaults to `lgs.settings.ui.replay.duration`.
- Moving should be disabled in V1. The replay starts after the ordered start clips.
- Resizing may update the replay duration, but only when replay is not playing, recording, or exporting.

`start`

- References a catalog entry from `settings.ui.replay.clips.catalog`.
- Must be placed before the replay clip.
- Duration comes from the clip `params.duration`.
- Existing max-instance rules still apply.

`stop`

- References a catalog entry from `settings.ui.replay.clips.catalog`.
- Must be placed after the replay clip.
- Duration comes from the clip `params.duration`.
- Existing max-instance rules still apply.

`widget`

- References a video widget instance or a widget base id that can create an instance.
- Defines a visible range: `startSeconds` / `durationSeconds`.
- Defines enter and exit effects.
- Uses current widget manager geometry for position, scale, rotation, z-index, and bounds.

## Proposed Data Model

Store the new model under `journey.replay.timeline` while keeping `journey.replay.start` and `journey.replay.stop` during migration.

```js
{
  schemaVersion: 1,
  tracks: [
    {
      id: 'replay-main',
      kind: 'replay-main',
      order: null,
      lockedOrder: 'last',
      locked: true
    },
    {
      id: 'widget-track-1',
      kind: 'widget',
      order: 0,
      label: 'Widgets 1',
      collapsed: false
    }
  ],
  clips: [
    {
      id: 'start-zoom-in-1',
      kind: 'start',
      trackId: 'replay-main',
      clipId: 'zoom-in',
      startSeconds: 0,
      durationSeconds: 2,
      enabled: true,
      params: {
        duration: 2,
        altitude: 1200,
        pitch: -65
      }
    },
    {
      id: 'replay-core',
      kind: 'replay',
      trackId: 'replay-main',
      startSeconds: 2,
      durationSeconds: 60,
      locked: true
    },
    {
      id: 'widget-dynamic-stats-1',
      kind: 'widget',
      trackId: 'widget-track-1',
      widgetId: 'dynamic-stats-widget#abc123',
      widgetBaseId: 'dynamic-stats-widget',
      startSeconds: 8,
      durationSeconds: 14,
      enabled: true,
      enterEffect: {
        type: 'none',
        durationSeconds: 0,
        params: {}
      },
      exitEffect: {
        type: 'none',
        durationSeconds: 0,
        params: {}
      }
    }
  ]
}
```

Recommended derived values:

- `replayStartSeconds`: sum of enabled start clip durations.
- `replayEndSeconds`: `replayStartSeconds + replayDurationSeconds`.
- `replayDurationSeconds`: duration of the enabled replay clip.
- `totalDurationSeconds`: max of replay track end and all enabled widget clip ends.
- `visualTracks`: widget tracks sorted by `order`, followed by the replay-main track.
- `activeClipsAt(timeSeconds)`: all enabled clips whose `[start, end]` contains the current time.

## Compatibility Plan

The migration should be additive.

1. If `journey.replay.timeline` is absent, build it from `journey.replay.start`, `journey.replay.stop`, and one replay clip using `lgs.settings.ui.replay.duration`.
2. For one release, write both formats:
   - timeline is the source of truth for the new UI;
   - `journey.replay.start` and `journey.replay.stop` are generated from the replay-main track for existing runtime code.
3. Move `ReplayDeferredExporter.buildReplayVideoTimeline()` to consume the normalized timeline model.
4. After runtime code no longer reads old start/stop arrays directly, keep read-only backward migration and stop writing duplicated arrays.

The existing clip catalog should remain in `settings.ui.replay.clips.catalog`. It is still useful for start/stop camera clip definitions.

## Runtime Architecture

Add a small core model module:

- `ReplayTrackTimelineModel.js`
  - normalize raw timeline data;
  - migrate old start/stop arrays;
  - validate track and clip constraints;
  - derive ordered phases;
  - resolve active widget clips for a timestamp/frame;
  - serialize back to `journey.replay.timeline`.

Keep `ReplayFrameTimeline` as the deterministic frame clock. It should not know about widgets or UI tracks. It only answers: frame index, frame time, progress, and FPS.

Extend the replay video frame state:

```js
{
  active: true,
  index,
  frameCount,
  frameTimeMs,
  phase,
  sample,
  progress,
  activeWidgetClips: [
    {
      clipId: 'widget-dynamic-stats-1',
      widgetId: 'dynamic-stats-widget#abc123',
      localProgress: 0.42,
      enterProgress: 1,
      exitProgress: 0,
      effectState: {
        opacity: 1,
        transform: null
      }
    }
  ]
}
```

`ReplayOverlayResolver` should become the single visibility authority for widget timeline clips:

- if no replay sync is active, video widget visibility remains current behavior;
- if replay sync is active and a widget has timeline clips, the widget is visible only when at least one clip is active;
- if a widget has no timeline clip, V1 should keep the current global video-widget behavior for backward compatibility;
- Export frame state takes precedence over interactive playback state during capture.

`ReplayVideoOverlayComposer` should apply effect output when adding an overlay:

- `none`: opacity 1, no transform;
- `fade`: opacity from/to 0;
- `scale`: scale from/to configured factor;
- `slide`: translate from/to configured direction.

V1 should implement only `none` and optionally `fade`. The model should already support more effects so the data contract does not need another migration.

## Editor UX

Replace the current `Clips` tab with a `Timeline` tab. The tab can still use the same panel slot in `JourneyReplayDrawer.jsx`.

### Desktop Layout

- Header toolbar:
  - add start clip;
  - add stop clip;
  - add widget track;
  - add widget clip;
  - zoom out / zoom in;
  - snap toggle;
  - selected clip delete;
  - total duration indicator.
- Timeline body:
  - left fixed track header column;
  - right horizontally scrollable time ruler and clips;
  - widget tracks first, reorderable by dragging their track headers;
  - replay-main track pinned as the lowest track;
  - vertical scrolling for tracks;
  - horizontal scrolling for time.
- Inspector:
  - can be an inline details panel below the timeline in V1;
  - later it can become a side panel on wide desktop;
  - edits selected clip params, widget reference, enter effect, exit effect.

### Mobile / Stacked Drawer Layout

The mobile drawer should not try to mimic a full desktop NLE.

Recommended mobile behavior:

- Keep the replay-main track reachable at the bottom without covering widget tracks.
- Use a compact time scale and horizontal scroll.
- Make track headers collapsible.
- Allow widget track reordering by dragging the track header when vertical scrolling is not active.
- Open clip editing in a stacked child drawer or below-timeline details panel.
- Use large touch targets for trim handles.
- Lock playback/record controls outside the scrollable timeline area.
- Avoid drag interactions that require simultaneous vertical and horizontal scrolling. Use:
  - tap clip to select;
  - drag body to move in time;
  - drag left/right handles to trim;
  - buttons or menu for moving a clip to another track.

The existing `drawer-is-stacked` class and `PanelActions` pattern should be reused.

## Selected Timeline Component and Studio Boundary

Studio uses the sibling [`@lgs1920/timeline`](https://github.com/lgs1920/timeline)
package, currently pinned to version `1.4.1`. The package already provides the
generic editor surface: track and clip editing, movement and trimming,
snapping, collision policies, visibility actions, duplication, cut, undo/redo,
and controlled DOM events. Its React adapter exposes the same controlled model.

The package does not own a clock, persistence, or application rules. Studio
supplies its projection and accepts supported edits through the application
adapter. Keep the Web Component domain-neutral; do not implement a second
timeline UI in Studio or add Replay-specific behavior to the sibling package.

Studio currently persists a preparation snapshot in
`journey.replay.videoTimeline`. The remaining work is not to build the editor
surface again. It is to define the canonical Studio model, validate domain
commands, migrate existing Replay clip configuration and the preparation
snapshot, and ensure interactive playback and export consume the same model.

## Remaining Studio Architecture

1. Define and validate the canonical `journey.replay.timeline` model, including
   migration from `journey.replay.start`, `journey.replay.stop`, and the
   `journey.replay.videoTimeline` preparation snapshot.
2. Route timeline events through explicit Studio domain commands. Preserve the
   mandatory Replay phase, widget-track limits, clip constraints, and the
   separation between timeline order/visibility and global widget geometry.
3. Replace the separate start/stop clip editor only after migration and
   compatibility behavior are covered.
4. Use the normalized Studio model for interactive Replay visibility and
   deterministic export frame composition.
5. Add only the authoring controls and effects required by the product model;
   reuse the generic editing interactions already provided by Timeline.
6. Keep transport and structural edit locking controlled by Studio during
   playback, recording, and export.

## Validation Rules

The normalizer should enforce these rules:

- Exactly one replay-main track.
- Replay-main track order is derived as the last visual track and cannot be changed by drag.
- Widget track order is user-controlled and must remain stable after drag reorder.
- Exactly one replay clip.
- Replay clip duration must be greater than 0.
- The replay clip must remain between the start and stop clips on the replay-main track.
- Widget track count must be between 0 and 20.
- Clip start and duration must be finite and non-negative.
- Clip end must be greater than clip start, except disabled clips may be retained with zero duration for repair.
- Start clips must end at or before the replay clip.
- Stop clips must start at or after the replay clip.
- Replay-main track must not contain widget clips.
- Widget tracks must not contain start/stop/replay clips.
- Clips must not overlap within the same track.
- Unknown widget ids should be kept but marked unresolved, so user data is not silently deleted.
- Unknown start/stop catalog ids should be kept disabled and shown as unresolved.

## Time and Snapping

Internal storage should use seconds for readability and milliseconds only at frame/render boundaries.

The editor should snap to:

- frame duration when recording FPS is known;
- 0.1 seconds when FPS is unknown;
- whole seconds when the user holds a coarse-snap modifier or uses keyboard shortcuts.

The runtime should never trust pixel-derived values directly. Pointer edits should always flow through:

```js
nextSeconds = clamp(roundToSnap(pxToSeconds(pointerX)), 0, totalDurationSeconds)
normalized = normalizeReplayTrackTimeline(patchClip(rawTimeline, clipId, nextSeconds))
```

## Effects Contract

The first effect set should be deliberately small:

```js
{
  type: 'none' | 'fade' | 'scale' | 'slide',
  durationSeconds: 0,
  easing: 'linear',
  params: {}
}
```

V1 behavior:

- `none`: immediate visibility, no animation.
- `fade`: opacity 0 to 1 on enter, 1 to 0 on exit.

Future behavior:

- `scale`: transform around widget center.
- `slide`: translate from a configured edge.
- effect presets in `public/replay.yaml`.

Effects must be deterministic and based only on frame time. They must not use independent CSS animation timers during export.

## Implementation Plan

### Phase 1: Canonical Model and Migration — Pending

- Define the canonical Studio timeline schema and its normalizer.
- Migrate `journey.replay.start`, `journey.replay.stop`, and the current
  `journey.replay.videoTimeline` preparation snapshot.
- Add unit tests for:
  - empty timeline creation;
  - migration from `journey.replay.start/stop`;
  - replay-main constraints;
  - 20 widget track cap;
  - overlap rejection;
  - active widget clips by timestamp.
- Update Replay runtime setup to expose the normalized model.
- Keep legacy clip data readable until the migration is stable.

### Phase 2: Linked Preparation Preview — 1.0.0 — Delivered

- Use `@lgs1920/timeline` through the controlled `ReplayTimelinePreview` adapter.
- Project the Replay phases and eligible widget tracks from the existing Replay
  configuration.
- Connect cursor, play, pause, seeking, widget visibility, and row order to
  canonical Replay state and the Journey preparation snapshot.
- Keep the timeline outside the captured crop and export as an explicit action.

### Phase 3: Domain-Backed Authoring in the Replay Drawer — Planned

- Replace `JourneyReplayClipsTab` with `JourneyReplayTimelineTab`.
- Keep `JourneyReplayClipsTab` available until the migration is stable.
- Use the Timeline package's existing track and clip editing controls.
- Map edits to the validated canonical model and preserve replay-main ordering
  and start/replay/stop constraints.
- Implement domain-backed track and clip creation, removal, selection, and
  inspector actions.
- Keep structural edits locked while Replay is playing or export is active.

### Phase 4: Canonical Runtime and Export Integration — Planned

- Replace the local phase builder in `ReplayDeferredExporter` with canonical
  timeline phases.
- Publish active widget clips in interactive Replay and export frame state.
- Resolve widget visibility from the canonical model in both playback and
  export.
- Extend `ReplayVideoOverlayComposer` overlay options with deterministic opacity/transform output.

### Phase 5: Mobile and Recording Polish — Partially Covered by Timeline Package

- Tune stacked drawer layout.
- Add touch-specific handle sizes.
- Test horizontal scroll plus clip drag in the Replay drawer.
- Ensure selected clip inspector works without covering the timeline controls.
- Verify interactive playback and export resolve the same widget visibility and effects.

### Phase 6: Cleanup

- Deprecate direct editing of `journey.replay.start/stop`.
- Keep import/migration support.
- Update Replay docs and user-facing changelog.

## Test Matrix

The sibling Timeline project covers generic editing interactions. These tests
cover Studio's schema, migration, Replay projection, and export integration.

Unit:

- timeline normalization;
- migration of existing journey data;
- phase derivation;
- active clip lookup;
- effect progress calculation;
- overlay visibility resolver.

Component:

- add start clip;
- add stop clip;
- add widget track;
- move/resize widget clip;
- reject overlap;
- reject more than 20 widget tracks;
- mobile stacked drawer selection and inspector.

Integration:

- live replay preview with widget clips;
- interactive playback with widget clips;
- deterministic export with widget clips;
- start clip + replay + stop clip + widget overlays;
- removed widget referenced by a timeline clip;
- changed replay duration while timeline has widget clips after replay end.

Manual:

- desktop wide drawer;
- mobile/stacked drawer;
- 20 tracks;
- dense clip layout;
- 30 FPS and 60 FPS export;
- pause/resume/stop cleanup.

## Risks

- Editing while replay is running can desynchronize controller state. V1 should lock structural edits during playback/export.
- Widget geometry and widget timeline are separate concepts. The UI must make it clear that timeline clips control time, while widget edit mode controls screen position and size.
- Export will reveal any non-deterministic effect implementation. Effects must be computed from frame time, not CSS animation clocks.
- Timeline package upgrades can change generic interaction behavior. Keep the
  Studio adapter on the public controlled properties and events, and validate
  upgrades against both the package suite and Studio integration tests.

## External References Checked

- `@lgs1920/timeline` 1.4.1: sibling package at `../timeline` and
  https://github.com/lgs1920/timeline
