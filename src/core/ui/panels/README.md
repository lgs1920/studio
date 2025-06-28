# PanelManager

The `PanelManager` is a JavaScript class implemented as a singleton to manage the state and interactions of drawers
within a web application. It is part of the LGS1920/studio project and is responsible for handling the opening, closing,
and tabbed content navigation of drawers, as well as tracking mouse interactions and dispatching custom events when
drawers are opened.

## Overview

The `PanelManager` provides a centralized way to manage drawers, ensuring a consistent state across the application. Its
key functionalities include:

- Tracking the currently open drawer and its associated action.
- Managing tabbed content within drawers.
- Handling mouse enter and leave events for drawer elements.
- Supporting the toggling, opening, and closing of drawers.
- Dispatching custom events to notify when a drawer is opened.
- Ensuring only one instance of the manager exists via the singleton pattern.

## Usage

Below is a table describing each method of the `PanelManager` class, including its purpose, parameters, and return
values.

| Method                | Description                                                                                                                                       | Parameters                                                                                                                                            | Return Value                                                     |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| `constructor()`       | Creates or returns the singleton instance of `PanelManager`. Initializes the `drawers` state from `lgs.mainProxy.drawers`.                        | None                                                                                                                                                  | `PanelManager` instance                                          |
| `get tab()`           | Retrieves the active tab for the currently open drawer.                                                                                           | None                                                                                                                                                  | `string` (tab name) or `undefined` if not set                    |
| `set tab(tab)`        | Sets the active tab for the currently open drawer.                                                                                                | `tab` (string): The name of the tab to set                                                                                                            | None                                                             |
| `isCurrent(id)`       | Checks if the specified drawer is currently open.                                                                                                 | `id` (string): The ID of the drawer to check                                                                                                          | `boolean`: `true` if the drawer is open, `false` otherwise       |
| `canOpen(id)`         | Determines if a drawer can be opened (i.e., it is not already open).                                                                              | `id` (string): The ID of the drawer to check                                                                                                          | `boolean`: `true` if the drawer can be opened, `false` otherwise |
| `toggle(id, options)` | Toggles the state of a drawer (opens if closed, closes if open).                                                                                  | `id` (string): The ID of the drawer to toggle<br>`options` (Object, optional): Options including `action` (string), `entity` (string), `tab` (string) | None                                                             |
| `open(id, options)`   | Opens a specified drawer and configures it with provided options.                                                                                 | `id` (string): The ID of the drawer to open<br>`options` (Object, optional): Options including `action` (string), `entity` (string), `tab` (string)   | None                                                             |
| `close()`             | Closes the currently open drawer and removes focus from its active elements.                                                                      | None                                                                                                                                                  | None                                                             |
| `check(event)`        | Checks if an event's target is a drawer element, preventing default behavior if not.                                                              | `event` (Event): The event to check                                                                                                                   | `boolean`: `true` if the target is a drawer, `false` otherwise   |
| `mouseLeave(event)`   | Handles mouse leave events, setting the `over` property to `false`.                                                                               | `event` (Event): The mouse leave event                                                                                                                | None                                                             |
| `mouseEnter(event)`   | Handles mouse enter events, setting the `over` property to `true`.                                                                                | `event` (Event): The mouse enter event                                                                                                                | None                                                             |
| `attachEvents()`      | Attaches mouse enter, leave, and open event listeners to all drawer elements and dispatches a `drawer-open` custom event when a drawer is opened. | None                                                                                                                                                  | None                                                             |
| `clean()`             | Resets the `action` state of the drawer manager.                                                                                                  | None                                                                                                                                                  | None                                                             |
| `openTab(tabName)`    | Opens a specific tab within all tab groups of the currently open drawer.                                                                          | `tabName` (string, optional): The name of the tab panel to open; uses stored tab if not provided                                                      | None                                                             |
| `tabActive(tabName)`  | Checks if a specific tab is active for the currently open drawer.                                                                                 | `tabName` (string): The name of the tab to check                                                                                                      | `boolean`: `true` if the tab is active, `false` otherwise        |