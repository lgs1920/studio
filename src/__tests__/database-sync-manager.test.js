import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {exportDatabaseBundleToFiles, openDB} = vi.hoisted(() => ({
    exportDatabaseBundleToFiles: vi.fn(),
    openDB:                     vi.fn(),
}))

vi.mock('idb', () => ({
    openDB,
}))

vi.mock('../core/db/DatabaseExportImportUtils.js', async () => {
    const actual = await vi.importActual('../core/db/DatabaseExportImportUtils.js')
    return {
        ...actual,
        exportDatabaseBundleToFiles,
    }
})

import { DatabaseSyncManager } from '../core/db/DatabaseSyncManager.js'

const createWritable = () => {
    const write = vi.fn(async () => undefined)
    const close = vi.fn(async () => undefined)
    return {
        write,
        close,
    }
}

const createFileHandle = () => ({
    kind: 'file',
    createWritable: vi.fn(async () => createWritable()),
})

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

describe('DatabaseSyncManager bootstrap sync', () => {
    beforeEach(() => {
        exportDatabaseBundleToFiles.mockReset()
        openDB.mockReset()
        window.showDirectoryPicker = vi.fn()
    })

    afterEach(() => {
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

        const stateDb = {
            get: vi.fn(async () => rootHandle),
            put: vi.fn(),
            delete: vi.fn(),
        }

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
})
