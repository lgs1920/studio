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
  describe the canonical frame clock used by frame navigation.
- `clipOptions` supplies entries for the clip menu. Leave it null to expose the
  generic `Clip` option; set it to an empty array to show an empty menu.

During its initial mount, the component covers the timeline before its first
layout with an opaque themed overlay and a Web Awesome paintbrush using the
`wag` animation. The `overlay-text` slot customizes its label and falls back to
`Building...`. Set `timeline.showBuildingOverlay` to `false` to disable the
overlay. When enabled, it is removed after the layout settles and is never
shown again for updates or interactions.

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
    legendMinWidth: 50,
    legendWidth: 150,
    legendMaxWidth: 250,
    rangeStartMillis: 0,
    rangeEndMillis: 60_000,
    editable: true,
    showBuildingOverlay: true,
    showClipMenu: true,
    collisionPolicy: 'prevent',
    resizeCollisionPolicy: 'prevent',
    resizeExtendsDuration: true,
    durationPolicy: 'extend',
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
| `fps` | `number` | Canonical frame rate used by frame navigation. Defaults to `30`. |
| `frameCount` | `number` | Canonical frame count. Used to clamp previous/next frame requests. |
| `frameIntervalMillis` | `number` | Canonical interval between frames. Defaults to `1000 / fps`. |
| `currentFrameIndex` | `number` | Currently published absolute frame index. |
| `rangeStartMillis` | `number` | Video range start in milliseconds. Defaults to `0`. |
| `rangeEndMillis` | `number` | Video range end in milliseconds. Defaults to `durationMillis`. |
| `visible` | `boolean` | Controls timeline visibility. Defaults to `true`. |
| `zoomPercent` | `number` | Initial ruler zoom up to `500`; the minimum is calculated from the available surface width, full timeline duration, and right safety margin. |
| `legendMinWidth` | `number` | Minimum track legend width in pixels. Defaults to `50`. |
| `legendWidth` | `number` | Initial track legend width in pixels. Defaults to `150`. |
| `legendMaxWidth` | `number` | Maximum track legend width in pixels. Defaults to `250`. |
| `editable` | `boolean` | Enables all timeline editing actions: track dragging, title editing, clip insertion and movement, and track removal. When `false`, those actions are unavailable. Defaults to `true`. |
| `interactive` | `boolean` | Enables playback, scrubbing, editing, menus, and emitted interaction events. Defaults to `true`. |
| `showBuildingOverlay` | `boolean` | Shows the construction overlay during the initial mount. Defaults to `true`. |
| `collisionPolicy` | `'allow' \| 'prevent' \| 'ripple'` | Default clip collision policy for tracks. Defaults to `prevent`. |
| `resizeCollisionPolicy` | `'allow' \| 'prevent' \| 'ripple'` | Default collision policy for clip resizes. Defaults to `prevent`. |
| `snapThresholdPixels` | `number` | Distance from a ruler or clip edge at which snapping starts. Defaults to `8`. |
| `snapReleaseThresholdPixels` | `number` | Distance at which an active snap is released. Defaults to the start threshold plus four pixels. |
| `resizeExtendsDuration` | `boolean` | Allows an end resize to increase the timeline duration when it reaches the current end. Defaults to `true`. Set to `false` to keep the duration fixed for end resizes. |
| `durationPolicy` | `'fixed' \| 'extend'` | Keeps the duration fixed or extends it when an edit exceeds the end. Defaults to `extend`. |
| `keyboardZoomActive` | `boolean` | Enables arrow-key zoom when the containing widget is selected. Defaults to `false`. |
| `hostInteraction` | `'selectable'` | Allows the embedding host to receive the timeline's selection and drag input. Omit it to keep input local to the component. |
| `hostNoDragClass` | `string` | Optional class supplied by the embedding host and applied to clips and editable track rows so the host can exclude them from its own drag handling. |
| `swatches` | `Array<{color, label, palette}>` | Color choices for the clip color menu. Defaults to the ten Web Awesome neutral palette colors. Pass an empty array to hide the color action. |
| `showClipMenu` | `boolean` | Displays the optional clip creation action. Defaults to `false`. |
| `clipActions` | `Array<{key, label, icon?, variant?, disabled?}>` | Adds application-defined actions to every editable clip context menu. The action emits the `clip-action` event and is configured globally on the timeline. `clipContextMenuActions` is accepted as a compatibility alias. |
| `defaultTrackId` | `string` | Track used when a clip-menu option does not specify a track. |
| `minClipDuration` | `number` | Default minimum clip duration in seconds. Defaults to one frame at `fps`. |
| `defaultClipDuration` | `number` | Default duration for a clip-menu insertion in seconds. Defaults to `1`. |
| `keyboardStepSeconds` | `number` | Keyboard resize step in seconds. Defaults to `0.1`. |
| `addTrackLabel` | `string` | Track creation button label. Defaults to `Add track`. |
| `addTrackIcon` | `string` | Track creation button icon. Defaults to `plus`. |

### `tracks`

`tracks` is an array of track definitions:

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable track identifier. `#` is used as the slot identifier separator. |
| `label` | `string` | Track name shown in the legend. |
| `colorClasses` | `string[]` | Web Awesome color classes. |
| `visible` | `boolean` | Track visibility state. |
| `canHide` | `boolean` | Enables the track visibility action. |
| `editable` | `boolean` | Enables drag, title editing, clip insertion/movement/resizing, and removal for this track. Defaults to `true`. |
| `autoNumbered` | `boolean` | Internal marker preserved on tracks created by the generic add action so numbering can restart after all generated tracks are renamed or removed. |
| `droppable` | `boolean` | Allows clips to be moved or inserted on the track. Defaults to `true`. |
| `accepts` | `string[]` | Clip kinds accepted by the track. An empty value accepts every kind. |
| `collisionPolicy` | `'allow' \| 'prevent' \| 'ripple'` | Collision behavior for clip edits on this track. |
| `resizeCollisionPolicy` | `'allow' \| 'prevent' \| 'ripple'` | Collision behavior for clip resizes on this track. Defaults to `prevent`. |
| `minClipDuration` | `number` | Minimum duration applied to clips on this track, in seconds. |
| `clips` | `array` | Clips displayed on the track. |

The track removal action is displayed only for editable tracks that contain no
clips. A track with clips must be emptied before it can be removed.

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
| `enabled` | `boolean` | Whether the clip participates in timeline playback. Defaults to `true`. |
| `editable` | `boolean` | Enables movement and resizing for this clip. Defaults to `true`. |
| `resizable` | `boolean` | Enables the start and end handles. Defaults to `true`. |
| `minDuration` | `number` | Minimum clip duration in seconds. |
| `metadata` | `object` | Optional application metadata. |

### `currentTimeMillis`

The controlled playhead position in milliseconds.

### `playing`

The controlled playback state. The component emits `play` and `pause`; the
host updates this property after applying the requested state.

The icon transport controls are, in order, go to start, previous frame,
play/pause, stop, next frame, and go to end. The component emits the transport
request but does not advance the application's clock itself. They use the Web Awesome
`brand` variant with `plain` appearance. Previous and
next frame details contain `frameIndex`, `frameCount`,
`frameIntervalMillis`, `timeMillis`, `progress`, `settled`, and a `source`
value of `step-backward` or `step-forward`. The start and end controls use
`restart` or `seek` with `source` set to `go-to-start` or `go-to-end`.
The transport is an accessible toolbar of independent buttons, not a Web
Awesome button group.

The header provides two icon-only view buttons with Web Awesome tooltips while
the timeline is interactive:

- `Fit entire timeline horizontally` toggles between the normal horizontal
  zoom and the lowest zoom that displays the complete duration.
- `Show maximum tracks` toggles with `Maximize track size`, using the minimum
  row height to show as many tracks as possible or the maximum row height.

These commands only change the transient timeline view and do not modify the
controlled projection.

The header places the view tools on the left, an application-owned menu in the
center, and the transport controls on the right. The application-owned menu
must be provided through the `custom-menu` slot. The Web Component only
exposes the controlled `fps` value used for frame navigation; it does not
modify the application's frame rate or emit an FPS-change event.

### `clipOptions`

Options displayed by the clip insertion menu. Each option can contain
`group`, `key`, `label`, `icon`, `kind`, `trackId`, `start`, `end`, `duration`,
and a `clip` object containing application fields to copy to the inserted clip.
When `clipOptions` is null, the menu exposes one generic `Clip` option. Every
option can be dragged from the menu and dropped on a compatible editable track;
the drop position becomes the clip start instead of the current playhead. The
component always assigns an unused clip identifier when an insertion option
reuses an existing identifier.

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
| `additional-content` | Application content displayed in an expandable `wa-drawer` above the header. |
| `additional-content-label` | Accessible label associated with the additional-content drawer. |
| `header` | Header content displayed in the left header area. |
| `custom-menu` | Application-owned menu displayed in the center of the header. |
| `header-actions` | Application actions such as settings, help, or host controls. |
| `timeline-actions` | Application actions such as recording or exporting video. |
| `playback-start` | Content before the current time. |
| `playback-current` | Current-time label. |
| `playback-separator` | Separator between current and total time. |
| `playback-total` | Total-time label. |
| `playback-end` | Content after the total time. |
| `timeline-toolbar` | Toolbar content beside the clip menu. |
| `legend-ruler` | Replacement content for the title-column ruler area. The default fallback contains `timeline-toolbar`, the direct track button, and the optional clip-menu button. |
| `timeline-ruler` | Additional content over the time ruler. |
| `overlay-text` | Initial construction-overlay label. Falls back to `Building...`. |
| `footer` | Content below the timeline layout. |
| `empty-state` | Content displayed when the clip menu has no options. |

```html
<lgs1920-timeline>
    <span slot="additional-content-label">Timeline settings</span>
    <div slot="additional-content">
        <wa-badge variant="success">Ready</wa-badge>
    </div>
    <h2 slot="header">Sequence</h2>
    <span slot="overlay-text">Preparing timeline...</span>
    <wa-button slot="custom-menu" variant="brand" appearance="plain" data-additional-content-toggle>Video settings</wa-button>
    <span slot="playback-separator"> of </span>
    <wa-button slot="header-actions" appearance="plain">Settings</wa-button>
    <wa-button slot="timeline-actions" variant="brand">Record video</wa-button>
    <wa-button slot="timeline-toolbar" appearance="plain">Markers</wa-button>
</lgs1920-timeline>
```

The additional-content drawer has no built-in close button. Add an application
owned control to `custom-menu` with the `data-additional-content-toggle`
attribute to open and close it from the timeline header. The timeline keeps
that control's `aria-expanded` and `aria-controls` attributes synchronized.

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
| `add-clip-icon` | Clip-menu icon. |
| `add-clip-label` | Clip-menu label. |
| `add-track-icon` | Track-menu icon. |
| `add-track-label` | Track-menu label. |

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

Each track has a legend area and a right-aligned action area. Track reordering
starts from the legend area itself; the action area supports the `visibility`,
`remove`, and `actions` slots.

| Global slot | Targeted slot | Description |
| --- | --- | --- |
| `track-label` or `name` | `track-label-{trackId}` or `name-{trackId}` | Track name content. |
| `visibility` | `visibility-{trackId}` | Visibility control content. |
| `remove` | `remove-{trackId}` | Remove action content. |
| `actions` | `actions-{trackId}` | Reserved track-specific actions. |

```html
<lgs1920-timeline>
    <span slot="name-camera#main">Main camera</span>
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
`keyboardZoomActive`. The ruler always renders secondary ticks: it uses five
subdivisions per major unit below 80 pixels per second and ten subdivisions at
higher zoom. The minimum horizontal zoom adapts to the available surface width
so the complete timeline can fit without horizontal scrolling, with a small
right safety margin.

## Track names and controlled editing

When both the timeline and track `editable` flags are enabled, double-click a
track name to open the inline Web Awesome input. Press `Enter` or leave the
input to commit the name; press `Escape` to cancel.

Double-clicking a clip has no default editing behavior. Web Component users can
listen for `lgs1920-timeline-dblclick` to trigger an application action such as
opening clip editing. The `before-dblclick` and `after-dblclick` lifecycle events
remain available for cancelable and completion handling.

The component emits the new name and a serializable public snapshot. The host
stores the updated track definition and passes the new `tracks` array back.

```js
timeline.addEventListener('lgs1920-timeline-after-track-label-change', event => {
    const {trackId, label} = event.detail
    tracks = tracks.map(track => track.id === trackId ? {...track, label} : track)
    timeline.tracks = tracks
})
```

The same controlled flow applies to track visibility, clip visibility, and
track reordering. Clips belonging to a hidden track remain represented in the
timeline with their original palette muted through grayscale and opacity. A
hidden track keeps its title in a disabled visual state and cannot open title
editing, while its clips remain editable when their `editable` flags allow it.
Set `editable: false` on the track or clip to lock editing. A hidden track also
displays one continuous flat grey tint behind the clips. Read-only tracks use
the corresponding flat branded red tint.

## Clip and track editing

The timeline supports controlled clip editing. The component renders a start
and end handle on every resizable clip, moves clips horizontally when their
body is dragged, and accepts a clip on another compatible track while it is
being dragged. A clip is selected by clicking it or starting its drag, and the
selection stays inside the timeline. Read-only clips on locked tracks remain
selectable, but their editing actions stay disabled. Clicking the selected clip without moving
deselects it, while dragging keeps it selected. The selected clip receives a
normal 2px dashed border in the clip text color and keyboard focus. Clip options from the insertion menu can also be
dragged onto a track. The target track is highlighted during the gesture. The
context menu does not expose `Extend max` when `resizable` is `false`.

Clip movement preserves its duration and shows a diamond centered on each
endpoint of the ruler's lower border while the clip is being moved; each marker
protrudes halfway into the track area. Resizing the start handle changes
`start` while keeping `end` stable. Resizing the end handle changes `end` while
keeping `start` stable. Both handles respect the timeline bounds and the
configured minimum duration.

During a clip move, the source position remains visible as a faint ghost and
the proposed placement follows the pointer. A valid placement uses a
translucent Web Awesome success color; a rejected placement uses the
corresponding danger color.

While a clip edge is being resized, a blue diamond follows the edge's current
time position centered on the ruler's lower border. It is transient and
disappears when the gesture ends or is cancelled.

During pointer movement and resizing, the edited clip edge snaps to the nearest
major ruler unit when it enters the configured magnetic threshold. Nearby clip
boundaries on any track and the playhead take precedence over ruler ticks. Holding
`Shift` while moving or resizing a clip uses the currently rendered secondary
ruler units instead. A clip move uses whichever of its two edges is closest, so
the duration remains unchanged when the clip stays on its current track or is
moved to another compatible track. The moving ghost follows the pointer freely
vertically while its horizontal position follows the magnetic alignment. A
vertical alignment guide identifies the target clip edge during the gesture and
remains visible for two seconds after release. Set `snap: false` on the timeline
configuration to disable this behavior. Hold `Alt` during the gesture to bypass
all magnets temporarily. Once a snap is acquired, it remains magnetized until
the clip passes `snapReleaseThresholdPixels`, which prevents jitter at the
boundary. `Escape` cancels an active drag or resize and restores
the original clips, duration, and playback range.

An editable clip can be focused and removed with `Delete` or `Backspace`. A clip
drag starts only after the pointer moves beyond the click tolerance, so holding
a clip without moving it does not start a drag. On touch devices, a stationary
long press can still open the clip context menu. Press
`Mod+C` to create an accentuated copy-placement ghost under the source clip,
shifted half a clip height down and to the left. Move the pointer to the
desired track and time, then press the primary pointer button to commit it;
`Escape`, a click outside the timeline, or a secondary-button/context-menu
gesture cancels the placement. `M` masks the focused
clip. `Mod+D` remains available as an immediate duplicate alias, while `V` toggles
the `enabled` state. Clicking a neutral area, track label, or empty track
deselects the clip; `Escape` also clears the selection. The context
menu provides Copy, Delete, Mask, Extend max, and any
actions configured through `timeline.clipActions`. A disabled clip remains
visible in the editor so it can be identified and re-enabled. `Space` toggles
local playback when the time surface has focus, while `Home` and `End` move the
local playhead to the selected range boundaries. These keyboard actions update
the component projection and emit their normal lifecycle events; an embedding
application decides whether to connect those events to playback or persistence.

Custom context actions use the following shape:

```js
timeline.timeline = {
    ...timeline.timeline,
    clipActions: [
        {key: 'split', label: 'Split', icon: 'scissors'},
        {key: 'open-editor', label: 'Open editor', icon: 'pen-to-square'},
    ],
}

timeline.addEventListener('lgs1920-timeline-clip-action', event => {
    if (event.detail.key === 'split') openClipEditor(event.detail.clip)
})
```

The component first emits the cancelable `before-remove-clip` event. Calling
`event.preventDefault()` from an external listener keeps the clip in place,
which allows an application to display an asynchronous confirmation dialog.
After confirmation, the application can apply `event.detail.tracks` to the
controlled `tracks` property. If the request is not cancelled, the component
removes the clip and emits `remove-clip`, followed by `after-remove-clip`, with
the removed clip and the updated track snapshot.

Track collision behavior for movement and insertion is selected with
`collisionPolicy`; resize behavior is selected independently with
`resizeCollisionPolicy`. With the default `prevent` policy, clips never
overlap. A moved or inserted clip must fit at its complete duration. A drop into a
smaller gap is rejected without trimming the clip or replacing existing content. A resize
stops at the neighboring clip and leaves that clip in place.

| Policy | Behavior |
| --- | --- |
| `allow` | Legacy alias for `prevent`; committed edits still reject overlaps. |
| `prevent` | Clips cannot overlap. A moved or inserted clip must fit completely in the available gap; a resize stops at the neighboring clip. |
| `ripple` | The inserted or moved clip stays at the requested time. Overlapping clips and subsequent clips shift right while preserving their durations. Read-only clips block ripples that would move them. |

Resize ripple shifts all clips on the same track on the edited side: a start
resize shifts clips to the left of the edited clip, while an end resize shifts
clips to its right. The clips keep their durations and relative spacing. The
`allow` value remains accepted for backwards compatibility and follows the
same no-overlap rule as `prevent`.

While a clip is dragged over an occupied or otherwise invalid drop zone, it
continues following the pointer and displays the `not-allowed` cursor. The
invalid position is not committed on release. Releasing in a forbidden track,
outside the tracks, or in an occupied interval restores the complete pre-gesture
state, even after an earlier valid preview. The final pointer position determines
the drop, and another pointer cannot end the gesture.

An end resize or a move to the right can increase the total duration when it
reaches the current end; the committed event contains the resulting
`durationMillis` and the complete `tracks` snapshot. Set
`resizeExtendsDuration: false` to reject an end-resize extension.
`durationPolicy: 'extend'` is the default. Explicit `durationPolicy: 'fixed'`
prevents extension for every collision policy and insertion. Previously committed
extensions remain available during later edits and cancellations. A playback range
that covered the entire duration follows an extension; a deliberately shorter
range remains unchanged. Placement checks and vetoed insertions or keyboard
resizes never mutate the playback range.

During the resize preview, the ruler and every track surface grow with the
duration. Horizontal edge scrolling creates temporary workspace beyond the last
clip and continues while the pointer stays near the edge. Vertical edge scrolling
reveals tracks above and below the visible area. Scrolling speed depends on edge
proximity and elapsed frame time, with a bounded step after a delayed frame.
Temporary workspace is removed at the end of the gesture and is not included
in the emitted duration.

Track reordering starts from anywhere in the track name area when both
`editable` flags are enabled. Read-only tracks delimit the
editable area: an editable track cannot be dropped above the highest read-only
track, below the lowest read-only track, or into a gap with no editable slot.
The dragged row remains in place while a synchronized legend-and-timeline
ghost follows the pointer; a branded marker shows the proposed insertion
position and its valid or rejected state.
The committed `reorder` event contains the new `tracks` order and `dropIndex`.
Track drags scroll vertically near the viewport edges and resolve insertion
positions in scrolled content coordinates. Horizontal time scrolling is disabled
for track reordering.

The component emits `before-drag`, `drag`, and `after-drag` for tracks and
clips while `editable` is enabled. Each detail contains a `context` with the requested public shape:
`{type: 'track', trackId}` for a track and
`{type: 'clip', trackId, clipId}` for a clip. The detail also contains the
triggering event and the current serializable `data` snapshot. `after-drag`
adds `committed`, which is `false` for a cancelled or rejected clip move or
track reorder.

The component emits `clip-change-start` when an edit begins, `clip-changing`
for live previews, and `clip-change` when the pointer or keyboard edit is
committed. Clip drag events include `oldTimeline`, `newTimeline`,
`dragStart`, `drag`, `resizeEdge`, and the complete `tracks` snapshot. The
host applies the resulting `tracks` value to keep the model controlled. The
`after-clip-change` event includes `committed: false` when the gesture is
cancelled or rejected.

Controlled track updates preserve the local ruler zoom. A new explicit
`zoomPercent` value still changes the zoom, while applying the same controlled
configuration after a clip edit does not reset the user's current view.

When deleting clips from a grouped track leaves only one distinct widget, the
group is dissolved and that widget is displayed as a standalone track again.

## Events

The component emits composed, bubbling custom events using the
`lgs1920-timeline-` namespace. The event suffix follows Web Awesome-style
lowercase kebab-case names. Every completed user action follows the same
three-step lifecycle: a cancelable `before-*` event, the historical action
event, then an `after-*` completion event. Calling `preventDefault()` on a
`before-*` event cancels the action. The `*-changing` and `drag` events remain
live progress notifications between the lifecycle start and completion. The
React wrapper maps every suffix to the corresponding `on...` callback.

| Event suffix | DOM event | React callback | Detail |
| --- | --- | --- | --- |
| `before-play` | `lgs1920-timeline-before-play` | `onBeforePlay` | Cancelable `{source, timeMillis, event}` |
| `play` | `lgs1920-timeline-play` | `onPlay` | `{source, timeMillis, event}` |
| `after-play` | `lgs1920-timeline-after-play` | `onAfterPlay` | `{source, timeMillis, event}` |
| `before-pause` | `lgs1920-timeline-before-pause` | `onBeforePause` | Cancelable `{source, timeMillis, event}` |
| `pause` | `lgs1920-timeline-pause` | `onPause` | `{source, timeMillis, event}` |
| `after-pause` | `lgs1920-timeline-after-pause` | `onAfterPause` | `{source, timeMillis, event}` |
| `before-stop` | `lgs1920-timeline-before-stop` | `onBeforeStop` | Cancelable `{timeMillis, source, event}` |
| `stop` | `lgs1920-timeline-stop` | `onStop` | `{timeMillis, source, event}` |
| `after-stop` | `lgs1920-timeline-after-stop` | `onAfterStop` | `{timeMillis, source, event}` |
| `before-restart` | `lgs1920-timeline-before-restart` | `onBeforeRestart` | Cancelable `{timeMillis, progress, settled, source, event}` |
| `restart` | `lgs1920-timeline-restart` | `onRestart` | `{timeMillis, progress, settled, source, event}` |
| `after-restart` | `lgs1920-timeline-after-restart` | `onAfterRestart` | `{timeMillis, progress, settled, source, event}` |
| `before-seek` | `lgs1920-timeline-before-seek` | `onBeforeSeek` | Cancelable `{timeMillis, progress, settled, source, event, ...}` |
| `seek` | `lgs1920-timeline-seek` | `onSeek` | `{timeMillis, progress, settled, source, event, ...}` |
| `after-seek` | `lgs1920-timeline-after-seek` | `onAfterSeek` | `{timeMillis, progress, settled, source, event, ...}` |
| `before-track-visibility-change` | `lgs1920-timeline-before-track-visibility-change` | `onBeforeTrackVisibilityChange` | Cancelable `{trackId, visible, track, tracks, previousTracks, event, data}` |
| `track-visibility-change` | `lgs1920-timeline-track-visibility-change` | `onTrackVisibilityChange` | `{trackId, visible, track, event, data}` |
| `after-track-visibility-change` | `lgs1920-timeline-after-track-visibility-change` | `onAfterTrackVisibilityChange` | `{trackId, visible, track, tracks, previousTracks, event, data}` |
| `before-track-label-change` | `lgs1920-timeline-before-track-label-change` | `onBeforeTrackLabelChange` | Cancelable `{trackId, label, previousLabel, tracks, previousTracks, event, data}` |
| `track-label-change` | `lgs1920-timeline-track-label-change` | `onTrackLabelChange` | `{trackId, label, previousLabel, tracks, data}` |
| `after-track-label-change` | `lgs1920-timeline-after-track-label-change` | `onAfterTrackLabelChange` | `{trackId, label, previousLabel, tracks, previousTracks, event, data}` |
| `before-dblclick` | `lgs1920-timeline-before-dblclick` | `onBeforeDblClick` | Cancelable `{clip, context, event}` |
| `dblclick` | `lgs1920-timeline-dblclick` | `onDblClick` | `{clip, context, event}` |
| `after-dblclick` | `lgs1920-timeline-after-dblclick` | `onAfterDblClick` | `{clip, context, event}` |
| `before-add-clip` | `lgs1920-timeline-before-add-clip` | `onBeforeAddClip` | Cancelable `{group, key, option, clip, trackId, durationMillis, tracks, previousTracks, event, data}` |
| `add-clip` | `lgs1920-timeline-add-clip` | `onAddClip` | `{group, key, option, clip, trackId, durationMillis, tracks}` |
| `after-add-clip` | `lgs1920-timeline-after-add-clip` | `onAfterAddClip` | `{group, key, option, clip, trackId, durationMillis, tracks, previousTracks, event, data}` |
| `before-add-track` | `lgs1920-timeline-before-add-track` | `onBeforeAddTrack` | Cancelable `{track, trackId, tracks, previousTracks, event, data}` |
| `add-track` | `lgs1920-timeline-add-track` | `onAddTrack` | `{group, key, option, track, trackId, tracks, data}` |
| `after-add-track` | `lgs1920-timeline-after-add-track` | `onAfterAddTrack` | `{track, trackId, tracks, previousTracks, event, data}` |
| `before-remove-track` | `lgs1920-timeline-before-remove-track` | `onBeforeRemoveTrack` | Cancelable `{trackId, track, tracks, previousTracks, event, data}` |
| `remove-track` | `lgs1920-timeline-remove-track` | `onRemoveTrack` | `{trackId, track, tracks, event, data}` |
| `after-remove-track` | `lgs1920-timeline-after-remove-track` | `onAfterRemoveTrack` | `{trackId, track, tracks, previousTracks, event, data}` |
| `before-remove-clip` | `lgs1920-timeline-before-remove-clip` | `onBeforeRemoveClip` | Cancelable `{clipId, trackId, clip, tracks, previousTracks, event, data}` |
| `remove-clip` | `lgs1920-timeline-remove-clip` | `onRemoveClip` | `{clipId, trackId, clip, tracks, previousTracks, event, data}` |
| `after-remove-clip` | `lgs1920-timeline-after-remove-clip` | `onAfterRemoveClip` | `{clipId, trackId, clip, tracks, previousTracks, event, data}` |
| `before-clip-enabled-change` | `lgs1920-timeline-before-clip-enabled-change` | `onBeforeClipEnabledChange` | Cancelable `{clipId, trackId, enabled, clip, tracks, previousTracks, event, data}` |
| `clip-enabled-change` | `lgs1920-timeline-clip-enabled-change` | `onClipEnabledChange` | `{clipId, trackId, enabled, clip, tracks, previousTracks, event, data}` |
| `after-clip-enabled-change` | `lgs1920-timeline-after-clip-enabled-change` | `onAfterClipEnabledChange` | `{clipId, trackId, enabled, clip, tracks, previousTracks, event, data}` |
| `clip-select` | `lgs1920-timeline-clip-select` | `onClipSelect` | `{selected, clipId, trackId, clip, event, data}` |
| `before-clip-action` | `lgs1920-timeline-before-clip-action` | `onBeforeClipAction` | Cancelable `{action, key, clipId, trackId, clip, tracks, previousTracks, event, data}` |
| `clip-action` | `lgs1920-timeline-clip-action` | `onClipAction` | `{action, key, clipId, trackId, clip, tracks, previousTracks, event, data}` |
| `after-clip-action` | `lgs1920-timeline-after-clip-action` | `onAfterClipAction` | `{action, key, clipId, trackId, clip, tracks, previousTracks, event, data}` |
| `before-reorder` | `lgs1920-timeline-before-reorder` | `onBeforeReorder` | Cancelable `{trackIds, tracks, previousTracks, dropIndex, event, data}` |
| `reorder` | `lgs1920-timeline-reorder` | `onReorder` | `{trackIds, tracks, previousTracks, dropIndex, event, data}` |
| `after-reorder` | `lgs1920-timeline-after-reorder` | `onAfterReorder` | `{trackIds, tracks, previousTracks, dropIndex, committed, event, data}` |
| `before-clip-change` | `lgs1920-timeline-before-clip-change` | `onBeforeClipChange` | Cancelable clip edit detail |
| `clip-change-start` | `lgs1920-timeline-clip-change-start` | `onClipChangeStart` | `{type, edge, resizeEdge, clipId, oldTimeline, newTimeline, dragStart, drag, durationMillis, tracks}` |
| `clip-changing` | `lgs1920-timeline-clip-changing` | `onClipChanging` | `{type, edge, resizeEdge, clipId, oldTimeline, newTimeline, dragStart, drag, durationMillis, tracks}` |
| `clip-change` | `lgs1920-timeline-clip-change` | `onClipChange` | `{type, edge, resizeEdge, clipId, oldTimeline, newTimeline, dragStart, drag, durationMillis, tracks}` |
| `after-clip-change` | `lgs1920-timeline-after-clip-change` | `onAfterClipChange` | Clip edit detail with `committed` |
| `before-drag` | `lgs1920-timeline-before-drag` | `onBeforeDrag` | Cancelable `{context, type, edge, oldTimeline, newTimeline, dragStart, drag, event, data}` |
| `drag` | `lgs1920-timeline-drag` | `onDrag` | `{context, type, edge, oldTimeline, newTimeline, dragStart, drag, accepted, event, data}` |
| `after-drag` | `lgs1920-timeline-after-drag` | `onAfterDrag` | `{context, type, edge, oldTimeline, newTimeline, dragStart, drag, committed, event, data}` |
| `before-range-change` | `lgs1920-timeline-before-range-change` | `onBeforeRangeChange` | Cancelable `{rangeStartMillis, rangeEndMillis, durationMillis, event}` |
| `range-change-start` | `lgs1920-timeline-range-change-start` | `onRangeChangeStart` | `{rangeStartMillis, rangeEndMillis, durationMillis, event}` |
| `range-changing` | `lgs1920-timeline-range-changing` | `onRangeChanging` | `{rangeStartMillis, rangeEndMillis, durationMillis, event}` |
| `range-change` | `lgs1920-timeline-range-change` | `onRangeChange` | `{rangeStartMillis, rangeEndMillis, durationMillis, event}` |
| `after-range-change` | `lgs1920-timeline-after-range-change` | `onAfterRangeChange` | `{rangeStartMillis, rangeEndMillis, durationMillis, event}` |

```js
timeline.addEventListener('lgs1920-timeline-seek', event => {
    timeline.currentTimeMillis = event.detail.timeMillis
})

timeline.addEventListener('lgs1920-timeline-dblclick', event => {
    console.log(event.detail.clip)
})
```

The React wrapper keeps `onDblClick` for the lifecycle event and also exposes
`onClipDoubleClick` as the direct clip callback:

```jsx
<LGS1920TimelineReact
    timeline={timelineConfig}
    tracks={tracks}
    currentTimeMillis={currentTimeMillis}
    onSeek={detail => setCurrentTimeMillis(detail.timeMillis)}
    onClipDoubleClick={detail => console.log(detail.clip)}
    onAfterClipChange={detail => onTracksChange(detail.tracks)}
    onAfterTrackLabelChange={handleTrackLabelChange}
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
    --lgs-timeline-row-height: 24px;
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
| `--lgs-timeline-building-overlay-gap` | Space between the initial-overlay icon and text. |
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

Useful CSS parts include `timeline`, `additional-content`,
`additional-content-panel`, `building-overlay`,
`building-overlay-text`, `top`, `header`, `header-start`,
`custom-menu`, `controls`, `header-actions`, `playback-controls`,
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
