Implementation requests for Codex:

### 1. External Timeline Control

> Implement external timeline control with support for two modes: **Dry Run** and **Action Mode**. In Action Mode, initiating the timeline control should automatically trigger the replay. Keep the internal control via sliders functional.
> Que proposes-tu ?

Audit 2026-09-18: **not implemented** in the Studio adapter. The generic
Timeline emits public events, but Dry Run and Action Mode are not connected to
Replay commands.
### 2. Additional Slot & Studio Video Settings


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

### 11. Journey Change Animation

When a drawer is open during a journey change, apply a progressive blur and then restore the normal state.
When the journey change and focus happen immediately within the change immediacy window, use a synchronized flash while hiding the old journey and showing the new one.
Otherwise, scale the blur duration with the journey change duration.

Create a feature issue for `1.0.0/backlog/LGS1920/chdenat`.
