# DragHandler

A JavaScript class for handling drag interactions for a movable element, such as a toolbar, in a web application. It
supports 2D dragging (horizontal and vertical) within a specified container, uses a dynamic overlay to display a
`grabbing` cursor during drags, suppresses clicks after dragging to prevent unintended interactions, and ensures
compatibility with both mouse and touch events using `PointerEvent`s. The class also supports initial positioning with
customizable placement and transform-aware positioning.

## Features

- **2D Dragging**: Moves the element horizontally and vertically within the container's bounds.
- **Cursor Management**: Sets a `grab` cursor by default and a `grabbing` cursor during drags using a transparent
  overlay to cover child elements.
- **Click Suppression**: Blocks clicks for 300ms after a drag to avoid accidental triggers on buttons or other
  interactive elements.
- **Pointer Events**: Handles `pointerdown`, `pointermove`, and `pointerup` events for seamless mouse and touch support,
  preventing default behaviors like scrolling for smooth dragging.
- **Container Bounds**: Constrains the element to stay within the specified container (or window), accounting for
  padding and borders.
- **Resize Handling**: Automatically repositions the element on window or container resize using `ResizeObserver` to
  ensure it remains within bounds.
- **Drag Events**: Dispatches `CustomEvent`s (`beforeDrag`, `dragstart`, `drag`, `dragstop`, `afterDrag`) on the target
  element with a `detail.value` containing `{ x, y, width, height }` for tracking position changes.
- **Initial Positioning**: Supports initial placement (`top-right`, `top`, `top-left`, `left`, `center`, `right`,
  `bottom-left`, `bottom`, `bottom-right`) and specific `top`/`left` values (e.g., `33%`, `250px`).
- **Transform-Aware Positioning**: Preserves existing CSS transforms (e.g., `translate(-50%, -50%)`) and applies drag
  offsets relative to the transformed position.

## Installation

1. **Add DragHandler.js**:
   Copy the `DragHandler.js` file into your project’s source directory (e.g., `src/` in a React project).

2. **Dependencies**:
   Requires `uuid` for generating unique instance IDs. Install it using:
   ```bash
   npm install uuid
   ```

3. **File Structure**:
   ```plaintext
   project/
   ├── src/
   │   ├── DragHandler.js
   │   └── (other files, e.g., your React components)
   ├── package.json
   └── node_modules/
       └── uuid/
   ```

## Usage

1. **Integrate in a Project**:
   Import and instantiate `DragHandler` in your application, passing the required DOM elements and optional positioning
   configuration. Add event listeners for `DragHandler.BEFORE_DRAG`, `DragHandler.DRAG_START`, `DragHandler.DRAG`,
   `DragHandler.DRAG_STOP`, and `DragHandler.AFTER_DRAG` custom events on the target element. For example, in a React
   component:

   ```javascript
   import { DragHandler } from './DragHandler'
   import { useEffect, useRef } from 'react'

   const MyComponent = () => {
       const _toolbar = useRef(null)

       useEffect(() => {
           if (_toolbar.current) {
               const dragHandler = new DragHandler({
                   grabber: _toolbar.current,
                   target: _toolbar.current,
                   container: window,
                   position: {
                       placement: 'top-right',
                       top: '10%',
                       left: '90%'
                   }
               })

               const handleBeforeDrag = (e) => {
                   console.log(`Before drag at: x=${e.detail.value.x}, y=${e.detail.value.y}`)
               }
               const handleDragStart = (e) => {
                   console.log(`Drag started at: x=${e.detail.value.x}, y=${e.detail.value.y}`)
               }
               const handleDrag = (e) => {
                   console.log(`Dragging: x=${e.detail.value.x}, y=${e.detail.value.y}, width=${e.detail.value.width}, height=${e.detail.value.height}`)
               }
               const handleDragStop = (e) => {
                   console.log(`Drag stopped at: x=${e.detail.value.x}, y=${e.detail.value.y}`)
               }
               const handleAfterDrag = (e) => {
                   console.log(`After drag at: x=${e.detail.value.x}, y=${e.detail.value.y}`)
               }

               _toolbar.current.addEventListener(DragHandler.BEFORE_DRAG, handleBeforeDrag)
               _toolbar.current.addEventListener(DragHandler.DRAG_START, handleDragStart)
               _toolbar.current.addEventListener(DragHandler.DRAG, handleDrag)
               _toolbar.current.addEventListener(DragHandler.DRAG_STOP, handleDragStop)
               _toolbar.current.addEventListener(DragHandler.AFTER_DRAG, handleAfterDrag)

               return () => {
                   dragHandler.destroy()
                   _toolbar.current.removeEventListener(DragHandler.BEFORE_DRAG, handleBeforeDrag)
                   _toolbar.current.removeEventListener(DragHandler.DRAG_START, handleDragStart)
                   _toolbar.current.removeEventListener(DragHandler.DRAG, handleDrag)
                   _toolbar.current.removeEventListener(DragHandler.DRAG_STOP, handleDragStop)
                   _toolbar.current.removeEventListener(DragHandler.AFTER_DRAG, handleAfterDrag)
               }
           }
       }, [])

       return (
           <div ref={_toolbar} style={{width: '200px', background: '#333', color: 'white', transform: 'translate(-50%, -50%)'}}>
               <div>Drag Handle</div>
               <button onClick={() => alert('Clicked!')}>Button</button>
           </div>
       )
   }

   export const MyComponent
   ```

2. **HTML Structure**:
   Ensure the `grabber` and `target` elements are valid `HTMLElement`s. Typically, the `grabber` and `target` are the
   same element (e.g., a toolbar `div`).

3. **Run the Application**:
   If using React, start your app (e.g., `bun run start`). The element will be draggable within the specified container,
   with a `grabbing` cursor during drags and click suppression afterward.

## API

### DragHandler

Manages drag interactions for a movable element.

#### Static Constants

- `DragHandler.BEFORE_DRAG` (`string`): Event type for before drag starts (`'beforeDrag'`).
- `DragHandler.DRAG_START` (`string`): Event type for drag start (`'dragstart'`).
- `DragHandler.DRAG` (`string`): Event type for drag movement (`'drag'`).
- `DragHandler.DRAG_STOP` (`string`): Event type for drag end (`'dragstop'`).
- `DragHandler.AFTER_DRAG` (`string`): Event type for after drag completes (`'afterDrag'`).

#### Constructor

```javascript
new DragHandler({grabber, dragger, target, container = window, position = {placement: 'center'}})
```

- **Parameters**:
    - `grabber` (`HTMLElement`): Element that initiates the drag (defaults to `target`).
    - `dragger` (`HTMLElement`): Alias for `grabber` (optional, defaults to `target`).
    - `target` (`HTMLElement`): Element to be moved (required).
    - `container` (`HTMLElement | Window`): Bounding container (defaults to `window`).
    - `position` (`Object`): Positioning configuration.
        - `placement` (`string`): Placement point (`'top-right'`, `'top'`, `'top-left'`, `'left'`, `'center'`,
          `'right'`, `'bottom-left'`, `'bottom'`, `'bottom-right'`) (defaults to `'center'`).
        - `top` (`string | number`): Initial top position (e.g., `'33%'`, `'250px'`) (optional).
        - `left` (`string | number`): Initial left position (e.g., `'50%'`, `'250px'`) (optional).

#### Methods

- **handleBefore(event)**: Dispatches `beforeDrag` event on `pointerdown` or `touchstart`.
    - `event` (`PointerEvent | TouchEvent`): The `pointerdown` or `touchstart` event.
- **handleStart(event)**: Initiates drag on `pointerdown` or `touchstart`.
    - `event` (`PointerEvent | TouchEvent`): The `pointerdown` or `touchstart` event.
- **handleMove(event)**: Updates position on `pointermove` or `touchmove`, applies overlay if movement exceeds 5px.
    - `event` (`PointerEvent | TouchEvent`): The `pointermove` or `touchmove` event.
- **handleEnd(event)**: Ends drag on `pointerup` or `touchend`, removes overlay, and suppresses clicks.
    - `event` (`PointerEvent | TouchEvent`): The `pointerup` or `touchend` event.
- **attachEvents()**: Sets up event listeners for drag, click, and resize events.
- **destroy()**: Removes event listeners, overlay, classes, and cleans up resources.

#### Events

- `DragHandler.BEFORE_DRAG`: Dispatched on the `target` element before the drag begins, with `detail.value` containing
  `{ x, y, width, height }`.
- `DragHandler.DRAG_START`: Dispatched on the `target` element when the drag begins (movement exceeds 5px), with
  `detail.value` containing `{ x, y, width, height }`.
- `DragHandler.DRAG`: Dispatched on the `target` element during drag movement after exceeding the 5px threshold, with
  `detail.value` containing `{ x, y, width, height }`.
- `DragHandler.DRAG_STOP`: Dispatched on the `target` element when the drag ends, with `detail.value` containing
  `{ x, y, width, height }`.
- `DragHandler.AFTER_DRAG`: Dispatched on the `target` element after all drag operations complete, with `detail.value`
  containing `{ x, y, width, height }`.

## Example

Example usage in a React component with event listeners and initial positioning:

```javascript
import { useEffect, useRef } from 'react'
import { DragHandler } from './DragHandler'

const MyComponent = () => {
    const _toolbar = useRef(null)

    useEffect(() => {
        if (_toolbar.current) {
            const dragHandler = new DragHandler({
                                                    grabber:   _toolbar.current,
                                                    target:    _toolbar.current,
                                                    container: window,
                                                    position:  {
                                                        placement: 'top-right',
                                                        top:       '10%',
                                                        left:      '90%'
                                                    }
                                                })

            const handleBeforeDrag = (e) => {
                console.log(`Before drag at: x=${e.detail.value.x}, y=${e.detail.value.y}`)
            }
            const handleDragStart = (e) => {
                console.log(`Drag started at: x=${e.detail.value.x}, y=${e.detail.value.y}`)
            }
            const handleDrag = (e) => {
                console.log(`Dragging: x=${e.detail.value.x}, y=${e.detail.value.y}, width=${e.detail.value.width}, height=${e.detail.value.height}`)
            }
            const handleDragStop = (e) => {
                console.log(`Drag stopped at: x=${e.detail.value.x}, y=${e.detail.value.y}`)
            }
            const handleAfterDrag = (e) => {
                console.log(`After drag at: x=${e.detail.value.x}, y=${e.detail.value.y}`)
            }

            _toolbar.current.addEventListener(DragHandler.BEFORE_DRAG, handleBeforeDrag)
            _toolbar.current.addEventListener(DragHandler.DRAG_START, handleDragStart)
            _toolbar.current.addEventListener(DragHandler.DRAG, handleDrag)
            _toolbar.current.addEventListener(DragHandler.DRAG_STOP, handleDragStop)
            _toolbar.current.addEventListener(DragHandler.AFTER_DRAG, handleAfterDrag)

            return () => {
                dragHandler.destroy()
                _toolbar.current.removeEventListener(DragHandler.BEFORE_DRAG, handleBeforeDrag)
                _toolbar.current.removeEventListener(DragHandler.DRAG_START, handleDragStart)
                _toolbar.current.removeEventListener(DragHandler.DRAG, handleDrag)
                _toolbar.current.removeEventListener(DragHandler.DRAG_STOP, handleDragStop)
                _toolbar.current.removeEventListener(DragHandler.AFTER_DRAG, handleAfterDrag)
            }
        }
    }, [])

    return (
        <div ref={_toolbar}
             style={{width: '200px', background: '#333', color: 'white', transform: 'translate(-50%, -50%)'}}>
            <div>Drag Handle</div>
            <button onClick={() => alert('Clicked!')}>Button</button>
        </div>
    )
}

export const MyComponent
```

## Notes

- **Movement Threshold**: Dragging requires >5px movement to differentiate from clicks.
- **Click Suppression**: Clicks are blocked for 300ms after a drag to prevent accidental triggers.
- **Pointer Events**: Uses `PointerEvent`s and `TouchEvent`s for unified mouse and touch support, with `preventDefault`
  to avoid scrolling.
- **Initial Positioning**: Supports `position.placement` for predefined placements and `position.top`/`position.left`
  for specific values (pixels or percentages).
- **Transform-Aware**: Detects and preserves existing CSS transforms, applying drag offsets relative to the transformed
  position.
- **Custom Events**:
    - `DragHandler.BEFORE_DRAG`: Triggered on the `target` element on `pointerdown` or `touchstart`.
    - `DragHandler.DRAG_START`: Triggered on the `target` element when the drag begins (movement exceeds 5px).
    - `DragHandler.DRAG`: Triggered on the `target` element during drag movement (on `pointermove` or `touchmove` after
      exceeding the 5px threshold).
    - `DragHandler.DRAG_STOP`: Triggered on the `target` element when the drag ends (on `pointerup` or `touchend` after
      movement).
    - `DragHandler.AFTER_DRAG`: Triggered on the `target` element after all drag operations complete.
    - Each event includes a `detail.value` object with `{ x, y, width, height }`.
- **Troubleshooting**:
    - If the `grabbing` cursor doesn’t appear, check for CSS rules overriding `cursor` or `z-index` on child elements.
    - If clicks trigger after a drag, ensure no event listeners bypass the 300ms suppression.
  - If dragging fails, verify the `grabber` and `target` are valid `HTMLElement`s and the container is correctly set.
  - If events are not firing, ensure listeners are attached to the `target` element using `DragHandler.BEFORE_DRAG`,
    `DragHandler.DRAG_START`, `DragHandler.DRAG`, `DragHandler.DRAG_STOP`, or `DragHandler.AFTER_DRAG`.
  - If initial positioning is incorrect, verify `position.placement`, `position.top`, and `position.left` values are
    valid.
- **Browser Compatibility**: Works in modern browsers (Chrome 74+, Firefox 70+, Safari 12.1+, Edge 79+).