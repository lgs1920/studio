# CanvasEventManager

The `CanvasEventManager` class is a singleton designed to manage canvas events for a Cesium viewer, handling both mouse
and touch interactions in a unified way. It supports a variety of events, including standard mouse events (e.g.,
`CLICK`, `DOUBLE_CLICK`), touch events (e.g., `TAP`, `DOUBLE_TAP`), and mobile-specific events (e.g., `PINCH_START`,
`PINCH_MOVE`). The class supports modifier keys (e.g., Ctrl, Shift, Alt), allows for entity-based event filtering, and
provides prioritized event handling, making it highly flexible for interactive 3D applications built with Cesium.

This class is part of the **LGS1920/studio** project and is designed to simplify event handling for Cesium-based
applications by providing a clean API with both generic (`on`, `off`) and event-specific methods (e.g., `onClick`,
`offClick`, `onTap`, `offTap`).

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Creating an Instance](#creating-an-instance)
  - [Registering Event Listeners](#registering-event-listeners)
  - [Removing Event Listeners](#removing-event-listeners)
  - [Event Types](#event-types)
  - [Entity Requirements](#entity-requirements)
  - [Modifier Keys](#modifier-keys)
  - [Priority Handling](#priority-handling)
- [Examples](#examples)
  - [Basic Mouse Click](#basic-mouse-click)
  - [Touch Tap with Entity Filtering](#touch-tap-with-entity-filtering)
  - [Pinch Gesture Handling](#pinch-gesture-handling)
  - [Modifier Key with Click](#modifier-key-with-click)
  - [One-Time Listener](#one-time-listener)
  - [Prioritized Event Handling](#prioritized-event-handling)
- [API Reference](#api-reference)
  - [Constructor](#constructor)
  - [Methods](#methods)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Singleton Pattern**: Ensures a single instance per Cesium viewer, preventing duplicate event handlers.
- **Mouse and Touch Support**: Seamlessly handles mouse (e.g., `CLICK`, `MOUSE_MOVE`) and touch events (e.g., `TAP`,
  `PINCH_START`).
- **Modifier Key Support**: Supports events with modifier keys (e.g., `CTRL#CLICK`, `SHIFT#DOUBLE_CLICK`).
- **Entity-Based Filtering**: Triggers events only for specific entities or when no entity is clicked.
- **Prioritized Event Handling**: Allows callbacks to be executed in order of priority (higher priority first).
- **Event-Specific Methods**: Provides intuitive methods like `onClick`, `offClick`, `onTap`, `offTap`, etc.
- **Efficient Entity Picking**: Performs a single `scene.pick` per event to optimize performance.
- **Error Handling**: Includes robust validation and error reporting for invalid inputs.
- **Once-Only Listeners**: Supports one-time listeners that automatically unregister after triggering.

## Installation

The `CanvasEventManager` class is part of the **LGS1920/studio** project and requires a Cesium environment. Ensure you
have the following dependencies:

- **Cesium**: For 3D globe rendering and event handling.
- **@Core/constants**: For event constants (e.g., `EVENTS`, `DOUBLE_CLICK_TIMEOUT`).
- **./cesiumEvents**: For Cesium event mappings (`CESIUM_EVENTS`, `MODIFIERS`).

To use the class, include it in your project:

```javascript
import { CanvasEventManager } from './CanvasEventManager';
```

Ensure your Cesium viewer is properly initialized before creating an instance.

## Usage

### Creating an Instance

The `CanvasEventManager` is a singleton, so only one instance exists per Cesium viewer. Create an instance by passing a
valid Cesium `Viewer`:

```javascript
import { Viewer }             from 'cesium';
import { CanvasEventManager } from './CanvasEventManager';

const viewer = new Viewer('cesiumContainer');
const eventManager = new CanvasEventManager(viewer);
```

If you attempt to create another instance with the same viewer, the existing instance is returned.

### Registering Event Listeners

Use the generic `on` method or event-specific methods (e.g., `onClick`, `onTap`) to register event listeners. Each
listener can include options for entity filtering, one-time execution, and priority.

```javascript
// Generic method
eventManager.on('CLICK', (event, entityId) => {
  console.log(`Clicked at position: ${event.position}, Entity: ${entityId}`);
}, {priority: 10});

// Event-specific method
eventManager.onClick((event, entityId) => {
  console.log(`Clicked at position: ${event.position}, Entity: ${entityId}`);
}, {priority: 0});
```

The `options` object supports:

- `entity`: Filter events by entity ID (see [Entity Requirements](#entity-requirements)).
- `once`: Set to `true` to remove the listener after triggering.
- `priority`: A number indicating execution order (higher number = executed first, default: `0`).

### Removing Event Listeners

Remove listeners using the `off` method, its alias `removeEventListener`, or event-specific methods (e.g., `offClick`,
`offTap`):

```javascript
// Remove a specific callback
const callback = (event, entityId) => console.log('Clicked:', entityId);
eventManager.onClick(callback);
eventManager.off('CLICK', callback);

// Remove using event-specific method
eventManager.onTap(callback);
eventManager.offTap(callback);

// Remove using alias
eventManager.onDoubleClick(callback);
eventManager.removeEventListener('DOUBLE_CLICK', callback);

// Remove all listeners for an event
eventManager.off('CLICK');

// Remove all listeners for all events
eventManager.removeAllListeners();
```

### Event Types

The class supports the following events, as defined in `CESIUM_EVENTS`:

- **Mouse Events**:
  - `CLICK`: Left mouse click.
  - `DOUBLE_CLICK`: Left mouse double-click.
  - `DOWN`: Left mouse button down.
  - `UP`: Left mouse button up.
  - `RIGHT_DOWN`: Right mouse button down.
  - `RIGHT_UP`: Right mouse button up.
  - `RIGHT_CLICK`: Right mouse click.
  - `MIDDLE_DOWN`: Middle mouse button down.
  - `MIDDLE_UP`: Middle mouse button up.
  - `MIDDLE_CLICK`: Middle mouse click.
  - `MOUSE_MOVE`: Mouse movement.
  - `WHEEL`: Mouse wheel scroll.
- **Touch Events**:
  - `TAP`: Single touch tap.
  - `DOUBLE_TAP`: Double touch tap.
  - `LONG_TAP`: Long touch press.
- **Mobile-Specific Events**:
  - `PINCH_START`: Start of a pinch gesture.
  - `PINCH_MOVE`: Movement during a pinch gesture.
  - `PINCH_END`: End of a pinch gesture.

### Entity Requirements

The `options.entity` parameter allows filtering events based on the clicked entity's ID:

- `false` (default): Triggers the callback with `entityId=null`, regardless of the clicked entity.
- `'id'`: Triggers only if the clicked entity’s ID matches `'id'`.
- `['id1', 'id2', ...]`: Triggers only if the clicked entity’s ID is in the array.
- `[]`: Triggers only if any entity is clicked.

Example:

```javascript
eventManager.onClick((event, entityId) => {
  console.log('Clicked entity1:', entityId);
}, {entity: 'entity1'});
```

### Modifier Keys

Events can include modifier keys (Ctrl, Shift, Alt) using the format `#` (e.g., `CTRL#CLICK`):

```javascript
eventManager.on('CTRL#CLICK', (event, entityId) => {
  console.log('Ctrl+Click:', entityId);
});
```

Supported modifiers are defined in `MODIFIERS` (imported from `./cesiumEvents`).

### Priority Handling

The `options.priority` parameter allows you to control the order in which callbacks for the same event are executed.
Callbacks with higher priority values are executed first. The default priority is `0`.

Example:

```javascript
eventManager.onClick((event, entityId) => {
  console.log('High priority callback');
}, {priority: 10});

eventManager.onClick((event, entityId) => {
  console.log('Low priority callback');
}, {priority: -5});
```

In this example, the high-priority callback (`priority: 10`) executes before the low-priority callback (`priority: -5`).

## Examples

### Basic Mouse Click

Register a listener for a left mouse click:

```javascript
eventManager.onClick((event, entityId) => {
  console.log(`Clicked at position: ${event.position.x}, ${event.position.y}`);
  console.log(`Entity ID: ${entityId || 'None'}`);
}, {entity: false});
```

### Touch Tap with Entity Filtering

Handle a touch tap on a specific entity:

```javascript
eventManager.onTap((event, entityId) => {
  console.log(`Tapped entity 'marker1': ${entityId}`);
}, {entity: 'marker1'});
```

### Pinch Gesture Handling

Handle pinch gestures on mobile devices:

```javascript
eventManager.onPinchStart((event, entityId) => {
  console.log('Pinch started:', event);
});

eventManager.onPinchMove((event, entityId) => {
  console.log('Pinch moving:', event);
});

eventManager.onPinchEnd((event, entityId) => {
  console.log('Pinch ended:', event);
});
```

### Modifier Key with Click

Handle a click with the Ctrl key pressed:

```javascript
eventManager.on('CTRL#CLICK', (event, entityId) => {
  console.log(`Ctrl+Click on entity: ${entityId}`);
}, {entity: []});
```

### One-Time Listener

Register a one-time listener that triggers once and is automatically removed:

```javascript
eventManager.onDoubleClick((event, entityId) => {
  console.log('Double-clicked once:', entityId);
}, {once: true});
```

### Prioritized Event Handling

Register multiple listeners for the same event with different priorities:

```javascript
eventManager.onClick((event, entityId) => {
  console.log('High priority: Click detected');
}, {priority: 10});

eventManager.onClick((event, entityId) => {
  console.log('Default priority: Click detected');
}, {priority: 0});

eventManager.onClick((event, entityId) => {
  console.log('Low priority: Click detected');
}, {priority: -5});
```

When a click occurs, the callbacks execute in order: high priority, default priority, low priority.

## API Reference

### Constructor

```javascript
new CanvasEventManager(viewer)
```

- **Parameters**:
  - `viewer` (`Cesium.Viewer`): The Cesium viewer instance.
- **Throws**:
  - `Error`: If the viewer is invalid or missing required properties (e.g., `scene`, `canvas`).
- **Returns**:
  - The singleton instance of `CanvasEventManager`.

### Methods

#### on(eventName, callback, options)

Registers a generic event listener.

- **Parameters**:
  - `eventName` (`string`): The event name (e.g., `TAP`, `CTRL#CLICK`).
  - `callback` (`Function`): The callback function, receiving `(event, entityId)`.
  - `options` (`Object|boolean`, optional):
    - `entity` (`boolean|string|string[]`, default: `false`): Entity requirement.
    - `once` (`boolean`, default: `false`): Whether to remove the listener after triggering.
    - `priority` (`number`, default: `0`): Priority of the callback (higher number = executed first).
- **Throws**:
  - `Error`: If `eventName` is invalid, `callback` is not a function, or `eventType` is unsupported.

**Alias**: `addEventListener`

#### off(eventName, callback)

Unregisters an event listener.

- **Parameters**:
  - `eventName` (`string`): The event name to remove.
  - `callback` (`Function`, optional): The specific callback to remove. If omitted, all handlers are removed.

**Alias**: `removeEventListener`

#### removeAllListeners()

Removes all registered event listeners for all events.

#### destroy()

Cleans up all resources, removing event listeners and destroying the handler.

#### Event-Specific Methods

The following methods are shortcuts for registering and unregistering listeners for specific events. Each `on` method is
equivalent to calling `on('EVENT_NAME', callback, options)`, and each `off` method is equivalent to calling
`off('EVENT_NAME', callback)`.

- **Mouse Events**:
  - `onClick(callback, options)`, `offClick(callback)`: Left mouse click.
  - `onDoubleClick(callback, options)`, `offDoubleClick(callback)`: Left mouse double-click.
  - `onDown(callback, options)`, `offDown(callback)`: Left mouse button down.
  - `onUp(callback, options)`, `offUp(callback)`: Left mouse button up.
  - `onRightDown(callback, options)`, `offRightDown(callback)`: Right mouse button down.
  - `onRightUp(callback, options)`, `offRightUp(callback)`: Right mouse button up.
  - `onRightClick(callback, options)`, `offRightClick(callback)`: Right mouse click.
  - `onMiddleDown(callback, options)`, `offMiddleDown(callback)`: Middle mouse button down.
  - `onMiddleUp(callback, options)`, `offMiddleUp(callback)`: Middle mouse button up.
  - `onMiddleClick(callback, options)`, `offMiddleClick(callback)`: Middle mouse click.
  - `onMouseMove(callback, options)`, `offMouseMove(callback)`: Mouse movement.
  - `onWheel(callback, options)`, `offWheel(callback)`: Mouse wheel scroll.
- **Touch Events**:
  - `onTap(callback, options)`, `offTap(callback)`: Single touch tap.
  - `onDoubleTap(callback, options)`, `offDoubleTap(callback)`: Double touch tap.
  - `onLongTap(callback, options)`, `offLongTap(callback)`: Long touch press.
- **Mobile-Specific Events**:
  - `onPinchStart(callback, options)`, `offPinchStart(callback)`: Start of a pinch gesture.
  - `onPinchMove(callback, options)`, `offPinchMove(callback)`: Movement during a pinch gesture.
  - `onPinchEnd(callback, options)`, `offPinchEnd(callback)`: End of a pinch gesture.

For `on` methods:

- **Parameters**:
  - `callback` (`Function`): The callback function, receiving `(event, entityId)`.
  - `options` (`Object|boolean`, optional): Same as for `on`.
- **Throws**:
  - `Error`: If `callback` is not a function.

For `off` methods:

- **Parameters**:
  - `callback` (`Function`): The callback function to remove.
- **Throws**:
  - `Error`: If `callback` is not a function.

## Limitations

- **Touch and Mouse Exclusivity**: Certain events are exclusive to touch or mouse devices (e.g., `TAP` for touch,
  `RIGHT_CLICK` for mouse).
- **Modifier Keys**: Modifier keys are only supported for mouse events, not touch events.
- **Context Menu**: The context menu is disabled on touch devices to prevent unintended `RIGHT_CLICK` events.
- **Entity Picking**: Entity picking relies on Cesium’s `scene.pick`, which may have performance implications in scenes
  with many entities.
- **Priority Sorting**: Sorting callbacks by priority adds minor overhead, negligible unless many callbacks are
  registered for the same event.

## Contributing

Contributions are welcome! Please submit pull requests or issues to the **LGS1920/studio** repository.
Contact [contact@lgs1920.fr](mailto:contact@lgs1920.fr) for inquiries.

## License

Copyright © 2025 LGS1920. All rights reserved.

This project is licensed under the LGS1920 proprietary license. Contact [contact@lgs1920.fr](mailto:contact@lgs1920.fr)
for licensing inquiries.