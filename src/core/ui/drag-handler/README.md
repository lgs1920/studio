# DragHandler

A JavaScript class for handling drag interactions for a movable element, such as a toolbar, in a web application. It
supports 2D dragging (horizontal and vertical) within a specified container, uses a dynamic overlay to display a
`grabbing` cursor during drags, suppresses clicks after dragging to prevent unintended interactions, and ensures
compatibility with both mouse and touch events.

## Features

- **2D Dragging**: Moves the element horizontally and vertically within the container's bounds.
- **Cursor Management**: Sets a `grab` cursor by default and a `grabbing` cursor during drags using a transparent
  overlay to cover child elements.
- **Click Suppression**: Blocks clicks for 300ms after a drag to avoid accidental triggers on buttons or other
  interactive elements.
- **Mobile Compatibility**: Handles `touchstart`, `touchmove`, and `touchend` events, preventing default behaviors like
  scrolling for smooth dragging.
- **Container Bounds**: Constrains the element to stay within the specified container (or window), accounting for
  padding and borders.
- **Resize Handling**: Repositions the element on window or container resize to ensure it remains within bounds.

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
   Import and instantiate `DragHandler` in your application, passing the required DOM elements. For example, in a React
   component:
   ```javascript
   import { DragHandler } from './DragHandler'

   // In a React useEffect
   const toolbarRef = useRef(null)
   useEffect(() => {
       if (toolbarRef.current) {
           const dragHandler = new DragHandler({
               grabber: toolbarRef.current,
               parent: toolbarRef.current,
               container: window,
               callback: ({ x, y, width, height }) => {
                   console.log(`Position: x=${x}, y=${y}, width=${width}, height=${height}`)
               }
           })
           return () => dragHandler.destroy()
       }
   }, [])
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

#### Constructor

```javascript
new DragHandler({grabber, dragger, parent, container = window, callback = null})
```

- **Parameters**:
    - `grabber` (`HTMLElement`): Element that initiates the drag (defaults to `parent`).
    - `dragger` (`HTMLElement`): Alias for `grabber` (optional, defaults to `parent`).
    - `parent` (`HTMLElement`): Element to be moved (required).
    - `container` (`HTMLElement | Window`): Bounding container (defaults to `window`).
    - `callback` (`Function`): Optional callback for position updates, receiving `{ x, y, width, height }`.

#### Methods

- **handleStart(event)**: Initiates drag on `mousedown` or `touchstart`.
    - `event` (`Event`): The `mousedown` or `touchstart` event.
- **handleMove(event)**: Updates position on `mousemove` or `touchmove`, applies overlay if movement exceeds 5px.
    - `event` (`Event`): The `mousemove` or `touchmove` event.
- **handleEnd(event)**: Ends drag on `mouseup` or `touchend`, removes overlay, and suppresses clicks.
    - `event` (`Event`): The `mouseup` or `touchend` event.
- **attachEvents()**: Sets up event listeners for drag, click, and resize events.
- **destroy()**: Removes event listeners and cleans up resources.

## Example

Example usage in a React component:

```javascript
import { useEffect, useRef } from 'react'
import { DragHandler }       from './DragHandler'

const MyComponent = () => {
    const toolbarRef = useRef(null)

    useEffect(() => {
        if (toolbarRef.current) {
            const dragHandler = new DragHandler({
                                                    grabber:   toolbarRef.current,
                                                    parent:    toolbarRef.current,
                                                    container: window,
                                                    callback:  ({x, y}) => console.log(`Moved to: x=${x}, y=${y}`)
                                                })
            return () => dragHandler.destroy()
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
- **Mobile**: Touch events are fully supported, with `preventDefault` to avoid scrolling.
- **Troubleshooting**:
    - If the `grabbing` cursor doesn’t appear, check for CSS rules overriding `cursor` or `z-index` on child elements.
    - If clicks trigger after a drag, ensure no event listeners bypass the 300ms suppression.
    - If dragging fails, verify the `grabber` and `parent` are valid `HTMLElement`s and the container is correctly set.
- **Browser Compatibility**: Works in modern browsers (Chrome 74+, Firefox 70+, Safari 14.1+) and on mobile devices (
  iOS, Android). Requires support for private class methods (`#`).

For issues or enhancements, please report bugs or suggest improvements via your project’s issue tracker.