# Widget Boards and Persistence

This document explains how widgets are mounted, bounded, resized, and persisted in the current widget system.

## Overview

The widget stack is split into two concerns:

- `Widget` React components render the visible widget content and attach a `Moveable` controller.
- `WidgetManager` and its helpers own geometry, board resolution, persistence, and interaction lifecycle.

The system is intentionally board-driven:

- every widget belongs to a `widgetsBoard`
- positions are restored relative to that board
- bounds, resize adaptation, and out-of-bounds correction are also resolved from that board

This is what allows the same widget engine to support:

- scene widgets
- crop-zone tools
- video widgets rendered inside `defined crop-zone`

## Terminology

### Board

A board is the logical area that owns a widget.

Examples:

- scene board -> `SCENE_WIDGETS_BOARD`
- video board -> `VIDEO_WIDGETS_BOARD` (`video-crop-zone`)

Each board resolves to a DOM element at runtime.

### Reference container

The reference container is the DOM rect used to convert persisted ratios back into pixel coordinates.

For the current implementation:

- scene widgets use the scene canvas
- board widgets use the resolved board element itself

### Bounds container

The bounds container is the DOM rect used to clamp widgets so they stay inside their board.

In practice, the reference container and the bounds container usually resolve to the same DOM node.

## Snapping and Alignment

Visual widgets use Moveable snapping on their active board. The following targets are available:

- board edges and the board center
- configured grid lines when grid snapping is enabled
- edges of other widgets on the same `widgetsBoard`
- horizontal and vertical centers of other widgets on the same `widgetsBoard`

Center alignment is independent from physical contact. Two widgets can align their horizontal or vertical centers while remaining separated by a gap.

Widget-to-widget targets are resolved from the rendered DOM and the runtime widget configuration. This keeps snapping scoped to the active board and prevents scene widgets from becoming targets during video composition.

The target list is refreshed when widgets are mounted or removed. Widget rectangles are also refreshed during movement so snapping follows widgets whose position or size changed during the composition session.

Snapping is disabled for non-visual widgets and for widgets whose `snappable` configuration is explicitly disabled. Grid visibility and grid snapping remain separate settings: the grid can be visible without forcing widget positions onto its lines.

The editable video crop is a deliberate exception to regular visual-widget snapping:

- its edges snap only to the active crop container edges
- board-center, grid, and peer-widget guidelines are disabled
- its own center is never used as a snap target

## Core Files

- `WidgetManager.js`
  Board resolution, public API, persistence entry points.
- `WidgetCoreRegistry.js`
  Runtime config store, DB load/save preparation, ratio conversion.
- `WidgetCoreControls.js`
  Initial placement, resize observation, board adaptation, setup lifecycle.
- `WidgetDraggable.js`
  Drag lifecycle and persisted position updates.
- `WidgetResizable.js`
  Resize lifecycle and persisted base dimensions updates.
- `WidgetScalable.js`
  Scale lifecycle and persisted scale updates.
- `WidgetPosition.js`
  Quick anchor positioning (`top`, `bottom-right`, `center`, etc.).
- `WidgetCache.js`
  Widget hydration metadata loaded from IndexedDB on startup.

## Widget Mount Lifecycle

When a widget mounts:

1. `Widget.jsx` resolves the actual board DOM node.
2. The widget waits until the board exists and has a non-zero rect.
3. `WidgetManager.retrieveConfig()` loads or rebuilds the runtime config.
4. `WidgetManager.setupElement()` applies:
   - base dimensions
   - persisted position
   - persisted scale
   - persisted rotation
5. Resize observers are attached:
   - one for the board
   - one for the widget element itself

Important rule:

- a runtime config is reused only if it is already ready and still targets the requested board
- otherwise the persisted DB record is read again

This prevents a widget from being restored with geometry captured from the wrong board.

## Persistence Model

Widget positions are stored in the browser DB (`WIDGETS_STORE`) through `WidgetDBManager`.

Persisted geometry contains:

- `leftRatio`
- `topRatio`
- `left`
- `top`
- `width`
- `height`
- `scale`
- `rotate`
- `attachTo`
- `widgetsBoard`
- `zIndex`

### Why ratios are used

The system stores the widget center as ratios of the board size:

- `leftRatio`
- `topRatio`

This makes positions resilient to:

- window resize
- board resize
- crop-zone resize

### Why raw `left/top` still exist

Raw `left/top` are kept as a fallback. They are useful when:

- ratios are missing
- a legacy record is being migrated
- the board geometry is temporarily unavailable

## Position Reconstruction

On restore:

1. the persisted ratios are read from DB
2. the reference board rect is resolved
3. the widget center is reconstructed in pixels
4. the center is converted back to top-left coordinates using persisted `width/height`

The restored widget then receives:

- `config.position`
- `config.dimensions`
- `config.scale`
- `config.rotate`
- `config.savedRatios`

## Base Dimensions vs Scale

The system keeps two separate concepts:

- `dimensions`
  The unscaled logical size of the widget
- `scale`
  The visual scale applied through CSS transform

This separation matters:

- resize changes `dimensions`
- scale changes `scale`
- persistence must save both independently

For dynamic widgets such as text or compass, the element resize observer updates `config.dimensions` when the underlying rendered size changes.

The editable crop uses a stricter contract:

- `cropDimensions.width/height` are its rendered logical dimensions
- inline width and height are persisted before transformed `DOMRect` values
- crop scale is always normalized to `{x: 1, y: 1}`, including legacy records
- generic visual-widget scale adaptation never runs for the crop

## Board Resize Behavior

When a board resizes:

1. bounds are refreshed
2. persisted center ratios are reapplied
3. the widget is clamped inside the board
4. scale is reduced only if the widget can no longer fit

Two protections are important:

- restored widgets skip destructive auto-adaptation on the very first resize pass
- restored widgets also skip the first element-size resync tick

Without those guards, a valid persisted size/scale can be overwritten immediately on mount.

## Video-Specific Behavior

Video widgets belong to `VIDEO_WIDGETS_BOARD`.

They are visible only inside `defined crop-zone`.

Key rules:

- the video widget portal does not mount until `#video-crop-zone.defined` exists
- the editable crop zone does not display the widgets themselves
- persisted video widgets are restored against `defined crop-zone`, not the full scene
- leaving video editing first persists the mounted crop, then changes the video UI state
- crop unmount does not start a competing asynchronous persistence write
- closing the editor invalidates crop runtime resources while preserving the IndexedDB record
- reopening the editor reloads the persisted crop dimensions and normalizes scale to one

This is critical for keeping:

- correct position after restart
- correct scale between `crop-zone` and `defined crop-zone`
- correct bounds when the crop area changes

## Runtime Cache vs DB

There are two layers:

- runtime config in `WidgetCoreRegistry`
- persisted geometry in IndexedDB

The runtime layer is faster, but it must not override valid persisted data when:

- the board changed
- the board was not ready during a previous mount
- the widget is being restored after app startup

That is why restore logic always validates whether the runtime config is still compatible with the current board.

## Board-Scoped Widget Counting

Singleton and max-instance rules are board-aware.

This matters for video widgets because a widget already mounted on the scene must not block the same widget from being restored on the video board.

The counting logic therefore scopes instances by:

- widget group
- widget base id
- `widgetsBoard`

## Practical Debug Rules

If a widget restores with the wrong position, check these in order:

1. Is the widget mounted on the correct `widgetsBoard`?
2. Does the board DOM node exist before widget setup starts?
3. Does the DB record contain valid `leftRatio/topRatio` and `width/height`?
4. Is the first resize observer pass overwriting restored geometry?
5. Is the widget content mutating its own intrinsic size after mount?

If a widget keeps its position but loses its visual size, the issue is usually:

- base dimensions being overwritten
- first element resize sync running too early
- a widget-specific content layout changing after restore

## Current Guarantees

With the current implementation, the widget system is designed to guarantee:

- widgets stay inside their board
- board resize repositions widgets from persisted ratios
- widgets are reduced only when they no longer fit
- video widgets restore inside `defined crop-zone`
- runtime state does not override persisted state for the wrong board
- the editable crop preserves its resized dimensions across editor sessions
- the editable crop snaps only to the crop container edges

That is the contract the rest of the video and cropper UI should rely on.
