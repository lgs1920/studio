/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-display-settings.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOI } from '@Core/MapPOI'
import { POI_STANDARD_TYPE } from '@Core/constants'
import { POIManager } from '@Core/ui/POIManager'
import {
    getDefaultPOIDisplaySettings, normalizePOIDisplaySettings, POI_DISPLAY_DEFAULT_WIDTH, shouldDisplayPOIField,
}                 from '@Core/POIDisplaySettings'
import {
    afterEach, beforeEach, describe, expect, it, vi,
}                 from 'vitest'
import { proxyMap } from 'valtio/utils'
import {readFileSync} from 'node:fs'
import {parse} from 'yaml'

const settings = parse(readFileSync(new URL('../../../../public/settings.yaml', import.meta.url), 'utf8'))

beforeEach(() => {
    vi.stubGlobal('lgs', {
        savedConfiguration: settings,
        configuration: settings,
        settings,
    })
})

afterEach(() => {
    POIManager.instance?.destroy()
    vi.unstubAllGlobals()
})

describe('POI display settings', () => {
    it('defaults category on and every other display field off', () => {
        const expected = {...settings.poi.displayDefaults, maxWidth: POI_DISPLAY_DEFAULT_WIDTH}

        expect(getDefaultPOIDisplaySettings()).toEqual(expected)
        expect(normalizePOIDisplaySettings()).toEqual(expected)
        expect(new MapPOI({id: 'legacy-poi'}).display).toEqual(expected)
    })

    it('uses saved YAML defaults instead of stale values from persisted runtime settings', () => {
        vi.stubGlobal('lgs', {
            savedConfiguration: settings,
            settings: {poi: {displayDefaults: {category: false, titleCategoryIcon: true}}},
        })

        expect(getDefaultPOIDisplaySettings()).toEqual({
            ...settings.poi.displayDefaults,
            maxWidth: POI_DISPLAY_DEFAULT_WIDTH,
        })
    })

    it('preserves explicit boolean flags and fills missing or invalid values from defaults', () => {
        expect(normalizePOIDisplaySettings({category: false, location: true, altitude: 'true'})).toEqual({
            category:    false,
            titleCategoryIcon: false,
            titleAltitude: false,
            location:    true,
            altitude:    false,
            coordinates: false,
            dateTime:    false,
            maxWidth:    POI_DISPLAY_DEFAULT_WIDTH,
        })
        expect(normalizePOIDisplaySettings({maxWidth: 900}).maxWidth).toBe(400)
        expect(normalizePOIDisplaySettings({maxWidth: 245}).maxWidth).toBe(250)
    })

    it('allows only enabled category among configurable fields during Replay', () => {
        const settings = {
            category:    true,
            titleCategoryIcon: true,
            titleAltitude: true,
            location:    true,
            altitude:    true,
            coordinates: true,
            dateTime:    true,
        }

        expect(shouldDisplayPOIField('category', settings, true)).toBe(true)
        expect(shouldDisplayPOIField('titleCategoryIcon', settings, true)).toBe(true)
        expect(shouldDisplayPOIField('titleAltitude', settings, true)).toBe(false)
        expect(shouldDisplayPOIField('titleCategoryIcon', {...settings, titleCategoryIcon: false}, true)).toBe(false)
        expect(shouldDisplayPOIField('category', {category: false}, true)).toBe(false)
        expect(shouldDisplayPOIField('location', settings, true)).toBe(false)
        expect(shouldDisplayPOIField('altitude', settings, true)).toBe(false)
        expect(shouldDisplayPOIField('coordinates', settings, true)).toBe(false)
        expect(shouldDisplayPOIField('dateTime', settings, true)).toBe(false)
        expect(shouldDisplayPOIField('location', settings, false)).toBe(true)
        expect(shouldDisplayPOIField('titleAltitude', settings, false)).toBe(true)
        expect(shouldDisplayPOIField('unknown', settings, true)).toBe(false)
    })

    it('merges a display flag update and persists the complete settings immediately', async () => {
        const poi = new MapPOI({id: 'update-poi', type: POI_STANDARD_TYPE})
        const poiList = proxyMap([[poi.id, poi]])
        const databasePut = vi.fn().mockResolvedValue()

        vi.stubGlobal('lgs', {
            stores: {main: {components: {pois: {list: poiList}}}},
            db: {lgs1920: {put: databasePut}},
        })
        vi.stubGlobal('__', {app: {deepClone: value => value}, ui: {}})

        const manager = new POIManager()
        await manager.updatePOI(poi.id, {display: {location: true, titleAltitude: true, maxWidth: 340}}, {
            immediate: true,
            skipLocationUpdate: true,
        })

        expect(poi.display).toEqual({
            category:    true,
            titleCategoryIcon: false,
            titleAltitude: true,
            location:    true,
            altitude:    false,
            coordinates: false,
            dateTime:    false,
            maxWidth:    340,
        })
        expect(databasePut).toHaveBeenCalledOnce()
        expect(databasePut.mock.calls[0][1].display).toEqual(poi.display)
    })

    it('keeps display flags in the POI serialized representation and normalizes them on load', () => {
        vi.stubGlobal('__', {app: {deepClone: value => value}})

        const poi = new MapPOI({
            id:      'saved-poi',
            display: {category: false, titleAltitude: true, location: true},
        })
        const serialized = MapPOI.serialize({id: poi.id, display: poi.display})
        const restored = new MapPOI(serialized)

        expect(restored.display).toEqual({
            category:    false,
            titleCategoryIcon: false,
            titleAltitude: true,
            location:    true,
            altitude:    false,
            coordinates: false,
            dateTime:    false,
            maxWidth:    POI_DISPLAY_DEFAULT_WIDTH,
        })
    })

    it('persists YAML defaults onto legacy POIs when they are loaded', async () => {
        const databasePut = vi.fn().mockResolvedValue()
        const legacyPOI = {
            id:      'legacy-poi',
            type:    POI_STANDARD_TYPE,
            display: {category: false, location: true},
        }

        vi.stubGlobal('lgs', {
            savedConfiguration: settings,
            configuration: settings,
            settings,
            stores: {main: {components: {pois: {list: proxyMap()}}}},
            db: {
                lgs1920: {
                    keys: vi.fn().mockResolvedValue([legacyPOI.id]),
                    get: vi.fn().mockResolvedValue(legacyPOI),
                    put: databasePut,
                },
            },
        })
        vi.stubGlobal('__', {app: {deepClone: value => value}, ui: {}})

        const manager = new POIManager()
        await manager.readAllFromDB({ensureLocations: false})

        const expectedDisplay = {
            category:    false,
            titleCategoryIcon: false,
            titleAltitude: false,
            location:    true,
            altitude:    false,
            coordinates: false,
            dateTime:    false,
            maxWidth:    POI_DISPLAY_DEFAULT_WIDTH,
        }
        expect(manager.list.get(legacyPOI.id).display).toEqual(expectedDisplay)
        expect(databasePut).toHaveBeenCalledOnce()
        expect(databasePut.mock.calls[0][1].display).toEqual(expectedDisplay)
    })
})
