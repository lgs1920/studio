Implementation requests for Codex:

### 1. External Timeline Control

> Implement external timeline control with support for two modes: **Dry Run** and **Action Mode**. In Action Mode, initiating the timeline control should automatically trigger the replay. Keep the internal control via sliders functional.
> Que proposes-tu ?
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

### 3. Widget Undocking & Window Management

* Reposition the timeline header actions.
* Reposition the timeline menus.
* Add preset and aspect ratio management menus to the timeline drawer without copying the video widget.

### 6. Timeline Margin

> Refactor the timeline margin implementation. Review the current setup and simplify how additional margin space is added.

### 9 Implement Replay management
> - le double click d'un clip pour editer les widgets
> - les insertions modifications de pistes,
> - verifie si d'autres points ne sont pas encore pris en compte: dans ce cas, tu listes ce qu'ilrestes à faire pour que je confirme.
>   RAJOUT DES CLIPS/retraits reactif (durée change, insertion des clips)
