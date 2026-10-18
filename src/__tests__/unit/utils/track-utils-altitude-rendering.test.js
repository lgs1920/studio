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
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cartographic, ClassificationType, GeoJsonDataSource, GeoJsonPrimitive, HeightReference } from 'cesium'
import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { TerrainUtils } from '@Utils/cesium/TerrainUtils'
import { prepareTerrainAlignedTrackContent } from '@Utils/cesium/trackTerrainAlignment'

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
            settings: {layers: {terrain: 'terrain-a'}},
            theJourney: {antiCliffCorrection: true, slug: 'journey-track-gpx-altitude-entities'},
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

        vi.spyOn(TerrainUtils, 'sampleTerrainHeights').mockImplementation(async positions => positions.map((position, index) => ({
            ...position,
            height: coordinates[Math.floor(index / 2)][2],
        })))
        vi.spyOn(TrackUtils, 'createTrackMaterial').mockReturnValue({})
        vi.spyOn(TrackUtils, 'installTrackWidthUpdater').mockImplementation(() => {})

        const coordinates = [[0, 0, 10], [0.001, 0, 20], [0.002, 0, 200], [0.003, 0, 210]]
        const track = {
            parent:  'journey-track-gpx-altitude-entities',
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
        expect(TerrainUtils.sampleTerrainHeights).not.toHaveBeenCalled()
    })

    it('draws a distinct diagnostic overlay with altitude errors for terrain mismatches that cannot be aligned', async () => {
        const entitiesById = new Map()
        const source = {name: 'track-terrain-alignment-diagnostic'}
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
            removeAll: () => entitiesById.clear(),
        }
        source.load = vi.fn(async () => {
            source.entities.removeAll()
            source.entities.add({id: 'track-line', polyline: {positions: ['original']}})
        })
        globalThis.lgs = {
            viewer: {
                terrainProvider: {},
                dataSources: {
                    contains:  candidate => candidate === source,
                    getByName: name => name === source.name ? [source] : [],
                },
                scene: {
                    requestRender: vi.fn(),
                },
            },
        }

        vi.spyOn(TerrainUtils, 'sampleTerrainHeights').mockImplementation(async positions => positions.map(position => ({
            ...position,
            height: 100,
        })))
        vi.spyOn(TrackUtils, 'createTrackMaterial').mockReturnValue({})
        vi.spyOn(TrackUtils, 'installTrackWidthUpdater').mockImplementation(() => {})

        const track = {
            parent: 'journey-track-terrain-alignment-diagnostic',
            slug:    source.name,
            title:   'Unresolved terrain track',
            visible: true,
            content: {
                type:       'Feature',
                properties: {},
                geometry:   {
                    type:        'LineString',
                    coordinates: [[0, 0, 200], [0, 0.00005, 200], [0, 0.0001, 200]],
                },
            },
        }
        globalThis.lgs.settings = {layers: {terrain: 'terrain-a'}}
        globalThis.lgs.theJourney = {antiCliffCorrection: true, slug: track.parent}
        await prepareTerrainAlignedTrackContent(track)
        await TrackUtils.drawOnce(track)

        const diagnostics = source.entities.values.filter(entity => entity.id.includes('#lgs-track-terrain-diagnostic#'))
        expect(diagnostics).toHaveLength(1)
        expect(diagnostics.every(entity => entity.point?.color?.green > 0.8)).toBe(true)
        expect(diagnostics.every(entity => !entity.polyline)).toBe(true)
        expect(diagnostics[0].description).toContain('3 consecutive track point(s)')
        expect(diagnostics[0].description).toContain('no-matching-terrain')
        expect(diagnostics[0].description).toContain('maximum terrain/GPX border error: 100.0 m')
    })

    it('renders corrected XY coordinates and recalculates metrics from the aligned geometry', async () => {
        const entitiesById = new Map()
        const source = {name: 'track-terrain-aligned-render'}
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
            removeAll: () => entitiesById.clear(),
        }
        source.load = vi.fn(async content => {
            source.entities.removeAll()
            source.entities.add({id: 'track-line', polyline: {positions: content.geometry.coordinates}})
        })
        globalThis.lgs = {
            settings: {layers: {terrain: 'terrain-a'}},
            theJourney: {antiCliffCorrection: true, slug: 'journey-track-terrain-aligned-render'},
            viewer: {
                terrainProvider: {},
                dataSources: {
                    contains:  candidate => candidate === source,
                    getByName: name => name === source.name ? [source] : [],
                },
                scene: {requestRender: vi.fn()},
            },
        }
        vi.spyOn(TerrainUtils, 'sampleTerrainHeights').mockImplementation(async positions => positions.map(position => ({
            ...position,
            height: position.latitude < 0 ? 100 : 200,
        })))
        vi.spyOn(TrackUtils, 'createTrackMaterial').mockReturnValue({})
        vi.spyOn(TrackUtils, 'installTrackWidthUpdater').mockImplementation(() => {})

        const coordinates = [[0, 0, 200], [0.001, 0, 200], [0.002, 0, 200]]
        const track = {
            parent:  'journey-track-terrain-aligned-render',
            slug:    source.name,
            title:   'Terrain-aligned track',
            visible: true,
            content: {
                type:       'Feature',
                properties: {},
                geometry:   {type: 'LineString', coordinates},
            },
            calculateMetrics: vi.fn(),
        }

        await prepareTerrainAlignedTrackContent(track)
        await TrackUtils.drawOnce(track)

        const loadedCoordinates = source.load.mock.calls[0][0].geometry.coordinates
        expect(loadedCoordinates[1][1]).toBeGreaterThan(0)
        expect(track.calculateMetrics).toHaveBeenCalledWith({content: expect.objectContaining({geometry: {type: 'LineString', coordinates: loadedCoordinates}})})
        expect(track.content.geometry.coordinates).toEqual(coordinates)
    })

    it('loads a complete multi-point cliff correction into real Cesium polyline positions', async () => {
        const earthRadius = 6378137
        const source = new GeoJsonDataSource('track-real-cesium-cliff')
        globalThis.lgs = {
            settings: {layers: {terrain: 'terrain-a'}},
            theJourney: {antiCliffCorrection: true, slug: 'journey-real-cesium-cliff'},
            viewer: {
                terrainProvider: {},
                dataSources: {
                    contains: candidate => candidate === source,
                    getByName: name => name === 'track-real-cesium-cliff' ? [source] : [],
                },
                scene: {requestRender: vi.fn()},
            },
        }
        vi.spyOn(TerrainUtils, 'sampleTerrainHeights').mockImplementation(async positions => positions.map(position => {
            const east = position.longitude * earthRadius
            const north = position.latitude * earthRadius
            return {
                ...position,
                height: north < 50 || north > 79 || east >= 12 ? 200 : 200 - Math.min(40, (north - 45) * 8 / 5.5),
            }
        }))
        vi.spyOn(TrackUtils, 'installTrackWidthUpdater').mockImplementation(() => {})
        const coordinates = Array.from({length: 33}, (_, index) => [0, index * 0.00005, 200])
        const track = {
            parent: 'journey-real-cesium-cliff',
            slug:   'track-real-cesium-cliff',
            visible: true,
            renderStyle: {widthUnit: 'meters', meterWidth: 2},
            content: {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates}},
        }

        await prepareTerrainAlignedTrackContent(track)
        await TrackUtils.drawOnce(track)

        const aligned = source.__lgsTrackAlignedContent.geometry.coordinates
        const basePolyline = source.entities.values.find(entity => entity.polyline && !entity.id.includes('#lgs-track-style#'))
        const positions = basePolyline.polyline.positions.getValue()
        expect(positions).toHaveLength(coordinates.length)
        for (let index = 9; index <= 14; index += 1) {
            const rendered = Cartographic.fromCartesian(positions[index])
            expect(rendered.longitude * earthRadius).toBeGreaterThan(13)
            expect(rendered.longitude * 180 / Math.PI).toBeCloseTo(aligned[index][0], 10)
        }
        expect(basePolyline.polyline.clampToGround.getValue()).toBe(true)
        expect(source.entities.values.some(entity => entity.id.includes('#lgs-track-terrain-diagnostic#'))).toBe(false)
        expect(source.__lgsTrackTerrainAlignmentSummary.statistics.detectedPoints).toBe(6)
        expect(track.content.geometry.coordinates).toEqual(coordinates)
    })

    it('includes the longitudinal break and vertical reference in unresolved map diagnostics', () => {
        const source = new GeoJsonDataSource('track-cliff-description')

        TrackUtils.updateTerrainAlignmentDiagnostics(source, {slug: source.name}, [{
            segmentIndex: 0,
            coordinateIndex: 1,
            coordinate: [0, 0, 200],
            reason: 'correction-rejected-for-continuity',
            borderErrorsMeters: [-45, -50],
            terrainBreakMeters: 139,
            heightReferenceOffsetMeters: 51.9,
        }])

        const description = source.entities.values[0].description.getValue()
        expect(description).toContain('maximum longitudinal residual break: 139.0 m')
        expect(description).toContain('vertical comparison offset: 51.9 m')
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
        const terrainSample = vi.spyOn(TerrainUtils, 'sampleTerrainHeights').mockResolvedValue([])

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
        expect(terrainSample).not.toHaveBeenCalled()
        expect(source.__lgsTrackTerrainAlignmentEnabled).toBe(false)
    })
})
