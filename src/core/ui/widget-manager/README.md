# LGS1920/studio - WidgetManager

## Overview

`WidgetManager` is a singleton class in the `LGS1920/studio` project designed to manage draggable and resizable widgets
within a container. It delegates drag functionality to `WidgetDraggable`, resize functionality to `WidgetResizable`, and
cropping functionality to `WidgetCropper`. The class handles widget positioning, bounds enforcement, snapping, control
box visibility, group-based widget management, and optional persistence of widget configurations in IndexedDB, ensuring
a transparent interface for components that interact with it.

### Key Responsibilities

- **Widget Initialization**: Sets up draggable and resizable elements with unique IDs, applies initial positions, and
  ensures elements stay within container bounds.
- **Drag and Resize Delegation**: Delegates drag and resize operations to `WidgetDraggable` and `WidgetResizable`,
  maintaining state for dragging and resizing.
- **Crop Management**: Delegates cropping operations (e.g., crop dimensions, overlay synchronization, double-click
  toggling) to `WidgetCropper`.
- **Container Resize Observation**: Monitors container size changes and adjusts widget positions and dimensions
  accordingly.
- **Group Management**: Supports grouping of widgets for collective retrieval and disposal.
- **Persistence**: Manages widget configuration persistence in IndexedDB when enabled, allowing restoration across
  sessions. The `persist` flag enables saving widget configurations to IndexedDB, while `transient` indicates that the
  data is temporary with a lifespan defined by the `ttl` property (in seconds).

### Classes Overview

- **`WidgetManager`**: Central singleton that orchestrates widget management, delegating specific behaviors to
  `WidgetDraggable`, `WidgetResizable`, `WidgetCropper`, and `WidgetDBManager`.
- **`WidgetDraggable`**: Singleton responsible for handling drag start and end events, updating widget positions, and
  coordinating with `WidgetCropper` for crop zones.
- **`WidgetResizable`**: Singleton responsible for handling resize events, updating widget dimensions, and coordinating
  with `WidgetCropper` for crop zones.
- **`WidgetCropper`**: Singleton responsible for managing crop zone dimensions, overlay synchronization, aspect ratio
  updates, and double-click toggling.
- **`WidgetDBManager`**: Singleton responsible for managing persistence of widget configurations in IndexedDB.

## Installation

Ensure the following dependencies are included in your project:

- `uuid` for generating unique widget IDs.
- Constants from `@Core/constants` (e.g., `LGS_ANIMATION_DRAGGING`, `LGS_ANIMATION_RESIZING`, `SECOND`).

```bash
npm install uuid
```

Include the necessary files in your project:

```javascript
import { WidgetManager }   from './WidgetManager.js'
import { WidgetDraggable } from './WidgetDraggable.js'
import { WidgetResizable } from './WidgetResizable.js'
import { WidgetCropper }   from './WidgetCropper.js'
import { WidgetDBManager } from '@Core/ui/widget-manager/WidgetDBManager'
```

## Usage

### Creating the Singleton Instance

`WidgetManager` is a singleton, so you only need to instantiate it once. You can optionally pass a shared store during
initialization.

```javascript
const widgetManager = new WidgetManager(store)
```

### Setting Up a Widget

To initialize a draggable, resizable, or croppable widget, call the `setupElement` method with the required parameters.

```javascript
/**
 * Initialize a draggable/resizable widget
 * @param {HTMLElement} element - The DOM element to manage
 * @param {Object} initialConfig - Configuration object
 * @param {Function} setBounds - Callback to update bounds state
 * @param {Function} setPosition - Callback to update position state
 * @param {Object} moveable - Reference to Moveable instance
 * @returns {boolean} - Success status
 */
const success = widgetManager.setupElement(
        element,
        {
            id:               'widget-1',
            container:        document.querySelector('#container'),
            isCropper:        true,
            showControlBox:   true,
            margin:    10,
            ratio:            '16x9',
            minCropSize:      {width: 100, height: 100},
            outsideOverlay:   document.querySelector('#overlay'),
            resizeFromCenter: true,
            group:     'video-tools', // Group identifier
            persist:   true,         // Enable persistence in IndexedDB
            transient: true,         // Mark as temporary with TTL
            ttl:       3600          // Time-to-live in seconds (1 hour)
        },
        setBounds,
        setPosition,
        moveableRef
    )
```

### Updating Crop Aspect Ratio

To update the aspect ratio of a crop zone, use the `updateCropRatio` method, which is delegated to `WidgetCropper`.

```javascript
/**
 * Update the aspect ratio of a crop zone
 * @param {string} cropzoneId - ID of the crop zone
 * @param {number} aspectRatio - New aspect ratio (width/height)
 * @param {boolean} lockRatio - Whether to lock the aspect ratio
 */
widgetManager.updateCropRatio('widget-1', 16 / 9, true)
```

### Managing Widgets by Group

To retrieve or dispose of widgets in a group:

```javascript
/**
 * Retrieve widget configurations by group ID
 * @param {string} groupId - The group identifier
 * @returns {Object[]} Array of widget configurations
 */
const configs = widgetManager.getWidgetConfigByGroup('video-tools')

/**
 * Dispose widgets by group ID
 * @param {string} groupId - The group identifier
 * @param {boolean} usePersist - Whether to respect persist flag
 */
widgetManager.disposeByGroup('video-tools', true)
```

### Handling Events

`WidgetManager` emits custom events (`onCropUpdate`) via `WidgetCropper` during crop-related changes. Listen for these
events to synchronize your application state.

```javascript
document.addEventListener('onCropUpdate', event => {
    const {id, crop, ratio, phase} = event.detail
    console.log(`Crop updated for ${id}:`, crop, ratio, phase)
})
```

### Disposing a Widget

To clean up a widget and stop observing its container, use the `disposeElement` method.

```javascript
/**
 * Dispose a widget and clean up resources
 * @param {HTMLElement} element - The DOM element to dispose
 */
widgetManager.disposeElement(element)
```

## Configuration Options

The `initialConfig` object passed to `setupElement` supports the following properties:

| Property                | Type          | Description                                                                  |
|-------------------------|---------------|------------------------------------------------------------------------------|
| `id`                    | string        | Unique identifier for the widget (optional; auto-generated if not provided). |
| `container`             | HTMLElement   | The container element for bounds and resize observation.                     |
| `isCropper`             | boolean       | Whether the widget is a crop zone.                                           |
| `showControlBox`        | boolean       | Whether to display a control box for resizing/dragging.                      |
| `margin`                | number        | Margin around the widget (in pixels).                                        |
| `ratio`                 | string        | Aspect ratio identifier (e.g., '16x9', '9x16', '1x1').                       |
| `minCropSize`           | Object        | Minimum crop dimensions `{ width: number, height: number }`.                 |
| `outsideOverlay`        | HTMLElement   | Overlay element for crop zone clipping.                                      |
| `resizeFromCenter`      | boolean       | Whether resizing adjusts from the center or edge.                            |
| `animationWhenDragging` | boolean       | Whether to apply drag animation (uses `LGS_ANIMATION_DRAGGING` class).       |
| `left`                  | number/string | Initial left position (pixels or percentage).                                |
| `top`                   | number/string | Initial top position (pixels or percentage).                                 |
| `attachTo`              | string        | Anchor position (e.g., 'center', 'top-left', 'bottom-right').                |
| `group`                 | string/null   | Group identifier for collective widget management.                           |
| `persist`               | boolean       | Whether to save widget configuration in IndexedDB.                           |
| `transient`             | boolean       | Whether the widget configuration is temporary, with lifespan set by `ttl`.   |
| `dynamic`               | boolean       | Whether the widget is dynamically managed (specific usage TBD).              |
| `ttl`                   | number        | Time-to-live for persisted data in IndexedDB (in seconds, defaults to 3600). |

## Methods

### WidgetManager

- **retrieveElementId(element)**: Retrieves the unique ID of an element.
- **setupElement(element, initialConfig, setBounds, setPosition, moveable)**: Initializes a widget with drag, resize,
  and optional crop functionality.
- **updateCropRatio(cropzoneId, aspectRatio, lockRatio)**: Updates the crop zone's aspect ratio (delegates to
  `WidgetCropper`).
- **applyPosition(element, position, moveable, isDragging, setControlBoxProps)**: Applies position styles (transform or
  left/top).
- **manageControlBox(moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver)**: Manages control box
  visibility.
- **disposeElement(element)**: Cleans up a widget and its resources.
- **getWidgetConfig(elementId)**: Retrieves the configuration for a widget.
- **getElementById(id)**: Retrieves a widget element by ID.
- **setConfig(elementId, config)**: Sets the configuration for a widget.
- **getWidgetConfigByGroup(groupId)**: Retrieves all widget configurations in a group.
- **disposeByGroup(groupId, usePersist)**: Disposes all widgets in a group, respecting `persist` flag.
- **onDragStart(event)**: Handles drag start (delegates to `WidgetDraggable`).
- **onDragEnd(event)**: Handles drag end (delegates to `WidgetDraggable`).
- **onResizeStart(event)**: Handles resize start (delegates to `WidgetResizable`).
- **onResize(event, refs, setPosition)**: Handles resize (delegates to `WidgetResizable`).
- **onResizeEnd(event)**: Handles resize end (delegates to `WidgetResizable`).
- **onDoubleClick(event, setPosition)**: Handles double-click for crop toggling (delegates to `WidgetCropper`).
- **cropDimensions(config, maximize)**: Computes crop dimensions (delegates to `WidgetCropper`).
- **applyCropToOverlay(config)**: Applies crop to overlay (delegates to `WidgetCropper`).
- **openWindowInOverlay(crop)**: Creates clip-path for overlay (delegates to `WidgetCropper`).
- **saveWidgetPosition(widgetId, config)**: Saves widget configuration to IndexedDB with a 1-hour TTL (delegates to
  `WidgetDBManager`).
- **getWidgetPosition(widgetId)**: Retrieves widget configuration from IndexedDB if not expired (delegates to
  `WidgetDBManager`).
- **getWidgetsByGroup(groupId)**: Retrieves all widget configurations for a group from IndexedDB (delegates to
  `WidgetDBManager`).
- **deleteWidgetsByGroup(groupId)**: Deletes all widget configurations for a group from IndexedDB (delegates to
  `WidgetDBManager`).

### WidgetDraggable

- **onDragStart(event)**: Applies drag styles and sets the dragging state.
- **onDragEnd(event)**: Finalizes drag operation, updates widget position, and synchronizes crop overlay via
  `WidgetCropper`.

### WidgetResizable

- **onResizeStart(event)**: Applies resize styles and sets the resizing state.
- **onResize(event, refs, setPosition)**: Updates element styles and overlay during resize.
- **onResizeEnd(event)**: Finalizes resize operation, updates dimensions, and synchronizes crop overlay via
  `WidgetCropper`.

### WidgetCropper

- **setupCropper(element, config)**: Initializes crop-specific properties for an element.
- **applyCropToOverlay(config)**: Updates an outside overlay's `clip-path` to align with crop dimensions.
- **cropDimensions(config, maximize)**: Computes crop dimensions based on container and aspect ratio.
- **openWindowInOverlay(crop)**: Creates a CSS clip-path for the crop overlay.
- **onDoubleClick(event, setPosition)**: Toggles crop zone between maximized and previous dimensions.
- **updateCropRatio(cropzoneId, aspectRatio, lockRatio)**: Updates crop zone dimensions and aspect ratio.
- **dispatchCropUpdate(config, phase)**: Dispatches `onCropUpdate` events for crop changes.

### WidgetDBManager

- **saveWidgetPosition(widgetId, config)**: Saves widget configuration to IndexedDB.
- **getWidgetPosition(widgetId)**: Retrieves widget configuration from IndexedDB if not expired.
- **deleteWidgetPosition(widgetId)**: Deletes widget configuration from IndexedDB.
- **getWidgetsByGroup(groupId)**: Retrieves all widget configurations for a group from IndexedDB.
- **deleteWidgetsByGroup(groupId)**: Deletes all widget configurations for a group from IndexedDB.

## Event Handling

The `WidgetCropper` class emits `onCropUpdate` events during crop-related changes, with the following details:

- `id`: The widget's unique ID.
- `crop`: Object containing `{ left, top, width, height }` of the crop zone.
- `ratio`: Object containing `{ aspectRatio, locked }` for the crop zone.
- `phase`: String indicating the event phase (`init`, `resize`, `ratio`, `container-resize`, `end`, `toggle`).

Example:

```javascript
document.addEventListener('onCropUpdate', event => {
    const {id, crop, ratio, phase} = event.detail
    console.log(`Crop updated for ${id}:`, crop, ratio, phase)
})
```

## Notes

- The `WidgetManager` assumes the presence of a `Moveable` library for drag and resize functionality.
- The singleton pattern ensures only one instance of each class (`WidgetManager`, `WidgetDraggable`, `WidgetResizable`,
  `WidgetCropper`, `WidgetDBManager`) manages all widgets, preventing conflicts.
- The `margin` and `minCropSize` properties enforce constraints for crop zones, handled by `WidgetCropper`.
- Aspect ratio handling respects the `useRatio` and `ratio` configuration to maintain consistent proportions.
- Group management allows for efficient handling of related widgets (e.g., disposing all widgets in a group).
- The `persist` flag enables saving widget configurations to IndexedDB, while `transient` marks configurations as
  temporary with a lifespan defined by `ttl`.
- The interface remains transparent, so components interact only with `WidgetManager`, unaware of the delegated classes.

## License

Copyright © 2025 LGS1920. All rights reserved.