/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-manager-creation.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {CURRENT_POI, POI_STANDARD_TYPE, POI_TMP_TYPE, POIS_STORE} from '@Core/constants'
import {MapPOI} from '@Core/MapPOI'
import {POIManager} from '@Core/ui/POIManager'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxyMap} from 'valtio/utils'

const POI_DEFAULT = '#211d36'
const POI_DEFAULT_BACKGROUND = '#f9f8fa'

beforeEach(() => {
    const list = proxyMap()
    vi.stubGlobal('lgs', {
        colors: {
            poiDefault:           POI_DEFAULT,
            poiDefaultBackground: POI_DEFAULT_BACKGROUND,
        },
        savedConfiguration: {
            poi: {
                displayDefaults: {
                    titleCategoryIcon: false,
                },
            },
        },
        settings: {
            poi: {
                association: {maxDistance: 1000},
            },
        },
        db: {
            lgs1920: {
                put: vi.fn(async () => undefined),
            },
        },
        stores: {
            main: {
                components: {
                    pois: {list},
                },
            },
        },
    })
    vi.stubGlobal('__', {
    app: {
        deepClone: value => value,
    },
        ui: {
            sceneManager: {
                getHeightFromTerrain: vi.fn(async () => 128),
            },
        },
    })
})

afterEach(() => {
    POIManager.instance?.destroy()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('POIManager interactive creation defaults', () => {
    it('stops a POI camera orbit before deleting its target', async () => {
        const manager = new POIManager()
        const callOrder = []
        const poi = {
            id: 'poi-being-removed',
            type: POI_STANDARD_TYPE,
            remove: vi.fn(async () => callOrder.push('remove')),
        }
        manager.list.set(poi.id, poi)
        globalThis.lgs.stores.ui = {
            mainUI: {
                rotate: {target: {element: CURRENT_POI, slug: poi.id}},
                panorama: {active: false, target: false},
            },
        }
        globalThis.__.ui.cameraManager = {
            isRotating: vi.fn(() => true),
            stopRotate: vi.fn(async () => callOrder.push('stop')),
        }

        const result = await manager.remove({id: poi.id, dbSync: false})

        expect(result.success).toBe(true)
        expect(callOrder).toEqual(['stop', 'remove'])
        expect(globalThis.__.ui.cameraManager.stopRotate).toHaveBeenCalledOnce()
    })

    it('creates temporary POIs with shared colors, category, background, and description defaults', () => {
        const manager = new POIManager()
        const poi = manager.createPOI({
            latitude:  48.8566,
            longitude: 2.3522,
            title:     'Paris',
        })

        expect(poi).toBeInstanceOf(MapPOI)
        expect(poi).toMatchObject({
            background: true,
            bgColor:    POI_DEFAULT_BACKGROUND,
            borderColor: POI_DEFAULT,
            category:   POI_STANDARD_TYPE,
            color:      POI_DEFAULT,
            description: '',
            latitude:   48.8566,
            longitude:  2.3522,
            title:      'Paris',
            textBorderColorsLinked: true,
            type:       POI_TMP_TYPE,
        })
        expect(poi.display).toMatchObject({category: false, titleCategoryIcon: true})
        expect(MapPOI.clone(poi)).toMatchObject({
            textBorderColorsLinked: true,
            display: {category: false, titleCategoryIcon: true},
        })
    })

    it('initializes Border from Text while preserving an explicit border override', () => {
        const manager = new POIManager()
        const poi = manager.createPOI({bgColor: '#445566'})
        const customPoi = manager.createPOI({bgColor: '#445566', borderColor: '#778899'})
        const customDisplayPoi = manager.createPOI({
            display: {category: true, titleCategoryIcon: false},
        })

        expect(poi.borderColor).toBe(POI_DEFAULT)
        expect(MapPOI.clone(poi).borderColor).toBe(POI_DEFAULT)
        expect(customPoi.borderColor).toBe('#778899')
        expect(customDisplayPoi.display).toMatchObject({category: true, titleCategoryIcon: false})
    })

    it('persists a later Border color through the standard POI update path', async () => {
        const manager = new POIManager()
        const poi = manager.createPOI({id: 'border-color-poi', type: POI_STANDARD_TYPE})
        manager.list.set(poi.id, poi)
        manager.persistToDatabase = vi.fn(async () => {})

        await manager.updatePOI(poi.id, {borderColor: '#778899'}, {
            immediate: true,
            skipLocationUpdate: true,
        })

        expect(poi.borderColor).toBe('#778899')
        expect(manager.persistToDatabase).toHaveBeenCalledWith(poi)
    })

    it('preserves search metadata and terrain height while using the shared defaults', async () => {
        const manager = new POIManager()
        const poi = await manager.getPointFromGeoJson({
            geometry: {
                coordinates: [2.3522, 48.8566],
            },
            properties: {
                name:         'Paris',
                display_name: 'Paris, France',
            },
        }, true)

        expect(poi).toMatchObject({
            bgColor:         POI_DEFAULT_BACKGROUND,
            category:        POI_STANDARD_TYPE,
            color:           POI_DEFAULT,
            description:     'Paris - France',
            latitude:        48.8566,
            longitude:       2.3522,
            simulatedHeight: 128,
            title:           'Paris',
            textBorderColorsLinked: true,
            type:            POI_TMP_TYPE,
        })
        expect(poi.display).toMatchObject({category: false, titleCategoryIcon: true})
    })

    it('promotes a temporary POI by setting its standard type and category before persistence', async () => {
        const manager = new POIManager()
        const poi = manager.createPOI({id: 'temporary-poi'})
        manager.list.set(poi.id, poi)
        manager.persistToDatabase = vi.fn(async () => {})

        await expect(manager.promoteToStandardPOI(poi.id)).resolves.toMatchObject({
            category: POI_STANDARD_TYPE,
            type:     POI_STANDARD_TYPE,
        })

        expect(manager.persistToDatabase).toHaveBeenCalledWith(expect.objectContaining({
            id:       poi.id,
            category: POI_STANDARD_TYPE,
            type:     POI_STANDARD_TYPE,
        }))
    })

    it('persists the same POI identity and geographic metadata before publishing its saved type', async () => {
        const manager = new POIManager()
        const poi = manager.createPOI({
            id: 'temporary-with-metadata',
            latitude: 48.8566,
            longitude: 2.3522,
            simulatedHeight: 42,
            title: 'Paris',
            description: 'Paris - France',
            location: 'Paris',
            country: 'France',
            countryCode: 'FR',
        })
        manager.list.set(poi.id, poi)

        const result = await manager.addTemporaryPOIToLibrary(poi.id)

        expect(result).toEqual({status: 'added', poi})
        expect(result.poi).toBe(manager.list.get(poi.id))
        expect(poi).toMatchObject({
            id: 'temporary-with-metadata',
            latitude: 48.8566,
            longitude: 2.3522,
            simulatedHeight: 42,
            title: 'Paris',
            description: 'Paris - France',
            location: 'Paris',
            country: 'France',
            countryCode: 'FR',
            category: POI_STANDARD_TYPE,
            type: POI_STANDARD_TYPE,
        })
        expect(lgs.db.lgs1920.put).toHaveBeenCalledOnce()
        expect(lgs.db.lgs1920.put).toHaveBeenCalledWith(
            poi.id,
            expect.objectContaining({id: poi.id, type: POI_STANDARD_TYPE, title: 'Paris'}),
            POIS_STORE,
        )
    })

    it('does not treat another unsaved temporary marker as a duplicate', async () => {
        const manager = new POIManager()
        const first = manager.createPOI({id: 'temporary-first', latitude: 48.8566, longitude: 2.3522})
        const second = manager.createPOI({id: 'temporary-second', latitude: 48.8566, longitude: 2.3522})
        manager.list.set(first.id, first)
        manager.list.set(second.id, second)

        await expect(manager.addTemporaryPOIToLibrary(second.id)).resolves.toMatchObject({status: 'added'})
        expect(second.type).toBe(POI_STANDARD_TYPE)
        expect(first.type).toBe(POI_TMP_TYPE)
    })

    it('can convert an older temporary marker independently from the latest location', async () => {
        const manager = new POIManager()
        const older = manager.createPOI({id: 'older-temporary', latitude: 48.8566, longitude: 2.3522})
        const latest = manager.createPOI({id: 'latest-temporary', latitude: 45.764, longitude: 4.8357})
        manager.list.set(older.id, older)
        manager.list.set(latest.id, latest)

        await expect(manager.addTemporaryPOIToLibrary(latest.id)).resolves.toMatchObject({status: 'added'})
        await expect(manager.addTemporaryPOIToLibrary(older.id)).resolves.toMatchObject({status: 'added'})

        expect(manager.list.get(older.id).type).toBe(POI_STANDARD_TYPE)
        expect(manager.list.get(latest.id).type).toBe(POI_STANDARD_TYPE)
        expect(lgs.db.lgs1920.put).toHaveBeenCalledTimes(2)
    })

    it('rejects a nearby saved POI without changing the temporary marker', async () => {
        const manager = new POIManager()
        const savedPOI = manager.createPOI({
            id: 'nearby-saved',
            latitude: 48.8566,
            longitude: 2.3522,
            type: POI_STANDARD_TYPE,
        })
        const poi = manager.createPOI({id: 'temporary-nearby', latitude: 48.8566, longitude: 2.3522})
        manager.list.set(savedPOI.id, savedPOI)
        manager.list.set(poi.id, poi)

        await expect(manager.addTemporaryPOIToLibrary(poi.id)).resolves.toEqual({
            status: 'duplicate',
            poi,
            nearbyPOI: savedPOI,
        })
        expect(poi.type).toBe(POI_TMP_TYPE)
        expect(lgs.db.lgs1920.put).not.toHaveBeenCalled()
    })

    it('coalesces repeated Add calls and returns already-added for later calls', async () => {
        const manager = new POIManager()
        const poi = manager.createPOI({id: 'temporary-repeat', latitude: 48.8566, longitude: 2.3522})
        manager.list.set(poi.id, poi)
        let resolveWrite
        lgs.db.lgs1920.put.mockImplementation(() => new Promise(resolve => {
            resolveWrite = resolve
        }))

        const first = manager.addTemporaryPOIToLibrary(poi.id)
        const second = manager.addTemporaryPOIToLibrary(poi.id)
        expect(lgs.db.lgs1920.put).toHaveBeenCalledOnce()
        resolveWrite()

        await expect(Promise.all([first, second])).resolves.toEqual([
            {status: 'added', poi},
            {status: 'added', poi},
        ])
        await expect(manager.addTemporaryPOIToLibrary(poi.id)).resolves.toEqual({status: 'already-added', poi})
        expect(lgs.db.lgs1920.put).toHaveBeenCalledOnce()
    })

    it('keeps the POI temporary after persistence fails and permits a later retry', async () => {
        const manager = new POIManager()
        const poi = manager.createPOI({id: 'temporary-retry', latitude: 48.8566, longitude: 2.3522})
        manager.list.set(poi.id, poi)
        lgs.db.lgs1920.put.mockRejectedValueOnce(new Error('storage unavailable'))

        await expect(manager.addTemporaryPOIToLibrary(poi.id)).rejects.toThrow('storage unavailable')
        expect(poi.type).toBe(POI_TMP_TYPE)

        await expect(manager.addTemporaryPOIToLibrary(poi.id)).resolves.toMatchObject({status: 'added'})
        expect(poi.type).toBe(POI_STANDARD_TYPE)
        expect(lgs.db.lgs1920.put).toHaveBeenCalledTimes(2)
    })

    it('does not schedule database persistence for edits to a temporary POI', async () => {
        vi.useFakeTimers()
        const manager = new POIManager()
        const poi = manager.createPOI({id: 'temporary-edit'})
        manager.list.set(poi.id, poi)

        await manager.updatePOI(poi.id, {title: 'Unsaved edit'})
        vi.advanceTimersByTime(1000)

        expect(poi.title).toBe('Unsaved edit')
        expect(lgs.db.lgs1920.put).not.toHaveBeenCalled()
    })
})
