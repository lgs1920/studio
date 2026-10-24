/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-poi-category-import.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Journey} from '@Core/Journey'

const originalLgs = globalThis.lgs
const originalContext = globalThis.__

beforeEach(() => {
    const poiList = new Map()
    globalThis.__ = {
        ui: {
            poiManager: {
                list:                 poiList,
                getHeightFromTerrain: vi.fn(async () => 12),
                add:                  vi.fn(async poi => {
                    poiList.set(poi.id, poi)
                    return poi
                }),
            },
        },
    }
    globalThis.lgs = {colors: {dark: '#000000', light: '#ffffff'}}
})

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

describe('Journey POI category import', () => {
    it('maps recognized GPX, Garmin, and Strava labels and defaults unknown labels to POI', async () => {
        const journey = new Journey()
        Object.assign(journey, {
            slug:   'category-import-journey',
            tracks: new Map(),
            geoJson: {
                type:     'FeatureCollection',
                features: [
                    {type: 'Feature', properties: {name: 'GPX viewpoint', sym: 'Scenic Area'}, geometry: {type: 'Point', coordinates: [6.1, 45.1]}},
                    {type: 'Feature', properties: {name: 'Garmin trailhead', category: 'Trailhead'}, geometry: {type: 'Point', coordinates: [6.2, 45.2]}},
                    {type: 'Feature', properties: {name: 'Strava water stop', category: 'Water Fountain'}, geometry: {type: 'Point', coordinates: [6.3, 45.3]}},
                    {type: 'Feature', properties: {name: 'Bivouac', type: 'Wild Camping'}, geometry: {type: 'Point', coordinates: [6.4, 45.4]}},
                    {type: 'Feature', properties: {name: 'Ambiguous camp', category: 'Camp'}, geometry: {type: 'Point', coordinates: [6.5, 45.5]}},
                    {type: 'Feature', properties: {name: 'Unknown category', sym: 'Geocache', type: 'course-point'}, geometry: {type: 'Point', coordinates: [6.6, 45.6]}},
                    {type: 'Feature', properties: {name: 'Generic category with symbol', category: 'POI', sym: 'Summit'}, geometry: {type: 'Point', coordinates: [6.7, 45.7]}},
                    {type: 'Feature', properties: {name: 'LGS category', lgs_category: 'refuge', type: 'Summit'}, geometry: {type: 'Point', coordinates: [6.8, 45.8]}},
                ],
            },
        })

        await journey.getPOIsFromGeoJson()

        const importedPois = Array.from(globalThis.__.ui.poiManager.list.values())
        const categoriesByTitle = Object.fromEntries(importedPois.map(poi => [poi.title, poi.category]))

        expect(categoriesByTitle).toEqual({
            'GPX viewpoint':      'viewpoint',
            'Garmin trailhead':   'trailhead',
            'Strava water stop':  'drinking-water',
            Bivouac:              'bivouac',
            'Ambiguous camp':     'poi',
            'Unknown category':  'poi',
            'Generic category with symbol': 'summit',
            'LGS category':       'refuge',
        })
    })
})
