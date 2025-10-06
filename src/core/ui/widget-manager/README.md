# WidgetManager

`WidgetManager` is a singleton JavaScript class designed to manage draggable and resizable widgets within a container.
It handles bounds clamping, snapping, drag-and-drop, resizing, and synchronization of crop overlays. The class is
optimized for use with React and integrates with `react-moveable` for interactive drag and resize functionality. It
supports both standard widgets and cropper elements, with options for aspect ratio locking and centered resizing.

## Features

- **Drag and Drop**: Move widgets within a container with bounds clamping.
- **Resizable Widgets**: Resize elements with optional aspect ratio locking and centered resizing.
- **Crop Overlay Sync**: Synchronizes an outside overlay's clip-path with the crop zone for cropper elements.
- **Container Resize Handling**: Automatically adjusts widget positions and crop dimensions when the container resizes.
- **Singleton Pattern**: Ensures a single instance manages all draggable elements.
- **Customizable Configuration**: Supports anchor positions, aspect ratios, minimum crop sizes, and more.

## Installation

Required dependencies:

- `uuid`
- `react-moveable`
- `@fortawesome/pro-regular-svg-icons`
- `@shoelace-style/shoelace`

Include `WidgetManager.js` in your project and import it where needed.

## API

### Class: `WidgetManager`

#### Constructor

```javascript
new WidgetManager(store)
```

- **store** (`Object`, optional): A shared store (not required for most use cases).
- Returns the singleton instance of `WidgetManager`.

#### Methods

- **setupElement(element, initialConfig, setBounds, setPosition, moveable)**
    - **Description**: Initializes a draggable element, assigns a unique ID, computes initial position or crop
      dimensions, and starts observing container resize.
    - **Parameters**:
        - `element` (`HTMLElement`): The DOM element to make draggable/resizable.
        - `initialConfig` (`Object`): Configuration object (see [Configuration Options](#configuration-options)).
        - `setBounds` (`Function`): Callback to update bounds state.
        - `setPosition` (`Function`): Callback to update position state.
        - `moveable` (`Object`): Reference to a `react-moveable` instance.
    - **Returns**: `boolean` (true if setup is successful, false otherwise).

- **retrieveElementId(element)**
    - **Description**: Retrieves the unique ID of an element from its `data-LGS-ID` attribute.
    - **Parameters**:
        - `element` (`HTMLElement`): The target element.
    - **Returns**: `string|null` (the element's ID or null if not set).

- **applyCropToOverlay(config)**
    - **Description**: Updates the clip-path of an outside overlay to match the crop dimensions.
    - **Parameters**:
        - `config` (`Object`): The element's configuration object.
    - **Returns**: `void`.

- **applyPosition(element, position, moveable, isDragging, setControlBoxProps)**
    - **Description**: Applies a position to an element (as transform during drag or left/top otherwise) and updates the
      Moveable instance.
    - **Parameters**:
        - `element` (`HTMLElement`): The target element.
        - `position` (`Object|string`): Position as `{left, top}` or transform string (e.g., `translate(10px, 20px)`).
        - `moveable` (`Object`): Reference to the Moveable instance.
        - `isDragging` (`boolean`): Whether the element is being dragged.
        - `setControlBoxProps` (`Function`): Callback to update control box properties.
    - **Returns**: `void`.

- **manageControlBox(moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver)**
    - **Description**: Shows or hides the control box with a delay, handling visibility state.
    - **Parameters**:
        - `moveable` (`Object`): Reference to the Moveable instance.
        - `setControlBoxProps` (`Function`): Callback to update control box properties.
        - `_controlBoxTimer` (`Object`): React `useRef` for the timer.
        - `show` (`boolean`): Whether to show the control box.
        - `isMouseOver` (`boolean`): Whether the mouse is over the element.
    - **Returns**: `void`.

- **disposeElement(element)**
    - **Description**: Cleans up an element by stopping observation, clearing timers, and removing its configuration.
    - **Parameters**:
        - `element` (`HTMLElement`): The target element.
    - **Returns**: `void`.

- **onDragStart(e)**
    - **Description**: Handles the start of a drag event, applying drag styles and setting the dragging flag.
    - **Parameters**:
        - `e` (`Object`): Moveable dragStart event.
    - **Returns**: `void`.

- **onDragEnd(e)**
    - **Description**: Handles the end of a drag event, collapsing transform to left/top, updating crop dimensions, and
      syncing the overlay.
    - **Parameters**:
        - `e` (`Object`): Moveable dragEnd event.
    - **Returns**: `void`.

- **onResizeStart(e)**
    - **Description**: Handles the start of a resize event, applying resize styles and setting the resizing flag.
    - **Parameters**:
        - `e` (`Object`): Moveable resizeStart event.
    - **Returns**: `void`.

- **onResize(e, refs, setPosition)**
    - **Description**: Handles resize events, updating styles and syncing the overlay.
    - **Parameters**:
        - `e` (`Object`): Moveable resize event.
        - `refs` (`Object`): Object containing `widget` (element ref) and `child` (child component ref).
        - `setPosition` (`Function`): Callback to update position state.
    - **Returns**: `void`.

- **onResizeEnd(e)**
    - **Description**: Handles the end of a resize event, cleaning up styles and updating crop dimensions.
    - **Parameters**:
        - `e` (`Object`): Moveable resizeEnd event.
    - **Returns**: `void`.

- **getConfig(elementId)**
    - **Description**: Retrieves the configuration for an element by its ID.
    - **Parameters**:
        - `elementId` (`string`): The element's unique ID.
    - **Returns**: `Object|undefined` (the configuration object or undefined if not found).

- **setConfig(elementId, config)**
    - **Description**: Sets the configuration for an element by its ID.
    - **Parameters**:
        - `elementId` (`string`): The element's unique ID.
        - `config` (`Object`): The configuration object.
    - **Returns**: `void`.

### Configuration Options

The `initialConfig` object passed to `setupElement` supports the following properties:

- **container** (`HTMLElement`): The container element for bounds clamping.
- **isCropper** (`boolean`): Whether the element is a cropper (default: `false`).
- **isMobile** (`boolean`): Whether the element is used in a mobile context (default: `false`).
- **left** (`number|string`): Initial left position (pixels or percentage, default: `0`).
- **top** (`number|string`): Initial top position (pixels or percentage, default: `0`).
- **attachTo** (`string`): Anchor position (`center`, `top`, `left`, `right`, `bottom`, `top-left`, `top-right`,
  `bottom-left`, `bottom-right`, default: `top-left`).
- **showControlBox** (`boolean`): Whether to show the control box (default: `false`).
- **containerPadding** (`number`): Padding inside the container (default: `0`).
- **animationWhenDragging** (`boolean`): Whether to apply drag animation (default: `false`).
- **ratio** (`string`): Aspect ratio identifier (e.g., `16x9`, `9x16`, default: based on device orientation).
- **useRatio** (`boolean`): Whether to enforce the aspect ratio (default: `true`).
- **minCropSize** (`Object`): Minimum crop dimensions `{width, height}` (default: `{width: 0, height: 0}`).
- **outsideOverlay** (`HTMLElement`): Element for the crop overlay (default: `null`).
- **resizeFromCenter** (`boolean`): Whether to resize from the center (default: `false`).

## React Examples

Below are examples of how to integrate `WidgetManager` with a React component using `react-moveable`, Shoelace
WebComponents, and FontAwesome icons.

### Example 1: Basic Draggable Widget

This example creates a simple draggable widget with a control box.

```jsx
import React, { useEffect, useRef, useState } from 'react'
import Moveable                               from 'react-moveable'
import { WidgetManager }                      from './WidgetManager'
import { FontAwesomeIcon }                    from '@fortawesome/react-fontawesome'
import { faSquare }                           from '@fortawesome/pro-regular-svg-icons'
import '@shoelace-style/shoelace/dist/components/icon/icon.js'

/**
 * A draggable widget component.
 * @param {Object} props
 * @param {string} props.id - Unique identifier for the widget.
 */
export const DraggableWidget = ({id}) => {
    const _widget = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [position, setPosition] = useState({left: 0, top: 0})
    const [controlBoxProps, setControlBoxProps] = useState({renderDirections: [], zoom: 0, opacity: 0})

    useEffect(() => {
        const container = document.querySelector('#container')
        WidgetManager.instance.setupElement(_widget.current, {
            container,
            showControlBox:        true,
            animationWhenDragging: true,
        }, setBounds, setPosition, _moveable)
        return () => WidgetManager.instance.disposeElement(_widget.current)
    }, [])

    return (
        <>
            <div
                ref={_widget}
                className="draggable-widget"
                style={{
                    position:   'absolute',
                    width:      '100px',
                    height:     '100px',
                    background: 'rgba(0, 128, 255, 0.2)',
                    border:     '1px solid #007bff',
                }}
            >
                <sl-icon>
                    <FontAwesomeIcon icon={faSquare}/>
                </sl-icon>
            </div>
            <Moveable
                ref={_moveable}
                target={_widget.current}
                draggable
                resizable
                renderDirections={controlBoxProps.renderDirections}
                zoom={controlBoxProps.zoom}
                opacity={controlBoxProps.opacity}
                bounds={bounds}
                onDragStart={WidgetManager.instance.onDragStart}
                onDrag={({target, transform}) => {
                    target.style.transform = transform
                }}
                onDragEnd={WidgetManager.instance.onDragEnd}
                onResizeStart={WidgetManager.instance.onResizeStart}
                onResize={e => WidgetManager.instance.onResize(e, {widget: _widget, child: null}, setPosition)}
                onResizeEnd={WidgetManager.instance.onResizeEnd}
                onMouseEnter={() => WidgetManager.instance.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, true, true)}
                onMouseLeave={() => WidgetManager.instance.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, false)}
            />
        </>
    )
}
```

**HTML Container**:

```html

<div id="container" style="position: relative; width: 800px; height: 600px; border: 1px solid #ccc;"></div>
```

**Usage**:

```jsx
import { DraggableWidget } from './DraggableWidget'

const App = () => (
    <div id="container">
        <DraggableWidget id="widget1"/>
    </div>
)
```

### Example 2: Cropper with Overlay

This example creates a cropper element with an outside overlay and centered resizing.

```jsx
import React, { useEffect, useRef, useState } from 'react'
import Moveable                               from 'react-moveable'
import { WidgetManager }                      from './WidgetManager'
import { FontAwesomeIcon }                    from '@fortawesome/react-fontawesome'
import { faCrop }                             from '@fortawesome/pro-regular-svg-icons'
import '@shoelace-style/shoelace/dist/components/icon/icon.js'

/**
 * A cropper widget with an outside overlay.
 * @param {Object} props
 * @param {string} props.id - Unique identifier for the cropper.
 */
export const CropperWidget = ({id}) => {
    const _widget = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _outsideOverlay = useRef(null)
    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [position, setPosition] = useState({left: 0, top: 0})
    const [controlBoxProps, setControlBoxProps] = useState({renderDirections: [], zoom: 0, opacity: 0})

    useEffect(() => {
        const container = document.querySelector('#container')
        WidgetManager.instance.setupElement(_widget.current, {
            container,
            isCropper:        true,
            showControlBox:   true,
            ratio:            '16x9',
            useRatio:         true,
            minCropSize:      {width: 100, height: 100},
            outsideOverlay:   _outsideOverlay.current,
            resizeFromCenter: true,
        }, setBounds, setPosition, _moveable)
        return () => WidgetManager.instance.disposeElement(_widget.current)
    }, [])

    return (
        <>
            <div
                ref={_outsideOverlay}
                style={{
                    position:      'absolute',
                    top:           0,
                    left:          0,
                    width:         '100%',
                    height:        '100%',
                    background:    'rgba(0, 0, 0, 0.5)',
                    pointerEvents: 'none',
                }}
            />
            <div
                ref={_widget}
                className="cropper-widget"
                style={{
                    position:   'absolute',
                    background: 'transparent',
                    border:     '2px dashed #fff',
                }}
            >
                <sl-icon>
                    <FontAwesomeIcon icon={faCrop}/>
                </sl-icon>
            </div>
            <Moveable
                ref={_moveable}
                target={_widget.current}
                draggable
                resizable
                keepRatio
                renderDirections={controlBoxProps.renderDirections}
                zoom={controlBoxProps.zoom}
                opacity={controlBoxProps.opacity}
                bounds={bounds}
                onDragStart={WidgetManager.instance.onDragStart}
                onDrag={({target, transform}) => {
                    target.style.transform = transform
                }}
                onDragEnd={WidgetManager.instance.onDragEnd}
                onResizeStart={WidgetManager.instance.onResizeStart}
                onResize={e => WidgetManager.instance.onResize(e, {widget: _widget, child: null}, setPosition)}
                onResizeEnd={WidgetManager.instance.onResizeEnd}
                onMouseEnter={() => WidgetManager.instance.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, true, true)}
                onMouseLeave={() => WidgetManager.instance.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, false)}
            />
        </>
    )
}
```

**HTML Container**:

```html

<div id="container" style="position: relative; width: 800px; height: 600px; border: 1px solid #ccc;">
    <img src="image.jpg" style="width: 100%; height: 100%; object-fit: cover;"/>
</div>
```

**Usage**:

```jsx
import { CropperWidget } from './CropperWidget'

const App = () => (
    <div id="container">
        <CropperWidget id="cropper1"/>
    </div>
)
```

## Notes

- **Styling**: The examples use inline styles to avoid external CSS libraries, as per requirements. You can customize
  styles directly in the `style` attributes.
- **Shoelace WebComponents**: The `<sl-icon>` component is used to render FontAwesome icons (`faSquare` and `faCrop`).
- **FontAwesome**: Icons are imported from `@fortawesome/pro-regular-svg-icons`. Ensure you have a valid license.
- **react-moveable**: Handles drag and resize interactions. Ensure `keepRatio` is set to `true` for croppers with
  `useRatio: true`.
- **Container**: The container must have `position: relative` for absolute positioning to work correctly.
- **Cleanup**: Always call `disposeElement` in the `useEffect` cleanup function to prevent memory leaks.

## Troubleshooting

- **Control box not showing**: Ensure `showControlBox: true` in the config and that `renderDirections` is set correctly
  in `controlBoxProps`.
- **Overlay not syncing**: Verify that `outsideOverlay` is a valid DOM element and that `isCropper: true` is set.
- **Resize not centered**: Check that `resizeFromCenter: true` is passed in the config for centered resizing.
- **Aspect ratio issues**: Ensure `ratio` is a valid format (e.g., `16x9`) and `useRatio: true` is set for croppers.

For further assistance, contact the LGS1920 team at contact@lgs1920.fr.