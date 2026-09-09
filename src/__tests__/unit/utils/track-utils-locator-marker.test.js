/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-utils-locator-marker.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-09
 * Last modified: 2026-09-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it } from 'vitest'
import { TrackUtils } from '@Utils/cesium/TrackUtils'

describe('TrackUtils locator marker', () => {
    afterEach(() => {
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('keeps the distant journey marker depth-tested against terrain', () => {
        const entities = new Map()
        const source = {
            entities: {
                getById: id => entities.get(id),
                add: entity => {
                    entities.set(entity.id, entity)
                    return entity
                },
            },
        }

        globalThis.lgs = {
            colors: {
                poiDefault:           '#ffffff',
                poiDefaultBackground: '#000000',
            },
        }
        globalThis.__ = {
            ui: {
                sceneManager: {
                    is2D:     false,
                    noRelief: () => false,
                },
            },
        }

        const entity = TrackUtils.ensureTrackLocatorMarkerEntity(source, {
            slug:    'track-1',
            title:   'Journey track',
            content: {
                type:       'Feature',
                properties: {},
                geometry:   {
                    type:        'LineString',
                    coordinates: [[2, 48], [3, 49]],
                },
            },
        }, {color: '#ff0000'})

        expect(entity.billboard.disableDepthTestDistance).toBe(0)
    })
})
