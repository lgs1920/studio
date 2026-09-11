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

### 3. Widget Undocking & Window Management
<del>
> Implement a feature to open widgets in a new window:
> * If the window supports Picture-in-Picture (PiP), open the widget in PiP mode.
> * Otherwise, fall back to a frameless, resizable external window.
> * When the external window or PiP is closed, re-embed the widget back into its original scene position.
> * Include a menu option in the PiP mode to re-attach the widget directly to the main window.

Cela correspond aux issues #503 et #504

</del>

<del>
> * focus sur la tl dans le Pip
> * rajouter pip et lock dans header actions de la timline widget
> * corriger menu window Pip
> * regarder resize
>
</del>

* Reposition the timeline header actions.
* Reposition the timeline menus.
<del>* Fix the timeline drawer so it can close. It currently never closes.</del>
<del>* Fix the timeline drawer opening behavior. It currently does not open correctly.</del>
* Add preset and aspect ratio management menus to the timeline drawer without copying the video widget.
<del>* Remove the "Show window frame" option.</del>
<del>* Fix the missing detach, drawer, and Picture-in-Picture (PiP) menu options when the timeline widget is first displayed.</del>
<del>* Headers-actions icons need to be larger.</del>
<del>* Suppress the X to close the timline, as it closes the replay mode.</del>
<del>* Use wa-tooltip instead of tooltips</del>
### 4. Clip Double-Click Handling

<del>
> Make clip double-click behavior configurable. By default, double-clicking a clip does nothing, but allow registering a custom double-click callback (e.g., to trigger clip editing).
</del>

### 5. Pre-Replay and Post-Replay Clips Capabilities

> Allow **Pre-Replay** and **Post-Replay** clips to be selectable and stretchable. Disable selection and stretching interactions for the **Replay** clip itself.

### 6. Timeline Margin

> Refactor the timeline margin implementation. Review the current setup and simplify how additional margin space is added.

### 7. Drag & Snap Improvements

> Refine the timeline snapping behavior:
> * Keep the existing stretch snapping logic as-is.
> * Improve displacement/drag snapping logic.
> * Do **not** render visual snap lines when snapping to time ruler unit marks, even though the snapping action itself should still occur.

### 8. Rename the replay clip

<del>
> * The replay clip should have the name of the journey
</del>

### 9 Implement Replay management
> - le double click d'un clip pour editer les widgets
> - les insertions modifications de pistes,
> - verifie si d'autres points ne sont pas encore pris en compte: dans ce cas, tu listes ce qu'ilrestes à faire pour que je confirme.
