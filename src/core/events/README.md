# LGS1920 Studio Project

## Overview

The LGS1920 Studio project provides a robust event management system for Cesium-based applications, enabling seamless
handling of mouse, touch, and keyboard interactions on a 3D globe or map. The core component, `CanvasEventManager`, is
designed to manage canvas events with support for modifier keys, entity-based filtering, prioritized event handling,
propagation control, and user-defined data. Event names and modifiers are case-insensitive (e.g., `CTRL#CLICK` =
`ctrl#click`).

This project is developed by the LGS1920 Team. For inquiries, contact us
at [contact@lgs1920.fr](mailto:contact@lgs1920.fr).

## Installation

**Prerequisites**:

- Node or Bun
   - CesiumJS (included as a dependency)
   - A modern web browser supporting WebGL

## Usage

The `CanvasEventManager` class is the primary interface for handling canvas events in a Cesium viewer. It supports a
variety of events (e.g., `CLICK`, `DOUBLE_CLICK`, `TAP`, `KEY_DOWN`) and provides fine-grained control over event
listeners through options like `entity`, `once`, `priority`, `showSelector`, `preventLowerPriority`, `modifiers`, and
`keys`. Additionally, it allows passing user-defined data (`userData`) to callbacks for custom logic.

### Initializing CanvasEventManager

```javascript
import { CanvasEventManager } from './CanvasEventManager.js';
import { Viewer } from 'cesium';

// Initialize Cesium Viewer
const viewer = new Viewer('cesiumContainer');

// Create CanvasEventManager instance (singleton)
const eventManager = new CanvasEventManager(viewer);
```

### Registering Event Listeners

Use the `on` method (or its aliases like `onClick`, `onTap`, `onKeyDown`) to register event listeners. The callback
receives the following parameters:

- `event`: The Cesium event object (for mouse/touch) or
  `{ key, position, clientX, clientY, ctrlKey, altKey, shiftKey }` (for keyboard). For keyboard events, `position`,
  `clientX`, and `clientY` reflect the last known mouse position and may be `null` if no mouse movement has occurred.
- `entityId`: The ID of the clicked entity, or `null` if none or if no valid position is available.
- `options`: The options passed during registration (e.g.,
  `{ entity, priority, showSelector, preventLowerPriority, modifiers, keys }`).
- `userData`: User-defined data passed during registration (default: `null`).

The `on` method supports the following options:

- `entity`: Restrict the listener to specific entities (`false`, string ID, array of IDs, or empty array for any
  entity).
- `once`: If `true`, the listener is removed after being triggered once (default: `false`).
- `priority`: A number indicating the listener's priority (higher numbers execute first; default: `0` if `entity` is
  specified, `EVENT_LOWEST` if `entity` is `false`).
- `showSelector`: If `true`, shows the `.cesium-selection-wrapper` for picked entities (default: `true`).
- `preventLowerPriority`: If `true`, prevents lower-priority listeners from executing for the same event (default:
  `false`).
- `modifiers`: An array of modifier keys required for mouse or keyboard events (e.g., `['ctrl', 'alt']`,
  case-insensitive; default: `[]`). Non-specified modifiers (`ctrl`, `alt`, `shift`) must be inactive for the listener
  to trigger.
- `keys`: An array of specific keys to listen for in `KEY_DOWN`/`KEY_UP` (e.g., `['s', 'enter']`, case-insensitive;
  default: `[]`).

#### Example: Keyboard Event with Modifiers

To listen for `Alt+S` (and ensure `Ctrl` and `Shift` are not pressed):

```javascript
eventManager.onKeyDown(
        (event, entityId, options, userData) => {
           console.log(`Alt+S pressed at (${event.clientX}, ${event.clientY}), Entity: ${entityId || 'None'}`, userData);
        },
        {modifiers: ['alt'], keys: ['s'], priority: 10},
        {action: 'save'}
);
```

This will trigger only when `S` is pressed with `Alt` held down, ignoring standalone `Alt` presses or combinations
involving `Ctrl` or `Shift`.

#### Example: Basic Click Event with Modifiers

```javascript
eventManager.onClick(
        (event, entityId, options, userData) => {
           console.log(`Clicked entity: ${entityId || 'None'} at (${event.position.x}, ${event.position.y})`, userData);
        },
        {entity: 'entity1', modifiers: ['ctrl'], priority: 10},
        {action: 'select'}
);
```

### General methods

The `CanvasEventManager` class also supports the following methods:

| Method Name                                                | Usage                                                                                                                                                                                                                               |
|------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `addEventListener(eventName, callback, options, userData)` | Alias for `on`, registers an event listener for the specified event with support for priority, entity filtering, modifiers, keys, and user data.                                                                                    |
| `constructor(viewer)`                                      | Creates or returns the singleton instance of `CanvasEventManager`, initializing the Cesium `ScreenSpaceEventHandler` for mouse, touch, and keyboard events on the provided Cesium viewer. Throws an error if the viewer is invalid. |
| `destroy()`                                                | Cleans up resources, removes all event listeners, destroys the `ScreenSpaceEventHandler`, and resets the singleton instance.                                                                                                        |
| `removeAllListeners()`                                     | Removes all registered event listeners across all events.                                                                                                                                                                           |
| `removeAllListenersByEntity(entity)`                       | Removes all listeners associated with a specific entity ID or array of entity IDs.                                                                                                                                                  |
| `removeEventListener(eventName, callback)`                 | Alias for `off`, unregisters an event listener with the same parameters and behavior.                                                                                                                                               |

## Event Listener Methods (on/off)

The `on` and `off` methods are aliases for the `addEventListener` and `removeEventListener` methods, respectively.
They are provided for convenience and to avoid confusion with the `addEventListener` method's `eventName` parameter.

| Method Name                                  | Usage                                                                                                                         |
|----------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `onClick(callback, options, userData)`       | Registers a listener for the `CLICK` event, triggered on a single left mouse click.                                           |
| `offClick(callback)`                         | Unregisters a listener for the `CLICK` event.                                                                                 |
| `onDoubleClick(callback, options, userData)` | Registers a listener for the `DOUBLE_CLICK` event, triggered on a double left mouse click.                                    |
| `offDoubleClick(callback)`                   | Unregisters a listener for the `DOUBLE_CLICK` event.                                                                          |
| `onDoubleTap(callback, options, userData)`   | Registers a listener for the `DOUBLE_TAP` event, triggered on a double touch tap.                                             |
| `offDoubleTap(callback)`                     | Unregisters a listener for the `DOUBLE_TAP` event.                                                                            |
| `onKeyDown(callback, options, userData)`     | Registers a listener for the `KEY_DOWN` event, triggered when a key is pressed, with support for specific keys and modifiers. |
| `offKeyDown(callback)`                       | Unregisters a listener for the `KEY_DOWN` event.                                                                              |
| `onKeyUp(callback, options, userData)`       | Registers a listener for the `KEY_UP` event, triggered when a key is released, with support for specific keys and modifiers.  |
| `offKeyUp(callback)`                         | Unregisters a listener for the `KEY_UP` event.                                                                                |
| `onLongTap(callback, options, userData)`     | Registers a listener for the `LONG_TAP` event, triggered on a prolonged touch tap.                                            |
| `offLongTap(callback)`                       | Unregisters a listener for the `LONG_TAP` event.                                                                              |
| `onMiddleClick(callback, options, userData)` | Registers a listener for the `MIDDLE_CLICK` event, triggered on a single middle mouse click.                                  |
| `offMiddleClick(callback)`                   | Unregisters a listener for the `MIDDLE_CLICK` event.                                                                          |
| `onMiddleDown(callback, options, userData)`  | Registers a listener for the `MIDDLE_DOWN` event, triggered when the middle mouse button is pressed.                          |
| `offMiddleDown(callback)`                    | Unregisters a listener for the `MIDDLE_DOWN` event.                                                                           |
| `onMiddleUp(callback, options, userData)`    | Registers a listener for the `MIDDLE_UP` event, triggered when the middle mouse button is released.                           |
| `offMiddleUp(callback)`                      | Unregisters a listener for the `MIDDLE_UP` event.                                                                             |
| `onMouseDown(callback, options, userData)`   | Registers a listener for the `MOUSE_DOWN` event, triggered when the left mouse button is pressed.                             |
| `offMouseDown(callback)`                     | Unregisters a listener for the `MOUSE_DOWN` event.                                                                            |
| `onMouseEnter(callback, options, userData)`  | Registers a listener for the `MOUSE_ENTER` event, triggered once when the mouse starts hovering over an entity.               |
| `offMouseEnter(callback)`                    | Unregisters a listener for the `MOUSE_ENTER` event.                                                                           |
| `onMouseLeave(callback, options, userData)`  | Registers a listener for the `MOUSE_LEAVE` event, triggered once when the mouse leaves an entity.                             |
| `offMouseLeave(callback)`                    | Unregisters a listener for the `MOUSE_LEAVE` event.                                                                           |
| `onMouseMove(callback, options, userData)`   | Registers a listener for the `MOUSE_MOVE` event, triggered when the mouse moves over the canvas.                              |
| `offMouseMove(callback)`                     | Unregisters a listener for the `MOUSE_MOVE` event.                                                                            |
| `onMouseUp(callback, options, userData)`     | Registers a listener for the `MOUSE_UP` event, triggered when the left mouse button is released.                              |
| `offMouseUp(callback)`                       | Unregisters a listener for the `MOUSE_UP` event.                                                                              |
| `onPinchEnd(callback, options, userData)`    | Registers a listener for the `PINCH_END` event, triggered when a pinch gesture ends.                                          |
| `offPinchEnd(callback)`                      | Unregisters a listener for the `PINCH_END` event.                                                                             |
| `onPinchMove(callback, options, userData)`   | Registers a listener for the `PINCH_MOVE` event, triggered during a pinch gesture.                                            |
| `offPinchMove(callback)`                     | Unregisters a listener for the `PINCH_MOVE` event.                                                                            |
| `onPinchStart(callback, options, userData)`  | Registers a listener for the `PINCH_START` event, triggered when a pinch gesture begins.                                      |
| `offPinchStart(callback)`                    | Unregisters a listener for the `PINCH_START` event.                                                                           |
| `onRightClick(callback, options, userData)`  | Registers a listener for the `RIGHT_CLICK` event, triggered on a single right mouse click.                                    |
| `offRightClick(callback)`                    | Unregisters a listener for the `RIGHT_CLICK` event.                                                                           |
| `onRightDown(callback, options, userData)`   | Registers a listener for the `RIGHT_DOWN` event, triggered when the right mouse button is pressed.                            |
| `offRightDown(callback)`                     | Unregisters a listener for the `RIGHT_DOWN` event.                                                                            |
| `onRightUp(callback, options, userData)`     | Registers a listener for the `RIGHT_UP` event, triggered when the right mouse button is released.                             |
| `offRightUp(callback)`                       | Unregisters a listener for the `RIGHT_UP` event.                                                                              |
| `onTap(callback, options, userData)`         | Registers a listener for the `TAP` event, triggered on a single touch tap.                                                    |
| `offTap(callback)`                           | Unregisters a listener for the `TAP` event.                                                                                   |
| `onWheel(callback, options, userData)`       | Registers a listener for the `WHEEL` event, triggered on mouse wheel scroll.                                                  |
| `offWheel(callback)`                         | Unregisters a listener for the `WHEEL` event.                                                                                 |
### Notes on Keyboard Events

- **Modifier Keys**: Modifier keys (`Ctrl`, `Alt`, `Shift`) are not emitted as standalone `KEY_DOWN` events unless
  explicitly registered (e.g., `{ keys: ['alt'] }`). This prevents unwanted events for modifier presses during
  combinations like `Alt+S`.
- **Focus Management**: The canvas is made focusable with `tabindex="0"`, and clicking the canvas ensures it receives
  keyboard events. If the window loses focus, modifier states are reset to prevent stuck keys.
- **Browser Compatibility**: Some browsers may intercept `Alt` for menu activation. The library prevents this by calling
  `event.preventDefault()` for `Alt`-based events, but users should click the canvas to ensure focus.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Commit your changes (`git commit -m 'Add your feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For support or inquiries, reach out to the LGS1920 Team at [contact@lgs1920.fr](mailto:contact@lgs1920.fr).