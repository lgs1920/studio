# Spécifications Fonctionnelles et Techniques : Accès Cloud et Synchronisation Distante

## 1. Expression du Besoin et Objectifs Principaux

En complément de la synchronisation locale (disque dur), les utilisateurs de LGS1920 doivent pouvoir sauvegarder,
restaurer et synchroniser leurs données directement sur leur espace Cloud personnel (Google Drive, OneDrive, Dropbox,
etc.).

**Les cas d'usage principaux sont :**

- **La Synchronisation Complète de la DB :** Lier un dossier dans le Cloud pour une synchronisation continue (
  remplacement de l'IndexedDB), ou exporter/importer une archive complète (.zip) depuis le Cloud.
- **La Gestion Granulaire (Entités individuelles) :** Pouvoir exporter ou importer uniquement un objet spécifique (ex:
  un seul 'Journey' ou un seul 'POI') sous forme de fichier .json vers/depuis le Cloud.
- **Un Explorateur de Fichiers Intégré :** L'utilisateur doit pouvoir naviguer dans ses dossiers Cloud directement
  depuis l'application LGS1920 pour choisir où sauvegarder ou quel fichier lire, sans quitter l'interface.

L'application restant purement 'Frontend' (sans backend centralisé LGS1920), toute l'authentification et les échanges de
fichiers doivent se faire directement entre le navigateur de l'utilisateur et les API REST des fournisseurs Cloud (
architecture Serverless / SPA).

---

## 2. Architecture Logicielle : Abstraction et Fournisseurs Cloud

Pour supporter plusieurs clouds sans dupliquer le code métier, nous devons mettre en place une architecture basée sur
des **Interfaces d'Abstraction** (Design Pattern 'Strategy' / 'Adapter').

### 2.1 La Couche d'Abstraction (CloudProviderInterface)

Nous allons créer une classe de base (ou une interface) définissant les contrats que chaque fournisseur Cloud devra
respecter.

**Méthodes requises pour tout fournisseur :**

- connect(): Gère le flux d'authentification OAuth2 (PKCE) et récupère le token d'accès.
- disconnect(): Supprime le token.
- isAuthenticated(): Vérifie la validité du token.
- listFiles(folderId): Retourne la liste des dossiers et fichiers d'un répertoire donné.
- readFile(fileId): Télécharge et retourne le contenu d'un fichier (JSON ou binaire/Blob).
- writeFile(folderId, fileName, content): Crée ou écrase un fichier.
- createFolder(parentFolderId, folderName): Crée un nouveau répertoire.

### 2.2 Les Implémentations (Providers)

Dans src/core/cloud/, nous créerons les adaptateurs spécifiques :

1. **GoogleDriveProvider.js** : Utilise l'API REST Google Drive v3.
2. **OneDriveProvider.js** : Utilise l'API Microsoft Graph.
3. **DropboxProvider.js** : Utilise l'API Dropbox.

### 2.3 Le CloudManager (L'Orchestrateur)

C'est un singleton qui :

- Maintient la référence vers le fournisseur actuellement actif (ex: CloudManager.setProvider(new
  GoogleDriveProvider())).
- Gère la persistance du token OAuth2 dans IndexedDB ou localStorage.
- Fait le pont entre le DatabaseSyncManager (créé dans les specs locales) et le Cloud.

---

## 3. Le Gestionnaire de Fichiers UI (Universal File Explorer)

Puisque nous n'utilisons pas les boîtes de dialogue natives de l'OS (showDirectoryPicker), nous devons recréer un
mini-explorateur de fichiers dans l'application.

**Composant : UniversalFileManagerModal.jsx (dans src/components/Modals/)**
*Note: Ce composant doit être conçu de manière agnostique. Bien qu'il serve principalement à naviguer dans le Cloud (via
les APIs REST), il pourrait théoriquement être branché sur la File System Access API locale (Chrome) ou même sur l'OPFS
local, offrant ainsi une interface unique et cohérente à l'utilisateur, qu'il navigue sur son disque dur ou sur son
Drive.*

- **Rôle :** Afficher une modale (ou un Drawer) permettant de naviguer dans l'arborescence du Cloud connecté.
- **Fonctionnalités :**
    - Fil d'Ariane (Breadcrumb) pour remonter dans les dossiers parents.
    - Liste des dossiers (icône dossier) cliquables pour entrer dedans.
    - Liste des fichiers (icône fichier) filtrables par extension (ex: uniquement les .zip ou .json).
    - Bouton 'Nouveau Dossier'.
    - **Mode Sélection de Fichier (Paramétrable) :** La modale doit accepter des props pour filtrer l'affichage et
      contrôler la sélection :
        - allowedExtensions: ex: [.json, .gpx, .zip]. Les autres fichiers sont grisés ou masqués.
        - multiple: booléen. Autorise la sélection d'un seul fichier ou de plusieurs (via des cases à cocher).
        - mode: read (Import) ou save (Export, où l'on affiche un champ texte en bas pour nommer le nouveau fichier).
    - **Mode Sélection de Dossier :** L'utilisateur navigue dans un dossier et clique sur un bouton flottant '
      Sélectionner ce dossier' (Export ou Synchro continue).

---

## 4. Intégration avec les Cas d'Usage

### 4.1 Export/Import Granulaire (Ex: Un Journey)

Au lieu de toujours tout synchroniser, l'utilisateur peut vouloir partager un voyage spécifique.

- **Export :** Dans l'éditeur de Journey, un bouton 'Exporter vers le Cloud'. Le composant demande au CloudManager de
  lancer le CloudFileManagerModal en mode 'Sélection de Dossier'. Une fois le dossier choisi, on génère le JSON du
  Journey et on appelle provider.writeFile().
- **Import :** Bouton 'Importer depuis le Cloud'. Le modal s'ouvre, n'affiche que les .json. L'utilisateur clique, on
  appelle provider.readFile(), on parse le JSON et on l'injecte dans le store journeys.

### 4.2 L'équivalent Cloud de la Synchronisation Continue

Le DatabaseSyncManager (défini dans SyncDB-TODO.md) sera étendu pour supporter le CloudManager comme destination, à la
place du DirectoryHandle local.

- **Liaison :** L'utilisateur lie le projet à un dossier Cloud (via le File Explorer Modal).
- **Debounce :** À chaque modification dans LGS1920, le minuteur s'enclenche.
- **Écriture :** À la fin du minuteur, le DatabaseSyncManager demande au CloudManager de faire un HTTP PUT vers le
  fichier spécifique (ex: settings.json) dans le dossier Cloud ciblé. *C'est ici que l'approche Multi-fichiers prend
  tout son sens : on uploade 10Ko sur Google Drive, pas 50Mo !*

---

## 5. Interface Utilisateur (UI) des Connexions

Dans le panneau des Paramètres (Settings/), création d'un onglet **Connexions Cloud**.

**Maquette :**

- **Google Drive** : [Bouton : Connecter] (Si non connecté) / [Texte: Connecté] [Bouton : Déconnecter]
- **Microsoft OneDrive** : [Bouton : Connecter]
- **Dropbox** : [Bouton : Connecter]

*Note UX :* Un seul Cloud peut être 'actif' à la fois pour la synchronisation principale du projet.

---

## 6. Plan d'Implémentation Détaillé (Roadmap Cloud)

### Phase 1 : Cœur du Cloud et Authentification OAuth2

- **Créer les Apps développeurs :** Aller sur la Google Cloud Console, Azure Portal et Dropbox Developer pour créer les
  ID Clients OAuth2 de LGS1920.
- **Développer l'Interface :** Créer CloudProviderInterface.js.
- **Implémenter Google Drive :** Développer GoogleDriveProvider.js (Auth PKCE, upload/download binaire et texte).
- **Le Manager :** Créer CloudManager.js pour gérer l'état de connexion.

### Phase 2 : Le Composant Explorateur de Fichiers (UI)

- Développer CloudFileManagerModal.jsx en utilisant WebAwesome / FontAwesome.
- Le connecter au CloudManager pour qu'il affiche dynamiquement les dossiers via listFiles().
- Implémenter la navigation (entrer/sortir des dossiers) et la sélection.

### Phase 3 : Les Actions Granulaires et l'Import/Export dans l'UI Principale

- **Connecter l'Existant (Exemple avec JourneyExport/Import) :** Vous avez déjà implémenté des logiques d'export pour
  les Journeys (en JSON, GPX, etc.). Il s'agit ici d'ajouter un sous-menu ou un bouton alternatif. Au lieu d'un
  téléchargement direct classique, on propose *Exporter vers le Cloud / Répertoire local*.
- **Flux UX d'Export :** L'utilisateur clique sur Exporter. On lance l'UniversalFileManagerModal. L'utilisateur
  navigue (en Cloud ou en Local selon ce qu'il a choisi dans les paramètres), choisit un dossier cible et valide. On
  génère le JSON du Journey spécifique et on utilise l'interface abstraite (Cloud ou Locale) pour écrire le fichier.
- **Flux UX d'Import :** L'utilisateur clique sur Importer. On lance l'UniversalFileManagerModal en mode fichier. Il
  navigue, sélectionne un .json. On lit le contenu, on parse le JSON, et on l'injecte dans le store idb correspondant.

### Phase 4 : Fusion avec la Synchronisation Globale de la Base

- Étendre le DatabaseSyncManager (issu du dev local) pour qu'il puisse accepter une destination 'Cloud' en plus de la
  destination 'Locale'.
- Si un dossier Cloud est lié, brancher le mécanisme de Debounce pour qu'il appelle le CloudManager au lieu de l'API
  File System locale.

### 3.1 Un Explorateur 'Universel' (Local & Cloud)

L'idée brillante est de concevoir ce UniversalFileManagerModal.jsx de manière totalement **agnostique**.

Il ne doit pas savoir s'il affiche des fichiers Cloud ou Locaux. Il a juste besoin d'une interface abstraite (ex:
FileSystemProvider) qui lui fournit : listFiles(), createFolder(), etc.

Ainsi, vous pourrez utiliser cette **même fenêtre (même UI)** pour :

1. **Naviguer dans le Cloud** (via le CloudManager et les API REST).
2. **Naviguer sur le disque dur local** (via la *File System Access API* de Chrome, si disponible). Au lieu de laisser
   Chrome ouvrir la boîte de dialogue hideuse de Windows/Mac, vous demandez d'abord à l'utilisateur de lier un dossier
   parent (ex: le dossier racine LGS1920), puis votre UniversalFileManagerModal utilise les FileSystemDirectoryHandle
   pour afficher les sous-dossiers locaux directement dans votre belle interface LGS !
3. **Naviguer dans l'OPFS** (Origin Private File System), si vous décidez un jour de l'utiliser comme cache temporaire.

C'est la garantie d'une Expérience Utilisateur (UX) parfaitement cohérente et immersive, peu importe d'où proviennent
les données.

## 7. Extensions Multi-Cloud : Quels autres fournisseurs intégrer ?

Outre les incontournables (Google Drive, Microsoft OneDrive, Dropbox), l'architecture abstraite permet d'ajouter très
facilement de nouveaux fournisseurs. Voici les plus pertinents pour le cas d'usage de LGS1920 :

1. **Apple iCloud :** Essentiel si vous ciblez une forte population sur iOS / Mac. Cependant, l'API iCloud (CloudKit JS)
   est notoirement complexe à intégrer en dehors de l'écosystème Apple natif. C'est un 'nice-to-have' mais un gros défi
   technique.
2. **Nextcloud / ownCloud (WebDAV) :** De nombreux utilisateurs soucieux de la vie privée ('Privacy First') hébergent
   leur propre Cloud (auto-hébergement ou via des prestataires comme Infomaniak). Créer un WebDavProvider.js permettrait
   à LGS1920 de se connecter à n'importe quel Nextcloud au monde. C'est un argument de vente massif pour le respect de
   la vie privée.
3. **Proton Drive :** Dans la même veine que Nextcloud, c'est l'un des fournisseurs Cloud les plus sécurisés (
   chiffrement de bout en bout). S'ils exposent une API REST (à vérifier), ce serait une intégration très prestigieuse.

**Comment gérer le Multi-Cloud côté utilisateur ?**
L'utilisateur ne devrait pas avoir à 'choisir' un seul Cloud de manière exclusive pour les actions granulaires.
Dans le UniversalFileManagerModal, on pourrait imaginer une 'Barre latérale (Sidebar)' qui liste les 'Emplacements'
disponibles (exactement comme dans le Finder Mac ou l'Explorateur Windows) :

- 📁 Mon Ordinateur (Dossier local lié)
- ☁️ Mon Google Drive (connecté)
- ☁️ Mon Nextcloud (connecté)
  L'utilisateur pourrait ainsi importer un Journey depuis son Google Drive, le modifier, puis l'exporter vers son
  dossier local !
