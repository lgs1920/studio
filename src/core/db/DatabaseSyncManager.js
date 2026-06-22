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
const SYNC_DEBOUNCE_DELAY = 2000
const SYNC_STATE_DB_NAME = 'lgs1920-sync-state'
const SYNC_STATE_STORE = 'state'

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

export class DatabaseSyncManager {
    #databases = null
    #directoryHandle = null
    #syncTimer = null
    #mutationSubscriptions = new Map()
    #isSuspended = 0
    #bootstrapDone = false
    #stateDb = null

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
     * @return {Promise<void>}
     */
    bootstrap = async () => {
        if (this.#bootstrapDone) {
            return
        }

        this.#bootstrapDone = true
        this.#installMutationWatchers()

        if (!this.supportsPersistentDirectory()) {
            return
        }

        const handle = await this.#readPersistedDirectoryHandle()
        if (!handle) {
            return
        }

        this.#directoryHandle = handle

        if (await isHandlePermissionGranted(handle)) {
            await this.#withSuspendedSync(async () => {
                await this.flushToPersistentDirectory()
            })
        }
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

        await this.#withSuspendedSync(async () => {
            await this.#importFromLinkedDirectory(handle)
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
    flushToPersistentDirectory = async () => {
        if (!this.#directoryHandle) {
            return
        }

        if (!(await isHandlePermissionGranted(this.#directoryHandle))) {
            return
        }

        const files = await exportDatabaseBundleToFiles(this.#databases)
        await this.#removeStaleFiles(this.#directoryHandle, files)
        await this.#writeFilesToDirectory(this.#directoryHandle, files)
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
     * Import the linked directory content into the current databases.
     *
     * @param {FileSystemDirectoryHandle} rootHandle - Linked directory handle.
     * @return {Promise<void>}
     */
    #importFromLinkedDirectory = async rootHandle => {
        if (!isDirectoryHandle(rootHandle)) {
            return
        }

        const folderFiles = await this.#collectJsonFiles(rootHandle)
        const dbEntries = normalizeDBEntries(this.#databases)

        for (const [scopeName, db] of dbEntries) {
            const prefix = `${scopeName}/`
            const relatedFiles = Array.from(folderFiles.entries()).filter(([path]) => path.startsWith(prefix))
            let journeysImported = false
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
                    }], {clear: !journeysImported})
                    journeysImported = true
                    continue
                }

                const store = relative.slice(0, -5)
                await importJsonToStore(db, store, json)
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
     * @param {FileSystemDirectoryHandle} rootHandle - Root directory.
     * @param {Object<string, Uint8Array>} files - Files that must remain present.
     * @return {Promise<void>}
     */
    #removeStaleFiles = async (rootHandle, files) => {
        const expectedPaths = new Set(Object.keys(files))

        const walk = async (directoryHandle, prefix = '') => {
            for await (const [name, entry] of directoryHandle.entries()) {
                const path = prefix ? `${prefix}/${name}` : name

                if (entry.kind === 'file') {
                    if (!expectedPaths.has(path)) {
                        await directoryHandle.removeEntry(name)
                    }
                    continue
                }

                if (entry.kind === 'directory') {
                    await walk(entry, path)
                }
            }
        }

        await walk(rootHandle)
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

        this.#clearSyncTimer()
        this.#syncTimer = window.setTimeout(() => {
            void this.flushToPersistentDirectory().catch(error => {
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
