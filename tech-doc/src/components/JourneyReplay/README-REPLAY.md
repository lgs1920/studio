# README-REPLAY

Premiere analyse concrete pour un mode "JourneyReplay" sur une journey.

## Objectif

Le mode JourneyReplay doit rejouer une journey comme un parcours continu:

- un curseur visible sur la trace reelle, idealement un disque/cercle pose a plat sur le terrain;
- une progression temporelle controlee par une duree totale;
- une camera pilotee par le parcours reel ou par une courbe 3D de simulation;
- une synchronisation avec le profile widget, les overlays d'information et le recorder video.

Je recommande de garder le nom produit "JourneyReplay" et de traiter `JourneyReplayRunner` comme l'ancien noyau technique a refactorer progressivement.

## Etat actuel du code

Le projet a deja une base utilisable:

- `src/core/ui/JourneyReplayRunner.js` parcourt des points avec un timer, emet des evenements `tick/*`, deplace un marker de track et synchronise le profil.
- `src/Utils/cesium/JourneyReplayUtils.js` initialise les callbacks du mode actuel.
- `src/core/ui/Profiler.js` sait preparer les donnees ECharts et afficher un marker sur le profil via `dispatchAction({ type: 'showTip' })`.
- `src/components/Profile/ProfileChart.jsx` rend le profil ECharts, mais le tooltip interactif est actuellement commente.
- `src/components/MainUI/PanoramaWidget.jsx` est le meilleur modele pour la camera continue, la souris, le wheel, le clavier, la desactivation des inputs Cesium et le mini overlay temporaire.
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx` est le point d'integration pour synchroniser une animation avec le recorder: le vrai depart video correspond a `ScreenMediaRecorder.events.START`, pas au clic utilisateur.

Le mode actuel est trop lie au nombre de points et a `setInterval`. Pour un rendu video propre, il faut le remplacer par une horloge absolue en `requestAnimationFrame`.

## Decision d'architecture

Separer le mode en 5 blocs:

1. `JourneyReplayPathSampler`
   Prepare une ligne temporelle stable a partir de la journey.

2. `JourneyReplayPlaybackController`
   Gere play/pause/resume/stop, duree, direction, loop, progression 0..1.

3. `JourneyReplayCesiumRenderer`
   Dessine le disque terrain, la portion parcourue, la courbe camera et les handles d'edition.

4. `JourneyReplayCameraController`
   Pilote la camera selon le mode choisi: aucune camera, camera sur trace, camera sur courbe Bezier.

5. `JourneyReplayVideoSync`
   Synchronise le playback avec `ScreenMediaRecorder`.

6. `JourneyReplayBezierEditor3D`
   Editeur Three.js du rectangle 3D relief + trace + courbe Bezier.

Ces blocs peuvent vivre sous `src/core/ui/replay/`, sauf l'editeur Three.js qui doit rester cote React dans `src/components/JourneyReplay/`. `src/Utils/cesium/JourneyReplayUtils.js` peut devenir une facade de compatibilite.

## Modele de donnees

Construire un tableau normalise:

```js
{
  progress,            // 0..1
  trackSlug,
  trackIndex,
  pointIndex,
  longitude,
  latitude,
  altitude,            // metres, depuis la track ou le terrain
  distanceFromStart,   // metres
  remainingDistance,   // metres
  segmentDistance      // metres
}
```

Points importants:

- inclure le vrai point de depart avec `distanceFromStart = 0`; les `track.metrics.points` actuels commencent apres le premier segment;
- garder les limites de tracks pour les journeys multi-tracks;
- calculer une distance cumulee globale;
- a chaque frame, convertir `elapsed / duration` en distance cible, puis interpoler entre deux points par recherche binaire;
- utiliser les points visibles par defaut, avec option drawer "journey complete" ou "track courante".

## Playback

Le controller ne doit plus avancer point par point.

Formule:

```js
elapsed = now - startedAt - pausedDuration
progress = clamp(elapsed / duration, 0, 1)
sample = sampler.atProgress(progress)
```

Avantages:

- duree exacte, independante de la densite GPS;
- reprise apres pause sans derive;
- synchronisation video possible;
- animation plus fluide a 30/45/60 fps.

Evenements utiles:

- `replay/start`
- `replay/pause`
- `replay/resume`
- `replay/update`
- `replay/hover`
- `replay/stop`
- `replay/end`

## Rendu Cesium

Creer un `CustomDataSource` dedie, par exemple `replay#<journeySlug>`.

Entites:

- `cursor`: ellipse clamp-to-ground pour le cercle pose a plat;
- `completedLine`: polyline de la portion parcourue, couleur plus forte que la trace;
- `cameraCurve`: polyline 3D optionnelle pour la courbe camera;
- `cameraPoint`: position courante de camera sur la courbe;
- `bezierHandles`: points editables pour les ancres et tangentes.

Le disque terrain doit rester lisible mais pas masquer la trace: petit rayon configurable, couleur issue de `settings.yaml` ou du track color, bord blanc.

## Camera

Modes proposes:

- `marker-only`: la map ne bouge pas, seul le curseur avance.
- `track-follow`: la camera suit la trace reelle.
- `bezier-camera`: la camera suit une courbe 3D et pointe vers le point reel de la trace.

Parametres:

- duree totale;
- hauteur camera;
- hauteur absolue ou hauteur relative a l'altitude du point;
- pitch/angle souris;
- heading/yaw souris;
- distance/range optionnelle si on veut une camera orbitale autour du point.

Implementation camera:

- reprendre le pattern de `PanoramaWidget`: `optimizeContinuousCameraRender`, disable `screenSpaceCameraController`, rAF, restore a la sortie;
- ne pas appeler `flyTo` a chaque frame;
- utiliser `camera.setView` avec une orientation calculee depuis `cameraPosition -> targetPoint`;
- wheel = hauteur, drag horizontal = yaw/heading, drag vertical = pitch.

Pour `bezier-camera`, la position camera vient de la courbe; le target reste le sample reel de la track.

## Courbe Bezier 3D

La courbe doit etre exprimee en progression normalisee, pas en index de points GPS.

Modele:

```js
{
  mode: 'bezier-camera',
  altitudeMode: 'relative', // ou 'absolute'
  heightOffset: 300,
  controlPoints: [
    { progress: 0, position: {...}, in: null, out: {...} },
    { progress: 0.35, position: {...}, in: {...}, out: {...} },
    { progress: 1, position: {...}, in: {...}, out: null }
  ]
}
```

Par defaut, generer une courbe simple au-dessus de la trace:

- point 0 au debut;
- point 1 au milieu;
- point 2 a la fin;
- altitude relative constante;
- tangentes derivees de la direction de la trace.

Decision editeur:

L'editeur 3D doit utiliser Three.js. Cesium reste responsable de la carte principale, du curseur terrain, de la trace reelle et de l'execution camera. Three.js sert a construire un espace d'edition local, plus lisible et plus manipulable qu'une edition directe dans la scene Cesium.

Architecture Three.js recommandee:

- un composant `JourneyReplayBezierEditor3D.jsx` monte au-dessus de la map, dans un drawer large ou un widget outil;
- une scene Three.js imperative attachee a un `canvas` React via `useRef`;
- un repere local en metres, centre sur le barycentre ou le premier point de la journey;
- conversion WGS84 -> local ENU pour la trace, le relief et la courbe;
- conversion local ENU -> WGS84 au moment de sauvegarder les points de controle;
- `OrbitControls` pour tourner/zoomer/panner le rectangle;
- `TransformControls` ou handles maison pour deplacer les points Bezier;
- mesh relief simplifie: grille triangulee depuis les samples de track et quelques bandes laterales;
- trace reelle en `Line2` ou tube fin;
- courbe Bezier en ligne epaisse + points de controle + tangentes.

Dependance:

- ajouter `three` au projet;
- eviter `@react-three/fiber` en V1 pour limiter le nombre de couches: l'editeur peut etre un composant React qui gere Three.js directement;
- ajouter `three/examples/jsm/controls/OrbitControls.js` et `TransformControls.js` depuis le package `three`.

Workflow:

1. Le sampler produit une trace normalisee.
2. L'editeur Three.js recoit cette trace et la convertit en scene locale.
3. L'utilisateur ajuste la courbe.
4. Le modele Bezier sauvegarde les points en coordonnees metriques locales plus l'origine geodesique, ou en WGS84 si on veut une serialisation plus autonome.
5. Le runtime JourneyReplay convertit la courbe en positions camera WGS84/Cesium et pointe toujours vers la track reelle.

## Profile widget

Quand le profile widget est affiche:

- afficher la progression parcourue en remplissant la zone sous la courbe jusqu'au sample courant;
- garder la courbe totale en arriere-plan;
- afficher le marker courant sur le profil;
- sur hover profil, emettre `replay/hover` avec le sample correspondant;
- sur hover/click map, retrouver le sample le plus proche et emettre le meme event.

Implementation ECharts:

- ajouter une serie "completed" par track, avec `areaStyle` plus opaque;
- couper la serie au point courant, et ajouter le point interpole;
- ne pas recalculer tout le chart a chaque frame si possible: mettre a jour uniquement les datasets progressifs;
- reactiver ou remplacer le tooltip commente dans `ProfileChart.jsx`.

## Overlay metrique

Creer un composant `JourneyReplayMetricOverlay`.

Contenu:

- arrow-left: distance depuis le depart;
- mountains: altitude;
- arrow-right: distance jusqu'a l'arrivee.

Contraintes:

- duree de vie identique au mini overlay panorama, donc environ 2s;
- reactif au changement d'unites via `useSnapshot(lgs.settings.unitSystem)`;
- utiliser `UnitUtils.formatMetric` avec `DISTANCE_UNITS` et `ELEVATION_UNITS`;
- icons via `FA2SL` comme dans `Profiler.js`;
- affichage sur la map et sur le profil avec le meme composant, seule l'ancre change.

## Drawer de configuration

Ajouter un drawer `REPLAY_DRAWER`.

Champs V1:

- Journey/track scope: journey visible, track courante, toutes tracks.
- Duration: presets + input libre.
- Direction: forward/reverse.
- Loop.
- Marker radius/couleur.
- Camera mode: none, track-follow, bezier-camera.
- Altitude mode: absolute/relative.
- Camera height.
- Pitch/heading initiaux.
- Boutons: play, pause, stop, record replay.

Champs V2:

- edition des points Bezier;
- reset courbe;
- smooth/tension;
- previsualisation relief;
- sauvegarde du preset dans `journey.replay`.

## Integration UI

Points d'entree:

- bouton dans `JourneyToolbar.jsx`, car le mode est lie a une journey;
- rendu permanent dans `MainUI.jsx`, comme `PanoramaWidget`;
- drawer dans `src/components/JourneyReplay/JourneyReplayDrawer.jsx`;
- overlay dans `src/components/JourneyReplay/JourneyReplayMetricOverlay.jsx`.

Store:

Ajouter dans `src/core/stores/ui.js` sous `mainUI`:

```js
replay: {
  active: false,
  playing: false,
  paused: false,
  recordingSync: false,
  journeySlug: null,
  trackSlug: null,
  progress: 0,
  sample: null,
  hoverSample: null,
  duration: 60,
  loop: false,
  direction: 1,
  camera: {
    mode: 'marker-only',
    altitudeMode: 'relative',
    heightOffset: 300,
    absoluteHeight: 1200,
    pitch: -35,
    headingOffset: 0
  },
  overlay: {
    visible: false,
    anchor: null,
    sample: null
  }
}
```

## Synchronisation video

Il faut demarrer JourneyReplay sur l'evenement recorder `START`, pas sur le clic "record".

Sequence:

1. L'utilisateur choisit "Record replay" dans le drawer.
2. On ouvre/reutilise le flow video existant.
3. Quand `ScreenMediaRecorder.events.START` arrive, `JourneyReplayPlaybackController.start({ clock: 'recorder' })`.
4. `PAUSE` -> pause JourneyReplay.
5. `RESUME` -> resume JourneyReplay.
6. `STOP`, `CANCEL`, `MAX_DURATION`, `MAX_SIZE` -> stop JourneyReplay.
7. Si JourneyReplay atteint la fin et `autoStopRecording` est actif, appeler `__.recorder.stopVideo()`.

Cela evite une video ou les premieres secondes sont consommees par la preparation/crop/encoder.

## Fichiers probables

Creation:

- `src/core/ui/replay/JourneyReplayPathSampler.js`
- `src/core/ui/replay/JourneyReplayPlaybackController.js`
- `src/core/ui/replay/JourneyReplayCesiumRenderer.js`
- `src/core/ui/replay/JourneyReplayCameraController.js`
- `src/core/ui/replay/JourneyReplayVideoSync.js`
- `src/core/ui/replay/JourneyReplayBezierModel.js`
- `src/components/JourneyReplay/JourneyReplayDrawer.jsx`
- `src/components/JourneyReplay/JourneyReplayMetricOverlay.jsx`
- `src/components/JourneyReplay/JourneyReplayControlsWidget.jsx`
- `src/components/JourneyReplay/JourneyReplayBezierEditor3D.jsx`
- `src/components/JourneyReplay/three/createJourneyReplayEditorScene.js`
- `src/components/JourneyReplay/three/replayEditorCoordinates.js`
- `src/components/JourneyReplay/style.css`

Modification:

- `src/core/LGS1920Context.js`: instancier le nouveau controller.
- `src/core/stores/ui.js`: ajouter l'etat `mainUI.replay`.
- `src/core/constants.js`: ajouter `REPLAY_DRAWER`.
- `src/components/MainUI/MainUI.jsx`: monter drawer/widget/overlay.
- `src/components/TracksEditor/JourneyToolbar.jsx`: bouton JourneyReplay.
- `src/components/Profile/ProfileChart.jsx`: serie progress + events hover.
- `src/core/ui/Profiler.js`: helper de mapping profil <-> sample.
- `src/Utils/cesium/JourneyReplayUtils.js`: facade vers le nouveau systeme.
- `src/core/ui/JourneyReplayRunner.js`: soit refactor interne, soit remplacement progressif.
- `package.json`: ajouter `three`.

## Phasage recommande et specs detaillees

Chaque phase doit etre validable seule. Le but est d'eviter un gros chantier ou la camera, le profile, la video et Three.js se bloquent mutuellement.

### Phase 1 - Playback robuste

Objectif:

- remplacer le fonctionnement actuel "un tick = un point" par un playback base sur une duree exacte et une distance cumulee;
- afficher un curseur terrain et une portion parcourue sur Cesium;
- fournir les fondations stables aux phases profile, camera, video et Bezier.

Perimetre inclus:

- creation de `JourneyReplayPathSampler`;
- creation de `JourneyReplayPlaybackController`;
- creation de `JourneyReplayCesiumRenderer`;
- drawer minimal ou controle minimal pour lancer/pauser/arreter;
- conservation d'une facade `JourneyReplayUtils.initJourneyReplayMode()` pour ne pas casser les appels existants;
- tests unitaires du sampler et du controller.

Hors perimetre:

- pas de camera automatique;
- pas de profile progressif;
- pas d'overlay metrique;
- pas de synchronisation video;
- pas de Bezier;
- pas de Three.js.

Contrat `JourneyReplayPathSampler`:

```js
const sampler = new JourneyReplayPathSampler({
  journey,
  scope: 'visible-tracks', // 'current-track' | 'all-tracks'
  includeHiddenTracks: false
})

sampler.totalDistance
sampler.samples
sampler.atProgress(progress)
sampler.atDistance(distance)
sampler.nearestToLonLat({ longitude, latitude })
```

Le sampler doit retourner des samples normalises:

```js
{
  progress,
  distanceFromStart,
  remainingDistance,
  trackSlug,
  trackIndex,
  pointIndex,
  segmentIndex,
  segmentRatio,
  longitude,
  latitude,
  altitude,
  source: {
    startPoint,
    endPoint
  }
}
```

Regles sampler:

- inclure le vrai premier point de chaque track, meme si `track.metrics.points` commence au second point;
- utiliser `track.content.geometry.coordinates` pour reconstruire les points bruts, puis enrichir avec les distances calculees;
- conserver l'ordre des tracks de `journey.tracks`;
- ignorer les tracks sans au moins deux points valides;
- interpoler longitude, latitude et altitude entre deux points;
- garantir que `atProgress(0)` est le premier point et `atProgress(1)` le dernier point;
- recherche binaire sur la distance cumulee, pas scan lineaire a chaque frame.

Contrat `JourneyReplayPlaybackController`:

```js
controller.configure({
  sampler,
  duration: 60,
  direction: 1,
  loop: false
})

controller.start()
controller.pause()
controller.resume()
controller.stop()
controller.seek(progress)
```

Regles playback:

- utiliser `requestAnimationFrame`;
- calculer `progress = elapsed / duration`, pas `currentIndex++`;
- supporter pause/resume sans derive de temps;
- supporter reverse via `direction = -1`;
- emettre un dernier update a `progress = 1` avant `end`;
- appeler `scene.requestRender()` sur les frames utiles;
- ne pas modifier `lgs.theTrack` a chaque frame sauf si necessaire pour compatibilite.

Evenements Phase 1:

- `replay/start`: mode lance;
- `replay/update`: sample courant;
- `replay/pause`: sample courant;
- `replay/resume`: sample courant;
- `replay/stop`: arret utilisateur;
- `replay/end`: fin naturelle.

Rendu Cesium Phase 1:

- `CustomDataSource` dedie: `replay#<journeySlug>`;
- `cursor`: ellipse clamp-to-ground, rayon configurable;
- `completedLine`: polyline des positions deja parcourues;
- nettoyage complet a `stop`;
- style par defaut: couleur track courante, contour blanc, opacite moderee.

Etat minimal:

```js
mainUI.replay = {
  active: false,
  playing: false,
  paused: false,
  progress: 0,
  sample: null,
  duration: 60,
  direction: 1,
  loop: false,
  scope: 'visible-tracks'
}
```

Fichiers principaux:

- `src/core/ui/replay/JourneyReplayPathSampler.js`;
- `src/core/ui/replay/JourneyReplayPlaybackController.js`;
- `src/core/ui/replay/JourneyReplayCesiumRenderer.js`;
- `src/components/JourneyReplay/JourneyReplayControlsWidget.jsx`;
- `src/components/JourneyReplay/JourneyReplayDrawer.jsx` en version minimale;
- `src/core/stores/ui.js`;
- `src/core/LGS1920Context.js`;
- `src/Utils/cesium/JourneyReplayUtils.js`.

Criteres de validation:

- une journey simple se rejoue en exactement la duree demandee;
- le curseur commence au vrai depart et termine au vrai arrivee;
- la portion parcourue suit le curseur;
- pause/resume conserve la position;
- stop nettoie les entites JourneyReplay;
- reverse parcourt la trace en sens inverse;
- aucun controle camera Cesium ne reste bloque apres stop.

Tests:

- unit: `atProgress(0)`, `atProgress(0.5)`, `atProgress(1)`;
- unit: interpolation altitude et distance restante;
- unit: multi-tracks et reverse;
- unit: pause/resume sans derive;
- manuel: importer une GPX, lancer 15s, verifier depart/arrivee;
- manuel: supprimer une journey pendant JourneyReplay stoppe proprement.

Validation attendue:

- valider le comportement du curseur;
- valider les defaults drawer: duree, scope, direction, loop;
- valider le nom utilisateur final du mode si "JourneyReplay" ne convient pas.

Statut implementation 2026-05-04:

- implemente dans la branche `feature/replay-mode`;
- sampler distance/progress ajoute dans `src/core/ui/replay/JourneyReplayPathSampler.js`;
- controller `requestAnimationFrame` ajoute dans `src/core/ui/replay/JourneyReplayPlaybackController.js`;
- renderer Cesium ajoute dans `src/core/ui/replay/JourneyReplayCesiumRenderer.js`;
- orchestration ajoutee dans `src/core/ui/replay/JourneyReplayMode.js`;
- drawer minimal ajoute dans `src/components/JourneyReplay/JourneyReplayDrawer.jsx`;
- widget de controle ajoute dans `src/components/JourneyReplay/JourneyReplayControlsWidget.jsx`;
- facade existante `JourneyReplayUtils.initJourneyReplayMode()` branchee sur le nouveau runtime;
- tests unitaires ajoutes dans `src/__tests__/replay-phase1.test.js`;
- validation locale: `bunx --bun vitest run src/__tests__/replay-phase1.test.js` OK, `bun run build` OK.

### Phase 2 - Profile + overlay

Objectif:

- synchroniser le playback JourneyReplay avec le profile widget;
- afficher les metriques contextuelles sur map et profile;
- rendre les interactions map/profile bidirectionnelles.

Perimetre inclus:

- remplissage de la zone parcourue dans `ProfileChart`;
- marker profile courant;
- hover profile -> cursor/overlay map;
- hover map/track -> marker/overlay profile;
- overlay metrique temporaire reactif aux unites;
- throttling des updates ECharts.

Hors perimetre:

- pas de camera automatique;
- pas de video sync;
- pas d'edition Bezier;
- pas de Three.js.

Contrat profile:

- `Profiler.prepareData()` doit exposer assez de metadata pour mapper un point chart vers un sample JourneyReplay;
- `ProfileChart` doit accepter un etat de progression optionnel;
- les datasets existants doivent rester compatibles avec les widgets video et scene.

Serie ECharts recommandee:

- conserver la serie totale existante;
- ajouter une serie `replay-completed:<trackSlug>`;
- construire cette serie avec les points jusqu'au sample courant et le point interpole final;
- `areaStyle` plus opaque que le profil total;
- `showSymbol: false`, sauf marker courant gere par action ECharts ou petite serie ponctuelle.

Overlay metrique:

```js
{
  visible: true,
  source: 'map' | 'profile' | 'playback',
  anchor: { x, y } | { longitude, latitude, altitude },
  sample,
  expiresAt
}
```

Contenu overlay:

- `arrow-left`: distance depuis le depart;
- `mountains`: altitude;
- `arrow-right`: distance jusqu'a l'arrivee.

Regles overlay:

- duree de vie: meme logique que `PanoramaWidget`, environ 2s;
- si les unites changent pendant l'affichage, les valeurs changent sans recreer l'overlay;
- utiliser `UnitUtils.formatMetric`;
- utiliser `FA2SL` pour les icons Font Awesome;
- jamais bloquer les interactions map sauf si l'utilisateur pointe l'overlay lui-meme.

Interactions:

- hover profile: trouver `seriesIndex/dataIndex`, convertir en sample JourneyReplay, afficher sur map;
- hover map: utiliser `sampler.nearestToLonLat`, afficher sur profile;
- pendant playback actif, le hover ne doit pas casser la progression courante;
- si l'utilisateur sort du profile ou de la map, l'overlay expire naturellement.

Fichiers principaux:

- `src/components/Profile/ProfileChart.jsx`;
- `src/core/ui/Profiler.js`;
- `src/components/JourneyReplay/JourneyReplayMetricOverlay.jsx`;
- `src/components/JourneyReplay/style.css`;
- `src/core/ui/replay/JourneyReplayPathSampler.js`;
- `src/core/stores/ui.js`.

Criteres de validation:

- si le profile widget est visible, la zone parcourue avance avec le curseur;
- si le profile widget est absent, le playback reste fluide;
- hover profile deplace le marker map;
- hover map deplace le marker profile;
- overlay affiche les trois valeurs demandees;
- changement international/imperial met a jour les valeurs et les unites;
- pas de lag visible sur une track dense.

Tests:

- unit: mapping sample -> dataset profile;
- unit: format distance/altitude/remaining;
- integration: changement d'unites pendant overlay;
- manuel: profile widget scene + drawer ouvert;
- manuel: track multi-segments et multi-tracks.

Validation attendue:

- valider le design visuel du remplissage profile;
- valider la duree de vie de l'overlay;
- valider si hover map doit s'activer sur toute la trace ou seulement sur le curseur/track visible.

### Phase 3 - Camera track-follow

Objectif:

- permettre une camera qui suit la track reelle avec une hauteur configurable;
- garder une interaction souris simple pour ajuster angle et hauteur;
- reutiliser les patterns robustes du panorama.

Perimetre inclus:

- mode camera `track-follow`;
- hauteur absolue ou relative a l'altitude du sample;
- pitch et heading/yaw ajustables;
- wheel pour hauteur;
- drag horizontal pour heading offset;
- drag vertical pour pitch;
- desactivation/restauration des inputs Cesium pendant camera follow;
- mini overlay camera optionnel ou reutilisation de l'overlay metrique.

Hors perimetre:

- pas de courbe Bezier;
- pas de Three.js;
- pas de synchronisation video avancee hors compatibilite naturelle.

Modes camera Phase 3:

- `marker-only`: aucune action camera, deja disponible depuis Phase 1;
- `track-follow`: camera positionnee au-dessus ou autour du sample courant et orientee vers la track.

Parametres drawer:

```js
camera: {
  mode: 'track-follow',
  altitudeMode: 'relative', // 'absolute'
  heightOffset: 300,
  absoluteHeight: 1200,
  pitch: -35,
  headingOffset: 0,
  range: 0
}
```

Regles camera:

- ne pas appeler `flyTo` a chaque frame;
- utiliser `camera.setView` ou une methode equivalente par frame;
- target = sample courant sur la trace reelle;
- altitude camera = `sample.altitude + heightOffset` en relatif, ou `absoluteHeight`;
- si `range = 0`, camera verticale/oblique depuis la position lon/lat du sample;
- si `range > 0`, calculer une position reculee selon heading de la trace + headingOffset;
- orientation calculee pour regarder le sample;
- forcer `scene.requestRender()`;
- utiliser `__.ui.cameraManager.optimizeContinuousCameraRender()` au start;
- restaurer via `restoreContinuousCameraRender()` au stop;
- sauvegarder l'etat camera seulement a la sortie, pas a chaque frame.

Interaction souris:

- wheel: ajuste hauteur;
- pointer drag vertical: ajuste pitch;
- pointer drag horizontal: ajuste headingOffset;
- bouton fermer/stop restore les controles;
- escape stoppe ou sort du mode follow selon pattern UI retenu.

Conflits a gerer:

- si panorama actif, le stopper avant `track-follow`;
- si rotation active, la stopper avant `track-follow`;
- si morph 2D, soit interdire camera follow, soit forcer 3D avec confirmation. Recommandation V1: camera follow disponible seulement en 3D.

Fichiers principaux:

- `src/core/ui/replay/JourneyReplayCameraController.js`;
- `src/components/JourneyReplay/JourneyReplayControlsWidget.jsx`;
- `src/components/JourneyReplay/JourneyReplayDrawer.jsx`;
- `src/components/MainUI/PanoramaWidget.jsx` comme reference de pattern, sans couplage direct;
- `src/core/ui/CameraManager.js` si helper commun necessaire.

Criteres de validation:

- la camera suit le curseur sans saccade importante;
- la hauteur relative reste constante par rapport a l'altitude sample;
- la hauteur absolue reste constante en metres monde;
- drag/wheel modifient les valeurs en direct;
- stop restore la navigation Cesium;
- suppression journey ou changement scene stoppe proprement le mode;
- profile et overlay continuent de marcher pendant camera follow.

Tests:

- unit: calcul altitude camera;
- unit: calcul orientation camera -> target;
- manuel: terrain avec fort relief;
- manuel: pause/resume pendant camera follow;
- manuel: switch 3D/2D pendant active, comportement attendu;
- manuel: verifier qu'une rotation/panorama active ne reste pas bloque.

Validation attendue:

- valider le comportement `range = 0` ou `range > 0` par defaut;
- valider les gestes souris;
- valider si le mode doit forcer la scene 3D.

### Phase 4 - Video sync

Objectif:

- enregistrer un JourneyReplay complet avec le recorder actuel;
- garantir que le playback commence au vrai debut d'encodage;
- garder pause/resume/stop synchronises.

Perimetre inclus:

- creation `JourneyReplayVideoSync`;
- toggle `Sync with Video` dans le drawer;
- bouton brand a droite pour ouvrir le flow video existant;
- depart sur `ScreenMediaRecorder.events.START`;
- pause/resume sur events recorder;
- stop/cancel/max sur events recorder;
- masque temporairement la toolbar JourneyReplay pendant la capture video;
- option `autoStopRecording`;
- metadata video minimale indiquant que l'enregistrement vient de JourneyReplay.

Hors perimetre:

- pas d'editeur Bezier;
- pas de reglages video nouveaux hors reutilisation du flow actuel;
- pas de montage ou export specialise JourneyReplay.

Sequence cible:

1. L'utilisateur active `Sync with Video` dans le drawer.
2. Le mode se met en attente `recordingSync = true`.
3. Le bouton brand ouvre le flow video existant si necessaire.
4. L'utilisateur choisit crop/widgets/preset.
5. Au clic Start Recording, le recorder prepare le canvas.
6. A `ScreenMediaRecorder.events.START`, JourneyReplay lance `start({ progress: 0 })`.
7. A `PAUSE`, JourneyReplay pause.
8. A `RESUME`, JourneyReplay resume.
9. A `STOP`/`CANCEL`/limite, JourneyReplay s'arrete et le bridge se desarme si besoin.
10. A `replay/end`, si `autoStopRecording`, appeler `__.recorder.stopVideo()`.

Contrat `JourneyReplayVideoSync`:

```js
videoSync.arm({
  autoStopRecording: true,
  resetToStart: true
})

videoSync.disarm()
videoSync.isArmed()
```

Regles:

- ne jamais lancer JourneyReplay au clic utilisateur, seulement au START recorder;
- si recorder echoue, JourneyReplay revient a l'etat pret sans playback;
- si l'utilisateur annule le crop, le mode sync peut rester arme mais aucun playback ne demarre;
- si l'utilisateur lance un enregistrement normal, JourneyReplay ne doit pas se lancer;
- si le recording s'arrete manuellement, le JourneyReplay actif doit aussi s'arreter;
- pendant `preRecording`, la camera peut etre placee au depart mais le progress reste 0.

Integration widgets:

- les widgets scene/video doivent etre montes avant START comme aujourd'hui;
- le profile widget progressif doit pouvoir etre capture dans la video;
- l'overlay metrique ne doit pas etre force dans la video sauf si visible dans la zone capturee;
- le drawer de configuration ne doit pas etre capture sauf si l'utilisateur le place dans le crop volontairement.

Fichiers principaux:

- `src/core/ui/replay/JourneyReplayVideoSync.js`;
- `src/components/JourneyReplay/JourneyReplayDrawer.jsx`;
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx` pour points d'accroche si necessaire;
- `src/components/MainUI/video/toolbox/VideoRecordingSettingsToolbar.jsx` si ajout d'un shortcut de flow;
- `src/core/ui/screen-media-recorder/recorder/ScreenMediaRecorder.js` normalement sans modification.

Criteres de validation:

- le premier frame video correspond au debut du parcours;
- pause recorder pause le curseur et la camera;
- resume recorder reprend sans saut;
- stop recorder nettoie JourneyReplay;
- fin JourneyReplay stoppe la video si option active;
- enregistrement normal sans JourneyReplay reste inchange;
- snapshot video n'active pas JourneyReplay.

Tests:

- integration: simuler START/PAUSE/RESUME/STOP et verifier etats;
- manuel: enregistrer 15s avec marker-only;
- manuel: enregistrer 15s avec camera follow;
- manuel: verifier profile progressif capture;
- manuel: cancel pendant preRecording;
- manuel: limite maxDuration plus courte que JourneyReplay.

Validation attendue:

- valider le comportement par defaut de `autoStopRecording`;
- valider si `Record replay` doit ouvrir automatiquement le crop video;
- valider les overlays visibles ou non pendant l'enregistrement.

### Phase 5 - Bezier camera

Objectif:

- ajouter un modele de courbe camera 3D;
- permettre a la camera de suivre cette courbe pendant qu'elle pointe vers la track reelle;
- afficher une preview Cesium de la courbe avant l'editeur Three.js complet.

Perimetre inclus:

- creation `JourneyReplayBezierModel`;
- generation automatique d'une courbe par defaut;
- evaluation de la courbe par progress 0..1;
- mode camera `bezier-camera`;
- rendu Cesium preview de la courbe;
- sauvegarde basique du modele dans `journey.replay`.

Hors perimetre:

- pas encore de canvas Three.js;
- pas d'edition fine de handles;
- pas de relief 3D local.

Modele Bezier:

```js
{
  version: 1,
  origin: {
    longitude,
    latitude,
    altitude
  },
  altitudeMode: 'relative',
  heightOffset: 300,
  controlPoints: [
    {
      id: 'p0',
      progress: 0,
      position: { x, y, z },
      in: null,
      out: { x, y, z }
    }
  ]
}
```

Decision importante:

- stocker les points en repere local metrique avec une origine geodesique;
- ne pas stocker les handles directement en longitude/latitude;
- convertir en WGS84/Cesium uniquement pour le runtime et la preview.

Generation par defaut:

- origine = premier sample;
- axe local X/Y aligne sur ENU;
- point 0 = depart + hauteur;
- point 1 = milieu de parcours + hauteur;
- point 2 = arrivee + hauteur;
- tangentes derivees de la direction locale de la track;
- hauteur relative constante au debut.

Evaluation:

```js
bezierModel.evaluate(progress) => {
  localPosition,
  worldPosition: { longitude, latitude, altitude },
  tangent
}
```

Camera:

- position camera = `bezierModel.evaluate(progress).worldPosition`;
- target = `sampler.atProgress(progress)`;
- orientation = look at target;
- pitch drawer peut devenir un offset de cadrage, mais ne doit pas casser le pointage target;
- si courbe invalide, fallback vers `track-follow` ou `marker-only` selon config.

Preview Cesium:

- `cameraCurve`: polyline 3D non clamp-to-ground;
- `cameraPoint`: petit point sur la courbe;
- couleur distincte de la trace reelle;
- toggle "show camera curve".

Fichiers principaux:

- `src/core/ui/replay/JourneyReplayBezierModel.js`;
- `src/core/ui/replay/JourneyReplayCameraController.js`;
- `src/core/ui/replay/JourneyReplayCesiumRenderer.js`;
- `src/components/JourneyReplay/JourneyReplayDrawer.jsx`;
- `src/core/Journey.js` si initialisation/persistance `journey.replay` necessaire.

Criteres de validation:

- une courbe par defaut est generee sur toute journey valide;
- la preview Cesium apparait au-dessus de la trace;
- en playback, la camera suit la courbe et pointe la trace reelle;
- marker-only et track-follow restent disponibles;
- la sauvegarde/rechargement conserve la courbe;
- si la journey change, la courbe invalide est regeneree ou marquee comme obsolete.

Tests:

- unit: conversion local -> WGS84 -> local avec tolerance;
- unit: evaluation Bezier a 0, 0.5, 1;
- unit: generation par defaut sur trace courte et longue;
- manuel: playback complet en `bezier-camera`;
- manuel: reload app et verifier courbe conservee;
- manuel: toggle preview.

Validation attendue:

- valider la structure persistente du modele Bezier;
- valider la courbe par defaut;
- valider la couleur/style de preview Cesium.

### Phase 6 - Editeur 3D Three.js

Objectif:

- fournir l'editeur 3D demande: rectangle relief + trace reelle + courbe Bezier;
- permettre rotation/zoom/pan et manipulation des points de controle;
- ecrire dans le meme `JourneyReplayBezierModel` que la Phase 5.

Perimetre inclus:

- ajout dependance `three`;
- creation `JourneyReplayBezierEditor3D.jsx`;
- scene Three.js locale;
- rectangle relief simplifie;
- trace reelle en relief;
- courbe Bezier et handles;
- `OrbitControls`;
- `TransformControls` ou handles maison;
- sauvegarde/apply/reset;
- synchronisation preview Cesium apres modification.

Hors perimetre:

- pas de moteur de rendu alternatif a Cesium pour la map principale;
- pas de rendu video direct depuis Three.js;
- pas de simulation physique avancee du terrain;
- pas d'export du modele 3D.

Architecture:

```txt
JourneyReplayDrawer
  JourneyReplayBezierEditor3D
    createJourneyReplayEditorScene()
    replayEditorCoordinates
    JourneyReplayBezierModel
```

Scene Three.js:

- camera perspective;
- renderer WebGL avec fond transparent ou fond neutre;
- lumiere hemispherique + directional;
- grille ou rectangle terrain;
- trace reelle en ligne/tube;
- courbe Bezier en ligne epaisse;
- points de controle en spheres;
- tangentes en lignes fines;
- label discret depart/arrivee si utile.

Repere local:

- origine = `bezierModel.origin`;
- X = est, Y = nord, Z = altitude;
- toutes les manipulations se font en metres;
- altitude terrain relative a l'origine pour garder des valeurs stables;
- facteur d'echelle visuel possible pour Z si relief trop plat, mais il doit etre affiche et ne pas polluer les donnees sauvegardees.

Relief:

- V1: bande terrain autour de la trace, pas un MNT complet;
- generer une grille a partir des samples et de normales laterales;
- largeur configurable, par exemple 5% de la bbox ou valeur min en metres;
- altitude = altitude sample interpolee;
- materiau sobre, semi mat, pas de texture obligatoire;
- afficher la trace au-dessus pour rester lisible.

Edition Bezier:

- selection d'un point de controle;
- deplacement XYZ via gizmo;
- handles in/out visibles pour le point selectionne;
- option "lock altitude mode": maintient hauteur relative si active;
- bouton `Reset curve`;
- bouton `Apply`;
- bouton `Cancel`;
- les modifications non appliquees restent locales au composant.

Synchronisation avec Cesium:

- `Apply` ecrit dans `journey.replay` ou le store courant;
- le renderer Cesium recoit un event `replay/bezier/update`;
- la preview Cesium se met a jour;
- si JourneyReplay est en cours de playback, soit on applique a la frame suivante, soit on bloque l'edition. Recommandation V1: bloquer l'edition pendant playback.

Performance:

- limiter le nombre de samples affiches dans Three.js par decimation;
- garder le modele source complet cote sampler;
- disposer renderer, geometries, materials et controls au unmount;
- suspendre le rendu Three.js quand drawer ferme;
- rAF Three.js uniquement pendant interaction ou changement, pas en boucle permanente si scene statique.

Fichiers principaux:

- `package.json`;
- `src/components/JourneyReplay/JourneyReplayBezierEditor3D.jsx`;
- `src/components/JourneyReplay/three/createJourneyReplayEditorScene.js`;
- `src/components/JourneyReplay/three/replayEditorCoordinates.js`;
- `src/components/JourneyReplay/three/replayEditorGeometry.js`;
- `src/components/JourneyReplay/style.css`;
- `src/core/ui/replay/JourneyReplayBezierModel.js`.

Criteres de validation:

- l'editeur s'ouvre sur une scene non vide;
- la trace relief correspond a la journey courante;
- rotation/zoom/pan fonctionnent;
- un point Bezier peut etre deplace;
- `Apply` met a jour la preview Cesium;
- `Cancel` ne modifie pas la courbe sauvegardee;
- `Reset` regenere une courbe par defaut;
- fermeture du drawer libere le WebGL renderer;
- aucun recouvrement incoherent des controles sur desktop/mobile.

Tests:

- unit: conversions ENU locales;
- unit: decimation conserve depart/arrivee;
- manuel/Playwright: screenshot canvas non vide;
- manuel/Playwright: desktop et mobile, canvas correctement cadre;
- manuel: deplacement point, apply, playback `bezier-camera`;
- manuel: ouvrir/fermer 10 fois sans fuite visible ni erreur console.

Validation attendue:

- valider le choix drawer large ou widget outil;
- valider le niveau de relief V1;
- valider les controles d'edition: `TransformControls` standard ou handles custom;
- valider si l'echelle verticale doit etre exposee.

## Risques techniques

- Les `metrics.points` ne contiennent pas le premier point: a corriger dans le sampler.
- Les journeys multi-tracks demandent un mapping precis `trackIndex/pointIndex`.
- Cesium `requestRenderMode = true`: il faudra appeler `scene.requestRender()` ou utiliser un rAF qui force le rendu.
- La camera continue doit restaurer toutes les options du `screenSpaceCameraController`.
- Le recorder encode un canvas compose; les widgets doivent etre montes avant START, comme le flow video actuel.
- Les updates ECharts a chaque frame peuvent couter cher; il faut throttler ou mettre a jour uniquement la serie progressive.
- L'editeur Three.js demande une conversion stable WGS84 <-> repere local metrique; il ne faut pas editer directement en longitude/latitude.
- Three.js et Cesium auront deux rendus separes: le modele Bezier doit etre la source de verite commune, pas les primitives graphiques.
- Le canvas Three.js doit etre teste sur desktop/mobile: non vide, cadre correct, controls actifs, pas de recouvrement avec les boutons du drawer.

## Tests

Unitaires:

- sampler: premier point, dernier point, interpolation, multi-track, reverse, distance restante;
- controller: duree exacte, pause/resume, loop, stop a la fin;
- camera math: orientation camera -> target.

Manuels/Playwright:

- demarrer JourneyReplay sur une journey simple;
- verifier le disque terrain et la completed line;
- afficher le profile widget et verifier le remplissage;
- changer les unites pendant overlay visible;
- tester video record avec depart synchronise;
- tester sortie propre: map draggable restauree, camera manager restaure, widgets visibles.
- tester l'editeur Three.js: scene non vide, zoom/rotation, deplacement d'un point de controle, sauvegarde puis preview Cesium identique.

## Conclusion

La bonne premiere version ne doit pas commencer par tout l'editeur 3D complet, mais le choix technique est fixe: l'editeur de courbe/relief sera en Three.js. Le socle critique reste le sampler distance + rAF + rendu Cesium + sync profile/video. Ensuite, l'editeur Three.js devient un client du meme modele Bezier et du meme sampler, pas un second mode concurrent.
