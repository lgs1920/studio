### WidgetDynamicRenderer

The `WidgetDynamicRenderer` class implements the Singleton pattern and serves as a core utility for managing the dynamic
lifecycle of widgets within the application. Its responsibilities include checking maximum instance limits, lazy loading
React components, and registering widget instances in the global UI store and cache.

#### Singleton Access

The class is designed to guarantee a single unique instance. It must be accessed via its static getter `instance`.

```javascript
// Import the class
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/WidgetDynamicRender'

// Retrieve the unique singleton instance (Recommended method)
const renderer = WidgetDynamicRenderer.instance
````

The class's constructor is also robust enough to return the existing unique instance even if the `new` operator is used,
thanks to the internal check against the private static field `#instance`.

#### Public Methods

| Method                                | Description                                                                                                                                                                                                                                           | Parameters                                                                                                                                                                  | Returns                                                               |
|:--------------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------|
| `WidgetDynamicRenderer.instance`      | Static getter to retrieve the unique singleton instance of the class.                                                                                                                                                                                 | None                                                                                                                                                                        | `WidgetDynamicRenderer`                                               |
| `theGroups(groups)`                   | Filters the provided group IDs to return only valid groups that exist in the global widget registry (`__.widgets`).                                                                                                                                   | `groups`: `Iterable<string>` - List of group IDs to check.                                                                                                                  | `Map<string, Object>` - Map of valid group IDs and their definitions. |
| `renderWidget(group, id, extraProps)` | Lazily loads the widget component, checks instance limits, and registers the component instance in both the cache (`__.ui.widgetCache`) and the active widget store (`$widget.list`).                                                                 | `group`: `string` - Group ID. `id`: `string` - Base ID or full instance ID of the widget. `extraProps`: `Object` (Optional) - Initial props to pass to the widget instance. | `Promise<void>`                                                       |
| `resolveAliasPath(aliasPath)`         | Converts a path string containing a Vite alias (e.g., `@Core/path`) into a server-relative path (e.g., `/src/core/path`) necessary for dynamic runtime imports. **Note:** The alias mapping must correspond to the configuration in `vite.config.ts`. | `aliasPath`: `string` - The path string possibly containing an alias.                                                                                                       | `string` - The resolved path string.                                  |

#### Dynamic Loading Mechanism

The `renderWidget` method uses React's `lazy` function combined with dynamic JavaScript imports for efficient code
splitting.

