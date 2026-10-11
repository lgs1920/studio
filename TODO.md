Implementation requests for Codex:

### 1. Reactivite drawer Replay et UI d'angle dcamera

Dans le drawer replay, l'UI qui permet de modifier l'angle de camera et sa poistion (ahead/behind)
n'est pas reactive avec lUI dediée en préparation video.
QUand on agit sur les lsiders ou selection, c'est la camera cesium qui est impacté , il faut que cela soit l'UI
preparation video (rotation du cone et valorisation de l'angle)
Il faut aussi veiller à ce que la ractivit soit bi directionnelle entre les deuix UI.

### 10. Implement replay rimeline pour integrer les widgets

> - Double-click a clip to edit its widgets.
> - Support track insertion and modification.
> - Check whether other points are still missing and list the remaining work
>   for confirmation.
>   Add and remove clips reactively when their duration changes or clips are
>   inserted.

Audit 2026-09-18: **partial**. Local track and clip interactions are available,
but double-click navigation, domain persistence, and complete Draft/export
consumption remain open.

### 11. Journey Change Animation

When a drawer is open during a journey change, apply a progressive blur and then restore the normal state.
When the journey change and focus happen immediately within the change immediacy window, use a synchronized flash while hiding the old journey and showing the new one.
Otherwise, scale the blur duration with the journey change duration.
Create a feature issue for `1.0.0/backlog/LGS1920/chdenat`.



Bind the popup opened by the cog icon to the widget instead of the button.

During application initialization, show an overlay while journeys are loading. I think 3D loading already has a similar overlay; reuse its style and display “Loading journeys (w/y)”, with `y` set to the total journey count.

Do not start map rotation while journeys are loading. Start it after loading completes, unless it can be done without interfering with or slowing the display.
