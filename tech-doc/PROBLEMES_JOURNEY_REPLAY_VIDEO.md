# Replay / Video / Widgets — Reanalyse et proposition de refonte

> Date : 2026-07-14
> Branche de travail : `fix-replay`
> Base de comparaison :
> - branche courante : `1.0.0-beta.3`
> - reference de simplicite video : `1.0.0-beta.2`

## 0. Etat actuel de la relecture

La premiere passe de correction a deja pose trois briques utiles :

- un resolver de visibilite replay/video centralise ;
- un final frame capture avant arret du recorder ;
- un socle de rendu frame-by-frame avec `ReplayFrameTimeline` et `ReplayVideoRenderSession`.
- une premiere couche `ReplayDeferredExporter` pour structurer un export master differe.
- un chemin `runReplayDeferredMp4Export` qui produit et telecharge deja un MP4 master.
- un warmup `warmReplayDeferredExportPlan` lance au demarrage du draft pour pre-resoudre le codec et la config.
- une empreinte de contexte legere (`contextKey`) pour invalider un plan des que le crop ou les overlays changent.

Donc la bonne lecture n'est plus "tout est a inventer", mais :

**la base est en place, il reste a trancher l'architecture cible et le chemin d'export.**

---

## 1. Objet

Le probleme visible est une desynchronisation entre :

- le replay de journey ;
- la video capturee ;
- les widgets video, en particulier les widgets de stats dynamiques / fin de replay.

La conclusion de cette reanalyse est la suivante :

**le probleme n'est pas un bug isole de widget.**

C'est un probleme d'architecture : **il n'existe pas une seule source de verite de frame** pour le replay, la video et les overlays.

---

## 2. Ce que montre la comparaison avec `1.0.0-beta.2`

### `beta.2` : pile video simple

Sur `1.0.0-beta.2`, la pile video etait encore relativement simple :

- `VideoRecordingScreenArea` preparait le crop, le `CanvasOverlayComposer` et le `ScreenMediaRecorder` ;
- `ScreenMediaRecorder` encodait sur sa propre horloge temps reel ;
- `Widget2Canvas` faisait deja le mirroring DOM -> canvas ;
- il n'y avait pas encore la couche `JourneyReplayPlaybackController` / `JourneyReplayMode` / `JourneyReplayVideoSync` ;
- il n'y avait pas encore le split fonctionnel entre widget dynamique de progression et widget de fin de replay ;
- il n'y avait pas encore le mode `captureMode: quality` avec `frameCaptureReady`.

En clair : **la video etait generique, sans orchestration replay specialisee**.

### `beta.3` : ajout d'une orchestration replay/video

Depuis `beta.2`, plusieurs couches ont ete ajoutees :

- `JourneyReplayPlaybackController`
- `JourneyReplayMode`
- `JourneyReplayVideoSync`
- `replayStatsWidgetUtils`
- `DynamicStatsWidget`
- `captureMode` `speed` / `quality`
- logique de visibilite replay dans `JourneyStats`

Le probleme n'est pas que ces ajouts sont mauvais en soi.

Le probleme est qu'ils ont introduit **plusieurs autorites temporelles et visuelles** sans les unifier.

---

## 3. Diagnostic actuel

Aujourd'hui, la capture synchronisee replay/video depend de cinq mecanismes differents :

| Bloc | Role | Source de verite |
|---|---|---|
| `JourneyReplayPlaybackController` | fait avancer le replay | horloge replay |
| `ScreenMediaRecorder` | decide quand une frame video est encodee | horloge recorder |
| `CanvasOverlayComposer` | compose scene + overlays | boucle propre de composition |
| `Widget2Canvas` | convertit le DOM widget en canvas | observer / rAF / snapshot asynchrone |
| `JourneyStats` + `replayStatsWidgetUtils` | decide si un widget doit etre visible | store replay React |

Ces cinq blocs ne travaillent pas sur une frame commune.

### Consequence 1 : visibilite logique != overlay compose

Le widget de stats est bien masque cote React dans `JourneyStats`, mais :

- `buildComposerOverlays` ne filtre pas les overlays sur une autorite explicite de visibilite ;
- il prend tout `.lgs-widget-canvas` disponible ;
- `Widget2Canvas` garde un canvas miroir qui peut encore contenir le dernier etat visible.

Resultat :

- a l'apparition, la video attend que le mirror canvas reflète le nouvel etat ;
- a la disparition, la video peut continuer a dessiner un canvas deja genere.

### Consequence 2 : le gating de visibilite est base sur un store quantifie

Le widget video decide sa visibilite avec `shouldShowVideoStatsWidget({mode, replay})`, donc sur les champs du store replay.

Or dans `JourneyReplayPlaybackController` :

- `liveSample` est mis a jour tres souvent ;
- mais `progress`, `durationMillis`, `sample` publies dans le store restent cadences par `STORE_SYNC_INTERVAL = 250 ms`.

Resultat :

- la carte, la camera et certains calculs live peuvent etre "a jour" ;
- la decision d'afficher ou cacher un widget peut, elle, etre en retard.

### Consequence 3 : le mode `quality` n'est pas un vrai rendu deterministe

Le mode `quality` est une amelioration utile, mais il ne regle pas le coeur du sujet.

Pourquoi :

- `ScreenMediaRecorder` continue a timestamp-er ses frames a partir de `performance.now()` ;
- `frameCaptureReady` force mieux la composition avant encodage ;
- mais le replay, le recorder et les widgets ne partagent toujours pas un timestamp de frame unique calcule en amont.

Donc `quality` reduit certains ecarts, **sans transformer la capture en export deterministic frame-by-frame**.

### Consequence 4 : la fin de replay reste fragile

La fin du replay cumule plusieurs choses :

- bascule widget dynamique -> widget de fin ;
- eventuelle execution de stop clips ;
- arret automatique du recorder ;
- restauration de scene.

Cette zone est structurellement fragile parce qu'elle repose encore sur une chaine d'evenements, pas sur un "dernier frame state" explicite.

---

## 4. Ce que je retiens de `beta.2`

Il ne faut pas "revenir a `beta.2`" au sens d'un rollback brut.

En revanche, il faut **revenir a son principe de separation** :

- la pile video doit rester generique ;
- la logique replay ne doit pas etre dissoute dans le recorder, dans le compositing et dans les widgets en meme temps.

Autrement dit :

**`beta.2` est la bonne base mentale pour la video.**
**`beta.3` contient les bons besoins fonctionnels replay, mais pas encore la bonne frontiere d'architecture.**

---

## 5. Recommandation de refonte

### Principe directeur

Mettre en place **une timeline de frame unique** pour tout ce qui concerne l'export replay/video.

Chaque frame doit produire un etat autoritatif unique :

- `frameIndex`
- `frameTimeMs`
- `progress`
- `sample replay`
- `etat camera`
- `liste des overlays visibles`
- `etat logique des widgets video`

Ensuite seulement on rend :

1. la scene ;
2. les widgets / overlays ;
3. la frame video.

### En pratique

Je propose d'introduire trois briques explicites.

#### A. `ReplayFrameTimeline`

Responsabilite :

- convertir une duree replay + fps en suite de frames deterministes ;
- fournir pour chaque frame un `progress` exact ;
- servir autant au live draft qu'a l'export differe.

Exemple conceptuel :

```js
{
  frameIndex: 137,
  frameTimeMs: 4566.67,
  progress: 0.7611,
  sample: {...},
}
```

#### B. `ReplayOverlayResolver`

Responsabilite :

- decider quels widgets existent sur une frame ;
- decider lesquels sont visibles ;
- fournir leur mode et leur ordre ;
- produire un contrat explicite pour le composer.

Important :

**la visibilite ne doit plus etre deduite du simple fait qu'un `.lgs-widget-canvas` existe.**

Le mirror canvas devient un moyen de rendu, pas l'autorite fonctionnelle.

#### C. `ReplayVideoRenderSession`

Responsabilite :

- prendre une frame timeline ;
- positionner le replay au `progress` exact ;
- rendre la scene ;
- rafraichir les overlays utiles ;
- composer ;
- pousser la frame au recorder ou a l'exporteur.

Cette session devient **le seul chef d'orchestre de rendu replay->video**.

---

## 6. Ce que cela change dans l'architecture

### Ce qui doit rester generique

- `ScreenMediaRecorder`
- `CanvasOverlayComposer`
- `Widget2Canvas`

Ces briques doivent rester reutilisables, sans regles metier replay specifiques.

### Ce qui doit devenir replay-specific

- la determination du `progress` a rendre ;
- la selection des widgets visibles ;
- la transition widget dynamique -> widget de fin ;
- le moment exact de fin de capture ;
- les etats de fin de replay avec ou sans stop clips.

Cette logique doit vivre dans une couche replay/export explicite, pas en diffusion dans plusieurs fichiers UI.

---

## 7. Proposition concrete de mise en oeuvre

### Phase 1 - Stabilisation courte

Objectif : corriger le symptome principal sans refonte totale.

Actions :

1. ajouter une autorite de visibilite d'overlay exploitable par `buildComposerOverlays` ;
2. faire filtrer les widgets video par cette autorite avant `composer.addOverlay(...)` ;
3. baser cette autorite sur le signal live du replay, pas uniquement sur `replay.progress` cadence a 250 ms ;
4. traiter la fin de replay comme un etat explicite plutot qu'un simple enchainement d'evenements.

Cette phase corrige le decalage le plus visible, mais **ne suffit pas** a rendre l'export vraiment robuste.

### Phase 2 - Extraction du contrat replay->video

Objectif : sortir la logique hors des widgets React.

Actions :

1. creer un resolver d'overlays replay/video ;
2. ne plus faire reposer la logique d'apparition/disparition uniquement sur `JourneyStats`;
3. conserver `JourneyStats` comme vue, pas comme source de verite export.

### Phase 3 - Rendu deterministe frame-by-frame

Objectif : une frame exportee = un `progress` replay unique.

Actions :

1. introduire un rendu par frame explicite ;
2. calculer `progress` a partir du `frameIndex` ;
3. seek du replay avant rendu scene ;
4. reconstruire les overlays pour cette frame ;
5. encoder seulement cette frame.

### Phase 4 - Export differe haute qualite

Objectif : produire une video finale beaucoup plus propre que la capture live.

Actions :

1. enregistrer ou reconstruire le contexte replay/video apres coup ;
2. relancer une session de rendu offline ;
3. sortir en haute resolution / haute qualite sans dependre du temps reel.

### Phase 5 - Separation explicite draft / master

Objectif : ne pas faire porter la meme contrainte a la capture live et a l'export final.

Actions :

1. garder le flow actuel comme `Live Draft` ;
2. prechauffer le `Deferred Master` des le lancement du draft ;
3. reutiliser la meme timeline et les memes regles de visibilite dans les deux cas ;
4. isoler les points ou la qualite d'image, la cadence et la resolution divergent ;
5. ne stocker qu'un contexte minimal, jamais des frames intermediaires.

---

## 8. Reponse au besoin "draft live + export differe HQ"

Le besoin mentionne est juste et il faut l'integrer des maintenant dans la conception.

Je recommande deux modes separes, mais reposant sur la meme timeline.

### Mode A - `Live Draft`

But :

- retour immediat ;
- video rapide ;
- qualite suffisante pour validation.

Caracteristiques :

- peut rester adosse au temps reel ;
- accepte plus de compromis ;
- doit quand meme utiliser la meme logique de visibilite d'overlays que le rendu final ;
- peut declencher un warmup du master export sans attendre la fin de l'enregistrement.

### Mode B - `Deferred Master Export`

But :

- video finale exportable ;
- tres haute qualite ;
- synchronisation parfaite scene / replay / widgets.

Caracteristiques :

- pas d'horloge temps reel comme autorite ;
- rendu frame-by-frame ;
- resolution et cadence plus elevees ;
- arrets, transitions et fin de replay parfaitement deterministes ;
- contexte d'export resolu a la demande, avec invalidation si le replay ou les widgets ont change.

La bonne direction est donc :

**capture live = draft**
**export differe = master**

Pas l'inverse.

### Implication pratique

Le flow actuel de video ne doit pas etre force a devenir l'export final. Il doit rester :

- rapide a lancer ;
- simple a depanner ;
- bon enough pour verifier le replay et les widgets.

L'export differe doit, lui, pouvoir :

- rejouer la timeline sans dependance au temps reel ;
- attendre les ressources lourdes si besoin ;
- encoder au plus propre, meme si cela prend plus longtemps.

---

## 9. Impacts sur les fichiers

### A conserver comme socle

- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`
- `src/core/ui/screen-media-recorder/recorder/ScreenMediaRecorder.js`
- `src/core/ui/widget-manager/widget-2-canvas/Widget2Canvas.js`

### A revoir structurellement

- `src/core/ui/replay/JourneyReplayVideoSync.js`
- `src/core/ui/replay/JourneyReplayPlaybackController.js`
- `src/components/Stats/JourneyStats.jsx`
- `src/components/Stats/replayStatsWidgetUtils.js`

### A ajouter idealement

- `src/core/ui/replay/ReplayFrameTimeline.js`
- `src/core/ui/replay/ReplayOverlayResolver.js`
- `src/core/ui/replay/ReplayVideoRenderSession.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`

---

## 10. Strategie de tests recommandee

Aujourd'hui, il existe des tests utiles sur :

- la visibilite logique des widgets ;
- `JourneyReplayVideoSync` ;
- `Widget2Canvas`.

Mais il manque le niveau de test decisif : **la frame exportee**.

Il faut ajouter :

1. des tests de mapping `frameIndex -> progress -> sample` ;
2. des tests de visibilite d'overlays sur bornes exactes ;
3. des tests de fin de replay avec et sans stop clips ;
4. des tests d'integration sur une frame composee avec scene + widgets ;
5. a terme, des tests d'export differe sur une sequence courte deterministe.

---

## 11. Decision recommandee

Ma recommandation n'est pas de bricoler l'existant autour de `JourneyStats` et du canvas miroir.

Ma recommandation est :

1. **reprendre la simplicite de la video `beta.2` comme socle** ;
2. **reconstruire l'integration replay/video sur une timeline de frame unique** ;
3. **preparer tout de suite la separation `Live Draft` / `Deferred Master Export`**.

La correction rapide reste possible.

Mais si l'objectif est de fiabiliser le replay video et d'ouvrir la voie a un export tres haute qualite en differe, **la refonte du contrat replay->video est la bonne trajectoire**.

## 12. Ce qu'il reste vraiment a faire

### Court terme

1. valider sur le terrain que le widget de stats de fin de replay disparait et reapparait sur la bonne frame ;
2. verifier que le dernier frame encode avant `stopVideo()` correspond bien a l'etat final du replay ;
3. garder `ReplayOverlayResolver` comme source de decision pour les overlays video ;
4. verifier qu'un plan d'export warm-up est bien reutilise seulement si le contexte n'a pas change.

### Moyen terme

1. brancher `ReplayVideoRenderSession` sur un vrai chemin de rendu exportable complet ;
2. factoriser un contrat de frame explicite pour la capture live et l'export differe ;
3. documenter le mode `Live Draft` versus `Deferred Master Export` dans le flux produit.

### Plus tard

1. mettre en place un export replay/video a posteriori complet, independant du temps reel ;
2. permettre un rendu haute qualite non contraint par le temps reel ;
3. conserver la compatibilite avec le flow video actuel pour la saisie rapide ;
4. eviter tout stockage persistant de frames intermediaires tant que le contexte suffit.

---

## 13. Decoupage recommande pour eviter le cout frame-by-frame complet

Le bon modele n'est pas de re-rendre tout le pipeline a chaque frame.
Le bon modele est un rendu par couches avec cache et revalidation selective.

### Couche 1 - Fond replay

Responsabilite :

- calculer la position de la camera ;
- dessiner la trajectoire, le fond Cesium et les marqueurs de replay ;
- suivre le `progress` de la frame.

Caractere :

- dynamique sur la timeline ;
- pas persistant comme image brute ;
- doit rester derive du `frameIndex` ou du `progress`.

Cache utile :

- presets camera ;
- geometries ou donnees de trace ;
- etats stables du replay qui ne changent pas sur la frame suivante.

### Couche 2 - Scene composee

Responsabilite :

- afficher le rendu de la scene de jeu / carte ;
- integrer les elements qui dependent du replay courant ;
- appliquer les transitions necessaires.

Caractere :

- plus couteuse que le fond ;
- peut etre recomposee seulement si le replay a change sur cette frame ;
- ne doit pas etre forcee a recalculer les elements stables.

Cache utile :

- dernier sample applique ;
- state hash du replay ;
- dernier rendu scene valide.

### Couche 3 - Widgets et overlays

Responsabilite :

- afficher les widgets vraiment visibles sur cette frame ;
- choisir ceux qui sont dynamiques, semi-dynamiques ou statiques ;
- eliminer ceux qui ne doivent pas sortir dans la video.

Caractere :

- certains widgets changent a chaque frame ;
- d'autres ne changent que sur un seuil de replay ;
- les widgets statiques doivent etre servis depuis un cache tant que leur contexte ne change pas.

Cache utile :

- canvas miroir deja rendu ;
- empreinte de visibilite ;
- empreinte de layout ou de crop ;
- signature de contenu du widget.

### Regle de revalidation

On ne recalcule une couche que si son entree de contexte change.

Exemples :

- changement de `progress` : on refait fond + scene + widgets dynamiques ;
- changement de crop : on invalide scene + overlays concernes ;
- changement de visibilite widget : on invalide seulement la couche overlays ;
- widget statique identique : on le garde tel quel.

### Ce que cela evite

On evite :

- de reconstruire tous les widgets a chaque frame ;
- de relancer un rendu complet DOM -> canvas quand rien n'a change ;
- de stocker une video ou des frames intermédiaires pour simuler le cache.

### Traduction en architecture

Le pipeline doit distinguer :

1. `frame state` - ce qui change par frame ;
2. `layer cache` - ce qui peut etre reutilise ;
3. `render invalidation` - ce qui force un redraw ;
4. `export plan` - ce qui prepare l'export sans consommer de frames.

Autrement dit :

**la frame de sortie est recalculée, mais pas tout le sous-systeme.**
