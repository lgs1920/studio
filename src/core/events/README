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
```

javascript // The manager is a singleton, so subsequent calls return the same instance const eventManager = new
CanvasEventManager();

``` 

### Adding Event Listeners
```

javascript // Basic event listener eventManager.addEventListener('LEFT_CLICK', (event, pickedEntity) => { console.log('
Left click detected', pickedEntity); });
// Short form method eventManager.on('TAP', (event, pickedEntity) => { console.log('Tap detected', pickedEntity); });

``` 

### Removing Event Listeners
```

javascript // Remove by subscription ID const subscriptionId = eventManager.addEventListener('MOUSE_MOVE', myHandler);
eventManager.removeEventListener('MOUSE_MOVE', subscriptionId);
// Remove by function reference eventManager.removeEventListener('MOUSE_MOVE', myHandler);
// Short form method eventManager.off('MOUSE_MOVE', subscriptionId);

``` 

## Advanced Usage Examples

### 1. Entity-Specific Event Handling

Listen for events on a specific Cesium entity:
```

javascript // Handle double taps only on a specific entity eventManager.addEventListener('DOUBLE_TAP', (event,
pickedEntity) => { console.log('Double tap on entity:', pickedEntity.id); // Perform entity-specific actions }, {
entity: myEntity, // Only trigger for this entity propagate: false // Don't let other handlers process this event });

``` 

### 2. Handling Events with Modifier Keys

#### Method 1: Using the modifiers option
```

javascript // Handle Ctrl+Click using modifiers option eventManager.addEventListener('LEFT_CLICK', (event,
pickedEntity) => { console.log('Ctrl+Click detected'); }, { modifiers: { ctrl: true, // Ctrl must be pressed alt:
false, // Alt must NOT be pressed shift: undefined // Don't care about Shift state } });

``` 

#### Method 2: Using composite event names (NEW)
```

javascript // Handle Ctrl+Click using composite event name eventManager.addEventListener('CTRL_LEFT_CLICK', (event,
pickedEntity) => { console.log('Ctrl+Click detected using composite event'); });
// Handle Alt+Shift+Click eventManager.addEventListener('ALT_SHIFT_LEFT_CLICK', (event, pickedEntity) => { console.log('
Alt+Shift+Click detected'); });
// Handle Ctrl+Alt+Double Click eventManager.addEventListener('CTRL_ALT_LEFT_DOUBLE_CLICK', (event, pickedEntity) => {
console.log('Ctrl+Alt+Double Click detected'); });

``` 

### 3. One-Time Event Handlers

```javascript
// This handler will execute only once
eventManager.addEventListener('RIGHT_CLICK', (event, pickedEntity) => {
    console.log('One-time right click handler');
}, {
    once: true
});

// Alternative syntax
eventManager.addEventListener('RIGHT_CLICK', myHandler, true);
```

### 4. Priority-Based Event Handling

```javascript
// Higher priority handler (lower number = higher priority)
eventManager.addEventListener('LEFT_CLICK', (event, pickedEntity) => {
    console.log('High priority handler');
    return false;  // Prevent propagation to lower priority handlers
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
eventManager.dispatchEvent('TAP', {
    position: {x: 100, y: 100}
});

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

## Best Practices

1. Use the appropriate event type for your use case
2. Remove event listeners when they are no longer needed
3. Use entity filtering to limit events to relevant objects

