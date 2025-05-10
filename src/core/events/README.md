# LGS1920 Studio Project

## Overview

The LGS1920 Studio project provides a robust event management system for Cesium-based applications, enabling seamless
handling of mouse and touch interactions on a 3D globe or map. The core component, `CanvasEventManager`, is designed to
manage canvas events with support for modifier keys, entity-based filtering, prioritized event handling, and propagation
control.

This project is developed by the LGS1920 Team. For inquiries, contact us
at [contact@lgs1920.fr](mailto:contact@lgs1920.fr).

## Installation

1. **Prerequisites**:

- Node.js (version 14 or higher)
- CesiumJS (included as a dependency)
- A modern web browser supporting WebGL

2. **Clone the Repository**:
   ```bash
   git clone https://github.com/LGS1920/studio.git
   cd studio
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run the Development Server**:
   ```bash
   npm start
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

## Usage

The `CanvasEventManager` class is the primary interface for handling canvas events in a Cesium viewer. It supports a
variety of events (e.g., `CLICK`, `DOUBLE_CLICK`, `TAP`, `LONG_TAP`) and provides fine-grained control over event
listeners through options like `entity`, `once`, `priority`, and `preventLowerPriority`.

### Initializing CanvasEventManager

```javascript
import { CanvasEventManager } from './CanvasEventManager.js';
import { Viewer }             from 'cesium';

// Initialize Cesium Viewer
const viewer = new Viewer('cesiumContainer');

// Create CanvasEventManager instance (singleton)
const eventManager = new CanvasEventManager(viewer);
```

### Registering Event Listeners

Use the `on` method (or its aliases like `onClick`, `onTap`) to register event listeners. The method supports the
following options:

- `entity`: Restrict the listener to specific entities (`false`, string ID, array of IDs, or empty array for any
  entity).
- `once`: If `true`, the listener is removed after being triggered once (default: `false`).
- `priority`: A number indicating the listener's priority (higher numbers execute first; default: `0`).
- `preventLowerPriority`: If `true`, prevents execution of listeners with lower priority for the same event (default:
  `false`).

#### Example: Basic Click Event

```javascript
eventManager.onClick((event, entityId) => {
  console.log(`Clicked entity: ${entityId || 'None'}`);
}, {entity: 'entity1'});
```

#### Example: Prioritized Listeners with Propagation Control

```javascript
// High-priority listener that blocks lower-priority listeners
eventManager.on('CLICK', (event, entityId) => {
  console.log('High priority listener:', entityId);
}, {entity: 'entity1', priority: 10, preventLowerPriority: true});

// Low-priority listener (not executed if preventLowerPriority is true)
eventManager.on('CLICK', (event, entityId) => {
  console.log('Low priority listener:', entityId);
}, {entity: 'entity1', priority: 5});

// Clicking on 'entity1' will only trigger the high-priority listener
```

#### Example: One-Time Touch Event

```javascript
eventManager.onTap((event, entityId) => {
  console.log('Tapped entity:', entityId);
}, {entity: ['entity1', 'entity2'], once: true});
```

### Removing Listeners

Remove specific listeners using the `off` method or its aliases (e.g., `offClick`, `offTap`):

```javascript
const callback = (event, entityId) => console.log('Clicked:', entityId);
eventManager.onClick(callback, {entity: 'entity1'});
eventManager.offClick(callback);
```

Remove all listeners for a specific entity:

```javascript
eventManager.removeAllListenersByEntity('entity1');
```

### Supported Events

- Mouse: `CLICK`, `DOUBLE_CLICK`, `RIGHT_CLICK`, `MIDDLE_CLICK`, `MOUSE_MOVE`, `WHEEL`, `DOWN`, `UP`, `RIGHT_DOWN`,
  `RIGHT_UP`, `MIDDLE_DOWN`, `MIDDLE_UP`
- Touch: `TAP`, `DOUBLE_TAP`, `LONG_TAP`, `PINCH_START`, `PINCH_MOVE`, `PINCH_END`
- Modifier Keys: `CTRL`, `SHIFT`, `ALT` (e.g., `CTRL#CLICK`)

## Features

- **Singleton Pattern**: Ensures a single `CanvasEventManager` instance per Cesium viewer.
- **Mouse and Touch Support**: Handles both mouse and touch events with automatic device detection.
- **Modifier Key Support**: Allows events like `CTRL#CLICK` or `SHIFT#DOUBLE_CLICK`.
- **Entity-Based Filtering**: Restrict listeners to specific entities or groups of entities.
- **Prioritized Execution**: Listeners with higher `priority` values execute first.
- **Propagation Control**: The `preventLowerPriority` option allows high-priority listeners to block lower-priority
  ones.
- **One-Time Listeners**: The `once` option automatically removes listeners after execution.
- **Flexible Entity Matching**: Supports single IDs, arrays of IDs, or any entity (`[]`).
- **Robust Cleanup**: Methods like `removeAllListeners`, `removeAllListenersByEntity`, and `destroy` ensure proper
  resource management.

## Example: Advanced Event Handling

```javascript
// Register listeners with different priorities and propagation control
eventManager.on('CLICK', (event, entityId) => {
  console.log('Priority 10 (blocks lower):', entityId);
}, {entity: 'entity1', priority: 10, preventLowerPriority: true});

eventManager.on('CLICK', (event, entityId) => {
  console.log('Priority 5 (not executed):', entityId);
}, {entity: 'entity1', priority: 5});

eventManager.on('CLICK', (event, entityId) => {
  console.log('Priority 0 (not executed):', entityId);
}, {entity: 'entity1', priority: 0});

// Register a touch event for multiple entities
eventManager.onTap((event, entityId) => {
  console.log('Tapped one of:', entityId);
}, {entity: ['entity1', 'entity2'], priority: 2});

// Remove all listeners for a specific entity
eventManager.removeAllListenersByEntity('entity1');
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit your changes (`git commit -m 'Add your feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a Pull Request.

For bugs or feature requests, please open an issue on GitHub.

## License

Copyright © 2025 LGS1920. All rights reserved.

## Contact

For support or inquiries, reach out to the LGS1920 Team at [contact@lgs1920.fr](mailto:contact@lgs1920.fr).

Last updated: May 10, 2025