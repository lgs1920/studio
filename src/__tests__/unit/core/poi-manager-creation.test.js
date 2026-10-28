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
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {POI_STANDARD_TYPE, POI_TMP_TYPE} from '@Core/constants'
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
        stores: {
            main: {
                components: {
                    pois: {list},
                },
            },
        },
    })
    vi.stubGlobal('__', {
        ui: {
            sceneManager: {
                getHeightFromTerrain: vi.fn(async () => 128),
            },
        },
    })
})

afterEach(() => {
    POIManager.instance?.destroy()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('POIManager interactive creation defaults', () => {
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
            category:   POI_STANDARD_TYPE,
            color:      POI_DEFAULT,
            description: '',
            latitude:   48.8566,
            longitude:  2.3522,
            title:      'Paris',
            type:       POI_TMP_TYPE,
        })
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
            type:            POI_TMP_TYPE,
        })
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

        expect(manager.persistToDatabase).toHaveBeenCalledWith(poi)
    })
})
