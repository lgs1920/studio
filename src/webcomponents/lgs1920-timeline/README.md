# LGS1920 Timeline

`lgs1920-timeline` is a generic video timeline Web Component designed for Web
Awesome 3 and Font Awesome. It provides a time ruler, a playhead, editable
track names, track actions, clip rendering, scrubbing,
reordering, and playback controls.

The implementation is based on `@xzdarcy/react-timeline-editor`. Its React
implementation has been transformed into JavaScript and CSS for this Web
Component, with a React wrapper exposing the same public model.

## Installation

Import the custom element once in the application entry point:

```js
import '/src/webcomponents/lgs1920-timeline/LGS1920Timeline.js'
```

Import the React wrapper when using React:

```js
import {LGS1920TimelineReact} from '/src/webcomponents/lgs1920-timeline/LGS1920TimelineReact'
```

## Usage

The component has a compact controlled model:

- `timeline` describes the timeline surface.
- `tracks` describes the tracks and their clips.
- `currentTimeMillis` controls the playhead.
- `playing` controls the playback state.
- `timeline.fps`, `timeline.frameCount`, and `timeline.currentFrameIndex`
  describe the canonical Replay frame clock used by frame navigation.
- `clipOptions` supplies entries for the clip menu.

Set `timeline.interactive` to `false` for a display-only projection. The
component then renders the controlled ruler, playhead, tracks, and clips
without playback controls, menus, focusable scrubbing, editing handlers, or
interaction events.

```html
<lgs1920-timeline id="timeline" aria-label="Video timeline"></lgs1920-timeline>
```

```js
const timeline = document.getElementById('timeline')

timeline.timeline = {
    durationMillis: 60_000,
    fps: 30,
    frameCount: 1_801,
    frameIntervalMillis: 1000 / 30,
    currentFrameIndex: 105,
    visible: true,
    zoomPercent: 0,
    legendMinWidth: 100,
    legendMaxWidth: 230,
    rangeStartMillis: 0,
    rangeEndMillis: 60_000,
    editable: true,
    collisionPolicy: 'prevent',
    durationPolicy: 'fixed',
}

timeline.tracks = [
    {
        id: 'camera#main',
        label: 'Main camera',
        icon: 'video',
        canHide: true,
        clips: [
            {id: 'intro#001', label: 'Intro', kind: 'video', start: 0, end: 8},
            {id: 'scene#002', label: 'Scene', kind: 'video', start: 12, end: 36},
        ],
    },
    {
        id: 'music',
        label: 'Music',
        icon: 'music',
        fixed: true,
        movable: false,
        clips: [
            {id: 'music#001', label: 'Opening theme', kind: 'audio', start: 0, end: 42},
        ],
    },
]

timeline.currentTimeMillis = 3_500
timeline.playing = false
timeline.clipOptions = [
    {group: 'media', key: 'video', label: 'Video clip', icon: 'film'},
    {group: 'media', key: 'audio', label: 'Audio clip', icon: 'music'},
]
```

Clips use seconds for their `start` and `end` positions. The playhead uses
milliseconds through `currentTimeMillis`, matching the editor and playback
clock integration.

## Public properties

### `timeline`

| Property | Type | Description |
| --- | --- | --- |
| `durationMillis` | `number` | Timeline duration in milliseconds. |
| `fps` | `number` | Canonical Replay frame rate used by frame navigation. Defaults to `30`. |
| `frameCount` | `number` | Canonical Replay frame count. Used to clamp previous/next frame requests. |
| `frameIntervalMillis` | `number` | Canonical interval between Replay frames. Defaults to `1000 / fps`. |
| `currentFrameIndex` | `number` | Currently published absolute Replay frame index. |
| `rangeStartMillis` | `number` | Video range start in milliseconds. Defaults to `0`. |
| `rangeEndMillis` | `number` | Video range end in milliseconds. Defaults to `durationMillis`. |
| `visible` | `boolean` | Controls timeline visibility. Defaults to `true`. |
| `zoomPercent` | `number` | Initial ruler zoom up to `500`; the minimum is calculated from the available surface width, full timeline duration, and right safety margin. |
| `legendMinWidth` | `number` | Minimum track legend width in pixels. Defaults to `100`. |
| `legendMaxWidth` | `number` | Maximum track legend width in pixels. Defaults to `230`. |
| `editable` | `boolean` | Enables clip editing and track reordering. Defaults to `true`. |
| `interactive` | `boolean` | Enables playback, scrubbing, editing, menus, and emitted interaction events. Defaults to `true`. |
| `collisionPolicy` | `'allow' \| 'prevent' \| 'ripple'` | Default clip collision policy for tracks. Defaults to `prevent`. |
| `durationPolicy` | `'fixed' \| 'extend'` | Keeps the duration fixed or extends it when an edit exceeds the end. Defaults to `fixed`. |
| `keyboardZoomActive` | `boolean` | Enables arrow-key zoom when the containing widget is selected. Defaults to `false`. |
| `defaultTrackId` | `string` | Track used when a clip-menu option does not specify a track. |
| `minClipDuration` | `number` | Default minimum clip duration in seconds. |
| `defaultClipDuration` | `number` | Default duration for a clip-menu insertion in seconds. Defaults to `1`. |
| `keyboardStepSeconds` | `number` | Keyboard resize step in seconds. Defaults to `0.1`. |

### `tracks`

`tracks` is an array of track definitions:

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable track identifier. `#` is used as the slot identifier separator. |
| `label` | `string` | Track name shown in the legend. |
| `editable` | `boolean` | Enables inline track-name editing. Defaults to `true`. |
| `colorClasses` | `string[]` | Web Awesome color classes. |
| `visible` | `boolean` | Track visibility state. |
| `canHide` | `boolean` | Enables the track visibility action. |
| `fixed` | `boolean` | Prevents track reordering. |
| `movable` | `boolean` | Enables track reordering. Defaults to `true`. |
| `droppable` | `boolean` | Allows clips to be moved or inserted on the track. Defaults to `true`. |
| `accepts` | `string[]` | Clip kinds accepted by the track. An empty value accepts every kind. |
| `collisionPolicy` | `'allow' \| 'prevent' \| 'ripple'` | Collision behavior for clip edits on this track. |
| `minClipDuration` | `number` | Minimum duration applied to clips on this track, in seconds. |
| `clips` | `array` | Clips displayed on the track. |

Each clip supports:

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable clip identifier. `#` is used as the slot identifier separator. |
| `start` | `number` | Clip start position in seconds. |
| `end` | `number` | Clip end position in seconds. |
| `label` | `string` | Default clip label. |
| `name` | `string` | Optional display name when `label` is not supplied. |
| `kind` | `string` | Application-defined clip type, such as `video`, `audio`, or `marker`. |
| `icon` | `string` | Font Awesome icon name. |
| `colorClasses` | `string[]` | Web Awesome color classes. |
| `visible` | `boolean` | Clip visibility state. |
| `movable` | `boolean` | Allows horizontal and inter-track movement. Defaults to `true`. |
| `resizable` | `boolean` | Enables the start and end handles. Defaults to `true`. |
| `fixed` | `boolean` | Disables movement and resizing. |
| `minDuration` | `number` | Minimum clip duration in seconds. |
| `metadata` | `object` | Optional application metadata. |

### `currentTimeMillis`

The controlled playhead position in milliseconds.

### `playing`

The controlled playback state. The component emits `play` and `pause`; the
host updates this property after applying the requested state.

The icon transport controls are, in order, go to start, previous frame,
play/pause, stop, next frame, and go to end. The component emits the transport
request but does not advance the Replay clock itself. Previous and
next frame details contain `frameIndex`, `frameCount`,
`frameIntervalMillis`, `timeMillis`, `progress`, `settled`, and a `source`
value of `step-backward` or `step-forward`. The start and end controls use
`restart` or `seek` with `source` set to `go-to-start` or `go-to-end`.

The additional menu is application-owned and must be provided through the
`additional-menu` slot. The Web Component only exposes the controlled `fps`
value used for frame navigation; it does not modify the canonical Replay FPS
or emit an FPS-change event.

### `clipOptions`

Options displayed by the clip insertion menu. Each option can contain
`group`, `key`, `label`, `icon`, `kind`, `trackId`, `start`, `end`, `duration`,
and a `clip` object containing application fields to copy to the inserted clip.

## React wrapper

`LGS1920TimelineReact` exposes the Web Component properties as React props and
maps component events to callback props. The wrapper keeps the timeline
controlled by the parent component.

```jsx
import {LGS1920TimelineReact} from './LGS1920TimelineReact'

const VideoTimeline = ({timeline, tracks, onTracksChange, currentTimeMillis, playing}) => (
    <LGS1920TimelineReact
        timeline={timeline}
        tracks={tracks}
        currentTimeMillis={currentTimeMillis}
        playing={playing}
        clipOptions={[
            {group: 'media', key: 'video', label: 'Video clip', icon: 'film'},
        ]}
        onSeek={detail => console.log(detail.timeMillis)}
        onPlay={() => console.log('play requested')}
        onDblClick={detail => console.log(detail.clip)}
        onTrackLabelChange={detail => {
            onTracksChange(currentTracks => currentTracks.map(track => track.id === detail.trackId
                ? {...track, label: detail.label}
                : track))
        }}
    >
        <h2 slot="header">Video sequence</h2>
    </LGS1920TimelineReact>
)
```

The wrapper forwards `children` to the custom element. Web Component slots can
therefore be used directly in JSX with the standard `slot` attribute.
Callbacks receive `(detail, event)`, where `detail` is the event payload and
`event` is the original `CustomEvent`.

## Slots

Slots customize labels, icons, controls, track actions, and clip content. A
global slot is used for every matching element. A
targeted slot takes the form `{slot}-{id}` and overrides the global slot.

### Layout slots

| Slot | Description |
| --- | --- |
| `additional-content` | Content placed inside the component before the header. |
| `header` | Header content displayed beside the playback controls. |
| `header-actions` | General panel actions such as close, settings, or help. |
| `timeline-actions` | Application actions such as recording or exporting video. |
| `playback-start` | Content before the current time. |
| `playback-current` | Current-time label. |
| `playback-separator` | Separator between current and total time. |
| `playback-total` | Total-time label. |
| `playback-end` | Content after the total time. |
| `timeline-toolbar` | Toolbar content beside the clip menu. |
| `additional-menu` | Application-owned menu beside the transport controls. Use Web Awesome controls with `variant="brand"`. |
| `legend-ruler` | Replacement content for the title-column ruler area. The default fallback contains `timeline-toolbar` and the clip-menu button. |
| `timeline-ruler` | Additional content over the time ruler. |
| `footer` | Content below the timeline layout. |
| `empty-state` | Content displayed when the clip menu has no options. |

```html
<lgs1920-timeline>
    <div slot="additional-content">
        <wa-badge variant="success">Ready</wa-badge>
    </div>
    <h2 slot="header">Sequence</h2>
    <span slot="playback-separator"> of </span>
    <wa-button slot="header-actions" appearance="plain">Close</wa-button>
    <wa-button slot="timeline-actions" variant="brand">Record video</wa-button>
    <wa-button slot="timeline-toolbar" appearance="plain">Markers</wa-button>
</lgs1920-timeline>
```

The custom element is its own layout container. When placed in a Web Awesome
drawer or another host panel, size the custom element from the outside:

```css
wa-drawer lgs1920-timeline,
.timeline-panel lgs1920-timeline {
    width: 100%;
    height: 100%;
}
```

### Playback and clip-menu slots

| Slot | Description |
| --- | --- |
| `play-icon` / `pause-icon` | Play or pause icon. |
| `start-icon` | Go-to-start icon. |
| `stop-icon` | Stop icon. |
| `previous-frame-icon` / `next-frame-icon` | Previous or next frame icon. |
| `end-icon` | Go-to-end icon. |
| `additional-menu` | Application-owned Replay menu, such as the Replay FPS menu. |
| `add-clip-icon` | Clip-menu icon. |
| `add-clip-label` | Clip-menu label. |

```html
<lgs1920-timeline>
    <wa-icon slot="play-icon" name="circle-play" variant="solid" label=""></wa-icon>
    <wa-icon slot="pause-icon" name="circle-pause" variant="solid" label=""></wa-icon>
    <wa-icon slot="start-icon" name="backward-step" variant="solid" label=""></wa-icon>
    <wa-icon slot="stop-icon" name="stop" variant="solid" label=""></wa-icon>
    <wa-icon slot="end-icon" name="forward-step" variant="solid" label=""></wa-icon>
</lgs1920-timeline>
```

### Track slots

Each track has a legend area and a right-aligned action area. The action area
supports the `drag-trigger`, `visibility`, and `actions` slots.

| Global slot | Targeted slot | Description |
| --- | --- | --- |
| `track-label` or `name` | `track-label-{trackId}` or `name-{trackId}` | Track name content. |
| `drag-trigger` | `drag-trigger-{trackId}` | Drag handle content. |
| `visibility` | `visibility-{trackId}` | Visibility control content. |
| `actions` | `actions-{trackId}` | Reserved track-specific actions. |

```html
<lgs1920-timeline>
    <span slot="name-camera#main">Main camera</span>
    <wa-icon slot="drag-trigger-camera#main" name="grip-lines-vertical" variant="solid" label=""></wa-icon>
    <wa-button slot="actions-camera#main" appearance="plain" size="s" aria-label="Track settings">
        <wa-icon name="gear" variant="solid" label=""></wa-icon>
    </wa-button>
</lgs1920-timeline>
```

### Clip slots

| Global slot | Targeted slot | Description |
| --- | --- | --- |
| `clip-icon` | `clip-icon-{clipId}` | Clip icon. |
| `clip-label` | `clip-label-{clipId}` | Clip label. |
| `clip-content` | `clip-content-{clipId}` | Complete clip content. |
| `clip-start-handle` | `clip-start-handle-{clipId}` | Start resize handle content. |
| `clip-end-handle` | `clip-end-handle-{clipId}` | End resize handle content. |

Clip content can be arbitrary HTML or Web Awesome components:

```html
<lgs1920-timeline>
    <template slot="clip-content">
        <span class="clip-card">
            <wa-icon name="film" variant="solid" label=""></wa-icon>
            <strong>Opening clip</strong>
        </span>
    </template>
</lgs1920-timeline>
```

For the clip id `intro#001`, the targeted content slot is
`clip-content-intro#001`. The `#` separator is preserved in slot names.

The video range handles can be customized with the global
`timeline-start-handle` and `timeline-end-handle` slots.

The start and end handles can be dragged along the ruler when `editable` is
enabled. Double-clicking the start handle moves it to `0`; double-clicking the
end handle moves it to `durationMillis`. The handles never cross and the
playhead keeps its position while it remains between the handles and moves to
the new boundary only when it would otherwise fall outside the selected range.

The playhead grip can also be dragged within the selected range. When the
playhead has keyboard focus, `ArrowLeft` and `ArrowRight` move it by
`keyboardStepSeconds` (or ten times that amount with `Shift`). `Alt+ArrowRight`
moves it to the range minimum and `Alt+ArrowLeft` moves it to the range
maximum.

When a range handle has keyboard focus, `ArrowLeft` and `ArrowRight` move the
selected boundary by `keyboardStepSeconds`; `Shift` multiplies the step by ten.
When a clip resize handle has focus, the same keys resize the corresponding
clip edge with the same step rules. The split-panel divider is a native
Web Awesome separator: its horizontal arrow keys resize the track legend,
`Shift` changes the step, `Home` and `End` select the minimum and maximum, and
`Enter` collapses or restores the panel.

When the time surface has focus, plain wheel scrolling remains native. `Shift`
or `Alt` plus the wheel changes the track row height by 4 pixels, from 24 to 64 pixels.
`Meta` (Command on macOS, Super/Windows on Linux and Windows) plus the wheel
changes the ruler zoom by 20 percent. Unmodified arrow keys change the row
height vertically and the ruler zoom horizontally. `Ctrl` plus the wheel is
left untouched so the browser can keep its own zoom behavior. The containing
widget can also enable these arrow-key shortcuts while selected with
`keyboardZoomActive`. The ruler has no secondary ticks while zoomed out, uses
200 ms secondary ticks at normal zoom, and uses 100 ms secondary ticks at high
zoom. The minimum horizontal zoom adapts to the available surface width so the
complete timeline can fit without horizontal scrolling, with a small right
safety margin.

## Track names and controlled editing

Double-click an editable track name to open the inline Web Awesome input.
Press `Enter` or leave the input to commit the name; press `Escape` to cancel.

The component emits the new name and a serializable public snapshot. The host
stores the updated track definition and passes the new `tracks` array back.

```js
timeline.addEventListener('lgs1920-timeline-track-label-change', event => {
    const {trackId, label} = event.detail
    tracks = tracks.map(track => track.id === trackId ? {...track, label} : track)
    timeline.tracks = tracks
})
```

The same controlled flow applies to track visibility, clip visibility, and
track reordering. Clips belonging to a hidden track remain represented in the
timeline with their original palette softened by a lighter diagonal hatch;
they are not interactive until the track is shown again.

## Clip and track editing

The timeline supports controlled clip editing. The component renders a start
and end handle on every resizable clip, moves clips horizontally when their
body is dragged, and accepts a clip on another compatible track while it is
being dragged. The target track is highlighted during the gesture.

Clip movement preserves its duration. Resizing the start handle changes
`start` while keeping `end` stable. Resizing the end handle changes `end` while
keeping `start` stable. Both handles respect the timeline bounds and the
configured minimum duration.

Track collision behavior is selected with `collisionPolicy`:

| Policy | Behavior |
| --- | --- |
| `allow` | Clips may overlap. Use only when overlap is explicitly required. |
| `prevent` | Clips cannot overlap. A moved or inserted clip is fitted to the available gap; a resize stops at the neighboring clip. |
| `ripple` | Overlapping clips and subsequent clips are shifted to the right while their durations are preserved. |

While a clip is dragged over an occupied or otherwise invalid drop zone, it
continues following the pointer and displays the `not-allowed` cursor. The
invalid position is not committed on release.

With `durationPolicy: 'extend'`, a ripple edit can increase the timeline
duration. The committed event contains the resulting `durationMillis` and the
complete `tracks` snapshot. With `durationPolicy: 'fixed'`, an edit that would
leave the timeline bounds is rejected.

Track reordering starts from the `drag-trigger` slot or anywhere in the track
name area. The title area and the time surface follow the same row order. The
dragged row silhouette and the translucent source placeholder show the drop
position. Locked rows cannot
be crossed: insertion is rejected before a locked first row, after a locked
last row, or between two locked rows. The committed `reorder` event contains
the new `tracks` order and `dropIndex`. While the pointer is over a rejected
locked boundary, the dragged row silhouette uses the Web Awesome `danger`
colors, follows the pointer in both panes, and remains at its last valid
position while a translucent placeholder preserves the source slot. A valid
position uses the Web Awesome `success` colors.

The component emits `before-drag`, `drag`, and `after-drag` for movable tracks
and clips. Each detail contains a `context` with the requested public shape:
`{type: 'piste', pisteId}` for a track and
`{type: 'clip', pisteId, clipId}` for a clip. The detail also contains the
triggering event and the current serializable `data` snapshot. `after-drag`
adds `committed`, which is `false` for a cancelled or rejected clip move.

The component emits `clip-change-start` when an edit begins, `clip-changing`
for live previews, and `clip-change` when the pointer or keyboard edit is
committed. The host applies the resulting `tracks` value to keep the model
controlled.

## Events

The component emits composed, bubbling custom events using the
`lgs1920-timeline-` namespace. The event suffix follows Web Awesome-style
lowercase kebab-case names. The React wrapper maps each suffix to the
corresponding `on...` callback.

| Event suffix | DOM event | React callback | Detail |
| --- | --- | --- | --- |
| `play` | `lgs1920-timeline-play` | `onPlay` | `{source, timeMillis, event}` |
| `pause` | `lgs1920-timeline-pause` | `onPause` | `{source, timeMillis, event}` |
| `stop` | `lgs1920-timeline-stop` | `onStop` | `{timeMillis, source, event}` |
| `restart` | `lgs1920-timeline-restart` | `onRestart` | `{timeMillis, progress, settled, source, event}` |
| `seek` | `lgs1920-timeline-seek` | `onSeek` | `{timeMillis, progress, settled, source, event, ...}` |
| `track-visibility-change` | `lgs1920-timeline-track-visibility-change` | `onTrackVisibilityChange` | `{trackId, visible, track, event, data}` |
| `track-label-change` | `lgs1920-timeline-track-label-change` | `onTrackLabelChange` | `{trackId, label, previousLabel, tracks, data}` |
| `dblclick` | `lgs1920-timeline-dblclick` | `onDblClick` | `{clip, context, event}` |
| `add-clip` | `lgs1920-timeline-add-clip` | `onAddClip` | `{group, key, option, clip, trackId, durationMillis, tracks}` |
| `clip-change-start` | `lgs1920-timeline-clip-change-start` | `onClipChangeStart` | `{type, edge, clipId, fromTrackId, toTrackId, clip, durationMillis, tracks}` |
| `clip-changing` | `lgs1920-timeline-clip-changing` | `onClipChanging` | `{type, edge, clipId, fromTrackId, toTrackId, clip, durationMillis, tracks}` |
| `clip-change` | `lgs1920-timeline-clip-change` | `onClipChange` | `{type, edge, clipId, fromTrackId, toTrackId, clip, durationMillis, tracks}` |
| `before-drag` | `lgs1920-timeline-before-drag` | `onBeforeDrag` | `{context, event, data}` |
| `drag` | `lgs1920-timeline-drag` | `onDrag` | `{context, event, data}` |
| `after-drag` | `lgs1920-timeline-after-drag` | `onAfterDrag` | `{context, committed, event, data}` |
| `range-change-start` | `lgs1920-timeline-range-change-start` | `onRangeChangeStart` | `{rangeStartMillis, rangeEndMillis, durationMillis, event}` |
| `range-changing` | `lgs1920-timeline-range-changing` | `onRangeChanging` | `{rangeStartMillis, rangeEndMillis, durationMillis, event}` |
| `range-change` | `lgs1920-timeline-range-change` | `onRangeChange` | `{rangeStartMillis, rangeEndMillis, durationMillis, event}` |
| `reorder` | `lgs1920-timeline-reorder` | `onReorder` | `{trackIds, tracks, dropIndex}` |

```js
timeline.addEventListener('lgs1920-timeline-seek', event => {
    timeline.currentTimeMillis = event.detail.timeMillis
})

timeline.addEventListener('lgs1920-timeline-dblclick', event => {
    console.log(event.detail.clip)
})
```

The React equivalent uses the event suffix directly in the callback name:

```jsx
<LGS1920TimelineReact
    timeline={timelineConfig}
    tracks={tracks}
    currentTimeMillis={currentTimeMillis}
    onSeek={detail => setCurrentTimeMillis(detail.timeMillis)}
    onDblClick={detail => console.log(detail.clip)}
    onClipChange={detail => onTracksChange(detail.tracks)}
    onTrackLabelChange={handleTrackLabelChange}
/>
```

## CSS customization

The component exposes `--lgs-timeline-*` custom properties and CSS parts. Each
property can be set on the host and can reference Web Awesome design tokens.

```css
lgs1920-timeline {
    --lgs-timeline-padding: 1rem;
    --lgs-timeline-background: color-mix(in oklab, #102033 92%, transparent);
    --lgs-timeline-surface-color: #132941;
    --lgs-timeline-playhead-color: #ffb000;
    --lgs-timeline-row-height: 28px;
}

lgs1920-timeline::part(clip) {
    letter-spacing: 0.02em;
}
```

| Custom property | Purpose |
| --- | --- |
| `--lgs-timeline-background` | Outer timeline background. |
| `--lgs-timeline-text-color` | Normal text color. |
| `--lgs-timeline-quiet-text-color` | Ruler and playback text color. |
| `--lgs-timeline-border-color` | Normal border color. |
| `--lgs-timeline-quiet-border-color` | Grid and track border color. |
| `--lgs-timeline-surface-color` | Legend and clip surface color. |
| `--lgs-timeline-padding` | Outer padding. |
| `--lgs-timeline-radius` | Outer corner radius. |
| `--lgs-timeline-shadow` | Outer shadow. |
| `--lgs-timeline-gap` | Header and top-section gap. |
| `--lgs-timeline-header-height` | Header and ruler height. |
| `--lgs-timeline-min-width` | Minimum host and layout width. |
| `--lgs-timeline-min-height` | Minimum host and layout height. |
| `--lgs-timeline-layout-min-height` | Minimum inner layout height. |
| `--lgs-timeline-scrollbar-height` | Horizontal scrollbar allowance. |
| `--lgs-timeline-scrollbar-size` | LGS scrollbar rail thickness. |
| `--lgs-timeline-scrollbar-thumb-min-size` | Minimum LGS scrollbar thumb size. |
| `--lgs-timeline-scrollbar-auto-hide-delay` | Inactivity timeout before rails hide. Defaults to `1s`, matching `LGSScrollbars`. |
| `--lgs-timeline-scrollbar-auto-hide-duration` | Fade duration. Defaults to `200ms`, matching `LGSScrollbars`. |
| `--lgs-timeline-scrollbar-track-color` | LGS scrollbar rail color. |
| `--lgs-timeline-scrollbar-thumb-color` | LGS scrollbar thumb color. |
| `--lgs-timeline-resizer-width` | Web Awesome split-panel divider width. |
| `--lgs-timeline-resizer-hit-area` | Web Awesome split-panel divider hit area. |
| `--lgs-timeline-row-height` | Minimum track row height. |
| `--lgs-timeline-scale-width` | Ruler pixels per major unit. |
| `--lgs-timeline-min-visible-duration` | Minimum duration represented by the initial timeline viewport. |
| `--lgs-timeline-scale-offset` | Ruler left offset. |
| `--lgs-timeline-major-tick-height` | Major ruler tick height. |
| `--lgs-timeline-minor-tick-height` | Minor ruler tick height. |
| `--lgs-timeline-handle-cap-height` | Height of the start, end, and playhead caps. |
| `--lgs-timeline-handle-cap-top` | Top offset of the caps relative to the ruler. |
| `--lgs-timeline-handle-cap-width` | Width of the start, end, and playhead caps. |
| `--lgs-timeline-handle-point-size` | Size of the rounded bottom point. |
| `--lgs-timeline-handle-icon-color` | Default grip icon color. |
| `--lgs-timeline-playhead-color` | Playhead color. Defaults to the Web Awesome blue 70 palette token. |
| `--lgs-timeline-playhead-width` | Playhead width. |
| `--lgs-timeline-end-marker-color` | End marker color. |
| `--lgs-timeline-range-handle-width` | Video range handle width. |
| `--lgs-timeline-range-handle-color` | Video range handle color. |
| `--lgs-timeline-range-end-color` | Video range end handle color. |
| `--lgs-timeline-range-handle-focus-ring` | Video range handle focus ring. |
| `--lgs-timeline-clip-padding` | Clip horizontal padding. |
| `--lgs-timeline-clip-min-width` | Minimum clip width. |
| `--lgs-timeline-clip-handle-width` | Clip resize handle width. |
| `--lgs-timeline-clip-handle-color` | Clip resize handle color. |
| `--lgs-timeline-clip-handle-hover-color` | Clip resize handle hover color. |
| `--lgs-timeline-clip-handle-focus-ring` | Clip resize handle focus ring. |
| `--lgs-timeline-track-drop-indicator-color` | Drag-target accent color used by track and clip feedback. |
| `--lgs-timeline-popup-background` | Popup background. |
| `--lgs-timeline-popup-border-color` | Popup border color. |
| `--lgs-timeline-popup-shadow` | Popup shadow. |

Useful CSS parts include `timeline`, `top`, `header`, `controls`, `header-actions`,
`playback-controls`,
`layout`, `legend`, `legend-viewport`, `legend-rows`,
`legend-row`, `legend-content`, `track-actions`, `split-panel`,
`surface`, `canvas`, `ruler`, `tick`, `minor-tick`, `tracks`, `track`, `clip`,
`tracks-viewport`,
`clip-preview`, `clip-start-handle`, `clip-end-handle`, `timeline-start-handle`,
`timeline-end-handle`, `playhead`, `end-marker`,
`scroll-shell`, `scrollbar-track`, `scrollbar-thumb`,
`popup` and `menu`.

The track surface exposes an LGS-style horizontal rail and a vertical rail for
the tracks viewport. The time ruler remains fixed on the vertical axis. The
title column exposes its own vertical rail, and both vertical views are
synchronized bidirectionally so titles and tracks stay aligned while scrolling.

## Methods

The controlled properties and events cover normal integration. The component
also provides these small imperative helpers:

| Method | Description |
| --- | --- |
| `setTime(timeMillis)` | Move the playhead without emitting `seek`. |
| `setZoom(zoomPercent)` | Set the ruler zoom up to `500`; the minimum is calculated from the available surface width, full timeline duration, and right safety margin. |
| `handleResize()` | Recompute surface dimensions after an external resize. |
| `setScrollbarsInteractionActive(active)` | Keep custom rails visible during an external drag or resize gesture. |
| `setExternalInteractionActive(active)` | Preserve an active external mouse, pointer, or touch gesture when it crosses the timeline host. |

## Accessibility

The host is a labelled `region`, playback controls use Web Awesome buttons,
the time surface is keyboard focusable, the Web Awesome split-panel exposes an
accessible divider, and generated tracks and clips expose accessible labels. Decorative
slotted icons should use `label=""` and receive visible or semantic text from
their matching label slot.
