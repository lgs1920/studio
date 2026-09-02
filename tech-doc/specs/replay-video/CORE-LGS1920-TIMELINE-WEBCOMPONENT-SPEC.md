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

## Usage examples

The component is controlled by its host. The host assigns the public model and
applies the serializable snapshots received from interaction events. The
following examples show the HTML custom element first, followed by JavaScript
and React integrations.

### HTML

The custom element can contain regular HTML and Web Awesome components in its
named slots. The module import registers `lgs1920-timeline` and its Web Awesome
dependencies.

```html
<lgs1920-timeline id="video-timeline" aria-label="Video timeline">
    <h2 slot="header">Video sequence</h2>
    <wa-button slot="custom-menu" variant="brand" appearance="plain">Custom menu</wa-button>
    <wa-button slot="header-actions" appearance="plain">Close</wa-button>
    <wa-button slot="timeline-actions" variant="brand">Export video</wa-button>
</lgs1920-timeline>

<script type="module">
    import '/src/webcomponents/lgs1920-timeline/LGS1920Timeline.js'
</script>
```

The JavaScript example below selects the element by its `id` and assigns its
controlled state.

### JavaScript

```js
const timelineElement = document.getElementById('video-timeline')
let tracks = [
    {
        id: 'video',
        label: 'Video',
        icon: 'video',
        clips: [
            {id: 'intro', label: 'Intro', kind: 'video', start: 0, end: 8},
            {id: 'journey', label: 'Journey', kind: 'video', start: 8, end: 48},
        ],
    },
    {
        id: 'music',
        label: 'Music',
        icon: 'music',
        fixed: true,
        movable: false,
        clips: [
            {id: 'theme', label: 'Opening theme', kind: 'audio', start: 0, end: 48},
        ],
    },
]

timelineElement.addEventListener('lgs1920-timeline-seek', event => {
    timelineElement.currentTimeMillis = event.detail.timeMillis
})

timelineElement.addEventListener('lgs1920-timeline-play', () => {
    timelineElement.playing = true
})

timelineElement.addEventListener('lgs1920-timeline-pause', () => {
    timelineElement.playing = false
})

timelineElement.addEventListener('lgs1920-timeline-stop', event => {
    timelineElement.playing = false
    timelineElement.currentTimeMillis = event.detail.timeMillis
})

timelineElement.addEventListener('lgs1920-timeline-clip-change', event => {
    tracks = event.detail.tracks
    timelineElement.tracks = tracks
})

timelineElement.addEventListener('lgs1920-timeline-track-label-change', event => {
    tracks = event.detail.tracks
    timelineElement.tracks = tracks
})

timelineElement.timeline = {
    durationMillis: 48_000,
    rangeStartMillis: 0,
    rangeEndMillis: 48_000,
    editable: true,
    interactive: true,
    collisionPolicy: 'prevent',
    durationPolicy: 'fixed',
    keyboardStepSeconds: 0.1,
}
timelineElement.tracks = tracks
timelineElement.currentTimeMillis = 0
timelineElement.playing = false
timelineElement.clipOptions = [
    {group: 'media', key: 'video', label: 'Video clip', icon: 'film', kind: 'video'},
]
```

### React

The React adapter forwards the same controlled model and maps the custom-event
suffixes to callback props. It passes slotted children to the custom element.

```jsx
import {useState} from 'react'
import {LGS1920TimelineReact} from './LGS1920TimelineReact'

const timelineConfig = {
    durationMillis: 48_000,
    rangeStartMillis: 0,
    rangeEndMillis: 48_000,
    editable: true,
    interactive: true,
    collisionPolicy: 'prevent',
    durationPolicy: 'fixed',
    keyboardStepSeconds: 0.1,
}

const initialTracks = [
    {
        id: 'video',
        label: 'Video',
        icon: 'video',
        clips: [
            {id: 'intro', label: 'Intro', kind: 'video', start: 0, end: 8},
            {id: 'journey', label: 'Journey', kind: 'video', start: 8, end: 48},
        ],
    },
]

export const VideoTimelineExample = () => {
    const [tracks, setTracks] = useState(initialTracks)
    const [currentTimeMillis, setCurrentTimeMillis] = useState(0)
    const [playing, setPlaying] = useState(false)

    return (
        <LGS1920TimelineReact
            timeline={timelineConfig}
            tracks={tracks}
            currentTimeMillis={currentTimeMillis}
            playing={playing}
            clipOptions={[
                {group: 'media', key: 'video', label: 'Video clip', icon: 'film', kind: 'video'},
            ]}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onStop={detail => {
                setPlaying(false)
                setCurrentTimeMillis(detail.timeMillis)
            }}
            onSeek={detail => setCurrentTimeMillis(detail.timeMillis)}
            onClipChange={detail => setTracks(detail.tracks)}
            onTrackLabelChange={detail => setTracks(detail.tracks)}
            onDblClick={detail => console.log(detail.clip)}
        >
            <h2 slot="header">Video sequence</h2>
            <wa-button slot="custom-menu" variant="brand" appearance="plain">Custom menu</wa-button>
            <wa-button slot="header-actions" appearance="plain">Close</wa-button>
        </LGS1920TimelineReact>
    )
}
```

## Timeline configuration

The supported `timeline` fields are:

| Field | Description |
| --- | --- |
| `durationMillis` | Full timeline duration in milliseconds. |
| `rangeStartMillis` | Editable video range start. Defaults to `0`. |
| `rangeEndMillis` | Editable video range end. Defaults to `durationMillis`. |
| `visible` | Controls component visibility. Defaults to `true`. |
| `editable` | Enables clip editing and track reordering. Defaults to `true`. |
| `zoomPercent` | Ruler zoom up to `500`; its minimum is calculated from the available surface width and full timeline duration. |
| `legendMinWidth` | Minimum track-title width. Defaults to `100`. |
| `legendMaxWidth` | Maximum track-title width. Defaults to `230`. |
| `collisionPolicy` | Default clip collision policy: `allow`, `prevent`, or `ripple`. Defaults to `prevent`. |
| `resizeCollisionPolicy` | Resize collision policy: `ripple` by default; may be `allow` or `prevent`. |
| `durationPolicy` | `fixed` keeps the duration bounded; `extend` grows it when required. |
| `keyboardZoomActive` | Enables arrow-key zoom while the containing timeline widget is selected. Defaults to `false`. |
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
| `resizeCollisionPolicy` | Track-level resize override for `allow`, `prevent`, or `ripple`; defaults to `ripple`. |
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

When a range boundary moves, the playhead keeps its current position while it
remains inside the new range. It is clamped to the new start or end boundary
only when it would otherwise fall outside the selected range.

When focused, `ArrowLeft` and `ArrowRight` move the selected range boundary by
`keyboardStepSeconds`; `Shift` multiplies the step by ten.

The global slots `timeline-start-handle` and `timeline-end-handle` customize
their visible contents. The CSS parts are `timeline-start-handle` and
`timeline-end-handle`.

## Playhead keyboard controls

When the playhead has focus, `ArrowLeft` and `ArrowRight` move it by
`keyboardStepSeconds`; `Shift` multiplies the step by ten. `Alt+ArrowRight`
moves the playhead to the range minimum, while `Alt+ArrowLeft` moves it to the
range maximum.

## Timeline zoom controls

Plain wheel input remains native scrolling. `Shift` plus the wheel adjusts the
track row height by 4 pixels between 24 and 64 pixels. `Alt` is accepted as an
additional vertical-zoom modifier. `Meta` (Command on
macOS, Super/Windows on Linux and Windows) plus the wheel adjusts the ruler
zoom by 20 percent. Unmodified `ArrowUp` and `ArrowDown` adjust row height;
unmodified `ArrowLeft` and `ArrowRight` adjust ruler zoom. `Ctrl` plus the
wheel is not intercepted, preserving browser zoom. The selected timeline
widget enables the window-level arrow behavior through `keyboardZoomActive`.
The ruler always renders secondary ticks: it uses five subdivisions per major
unit below 80 pixels per second and ten subdivisions at higher zoom. The
minimum horizontal zoom adapts to the available surface width so the complete
timeline can fit without horizontal scrolling, with a small right safety
margin.

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

The `resizable` clip input controls the size lock. The Replay clip is always
non-resizable; other clips are resizable by default unless their input sets
`resizable: false`.

### Cross-track movement

Dragging a movable clip over a compatible track changes its owning track while
preserving its duration and current time position. The target track is
highlighted during the gesture. A track with `droppable: false` or without the
clip kind in `accepts` is not a valid target.

### Collision policies

The target track resolves `collisionPolicy` before applying a move or
insertion. Resize edits resolve `resizeCollisionPolicy` independently and use
`ripple` by default:

| Policy | Rule |
| --- | --- |
| `allow` | Existing clips may overlap. Use only when overlap is explicitly required. |
| `prevent` | Clips cannot overlap. A moved or inserted clip is fitted to the available gap; a resize stops at the neighboring clip. |
| `ripple` | Overlapping clips are shifted to the right while preserving their durations and existing gaps. |

For a resize ripple, changing the start edge shifts all clips on the same track
to the left of the edited clip; changing the end edge shifts all clips to its
right. Shifted clips preserve their duration and relative spacing.

While a clip is dragged over an occupied or otherwise invalid drop zone, it
continues following the pointer and displays the `not-allowed` cursor. The
invalid position is not committed on release.

Ripple layout applies to insertion, movement, and resizing according to the
resolved policy. With `prevent`, a clip that reaches the next clip is shortened
to the free interval. If the remaining interval is shorter than the configured
minimum duration, the edit is rejected. If the resulting last clip exceeds the current duration,
`durationPolicy: 'extend'` increases the duration. A fixed timeline fits the
clip to its end instead. Locked or incompatible target tracks reject
cross-track movement.

While a clip is moved, a diamond is shown at each endpoint centered on the
ruler's lower border and protruding halfway into the track area. While a clip
edge is resized, a blue diamond follows the edited edge with the same
ruler-border positioning. These markers are transient and are removed when the
gesture ends or is cancelled.

Pointer movement and resizing snap the edited edge to the nearest major ruler
unit inside an eight-pixel magnetic threshold. Holding `Shift` while moving or
resizing a clip switches the snap unit to the currently rendered secondary
ruler divisions. Movement selects the closest of the clip's two edges and
preserves the clip duration. Set `snap: false` to disable the magnetic behavior.
Controlled track updates preserve the local ruler zoom unless a new explicit
`zoomPercent` value is provided.

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

During the gesture, the dragged row silhouette and the translucent source
placeholder show the drop position. A valid position uses the Web Awesome
`success` colors, while a rejected locked boundary uses `danger` colors. The
committed `reorder` event contains the resulting order and `dropIndex`.

When clip deletion leaves only one distinct widget on a grouped track, the
group is dissolved and the remaining widget becomes a standalone track.

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
- an independent-button transport toolbar for the Replay controls;
- an application-owned `custom-menu` centered between the left view tools and
  right transport controls; menu controls supplied by the application use the
  `brand` variant with `plain` appearance;

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
provided through the `custom-menu`, `timeline-actions`, and `header-actions`
slots. The header places view tools on the left, the custom menu in the center,
and transport controls on the right.

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
- `split-panel` and the surrounding timeline layout;
- tracks, clips, playhead, ruler, menus, and actions.

The complete usage examples and property tables are maintained in the
component [README](../../../src/webcomponents/lgs1920-timeline/README.md).
