# VideoRecorder & CanvasOverlayComposer

**Système complet d’enregistrement vidéo en temps réel pour applications web.**

Permet d’enregistrer :

- Un **canvas WebGL** plein écran avec **zone de clipping définie**
- **Plusieurs canvas d’overlay** positionnés en `top`, `left`, `width`, `height` **relatifs à la fenêtre**
- **Canvas dynamiques** (ex: `OffscreenCanvas` mis à jour à intervalle)
- Sortie en **MP4 (VP9)** avec métadonnées, qualité configurable, limites de durée/taille

---

## Fonctionnalités

- Clipping précis du canvas principal
- Superposition intelligente des overlays (UI, chat, timer, webcam)
- Conversion automatique des coordonnées `window` → zone de clipping
- Support `OffscreenCanvas` et mises à jour fréquentes
- Enregistrement fluide via `mediabunny`
- Événements : `start`, `stop`, `info`, `error`, `download`, `pause`, `resume`
- Pause/reprise avec calcul exact de durée
- Limites automatiques (durée, taille)
- Téléchargement local ou File System API
- UI intégrée avec **Shoelace** + **FontAwesome**
- Singleton, EventTarget, nettoyage complet via `dispose()`

---

## Dépendances

```bash
bun add mediabunny luxon
Bun est le runtime recommandé

Structure du projet
textsrc/
├── VideoRecorder.js           # Enregistrement MP4 + événements
├── CanvasOverlayComposer.js   # Composition WebGL + overlays
├── index.html                 # Interface Shoelace
└── main.js                    # Démarrage

Utilisation
1. Initialiser l’enregistreur
jsimport { VideoRecorder, QUALITY_HIGH } from './VideoRecorder.js'

const recorder = new VideoRecorder()

recorder.initialize({
    fps: 30,
    quality: QUALITY_HIGH,
    maxDuration: 60_000, // 60s
    maxSize: 500 * 1024 * 1024, // 500 Mo
    metadata: { artist: 'LGS1920', date: new Date() }
})
2. Créer le compositeur
jsimport { CanvasOverlayComposer } from './CanvasOverlayComposer.js'

const webglCanvas = document.getElementById('webgl')

const composer = new CanvasOverlayComposer(
    webglCanvas,
    { x: 320, y: 180, width: 1280, height: 720 }, // zone de clipping
    1280, 720 // dimensions finales
)

// Ajouter des overlays
composer.addOverlay(document.getElementById('timer'), {
    top: 50, left: 100, width: 200, height: 60
})

composer.addOverlay(document.getElementById('chat'), {
    top: 600, left: 900, width: 350, height: 400
})
3. Lancer l’enregistrement
jsrecorder.setSource([composer.getCanvas()])
recorder.start()

Événements
jsrecorder.addEventListener('video/start', () => console.log('Démarré'))
recorder.addEventListener('video/info', e => updateProgress(e.detail))
recorder.addEventListener('video/stop', async e => {
    await recorder.download({ filename: 'studio-recording', type: 'local-filesystem' })
})
recorder.addEventListener('video/error', e => console.error(e.detail.error))

UI Exemple (Shoelace + FontAwesome)
html<sl-button id="recordBtn" variant="primary">
    <fa-icon icon="fas-circle" slot="prefix"></fa-icon>
    Record
</sl-button>

<sl-progress-bar id="progress" value="0"></sl-progress-bar>
jsimport { fasCircle, fasStop } from '@fortawesome/pro-regular-svg-icons'

const btn = document.getElementById('recordBtn')
const progress = document.getElementById('progress')

let recording = false

btn.addEventListener('click', () => {
    if (recording) {
        recorder.stop()
        btn.innerHTML = '<fa-icon icon="fas-circle" slot="prefix"></fa-icon> Record'
        btn.variant = 'primary'
    } else {
        recorder.start()
        btn.innerHTML = '<fa-icon icon="fas-stop" slot="prefix"></fa-icon> Stop'
        btn.variant = 'danger'
    }
    recording = !recording
})

recorder.addEventListener('video/info', e => {
    progress.value = (e.detail.duration / 60000) * 100
})

API Résumé
VideoRecorder









































MéthodeDescriptioninitialize(options)Configure FPS, qualité, limitessetSource([canvas])Définit la source (1 seul canvas)start()Démarrepause() / resume()Contrôlestop()Finalise → Blobcancel()Annule sans fichierdownload(options)Local / File Systemdispose()Nettoie tout
CanvasOverlayComposer

























MéthodeDescriptionaddOverlay(canvas, {top,left,width,height})Ajoute un overlayremoveOverlay(canvas)SupprimegetCanvas()Canvas finaldispose()Nettoie

Performances

1 seul canvas final → optimal pour mediabunny
requestAnimationFrame → fluide
devicePixelRatio géré
Zéro fuite mémoire avec dispose()


Nettoyage
jsrecorder.dispose()
composer.dispose()

Licence
© 2025 LGS1920 – Tous droits réservés
text---