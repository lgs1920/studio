import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {exportDatabaseBundleToFiles, openDB} = vi.hoisted(() => ({
    exportDatabaseBundleToFiles: vi.fn(),
    openDB:                     vi.fn(),
}))

vi.mock('idb', () => ({
    openDB,
}))

vi.mock('../../../core/db/DatabaseExportImportUtils.js', async () => {
    const actual = await vi.importActual('../../../core/db/DatabaseExportImportUtils.js')
    return {
        ...actual,
        exportDatabaseBundleToFiles,
    }
})

import { DatabaseSyncManager } from '../../../core/db/DatabaseSyncManager.js'

const createWritable = () => {
    const write = vi.fn(async () => undefined)
    const close = vi.fn(async () => undefined)
    return {
        write,
        close,
    }
}

const createFileHandle = (content = '') => {
    let fileContent = content

    return {
        kind: 'file',
        createWritable: vi.fn(async () => createWritable()),
        getFile: vi.fn(async () => ({
            text: vi.fn(async () => fileContent),
        })),
        __setContent: nextContent => {
            fileContent = nextContent
        },
    }
}

const createDirectoryHandle = (name, entries = {}) => {
    const children = new Map(Object.entries(entries))

    const handle = {
        kind: 'directory',
        name,
        entries: async function * () {
            for (const [childName, childHandle] of children.entries()) {
                yield [childName, childHandle]
            }
        },
        getDirectoryHandle: vi.fn(async (childName, {create = false} = {}) => {
            if (!children.has(childName)) {
                if (!create) {
                    throw new Error(`Missing directory: ${childName}`)
                }
                children.set(childName, createDirectoryHandle(childName))
            }
            return children.get(childName)
        }),
        getFileHandle: vi.fn(async (childName, {create = false} = {}) => {
            if (!children.has(childName)) {
                if (!create) {
                    throw new Error(`Missing file: ${childName}`)
                }
                children.set(childName, createFileHandle())
            }
            return children.get(childName)
        }),
        removeEntry: vi.fn(async childName => {
            children.delete(childName)
        }),
    }

    handle.__children = children
    return handle
}

const createStateDb = ({clientId = null, handle = null, manifestSignature = null, syncState = null} = {}) => ({
    get: vi.fn(async (_store, key) => {
        switch (key) {
            case 'database-sync.client-id':
                return clientId
            case 'database-sync.directory-handle':
                return handle
            case 'database-sync.manifest-signature':
                return manifestSignature
            case 'database-sync.status':
                return syncState
            default:
                return null
        }
    }),
    put: vi.fn(),
    delete: vi.fn(),
})

describe('DatabaseSyncManager bootstrap sync', () => {
    beforeEach(() => {
        vi.useRealTimers()
        exportDatabaseBundleToFiles.mockReset()
        openDB.mockReset()
        window.showDirectoryPicker = vi.fn()
    })

    afterEach(() => {
        vi.useRealTimers()
        delete window.showDirectoryPicker
    })

    it('removes stale journey files from the linked folder on bootstrap', async () => {
        const orphanFile = createFileHandle()
        const activeFile = createFileHandle()
        const journeysDir = createDirectoryHandle('journeys', {
            'active.json': activeFile,
            'orphan.json': orphanFile,
        })
        const databaseDir = createDirectoryHandle('lgs1920', {
            journeys: journeysDir,
        })
        const rootHandle = createDirectoryHandle('sync-root', {
            database: createDirectoryHandle('database', {
                lgs1920: databaseDir,
            }),
        })

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')

        const stateDb = createStateDb({handle: rootHandle})

        openDB.mockResolvedValue(stateDb)
        exportDatabaseBundleToFiles.mockResolvedValue({
            'database/lgs1920/journeys/active.json': new Uint8Array([1, 2, 3]),
        })

        const localDb = {
            keys: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            clear: vi.fn(),
            subscribeMutations: vi.fn(() => vi.fn()),
            storeNames: ['journeys'],
            dbName: 'lgs1920',
        }

        const manager = new DatabaseSyncManager({lgs1920: localDb})
        await manager.bootstrap()

        expect(rootHandle.queryPermission).toHaveBeenCalledWith({mode: 'readwrite'})
        expect(exportDatabaseBundleToFiles).toHaveBeenCalledWith({lgs1920: localDb})
        expect(databaseDir.removeEntry).not.toHaveBeenCalledWith('orphan.json')
        expect(journeysDir.removeEntry).toHaveBeenCalledWith('orphan.json')
        expect(activeFile.createWritable).toHaveBeenCalled()
    })

    it('does not remove unrelated JSON files from the linked folder root', async () => {
        const unrelatedFile = createFileHandle()
        const rootHandle = createDirectoryHandle('sync-root', {
            'notes.json': unrelatedFile,
        })

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')

        openDB.mockResolvedValue(createStateDb({handle: rootHandle}))
        exportDatabaseBundleToFiles.mockResolvedValue({
            'lgs1920/settings.json': new Uint8Array([1, 2, 3]),
        })

        const localDb = {
            keys: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            clear: vi.fn(),
            subscribeMutations: vi.fn(() => vi.fn()),
            storeNames: ['settings'],
            dbName: 'lgs1920',
        }

        const manager = new DatabaseSyncManager({lgs1920: localDb})
        await manager.bootstrap()

        expect(rootHandle.removeEntry).not.toHaveBeenCalledWith('notes.json')
        expect(manager.syncState.status).toBe('synced')
    })

    it('does not report a conflict when the linked manifest belongs to the same client', async () => {
        const linkedManifest = {
            clientId: 'studio-client',
            files: {
                'lgs1920/journeys/active.json': {
                    checksum: 'previous',
                    size: 1,
                },
            },
            version: 1,
        }
        const manifestDir = createDirectoryHandle('.lgs-sync', {
            'manifest.json': createFileHandle(JSON.stringify(linkedManifest)),
        })
        const rootHandle = createDirectoryHandle('sync-root', {
            '.lgs-sync': manifestDir,
        })

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')

        openDB.mockResolvedValue(createStateDb({
            clientId:          'studio-client',
            handle:            rootHandle,
            manifestSignature: JSON.stringify({files: {}, version: 1}),
        }))
        exportDatabaseBundleToFiles.mockResolvedValue({
            'lgs1920/journeys/active.json': new Uint8Array([1, 2, 3]),
        })

        const manager = new DatabaseSyncManager({})
        await manager.bootstrap()

        expect(manager.syncState.status).toBe('synced')
        expect(manager.startupWarning).toBeNull()
    })

    it('reports permission-denied when the linked folder cannot be accessed on bootstrap', async () => {
        const rootHandle = createDirectoryHandle('sync-root')
        rootHandle.queryPermission = vi.fn(async () => 'denied')
        rootHandle.requestPermission = vi.fn(async () => 'denied')

        openDB.mockResolvedValue(createStateDb({handle: rootHandle}))

        const manager = new DatabaseSyncManager({})
        await manager.bootstrap()

        expect(manager.syncState.status).toBe('permission-denied')
        expect(manager.syncState.synchronizationRequired).toBe(true)
        expect(manager.startupWarning?.text).toBe('Folder permission is required to synchronize your profile.')
    })

    it('unlinks a stale persisted directory handle on bootstrap', async () => {
        const rootHandle = createDirectoryHandle('sync-root')
        rootHandle.queryPermission = vi.fn(async () => {
            const error = new Error('An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk.')
            error.name = 'InvalidStateError'
            throw error
        })

        const stateDb = createStateDb({handle: rootHandle})
        openDB.mockResolvedValue(stateDb)

        const manager = new DatabaseSyncManager({})
        await manager.bootstrap()

        expect(stateDb.delete).toHaveBeenCalledWith('state', 'database-sync.directory-handle')
        expect(stateDb.delete).toHaveBeenCalledWith('state', 'database-sync.manifest-signature')
        expect(manager.syncState.status).toBe('idle')
        expect(manager.startupWarning?.text).toBe('The linked profile folder is no longer available and was disconnected.')
    })

    it('imports a newer linked folder from another client on bootstrap', async () => {
        const linkedManifest = {
            clientId: 'other-client',
            files: {
                'lgs1920/settings.json': {
                    checksum: 'changed',
                    size: 1,
                },
            },
            version: 1,
            writtenAt: '2026-06-22T10:00:00.000Z',
        }
        const manifestDir = createDirectoryHandle('.lgs-sync', {
            'manifest.json': createFileHandle(JSON.stringify(linkedManifest)),
        })
        const rootHandle = createDirectoryHandle('sync-root', {
            '.lgs-sync': manifestDir,
            lgs1920: createDirectoryHandle('lgs1920', {
                'settings.json': createFileHandle(JSON.stringify({
                    store:   'settings',
                    records: [
                        {
                            key:   'profile',
                            value: {
                                name: 'chrome-profile',
                            },
                        },
                    ],
                })),
            }),
        })

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')

        openDB.mockResolvedValue(createStateDb({
            handle:            rootHandle,
            manifestSignature: JSON.stringify({files: {}, version: 1}),
            syncState:         {
                lastSyncedAt: '2026-06-22T09:00:00.000Z',
                status:       'synced',
            },
        }))
        exportDatabaseBundleToFiles.mockResolvedValue({
            'lgs1920/settings.json': new Uint8Array([1, 2, 3]),
        })

        const localDb = {
            keys: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            clear: vi.fn(),
            subscribeMutations: vi.fn(() => vi.fn()),
            storeNames: ['settings'],
            dbName: 'lgs1920',
        }

        const manager = new DatabaseSyncManager({lgs1920: localDb})
        await manager.bootstrap()

        expect(localDb.clear).toHaveBeenCalledWith('settings')
        expect(localDb.put).toHaveBeenCalledWith('profile', {
            name: 'chrome-profile',
        }, 'settings', null)
        expect(manager.syncState.status).toBe('synced')
        expect(manager.startupWarning).toBeNull()
    })

    it('does not report a conflict when another client manifest is older than the last sync', async () => {
        const linkedManifest = {
            clientId: 'other-client',
            files: {
                'lgs1920/journeys/old.json': {
                    checksum: 'old',
                    size: 1,
                },
            },
            version: 1,
            writtenAt: '2026-06-22T08:00:00.000Z',
        }
        const manifestDir = createDirectoryHandle('.lgs-sync', {
            'manifest.json': createFileHandle(JSON.stringify(linkedManifest)),
        })
        const rootHandle = createDirectoryHandle('sync-root', {
            '.lgs-sync': manifestDir,
        })

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')

        openDB.mockResolvedValue(createStateDb({
            handle:            rootHandle,
            manifestSignature: JSON.stringify({files: {}, version: 1}),
            syncState:         {
                lastSyncedAt: '2026-06-22T09:00:00.000Z',
                status:       'synced',
            },
        }))
        exportDatabaseBundleToFiles.mockResolvedValue({
            'lgs1920/journeys/active.json': new Uint8Array([1, 2, 3]),
        })

        const manager = new DatabaseSyncManager({})
        await manager.bootstrap()

        expect(manager.syncState.status).toBe('synced')
        expect(manager.startupWarning).toBeNull()
    })

    it('does not report a conflict for a legacy manifest without client id', async () => {
        const linkedManifest = {
            files: {
                'lgs1920/journeys/legacy.json': {
                    checksum: 'legacy',
                    size: 1,
                },
            },
            version: 1,
        }
        const manifestDir = createDirectoryHandle('.lgs-sync', {
            'manifest.json': createFileHandle(JSON.stringify(linkedManifest)),
        })
        const rootHandle = createDirectoryHandle('sync-root', {
            '.lgs-sync': manifestDir,
        })

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')

        openDB.mockResolvedValue(createStateDb({
            handle:            rootHandle,
            manifestSignature: JSON.stringify({files: {}, version: 1}),
        }))
        exportDatabaseBundleToFiles.mockResolvedValue({
            'lgs1920/journeys/active.json': new Uint8Array([1, 2, 3]),
        })

        const manager = new DatabaseSyncManager({})
        await manager.bootstrap()

        expect(manager.syncState.status).toBe('synced')
        expect(manager.startupWarning).toBeNull()
    })

    it('keeps the synced status while a background flush is scheduled', async () => {
        vi.useFakeTimers()

        let mutationListener = null
        const rootHandle = createDirectoryHandle('sync-root')

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')

        openDB.mockResolvedValue(createStateDb({handle: rootHandle}))
        exportDatabaseBundleToFiles.mockResolvedValue({
            'lgs1920/settings.json': new Uint8Array([1, 2, 3]),
        })

        const localDb = {
            keys: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            clear: vi.fn(),
            subscribeMutations: vi.fn(listener => {
                mutationListener = listener
                return vi.fn()
            }),
            storeNames: ['settings'],
            dbName: 'lgs1920',
        }

        const manager = new DatabaseSyncManager({lgs1920: localDb})
        await manager.bootstrap()

        expect(manager.syncState.status).toBe('synced')

        mutationListener({action: 'put', store: 'settings', key: 'profile'})

        expect(manager.syncState.status).toBe('synced')

        await vi.runAllTimersAsync()

        expect(manager.syncState.status).toBe('synced')
    })

    it('reports a conflict when another client writes after bootstrap before a flush', async () => {
        const manifestFile = createFileHandle(JSON.stringify({
            clientId:  'studio-client',
            files:     {},
            version:   1,
            writtenAt: '2026-06-22T09:00:00.000Z',
        }))
        const rootHandle = createDirectoryHandle('sync-root', {
            '.lgs-sync': createDirectoryHandle('.lgs-sync', {
                'manifest.json': manifestFile,
            }),
        })

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')

        openDB.mockResolvedValue(createStateDb({
            clientId:          'studio-client',
            handle:            rootHandle,
            manifestSignature: JSON.stringify({files: {}, version: 1}),
            syncState:         {
                lastSyncedAt: '2026-06-22T09:00:00.000Z',
                status:       'synced',
            },
        }))
        exportDatabaseBundleToFiles.mockResolvedValue({
            'lgs1920/settings.json': new Uint8Array([1, 2, 3]),
        })

        const localDb = {
            keys: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            clear: vi.fn(),
            subscribeMutations: vi.fn(() => vi.fn()),
            storeNames: ['settings'],
            dbName: 'lgs1920',
        }

        const manager = new DatabaseSyncManager({lgs1920: localDb})
        await manager.bootstrap()

        manifestFile.__setContent(JSON.stringify({
            clientId:  'other-client',
            files:     {
                'lgs1920/settings.json': {
                    checksum: 'changed',
                    size:     1,
                },
            },
            version:   1,
            writtenAt: '2999-01-01T00:00:00.000Z',
        }))

        const synchronized = await manager.flushToPersistentDirectory({showPending: false})

        expect(synchronized).toBe(false)
        expect(manager.syncState.status).toBe('conflict')
        expect(manager.syncState.synchronizationRequired).toBe(true)
    })

    it('imports the linked folder first, then writes the local manifest on link', async () => {
        const settingsFile = createFileHandle(JSON.stringify({
            store:   'settings',
            records: [
                {
                    key:   'profile',
                    value: {
                        name: 'folder-profile',
                    },
                },
            ],
        }))
        const rootHandle = createDirectoryHandle('sync-root', {
            lgs1920: createDirectoryHandle('lgs1920', {
                'settings.json': settingsFile,
            }),
        })

        rootHandle.queryPermission = vi.fn(async () => 'granted')
        rootHandle.requestPermission = vi.fn(async () => 'granted')
        window.showDirectoryPicker.mockResolvedValue(rootHandle)

        openDB.mockResolvedValue(createStateDb())
        exportDatabaseBundleToFiles.mockResolvedValue({
            'lgs1920/settings.json': new Uint8Array([1, 2, 3]),
        })

        const localDb = {
            keys: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            clear: vi.fn(),
            subscribeMutations: vi.fn(() => vi.fn()),
            storeNames: ['settings'],
            dbName: 'lgs1920',
        }

        const manager = new DatabaseSyncManager({lgs1920: localDb})
        await manager.linkPersistentDirectory()

        expect(localDb.clear).toHaveBeenCalledWith('settings')
        expect(localDb.put).toHaveBeenCalledWith('profile', {
            name: 'folder-profile',
        }, 'settings', null)
        expect(exportDatabaseBundleToFiles).toHaveBeenCalledWith({lgs1920: localDb})
        expect(rootHandle.getDirectoryHandle).toHaveBeenCalledWith('.lgs-sync', {create: true})
        expect(manager.syncState.status).toBe('synced')
    })
})
