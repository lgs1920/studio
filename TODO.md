Implementation requests for Codex:

### 1. External Timeline Control

> Implement external timeline control with support for two modes: **Dry Run** and **Action Mode**. In Action Mode, initiating the timeline control should automatically trigger the replay. Keep the internal control via sliders functional.

### 2. Additional Slot & Studio Video Settings

> * Add an expandable top drawer to serve as an additional slot.
> * Keep the additional drawer slot generic within the timeline.
> * For the Studio Replay interface, place the video settings inside this drawer.
> * Display them horizontally by default, but fall back to a vertical layout if horizontal space is constrained.
> * For Studio Replay, you may reuse the video widget content and optimize its layout for the available drawer space.
> * Do not replace the settings and replay buttons.
>
> * Drawer a replacer dans le layout

### 3. Widget Undocking & Window Management

* Reposition the timeline header actions.
* Reposition the timeline menus.
* Add preset and aspect ratio management menus to the timeline drawer without copying the video widget.

### 5. Pre-Replay and Post-Replay Clips Capabilities

> Allow **Pre-Replay** and **Post-Replay** clips to be selectable and stretchable. Disable selection and stretching interactions for the **Replay** clip itself.

### 6. Timeline Margin

> Refactor the timeline margin implementation. Review the current setup and simplify how additional margin space is added.

### 7. Drag & Snap Improvements

> Refine the timeline snapping behavior:
> * Keep the existing stretch snapping logic as-is.
> * Improve displacement/drag snapping logic.
> * Do **not** render visual snap lines when snapping to time ruler unit marks, even though the snapping action itself should still occur.

### 9 Implement Replay management
> - le double click d'un clip pour editer les widgets
> - les insertions modifications de pistes,
> - verifie si d'autres points ne sont pas encore pris en compte: dans ce cas, tu listes ce qu'ilrestes à faire pour que je confirme.
