/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-utils-journey-visibility.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-21
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {POIUtils} from '@Utils/cesium/POIUtils'
import {afterEach, describe, expect, it, vi} from 'vitest'

describe('TrackUtils journey POI visibility', () => {
    const previousLgs = globalThis.lgs
    const previousNamespace = globalThis.__

    afterEach(() => {
        vi.restoreAllMocks()
        globalThis.lgs = previousLgs
        globalThis.__ = previousNamespace
    })

    it('updates attached POIs and start/stop flags without changing trace visibility', () => {
        const entities = [
            {id: 'poi-one', show: true},
            {id: 'flag-start-one', show: true},
            {id: 'flag-stop-one', show: true},
            {id: 'track-line', show: true},
        ]
        const journey = {slug: 'journey-current'}
        const setPOIVisibility = vi.spyOn(POIUtils, 'setPOIVisibility').mockImplementation((_poi, visible) => visible)

        globalThis.lgs = {
            viewer: {
                dataSources: {
                    getByName: () => [{name: journey.slug, entities: {values: entities}}],
                },
            },
        }
        globalThis.__ = {ui: {poiManager: {get: id => ({id})}}}

        TrackUtils.updatePOIsVisibility(journey, false)

        expect(entities.map(entity => entity.show)).toEqual([false, false, false, true])
        expect(setPOIVisibility).toHaveBeenCalledTimes(3)
    })
})
