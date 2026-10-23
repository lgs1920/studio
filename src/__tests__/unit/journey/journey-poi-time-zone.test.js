/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-poi-time-zone.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Utils/TimeZoneUtils', () => ({
    resolveTimeZone: vi.fn(async () => 'America/New_York'),
}))
vi.mock('@Utils/UIToast', () => ({
    UIToast: {error: vi.fn()},
}))

import {Journey} from '@Core/Journey'
import {resolveTimeZone} from '@Utils/TimeZoneUtils'

const originalLgs = globalThis.lgs
const originalContext = globalThis.__

afterEach(() => {
    if (originalLgs === undefined) {
        delete globalThis.lgs
    }
    else {
        globalThis.lgs = originalLgs
    }

    if (originalContext === undefined) {
        delete globalThis.__
    }
    else {
        globalThis.__ = originalContext
    }

    vi.clearAllMocks()
})

describe('Journey POI time zones', () => {
    it('resolves and stores a time zone when importing a timestamped POI', async () => {
        const poiList = new Map()
        const addedPOIs = []
        globalThis.__ = {
            ui: {
                poiManager: {
                    list:                 poiList,
                    getHeightFromTerrain: vi.fn(async () => 12),
                    add:                  vi.fn(async poi => {
                        poiList.set(poi.id, poi)
                        addedPOIs.push(poi)
                        return poi
                    }),
                },
            },
        }
        globalThis.lgs = {colors: {dark: '#000000', light: '#ffffff'}}

        const journey = new Journey()
        Object.assign(journey, {
            slug:        'time-zone-journey',
            tracks:      new Map(),
            poisOnLimits: false,
            geoJson: {
                type:     'FeatureCollection',
                features: [{
                    type:       'Feature',
                    properties: {name: 'Timed POI', time: '2026-10-23T16:00:00Z'},
                    geometry:   {type: 'Point', coordinates: [-73.97, 40.78]},
                }],
            },
        })

        await journey.getPOIsFromGeoJson()

        expect(resolveTimeZone).toHaveBeenCalledWith({longitude: -73.97, latitude: 40.78})
        expect(addedPOIs).toHaveLength(1)
        expect(addedPOIs[0].timeZone).toBe('America/New_York')
    })
})
