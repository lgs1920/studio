# CanvasEventManager - Documentation

## Overview
The `CanvasEventManager` is a powerful singleton class that manages Cesium mouse and touch events with support for custom event handling, entity targeting, and propagation control. It provides a comprehensive system for handling both standard Cesium events and custom touch events like taps, long taps, and double taps.

## Features
- Singleton pattern for application-wide event management
- Support for standard mouse events and custom touch gestures
- Entity-specific event targeting
- Event propagation control
- Priority-based event handling
- Modifier key tracking (Ctrl, Alt, Shift)
- One-time event handlers
- Dynamic generation of modifier-key combination events

## Event Types
The `CanvasEventManager` supports the following event types (defined in `CESIUM_EVENTS` constant):

### Standard Cesium Events:
- `LEFT_CLICK`: Mouse left button click
- `LEFT_DOUBLE_CLICK`: Mouse left button double click
- `RIGHT_DOWN`: Mouse right button press
- `RIGHT_UP`: Mouse right button release
- `RIGHT_CLICK`: Mouse right button click
- `MIDDLE_DOWN`: Mouse middle button press
- `MIDDLE_UP`: Mouse middle button release
- `MIDDLE_CLICK`: Mouse middle button click
- `MOUSE_MOVE`: Mouse movement
- `WHEEL`: Mouse wheel scroll

### Touch Events:
- `TAP`: Single tap (touch and release)
- `DOUBLE_TAP`: Two taps in quick succession
- `LONG_TAP`: Press and hold

### Mobile Specific Events:
- `PINCH_START`: Start of pinch gesture
- `PINCH_MOVE`: Movement during pinch gesture
- `PINCH_END`: End of pinch gesture

### Modifier Key Combinations:
All standard events can be combined with modifier keys to create composite events:
- `CTRL_LEFT_CLICK`: Ctrl + left click
- `ALT_LEFT_CLICK`: Alt + left click
- `SHIFT_LEFT_CLICK`: Shift + left click
- `CTRL_ALT_LEFT_CLICK`: Ctrl + Alt + left click
- And many more combinations

## Basic Usage

### Initialization

The `CanvasEventManager` is typically initialized as part of your application setup:

```javascript
// Get the singleton instance
const eventManager = CanvasEventManager.getInstance();

// OR using the static accessor (preferred singleton pattern)
const eventManager = CanvasEventManager.instance;
```

### Adding Event Listeners

```javascript
// Basic event listener
eventManager.addEventListener('LEFT_CLICK', (event, pickedEntity) => {
    console.log('Left click detected', pickedEntity);
});

// Short form method
eventManager.on('TAP', (event, pickedEntity) => {
    console.log('Tap detected', pickedEntity);
});
```

### Removing Event Listeners

```javascript
// Remove by subscription ID
const subscriptionId = eventManager.addEventListener('MOUSE_MOVE', myHandler);
eventManager.removeEventListener('MOUSE_MOVE', subscriptionId);

// Remove by function reference
eventManager.removeEventListener('MOUSE_MOVE', myHandler);

// Short form method
eventManager.off('MOUSE_MOVE', subscriptionId);
```

## Advanced Usage Examples

### 1. Entity-Specific Event Handling

Listen for events on a specific Cesium entity:

```javascript
// Handle double taps only on a specific entity 
eventManager.addEventListener('DOUBLE_TAP', (event, pickedEntity) => {
    console.log('Double tap on entity:', pickedEntity.id);
    // Perform entity-specific actions 
}, {
                                  entity:    myEntity,    // Only trigger for this entity
                                  propagate: false     // Don't let other handlers process this event
                              });
```

### 2. Handling Events with Modifier Keys

#### Method 1: Using the modifiers option

```javascript
// Handle Ctrl+Click using modifiers option 
eventManager.addEventListener('LEFT_CLICK', (event, pickedEntity) => {
    console.log('Ctrl+Click detected');
}, {
                                  modifiers: {
                                      ctrl:  true,      // Ctrl must be pressed
                                      alt:   false,      // Alt must NOT be pressed
                                      shift: undefined  // Don't care about Shift state
                                  }
                              });
```

#### Method 2: Using composite event names (NEW)

```javascript
// Handle Ctrl+Click using composite event name
eventManager.addEventListener('CTRL_LEFT_CLICK', (event, pickedEntity) => {
    console.log('Ctrl+Click detected using composite event');
});

// Handle Alt+Shift+Click
eventManager.addEventListener('ALT_SHIFT_LEFT_CLICK', (event, pickedEntity) => {
    console.log('Alt+Shift+Click detected');
});

// Handle Ctrl+Alt+Double Click
eventManager.addEventListener('CTRL_ALT_LEFT_DOUBLE_CLICK', (event, pickedEntity) => {
    console.log('Ctrl+Alt+Double Click detected');
});
```

### 3. One-Time Event Handlers

One-time event handlers are perfect for situations where you need to respond to an event only once, such as
initialization, user onboarding, or temporary interactions.

```javascript
// Method 1: Using options object with once: true
eventManager.addEventListener('RIGHT_CLICK', (event, pickedEntity) => {
    console.log('This handler executes only for the first right click');
    doSomethingImportant(pickedEntity);
}, {
                                  once: true  // Handler auto-removes after first execution
                              });

// Method 2: Alternative shorthand syntax (boolean as third parameter)
eventManager.addEventListener('RIGHT_CLICK', myHandler, true);

// Method 3: Using the shorthand 'on' method with options
eventManager.on('TAP', (event, pickedEntity) => {
    showOnboardingTip('You just tapped the screen!');
}, {
                    once: true
});

// Example: Wait for user to click any entity exactly once
eventManager.on('LEFT_CLICK', (event, pickedEntity) => {
    if (pickedEntity) {
        highlightEntity(pickedEntity);
        showEntityInfo(pickedEntity);
        console.log('First entity selection complete!');
    }
}, {
                    once: true
                });
```

One-time handlers are automatically removed after they execute, so there's no need to manually call
`removeEventListener()`. They can be combined with other options like entity filtering, propagation control, and
priority:

```javascript
// One-time handler with other options 
eventManager.on('DOUBLE_TAP', handleInitialSelection, {
    once:      true,
    entity:    targetEntity,
    priority:  50,
    propagate: false
});
```

### 4. Priority-Based Event Handling

```javascript
// Higher priority handler (lower number = higher priority)
eventManager.addEventListener('LEFT_CLICK', (event, pickedEntity) => {
    console.log('High priority handler');
    return false; // Prevent propagation to lower priority handlers
}, {
                                  priority: 50  // Default is 100
                              });

// Lower priority handler (will only run if higher priority handlers allow propagation)
eventManager.addEventListener('LEFT_CLICK', (event, pickedEntity) => {
    console.log('Low priority handler');
}, {
                                  priority: 150
                              });
```

### 5. Custom Context for Callbacks

```javascript
eventManager.addEventListener('LONG_TAP', function (event, pickedEntity) {
    // 'this' refers to myObject
    this.handleLongTap(pickedEntity);
}, {
                                  context: myObject
                              });
```

### 6. Manually Dispatching Events

```javascript
// Manually trigger an event
eventManager.dispatchEvent('TAP', {position: {x: 100, y: 100}});

// The system will automatically generate related modifier events if any modifiers are pressed
// So if Ctrl is pressed, it will also trigger a 'CTRL_TAP' event
```

### 7. Check Current State

```javascript
// Check if a modifier key is pressed
if (eventManager.isCtrlKeyPressed()) {
    // Special handling for Ctrl key
}

// Get count of listeners for an event type
const listenerCount = eventManager.listenerCount('LEFT_CLICK');

// Check if an entity has subscriptions for a specific event type
const hasSubscriptions = eventManager.hasEntitySubscriptions('TAP', myEntity);
```

### 8. Combining Multiple Modifier Keys

```javascript
// Listen for Ctrl+Alt+Click
eventManager.addEventListener('CTRL_ALT_LEFT_CLICK', (event, pickedEntity) => {
    console.log('Ctrl+Alt+Left click detected');
});

// The modifier keys can be in any order
eventManager.addEventListener('ALT_CTRL_LEFT_CLICK', (event, pickedEntity) => {
    console.log('This also works for Ctrl+Alt+Left click');
});

// You can also use the traditional approach
eventManager.addEventListener('LEFT_CLICK', (event, pickedEntity) => {
    console.log('Ctrl+Alt+Left click detected via modifiers option');
}, {
                                  modifiers: {
                                      ctrl:  true,
                                      alt:   true,
                                      shift: false
                                  }
                              });
```

### 9. Entity Selection with Keyboard Shortcuts

The `CanvasEventManager` now supports keyboard shortcuts with modifier keys on selected entities:

```javascript
// Setup entity default provider (e.g., current POI)
canvasEventManager.setDefaultEntityProvider(() => {
    return lgs.currentPOI || lgs.mapPointEntity;
});

// Listen for Ctrl+R on the selected entity
canvasEventManager.addEventListener('CTRL_R', (event, entity) => {
    if (entity) {
        console.log('Ctrl+R applied to entity:', entity);
        // Perform actions on the entity
    }
});
```

#### Entity Selection Workflow

1. Click on an entity to select it
2. Use keyboard shortcuts (like Ctrl+R) to perform actions on the selected entity
3. If no entity is explicitly selected, the default entity (e.g., current POI) will be used

#### API for Entity Selection

``` javascript
// Get the currently selected entity (or default if none selected)
const entity = canvasEventManager.getSelectedEntity();

// Manually set the selected entity
canvasEventManager.setSelectedEntity(myEntity);

// Clear the selected entity
canvasEventManager.clearSelectedEntity();

// Create a keyboard shortcut name
const shortcutName = canvasEventManager.createKeyboardEventName('X', { 
    ctrl: true,
    alt: false,
    shift: true
}); // Returns "CTRL_SHIFT_X"
```

## API Reference

### CanvasEventManager Methods

| Method                                           | Return Type | Description                                                       |
|--------------------------------------------------|-------------|-------------------------------------------------------------------|
| `addEventListener(eventType, callback, options)` | `string`    | Registers an event handler and returns a subscription ID          |
| `on(eventType, callback, options)`               | `string`    | Alias for addEventListener                                        |
| `removeEventListener(eventType, subscription)`   | `boolean`   | Removes an event handler by subscription ID or callback reference |
| `off(eventType, subscription)`                   | `boolean`   | Alias for removeEventListener                                     |
| `dispatchEvent(eventType, eventData)`            | `void`      | Manually triggers an event                                        |
| `isCtrlKeyPressed()`                             | `boolean`   | Returns whether the Ctrl key is currently pressed                 |
| `isAltKeyPressed()`                              | `boolean`   | Returns whether the Alt key is currently pressed                  |
| `isShiftKeyPressed()`                            | `boolean`   | Returns whether the Shift key is currently pressed                |
| `listenerCount(eventType)`                       | `number`    | Returns the number of listeners for a specific event type         |
| `hasEntitySubscriptions(eventType, entity)`      | `boolean`   | Checks if an entity has subscriptions for a specific event type   |
| `setDefaultEntityProvider(func)`                 | `void`      | Sets a function that provides the default entity                  |
| `getSelectedEntity()`                            | `Object`    | Gets the selected entity or default entity                        |
| `setSelectedEntity(entity)`                      | `void`      | Sets the currently selected entity                                |
| `clearSelectedEntity()`                          | `void`      | Clears the selected entity                                        |
| `createKeyboardEventName(letter, options)`       | `string`    

### Options Object

| Property    | Type            | Default     | Description                                              |
|-------------|-----------------|-------------|----------------------------------------------------------|
| `entity`    | `Cesium.Entity` | `undefined` | Only trigger for this specific entity                    |
| `propagate` | `boolean`       | `true`      | Whether to allow event propagation to other handlers     |
| `priority`  | `number`        | `100`       | Priority of the handler (lower number = higher priority) |
| `once`      | `boolean`       | `false`     | Whether the handler should be executed only once         |
| `context`   | `object`        | `undefined` | Context object to be used as `this` in the callback      |

## Browser Compatibility

The `CanvasEventManager` is compatible with all modern browsers. However, please note:

- Touch events (`TAP`, `DOUBLE_TAP`, `LONG_TAP`) are only available on touch-enabled devices
- Mobile-specific events (`PINCH_START`, `PINCH_MOVE`, `PINCH_END`) require multitouch support
- Key modifier events work best with physical keyboards and may have limitations on mobile devices
- For best cross-platform compatibility, consider using basic events with device detection

## Cesium Integration

The `CanvasEventManager` works as a wrapper around Cesium's built-in event handling system, providing additional
functionality:

1. **Canvas Element**: The manager attaches event listeners to the Cesium canvas element
2. **Entity Picking**: Uses Cesium's entity picking capability to determine which entity was clicked
3. **Event Coordinates**: Converts screen coordinates to Cesium world coordinates when needed
4. **Camera Integration**: Some events (like pinch gestures) automatically integrate with Cesium's camera controls

### Initialization with Cesium

```javascript
// Initialize with an existing Cesium viewer
const viewer = new Cesium.Viewer('cesiumContainer');
const eventManager = new CanvasEventManager(viewer);
```
## Best Practices
1. Use the appropriate event type for your use case
2. Remove event listeners when they are no longer needed
3. Use entity filtering to limit events to relevant objects
4. Consider using composite event names for better code readability
5. Handle errors appropriately in your event callbacks

## Error Handling

The `CanvasEventManager` includes built-in error handling:

- Invalid event types will trigger a console warning but won't throw exceptions
- Event handlers with errors are isolated and won't affect other handlers
- All API methods include parameter validation with helpful error messages