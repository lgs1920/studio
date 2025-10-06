# LGS1920/studio - WidgetManager

## Overview

`WidgetManager` is a singleton class in the `LGS1920/studio` project designed to manage draggable and resizable widgets
within a container. It handles widget positioning, bounds enforcement, snapping, resizing, and synchronization of crop
overlays. Additionally, it supports container resize observation and double-click/tap events for toggling crop zones
between maximized and previous sizes.

### Key Responsibilities

- **Widget Initialization**: Sets up draggable elements with unique IDs, applies initial positions or crop dimensions,
  and ensures elements stay within container bounds.
- **Drag and Resize Handling**: Manages drag and resize operations, applying transforms during drag and collapsing to
  `left`/`top` styles on drag end.
- **Crop Overlay Synchronization**: Updates an outside overlay's `clip-path` to align with the crop zone's dimensions.
- **Container Resize Observation**: Monitors container size changes and adjusts widget positions or crop zones,
  respecting aspect ratio locks.
- **Double-Click/Tap Support**: Toggles crop zones between maximized and previous dimensions on double-click or tap.
- **Aspect Ratio Management**: Updates crop zone dimensions based on specified aspect ratios while maintaining container
  constraints.

## Installation

Ensure the following dependencies are included in your project:

- `uuid` for generating unique widget IDs.
- Constants from `@Core/constants` (e.g., `LGS_ANIMATION_DRAGGING`, `LGS_ANIMATION_RESIZING`, `SECOND`).

```bash
npm install uuid
```

Include the `WidgetManager.js` file in your project:

```javascript
import { WidgetManager } from './WidgetManager.js'
```

## Usage

### Creating the Singleton Instance

The `WidgetManager` is a singleton, so you only need to instantiate it once. You can optionally pass a shared store
during initialization.

```javascript
const widgetManager = new WidgetManager(store)
```

### Setting Up a Widget

To initialize a draggable or resizable widget, call the `setupElement` method with the required parameters.

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
            containerPadding: 10,
            ratio:            '16x9',
            minCropSize:      {width: 100, height: 100},
            outsideOverlay:   document.querySelector('#overlay'),
            resizeFromCenter: true
        },
        setBounds,
        setPosition,
        moveableRef
    )
```

### Updating Crop Aspect Ratio

To update the aspect ratio of a crop zone, use the `updateCropRatio` method.

```javascript
/**
 * Update the aspect ratio of a crop zone
 * @param {string} cropzoneId - ID of the crop zone
 * @param {number} aspectRatio - New aspect ratio (width/height)
 * @param {boolean} lockRatio - Whether to lock the aspect ratio
 */
widgetManager.updateCropRatio('widget-1', 16 / 9, true)
```

### Handling Events

The `WidgetManager` emits custom events (`onCropUpdate`) during crop-related changes. Listen for these events to
synchronize your application state.

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
| `containerPadding`      | number        | Padding inside the container (in pixels).                                    |
| `ratio`                 | string        | Aspect ratio identifier (e.g., '16x9', '9x16', '1x1').                       |
| `minCropSize`           | Object        | Minimum crop dimensions `{ width: number, height: number }`.                 |
| `outsideOverlay`        | HTMLElement   | Overlay element for crop zone clipping.                                      |
| `resizeFromCenter`      | boolean       | Whether resizing adjusts from the center or edge.                            |
| `animationWhenDragging` | boolean       | Whether to apply drag animation (uses `LGS_ANIMATION_DRAGGING` class).       |
| `left`                  | number/string | Initial left position (pixels or percentage).                                |
| `top`                   | number/string | Initial top position (pixels or percentage).                                 |
| `attachTo`              | string        | Anchor position (e.g., 'center', 'top-left', 'bottom-right').                |

## Methods

Below are the key public methods of the `WidgetManager` class:

- **retrieveElementId(element)**: Retrieves the unique ID of an element.
- **setupElement(element, initialConfig, setBounds, setPosition, moveable)**: Initializes a widget.
- **updateCropRatio(cropzoneId, aspectRatio, lockRatio)**: Updates the crop zone's aspect ratio.
- **applyPosition(element, position, moveable, isDragging, setControlBoxProps)**: Applies position styles (transform or
  left/top).
- **manageControlBox(moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver)**: Manages control box
  visibility.
- **disposeElement(element)**: Cleans up a widget and its resources.
- **getConfig(elementId)**: Retrieves the configuration for a widget.
- **setConfig(elementId, config)**: Sets the configuration for a widget.

## Event Handling

The `WidgetManager` supports the following Moveable events:

- **onDragStart**: Applies drag styles and sets the dragging flag.
- **onDragEnd**: Collapses transform to `left`/`top`, updates crop dimensions, and syncs overlay.
- **onResizeStart**: Applies resize styles and sets the resizing flag.
- **onResize**: Updates element styles and overlay during resize.
- **onResizeEnd**: Cleans up styles and finalizes crop dimensions.
- **onDoubleClick**: Toggles crop zone between maximized and previous dimensions.

## Notes

- The `WidgetManager` assumes the presence of a `Moveable` library for drag and resize functionality.
- The `onCropUpdate` event provides details about crop changes, including the widget ID, crop dimensions, aspect ratio,
  and phase (`init`, `resize`, `ratio`, `container-resize`, `end`, `toggle`).
- The singleton ensures only one instance manages all widgets, preventing conflicts.
- The `containerPadding` and `minCropSize` properties help enforce constraints for crop zones.
- Aspect ratio handling respects the `useRatio` and `ratio` configuration to maintain consistent proportions.

## License

Copyright © 2025 LGS1920. All rights reserved.