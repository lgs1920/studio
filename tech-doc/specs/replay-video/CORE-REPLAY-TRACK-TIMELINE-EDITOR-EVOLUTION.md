# Replay Track Timeline Editor Evolution

Status: **TODO**

Target release: `1.1.0`

Date: 2026-07-16

## Goal

Replace the current separated `start` / `replay` / `stop` clip UI with a video-editor-like track timeline inside the Replay drawer.

The replay itself must remain mandatory. The main replay track should contain:

- optional start clips before the replay;
- one locked replay clip;
- optional stop clips after the replay.

Additional tracks, capped at 20, should contain widget clips. A widget track may contain a single widget clip or multiple widget clips. Moving and resizing a widget clip controls its visible time range. Widget screen position, scale, and bounds should continue to use the existing video widget board and widget manager. Each widget clip may define an enter effect and an exit effect. The default effect is an immediate cut with no animation.

The editor must work in the existing Replay drawer, including the stacked/mobile drawer mode.

## Current State

The current replay/video implementation already has several useful building blocks:

- `public/replay.yaml` defines the replay defaults and the current start/stop clip catalog.
- `JourneyReplayClips.js` normalizes clip catalog entries and clip instances.
- `JourneyReplayClipsTab.jsx` edits two independent clip lists: `journey.replay.start` and `journey.replay.stop`.
- `JourneyReplayDrawer.jsx` owns the Replay drawer tabs and already supports stacked drawer behavior through `drawerManager.isStacked(REPLAY_DRAWER)`.
- `ReplayFrameTimeline.js` generates deterministic frame progress from duration and FPS.
- `ReplayDeferredExporter.js` already builds a start/replay/stop phase sequence for HQ export.
- `ReplayOverlayResolver.js` already distinguishes replay video phases and controls replay-driven widget visibility.
- The widget stack already supports board-scoped widget geometry through `VIDEO_WIDGETS_BOARD`, persisted ratios, `react-moveable`, and the video overlay composer.
- `CanvasOverlayComposer` already composites video widgets into live recordings and deferred HQ exports.

This means the hard part is not drawing rectangles on a timeline. The hard part is defining a stable timeline data model and making live preview, draft recording, and HQ export consume the same clip state.

The normalized timeline is the single source of truth for both video workflows:

- Draft recording uses the timeline for replay synchronization, phase changes, and widget visibility during live capture.
- HQ export uses the same timeline for deterministic frame generation, replay phases, and widget visibility.
- Both workflows contain the same single replay clip; they may differ only in capture quality, FPS, and encoding path.

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
- HQ export frame state wins over live frame state, as it already does today.

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

## Pure Custom Option

Build the timeline editor in the project, using the existing stack:

- React + Valtio for UI state.
- Web Awesome components for buttons, selects, menus, and drawers.
- Existing `LGSScrollbars`.
- Existing `SortableJS` for widget track ordering, with the replay-main track excluded from the sortable list.
- Existing widget manager and `react-moveable` for widget screen geometry.
- Plain pointer events for clip move/trim interactions.

Optional additions:

- `react-window` if rendering all tracks and clips becomes costly. With only 20 tracks, this is probably not needed in V1 unless each track contains many clips.
- `@dnd-kit/core` / `@dnd-kit/sortable` if SortableJS becomes limiting for accessible, touch-friendly track reordering. It should not be required for clip resizing.

Advantages:

- Exact fit with the mandatory replay phase, widget visibility, mobile drawer, Draft recording, and HQ export.
- No calendar/date model translation.
- No imperative third-party timeline state fighting React/Valtio.
- Smaller visual integration cost with the current drawer and Web Awesome style.
- Lower licensing risk.

Costs:

- The project owns snapping, collision detection, trim handles, keyboard movement, and accessibility.
- More tests are needed because timeline edits directly affect video export.
- More implementation work than dropping in a timeline package.

Recommendation: this is the best long-term option.

## Open Source Package Options

Package metadata was checked on 2026-07-16.

| Package | Fit | License / compatibility | Strengths | Gaps | Verdict |
| --- | --- | --- | --- | --- | --- |
| `@xzdarcy/react-timeline-editor` | Medium-high | MIT. npm reports `1.0.0`, React `>=18`. | Rows and actions map reasonably well to tracks and clips. Built for timeline editing, not calendars. Uses virtualization/interactjs internally. | UI model is animation-oriented. Still requires adapters for locked replay, start/replay/stop rules, effects, widget visibility, and mobile drawer polish. Adds `react-virtualized` and `interactjs`. | Best package spike if we want to test a ready-made timeline UI. Not the recommended final architecture unless the spike proves styling and mobile are acceptable. |
| `react-calendar-timeline` | Medium | MIT. npm reports `0.30.0-beta.4`; README says the beta targets React 18/19 and Vite. | Mature group/item model, move/resize/group change, headers, markers. | Calendar/date semantics are awkward for a seconds-based video editor. Current React 19 support is beta. Styling a video-editor drawer may be expensive. | Possible, but too calendar-shaped for this feature. |
| `vis-timeline` | Low-medium | MIT or Apache-2.0. npm reports `8.5.2`. | Powerful standalone groups/items/ranges editor with create/edit/delete support. | Imperative DOM library, not React-native. Adds more non-React state, moment-era dependencies, and styling isolation work. | Avoid for this React drawer. |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/react` | Building block | MIT. `@dnd-kit/react` supports React 18/19; `@dnd-kit/core` is widely used but older API. | Accessible drag/drop, touch and keyboard sensors, extensible collision rules. | Not a timeline. We still build time math, trim handles, snapping, and rendering. | Good optional dependency for custom implementation, especially track reordering and future keyboard DnD. |
| `react-window` | Building block | MIT. npm reports `2.2.7`, React 18/19. | Efficient list/grid virtualization. | Not an editor. Adds complexity if used too early. | Keep as optional; probably not needed for 20 tracks in V1. |
| `@twick/*` | Low | Twick uses a Sustainable Use License with SaaS/commercial restrictions. | Rich media editor SDK with timeline/canvas packages. | License is not a clean permissive open-source fit for this AGPL project. It overlaps with existing replay/export architecture. | Do not use. |
| `react-video-editor-timeline` | Low | MIT, but npm package depends on React 17, React DOM 17, React Scripts 4, and Ant Design 4. | Video/audio timeline intent. | Incompatible dependency profile for this React 19/Vite project. | Do not use. |

## Recommended Architecture

Use a custom timeline model and a custom timeline UI for V1.

The project already owns the replay clock, the HQ export frame loop, the widget board, and overlay composition. A third-party timeline can only solve the visible editor surface. It cannot remove the need for a project-specific runtime model.

Recommended compromise:

1. Build `ReplayTrackTimelineModel` first.
2. Build a custom V1 editor with plain pointer events.
3. Keep the editor interaction surface intentionally small:
   - move clip;
   - trim left/right;
   - add/remove clip;
   - add/remove/collapse track;
   - select clip and edit fields;
   - snap to frames/seconds.
4. Only add `@dnd-kit` if track reordering or mobile drag behavior becomes unreliable with existing code.
5. Do not add a full timeline package unless a short spike proves that `@xzdarcy/react-timeline-editor` can satisfy locked replay, mobile drawer, styling, and controlled state without fighting the runtime.

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

Effects must be deterministic and based only on frame time. They must not use independent CSS animation timers during HQ export.

## Implementation Plan

### Phase 1: Model and Migration

- Add `ReplayTrackTimelineModel.js`.
- Add unit tests for:
  - empty timeline creation;
  - migration from `journey.replay.start/stop`;
  - replay-main constraints;
  - 20 widget track cap;
  - overlap rejection;
  - active widget clips by timestamp.
- Update drawer runtime setup to expose `replayRuntime.timeline`.
- Keep writing generated `journey.replay.start/stop` for compatibility.

### Phase 2: Timeline Drawer UI

- Replace `JourneyReplayClipsTab` with `JourneyReplayTimelineTab`.
- Keep `JourneyReplayClipsTab` available until the migration is stable.
- Implement replay-main track with start/replay/stop clips.
- Implement widget track creation and basic widget clip creation.
- Implement widget track drag reorder while keeping replay-main pinned as the lowest track.
- Implement selection and inspector.
- Lock edits while replay is playing, recording, or HQ export is active.

### Phase 3: Runtime and Overlay Visibility

- Replace the local phase builder in `ReplayDeferredExporter` with the normalized timeline phases.
- Publish `activeWidgetClips` in live replay dynamic frame state and HQ export frame state.
- Extend `ReplayOverlayResolver` to resolve widget visibility from timeline clips.
- Extend `ReplayVideoOverlayComposer` overlay options with deterministic opacity/transform output.

### Phase 4: Mobile and Recording Polish

- Tune stacked drawer layout.
- Add touch-specific handle sizes.
- Test horizontal scroll plus clip drag in the Replay drawer.
- Ensure selected clip inspector works without covering the timeline controls.
- Verify draft recording and HQ export render the same widget visibility/effects.

### Phase 5: Cleanup

- Deprecate direct editing of `journey.replay.start/stop`.
- Keep import/migration support.
- Update Replay docs and user-facing changelog.

## Test Matrix

Unit:

- timeline normalization;
- legacy migration;
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
- draft recording with widget clips;
- HQ export with widget clips;
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
- HQ export will reveal any non-deterministic effect implementation. Effects must be computed from frame time, not CSS animation clocks.
- A third-party timeline package may look faster at first but can become expensive if it fights the Replay drawer, Web Awesome styling, mobile behavior, and deterministic frame export.

## External References Checked

- `@xzdarcy/react-timeline-editor`: https://github.com/xzdarcy/react-timeline-editor
- `react-calendar-timeline`: https://github.com/namespace-ee/react-calendar-timeline
- `vis-timeline`: https://github.com/visjs/vis-timeline
- `dnd-kit`: https://github.com/clauderic/dnd-kit and https://dndkit.com/
- `react-window`: https://github.com/bvaughn/react-window and https://react-window.vercel.app/
- `Twick`: https://ncounterspecialist.github.io/twick/ and https://github.com/ncounterspecialist/twick/blob/main/LICENSE.md
