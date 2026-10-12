Implementation requests for Codex:

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



Bind the popup opened by the cog icon to the widget instead of the button.

le focus de fin de replay ne se fait pas sur le controide => a verifier

Reverifier le zoom du replay pour voir si on va pas le prendre ailleurs dans certaines conditions (arret user,
erreur ...)

Pour les widgets :

- la timeline ne persiste pas les widgets ce qui fait que le rep)lay ne gere pas derriere les differents widgets et leur
  position, présence pour l'affichage
- il faut que les widgets montés lors de la timeline soit montés dès le début du replay même si hidden au début.
  si all other a=hidden journes ) true elles sont aussi masqué dans le selecteur. non le selecteur doit savoir si elles
  sont masqués par une action specificque dans le selecteur ou bien si c'est apr other journey hidden flag
