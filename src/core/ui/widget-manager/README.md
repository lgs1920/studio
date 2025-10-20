# LGS1920/studio - WidgetManager

## Overview

`WidgetManager` is a singleton class in the `LGS1920/studio` project designed to manage draggable, resizable, scalable,
and croppable widgets within a container. It serves as a transparent interface, delegating specific functionalities to
specialized utility classes: `WidgetCore`, `WidgetDraggable`, `WidgetResizable`, `WidgetScalable`, `WidgetCropper`,
`WidgetPosition`, `WidgetTransform`, and `WidgetDBManager`. This modular architecture ensures maintainability and allows
components to interact solely with `WidgetManager` without knowledge of the underlying implementations.

### Key Responsibilities

- **Widget Initialization**: Configures DOM elements as widgets with unique IDs, applies initial positions, and ensures
  they stay within container bounds.
- **Drag, Resize, and Scale Delegation**: Delegates drag, resize, and scale operations to `WidgetDraggable`,
  `WidgetResizable`, and `WidgetScalable`, respectively, while tracking states like `isDragging`, `isResizing`, and
  `isScaling`.
- **Crop Management**: Delegates cropping operations (e.g., crop dimensions, overlay synchronization, double-click
  toggling) to `WidgetCropper`.
- **Positioning**: Delegates positioning logic (e.g., centering, aligning to edges) to `WidgetPosition`.
- **Transform Management**: Delegates transformation operations (e.g., scale, translate) to `WidgetTransform`.
- **Container Resize Observation**: Monitors container size changes and adjusts widget positions and dimensions via
  `WidgetCore`.
- **Group Management**: Supports grouping widgets for collective retrieval and disposal.
- **Persistence**: Manages widget configuration persistence in IndexedDB via `WidgetDBManager` when the `persist` flag
  is enabled. The `transient` flag marks configurations as temporary with a lifespan defined by the `ttl` property (in
  seconds).

### Classes Overview

- **`WidgetManager`**: Singleton interface orchestrating widget management, delegating tasks to utility classes.
- **`WidgetCore`**: Handles core widget functionality, including configuration storage, bounds management, control box
  visibility, and container resize observation.
- **`WidgetDraggable`**: Manages drag start, drag, and drag end events, updating widget positions and coordinating with
  `WidgetCropper`.
- **`WidgetResizable`**: Manages resize start, resize, and resize end events, updating widget dimensions and
  synchronizing crop overlays.
- **`WidgetScalable`**: Manages scale start, scale, and scale end events, updating widget transformations.
- **`WidgetCropper`**: Manages crop zone dimensions, overlay synchronization, aspect ratio updates, and double-click
  toggling.
- **`WidgetPosition`**: Provides methods for positioning widgets at specific container locations (e.g., center,
  top-left).
- **`WidgetTransform`**: Manages CSS transformations (e.g., scale, translate) for widgets.
- **`WidgetDBManager`**: Manages persistence of widget configurations in IndexedDB, including saving, retrieving, and
  deleting data.

## Installation

Ensure the following dependencies are included:

- `uuid` for generating unique widget IDs.
- Constants from `@Core/constants` (e.g., `SECOND`).

```bash
bun add uuid
```

Include the necessary files:

```javascript
import { WidgetManager } from './WidgetManager.js'
import { WidgetCore }      from './WidgetCore.js'
import { WidgetDraggable } from './WidgetDraggable.js'
import { WidgetResizable } from './WidgetResizable.js'
import { WidgetScalable }  from './WidgetScalable.js'
import { WidgetCropper }   from './WidgetCropper.js'
import { WidgetPosition }  from './WidgetPosition.js'
import { WidgetTransform } from './WidgetTransform.js'
import { WidgetDBManager } from '@Core/ui/widget-manager/WidgetDBManager'
```

## Usage

### Creating the Singleton Instance

`WidgetManager` is a singleton, ensuring a single instance manages all widgets. Optionally pass a shared store (
currently unused).

```javascript
const widgetManager = new WidgetManager(store)
```

### Retrieving Widget Configuration

Use `retrieveConfig` to get or create a widget's configuration, including saved positions from IndexedDB.

```javascript
const element = document.querySelector('#widget-1')
const config = await widgetManager.retrieveConfig(element, {
    id:        'widget-1',
    container: document.querySelector('#container'),
    isCropper: true,
    persist:   true
})
console.log('Widget config:', config)
```

### Setting Up a Widget

Initialize a widget with `setupElement`.

```javascript
import Moveable from 'moveable'

const element = document.querySelector('#widget-1')
const container = document.querySelector('#container')
const moveable = {current: new Moveable(container)}
const setBounds = bounds => console.log('Bounds updated:', bounds)
const setPosition = position => console.log('Position updated:', position)

const success = await widgetManager.setupElement(
    element,
    {
        id:               'widget-1',
        container:        container,
        isCropper:        true,
        showControlBox:   true,
        margin:           10,
        ratio:            '16x9',
        minCropSize: {width: 100, height: 100},
        outsideOverlay:   document.querySelector('#overlay'),
        resizeFromCenter: true,
        group:            'video-tools',
        persist:          true,
        transient:        true,
        ttl:              3600 // 1 hour
    },
    setBounds,
    setPosition,
    moveable
)
console.log('Widget setup:', success)
```

### Updating Crop Aspect Ratio

Update a crop zone's aspect ratio.

```javascript
widgetManager.updateCropRatio('widget-1', 16 / 9, true)
```

### Positioning a Widget

Position a widget using methods like `toCenter`.

```javascript
widgetManager.toCenter(element, 10) // Center with 10px margin
```

### Managing Widgets by Group

Retrieve or dispose of widgets in a group.

```javascript
const configs = widgetManager.getWidgetConfigByGroup('video-tools')
console.log('Group configs:', configs)

widgetManager.disposeByGroup('video-tools', true)
```

### Handling Events

Listen for `onCropUpdate` events.

```javascript
document.addEventListener('onCropUpdate', event => {
    const {id, crop, ratio, phase} = event.detail
    console.log(`Crop updated for ${id}:`, crop, ratio, phase)
})
```

### Disposing a Widget

Clean up a widget.

```javascript
widgetManager.disposeElement(element)
```

## Configuration Options

The `initialConfig` object for `setupElement` and `retrieveConfig` supports:

| Property                | Type          | Description                                                            |
|-------------------------|---------------|------------------------------------------------------------------------|
| `id`                    | string        | Unique widget ID (auto-generated if not provided).                     |
| `container`             | HTMLElement   | Container for bounds and resize observation.                           |
| `isCropper`             | boolean       | Whether the widget is a crop zone.                                     |
| `showControlBox`        | boolean       | Whether to show a control box for dragging/resizing.                   |
| `margin`                | number        | Margin around the widget (pixels).                                     |
| `ratio`                 | string        | Aspect ratio (e.g., '16x9', '9x16', '1x1').                            |
| `minCropSize`           | Object        | Minimum crop dimensions `{ width: number, height: number }`.           |
| `outsideOverlay`        | HTMLElement   | Overlay element for crop zone clipping.                                |
| `resizeFromCenter`      | boolean       | Whether resizing adjusts from the center or edge.                      |
| `animationWhenDragging` | boolean       | Whether to apply drag animation (uses `LGS_ANIMATION_DRAGGING` class). |
| `animationWhenScaling`  | boolean       | Whether to apply scale animation (uses `LGS_ANIMATION_SCALING` class). |
| `left`                  | number/string | Initial left position (pixels or percentage).                          |
| `top`                   | number/string | Initial top position (pixels or percentage).                           |
| `attachTo`              | string        | Anchor position (e.g., 'center', 'top-left', 'bottom-right').          |
| `group`                 | string/null   | Group identifier for collective management.                            |
| `persist`               | boolean       | Whether to save configuration in IndexedDB.                            |
| `transient`             | boolean       | Whether configuration is temporary (uses `ttl`).                       |
| `dynamic`               | boolean       | Whether the widget is dynamically managed (specific usage TBD).        |
| `ttl`                   | number        | Time-to-live for persisted data (seconds, defaults to 3600).           |
| `translate`             | Object        | Initial translation `{ x: number, y: number }`.                        |
| `scale`                 | Object        | Initial scale `{ x: number, y: number }`.                              |
| `rotate`                | number        | Initial rotation (degrees).                                            |

## Classes and Methods

### WidgetManager

**Attributes**:
- `#instance` (static, private): Singleton instance.
- `#draggable` (private): `WidgetDraggable` instance.
- `#resizable` (private): `WidgetResizable` instance.
- `#scalable` (private): `WidgetScalable` instance.
- `#cropper` (private): `WidgetCropper` instance.
- `#widgetDB` (private): `WidgetDBManager` instance.
- `#position` (private): `WidgetPosition` instance.
- `#transform` (private): `WidgetTransform` instance.
- `#core` (private): `WidgetCore` instance.
- `transform` (getter): Returns `WidgetTransform` instance.
- `isDragging` (getter/setter): Indicates if a widget is being dragged.
- `isResizing` (getter/setter): Indicates if a widget is being resized.
- `isScaling` (getter/setter): Indicates if a widget is being scaled.
- `windowResizing` (getter/setter): Indicates if window resizing impacts widgets.

**Methods**:

- `constructor(store)`: Creates or returns the singleton instance
- `retrieveConfig(element, initialConfig)`: Retrieves or creates widget configuration, including saved positions from
  IndexedDB
- `retrieveElementId(element)`: Retrieves the element's ID from its data attribute
- `setupElement(element, initialConfig, setBounds, setPosition, moveable)`: Initializes a widget
- `applyPosition(element, position, moveable, isDragging, setControlBoxProps)`: Applies position styles
- `manageControlBox(moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver)`: Manages control box visibility
- `getRatio(ratio)`: Retrieves video format ratio configuration
- `computeInitialPosition(config, element, isResize)`: Computes initial widget position
- `refreshBounds(config, moveable)`: Refreshes container bounds
- `setBoundStatus(element, config)`: Sets boundary status
- `getWidgetConfig(elementId)`: Retrieves widget configuration
- `getElementById(id)`: Retrieves widget element by ID
- `getIdFromElement(element)`: Retrieves widget ID from element
- `getInnerOverlay(element)`: Retrieves inner overlay element
- `setConfig(elementId, config)`: Sets widget configuration
- `getWidgetConfigByGroup(groupId)`: Retrieves widget configurations by group
- `disposeElement(element)`: Disposes a widget
- `disposeByGroup(groupId, usePersist)`: Disposes widgets in a group
- `monitorContainerResize(config, setBounds, moveable, element, setPosition)`: Monitors container resize
- `onDrag(event)`: Handles drag events (delegates to `WidgetDraggable`)
- `onDragStart(event)`: Handles drag start (delegates to `WidgetDraggable`)
- `onDragEnd(event)`: Handles drag end (delegates to `WidgetDraggable`)
- `onResizeStart(event)`: Handles resize start (delegates to `WidgetResizable`)
- `onResize(event, refs, setPosition)`: Handles resize (delegates to `WidgetResizable`)
- `onResizeEnd(event)`: Handles resize end (delegates to `WidgetResizable`)
- `onScaleStart(event)`: Handles scale start (delegates to `WidgetScalable`)
- `onScale(event, refs, setPosition)`: Handles scale (delegates to `WidgetScalable`)
- `onScaleEnd(event)`: Handles scale end (delegates to `WidgetScalable`)
- `onDoubleClick(event, setPosition)`: Handles double-click (delegates to `WidgetCropper`)
- `updateCropRatio(cropzoneId, aspectRatio, lockRatio)`: Updates crop ratio (delegates to `WidgetCropper`)
- `cropDimensions(config, maximize)`: Computes crop dimensions (delegates to `WidgetCropper`)
- `applyCropToOverlay(config)`: Applies crop to overlay (delegates to `WidgetCropper`)
- `openWindowInOverlay(crop)`: Creates clip-path for overlay (delegates to `WidgetCropper`)
- `saveWidgetPosition(widgetId, config)`: Saves widget position (delegates to `WidgetDBManager`)
- `getWidgetPosition(widgetId)`: Retrieves widget position (delegates to `WidgetDBManager`)
- `getWidgetsByGroup(groupId)`: Retrieves widgets by group (delegates to `WidgetDBManager`)
- `deleteWidgetsByGroup(groupId)`: Deletes widgets by group (delegates to `WidgetDBManager`)
- `deleteWidgetPosition(widgetId)`: Deletes widget position (delegates to `WidgetDBManager`)
- `toCenter(element, margin)`: Positions widget at container center (delegates to `WidgetPosition`)
- `toTopLeft(element, margin)`: Positions widget at top-left (delegates to `WidgetPosition`)
- `toTop(element, margin)`: Positions widget at top (delegates to `WidgetPosition`)
- `toLeft(element, margin)`: Positions widget at left (delegates to `WidgetPosition`)
- `toRight(element, margin)`: Positions widget at right (delegates to `WidgetPosition`)
- `toBottom(element, margin)`: Positions widget at bottom (delegates to `WidgetPosition`)
- `toTopRight(element, margin)`: Positions widget at top-right (delegates to `WidgetPosition`)
- `toBottomLeft(element, margin)`: Positions widget at bottom-left (delegates to `WidgetPosition`)
- `toBottomRight(element, margin)`: Positions widget at bottom-right (delegates to `WidgetPosition`)

### WidgetCore

**Attributes**:

- `#widgetManager` (private): Reference to `WidgetManager`
- `#ID_KEY` (private): Data attribute key for element IDs (`'data-LGS-ID'`)
- `#widgets` (private): Map of widget configurations
- `#validPositions` (private): Array of valid position anchors
- `#isDragging` (private): Indicates if a widget is being dragged
- `#isResizing` (private): Indicates if a widget is being resized
- `#isScaling` (private): Indicates if a widget is being scaled
- `#windowResizing` (private): Indicates if window resizing impacts widgets
- `#controlBoxTimers` (private): Map of timers for hiding control boxes
- `#current` (private): ID of the currently active widget
- `HIDE_DELAY` (public): Delay for hiding control box (2 seconds)
- `isDragging` (getter/setter): Accesses `#isDragging`
- `isResizing` (getter/setter): Accesses `#isResizing`
- `isScaling` (getter/setter): Accesses `#isScaling`
- `windowResizing` (getter/setter): Accesses `#windowResizing`

**Methods**:

- `constructor(widgetManager)`: Initializes with `WidgetManager` reference
- `retrieveElementId(element)`: Retrieves element ID from data attribute
- `#throttle(func, limit)`: Throttles a function to limit execution rate
- `#hideControlBoxWithTimer(moveable, config, setControlBoxProps, isMouseOver)`: Hides control box with delay
- `setupElement(element, initialConfig, setBounds, setPosition, moveable)`: Initializes a widget
- `applyPosition(element, position, moveable, isDragging, setControlBoxProps)`: Applies position styles
- `manageControlBox(moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver)`: Manages control box visibility
- `getRatio(ratio)`: Retrieves video format ratio
- `computeInitialPosition(config, element, isResize)`: Computes initial position
- `refreshBounds(config, moveable)`: Refreshes container bounds
- `setBoundStatus(element, config)`: Sets boundary status
- `#createInnerOverlay(element)`: Creates inner overlay element
- `#computeElementBounds(element)`: Computes element bounds
- `disposeElement(element)`: Disposes a widget
- `getWidgetConfigByGroup(groupId)`: Retrieves widget configurations by group
- `disposeByGroup(groupId, usePersist)`: Disposes widgets in a group
- `getWidgetConfig(elementId)`: Retrieves widget configuration
- `getElementById(id)`: Retrieves widget element by ID
- `getIdFromElement(element)`: Retrieves widget ID from element
- `getInnerOverlay(element)`: Retrieves inner overlay element
- `setConfig(elementId, config)`: Sets widget configuration
- `monitorContainerResize(config, setBounds, moveable, element, setPosition)`: Monitors container resize
- `retrieveConfig(element, initialConfig)`: Retrieves or creates widget configuration

### WidgetDraggable

**Attributes**:

- `#widgetManager` (private): Reference to `WidgetManager`
- `#cropper` (private): Reference to `WidgetCropper`
- `#transform` (private): Reference to `WidgetTransform`

**Methods**:

- `constructor(widgetManager, cropper, transform)`: Initializes with references
- `onDragStart(event)`: Handles drag start, applying styles and setting state
- `onDrag(event)`: Updates widget position and crop overlay during drag
- `onDragEnd(event)`: Finalizes drag, updates position, and synchronizes crop

### WidgetResizable

**Attributes**:

- `#widgetManager` (private): Reference to `WidgetManager`
- `#cropper` (private): Reference to `WidgetCropper`

**Methods**:

- `constructor(widgetManager, cropper)`: Initializes with references
- `onResizeStart(event)`: Handles resize start, applying styles and setting state
- `onResize(event, refs, setPosition)`: Updates dimensions and crop overlay during resize
- `onResizeEnd(event)`: Finalizes resize, updates dimensions, and synchronizes crop

### WidgetScalable

**Attributes**:

- `#widgetManager` (private): Reference to `WidgetManager`
- `#cropper` (private): Reference to `WidgetCropper`
- `#transform` (private): Reference to `WidgetTransform`

**Methods**:

- `constructor(widgetManager, cropper, transform)`: Initializes with references
- `onScaleStart(event)`: Handles scale start, setting state
- `onScale(event, refs, setPosition)`: Updates scale and position during scaling
- `onScaleEnd(event)`: Finalizes scale, updates transformations

### WidgetCropper

**Attributes**:

- `#widgetManager` (private): Reference to `WidgetManager`

**Methods**:

- `constructor(widgetManager)`: Initializes with `WidgetManager` reference
- `setupCropper(element, config)`: Initializes crop-specific properties
- `applyCropToOverlay(config)`: Updates overlay clip-path
- `cropDimensions(config, maximize)`: Computes crop dimensions
- `openWindowInOverlay(crop)`: Creates CSS clip-path for overlay
- `onDoubleClick(event, setPosition)`: Toggles crop between maximized and previous dimensions
- `updateCropRatio(cropzoneId, aspectRatio, lockRatio)`: Updates crop dimensions and ratio
- `dispatchCropUpdate(config, phase)`: Dispatches `onCropUpdate` events

### WidgetPosition

**Attributes**:

- `#widgetManager` (private): Reference to `WidgetManager`

**Methods**:

- `constructor(widgetManager)`: Initializes with `WidgetManager` reference
- `toCenter(element, margin)`: Positions widget at container center
- `toTopLeft(element, margin)`: Positions widget at top-left
- `toTop(element, margin)`: Positions widget at top
- `toLeft(element, margin)`: Positions widget at left
- `toRight(element, margin)`: Positions widget at right
- `toBottom(element, margin)`: Positions widget at bottom
- `toTopRight(element, margin)`: Positions widget at top-right
- `toBottomLeft(element, margin)`: Positions widget at bottom-left
- `toBottomRight(element, margin)`: Positions widget at bottom-right

### WidgetTransform

**Attributes**:

- `#widgetManager` (private): Reference to `WidgetManager`

**Methods**:

- `constructor(widgetManager)`: Initializes with `WidgetManager` reference
- `setScale(element, x, y)`: Applies scale transformation
- `setTranslate(element, x, y)`: Applies translate transformation
- `parseTransform(transform)`: Parses CSS transform string into components

### WidgetDBManager

**Attributes**:

- `#widgetManager` (private): Reference to `WidgetManager`

**Methods**:

- `constructor(widgetManager)`: Initializes with `WidgetManager` reference
- `saveWidgetPosition(widgetId, config)`: Saves widget configuration to IndexedDB
- `getWidgetPosition(widgetId)`: Retrieves widget configuration from IndexedDB
- `deleteWidgetPosition(widgetId)`: Deletes widget configuration from IndexedDB
- `getWidgetsByGroup(groupId)`: Retrieves widget configurations by group
- `deleteWidgetsByGroup(groupId)`: Deletes widget configurations by group

## Event Handling

`WidgetCropper` emits `onCropUpdate` events with details:

- `id`: Widget ID
- `crop`: `{ left, top, width, height }` of the crop zone
- `ratio`: `{ aspectRatio, locked }` for the crop zone
- `phase`: Event phase (`init`, `resize`, `ratio`, `container-resize`, `end`, `toggle`)

Example:

```javascript
document.addEventListener('onCropUpdate', event => {
    const {id, crop, ratio, phase} = event.detail
    console.log(`Crop updated for ${id}:`, crop, ratio, phase)
})
```

## Notes

- Requires `Moveable` library for drag, resize, and scale functionality
- Singleton pattern ensures one instance per class, preventing conflicts
- `margin` and `minCropSize` enforce crop constraints in `WidgetCropper`
- Aspect ratio handling respects `useRatio` and `ratio` configuration
- Group management enables efficient handling of related widgets
- `persist` and `transient` flags control IndexedDB storage with `ttl`
- All interactions go through `WidgetManager`, maintaining a transparent interface
- No external CSS libraries; styles applied programmatically
- Arrow functions (`=>`) used except for constructors
- Private fields use `#` prefix; DOM elements use `element` naming
- JSDocs in English without semicolons
- `WidgetCore` corrected to use public methods of `WidgetManager` instead of private fields (e.g., `#cropper`)

## License

Copyright © 2025 LGS1920. All rights reserved.