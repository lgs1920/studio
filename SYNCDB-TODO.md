# Spécifications Fonctionnelles et Techniques : Synchronisation et Gestion de la Base de Données

## 1. Expression du Besoin et Objectifs Principaux

L'application LGS1920 repose actuellement sur IndexedDB pour stocker les données localement dans le navigateur. Bien que
fonctionnel, cela pose un problème majeur : comment un utilisateur peut-il 'sortir' ses données de l'application, les
sauvegarder de manière pérenne sur son disque dur, ou les transférer vers un autre appareil ?

L'objectif de cette spécification est de concevoir un système robuste permettant aux utilisateurs de sauvegarder,
restaurer, et idéalement synchroniser l'état de leur projet en temps réel via de simples fichiers, avec les garanties
suivantes :

- **Confidentialité absolue ('Privacy First') :** Il est hors de question d'envoyer les données de l'utilisateur sur un
  serveur central (backend, Firebase, etc.). Les données doivent rester physiquement sur la machine de l'utilisateur ou
  sur un cloud personnel (comme son propre Google Drive) sur lequel nous n'avons aucun regard. Le stockage 'appartient à
  l'utilisateur' (User-owned Storage).
- **Flexibilité et Contrôle :** L'application doit pouvoir démarrer directement à partir d'un fichier ou d'un dossier
  sélectionné, remplacer la configuration actuelle à la volée, et permettre de réinitialiser la base de données interne.
- **Compatibilité Multi-plateforme (Le grand défi Web) :** La solution finale doit fonctionner peu importe si
  l'utilisateur est sur un PC de bureau avec Google Chrome, sur un Mac avec Safari, sur Firefox, ou même sur un
  téléphone mobile (iOS/Android). Cela nécessite une architecture hybride capable de s'adapter aux lourdes restrictions
  de sécurité des différents navigateurs.

---

## 2. Analyse Technique et Décisions Architecturales

Pour répondre à ce besoin, plusieurs approches techniques ont été étudiées, débattues, puis retenues ou rejetées.

### 2.1 Les Technologies Rejetées (et pourquoi)

1. **La Base de Données Cloud (Firebase, Supabase, Backend personnalisé) :**
    - *Le concept :* Synchroniser IndexedDB avec une base de données en ligne, via des WebSockets ou des API REST.
    - *Pourquoi c'est rejeté :* Cela viole immédiatement notre règle 'Privacy First'. Cela impliquerait de stocker les
      cartes et les données privées des utilisateurs sur nos propres serveurs. De plus, cela ajoute un coût
      d'hébergement permanent, nécessite une gestion de comptes utilisateurs (logins, mots de passe, RGPD), et rend
      l'application dépendante d'une connexion internet pour fonctionner correctement. LGS1920 doit rester une
      application 'Offline-First'.

2. **OPFS (Origin Private File System) comme outil de sauvegarde :**
    - *Le concept :* Utiliser le nouveau système de fichiers natif et ultra-rapide des navigateurs modernes pour y
      écrire nos fichiers JSON de sauvegarde.
    - *Pourquoi c'est rejeté :* OPFS porte bien son nom : il est **Privé** pour le navigateur. C'est un espace '
      sandboxed' (bac à sable). Si nous y sauvegardons un projet, l'utilisateur ne verra **jamais** ce fichier dans son
      Explorateur Windows ou son Finder Mac. Il ne pourra pas le copier sur une clé USB ni l'envoyer par email. C'est un
      fichier 'fantôme'. Pire encore, l'OPFS est cloisonné par navigateur : un projet commencé sur Chrome ne sera pas
      accessible sur le Firefox de la même machine. Enfin, si l'utilisateur vide son cache, l'OPFS est détruit. OPFS est
      excellent comme espace de travail interne (remplacement d'IndexedDB), mais n'est pas une solution d'
      export/sauvegarde.

3. **SQLite WASM (WebAssembly) :**
    - *Le concept :* Faire tourner un vrai moteur de base de données C (SQLite) dans le navigateur. La base entière
      devient un unique fichier physique .sqlite.
    - *Pourquoi c'est rejeté (pour l'instant) :* Bien que ce soit la technologie 'Offline-First' la plus puissante
      actuelle (idéale pour des volumes immenses et des requêtes complexes), cela demanderait un refactoring colossal de
      l'application. Il faudrait remplacer toutes les interactions actuelles basées sur des documents NoSQL (LocalDB.js
      et idb) par de véritables requêtes SQL. L'effort est trop important par rapport au besoin immédiat de sauvegarde.

### 2.2 L'Architecture Retenue : 'Le Répertoire' (Multi-fichiers JSON)

Étant donné que nous utilisons déjà idb, la solution la plus pragmatique est de sérialiser les données d'IndexedDB vers
un format de fichier standard, comme le JSON.

Cependant, au lieu de générer un **unique fichier monolithique gigantesque** (ex: LGS1920_ProjetComplet.json qui
pourrait peser 50 Mo), nous avons pris la décision de structurer la sauvegarde sous la forme d'un **Dossier (Répertoire)
** contenant de multiples petits fichiers JSON, chacun correspondant à une table (store) ou à une entité.

*Exemple de structure :*
Mon_Projet_LGS_Sauvegarde/

- settings.json
- journeys.json
- pois.json
- map_tiles.json

**Pourquoi ce choix est-il stratégique ?**

- **Des performances d'écriture drastiquement améliorées :** Si l'utilisateur modifie simplement la couleur d'un trait
  sur la carte, l'application n'aura besoin de réécrire que le tout petit fichier settings.json (quelques Ko). Si nous
  avions un gros fichier unique, il faudrait re-sérialiser et réécrire les 50 Mo en entier à chaque micro-modification,
  ce qui bloquerait l'interface et solliciterait le disque dur de manière excessive.
- **Une résilience face aux erreurs :** En découpant la donnée, on limite le 'rayon d'explosion'. Si une erreur survient
  pendant l'écriture du fichier pois.json, les données des journeys restent intactes.
- **Lisibilité et contrôle de version :** Un dossier de petits fichiers JSON est très facile à versionner avec Git, et
  très facile à ouvrir pour un humain dans un éditeur de texte. Un JSON de 50 Mo fait généralement planter les éditeurs
  classiques.
- **Parfaitement taillé pour le Cloud Personnel (Google Drive, etc.) :** Si nous décidons d'ajouter une synchronisation
  Google Drive plus tard, ce format est parfait. Au lieu d'uploader 50 Mo à chaque sauvegarde, l'application ne fera qu'
  une requête HTTP PUT pour mettre à jour le fichier modifié de 10 Ko. C'est immensément plus rapide et économe en bande
  passante.

---

## 3. Conception Logicielle : Le DatabaseSyncManager

Pour orchestrer tout cela, nous allons créer un nouveau module central, le DatabaseSyncManager, situé dans src/core/db/.
Ce manager agira comme une façade intelligente entre l'interface utilisateur, la base IndexedDB et le système de
fichiers de l'OS.

Le plus grand défi est de gérer les disparités entre les navigateurs. Le manager devra donc implémenter une **Stratégie
Hybride** selon le navigateur détecté.

### 3.1 Stratégie A : Le 'Mode Avancé' (Synchronisation Continue)

*Réservé aux navigateurs basés sur Chromium (Chrome, Edge, Opera) sur ordinateur de bureau.*

Ces navigateurs supportent la **File System Access API**, une API puissante permettant à un site web de demander à
l'utilisateur l'autorisation de lire et modifier un vrai dossier sur son disque dur.

**Le flux de fonctionnement :**

1. L'utilisateur clique sur 'Lier un dossier de synchronisation'.
2. L'application appelle window.showDirectoryPicker(). L'OS ouvre une fenêtre demandant à l'utilisateur de choisir ou
   créer un dossier (ex: sur son Bureau).
3. Le navigateur renvoie un objet FileSystemDirectoryHandle.
4. Le DatabaseSyncManager stocke précieusement cet objet Handle dans un coin de l'IndexedDB pour s'en souvenir aux
   prochaines sessions.
5. **La Synchronisation Réactive (Le Debounce) :** Le manager 'écoute' la LocalDB. À chaque fois que LocalDB.js fait un
   put, update ou delete, un minuteur est lancé (ex: 2000 ms). Si l'utilisateur continue de faire des modifications
   rapides (ex: il déplace un curseur, ce qui génère 60 modifications par seconde), le minuteur est constamment
   réinitialisé. Dès qu'il s'arrête (il relâche la souris), le minuteur arrive à zéro. Le manager exécute alors une *
   *Promesse asynchrone** (pour ne pas bloquer le thread principal) qui prend les données modifiées, les transforme en
   JSON, et utilise le DirectoryHandle pour écraser silencieusement le fichier correspondant dans le dossier sur le
   Bureau.
6. **Le démarrage (Boot sequence) :** Lors du prochain lancement de l'application, avant même d'afficher l'interface, le
   manager cherchera le DirectoryHandle sauvegardé. Il demandera silencieusement la permission à l'OS (qui peut parfois
   nécessiter un clic de confirmation de l'utilisateur), lira les fichiers JSON du dossier, et mettra à jour l'IndexedDB
   pour que l'application démarre directement dans l'état exact du fichier local.

### 3.2 Stratégie B : Le 'Mode Universel' (Fallback Manuel)

*Pour Firefox, Safari, iOS, Android.*

Ces environnements, pour des raisons de sécurité strictes, interdisent formellement à une page web de modifier
silencieusement des fichiers en arrière-plan. La File System Access API n'y existe pas ou est très limitée. Il n'y aura
donc **pas de synchronisation continue automatique**.

L'approche devient alors celle d'une sauvegarde 'manuelle' classique ('Save / Load'). Cependant, comme nous avons choisi
une architecture 'Répertoire' et qu'un navigateur web standard ne sait pas déclencher le téléchargement d'un dossier
entier, nous devons utiliser des archives ZIP.

**Le flux de fonctionnement :**

1. **L'Exportation (Sauvegarder) :** L'utilisateur clique sur un bouton 'Sauvegarder'. Le manager parcourt IndexedDB,
   crée une chaîne JSON pour chaque store. Il utilise ensuite une librairie JavaScript (comme **fflate**) pour créer une
   archive .zip en mémoire contenant tous ces fichiers JSON. Enfin, il génère un lien caché avec l'attribut download et
   clique dessus virtuellement. Le navigateur télécharge le fichier de manière standard dans le dossier '
   Téléchargements' de l'utilisateur.
2. **L'Importation (Restaurer / Démarrer depuis) :** L'utilisateur clique sur 'Importer' via un selecteur de fichier de
   type .zip. Il sélectionne son fichier LGS_Projet.zip. Le manager utilise fflate pour ouvrir l'archive en mémoire, lit
   les fichiers JSON, vide entièrement les tables de l'IndexedDB actuel, et insère les nouvelles données. Une fois
   l'opération terminée, l'interface est rafraîchie.

---

## 4. Interface Utilisateur (UI) : La page des Paramètres

Pour rendre ces fonctionnalités accessibles sans perturber l'interface principale, une nouvelle section sera créée dans
les réglages de l'application.

**Nouveau Composant :** LocalDbSettings.jsx (à intégrer dans src/components/Settings/).
Ce composant devra être réactif et adapter son affichage en fonction des capacités du navigateur détecté.

### Maquette conceptuelle de la section 'Synchronisation & Sauvegardes'

**[Zone 1 : État actuel du système]**
Cette zone indique à l'utilisateur où sont physiquement ses données actuellement.

- 🟢 Enregistrement standard (Données stockées dans le cache du navigateur)
- *(Si API supportée et dossier lié)* 🔵 Synchronisation continue active avec le dossier lié

**[Zone 2 : Actions Manuelles Universelles]**
Cette zone est toujours visible, sur tous les appareils. C'est le fameux 'Fallback'.

- 📥 **Bouton 'Importer / Démarrer depuis une archive (.zip)'**
  *(Texte explicatif : 'Remplace entièrement le projet actuel par le contenu de l'archive sélectionnée.')*
- 📤 **Bouton 'Exporter / Sauvegarder le projet (.zip)'**
  *(Texte explicatif : 'Génère une archive complète de vos données pour la stocker en lieu sûr.')*

**[Zone 3 : Synchronisation Avancée (Conditionnelle)]**
Cette zone n'apparaît que si le code JavaScript détecte la présence de window.showDirectoryPicker (donc si l'utilisateur
est sur Chrome/Edge Desktop).

- 🔗 **Bouton 'Lier un dossier local de synchronisation'**
  *(Texte explicatif : 'Sélectionnez un dossier sur votre ordinateur. LGS1920 y enregistrera automatiquement et en temps
  réel toutes vos modifications. L'application démarrera toujours à partir de ce dossier.')*
- ❌ **Bouton 'Délier le dossier et arrêter la synchronisation'**
  *(Ce bouton remplace le précédent si un dossier est déjà lié. L'application repasse alors en enregistrement
  standard).*

Des **Toasts de notification** devront être déclenchés à chaque réussite ('Projet exporté avec succès', 'Dossier lié', '
Base réinitialisée') ou erreur.

---

## 5. Plan d'Implémentation Détaillé (Roadmap Technique)

La réalisation de cette architecture doit se faire de manière incrémentale, en s'assurant d'abord que la mécanique de
base (le JSON) fonctionne avant de s'attaquer aux complexités du ZIP et de la synchronisation continue.

### Phase 1 : Les Fondations (Utilitaires de sérialisation)

- **Fichier cible :** Création de src/core/db/DatabaseExportImportUtils.js.
- **Objectif :** Créer les fonctions pures capables de prendre l'instance d'IndexedDB (LocalDB) et de la transformer en
  chaînes de caractères.
- **Tâches :**
    - Écrire exportStoreToJson(storeName): Lit tout un store et retourne du JSON.
    - Écrire importJsonToStore(storeName, jsonString): Vide un store spécifique et insère les objets parsés.

### Phase 2 : Le Mode Universel (Fallback ZIP)

- **Objectif :** Permettre le téléchargement et le chargement manuel, assurant ainsi la compatibilité avec Firefox,
  Safari et Mobiles.
- **Tâches :**
    - Ajouter la dépendance fflate au package.json.
    - Dans DatabaseExportImportUtils.js, écrire exportDBToZip(). Cette fonction appellera les fonctions de la Phase 1
      pour chaque store, ajoutera les chaînes au zip, et générera le Blob final.
    - Écrire importZipToDB(blob). Cette fonction décompressera le blob, lira chaque fichier JSON et appellera les
      fonctions d'importation de la Phase 1.
    - Créer l'ébauche de DatabaseSyncManager.js avec les méthodes downloadZipBackup() et processZipUpload(fileObject).

### Phase 3 : L'Interface Utilisateur Basique

- **Fichier cible :** src/components/Settings/LocalDbSettings.jsx.
- **Objectif :** Connecter la mécanique de la Phase 2 à des boutons cliquables.
- **Tâches :**
    - Créer la structure UI de la page des paramètres.
    - Câbler le bouton d'exportation.
    - Créer un composant d'import de fichier, le lier à un beau bouton, et envoyer le fichier sélectionné au Manager.
    - Câbler le bouton de réinitialisation avec une modale de confirmation.
    - Ajouter les Toasts de réussite/erreur.

### Phase 4 : Le Mode Avancé (File System Access API & Debounce)

- **Objectif :** La magie de la synchronisation continue pour Chrome Desktop.
- **Tâches :**
    - Dans DatabaseSyncManager.js, implémenter linkPersistentDirectory(). Appeler showDirectoryPicker(), et sauvegarder
      le DirectoryHandle retourné dans un store spécial d'IndexedDB (ex: un store system_settings).
    - Implémenter le mécanisme de **Debounce**. Créer une classe ou une fonction utilitaire gérant le minuteur.
    - Modifier src/core/db/LocalDB.js. C'est l'étape la plus délicate. Il faut 'patcher' ou écouter les méthodes put(),
      set(), update(), et delete(). À chaque appel, notifier le DatabaseSyncManager en lui passant le nom de la table
      modifiée.
    - Dans le DatabaseSyncManager, lorsque le minuteur du Debounce expire, récupérer le DirectoryHandle, générer le JSON
      de la table spécifique qui a été notifiée, et écraser le fichier correspondant de manière asynchrone (
      requestPermission(), createWritable(), write(), close()).

### Phase 5 : Séquence de Démarrage (Boot) et Finitions UI

- **Objectif :** Faire en sorte que l'application charge les fichiers du dossier lié au lieu des données internes d'
  IndexedDB, et finaliser l'interface.
- **Tâches :**
    - Dans le manager, écrire bootFromDirectoryIfNeeded(). Cette fonction doit chercher le Handle sauvegardé. S'il
      existe, elle demande la permission de lecture silencieuse (verifyPermission()). Si accordé, elle lit les fichiers
      du dossier et met à jour IndexedDB **avant** que les composants React de l'application ne soient montés.
    - Intégrer cet appel de 'boot' au tout début du cycle de vie de l'application (probablement dans src/main.jsx ou le
      context principal).
    - Retourner dans LocalDbSettings.jsx pour ajouter la 'Zone 3' (les boutons lier/délier) avec une condition if ('
      showDirectoryPicker' in window). Gérer l'état affiché ('Synchronisation continue active avec le dossier XYZ').
