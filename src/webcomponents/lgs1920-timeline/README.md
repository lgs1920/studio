# LGS1920 Timeline

`lgs1920-timeline` is a standalone timeline Web Component compatible with Web
Awesome 3 and Font Awesome.

Its behavior is derived from `@xzdarcy/react-timeline-editor`, with the React
implementation transformed into standalone JavaScript and CSS for this custom
element.

## Installation

Import the module once before using the custom element:

```js
import '/src/webcomponents/lgs1920-timeline/LGS1920Timeline.js'
```

The module registers the `lgs1920-timeline` custom element and also exports the
`LGS1920Timeline` class.

## Basic usage

```html
<lgs1920-timeline id="timeline" aria-label="Timeline tracks"></lgs1920-timeline>
```

```js
const timeline = document.querySelector('#timeline')

timeline.setState({
    linkedPreparation: true,
    playing: false,
    currentTimeMillis: 3_500,
    projection: {
        durationMillis: 60_000,
        durationSeconds: 60,
        editorData: [
            {
                id: 'overview',
                label: 'Overview',
                icon: 'route',
                colorClasses: ['wa-neutral', 'wa-neutral-green'],
                fixed: true,
                movable: false,
                actions: [
                    {id: 'replay-start', kind: 'start', label: 'Start', start: 0, end: 1},
                ],
            },
            {
                id: 'map#main',
                label: 'Map',
                icon: 'map',
                colorClasses: ['wa-brand', 'wa-brand-blue'],
                canHide: true,
                visible: true,
                actions: [
                    {id: 'map-action', kind: 'widget', label: 'Map', start: 4, end: 18, widgetId: 'map#main'},
                ],
            },
        ],
    },
})
```

`editorData` may also be supplied at the top level when a projection object is
not needed.

## JSON and YAML data input

For simple hosts, the complete timeline can be supplied through the `data`
property as an object, JSON string, or YAML string. The same schema carries the
duration, current state, track labels, track icons, visibility, and timeline
items.

```js
timeline.data = {
    durationSeconds: 60,
    currentTimeMillis: 3_500,
    linkedPreparation: true,
    tracks: [
        {
            id: 'map#main',
            label: 'Journey map',
            icon: 'map',
            colorClasses: ['wa-brand', 'wa-brand-blue'],
            editable: true,
            visible: true,
            canHide: true,
            items: [
                {id: 'map-item', label: 'Map sequence', kind: 'widget', start: 4, end: 18},
            ],
        },
    ],
}
```

The equivalent JSON can be assigned directly:

```js
timeline.data = JSON.stringify({
    durationSeconds: 60,
    tracks: [
        {id: 'overview', label: 'Overview', items: [{id: 'start', kind: 'start', start: 0, end: 1}]},
    ],
})
```

YAML is also accepted. The parser automatically detects JSON or YAML, or it
can be selected explicitly with `dataFormat` or `data-format`.

```yaml
durationSeconds: 60
linkedPreparation: true
tracks:
  - id: map#main
    label: Journey map
    icon: map
    editable: true
    items:
      - id: map-item
        label: Map sequence
        kind: widget
        start: 4
        end: 18
```

```js
timeline.dataFormat = 'yaml'
timeline.data = yamlSource
```

`items` is the public data name and is normalized to the internal `actions`
array. `editorData` and `actions` are also accepted as input fields.

### Data schema

| Field | Type | Description |
| --- | --- | --- |
| `durationMillis` or `durationSeconds` | `number` | Timeline duration. |
| `currentTimeMillis` | `number` | Initial controlled playhead position. |
| `playing` | `boolean` | Initial playback state. |
| `linkedPreparation` | `boolean` | Whether the timeline is visible. |
| `tracks` | `array` | Track definitions. |
| `tracks[].id` | `string` | Stable track identifier. |
| `tracks[].label` | `string` | Track name shown in the legend. |
| `tracks[].editable` | `boolean` | Set `false` to disable label editing. Defaults to editable. |
| `tracks[].icon` | `string` | Font Awesome icon name. |
| `tracks[].visible` | `boolean` | Track visibility state. |
| `tracks[].canHide` | `boolean` | Whether to display the visibility control. |
| `tracks[].items` | `array` | Items/actions displayed on the track. |
| `tracks[].items[].start` / `end` | `number` | Item start and end in seconds. |
| `tracks[].items[].label` | `string` | Item label. |
| `tracks[].items[].kind` | `string` | Item type such as `start`, `stop`, or `widget`. |
| `tracks[].items[].icon` | `string` | Optional Font Awesome icon name. |

## Editable and persisted track names

Track names are editable by double-clicking a legend label. Press `Enter` or
leave the input to save, or press `Escape` to cancel. Set `editable: false` on
a track to keep its label read-only.

Every successful edit emits `lgs1920-timeline-track-label-change`. Its detail
contains `rowId`, `label`, `previousLabel`, the current `rows`, and a complete
serializable `data` snapshot. Hosts can persist that snapshot wherever their
application stores data:

```js
timeline.addEventListener('lgs1920-timeline-track-label-change', event => {
    saveTimelineData(event.detail.data)
})
```

For a browser-only opt-in persistence layer, set `persist-key`. Edited labels
are stored in `localStorage` under a namespaced key and restored when the same
key is used again:

```html
<lgs1920-timeline persist-key="replay-project-42"></lgs1920-timeline>
```

The persistence key is intentionally opt-in. Without it, the component remains
fully controlled by its host.

## Controlled state

| Property | Type | Description |
| --- | --- | --- |
| `projection` | `object` | Projection containing `durationMillis` or `durationSeconds` and `editorData`. |
| `editorData` | `array` | Timeline rows when `projection` is not used. |
| `currentTimeMillis` | `number` | Current logical timeline time. |
| `playing` | `boolean` | Current timeline playback state. |
| `linkedPreparation` | `boolean` | Shows the component when `true`. |
| `widgetOptions` | `array` | Options rendered by the add-widget menu. |
| `zoomPercent` | `number` | Optional controlled zoom from `-50` to `500`. |
| `legendWidth` | `number` | Optional controlled legend width from `120` to `300` pixels. |
| `data` | `object|string` | Complete timeline input in object, JSON, or YAML form. |
| `dataFormat` | `string` | `auto`, `json`, or `yaml`. |
| `persistKey` | `string` | Optional local-storage key for edited labels. |

Each row can contain `id`, `label`, `icon`, `colorClasses`, `visible`,
`canHide`, `fixed`, `movable`, and an `actions` array. Each action can contain
`id`, `kind`, `label`, `icon`, `start`, `end`, `visible`, `widgetId`, and
`clip`.

## Slots

Slots use normal Web Component light-DOM syntax. Static slots replace the
corresponding component area. Repeated row and action slots support a global
template and an optional identifier-specific override.

### Layout slots

| Slot | Description |
| --- | --- |
| `additional-content` | Additional content rendered before the timeline header. |
| `header` | Custom content in the header, before the transport controls. |
| `transport-start` | Content before the current time. |
| `transport-current` | Replaces the current time label. |
| `transport-separator` | Replaces the ` / ` separator. |
| `transport-total` | Replaces the total time label. |
| `transport-end` | Content after the total time. |
| `timeline-toolbar` | Content in the legend ruler before the add-widget button. |
| `timeline-ruler` | Additional content over the time ruler. |
| `footer` | Content below the timeline layout. |
| `empty-state` | Content displayed in an empty add-widget menu. |

```html
<lgs1920-timeline id="custom-layout">
    <span slot="additional-content" class="timeline-context">Timeline editor</span>
    <h2 slot="header">Project timeline</h2>
    <span slot="transport-start">Time</span>
    <strong slot="transport-current">00:00</strong>
    <span slot="transport-separator">&nbsp;of&nbsp;</span>
    <strong slot="transport-total">01:00</strong>
    <wa-button slot="timeline-toolbar" appearance="plain">Filters</wa-button>
    <small slot="footer">Use the controls to edit the timeline.</small>
</lgs1920-timeline>
```

### Transport labels and icons

| Slot | Description |
| --- | --- |
| `play-icon` / `pause-icon` | Play or pause Font Awesome/Web Awesome content. |
| `replay-icon` | Restart icon. |
| `export-icon` | Export icon. |
| `add-widget-icon` | Add-widget icon. |
| `play-label` / `pause-label` | Play or pause button label. |
| `replay-label` | Restart button label. |
| `export-label` | Export button label. |
| `add-widget-label` | Add-widget button label. |

```html
<lgs1920-timeline>
    <wa-icon slot="play-icon" name="circle-play" variant="solid" label=""></wa-icon>
    <span slot="play-label">Play</span>
    <wa-icon slot="pause-icon" name="circle-pause" variant="solid" label=""></wa-icon>
    <span slot="pause-label">Pause</span>
    <wa-icon slot="replay-icon" name="rotate-left" variant="solid" label=""></wa-icon>
    <span slot="replay-label">Restart</span>
    <wa-icon slot="export-icon" name="file-video" variant="solid" label=""></wa-icon>
    <span slot="export-label">Export</span>
</lgs1920-timeline>
```

### Repeated track and action content

The following global slots are cloned for each repeated item. A `<template>`
is recommended when the content is more than one node.

| Global slot | Contextual slot prefix | Description |
| --- | --- | --- |
| `drag-trigger` | `drag-trigger-{rowId}` | Row drag or fixed-row trigger. |
| `visibility` | `visibility-{rowId}` | Row visibility control content. |
| `name` | `name-{rowId}` | Track title content. |
| `actions` | `actions-{rowId}` | Additional actions reserved for that track. |
| `track-actions` | `track-actions-{rowId}` | Legacy alias for track actions. |
| `track-drag-icon` | `track-drag-icon-{rowId}` | Legacy alias for the drag trigger. |
| `track-visibility-icon` | `track-visibility-icon-{rowId}` | Legacy alias for visibility content. |
| `track-icon` | `track-icon-{rowId}` | Track icon. |
| `track-label` | `track-label-{rowId}` | Track label. |
| `action-icon` | `action-icon-{actionId}` | Action icon. |
| `action-label` | `action-label-{actionId}` | Action label. |
| `action-content` | `action-content-{actionId}` | Complete HTML content for an item. |
| `scale-label` | `scale-label-{tickIndex}` | Ruler label. |
| `widget-option-icon` | Not contextual | Add-widget menu icon. |
| `widget-option-label` | Not contextual | Add-widget menu label. |

```html
<lgs1920-timeline>
    <template slot="track-icon">
        <wa-icon name="layer-group" variant="solid" label=""></wa-icon>
    </template>
    <template slot="track-label">
        <span class="custom-track-label">Custom track</span>
    </template>
    <template slot="action-icon">
        <wa-icon name="sparkles" variant="solid" label=""></wa-icon>
    </template>
    <template slot="action-label">
        <span class="custom-action-label">Custom action</span>
    </template>
</lgs1920-timeline>
```

For a row with the identifier `map#main`, the contextual slot name keeps the
`#` separator:

```html
<lgs1920-timeline>
    <wa-icon slot="track-icon-map#main" name="map-location-dot" variant="solid" label=""></wa-icon>
    <span slot="track-label-map#main">Journey map</span>
</lgs1920-timeline>
```

Contextual content has priority over its global slot. If neither is supplied,
the built-in Font Awesome icon or data label is used.

### Track title actions

Every track legend row contains a track-content area and a right-aligned
track-actions area. The track-actions area contains the contextual
`drag-trigger-{rowId}` and `visibility-{rowId}` slots, followed by the reserved
`actions-{rowId}` slot for host-defined actions. The track name itself is
provided by `name-{rowId}` in the track-content area.

```html
<lgs1920-timeline>
    <wa-icon slot="drag-trigger-map#main" name="grip-lines-vertical" variant="solid" label=""></wa-icon>
    <wa-icon slot="visibility-map#main" name="eye" variant="solid" label=""></wa-icon>
    <wa-button slot="actions-map#main" size="s" appearance="plain" aria-label="Open map settings">
        <wa-icon name="gear" variant="solid" label=""></wa-icon>
    </wa-button>
    <span slot="name-map#main">Journey map title</span>
</lgs1920-timeline>
```

Double-clicking the `name-{rowId}` content opens the Web Awesome input for
editing. Right-clicking a track title or any part of a track opens its context
menu with rename and visibility commands. Context-menu commands emit
composed events and update the local controlled projection immediately.

### Item HTML content

An item can be rendered as arbitrary slotted HTML instead of the default icon
and label pair. Use `action-content` for a repeated global template or
`action-content-{actionId}` for one item.

```html
<lgs1920-timeline>
    <template slot="action-content">
        <span class="item-card">
            <wa-icon name="wand-magic-sparkles" variant="solid" label=""></wa-icon>
            <strong>Custom item</strong>
            <small>HTML content</small>
        </span>
    </template>
</lgs1920-timeline>
```

Right-clicking an item opens its context menu. The menu emits an item edit
request and provides show/hide behavior through
`lgs1920-timeline-item-visibility-change`. Hosts can replace the item HTML or
label in the next `data` update.

## Optional popup parent

The optional `parent` property or attribute provides a parent element as the
boundary used by Web Awesome popups. When it is omitted, Web Awesome detects
the relevant overflow ancestors automatically.

```js
const boundary = document.querySelector('#video-panel')
timeline.parent = boundary
```

```html
<lgs1920-timeline parent="#video-panel"></lgs1920-timeline>
```

The `additional-content` slot is independent: it customizes content rendered
inside the timeline and does not change popup positioning.

## CSS customization

All timeline-specific visual decisions are exposed as custom properties. The
component also exposes CSS parts for targeted styling without breaking Shadow
DOM encapsulation.

```css
lgs1920-timeline {
    --lgs-timeline-padding: 1rem;
    --lgs-timeline-background: color-mix(in oklab, #102033 92%, transparent);
    --lgs-timeline-surface-color: #132941;
    --lgs-timeline-playhead-color: #ffb000;
    --lgs-timeline-row-height: 28px;
    --lgs-timeline-legend-width: 180px;
}

lgs1920-timeline::part(action) {
    letter-spacing: 0.02em;
}

lgs1920-timeline::part(resizer):hover {
    background: var(--wa-color-brand-fill-loud);
}
```

| Custom property | Default purpose |
| --- | --- |
| `--lgs-timeline-background` | Outer timeline background. |
| `--lgs-timeline-text-color` | Normal text color. |
| `--lgs-timeline-quiet-text-color` | Ruler and transport text color. |
| `--lgs-timeline-border-color` | Normal border color. |
| `--lgs-timeline-quiet-border-color` | Grid and row border color. |
| `--lgs-timeline-surface-color` | Legend and track surface color. |
| `--lgs-timeline-padding` | Outer padding. |
| `--lgs-timeline-radius` | Outer corner radius. |
| `--lgs-timeline-shadow` | Outer shadow. |
| `--lgs-timeline-gap` | Header and top-section gap. |
| `--lgs-timeline-header-height` | Ruler/header height. |
| `--lgs-timeline-min-height` | Minimum host and layout height. |
| `--lgs-timeline-scrollbar-height` | Horizontal scrollbar height. |
| `--lgs-timeline-legend-width` | Track legend width. |
| `--lgs-timeline-legend-min-width` | Minimum resizable legend width. |
| `--lgs-timeline-legend-max-width` | Maximum resizable legend width. |
| `--lgs-timeline-resizer-width` | Legend resizer width. |
| `--lgs-timeline-row-height` | Minimum row height. |
| `--lgs-timeline-scale-width` | Ruler pixels per major unit. |
| `--lgs-timeline-scale-offset` | Ruler start offset. |
| `--lgs-timeline-playhead-color` | Playhead color. |
| `--lgs-timeline-playhead-width` | Playhead width. |
| `--lgs-timeline-end-marker-color` | End marker color. |
| `--lgs-timeline-action-padding` | Action horizontal padding. |
| `--lgs-timeline-action-min-width` | Minimum action width. |
| `--lgs-timeline-popup-background` | Add-widget popup background. |
| `--lgs-timeline-popup-border-color` | Add-widget popup border. |
| `--lgs-timeline-popup-shadow` | Add-widget popup shadow. |

Available parts include `container`, `top`, `header`, `controls`, `transport`,
`layout`, `legend`, `legend-ruler`, `legend-row`, `legend-icon`, `resizer`,
`surface`, `canvas`, `ruler`, `tick`, `minor-tick`, `tracks`, `track`,
`action`, `action-preview`, `playhead`, `end-marker`, `popup`, and `menu`.

## Events

Events bubble and are composed across the Shadow DOM boundary. The primary
prefix is `lgs1920-timeline-`. Compatibility aliases with the historic
`lgs1920-wa-timeline-` prefix are emitted at the same time.

| Event | Detail |
| --- | --- |
| `lgs1920-timeline-play` | `{}` |
| `lgs1920-timeline-pause` | `{}` |
| `lgs1920-timeline-replay` | `{}` |
| `lgs1920-timeline-export` | `{}` |
| `lgs1920-timeline-seek` | `{timeMillis, progress, settled}` |
| `lgs1920-timeline-visibility-change` | `{rowId, visible, row, event}` |
| `lgs1920-timeline-action-dblclick` | `{action, event}` |
| `lgs1920-timeline-add-widget` | `{group, key, option}` |
| `lgs1920-timeline-reorder` | `{rowIds, rows}` |
| `lgs1920-timeline-track-label-change` | `{rowId, label, previousLabel, rows, data}` |
| `lgs1920-timeline-data-error` | `{value, error}` |
| `lgs1920-timeline-context-menu-open` | `{type, identifier, event}` |
| `lgs1920-timeline-item-label-edit-request` | `{action, event}` |
| `lgs1920-timeline-item-visibility-change` | `{rowId, itemId, visible, action, event, data}` |

```js
timeline.addEventListener('lgs1920-timeline-seek', event => {
    timeline.setTime(event.detail.timeMillis)
})

timeline.addEventListener('lgs1920-timeline-action-dblclick', event => {
    const {action} = event.detail
    timeline.setAttribute('aria-label', `Selected item: ${action.label ?? action.id}`)
})
```

## Public methods

| Method | Description |
| --- | --- |
| `setState(state)` | Apply the controlled projection and rerender. |
| `setData(value)` | Parse and apply an object, JSON string, or YAML string. |
| `setTime(timeMillis)` | Move the visual playhead without emitting `seek`. |
| `setZoom(zoomPercent)` | Set the visible zoom from `-50` to `500`. |
| `handleResize()` | Recompute surface dimensions after a container resize. |
| `parent` | Get or set the optional popup positioning boundary. |

## Interaction behavior

- Clicking or dragging the timeline surface emits a controlled seek event.
- The final pointer event has `settled: true`; intermediate scrub events have
  `settled: false`.
- `Ctrl`/`Cmd` plus the mouse wheel changes zoom.
- Left and right arrow keys change zoom while the surface is focused.
- Movable legend rows can be reordered with the pointer.
- Dragging a row close to the timeline edge starts accelerated horizontal
  auto-scroll.
- The legend resizer is keyboard focusable and constrained to `120`–`300`
  pixels by default.
- Fixed rows cannot be reordered and rows with `canHide: false` do not render
  a visibility control.

## Accessibility

The host is a `region`, transport controls are Web Awesome buttons, the
timeline surface is keyboard focusable, the resizer exposes separator value
attributes, and dynamic rows/actions expose accessible labels. Custom slotted
icons should use `label=""` when they are decorative and provide visible or
semantic text through their matching label slot.
