# LGS1920 Studio Cropper

## Overview

The LGS1920 Studio Cropper is a JavaScript library for managing crop regions on canvas, video, or image elements. It
provides a flexible and interactive way to define and manipulate crop areas, with support for dragging, resizing,
centering, and maximizing/restoring the crop region. The library integrates with a Valtio store for state persistence
and supports both mouse and touch interactions.

This project is developed by the LGS1920 Team. For inquiries, contact [contact@lgs1920.fr](mailto:contact@lgs1920.fr).

**Created**: 2025-07-15  
**Last Modified**: 2025-07-16  
**Version**: 1.0.0  
**License**: Copyright © 2025 LGS1920

## Installation

To use the LGS1920 Studio Cropper in your project, follow these steps:

1. **Install via npm** (if published):
   Copy the `CropperManager.js` file into your project.

2. **Import the CropperManager**:
   ```javascript
   import { CropperManager } from './CropperManager.js'
   ```

3. **Dependencies**:
    - [Valtio](https://github.com/pmndrs/valtio) for state management.
    - Ensure your project supports modern JavaScript (ES modules).

## Usage

The `CropperManager` class is initialized with a source element (canvas, video, or image), an optional container
element, a Valtio store, and configuration options. It handles crop region interactions and persists the crop state in
the provided store.

### Basic Example

```javascript
import { proxy }          from 'valtio'
import { CropperManager } from './CropperManager.js'

// Initialize the source element and store
const source = document.querySelector('canvas')
const store = proxy({x: 0, y: 0, width: 512, height: 360})

// Create a CropperManager instance
const cropper = new CropperManager(source, null, store, {
    draggable:     true,
    resizable:     true,
    lockCentering: true,
    vibrate:       true
})

// Listen for the onClose event to hide the crop zone
source.addEventListener('onClose', (event) => {
    console.log('Cropper closed with crop:', event.detail.crop)
    // Hide the crop zone UI (example)
    document.querySelector('.cropper-overlay').style.display = 'none'
})

// Close the cropper from the UI (e.g., button click)
document.querySelector('#close-cropper-btn').addEventListener('click', () => {
    cropper.closeCropper()
})

// Example interactions:
// - Shift+Ctrl+Click to toggle maximize/restore
// - Double-click or double-tap to exit the cropper
// - Ctrl+Click (without Shift) to center the crop region
// - Call cropper.closeCropper() from the UI to close the cropper
```

### Hiding the Crop Zone

When the cropper is closed (via double-click, double-tap, or calling `closeCropper`), it dispatches a DOM `onClose`
event on the source element. The event includes the final crop state in `event.detail.crop`. Use this event to hide the
crop zone UI, for example:

```javascript
source.addEventListener('onClose', (event) => {
    const cropperOverlay = document.querySelector('.cropper-overlay')
    if (cropperOverlay) {
        cropperOverlay.style.display = 'none'
    }
})
```

## Interactions

The `CropperManager` supports the following user interactions:

- **Dragging**: Click and drag (or touch and drag) the crop region to move it.
- **Resizing**: Use the handles (north, south, east, west, and corners) to resize the crop region. Hold Shift to resize
  asymmetrically.
- **Centering**: Press **Ctrl+Click** (without Shift) to center the crop region within the source bounds.
- **Maximize/Restore**: Press **Shift+Ctrl+Click** to toggle between maximizing the crop region to the source bounds and
  restoring it to its previous state.
- **Close Cropper**: Perform a **double-click** (mouse) or **double-tap** (single touch) to dispatch the `onClose` DOM
  event and destroy the cropper, allowing the UI to hide the crop zone. Alternatively, call the `closeCropper` method
  from the UI to achieve the same effect.

## API Documentation

### `CropperManager`

**Constructor**:

```javascript
new CropperManager(source, container, store, options)
```

- **Parameters**:
    - `source` (`HTMLCanvasElement | HTMLVideoElement | HTMLImageElement`): The element to crop.
    - `container` (`HTMLElement`, optional): The container element for bounds (defaults to `source`).
    - `store` (`Object`): A Valtio store to persist crop state (`x`, `y`, `width`, `height`).
    - `options` (`Object`, optional): Configuration options.
        - `draggable` (`boolean`, default: `true`): Enable dragging the crop region.
        - `resizable` (`boolean`, default: `true`): Enable resizing the crop region.
        - `lockCentering` (`boolean`, default: `true`): Snap to center when dragging near the source center.
        - `vibrate` (`boolean`, default: `true`): Trigger haptic feedback on supported devices when snapping to center.

**Methods**:

- `updateWindowSize()`: Updates the device pixel ratio on window resize.
- `getSourceBounds()`: Returns the source element’s bounds in device pixels.
- `getStyles(crop, interactionState)`: Calculates styles for crop UI elements.
- `updateCropOnSourceChange(cropper)`: Updates crop dimensions on source changes (e.g., window resize).
- `handleStart(action, event, cropper)`: Handles the start of drag or resize interactions.
- `handleMove(event, cropper, bounds)`: Handles movement during drag or resize.
- `handleEnd()`: Handles the end of an interaction.
- `updateStore(newCrop)`: Updates the store with new crop values.
- `centerCrop(cropper)`: Centers the crop region within the source bounds.
- `maximizeRestore(cropper)`: Toggles between maximized and restored crop states.
- `closeCropper()`: Closes the cropper, dispatching the `onClose` event and cleaning up internal state.
- `resetCentering(callback)`: Resets centering lines when no interaction is active.
- `destroy()`: Cleans up timers and animation frames, exiting the cropper.

**Events**:

- `onClose`: A DOM event dispatched on the `source` element when the cropper is closed via double-click, double-tap, or
  calling `closeCropper`.
    - **Properties**:
        - `bubbles`: `true`
        - `cancelable`: `true`
        - `detail.crop`: An object containing the final crop state (`x`, `y`, `width`, `height`).

## Notes

- The cropper does not manage the UI directly. The application must handle rendering the crop zone and responding to the
  `onClose` event to hide it.
- Double-click, double-tap, or calling `closeCropper` exits the cropper without modifying the crop state (e.g., no
  maximization occurs).
- The cropper supports high-DPI displays by accounting for `window.devicePixelRatio`.
- Ensure the Valtio store is properly initialized with `x`, `y`, `width`, and `height` properties to avoid unexpected
  behavior.

## Contact

For support or contributions, contact the LGS1920 Team at [contact@lgs1920.fr](mailto:contact@lgs1920.fr).