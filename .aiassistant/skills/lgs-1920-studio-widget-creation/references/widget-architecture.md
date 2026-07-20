# LGS1920 Widget Architecture Reference

Read this file when implementing or debugging a widget beyond a simple visual change.

## Source map

| Concern | Primary files |
| --- | --- |
| Catalog and defaults | `public/widgets.yaml`, `public/settings.yaml` |
| Widget host and controls | `src/components/MainUI/widgets/Widget.jsx`, `WidgetContextMenu.jsx` |
| Board rendering | `SceneWidgetsRenderer.jsx`, `DynamicWidget.jsx`, `WidgetGridOverlay.jsx` |
| Editor | `editor/WidgetEditorPanel.jsx`, `editor/elements/` |
| Position and scale | `src/core/ui/widget-manager/WidgetPosition.js`, `WidgetScalable.js`, `WidgetResizable.js`, `WidgetTransform.js` |
| Grid and snapping | `src/core/ui/widget-manager/widgetGridUtils.js`, `Widget.jsx` |
| Registry and persistence | `WidgetManager.js`, `WidgetCoreRegistry.js`, `WidgetDBManager.js` |
| Capture and composition | `src/core/ui/widget-manager/widget-2-canvas/Widget2Canvas.js`, `dynamic-render/WidgetDynamicRender.js` |
| Built-in widgets | `src/components/MainUI/widgets/list/`, `src/components/Stats/` |
| IDs and capabilities | `src/core/constants.js` |

## Catalog patterns

The catalog definition is the source of truth for widget availability and default configuration. Existing examples include:

- `credits-widget`: mandatory, always on top, fixed position
- `logo-widget`: mandatory, singleton, always on top, fixed position
- `text-widget`: editable, repeatable, available on journey and scene boards
- `dynamic-stats-widget`: video-board widget requiring a journey and displaying live replay data

Configuration is layered. Resolve the most specific layer first:

1. `configuration.elements[instanceId]`
2. `configuration.user`
3. `configuration.default`

Do not put instance-specific state into shared defaults.

## Rendering contract

The host owns mounting, selection, dragging, resizing, scaling, locking, z-index, persistence, crop bounds, and capture preparation. A widget component should render content and react to its configuration and application state. It should not reimplement host transforms or persistence.

For widgets with both stable and live content, mark or structure the two parts so the dynamic renderer can update the live part without invalidating the static composition. Dynamic replay data must tolerate the initial empty state and the end-of-replay cleanup state.

## Layout contract

The active board determines the widget bounds. Grid display is controlled by `lgs.settings.ui.widgets.grid.enabled`, with `size` and `snap` controlling the grid spacing and snapping. Grid guidelines and snapping must be calculated from the active container and the selected widget only.

Position changes should flow through `__.ui.widgetManager`, including `saveWidgetPosition`, `applyPosition`, and the manager's bound or crop adaptation helpers. This keeps pointer, keyboard, editor preview, scene replacement, and browser database state aligned.

Credits may be anchored and scaled while preserving their intended position. Logo and Credits are composition infrastructure, not ordinary removable widgets.

## Verification matrix

For any new visual widget, verify:

- scene board mount and unmount
- video board mount if available there
- selection isolation while another widget is nearby
- dragging, snapping, keyboard movement, and persistence if movable
- scaling and crop-bound adaptation if scalable
- editor preview and reset behavior if editable
- scene replacement without stale DOM or state
- snapshot and HQ video export visibility if captured
- export cancellation and completion cleanup

For dynamic widgets, also verify updates during replay, no stale values after replay ends, and stable output during static capture.
