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