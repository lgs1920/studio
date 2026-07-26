# Arrow Widget Technical Specification

## Purpose

The Arrow widget is a repeatable, editable visual widget for drawing directional arrows on a scene or video board. It supports annotations, route explanations, points of interest, and visual callouts.

The widget remains host-managed: selection, dragging, scaling, rotation, bounds, z-index, persistence, and capture lifecycle are handled by the existing widget manager.

## Widget contract

- Catalog ID: `arrow-widget`
- Component: `ArrowWidget`
- Type: `lgs-visual-widget`
- Availability: journey and scene boards, including video composition when supported by the current scene
- Repeatability: up to 50 instances, using IDs such as `arrow-widget#<uuid>`
- Static content: complete arrow geometry and style
- Dynamic content: none
- Mandatory, fixed-position, and always-on-top: `false`
- Editable and scalable: `true`
- Removable and lockable: standard widget host behavior

The component renders a stable SVG subtree so resizing, rotation, snapshots, and HQ video export do not depend on canvas redraws or asynchronous content. Controls and on-canvas handles use `lgs-widget-no-drag` so they do not start host dragging.

## Configuration model

Configuration is resolved in this order:

1. `configuration.elements[instanceId]`
2. `configuration.user`
3. `configuration.default`

Proposed catalog entry:

```yaml
arrow-widget:
  id: "arrow-widget"
  name: "Arrow"
  description: "Directional arrow annotation"
  icon: "caret-right"
  iconVariant: "solid"
  mandatory: false
  max: 50
  component: "ArrowWidget"
  type: "lgs-visual-widget"
  path: "@Components/Arrow"
  groups:
    - "journey-widgets"
    - "scene-widgets"
  configuration:
    default:
      length: 240
      thickness: 6
      lineColor: "#ffffff"
      markerColor: "#ffffff"
      opacity: 1
      rotate: 0
      startCap: "none"
      endCap: "arrow"
      arrowType: "caret"
      markerSize: 24
      corner: "rounded"
      cornerRadius: 6
      scaled: true
      thicknessScaled: true
      markerSizeScaled: true
      cornerRadiusScaled: true
    user:
    elements:
```

`length` is the logical distance between the endpoints before host scaling. `thickness`, `markerSize`, and corner radii use the same logical coordinate system. `rotate` must stay synchronized with `WidgetRotatable`; the component must not implement a second rotation system.

`lineColor` controls the shaft and `markerColor` controls arrowheads, circles, and bars. They are intentionally independent so the marker can have its own color. `scaled` is the default scaling policy for visual properties, matching the Text widget convention. Each scalable element also exposes an explicit override, which defaults to `true`: `thicknessScaled` for the line, `markerSizeScaled` for arrowheads, circles, and bars, and `cornerRadiusScaled` for rounded or semicircular geometry. The renderer must apply these flags independently when the host widget is scaled. Non-dimensional values such as color, opacity, cap type, and arrow type do not need a scaling flag.

## Geometry

The renderer uses a local horizontal coordinate system from `(0, 0)` to `(length, 0)`, then lets the host apply positioning and rotation. Geometry must be implemented through named strategies:

- `caret`: single solid caret arrow
- `chevrons`: double-chevron arrow
- `location`: location arrow using the Font Awesome location-arrow shape
- `circle`: circular marker with a configurable diameter

The UI must use only the following Font Awesome Solid icons. The SVG preview table below is illustrative only; the effective React contract is the compact table that follows it.

| Preview | Widget option | Font Awesome icon name | Variant | Rotation |
| --- | --- | --- | --- | --- |
| <svg aria-label="Caret right" viewBox="0 0 256 512" width="18" height="18" role="img"><path fill="currentColor" d="M249.3 235.8c10.2 12.6 9.5 31.1-2.2 42.8l-128 128c-9.2 9.2-22.9 11.9-34.9 6.9S64.5 396.9 64.5 384l0-256c0-12.9 7.8-24.6 19.8-29.6s25.7-2.2 34.9 6.9l128 128 2.2 2.4z"/></svg> | Caret arrow | `caret-right` | `solid` | `0deg` |
| <svg aria-label="Chevrons right" viewBox="0 0 448 512" width="18" height="18" role="img"><path fill="currentColor" d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-192-192c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L370.7 256 201.4 425.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l192-192zm-384 192l192-192c12.5-12.5 12.5-32.8 0-45.3l-192-192c-12.5-12.5-45.3 0-45.3 0s-12.5 32.8 0 45.3L178.7 256 9.4 425.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0z"/></svg> | Double chevron arrow | `chevrons-right` | `faChevronsRight` | `solid` | `0deg` |
| <svg aria-label="Location arrow up rotated minus 90 degrees" viewBox="0 0 448 512" width="18" height="18" role="img"><g transform="rotate(-90 224 256)"><path fill="currentColor" d="M253.1 18.6C247.8 7.3 236.5 0 224 0s-23.8 7.3-29.1 18.6l-192 416c-5.6 12.2-3.1 26.5 6.4 36s23.8 12.1 36 6.5L224 395.2 402.7 477.1c12.2 5.6 23.8 3 36-6.5s12-23.8 6.4-36l-192-416z"/></g></svg> | Location arrow | `location-arrow-up` | `faLocationArrowUp` | `solid` | `-90deg` |
| <svg aria-label="Circle" viewBox="0 0 512 512" width="18" height="18" role="img"><path fill="currentColor" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z"/></svg> | Circle marker | `circle` | `solid` | `0deg` |

The effective UI contract is icon name, variant, and rotation only. Package-export names are not part of the React contract and must not be exposed or required:

| Icon | Variant | Rotation |
| --- | --- | --- |
| `caret-right` | `solid` | `0deg` |
| `chevrons-right` | `solid` | `0deg` |
| `location-arrow-up` | `solid` | `90deg` |
| `circle` | `solid` | `0deg` |

All icons use `variant="solid"`. The location arrow uses a `90deg` rotation. The start-cap preview may rotate the selected icon to face the opposite direction, but the stored widget geometry remains independent from the preview orientation. The `none` cap is represented by the text label “None” and does not require an icon.

<!-- Inline SVG reference previews are intentionally omitted from the rendered specification.

The following inline SVGs are visual references for the exact Solid icons used by the editor. They are not a second rendering implementation for the widget.

<svg aria-label="Caret right" viewBox="0 0 256 512" width="64" height="64" role="img"><path fill="currentColor" d="M249.3 235.8c10.2 12.6 9.5 31.1-2.2 42.8l-128 128c-9.2 9.2-22.9 11.9-34.9 6.9S64.5 396.9 64.5 384l0-256c0-12.9 7.8-24.6 19.8-29.6s25.7-2.2 34.9 6.9l128 128 2.2 2.4z"/></svg>

<svg aria-label="Chevrons right" viewBox="0 0 448 512" width="64" height="64" role="img"><path fill="currentColor" d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-192-192c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L370.7 256 201.4 425.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l192-192zm-384 192l192-192c12.5-12.5 12.5-32.8 0-45.3l-192-192c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L178.7 256 9.4 425.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0z"/></svg>

<svg aria-label="Location arrow up rotated minus 90 degrees" viewBox="0 0 448 512" width="64" height="64" role="img"><g transform="rotate(-90 224 256)"><path fill="currentColor" d="M253.1 18.6C247.8 7.3 236.5 0 224 0s-23.8 7.3-29.1 18.6l-192 416c-5.6 12.2-3.1 26.5 6.4 36s23.8 12.1 36 6.5L224 395.2 402.7 477.1c12.2 5.6 26.5 3 36-6.5s12-23.8 6.4-36l-192-416z"/></g></svg>

<svg aria-label="Circle" viewBox="0 0 512 512" width="32" height="32" role="img"><path fill="currentColor" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z"/></svg>

-->

Both ends are independently configurable through `startCap` and `endCap`:

- `none`: straight end without an arrowhead
- `arrow`: arrowhead using the selected `arrowType`
- `circle`: circular marker using `markerSize` as its diameter
- `bar`: perpendicular terminal bar

The selected cap must be included in the geometry calculation so the line does not overlap the terminal shape.

The `corner` option controls joins and terminals:

- `sharp`: miter joins
- `rounded`: round joins and rounded filled geometry
- `semicircle`: semicircular treatment for a straight terminal

Options with no visual effect should be disabled or hidden. For example, `semicircle` must not replace a filled arrowhead.

## On-canvas interaction

The standard widget frame provides moving, scaling, selection, locking, grid snapping, and host rotation. The Arrow widget adds two content handles:

- Start handle: moves the start endpoint while preserving the end endpoint
- End handle: moves the end endpoint and changes `length` while preserving the start endpoint

Handle dragging must:

- update the local geometry continuously for preview
- enforce a minimum length of 24 logical pixels
- preserve the host-managed origin whenever possible
- persist through the widget manager at gesture end
- support keyboard movement with accessible labels and arrow-key increments

The editor exposes a numeric rotation field, but it writes `rotate` through the existing widget transform contract. Handles appear only while the widget is selected or while the editor preview is active. They are excluded from snapshots, replay output, and HQ video export.

## Editor UI

The editor is loaded by the widget registry as `ArrowEditor`, with `ArrowPreview` for the preview tab. It uses the existing non-modal widget drawer and displays the current map or canvas background when available.

### Shape

- Start cap: None, Arrow, Circle, Bar
- End cap: None, Arrow, Circle, Bar
- Arrow type: Caret, Double chevron, Location arrow
- Corner: Sharp, Rounded, Semicircle

### Dimensions

- Length: numeric input and slider, minimum 24
- Thickness: numeric input and slider, minimum 1
- Marker size: numeric input and slider, disabled when both caps are `none`; applies to arrowheads, circles, and bars
- Independent scale switches for line thickness, marker size, and corner radius, all enabled by default

### Appearance

- Line color: Web Awesome color input using the existing color editor convention
- Marker color: Web Awesome color input for arrowheads, circles, and bars
- Opacity: slider from 0 to 1
- Scale style: switch controlling `scaled`

### Transform

- Rotation: numeric angle from `-180` to `180` degrees
- Reset rotation action

Labels use visual terms such as “Start cap” and “End cap”, not internal property names. All controls use Web Awesome and existing editor styles. Interactive preview controls are marked `lgs-widget-no-drag`.

Reset restores the instance to catalog defaults without deleting it. Editing a specific arrow writes to the instance layer and never mutates shared defaults.

## Rendering and persistence

`ArrowWidget` resolves its configuration through the standard Valtio snapshot pattern and renders only the visual content. It must not duplicate positioning, resizing, rotation, grid snapping, or persistence logic.

The SVG uses explicit `viewBox`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, and `vector-effect` values for deterministic scene rendering, video composition, browser snapshots, and HQ export.

The DOM structure remains stable while a handle is dragged. At gesture end, the normalized configuration is persisted and synchronized with the widget manager. Missing or invalid values fall back to catalog defaults for compatibility with older scenes.

## Accessibility and acceptance criteria

- The widget has the accessible name “Arrow”.
- Start and end handles have distinct labels and are keyboard reachable when selected.
- Line color, marker color, thickness, length, arrow type, caps, corners, opacity, and rotation are editable.
- Arrow and cap selectors use the specified Font Awesome Solid icons.
- Caret, double-chevron, location-arrow, and circle-marker options use the specified Solid icons and previews.
- Circle caps are available independently at the start or end and use the configured marker size.
- A straight end renders correctly when no arrowhead is selected.
- Rounded and semicircular terminals are visually distinct and do not overlap the line.
- Multiple arrows can coexist, be selected independently, reordered, locked, moved, scaled, and persisted.
- Handle overlays are absent from scene snapshots and HQ video exports.
- Scene replacement unmounts old Arrow instances without stale handles or configuration.
- Focused tests cover scene and video boards, editor reset, handle persistence, crop bounds, rotation, and export cleanup.
