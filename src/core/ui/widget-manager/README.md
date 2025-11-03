# WidgetManager

**File**: `WidgetManager.js`  
**Project**: `LGS1920/studio`  
**Author**: LGS1920 Team – contact@lgs1920.fr  
**Created on**: 2025-10-28  
**Last modified**: 2025-10-28

---

## Description

`WidgetManager` is a **singleton class** acting as the central interface for managing **draggable**, **resizable**, *
*scalable**, and **croppable** widgets.  
It delegates each responsibility to specialized classes to ensure clear separation of concerns:

- `WidgetCore`: widget lifecycle and configuration management
- `WidgetDraggable`: drag handling
- `WidgetResizable`: resize handling
- `WidgetScalable`: scale handling
- `WidgetCropper`: cropping and overlay management
- `WidgetTransform`: CSS transform manipulation
- `WidgetPosition`: quick positioning (center, top-left, etc.)
- `WidgetDBManager`: IndexedDB persistence

---

## Instantiation

```js
import { WidgetManager } from '@/Core/ui/widget-manager/WidgetManager'

const manager = new WidgetManager() // Always returns the same instance
```

---

## Public Methods

| Method                   | Inputs (type)                                                                                                                                  | Output (type)                                                                                       | Description                                                                          |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| `retrieveElementId`      | `element` (`HTMLElement`)                                                                                                                      | `string \| null`                                                                                    | Retrieves the widget ID via `data-widget-id`.                                        |
| `setupElement`           | `element` (`HTMLElement`), `initialConfig` (`Object`), `setBounds` (`Function`), `setPosition` (`Function`), `moveable` (`Object`)             | `Promise<boolean>`                                                                                  | Initializes a DOM element as a widget (creates `moveable`, sets up listeners, etc.). |
| `applyPosition`          | `element` (`HTMLElement`), `position` (`Object \| string`), `moveable` (`Object`), `isDragging` (`boolean`), `setControlBoxProps` (`Function`) | `void`                                                                                              | Applies position/transform and updates the control box.                              |
| `manageControlBox`       | `moveable` (`Object`), `setControlBoxProps` (`Function`), `_controlBoxTimer` (`Object`), `show` (`boolean`), `isMouseOver` (`boolean`)         | `void`                                                                                              | Manages control box visibility based on interactions.                                |
| `getRatio`               | `ratio` (`string`)                                                                                                                             | `Object`                                                                                            | Returns ratio configuration (e.g., `'16x9'`).                                        |
| `computeInitialPosition` | `config` (`Object`), `element` (`HTMLElement`), `isResize` (`boolean = false`)                                                                 | `Object { left: number, top: number }`                                                              | Computes initial widget position.                                                    |
| `refreshBounds`          | `config` (`Object`), `moveable` (`Object`)                                                                                                     | `Object`                                                                                            | Recalculates container bounds.                                                       |
| `setBoundStatus`         | `element` (`HTMLElement`), `config` (`Object`)                                                                                                 | `Object`                                                                                            | Indicates if the widget touches container edges.                                     |
| `getWidgetConfig`        | `elementId` (`string`)                                                                                                                         | `Object \| undefined`                                                                               | Returns widget configuration.                                                        |
| `getElementById`         | `id` (`string`)                                                                                                                                | `HTMLElement \| null`                                                                               | Returns the widget DOM element.                                                      |
| `getIdFromElement`       | `element` (`HTMLElement`)                                                                                                                      | `string \| null`                                                                                    | Returns the widget ID from the element.                                              |
| `getInnerOverlay`        | `element` (`HTMLElement`)                                                                                                                      | `HTMLElement \| undefined`                                                                          | Returns the inner overlay element.                                                   |
| `setConfig`              | `elementId` (`string`), `config` (`Object`)                                                                                                    | `void`                                                                                              | Updates widget configuration.                                                        |
| `getWidgetConfigByGroup` | `groupId` (`string`)                                                                                                                           | `Object[]`                                                                                          | Returns configurations for all widgets in a group.                                   |
| `disposeElement`         | `element` (`HTMLElement`)                                                                                                                      | `void`                                                                                              | Cleans up resources for a single widget.                                             |
| `disposeByGroup`         | `groupId` (`string`), `usePersist` (`boolean = false`)                                                                                         | `void`                                                                                              | Cleans up all widgets in a group (respects `persist` flag).                          |
| `monitorContainerResize` | `config` (`Object`), `setBounds` (`Function`), `moveable` (`Object`), `element` (`HTMLElement`), `setPosition` (`Function`)                    | `void`                                                                                              | Monitors container resize and updates widgets.                                       |
| `onDrag`                 | `event` (`Object`)                                                                                                                             | `void`                                                                                              | Handles drag (updates crop overlay in real-time).                                    |
| `onDragStart`            | `event` (`Object`)                                                                                                                             | `void`                                                                                              | Drag start handler.                                                                  |
| `onDragEnd`              | `event` (`Object`)                                                                                                                             | `void`                                                                                              | Drag end handler.                                                                    |
| `onResizeStart`          | `event` (`Object`)                                                                                                                             | `void`                                                                                              | Resize start handler.                                                                |
| `onResize`               | `event` (`Object`), `refs` (`Object`), `setPosition` (`Function`)                                                                              | `void`                                                                                              | Handles resize (updates dimensions/position).                                        |
| `onResizeEnd`            | `event` (`Object`)                                                                                                                             | `void`                                                                                              | Resize end handler.                                                                  |
| `onScaleStart`           | `event` (`Object`)                                                                                                                             | `Promise<void>`                                                                                     | Scale start handler.                                                                 |
| `onScale`                | `event` (`Object`), `refs` (`Object`), `setPosition` (`Function`)                                                                              | `void`                                                                                              | Handles scale.                                                                       |
| `onScaleEnd`             | `event` (`Object`)                                                                                                                             | `Promise<void>`                                                                                     | Scale end handler.                                                                   |
| `updateCropRatio`        | `cropzoneId` (`string`), `aspectRatio` (`number`), `lockRatio` (`boolean`)                                                                     | `void`                                                                                              | Updates crop ratio and lock state.                                                   |
| `cropDimensions`         | `config` (`Object`), `maximize` (`boolean = false`)                                                                                            | `Object`                                                                                            | Computes crop dimensions.                                                            |
| `openWindowInOverlay`    | `crop` (`Object`)                                                                                                                              | `string`                                                                                            | Generates CSS `clip-path`.                                                           |
| `applyCropToOverlay`     | `config` (`Object`)                                                                                                                            | `void`                                                                                              | Applies crop to the overlay.                                                         |
| `retrieveConfig`         | `element` (`HTMLElement`), `initialConfig` (`Object`)                                                                                          | `Promise<Object>`                                                                                   | Retrieves or creates config (from IndexedDB).                                        |
| `saveWidgetPosition`     | `widgetId` (`string`), `config` (`Object`)                                                                                                     | `Promise<void>`                                                                                     | Saves position/dimensions to IndexedDB.                                              |
| `getWidgetPosition`      | `widgetId` (`string`)                                                                                                                          | `Promise<Object \| null>`                                                                           | Reads position from IndexedDB (if not expired).                                      |
| `getWidgetsByGroup`      | `groupId` (`string`)                                                                                                                           | `Promise<Object[]>`                                                                                 | Reads all widgets in a group.                                                        |
| `deleteWidgetsByGroup`   | `groupId` (`string`)                                                                                                                           | `Promise<void>`                                                                                     | Deletes an entire group.                                                             |
| `deleteWidgetPosition`   | `widgetId` (`string`)                                                                                                                          | `Promise<void>`                                                                                     | Deletes a single widget position.                                                    |
| `getMoveable`            | `elementId` (`string`)                                                                                                                         | `Object \| undefined`                                                                               | Returns the associated Moveable instance.                                            |
| `setMoveable`            | `elementId` (`string`), `moveable` (`Object`)                                                                                                  | `void`                                                                                              | Registers a Moveable instance.                                                       |
| `removeMoveable`         | `elementId` (`string`)                                                                                                                         | `void`                                                                                              | Removes a Moveable instance.                                                         |
| `buildTransform`         | `transforms` (`Object { translateX: number, translateY: number, scaleX: number, scaleY: number, rotate: number }`)                             | `string`                                                                                            | Builds CSS `transform` string.                                                       |
| `getTransform`           | `element` (`HTMLElement`)                                                                                                                      | `Object { translateX: number, translateY: number, scaleX: number, scaleY: number, rotate: number }` | Extracts current transform values.                                                   |
| `parseTransform`         | `transformString` (`string`)                                                                                                                   | `Object { translateX: number, translateY: number, scaleX: number, scaleY: number, rotate: number }` | Parses a CSS `transform` string.                                                     |
| `setScale`               | `element` (`HTMLElement`), `x` (`number`), `y` (`number`)                                                                                      | `void`                                                                                              | Updates scale in the transform.                                                      |
| `setTranslate`           | `element` (`HTMLElement`), `x` (`number`), `y` (`number`)                                                                                      | `void`                                                                                              | Updates translate in the transform.                                                  |
| `toCenter`               | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions widget at container center.                                                |
| `toTopLeft`              | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions at top-left.                                                               |
| `toTop`                  | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions at top.                                                                    |
| `toLeft`                 | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions at left.                                                                   |
| `toRight`                | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions at right.                                                                  |
| `toBottom`               | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions at bottom.                                                                 |
| `toTopRight`             | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions at top-right.                                                              |
| `toBottomLeft`           | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions at bottom-left.                                                            |
| `toBottomRight`          | `element` (`HTMLElement`), `margin` (`number = 0`)                                                                                             | `Object { left: number, top: number }`                                                              | Positions at bottom-right.                                                           |

---

## Public Properties (getters/setters)

| Property                         | Type              | Description                                 |
|----------------------------------|-------------------|---------------------------------------------|
| `transform` (getter)             | `WidgetTransform` | Access to the transform helper instance.    |
| `isResizing` (getter/setter)     | `boolean`         | Indicates if a resize is in progress.       |
| `isDragging` (getter/setter)     | `boolean`         | Indicates if a drag is in progress.         |
| `windowResizing` (getter/setter) | `boolean`         | Indicates if window resize affects widgets. |
| `isScaling` (getter/setter)      | `boolean`         | Indicates if a scale is in progress.        |

---

## Utility Methods (delegated)

| Method            | Inputs (type)                             | Output (type) | Description                                                              |
|-------------------|-------------------------------------------|---------------|--------------------------------------------------------------------------|
| `cloneContext`    | `source` (`Object`), `attrs` (`string[]`) | `Object`      | Clones an object, ensuring listed boolean attributes default to `false`. |
| `hasCapabilities` | `source` (`Object`), `attrs` (`string[]`) | `boolean`     | Checks if at least one listed attribute is truthy.                       |

---

## Notes

- All async methods (`Promise`) interact with **IndexedDB** via `WidgetDBManager`.
- Moveable event handlers (`onDrag`, `onResize`, etc.) are tied directly to **Moveable** library callbacks.
- The singleton ensures a single instance application-wide: `new WidgetManager()` always returns the same reference.

---

© 2025 LGS1920 – All rights reserved.

```