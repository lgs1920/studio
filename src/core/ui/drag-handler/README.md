# DragHandler

A JavaScript class for handling drag interactions for a movable element, such as a toolbar, in a web application. It
supports 2D dragging (horizontal and vertical) within a specified container, uses a dynamic overlay to display a
`grabbing` cursor during drags, suppresses clicks after dragging to prevent unintended interactions, and ensures
compatibility with both mouse and touch events using `PointerEvent`s.

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
- **Drag Events**: Dispatches `CustomEvent`s (`beforeDrag`, `dragstart`, `drag`, `dragstop`, `afterDrag`) on the parent
  element with a `detail.value` containing `{ x, y, width, height }` for tracking position changes.
- **Initial Positioning**: Centers the element within the container if no initial position is provided.

## Installation

1. **Add DragHandler.js**:
   Copy the `DragHandler.js` file into your project’s source directory (e.g., `src/` in a React project).

2. **Dependencies**:
   No external dependencies are required. The class uses vanilla JavaScript and works in any environment with DOM
   support.

3. **File Structure**:
   ```plaintext
   project/
   ├── src/
   │   ├── DragHandler.js
   │   └── (other files, e.g., your React components)
   └── package.json
   ```

## Usage

1. **Integrate in a Project**:
   Import and instantiate `DragHandler` in your application, passing the required DOM elements. Add event listeners for
   `DragHandler.BEFORE_DRAG`, `DragHandler.DRAG_START`, `DragHandler.DRAG`, `DragHandler.DRAG_STOP`, and
   `DragHandler.AFTER_DRAG` custom events on the parent element. For example, in a React component:
   ```javascript
   import { DragHandler } from './DragHandler'
   import { useEffect, useRef } from 'react'

   const MyComponent = () => {
       const toolbarRef = useRef(null)

       useEffect(() => {
           if (toolbarRef.current) {
               const dragHandler = new DragHandler({
                   grabber: toolbarRef.current,
                   parent: toolbarRef.current,
                   container: window
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

               toolbarRef.current.addEventListener(DragHandler.BEFORE_DRAG, handleBeforeDrag)
               toolbarRef.current.addEventListener(DragHandler.DRAG_START, handleDragStart)
               toolbarRef.current.addEventListener(DragHandler.DRAG, handleDrag)
               toolbarRef.current.addEventListener(DragHandler.DRAG_STOP, handleDragStop)
               toolbarRef.current.addEventListener(DragHandler.AFTER_DRAG, handleAfterDrag)

               return () => {
                   dragHandler.destroy()
                   toolbarRef.current.removeEventListener(DragHandler.BEFORE_DRAG, handleBeforeDrag)
                   toolbarRef.current.removeEventListener(DragHandler.DRAG_START, handleDragStart)
                   toolbarRef.current.removeEventListener(DragHandler.DRAG, handleDrag)
                   toolbarRef.current.removeEventListener(DragHandler.DRAG_STOP, handleDragStop)
                   toolbarRef.current.removeEventListener(DragHandler.AFTER_DRAG, handleAfterDrag)
               }
           }
       }, [])

       return (
           <div ref={toolbarRef} style={{width: '200px', background: '#333', color: 'white'}}>
               <div>Drag Handle</div>
               <button onClick={() => alert('Clicked!')}>Button</button>
           </div>
       )
   }

   export default MyComponent
   ```

2. **HTML Structure**:
   Ensure the `grabber` and `parent` elements are valid `HTMLElement`s. Typically, the `grabber` and `parent` are the
   same element (e.g., a toolbar `div`).

3. **Run the Application**:
   If using React, start your app (e.g., `npm start`). The element will be draggable within the specified container,
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
new DragHandler({grabber, dragger, parent, container = window})
```

- **Parameters**:
    - `grabber` (`HTMLElement`): Element that initiates the drag (defaults to `parent`).
    - `dragger` (`HTMLElement`): Alias for `grabber` (optional, defaults to `parent`).
    - `parent` (`HTMLElement`): Element to be moved (required).
    - `container` (`HTMLElement | Window`): Bounding container (defaults to `window`).

#### Methods

- **handleBefore(event)**: Dispatches `beforeDrag` event on `pointerdown`.
    - `event` (`PointerEvent`): The `pointerdown` event.
- **handleStart(event)**: Initiates drag on `pointerdown`.
    - `event` (`PointerEvent`): The `pointerdown` event.
- **handleMove(event)**: Updates position on `pointermove`, applies overlay if movement exceeds 5px.
    - `event` (`PointerEvent`): The `pointermove` event.
- **handleEnd(event)**: Ends drag on `pointerup`, removes overlay, and suppresses clicks.
    - `event` (`PointerEvent`): The `pointerup` event.
- **attachEvents()**: Sets up event listeners for drag, click, and resize events.
- **destroy()**: Removes event listeners and cleans up resources.

#### Events

- `DragHandler.BEFORE_DRAG`: Dispatched on the `parent` element before the drag begins, with `detail.value` containing
  `{ x, y, width, height }`.
- `DragHandler.DRAG_START`: Dispatched on the `parent` element when the drag begins (movement exceeds 5px), with
  `detail.value` containing `{ x, y, width, height }`.
- `DragHandler.DRAG`: Dispatched on the `parent` element during drag movement after exceeding the 5px threshold, with
  `detail.value` containing `{ x, y, width, height }`.
- `DragHandler.DRAG_STOP`: Dispatched on the `parent` element when the drag ends, with `detail.value` containing
  `{ x, y, width, height }`.
- `DragHandler.AFTER_DRAG`: Dispatched on the `parent` element after all drag operations complete, with `detail.value`
  containing `{ x, y, width, height }`.

## Example

Example usage in a React component with event listeners:

```javascript
import { useEffect, useRef } from 'react'
import { DragHandler } from './DragHandler'

const MyComponent = () => {
    const toolbarRef = useRef(null)

    useEffect(() => {
        if (toolbarRef.current) {
            const dragHandler = new DragHandler({
                                                    grabber:   toolbarRef.current,
                                                    parent:    toolbarRef.current,
                                                    container: window
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

            toolbarRef.current.addEventListener(DragHandler.BEFORE_DRAG, handleBeforeDrag)
            toolbarRef.current.addEventListener(DragHandler.DRAG_START, handleDragStart)
            toolbarRef.current.addEventListener(DragHandler.DRAG, handleDrag)
            toolbarRef.current.addEventListener(DragHandler.DRAG_STOP, handleDragStop)
            toolbarRef.current.addEventListener(DragHandler.AFTER_DRAG, handleAfterDrag)

            return () => {
                dragHandler.destroy()
                toolbarRef.current.removeEventListener(DragHandler.BEFORE_DRAG, handleBeforeDrag)
                toolbarRef.current.removeEventListener(DragHandler.DRAG_START, handleDragStart)
                toolbarRef.current.removeEventListener(DragHandler.DRAG, handleDrag)
                toolbarRef.current.removeEventListener(DragHandler.DRAG_STOP, handleDragStop)
                toolbarRef.current.removeEventListener(DragHandler.AFTER_DRAG, handleAfterDrag)
            }
        }
    }, [])

    return (
        <div ref={toolbarRef} style={{width: '200px', background: '#333', color: 'white'}}>
            <div>Drag Handle</div>
            <button onClick={() => alert('Clicked!')}>Button</button>
        </div>
    )
}

export default MyComponent
```

## Notes

- **Movement Threshold**: Dragging requires >5px movement to differentiate from clicks.
- **Click Suppression**: Clicks are blocked for 300ms after a drag to prevent accidental triggers.
- **Pointer Events**: Uses `PointerEvent`s for unified mouse and touch support, with `preventDefault` to avoid
  scrolling.
- **Custom Events**:
    - `DragHandler.BEFORE_DRAG`: Triggered on the `parent` element on `pointerdown`.
    - `DragHandler.DRAG_START`: Triggered on the `parent` element when the drag begins (movement exceeds 5px).
    - `DragHandler.DRAG`: Triggered on the `parent` element during drag movement (on `pointermove` after exceeding the
      5px threshold).
    - `DragHandler.DRAG_STOP`: Triggered on the `parent` element when the drag ends (on `pointerup` after movement).
    - `DragHandler.AFTER_DRAG`: Triggered on the `parent` element after all drag operations complete.
    - Each event includes a `detail.value` object with `{ x, y, width, height }`.
- **Troubleshooting**:
    - If the `grabbing` cursor doesn’t appear, check for CSS rules overriding `cursor` or `z-index` on child elements.
    - If clicks trigger after a drag, ensure no event listeners bypass the 300ms suppression.
    - If dragging fails, verify the `grabber` and `parent` are valid `HTMLElement`s and the container is correctly set.
  - If events are not firing, ensure listeners are attached to the `parent` element using `DragHandler.BEFORE_DRAG`,
    `DragHandler.DRAG_START`, `DragHandler.DRAG`, `DragHandler.DRAG_STOP`, or `DragHandler.AFTER_DRAG`.
- **Browser Compatibility**: Works in modern browsers (Chrome 74+, Firefox 70+, Safari _