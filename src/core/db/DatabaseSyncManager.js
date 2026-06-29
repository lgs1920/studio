/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DatabaseSyncManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-21
 * Last modified: 2026-06-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    exportDatabaseBundleToFiles,
    exportDatabaseBundleToZip,
    importDatabaseBundleFromZip,
    importJsonToStore,
    importRecordsToStore,
} from './DatabaseExportImportUtils'
import { openDB } from 'idb'

const DIRECTORY_HANDLE_KEY = 'database-sync.directory-handle'
const SYNC_CLIENT_ID_KEY = 'database-sync.client-id'
const SYNC_DEBOUNCE_DELAY = 2000
const SYNC_INTERNAL_FOLDER = '.lgs-sync'
const SYNC_MANIFEST_PATH = '.lgs-sync/manifest.json'
const SYNC_MANIFEST_SIGNATURE_KEY = 'database-sync.manifest-signature'
const SYNC_STATUS_KEY = 'database-sync.status'
const SYNC_STATE_DB_NAME = 'lgs1920-sync-state'
const SYNC_STATE_STORE = 'state'

export const DATABASE_SYNC_STATUS = Object.freeze({
    CONFLICT:          'conflict',
    ERROR:             'error',
    IDLE:              'idle',
    PENDING:           'pending',
    PERMISSION_DENIED: 'permission-denied',
    SYNCED:            'synced',
})

const DEFAULT_SYNC_STATE = Object.freeze({
    directoryName:              null,
    hasPersistentDirectory:     false,
    lastSyncedAt:               null,
    message:                    'No synchronization yet.',
    status:                     DATABASE_SYNC_STATUS.IDLE,
    supportsPersistentSync:     false,
    synchronized:               false,
    synchronizationRequired:    false,
    updatedAt:                  null,
})

const isLocalDatabase = value =>
    value
    && typeof value.keys === 'function'
    && typeof value.get === 'function'
    && typeof value.put === 'function'
    && typeof value.clear === 'function'
    && typeof value.subscribeMutations === 'function'

const isDirectoryHandle = value =>
    value
    && typeof value.getDirectoryHandle === 'function'
    && typeof value.getFileHandle === 'function'
    && typeof value.entries === 'function'

const isHandlePermissionGranted = async handle => {
    if (!handle || typeof handle.queryPermission !== 'function') {
        return false
    }

    const queryOptions = {mode: 'readwrite'}
    const currentPermission = await handle.queryPermission(queryOptions)
    if (currentPermission === 'granted') {
        return true
    }

    if (typeof handle.requestPermission === 'function') {
        return await handle.requestPermission(queryOptions) === 'granted'
    }

    return false
}

const normalizeDBEntries = databases => {
    if (!databases) {
        return []
    }

    if (Array.isArray(databases)) {
        return databases.map(entry => Array.isArray(entry)
                                      ? entry
                                      : [entry?.name ?? entry?.dbName ?? 'database', entry]).filter(([, db]) => isLocalDatabase(db))
    }

    if (databases instanceof Map) {
        return Array.from(databases.entries()).filter(([, db]) => isLocalDatabase(db))
    }

    return Object.entries(databases).filter(([, db]) => isLocalDatabase(db))
}

const readFileHandleToString = async fileHandle => {
    const file = await fileHandle.getFile()
    return await file.text()
}

const encodeJson = value => new TextEncoder().encode(JSON.stringify(value, null, 2))

const checksumBytes = bytes => {
    let hash = 2166136261

    for (const byte of bytes) {
        hash ^= byte
        hash = Math.imul(hash, 16777619) >>> 0
    }

    return hash.toString(16).padStart(8, '0')
}

const buildManifestSignature = manifest => JSON.stringify({
    files:   manifest?.files ?? {},
    version: manifest?.version ?? 1,
})

const createClientId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isStaleDirectoryHandleError = error => {
    const message = String(error?.message ?? '')
    return error?.name === 'InvalidStateError'
        || /read from disk/i.test(message)
        || /interface object/i.test(message)
        || /state had changed/i.test(message)
}

export class DatabaseSyncManager {
    #databases = null
    #directoryHandle = null
    #syncTimer = null
    #mutationSubscriptions = new Map()
    #isSuspended = 0
    #bootstrapDone = false
    #stateDb = null
    #syncState = {...DEFAULT_SYNC_STATE}
    #syncStatusListeners = new Set()
    #startupWarning = null

    constructor(databases = null) {
        this.#databases = databases
    }

    /**
     * Update the database collection used by the sync manager.
     *
     * @param {Object|Map|Array} databases - LocalDB collection.
     */
    setDatabases = databases => {
        this.#databases = databases
    }

    /**
     * Return the current synchronization state.
     *
     * @return {Object}
     */
    get syncState() {
        return this.#syncState
    }

    /**
     * Return the startup warning emitted by the last bootstrap, if any.
     *
     * @return {Object|null}
     */
    get startupWarning() {
        return this.#startupWarning
    }

    /**
     * Subscribe to synchronization state changes.
     *
     * @param {Function} listener - Change listener.
     * @return {Function}
     */
    subscribeSyncStatus = listener => {
        if (typeof listener !== 'function') {
            return () => undefined
        }

        this.#syncStatusListeners.add(listener)
        listener(this.syncState)

        return () => {
            this.#syncStatusListeners.delete(listener)
        }
    }

    /**
     * Returns true when folder synchronization can run in this browser.
     *
     * @return {boolean}
     */
    supportsPersistentDirectory = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'

    /**
     * Bootstrap the sync manager.
     *
     * The method restores the linked folder handle if it exists, loads its
     * content into IndexedDB, and starts watching local mutations.
     *
     * @return {Promise<boolean>}
     */
    bootstrap = async () => {
        if (this.#bootstrapDone) {
            return
        }

        this.#bootstrapDone = true
        this.#startupWarning = null
        await this.#restorePersistedSyncState()
        this.#installMutationWatchers()

        if (!this.supportsPersistentDirectory()) {
            this.#setSyncState({
                                   message: 'This browser only supports manual profile backup.',
                                   status:  DATABASE_SYNC_STATUS.IDLE,
                               })
            return
        }

        const handle = await this.#readPersistedDirectoryHandle()
        if (!handle) {
            this.#setSyncState({
                                   directoryName: null,
                                   message:       'No synchronization yet.',
                                   status:        DATABASE_SYNC_STATUS.IDLE,
                               })
            return
        }

        this.#directoryHandle = handle
        try {
            this.#setSyncState({
                                   directoryName: handle.name ?? null,
                                   lastSyncedAt:  this.#syncState.lastSyncedAt,
                                   message:       this.#syncState.status === DATABASE_SYNC_STATUS.SYNCED
                                                  ? this.#syncState.message
                                                  : 'Checking profile synchronization.',
                                   status:        this.#syncState.status === DATABASE_SYNC_STATUS.SYNCED
                                                  ? DATABASE_SYNC_STATUS.SYNCED
                                                  : DATABASE_SYNC_STATUS.PENDING,
                               })

            if (await isHandlePermissionGranted(handle)) {
                await this.#withSuspendedSync(async () => {
                    await this.#importFromLinkedDirectory(handle, {clearBeforeImport: true})
                    await this.flushToPersistentDirectory({force: true, showPending: false})
                })
            }
            else {
                this.#setSyncState({
                                       message: 'Folder permission is required to synchronize your profile.',
                                       status:  DATABASE_SYNC_STATUS.PERMISSION_DENIED,
                                   })
            }
        }
        catch (error) {
            if (isStaleDirectoryHandleError(error)) {
                console.warn('[DatabaseSyncManager] Linked directory handle is stale, unlinking it:', error)
                await this.unlinkPersistentDirectory()
                this.#startupWarning = {
                    caption: 'Profile synchronization',
                    text:    'The linked profile folder is no longer available and was disconnected.',
                }
                return
            }

            console.warn('[DatabaseSyncManager] Bootstrap sync failed:', error)
        }

        this.#startupWarning = this.#createStartupWarning()
    }

    /**
     * Link a local folder for persistent synchronization.
     *
     * @return {Promise<FileSystemDirectoryHandle>}
     */
    linkPersistentDirectory = async () => {
        if (!this.supportsPersistentDirectory()) {
            throw new Error('Persistent directory synchronization is not supported in this browser.')
        }

        const handle = await window.showDirectoryPicker({mode: 'readwrite'})
        await this.#storePersistedDirectoryHandle(handle)
        this.#directoryHandle = handle
        this.#setSyncState({
                               directoryName: handle.name ?? null,
                               message:       'Importing linked profile data.',
                               status:        DATABASE_SYNC_STATUS.PENDING,
                           })

        await this.#withSuspendedSync(async () => {
            await this.#importFromLinkedDirectory(handle, {clearBeforeImport: true})
            await this.flushToPersistentDirectory({force: true, showPending: false})
        })

        this.#installMutationWatchers()
        return handle
    }

    /**
     * Unlink the current persistent directory and stop syncing to it.
     *
     * @return {Promise<void>}
     */
    unlinkPersistentDirectory = async () => {
        this.#directoryHandle = null
        this.#clearSyncTimer()
        await this.#removePersistedDirectoryHandle()
        await this.#removePersistedManifestSignature()
        this.#setSyncState({
                               directoryName: null,
                               lastSyncedAt:  null,
                               message:       'No synchronization yet.',
                               status:        DATABASE_SYNC_STATUS.IDLE,
                           })
    }

    /**
     * Return the currently linked directory handle, if any.
     *
     * @return {FileSystemDirectoryHandle|null}
     */
    get directoryHandle() {
        return this.#directoryHandle
    }

    /**
     * Return whether folder synchronization is active.
     *
     * @return {boolean}
     */
    get hasPersistentDirectory() {
        return this.#directoryHandle !== null
    }

    /**
     * Export the current databases as a ZIP archive.
     *
     * @param {Object|Map|Array|null} databases - Optional database collection.
     * @param {Object} options - Export options.
     * @return {Promise<Uint8Array>}
     */
    exportZipBackup = async (databases = null, options = {}) => {
        return exportDatabaseBundleToZip(databases ?? this.#databases, options)
    }

    /**
     * Import a ZIP archive into the current databases.
     *
     * @param {Blob|Uint8Array|ArrayBuffer} archive - ZIP archive content.
     * @param {Object|Map|Array|null} databases - Optional database collection.
     * @param {Object} options - Import options.
     * @return {Promise<void>}
     */
    importZipBackup = async (archive, databases = null, options = {}) => {
        return importDatabaseBundleFromZip(databases ?? this.#databases, archive, options)
    }

    /**
     * Download a ZIP backup in the browser.
     *
     * @param {string} fileName - Name of the downloaded archive.
     * @param {Object} options - Export options.
     * @return {Promise<void>}
     */
    downloadZipBackup = async (fileName = 'lgs1920-backup.zip', options = {}) => {
        const archive = await this.exportZipBackup(null, options)
        const blob = new Blob([archive], {type: 'application/zip'})
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(link.href), 0)
    }

    /**
     * Import a ZIP file selected by the user.
     *
     * @param {File|Blob|Uint8Array|ArrayBuffer} fileObject - Archive input.
     * @param {Object} options - Import options.
     * @return {Promise<void>}
     */
    processZipUpload = async (fileObject, options = {}) => {
        if (!fileObject) {
            throw new Error('No file provided.')
        }
        return this.importZipBackup(fileObject, null, options)
    }

    /**
     * Flush the current databases to the linked directory if one is active.
     *
     * @return {Promise<void>}
     */
    flushToPersistentDirectory = async ({force = false, showPending = true} = {}) => {
        if (!this.#directoryHandle) {
            this.#setSyncState({
                                   directoryName: null,
                                   message:       'No synchronization yet.',
                                   status:        DATABASE_SYNC_STATUS.IDLE,
                               })
            return false
        }

        if (!(await isHandlePermissionGranted(this.#directoryHandle))) {
            this.#setSyncState({
                                   message: 'Folder permission is required to synchronize your profile.',
                                   status:  DATABASE_SYNC_STATUS.PERMISSION_DENIED,
                               })
            return false
        }

        if (showPending) {
            this.#setSyncState({
                                   directoryName: this.#directoryHandle.name ?? null,
                                   message:       'Synchronizing profile data.',
                                   status:        DATABASE_SYNC_STATUS.PENDING,
                               })
        }

        try {
            const files = await exportDatabaseBundleToFiles(this.#databases)
            const manifest = await this.#buildManifest(files)
            const manifestSignature = buildManifestSignature(manifest)

            if (!force && await this.#linkedManifestChanged(manifestSignature)) {
                this.#setSyncState({
                                       message: 'The linked profile folder changed outside this browser.',
                                       status:  DATABASE_SYNC_STATUS.CONFLICT,
                                   })
                return false
            }

            const filesWithManifest = {
                ...files,
                [SYNC_MANIFEST_PATH]: encodeJson(manifest),
            }

            const staleRemovalFailures = await this.#removeStaleFiles(this.#directoryHandle, filesWithManifest)
            await this.#writeFilesToDirectory(this.#directoryHandle, filesWithManifest)

            if (staleRemovalFailures.length > 0) {
                this.#setSyncState({
                                       message: `Some stale synchronized files could not be removed: ${staleRemovalFailures.join(', ')}`,
                                       status:  DATABASE_SYNC_STATUS.ERROR,
                                   })
                return false
            }

            await this.#storePersistedManifestSignature(manifestSignature)

            this.#setSyncState({
                                   lastSyncedAt: manifest.writtenAt,
                                   message:      'The synchronization is active.',
                                   status:       DATABASE_SYNC_STATUS.SYNCED,
                               })
            return true
        }
        catch (error) {
            if (isStaleDirectoryHandleError(error)) {
                console.warn('[DatabaseSyncManager] Linked directory handle is stale during flush, unlinking it:', error)
                await this.unlinkPersistentDirectory()
                return false
            }

            this.#setSyncState({
                                   message: error?.message ?? 'Profile synchronization failed.',
                                   status:  DATABASE_SYNC_STATUS.ERROR,
                               })
            throw error
        }
    }

    /**
     * Force a rewrite of the linked directory from current local data.
     *
     * @return {Promise<boolean>}
     */
    overwritePersistentDirectory = async () => {
        return this.flushToPersistentDirectory({force: true, showPending: true})
    }

    /**
     * Read the persisted directory handle from the settings database.
     *
     * @return {Promise<FileSystemDirectoryHandle|null>}
     */
    #readPersistedDirectoryHandle = async () => {
        try {
            const stateDb = await this.#getStateDb()
            const handle = await stateDb.get(SYNC_STATE_STORE, DIRECTORY_HANDLE_KEY)
            return isDirectoryHandle(handle) ? handle : null
        }
        catch (error) {
            console.warn('[DatabaseSyncManager] Failed to read directory handle:', error)
            return null
        }
    }

    /**
     * Persist the current directory handle in the settings database.
     *
     * @param {FileSystemDirectoryHandle} handle - Directory handle.
     * @return {Promise<void>}
     */
    #storePersistedDirectoryHandle = async handle => {
        const stateDb = await this.#getStateDb()
        await stateDb.put(SYNC_STATE_STORE, handle, DIRECTORY_HANDLE_KEY)
    }

    /**
     * Remove the persisted directory handle from the settings database.
     *
     * @return {Promise<void>}
     */
    #removePersistedDirectoryHandle = async () => {
        try {
            const stateDb = await this.#getStateDb()
            await stateDb.delete(SYNC_STATE_STORE, DIRECTORY_HANDLE_KEY)
        }
        catch (error) {
            console.warn('[DatabaseSyncManager] Failed to delete persisted directory handle:', error)
        }
    }

    /**
     * Restore the last persisted synchronization state.
     *
     * @return {Promise<void>}
     */
    #restorePersistedSyncState = async () => {
        try {
            const stateDb = await this.#getStateDb()
            const syncState = await stateDb.get(SYNC_STATE_STORE, SYNC_STATUS_KEY)
            if (syncState && typeof syncState === 'object' && typeof syncState.status === 'string') {
                this.#syncState = {
                    ...DEFAULT_SYNC_STATE,
                    ...syncState,
                }
                this.#notifySyncStatusListeners()
            }
        }
        catch (error) {
            console.warn('[DatabaseSyncManager] Failed to restore sync state:', error)
        }
    }

    /**
     * Persist the current synchronization state.
     *
     * @return {Promise<void>}
     */
    #storePersistedSyncState = async () => {
        try {
            const stateDb = await this.#getStateDb()
            await stateDb.put(SYNC_STATE_STORE, this.#syncState, SYNC_STATUS_KEY)
        }
        catch (error) {
            console.warn('[DatabaseSyncManager] Failed to persist sync state:', error)
        }
    }

    /**
     * Return the stable client id used in sync manifests.
     *
     * @return {Promise<string>}
     */
    #getClientId = async () => {
        const stateDb = await this.#getStateDb()
        const existingClientId = await stateDb.get(SYNC_STATE_STORE, SYNC_CLIENT_ID_KEY)
        if (typeof existingClientId === 'string' && existingClientId.length > 0) {
            return existingClientId
        }

        const clientId = createClientId()
        await stateDb.put(SYNC_STATE_STORE, clientId, SYNC_CLIENT_ID_KEY)
        return clientId
    }

    /**
     * Read the last synced manifest signature.
     *
     * @return {Promise<string|null>}
     */
    #readPersistedManifestSignature = async () => {
        try {
            const stateDb = await this.#getStateDb()
            const signature = await stateDb.get(SYNC_STATE_STORE, SYNC_MANIFEST_SIGNATURE_KEY)
            return typeof signature === 'string' ? signature : null
        }
        catch (error) {
            console.warn('[DatabaseSyncManager] Failed to read sync manifest signature:', error)
            return null
        }
    }

    /**
     * Persist the last synced manifest signature.
     *
     * @param {string} signature - Manifest signature.
     * @return {Promise<void>}
     */
    #storePersistedManifestSignature = async signature => {
        try {
            const stateDb = await this.#getStateDb()
            await stateDb.put(SYNC_STATE_STORE, signature, SYNC_MANIFEST_SIGNATURE_KEY)
        }
        catch (error) {
            console.warn('[DatabaseSyncManager] Failed to persist sync manifest signature:', error)
        }
    }

    /**
     * Remove the stored manifest signature.
     *
     * @return {Promise<void>}
     */
    #removePersistedManifestSignature = async () => {
        try {
            const stateDb = await this.#getStateDb()
            await stateDb.delete(SYNC_STATE_STORE, SYNC_MANIFEST_SIGNATURE_KEY)
        }
        catch (error) {
            console.warn('[DatabaseSyncManager] Failed to delete sync manifest signature:', error)
        }
    }

    /**
     * Build a sync manifest from exported files.
     *
     * @param {Object<string, Uint8Array>} files - Exported files.
     * @return {Promise<Object>}
     */
    #buildManifest = async files => {
        const fileEntries = Object.entries(files)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([path, bytes]) => [
                path,
                {
                    checksum: checksumBytes(bytes),
                    size:     bytes.byteLength ?? bytes.length ?? 0,
                },
            ])

        return {
            clientId:  await this.#getClientId(),
            files:     Object.fromEntries(fileEntries),
            version:   1,
            writtenAt: new Date().toISOString(),
        }
    }

    /**
     * Return true when the linked folder manifest no longer matches the last known one.
     *
     * @param {string} nextManifestSignature - Signature that will be written if sync proceeds.
     * @return {Promise<boolean>}
     */
    #linkedManifestChanged = async nextManifestSignature => {
        const linkedManifest = await this.#readLinkedManifest()
        if (!linkedManifest) {
            return false
        }

        const linkedSignature = buildManifestSignature(linkedManifest)
        const currentClientId = await this.#getClientId()

        if (!linkedManifest.clientId || linkedManifest.clientId === currentClientId) {
            await this.#storePersistedManifestSignature(linkedSignature)
            return false
        }

        const lastSignature = await this.#readPersistedManifestSignature()

        if (!lastSignature) {
            return false
        }

        const linkedManifestTime = Date.parse(linkedManifest.writtenAt)
        const lastSyncedTime = Date.parse(this.#syncState.lastSyncedAt)

        if (!Number.isFinite(linkedManifestTime) || !Number.isFinite(lastSyncedTime) || linkedManifestTime <= lastSyncedTime) {
            await this.#storePersistedManifestSignature(linkedSignature)
            return false
        }

        return linkedSignature !== lastSignature && linkedSignature !== nextManifestSignature
    }

    /**
     * Read the linked folder manifest, if present.
     *
     * @return {Promise<Object|null>}
     */
    #readLinkedManifest = async () => {
        try {
            const [directoryName, fileName] = SYNC_MANIFEST_PATH.split('/')
            const manifestDirectory = await this.#directoryHandle.getDirectoryHandle(directoryName)
            const manifestHandle = await manifestDirectory.getFileHandle(fileName)
            return JSON.parse(await readFileHandleToString(manifestHandle))
        }
        catch {
            return null
        }
    }

    /**
     * Import the linked directory content into the current databases.
     *
     * @param {FileSystemDirectoryHandle} rootHandle - Linked directory handle.
     * @param {Object} options - Import options.
     * @param {boolean} options.clearBeforeImport - Clear local stores before importing folder files.
     * @return {Promise<void>}
     */
    #importFromLinkedDirectory = async (rootHandle, {clearBeforeImport = false} = {}) => {
        if (!isDirectoryHandle(rootHandle)) {
            return
        }

        const folderFiles = await this.#collectJsonFiles(rootHandle)
        const dbEntries = normalizeDBEntries(this.#databases)

        for (const [scopeName, db] of dbEntries) {
            const prefix = `${scopeName}/`
            const relatedFiles = Array.from(folderFiles.entries()).filter(([path]) => path.startsWith(prefix))
            let journeysImported = false

            if (clearBeforeImport) {
                for (const store of db.storeNames ?? []) {
                    await db.clear(store)
                }
            }

            for (const [path, fileHandle] of relatedFiles) {
                if (!path.endsWith('.json')) {
                    continue
                }

                const json = await readFileHandleToString(fileHandle)
                const relative = path.slice(prefix.length)

                if (relative.startsWith('journeys/') && relative.endsWith('.json')) {
                    const journeySlug = relative.slice('journeys/'.length, -5)
                    const payload = JSON.parse(json)
                    await importRecordsToStore(db, 'journeys', [{
                        key:   journeySlug,
                        value: payload.value ?? payload.records?.[0]?.value ?? null,
                        meta:  payload.meta ?? payload.records?.[0]?.meta ?? null,
                    }], {clear: clearBeforeImport ? false : !journeysImported})
                    journeysImported = true
                    continue
                }

                const store = relative.slice(0, -5)
                await importJsonToStore(db, store, json, {clear: !clearBeforeImport})
            }
        }
    }

    /**
     * Recursively collect JSON file handles from a directory tree.
     *
     * @param {FileSystemDirectoryHandle} directoryHandle - Root directory.
     * @param {string} [prefix] - Relative path prefix.
     * @param {Map<string, FileSystemFileHandle>} [files] - Accumulator.
     * @return {Promise<Map<string, FileSystemFileHandle>>}
     */
    #collectJsonFiles = async (directoryHandle, prefix = '', files = new Map()) => {
        for await (const [name, entry] of directoryHandle.entries()) {
            const path = prefix ? `${prefix}/${name}` : name
            if (entry.kind === 'file' && name.endsWith('.json')) {
                files.set(path, entry)
            }
            else if (entry.kind === 'directory') {
                await this.#collectJsonFiles(entry, path, files)
            }
        }

        return files
    }

    /**
     * Write the exported database files to the linked directory.
     *
     * @param {FileSystemDirectoryHandle} rootHandle - Root directory.
     * @param {Object<string, Uint8Array>} files - Files to write.
     * @return {Promise<void>}
     */
    #writeFilesToDirectory = async (rootHandle, files) => {
        for (const [path, bytes] of Object.entries(files)) {
            const segments = path.split('/').filter(Boolean)
            const fileName = segments.pop()
            let directoryHandle = rootHandle

            for (const segment of segments) {
                directoryHandle = await directoryHandle.getDirectoryHandle(segment, {create: true})
            }

            const fileHandle = await directoryHandle.getFileHandle(fileName, {create: true})
            const writable = await fileHandle.createWritable()
            await writable.write(new Blob([bytes], {type: 'application/json'}))
            await writable.close()
        }
    }

    /**
     * Remove stale files from the linked directory before rewriting the export.
     *
     * The cleanup is intentionally scoped to synchronization roots. The user
     * can choose an existing folder, so unrelated files in that folder must not
     * be touched.
     *
     * @param {FileSystemDirectoryHandle} rootHandle - Root directory.
     * @param {Object<string, Uint8Array>} files - Files that must remain present.
     * @return {Promise<string[]>}
     */
    #removeStaleFiles = async (rootHandle, files) => {
        const expectedPaths = new Set(Object.keys(files))
        const managedRoots = new Set(
            Object.keys(files)
                .map(path => path.split('/').filter(Boolean)[0])
                .filter(Boolean),
        )
        const failedPaths = []

        const removeStaleFile = async (directoryHandle, name, path) => {
            if (expectedPaths.has(path) || !path.endsWith('.json')) {
                return
            }

            try {
                await directoryHandle.removeEntry(name)
            }
            catch (error) {
                console.warn('[DatabaseSyncManager] Failed to remove stale synchronized file:', path, error)
                failedPaths.push(path)
            }
        }

        const walk = async (directoryHandle, prefix = '') => {
            for await (const [name, entry] of directoryHandle.entries()) {
                const path = prefix ? `${prefix}/${name}` : name

                if (entry.kind === 'file') {
                    await removeStaleFile(directoryHandle, name, path)
                    continue
                }

                if (entry.kind === 'directory') {
                    await walk(entry, path)
                }
            }
        }

        for (const rootName of managedRoots) {
            if (rootName === SYNC_INTERNAL_FOLDER) {
                continue
            }

            try {
                const managedRoot = await rootHandle.getDirectoryHandle(rootName)
                await walk(managedRoot, rootName)
            }
            catch {
                // The folder will be created later when current files are written.
            }
        }

        return failedPaths
    }

    /**
     * Install mutation subscriptions on all supported databases.
     */
    #installMutationWatchers = () => {
        const dbEntries = normalizeDBEntries(this.#databases)

        for (const [scopeName, db] of dbEntries) {
            if (this.#mutationSubscriptions.has(scopeName)) {
                continue
            }

            const unsubscribe = db.subscribeMutations(() => {
                this.#scheduleFlush()
            })

            this.#mutationSubscriptions.set(scopeName, unsubscribe)
        }
    }

    /**
     * Schedule a debounced flush to the persistent directory.
     */
    #scheduleFlush = () => {
        if (!this.#directoryHandle || this.#isSuspended > 0) {
            return
        }

        if ([
            DATABASE_SYNC_STATUS.CONFLICT,
            DATABASE_SYNC_STATUS.ERROR,
            DATABASE_SYNC_STATUS.PERMISSION_DENIED,
        ].includes(this.#syncState.status)) {
            return
        }

        this.#clearSyncTimer()
        this.#syncTimer = window.setTimeout(() => {
            void this.flushToPersistentDirectory({showPending: false}).catch(error => {
                console.warn('[DatabaseSyncManager] Persistent sync failed:', error)
            })
        }, SYNC_DEBOUNCE_DELAY)
    }

    /**
     * Clear the debounce timer.
     */
    #clearSyncTimer = () => {
        if (this.#syncTimer !== null) {
            window.clearTimeout(this.#syncTimer)
            this.#syncTimer = null
        }
    }

    /**
     * Update and broadcast the current synchronization state.
     *
     * @param {Object} update - State patch.
     */
    #setSyncState = update => {
        const status = update.status ?? this.#syncState.status
        const hasDirectoryNameUpdate = Object.prototype.hasOwnProperty.call(update, 'directoryName')
        const lastSyncedAt = status === DATABASE_SYNC_STATUS.SYNCED
                             ? (update.lastSyncedAt ?? new Date().toISOString())
                             : (Object.prototype.hasOwnProperty.call(update, 'lastSyncedAt')
                                ? update.lastSyncedAt
                                : this.#syncState.lastSyncedAt)

        this.#syncState = {
            ...this.#syncState,
            ...update,
            directoryName:           this.#directoryHandle?.name
                                     ?? (hasDirectoryNameUpdate ? update.directoryName : this.#syncState.directoryName)
                                     ?? null,
            hasPersistentDirectory:  this.hasPersistentDirectory,
            lastSyncedAt,
            supportsPersistentSync:  this.supportsPersistentDirectory(),
            synchronized:            status === DATABASE_SYNC_STATUS.SYNCED,
            synchronizationRequired: [
                                         DATABASE_SYNC_STATUS.CONFLICT,
                                         DATABASE_SYNC_STATUS.ERROR,
                                         DATABASE_SYNC_STATUS.PENDING,
                                         DATABASE_SYNC_STATUS.PERMISSION_DENIED,
                                     ].includes(status),
            status,
            updatedAt: new Date().toISOString(),
        }

        this.#notifySyncStatusListeners()
        void this.#storePersistedSyncState()
    }

    /**
     * Notify sync status listeners.
     */
    #notifySyncStatusListeners = () => {
        const syncState = this.syncState
        for (const listener of this.#syncStatusListeners) {
            listener(syncState)
        }
    }

    /**
     * Build the startup warning from the current sync state.
     *
     * @return {Object|null}
     */
    #createStartupWarning = () => {
        const syncState = this.syncState

        if (!syncState.hasPersistentDirectory || !syncState.synchronizationRequired) {
            return null
        }

        if (syncState.status === DATABASE_SYNC_STATUS.CONFLICT) {
            return {
                caption: 'Profile synchronization',
                text:    'The linked profile folder changed outside this browser.',
            }
        }

        if (syncState.status === DATABASE_SYNC_STATUS.PERMISSION_DENIED) {
            return {
                caption: 'Profile synchronization',
                text:    'Folder permission is required to synchronize your profile.',
            }
        }

        if (syncState.status === DATABASE_SYNC_STATUS.ERROR) {
            return {
                caption: 'Profile synchronization',
                text:    syncState.message || 'Profile synchronization failed.',
            }
        }

        return {
            caption: 'Profile synchronization',
            text:    'Your profile has local changes that are not synchronized.',
        }
    }

    /**
     * Open the dedicated sync-state database.
     *
     * This database is intentionally separate from the user settings DB so
     * the normal settings cleanup path cannot remove the persisted folder
     * handle during startup.
     *
     * @return {Promise<import('idb').IDBPDatabase>}
     */
    #getStateDb = async () => {
        if (!this.#stateDb) {
            this.#stateDb = openDB(SYNC_STATE_DB_NAME, 1, {
                upgrade: db => {
                    if (!db.objectStoreNames.contains(SYNC_STATE_STORE)) {
                        db.createObjectStore(SYNC_STATE_STORE)
                    }
                },
            })
        }

        return this.#stateDb
    }

    /**
     * Execute a task while suppressing sync emission.
     *
     * @param {Function} task - Suspended task.
     * @return {Promise<void>}
     */
    #withSuspendedSync = async task => {
        this.#isSuspended += 1
        this.#clearSyncTimer()

        try {
            await task()
        }
        finally {
            this.#isSuspended = Math.max(0, this.#isSuspended - 1)
        }
    }
}
