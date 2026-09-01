# LGS1920 Timeline Web Component Specification

## Status

Current implementation specification.

The component is a generic video-timeline editor. It is based on
`@xzdarcy/react-timeline-editor`, whose React timeline implementation has been
transformed into JavaScript and CSS Web Component code. The package also
provides a thin React wrapper around the custom element.

The Web Component uses Web Awesome 3 and Font Awesome for its controls,
inputs, icons, popups, and split-panel layout.

## Package structure

The implementation is located in:

```text
src/webcomponents/lgs1920-timeline/
├── LGS1920Timeline.js
├── LGS1920TimelineEditing.js
├── LGS1920TimelineRendering.js
├── LGS1920TimelineUtils.js
├── LGS1920TimelineReact.jsx
├── LGS1920Timeline.test.js
├── LGS1920TimelineReact.test.jsx
├── lgs1920-timeline.css
└── README.md
```

The custom element name is `lgs1920-timeline`. The React adapter is named
`LGS1920TimelineReact` and re-exports `LGS1920Timeline`.

## Ownership and controlled state

The component owns rendering and transient pointer interaction state. The host
owns the timeline model and applies committed changes by assigning `timeline`
and `tracks` again.

The public model is split into three clear areas:

- `timeline` contains duration, video range, editing, collision, zoom, and
  native split-panel bounds configuration.
- `tracks` contains track definitions and their `clips`.
- `currentTimeMillis`, `playing`, and `clipOptions` control the playhead,
  playback state, and insertion menu.

The host connects the component events to its application model and persistence
layer. Application-level recording, export, playback-clock, and persistence
flows consume the timeline model and events.

## Timeline configuration

The supported `timeline` fields are:

| Field | Description |
| --- | --- |
| `durationMillis` | Full timeline duration in milliseconds. |
| `rangeStartMillis` | Editable video range start. Defaults to `0`. |
| `rangeEndMillis` | Editable video range end. Defaults to `durationMillis`. |
| `visible` | Controls component visibility. Defaults to `true`. |
| `editable` | Enables clip editing and track reordering. Defaults to `true`. |
| `zoomPercent` | Ruler zoom from `-50` to `500`. |
| `legendMinWidth` | Minimum track-title width. Defaults to `100`. |
| `legendMaxWidth` | Maximum track-title width. Defaults to `230`. |
| `collisionPolicy` | Default clip collision policy: `allow`, `prevent`, or `ripple`. |
| `durationPolicy` | `fixed` keeps the duration bounded; `extend` grows it when required. |
| `defaultTrackId` | Track selected by the clip insertion menu when an option has no `trackId`. |
| `defaultClipDuration` | Default insertion duration in seconds. Defaults to `1`. |
| `minClipDuration` | Default minimum clip duration in seconds. |
| `keyboardStepSeconds` | Keyboard editing step in seconds. Defaults to `0.1`. |

The title/surface split is implemented with Web Awesome
`<wa-split-panel>`. The timeline supplies only `--min`, `--max`,
`--divider-width`, and `--divider-hit-area`; the native component owns the
current divider position and its interaction lifecycle. When the timeline
must refresh its internal DOM, it reuses the native split-panel element and
preserves its pixel position so a track drag or container resize does not
reset the divider.

## Track model

Each track has a stable `id`, a displayed `label`, and a `clips` array. The
editing-related fields are:

| Field | Description |
| --- | --- |
| `editable` | Enables inline name editing. |
| `movable` | Enables vertical track reordering. Defaults to `true`. |
| `fixed` | Locks the track order. |
| `droppable` | Allows clips to be moved or inserted on the track. Defaults to `true`. |
| `accepts` | Array of accepted clip `kind` values. An empty value accepts every kind. |
| `collisionPolicy` | Track-level override for `allow`, `prevent`, or `ripple`. |
| `minClipDuration` | Track-level minimum clip duration in seconds. |

Track visibility, icons, colors, labels, and actions are independently
customizable through properties and slots.

## Clip model

Each clip uses seconds for its temporal fields:

| Field | Description |
| --- | --- |
| `id` | Stable clip identifier. |
| `start` | Clip start position in seconds. |
| `end` | Clip end position in seconds. |
| `kind` | Application-defined type such as `video`, `audio`, or `marker`. |
| `label` / `name` | Default displayed label. |
| `icon` | Font Awesome icon name. |
| `colorClasses` | Web Awesome color classes. |
| `visible` | Clip visibility state. |
| `movable` | Enables horizontal and cross-track movement. Defaults to `true`. |
| `resizable` | Enables the start and end handles. Defaults to `true`. |
| `fixed` | Prevents movement and resizing. |
| `minDuration` | Per-clip minimum duration in seconds. |
| `metadata` | Application-owned metadata. |

## Video range handles

The timeline renders two global handles for the video range:

- `timeline-start-handle` controls `rangeStartMillis`;
- `timeline-end-handle` controls `rangeEndMillis`.

The handles cannot cross one another and remain inside the full timeline
duration. They support pointer and keyboard editing. The default end range
follows an extended duration until the host explicitly supplies a
`rangeEndMillis` value or edits the end handle.

When focused, `ArrowLeft` and `ArrowRight` move the selected range boundary by
`keyboardStepSeconds`; `Shift` multiplies the step by ten.

The global slots `timeline-start-handle` and `timeline-end-handle` customize
their visible contents. The CSS parts are `timeline-start-handle` and
`timeline-end-handle`.

## Playhead keyboard controls

When the playhead has focus, `ArrowLeft` and `ArrowRight` move it by
`keyboardStepSeconds`; `Shift` multiplies the step by ten. `Alt+ArrowRight`
moves the playhead to the range minimum, while `Alt+ArrowLeft` moves it to the
range maximum. The focused time surface uses the horizontal arrow keys to
change the ruler zoom in 20% increments; `Ctrl+Wheel` provides the pointer
equivalent.

## Clip editing

### Horizontal movement

Dragging the body of a movable clip preserves its duration and changes both
`start` and `end`. The clip is constrained to the timeline bounds when
`durationPolicy` is `fixed`. With `durationPolicy: 'extend'`, moving or
resizing beyond the current end can extend the timeline.

### Start and end resizing

Every resizable clip renders two edge handles:

- `clip-start-handle` changes `start` while keeping `end` stable;
- `clip-end-handle` changes `end` while keeping `start` stable.

The minimum duration is resolved from `clip.minDuration`, then
`track.minClipDuration`, then `timeline.minClipDuration`. The handles support
pointer and keyboard editing. `ArrowLeft` and `ArrowRight` use
`keyboardStepSeconds`; `Shift` applies a ten-times step.

The native split-panel divider is also keyboard accessible. Its horizontal
arrow keys resize the title column, `Shift` changes the movement step, `Home`
and `End` select the configured minimum and maximum, and `Enter` collapses or
restores the panel.

The global slots `clip-start-handle` and `clip-end-handle` provide fallback
content, while `clip-start-handle-{clipId}` and `clip-end-handle-{clipId}`
customize individual clips.

### Cross-track movement

Dragging a movable clip over a compatible track changes its owning track while
preserving its duration and current time position. The target track is
highlighted during the gesture. A track with `droppable: false` or without the
clip kind in `accepts` is not a valid target.

### Collision policies

The target track resolves its collision policy before applying a clip edit:

| Policy | Rule |
| --- | --- |
| `allow` | Existing clips may overlap. |
| `prevent` | The edit is rejected when it overlaps another clip. |
| `ripple` | Overlapping clips are shifted to the right while preserving their durations and existing gaps. |

Ripple layout applies to insertion, movement, and resizing. If the resulting
last clip exceeds the current duration, `durationPolicy: 'extend'` increases
the duration. A fixed timeline rejects the edit instead. Locked or incompatible
target tracks reject cross-track movement.

## Clip insertion

The clip menu is populated by `clipOptions`. An option can define `group`,
`key`, `id`, `label`, `icon`, `kind`, `trackId`, `start`, `end`, `duration`,
and a `clip` object with application fields.

Insertion uses the option track, then `timeline.defaultTrackId`, then the first
compatible track. Its default position is the current playhead. The target
track collision policy is applied immediately. `add-clip` returns the created
clip, the target track, the resulting duration, and the complete tracks
snapshot.

## Track reordering

Track reordering starts only from the `drag-trigger` slot. The title column and
the time surface use the same row order, so both move together. Fixed tracks
and tracks with `movable: false` cannot be reordered.

During the gesture, a one-pixel brand-colored horizontal insertion line spans
the complete title and time-surface area. The committed `reorder` event
contains the resulting order and `dropIndex`.

Movable tracks and clips emit the `before-drag`, `drag`, and `after-drag`
lifecycle. Their `detail.context` is `{type: 'piste', pisteId, trackId}` for a
track and `{type: 'clip', pisteId, trackId, clipId}` for a clip. The aliases
`trackId` and `clipId` keep the public context compatible with the rest of the
timeline API while `pisteId` preserves the UI contract. `after-drag` includes
`committed: false` when the interaction is cancelled or a clip proposal is
rejected.

## Contextual content and actions

The component exposes global and identifier-specific slots for:

- track icons, labels, drag triggers, visibility controls, and track actions;
- clip icons, labels, content, start handles, end handles, and clip actions;
- video range handle content;
- playback controls, headers, timeline actions, toolbar, ruler, footer, and
  empty states;
- an application-owned additional menu beside the transport controls; menu
  controls supplied by the application use the `brand` variant;
- track and clip context-menu entries.

The `#` character separates a slot prefix and an identifier. For example,
`clip-content-intro#001` targets clip `intro#001`.

## Event contract

Events bubble and cross the Shadow DOM boundary. Their DOM names use the
`lgs1920-timeline-` namespace. The React wrapper maps the suffix directly to
the corresponding callback:

| Event suffix | React callback | Purpose |
| --- | --- | --- |
| `play`, `pause`, `stop`, `restart` | `onPlay`, `onPause`, `onStop`, `onRestart` | Playback requests. |
| `seek` | `onSeek` | Playhead movement. |
| `range-change-start` | `onRangeChangeStart` | Video range edit start. |
| `range-changing` | `onRangeChanging` | Live video range preview. |
| `range-change` | `onRangeChange` | Committed video range. |
| `clip-change-start` | `onClipChangeStart` | Clip edit start. |
| `clip-changing` | `onClipChanging` | Live clip edit preview. |
| `clip-change` | `onClipChange` | Committed movement or resize. |
| `before-drag` | `onBeforeDrag` | Track or clip drag started. |
| `drag` | `onDrag` | Track or clip drag preview. |
| `after-drag` | `onAfterDrag` | Track or clip drag completed or cancelled. |
| `add-clip` | `onAddClip` | Clip insertion result. |
| `reorder` | `onReorder` | Track reorder result. |
| `track-label-change` | `onTrackLabelChange` | Track name change. |
| `track-visibility-change` | `onTrackVisibilityChange` | Track visibility change. |
| `clip-visibility-change` | `onClipVisibilityChange` | Clip visibility change. |
| `dblclick` | `onDblClick` | Clip double-click. |
| `context-menu-open` | `onContextMenuOpen` | Track or clip context menu. |
| `clip-label-edit-request` | `onClipLabelEditRequest` | Clip label edit request. |

Clip edit details contain `type`, `edge`, `clipId`, `fromTrackId`,
`toTrackId`, `clip`, `durationMillis`, and the complete `tracks` snapshot.
Range details contain `rangeStartMillis`, `rangeEndMillis`, and
`durationMillis`.

## Persistence and application integration

The host persists the model appropriate to its application. A React host
typically applies `detail.tracks` with `setState`. A Web Component host assigns
the updated array to `timeline.tracks`. The timeline emits serializable
snapshots so the host can connect the result to its own project, journey, or
video model.

Application actions such as recording, exporting, fullscreen, or closing are
provided through the `timeline-actions` and `header-actions` slots.

The React adapter is a passive property and event bridge. Its effects only
assign configuration/tracks, current time, and playback state to the custom
element, while callbacks only forward custom-event details. It contains no
timeline, playback, or application business logic.

## Accessibility and styling

The host is a labelled region. Web Awesome buttons and inputs provide the
standard control semantics. The video range handles and clip resize handles
are keyboard focusable sliders. The split-panel divider provides the title
area resize interaction and accessible separator semantics.

All visual states are customizable with `--lgs-timeline-*` variables and CSS
parts, including:

- `timeline-start-handle` and `timeline-end-handle`;
- `clip-start-handle` and `clip-end-handle`;
- `track-drop-indicator`;
- `split-panel` and the surrounding timeline layout;
- tracks, clips, playhead, ruler, menus, and actions.

The complete usage examples and property tables are maintained in the
component [README](../../../src/webcomponents/lgs1920-timeline/README.md).
