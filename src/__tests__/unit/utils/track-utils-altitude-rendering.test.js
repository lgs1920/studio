/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-utils-altitude-rendering.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-08
 * Last modified: 2026-10-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassificationType, GeoJsonPrimitive, HeightReference } from 'cesium'
import { TrackUtils } from '@Utils/cesium/TrackUtils'

describe('TrackUtils track terrain rendering', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        vi.restoreAllMocks()
        globalThis.lgs = previousLgs
    })

    it('clamps GPX tracks to terrain without splitting altitude jumps', async () => {
        const entitiesById = new Map()
        const baseEntity = {
            id:       'track-line',
            polyline: {
                positions:          ['position'],
                clampToGround:      true,
                classificationType: ClassificationType.BOTH,
            },
        }
        const existingMainEntity = {
            id:       'track-line#lgs-track-style#main',
            polyline: {
                positions: ['old-position'],
            },
        }
        entitiesById.set(baseEntity.id, baseEntity)
        entitiesById.set(existingMainEntity.id, existingMainEntity)

        const source = {
            name: 'track-gpx-altitude-entities',
            load: vi.fn(async () => {
                entitiesById.set(baseEntity.id, baseEntity)
            }),
        }
        source.entities = {
            get values() {
                return Array.from(entitiesById.values())
            },
            getById: entityId => entitiesById.get(entityId),
            add: entity => {
                entitiesById.set(entity.id, entity)
                return entity
            },
            remove: entity => entitiesById.delete(entity.id),
        }

        globalThis.lgs = {
            viewer: {
                terrainProvider: {availability: {}},
                dataSources: {
                    contains:  candidate => candidate === source,
                    getByName: name => name === source.name ? [source] : [],
                },
                scene: {
                    requestRender: vi.fn(),
                },
            },
        }

        vi.spyOn(TrackUtils, 'createTrackMaterial').mockReturnValue({})
        vi.spyOn(TrackUtils, 'installTrackWidthUpdater').mockImplementation(() => {})

        const coordinates = [[0, 0, 10], [0.001, 0, 20], [0.002, 0, 200], [0.003, 0, 210]]
        const track = {
            slug:    source.name,
            title:   'GPX altitude test',
            visible: true,
            content: {
                type:       'Feature',
                properties: {},
                geometry:   {
                    type:        'LineString',
                    coordinates,
                },
            },
        }

        await TrackUtils.drawOnce(track)

        const polylines = Array.from(entitiesById.values()).filter(entity => entity.polyline)
        const loadedContent = source.load.mock.calls[0][0]

        expect(polylines).toHaveLength(3)
        expect(polylines.every(entity => entity.polyline.clampToGround === true)).toBe(true)
        expect(existingMainEntity.polyline.positions).toEqual(['position'])
        expect(loadedContent.geometry).toEqual({type: 'LineString', coordinates})
        expect(source.load).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({clampToGround: true}),
        )
    })

    it('clamps tracks without recorded elevations to terrain', async () => {
        const source = {
            name: 'track-terrain-fallback',
            load: vi.fn(async () => {}),
            entities: {
                values: [],
                add:    vi.fn(),
                remove: vi.fn(),
                getById: vi.fn(),
            },
        }
        globalThis.lgs = {
            viewer: {
                terrainProvider: {availability: {}},
                dataSources: {
                    contains:  candidate => candidate === source,
                    getByName: name => name === source.name ? [source] : [],
                },
                scene: {
                    requestRender: vi.fn(),
                },
            },
        }
        vi.spyOn(TrackUtils, 'installTrackWidthUpdater').mockImplementation(() => {})

        const track = {
            slug:    source.name,
            title:   '2D track test',
            visible: true,
            content: {
                type:       'Feature',
                properties: {},
                geometry:   {
                    type:        'LineString',
                    coordinates: [[0, 0], [0.001, 0]],
                },
            },
        }

        await TrackUtils.drawOnce(track)

        expect(source.load).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({clampToGround: true}),
        )
    })

    it('clamps primitive GPX tracks to terrain', async () => {
        const primitive = {polylines: {show: true}, show: true}
        const fromGeoJson = vi.spyOn(GeoJsonPrimitive, 'fromGeoJson').mockReturnValue(primitive)
        vi.spyOn(TrackUtils, 'applyTrackPrimitiveStyle').mockReturnValue(true)

        const source = {
            name: 'track-gpx-altitude-primitive',
            entities: {
                values:    [],
                removeAll: vi.fn(),
            },
        }
        const scene = {
            primitives: {
                add: vi.fn(),
            },
        }
        globalThis.lgs = {
            scene,
            viewer: {
                dataSources: {
                    contains:  candidate => candidate === source,
                    getByName: name => name === source.name ? [source] : [],
                },
                scene: {
                    requestRender: vi.fn(),
                },
            },
        }

        const coordinates = Array.from({length: 4096}, (_, index) => [index / 1000, 48, 100])
        const track = {
            slug:    source.name,
            title:   'GPX altitude primitive test',
            visible: true,
            content: {
                type:       'Feature',
                properties: {},
                geometry:   {
                    type:        'LineString',
                    coordinates,
                },
            },
        }

        await TrackUtils.drawOnce(track, {renderMode: 'primitive'})

        expect(fromGeoJson).toHaveBeenCalledWith(
            expect.objectContaining({geometry: expect.objectContaining({type: 'LineString'})}),
            expect.objectContaining({heightReference: HeightReference.CLAMP_TO_GROUND}),
        )
        expect(scene.primitives.add).toHaveBeenCalledWith(primitive)
    })
})
