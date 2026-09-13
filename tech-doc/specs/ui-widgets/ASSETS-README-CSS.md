# Managed CSS Notes

Document local non versionne. Il resume l'analyse sur le demontage des CSS quand les composants React qui les utilisent sont demontes.

## Objectif

Le but est d'eviter que certains CSS charges pour une page, un drawer ou un widget restent actifs apres le demontage du composant proprietaire.

Le prototype actuel ajoute un outil de chargement gere :

- `CSSUtils.mountStylesheet(id, href)` ajoute un `<link rel="stylesheet">` dans `document.head`.
- Le lien est refcounted : plusieurs composants peuvent partager le meme CSS sans doublon.
- Le cleanup retire le lien seulement quand le dernier consommateur est demonte.
- `useManagedStylesheet(id, href)` branche ce comportement sur le cycle de vie React.

## Pourquoi monter en link

Avec un import classique :

```js
import './style.css'
```

Vite traite le CSS comme un effet de module. Une fois le module charge, React n'a pas de handle pour dire que ce CSS appartient a une instance ou a une page precise.

Avec un import URL :

```js
import href from './style.css?url'
useManagedStylesheet('owner-id', href)
```

Le composant recupere l'URL du CSS emis par Vite et l'application cree elle-meme le `<link>`. Ce lien est un objet DOM retirable. C'est proche du comportement production : asset CSS hashe, cacheable par le navigateur, mais avec une duree de vie controlee.

## Quand ca marche

Cette approche est adaptee aux CSS globaux classiques, par exemple `style.css` scoped par des classes ou des ids propres a une page, un drawer ou un widget.

Elle marche bien si :

- le CSS est importe par un seul proprietaire fonctionnel ;
- le composant proprietaire est vraiment monte/demonte ;
- le CSS ne sert pas a un bouton ou a un autre composant encore monte ;
- le CSS ne contient pas de theme global, de variables `:root` critiques ou de styles applicatifs permanents.

## Quand ca ne marche pas directement

Ce n'est pas une solution automatique pour tous les CSS.

Cas a eviter ou a traiter avant :

- `*.module.css` : Vite genere aussi un mapping JS de classes. Un simple `<link>` ne remplace pas ce contrat.
- CSS deja importe ailleurs avec `import './style.css'` : il peut rester injecte globalement.
- CSS partage entre bouton, drawer, widget, preview, editor ou plusieurs surfaces actives.
- CSS de theme/base : app, WebAwesome, Shoelace, variables globales, animations globales.

## Regle de propriete

Le parent peut porter le CSS si c'est lui qui possede la surface complete.

Exemple correct :

```jsx
const Page = () => {
    useManagedStylesheet('page-css', pageStylesheetHref)

    if (!visible) {
        return null
    }

    return <PageContent/>
}
```

Le point important n'est pas le composant qui a besoin d'une classe, mais le composant qui possede la duree de vie de toute la surface stylisee.

Pour un CSS partage par plusieurs enfants, il vaut mieux remonter l'import au parent commun. Pour un CSS partage par deux surfaces independantes, il faut d'abord splitter la feuille.

## Migrations deja faites

`JourneyStatsWidget` a ete migre comme prototype :

- `src/components/Stats/JourneyStatsWidget.jsx` importe `./style.css?url`.
- `JourneyStatsWidget` appelle `useManagedStylesheet('journey-stats-widget', href)`.
- `src/components/Stats/style.css` n'etait importe que par ce widget, donc le risque etait faible.

`GeocodingUI` a ete migre ensuite :

- `src/components/MainUI/geocoding/GeocodingUI.jsx` importe `./style.css?url`.
- `GeocodingUI` appelle `useManagedStylesheet('geocoding', href)`.
- `src/components/MainUI/geocoding/style.css` etait importe uniquement par `GeocodingUI.jsx`.
- La surface geocoding est montee par `MainUI` uniquement quand `geocoderDialog.mounted` est vrai, donc le cycle de vie du CSS suit bien le cycle de vie de la surface geocoding.

`WidgetEditorPanel` a ete migre ensuite :

- `src/components/MainUI/widgets/editor/WidgetEditorPanel.jsx` importe `./style.css?url`.
- `WidgetEditorPanel` appelle `useManagedStylesheet('widget-editor-panel', isVisible ? href : null)`.
- `src/components/MainUI/widgets/editor/style.css` etait importe uniquement par `WidgetEditorPanel.jsx`.
- `WidgetEditorPanel` reste monte par `MainUI`, donc le CSS est explicitement gate par `isVisible`; quand le drawer ferme, le hook recoit `null` et nettoie le `<link>`.

Tests ajoutes :

- `src/__tests__/managed-stylesheet.test.jsx`
- verification creation du lien ;
- verification absence de doublon ;
- verification retrait apres dernier unmount.

Commits locaux :

- `1df143d0 Add managed stylesheet utility`
- `a4126502 Mount journey stats CSS on widget lifecycle`
- `b25886b6 feat(geocoding): manage stylesheet lifecycle`
- `66a687d8 feat(widgets): manage editor stylesheet lifecycle`

## CSS a changer avec faible risque

### 1. Profile tools dans settings

Fichier CSS :

- `src/components/Settings/application/profile/style.css`

Proprietaire recommande :

- `src/components/Settings/application/profile/ProfileTools.jsx`

Pourquoi changer le proprietaire :

- aujourd'hui le meme CSS est importe par `ResetProfile.jsx` et `RemoveProfile.jsx` ;
- ces deux composants sont toujours ensemble dans `ProfileTools` ;
- le parent commun est donc le bon owner ;
- les fichiers `Settings/application/profile` ne sont pas modifies dans le workspace actuel.

Migration probable :

- retirer `import './style.css'` de `ResetProfile.jsx` et `RemoveProfile.jsx` ;
- importer `./style.css?url` dans `ProfileTools.jsx` ;
- appeler `useManagedStylesheet('settings-profile-tools', href)` dans `ProfileTools`.

### 2. Tracks editor

Fichier CSS :

- `src/components/TracksEditor/style.css`

Proprietaire recommande :

- `src/components/TracksEditor/TracksEditor.jsx`

Pourquoi c'est raisonnable :

- import unique ;
- drawer rendu seulement quand `drawerOpen === JOURNEY_EDITOR_DRAWER` ;
- beaucoup de selecteurs sont scopes sur `#journey-editor-drawer`.

Pourquoi attendre dans le workspace actuel :

- `src/components/TracksEditor/style.css` et plusieurs fichiers `TracksEditor` ont des modifications non liees ;
- migrer maintenant melangerait le travail CSS dynamique avec ces changements.

Points a verifier :

- la feuille contient aussi quelques selecteurs plus generiques comme `wa-tab sl-icon` ou `.menu-panel` ;
- avant migration, chercher si ces classes existent hors `TracksEditor`.

## CSS deja migres avec faible risque

### Geocoding

Fichier CSS :

- `src/components/MainUI/geocoding/style.css`

Owner :

- `src/components/MainUI/geocoding/GeocodingUI.jsx`

### Widget editor panel

Fichier CSS :

- `src/components/MainUI/widgets/editor/style.css`

Owner :

- `src/components/MainUI/widgets/editor/WidgetEditorPanel.jsx`

Pourquoi c'etait assez sur :

- import unique ;
- le drawer retourne `null` quand `isVisible` est faux ;
- le CSS concerne le shell du drawer d'edition : `.lgs-editor-layout`, `.editor-preview-zone`, `.editor-body-zone`, etc.
- les sous-composants dynamiques qui utilisent `.lgs-widget-editor-card`, `.lgs-widget-color-control-grid` ou `.lgs-widget-padding-element` sont rendus dans ce drawer.

Point a verifier :

- `src/Utils/ExportAsReport/profile.js` et `src/components/MainUI/widgets/Widget.jsx` interrogent `.editor-preview-zone` dans le DOM. Le risque reste faible car ils n'ont besoin que de l'element rendu, pas du CSS quand le drawer est demonte.
- `src/components/MainUI/ElevationProfile.jsx` utilise aussi `editor-preview-zone`, mais `TracksEditor/style.css` porte deja un style specifique `#journey-settings .editor-preview-zone`.

## CSS a changer seulement apres split

Ces feuilles sont partagees entre un bouton toujours visible et un drawer/panel. Si on les demonte avec le drawer, on risque de casser le bouton.

### Settings

Fichier :

- `src/components/Settings/style.css`

Importeurs :

- `src/components/Settings/Panel.jsx`
- `src/components/Settings/PanelButton.jsx`

Action avant migration :

- separer `PanelButton` dans un CSS bouton ou deplacer ses styles vers un CSS global toolbar ;
- garder le reste pour le drawer `SettingsPanel`.

### Information panel

Fichier :

- `src/components/InformationPanel/style.css`

Importeurs :

- `src/components/InformationPanel/Panel.jsx`
- `src/components/InformationPanel/PanelButton.jsx`

Action avant migration :

- separer le CSS du bouton ;
- migrer le CSS du drawer seulement ensuite.

### Layers panel

Fichier :

- `src/components/Settings/layers/style.css`

Importeurs :

- `src/components/Settings/layers/Panel.jsx`
- `src/components/Settings/layers/PanelButton.jsx`

Action avant migration :

- separer le CSS du bouton layer ;
- migrer la partie drawer avec `Panel.jsx`.

### File loader

Fichier :

- `src/components/FileLoader/style.css`

Importeurs :

- `src/components/FileLoader/JourneyLoaderUI.jsx`
- `src/components/FileLoader/JourneyLoaderButton.jsx`

Action avant migration :

- isoler les styles du bouton/import trigger ;
- garder le CSS modal sous `JourneyLoaderUI`.

## CSS a eviter pour l'instant

### Text

Fichier :

- `src/components/Text/style.css`

Importeurs :

- `TextButton.jsx`
- `TextWidget.jsx`
- `TextWidgetEditor.jsx`

Risque :

- partage bouton, widget, editor, preview indirecte ;
- necessite un vrai split avant tout demontage.

### Profile

Fichier :

- `src/components/Profile/style.css`

Importeurs :

- `ProfileButton.jsx`
- `ProfileChart.jsx`
- `ProfileWidget.jsx`

Risque :

- `ProfileChart` est utilise dans plusieurs contextes ;
- le widget, le bouton et les panneaux peuvent avoir des cycles de vie differents.

### MainUI video

Fichier :

- `src/components/MainUI/video/style.css`

Importeurs :

- `VideoDownloadAndShareDialog.jsx`
- `RecordingInfo.jsx`
- `VideoRecorderToolbar.jsx`
- `VideoPresetToolbar.jsx`

Risque :

- plusieurs surfaces video peuvent etre actives ou montees selon des etats differents ;
- split necessaire avant ownership propre.

### MainUI MapPOI

Fichier :

- `src/components/MainUI/MapPOI/style.css`

Importeurs :

- `Panel.jsx`
- `MapPOIContent.jsx`
- `MapPOISummary.jsx`
- `MapPOICluster.jsx`
- `MapPOIBulkActionsMenu.jsx`

Risque :

- styles partages entre rendu carte, panel d'edition, cluster, liste et actions bulk ;
- trop transversal pour un demontage simple.

### MainUI global

Fichier :

- `src/components/MainUI/style.css`

Risque :

- surface principale de l'application ;
- contient layout global, toolbar, welcome, widgets shell et classes communes ;
- a garder global.

### Global app/theme

Fichiers :

- `src/assets/css/app.css`
- `src/assets/css/themes/wa-lgs1920.css`
- `src/assets/css/animations.css`
- `@shoelace-style/shoelace/dist/themes/light.css`

Risque :

- themes, variables, reset, animations et design system ;
- ne pas demonter par composant.

## Ordre conseille

1. `GeocodingUI` - fait.
2. `WidgetEditorPanel` - fait.
3. `ProfileTools` - prochain conseille dans le workspace actuel.
4. `TracksEditor` - attendre que les changements non lies soient commits ou ecartes.
5. Split des panels avec boutons : Settings, Information, Layers, FileLoader
6. Split plus large : Text, Profile, Video, MapPOI

## Checklist avant migration d'un CSS

- Chercher tous les imports : `rg -n "style.css|DateTimeDisplay.css|useManagedStylesheet" src`.
- Verifier que le composant owner retourne vraiment `null` ou est demonte quand la surface ferme.
- Verifier que le CSS ne sert pas a un bouton toujours visible.
- Verifier les selecteurs generiques : `:root`, `body`, `html`, `wa-*`, `sl-*`, `.lgs-*` tres communs.
- Remplacer `import './style.css'` par `import href from './style.css?url'`.
- Ajouter `useManagedStylesheet(ownerId, href)` dans le composant owner.
- Tester ouverture/fermeture deux fois.
- Tester deux instances si le composant peut etre multiple.
- Lancer au minimum le test cible et un build Vite.
