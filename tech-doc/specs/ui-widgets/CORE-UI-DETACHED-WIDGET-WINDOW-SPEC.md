# Detached widget windows

## Purpose

The Studio widget context menu can detach an eligible widget into a browser
window. The implementation prefers Document Picture-in-Picture and falls back
to a resizable popup when that API is unavailable or rejected.

## User-visible behavior

- The `Detach into window` action is available for widgets whose configuration
  exposes `contextMenu.canDetach: true`.
- Only one widget can own the detached window at a time.
- The detached window displays the widget content at the size of the window.
  When opened from the scene, the window uses the widget's current rendered
  width and height. When opened from the dock drawer, it uses the widget
  dimensions captured before docking.
  The widget host keeps only a neutral content wrapper there, so the selection
  overlay, drag handles, resize handles, snapping, and scene positioning
  controls are not rendered.
- The scene instance is temporarily hidden while its content is displayed in
  the detached window.
- The external window wraps the widget content in a vertical `wa-card` without
  the standard scene widget frame. Its header
  actions expose `Unlock widget` with the `lock-open` icon to return the widget
  to the scene, and `Attach widget to drawer` with the
  `arrow-down-to-bracket` icon to move it directly into the bottom drawer.
- When PiP is opened from the dock drawer, its initial dimensions come from the
  widget dimensions persisted before docking, including the widget scale.
- The bottom drawer can be resized vertically from its top edge between the
  absolute minimum height and 90% of the viewport height. Its height is
  re-clamped when the viewport changes.
- Reattaching restores the widget to the scene and restores its saved layout
  values, including the original width and height even when the external
  window was resized. The widget is selected again on the scene after a
  regular reattachment. Closing the detached window performs the same regular
  reattachment.

## Rendering contract

`DetachedWidgetPortal` resolves the active widget instance from the reactive
widget store and renders it through the existing dynamic widget renderer. It
does not select a widget type or import a widget implementation.

The generic `WidgetContentOnlyContext` tells the standard widget component to
render a neutral detached content host. This keeps the widget's content
component reusable while excluding scene-only behavior such as Moveable and
widget overlays. Widgets that need additional conditions for content rendering
must continue to honor the `detached` rendering property.

The external document creates one content container with full viewport width
and height. The detached content host and its first child also fill that
container. The container has no application background override, allowing the
rendered widget to provide its own visual surface. Content that needs a redraw
on resize, such as the replay timeline, observes the detached host dimensions
and requests its own resize operation.

## State and recovery

The active instance is stored in `lgs.stores.ui.widget.undocked`:

```js
{
  id: 'widget-id#instance',
  mode: 'pip' // or 'window'
}
```

Before detachment, the manager snapshots layout values that must survive the
temporary unmount. Reattachment clears the active state and writes those
values back to the widget manager. Page close, popup close, and Picture-in-
Picture close all use the same recovery path.

Mandatory widgets cannot be detached. A widget is also unavailable for
detachment while another detached window is active or while a window is being
opened.
