# SYNC Guide

This document explains the local database sync work that is already in place in LGS1920 Studio.

For the database schema, complete JavaScript API, file formats, conflict rules, and implementation constraints, read the [internal database architecture](current/src/core/db/INTERNAL_DATABASE_ARCHITECTURE.md).

## What Is Already Implemented

The application now has a first working layer for local database export/import:

- a shared `DatabaseSyncManager`
- ZIP export of the local IndexedDB data
- ZIP import back into the local databases
- a user-facing settings section split into `Sync My Profile` and `Import/Export`
- bootstrap wiring so the sync manager is available from the global app context
- persistent folder linking when the browser supports `window.showDirectoryPicker`
- debounced background flushes to the linked folder after local database mutations
- observable sync status: `idle`, `synced`, `pending`, `error`, `conflict`, `permission-denied`
- startup warnings when linked profile data is not synchronized
- a `.lgs-sync/manifest.json` file used to detect folder changes made outside the current browser
- background flushes keep the visible status stable unless an error or a real conflict occurs

The work is intentionally local-first. No remote backend is involved.

## Source Of Truth Rules

The sync flow follows two source-of-truth rules:

- at normal startup, the linked folder wins and its content is imported into IndexedDB
- when the user explicitly links a folder, the linked folder also wins and its content is imported into IndexedDB

After importing the folder, the app writes a fresh manifest so the local browser state and linked folder are aligned.
If another client writes to the folder while the app is already open, a later local flush reports a conflict instead of overwriting automatically.

## Where To Find It In The UI

Open the Settings drawer, then the profile section.
You can also jump there with `Alt+Shift+U`, which opens the settings drawer on the profile tab.
The profile tab in the drawer shows the same shortcut in its tooltip.

The profile tools include:

- `Sync Profile`
- `Profile Reset`
- `Import/Export`

The sync action changes between `Activate`, `Deactivate`, `Retry`, and `Resolve` according to the current state. The import/export section exposes `Export` and `Import`.

When the browser supports the File System Access API, the sync section shows the current folder state inline.
The linked folder name is shown, but the absolute filesystem path is not exposed by the browser.
The import/export block starts with an info callout: `Export or import your user profile.`
The `Sync Profile` icon is green when the linked folder is synchronized and red when synchronization needs attention.

## How To Use It

### Export A Backup

Click `Export Profile`.

What happens:

- the app reads the current local databases
- each store is serialized as JSON
- each journey is exported in its own file as `journeys/<journey-slug>.json`
- the files are packed into a ZIP archive
- the browser downloads the archive as `lgs1920-backup.zip`

Use this when you want to keep a portable snapshot of the current project state.
The import/export actions are shown as two right-aligned outlined brand buttons.

### Import A Backup

Click `Import Profile`.

What happens:

- the archive is read in the browser
- each store represented by a file in the archive is cleared before its records are restored
- the JSON payload is imported back into IndexedDB
- the app reloads after the import completes

Use this to restore a project or move data to another browser/device.
The restore is sequential rather than transactional. A missing store file leaves that local store unchanged, and an archive with no journey files does not clear existing journeys.

### Reset Local Databases

Click `Reset local databases`.

What happens:

- a confirmation dialog is shown
- the local databases `lgs1920`, `settings`, and `vault` are deleted
- if a sync folder is linked, it is unlinked first
- the app reloads

This is the destructive cleanup path. It does not export anything before deletion.

### Link A Sync Folder

Click `Link sync folder` when the browser supports it.

What happens:

- the browser opens a real folder picker
- the selected folder handle is stored in a dedicated sync-state database
- every store in `lgs1920`, `settings`, and `vault` is cleared
- the folder content is imported into IndexedDB
- the linked folder is then rewritten from the imported local state to align the manifest
- future database mutations are written back to that folder after a debounce delay
- the inline status switches to the linked state and shows the folder name
- removed journeys are removed from the linked folder on the next sync flush
- the sync manager writes `.lgs-sync/manifest.json` to remember the file state that was last synchronized

The selected folder is the source of truth. An empty or incomplete folder can erase local data. Create and verify a ZIP backup before linking, and do not use `Activate` as an export-to-folder action.

### Unlink A Sync Folder

Click `Unlink sync folder`.

What happens:

- the stored folder handle is removed from the sync-state database
- the stored manifest signature is removed
- the debounce timer is cleared
- future writes stop targeting the linked folder
- the inline status returns to the non-synced state

### Startup Sync Warnings

At startup, the sync manager restores the linked folder handle and checks whether local data can be synchronized.
When access is granted, the linked folder is imported into IndexedDB first, then the folder manifest is aligned from that imported state.

The app shows a warning toast when a linked profile exists but synchronization needs attention:

- the browser no longer grants access to the linked folder
- the previous or current flush failed
- the linked folder manifest is overwritten by another client while this app instance is already open

The same state is shown in `Sync Profile`.
When synchronization fails, the section exposes a `Retry` action.
When the linked folder changes externally during an active session, the section exposes a `Resolve` action that can overwrite the linked folder from the current local profile after confirmation.

## Technical Shape

The implementation is split into two layers.

### `src/core/db/DatabaseExportImportUtils.js`

This file contains the low-level serialization helpers:

- export one store to JSON
- export one journey to its own JSON file
- import one store from JSON
- export one database to a ZIP archive
- import one database from a ZIP archive
- export a bundle of databases to one ZIP archive
- import a bundle of databases from one ZIP archive

The ZIP work uses `fflate`.

### `src/core/db/DatabaseSyncManager.js`

This is the higher-level facade used by the UI and the bootstrap layer.

It exposes:

- `downloadZipBackup()`
- `processZipUpload(fileObject)`
- `exportZipBackup()`
- `importZipBackup()`
- `linkPersistentDirectory()`
- `unlinkPersistentDirectory()`
- `flushToPersistentDirectory()`
- `overwritePersistentDirectory()`
- `subscribeSyncStatus(listener)`

It is also attached to the global app context so it can be reached from `lgs.databaseSyncManager` and `__.ui.databaseSyncManager`.

The manager persists the folder handle in a small dedicated sync-state database so application settings cleanup does not wipe the linked folder state.
The same database stores the current sync status, the local client id, and the last known manifest signature.

### Bootstrap Wiring

The sync manager is created with the application database layer, without waiting for the Settings drawer to open.
Its bootstrap runs after application settings and provider tokens have already been hydrated, but before journeys, widgets, POIs, and groups are loaded. A linked-folder import therefore feeds the later journey and scene hydration. Settings or vault values changed in the folder may require another reload before their already-created runtime objects use them.

## Data Scope

The current export/import flow targets the existing LocalDB instances used by the app:

- `lgs1920`
- `settings`
- `vault`

Each store inside those databases is serialized separately.
The `journeys` store is special-cased: every journey becomes a dedicated file in `journeys/<journey-slug>.json`.
The export code now also emits folder-ready JSON files, so the same serializer can feed both ZIP backups and linked-folder sync.

`vault` contains provider credentials and is included without encryption. Treat ZIP backups and linked folders as sensitive files.

## What Is Not Done Yet

The advanced sync layer is still not complete in the long-term sense.

What exists now:

- folder linking
- handle persistence
- bootstrap restore
- mutation observation
- debounce flush to a linked directory
- startup warning when linked data needs synchronization
- basic external-change detection through `.lgs-sync/manifest.json`
- silent background flushes that do not flip the settings UI through a temporary pending state
- separate `Sync My Profile` and `Import/Export` settings sections
- a compact sync status row with link and unlink actions

What is still missing from the full roadmap:

- a dedicated settings screen for the advanced sync path
- a visible status/history UI for sync operations
- finer-grained conflict handling if the same journey is changed from multiple browsers
- a write lock to prevent two browsers from writing at the same time
- a durable dirty queue and a flush on page close or reload
- atomic multi-file writes, rollback, and retry backoff
- runtime rehydration of settings and vault after a bootstrap import
- explicit tests around File System Access behavior in browsers
- a native absolute filesystem path display, which browsers do not expose for linked folders

## Practical Notes

- The import flow expects an archive that matches the app structure.
- After import and reset, the app reloads to rebuild runtime state from the databases.
- Do not restore a ZIP while folder sync remains active: the reload can occur before the delayed folder flush, after which the linked folder wins again at startup.
- A local mutation is flushed after a two-second debounce. Closing or reloading before that flush can lose the local change at the next folder-first bootstrap.
- ZIP and folder outputs include unencrypted provider tokens from `vault`.
- The sync manager is local only; it does not send data to any external service.
- Folder sync only works when the browser exposes `window.showDirectoryPicker`.
- The linked folder is meant for desktop Chromium browsers with File System Access API support.
- Backups are structured by local database scope, with `lgs1920/journeys/<journey-slug>.json` for journeys.
