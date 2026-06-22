# SYNC Guide

This document explains the local database sync work that is already in place in LGS1920 Studio.

## What Is Already Implemented

The application now has a first working layer for local database export/import:

- a shared `DatabaseSyncManager`
- ZIP export of the local IndexedDB data
- ZIP import back into the local databases
- a user-facing settings section split into `Sync My Profile` and `Import/Export`
- bootstrap wiring so the sync manager is available from the global app context
- persistent folder linking when the browser supports `window.showDirectoryPicker`
- debounced background flushes to the linked folder after local database mutations

The work is intentionally local-first. No remote backend is involved.

## Where To Find It In The UI

Open the Settings drawer, then the profile section.
You can also jump there with `Alt+Shift+U`, which opens the settings drawer on the profile tab.
The profile tab in the drawer shows the same shortcut in its tooltip.

There is now a `Local Database` block with:

- `Sync My Profile`
- `Profile Reset`
- `Export Profile`
- `Import Profile`
- `Reset local databases`
- `Link sync folder`
- `Unlink sync folder`

When the browser supports the File System Access API, the sync section shows the current folder state inline.
The linked folder name is shown, but the absolute filesystem path is not exposed by the browser.
The import/export block starts with an info callout: `Export or import your user profile.`

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
- the local databases are cleared store by store
- the JSON payload is imported back into IndexedDB
- the app reloads after the import completes

Use this to restore a project or move data to another browser/device.

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
- the folder content is imported into IndexedDB
- future database mutations are written back to that folder after a debounce delay
- the inline status switches to the linked state and shows the folder name
- removed journeys are removed from the linked folder on the next sync flush

### Unlink A Sync Folder

Click `Unlink sync folder`.

What happens:

- the stored folder handle is removed from the sync-state database
- the debounce timer is cleared
- future writes stop targeting the linked folder
- the inline status returns to the non-synced state

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

It is also attached to the global app context so it can be reached from `lgs.databaseSyncManager` and `__.ui.databaseSyncManager`.

The manager persists the folder handle in a small dedicated sync-state database so application settings cleanup does not wipe the linked folder state.

### Bootstrap Wiring

The sync manager is created when the application database layer is initialized.

That means the manager is available early in the app lifecycle, without waiting for the Settings drawer to open.
If a persistent folder is already linked, the manager restores it during bootstrap before the rest of the UI starts and reconciles the linked folder from the current local databases.

## Data Scope

The current export/import flow targets the existing LocalDB instances used by the app:

- `lgs1920`
- `settings`
- `vault`

Each store inside those databases is serialized separately.
The `journeys` store is special-cased: every journey becomes a dedicated file in `journeys/<journey-slug>.json`.
The export code now also emits folder-ready JSON files, so the same serializer can feed both ZIP backups and linked-folder sync.

## What Is Not Done Yet

The advanced sync layer is still not complete in the long-term sense.

What exists now:

- folder linking
- handle persistence
- bootstrap restore
- mutation observation
- debounce flush to a linked directory
- separate `Sync My Profile` and `Import/Export` settings sections
- a compact sync status row with link and unlink actions

What is still missing from the full roadmap:

- a dedicated settings screen for the advanced sync path
- a visible status/history UI for sync operations
- finer-grained conflict handling if the linked files change outside the app
- explicit tests around File System Access behavior in browsers
- a native absolute filesystem path display, which browsers do not expose for linked folders

## Practical Notes

- The import flow expects an archive that matches the app structure.
- After import and reset, the app reloads to rebuild runtime state from the databases.
- The sync manager is local only; it does not send data to any external service.
- Folder sync only works when the browser exposes `window.showDirectoryPicker`.
- The linked folder is meant for desktop Chromium browsers with File System Access API support.
- Backups are structured as `database/<store>/...`, with `database/lgs1920/journeys/<journey-slug>.json` for journeys.
