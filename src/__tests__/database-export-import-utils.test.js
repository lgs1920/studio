import { describe, expect, it, vi } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import {
    exportDatabaseBundleToFiles,
    importDatabaseBundleFromZip,
} from '../core/db/DatabaseExportImportUtils.js'

const createDb = ({dbName = 'lgs1920', stores = {}} = {}) => ({
    dbName,
    storeNames: Object.keys(stores),
    keys: vi.fn(async store => Object.keys(stores[store] ?? {})),
    get: vi.fn(async (key, store) => stores[store]?.[key] ?? null),
    put: vi.fn(async (key, value, store) => {
        stores[store] ??= {}
        stores[store][key] = value
    }),
    clear: vi.fn(async store => {
        stores[store] = {}
    }),
})

describe('DatabaseExportImportUtils', () => {
    it('exports journeys as flat files under the database folder', async () => {
        const db = createDb({
            stores: {
                journeys: {
                    'journey-a': {
                        data: {
                            title: 'Journey A',
                        },
                        _ct_: 1,
                        _mt_: 2,
                    },
                },
                settings: {
                    profile: {
                        data: {
                            visible: true,
                        },
                    },
                },
            },
        })

        const files = await exportDatabaseBundleToFiles({lgs1920: db})

        expect(Object.keys(files)).toContain('lgs1920/journeys/journey-a.json')
        expect(Object.keys(files)).toContain('lgs1920/settings.json')
    })

    it('imports flat journey files back into the journeys store', async () => {
        const payload = {
            'lgs1920/journeys/journey-a.json': strToU8(JSON.stringify({
                store: 'journeys',
                key: 'journey-a',
                value: {
                    title: 'Journey A',
                },
            })),
            'lgs1920/settings.json': strToU8(JSON.stringify({
                store: 'settings',
                records: [
                    {
                        key: 'profile',
                        value: {
                            visible: true,
                        },
                    },
                ],
            })),
        }
        const archive = zipSync(payload)
        const db = createDb()

        await importDatabaseBundleFromZip({lgs1920: db}, archive)

        expect(db.clear).toHaveBeenCalledWith('journeys')
        expect(db.put).toHaveBeenCalledWith('journey-a', {
            title: 'Journey A',
        }, 'journeys', null)
        expect(db.put).toHaveBeenCalledWith('profile', {
            visible: true,
        }, 'settings', null)
    })
})
