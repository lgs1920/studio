Implementation requests for Codex:

### 1. External Timeline Control

> Implement external timeline control with support for two modes: **Dry Run** and **Action Mode**. In Action Mode, initiating the timeline control should automatically trigger the replay. Keep the internal control via sliders functional.
> Que proposes-tu ?

Audit 2026-09-18: **not implemented** in the Studio adapter. The generic
Timeline emits public events, but Dry Run and Action Mode are not connected to
Replay commands.
### 2. Additional Slot & Studio Video Settings

> * Add an expandable top drawer to serve as an additional slot.
> * Keep the additional drawer slot generic within the timeline.
> * Il doit s'ouvrir sous la zone neutre
> * For the Studio Replay interface, place the video settings inside this drawer.
> * Display them horizontally by default, but fall back to a vertical layout if horizontal space is constrained.
> * For Studio Replay, you may reuse the video widget content and optimize its layout for the available drawer space.
> * Do not replace the settings and replay buttons.
>
> * Beaucoup est fait mais totalement buggé

Audit 2026-09-18: **implemented in the current tree**, with browser validation
and bug fixing still required for the reported drawer issues.

### 3. Widget Undocking & Window Management

* Reposition the timeline header actions.
* Reposition the timeline menus.
* Add preset and aspect ratio management menus to the timeline drawer without copying the video widget.

Audit 2026-09-18: **implemented in the current tree** through the Timeline
header, custom-menu, and additional-content slots.

### 9. Replay user modes


> * Basic mode: click the drone and choose the camera orientation and height.
>   The camera uses a fixed height. This is the default mode, with a red
>   border, a white marker, and the standard line thickness.
> * Expert mode: provide access to the timeline and Replay UI so the user can
>   refine the result in detail.
>   Determine how the two levels should be introduced in the interface.
>   - Clicking the drone could open a Basic or Expert popover, with the choice
>     persisted. Decide whether the choice should open every time or whether
>     two separate base buttons are preferable.

Audit 2026-09-18: **not implemented**. No persisted Basic/Expert Replay mode
or dedicated Basic camera workflow was found.

### 10. Implement replay rimeline pour integrer les widgets

> - Double-click a clip to edit its widgets.
> - Support track insertion and modification.
> - Check whether other points are still missing and list the remaining work
>   for confirmation.
>   Add and remove clips reactively when their duration changes or clips are
>   inserted.

Audit 2026-09-18: **partial**. Local track and clip interactions are available,
but double-click navigation, domain persistence, and complete Draft/HQ
consumption remain open.
