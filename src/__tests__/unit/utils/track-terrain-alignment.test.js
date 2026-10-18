/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-terrain-alignment.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-15
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {logicalCoordinateSegmentsFromTrack} from '@Core/ui/replay/JourneyReplayLogicalTrackPath'
import {Track} from '@Core/Track'
import recordedTerrainProfile from '../../fixtures/terrain/font-urle-border-profile.json'
import recordedTerrainCliff from '../../fixtures/terrain/font-urle-local-cliff.json'

const terrainMocks = vi.hoisted(() => ({sampleTerrainHeights: vi.fn()}))

vi.mock('@Utils/cesium/TerrainUtils', () => ({
    TerrainUtils: {sampleTerrainHeights: terrainMocks.sampleTerrainHeights},
}))

import {
    checkTrackTerrainAlignment,
    getTerrainAlignedTrackContent,
    prepareTerrainAlignedTrackContent,
    transformTrackCoordinatesBetweenAnchors,
} from '@Utils/cesium/trackTerrainAlignment'

const EARTH_RADIUS_METERS = 6378137
const provider = {}
const previousLgs = globalThis.lgs

/**
 * Convert a Cesium cartographic position into local east metres for test terrain profiles.
 *
 * @param {object} position - Cesium cartographic position.
 * @returns {number} Approximate east displacement in metres at the equator.
 */
const eastMeters = position => position.longitude * EARTH_RADIUS_METERS

/**
 * Measure the local straight-line distance between test coordinates near the equator.
 *
 * @param {Array<number>} first - First longitude/latitude coordinate in degrees.
 * @param {Array<number>} second - Second longitude/latitude coordinate in degrees.
 * @returns {number} Approximate distance in metres.
 */
const coordinateDistanceMeters = (first, second) => Math.hypot(
    (Number(second[0]) - Number(first[0])) * (Math.PI / 180) * EARTH_RADIUS_METERS,
    (Number(second[1]) - Number(first[1])) * (Math.PI / 180) * EARTH_RADIUS_METERS,
)

/**
 * Convert a local east/north test position into longitude and latitude near the equator.
 *
 * @param {number} east - East displacement in metres.
 * @param {number} north - North displacement in metres.
 * @returns {Array<number>} Longitude and latitude in degrees.
 */
const degreesFromLocalMeters = (east, north) => [
    east * (180 / Math.PI) / EARTH_RADIUS_METERS,
    north * (180 / Math.PI) / EARTH_RADIUS_METERS,
]

/**
 * Build a northbound GPX route with a constant source elevation.
 *
 * @param {number[]} elevations - Altitudes to assign to route points.
 * @returns {object} GeoJSON track fixture.
 */
const routeTrack = elevations => ({
    parent:      'journey-test',
    slug:        'terrain-alignment-test',
    color:       '#ffffff',
    thickness:   2,
    renderStyle: {widthUnit: 'meters', meterWidth: 2},
    content:     {
        type:       'Feature',
        properties: {coordinateProperties: {times: elevations.map((_, index) => `2026-01-01T00:00:0${index}Z`)}},
        geometry:   {
            type:        'LineString',
            coordinates: elevations.map((elevation, index) => [0, index * 0.00005, elevation]),
        },
    },
})

/**
 * Configure the terrain mock to evaluate a height function at sampled eastings.
 *
 * @param {Function} heightAtEastAndNorth - Terrain-height function for local east/north offsets in metres.
 * @returns {void} The shared terrain sampler mock is configured.
 */
const mockTerrain = heightAtEastAndNorth => {
    terrainMocks.sampleTerrainHeights.mockImplementation(async positions => positions.map(position => ({
        ...position,
        height: heightAtEastAndNorth(eastMeters(position), position.latitude * EARTH_RADIUS_METERS),
    })))
}

describe('GPX terrain edge alignment', () => {
    beforeEach(() => {
        terrainMocks.sampleTerrainHeights.mockReset()
        globalThis.lgs = {
            settings: {layers: {terrain: 'terrain-test'}},
            theJourney: {antiCliffCorrection: true, slug: 'journey-test'},
            viewer: {terrainProvider: provider},
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
        globalThis.lgs = previousLgs
    })

    it('preserves the exact 2D route shape under a rigid transform between endpoint anchors', () => {
        const sourceCoordinates = [
            [0, 0, 120],
            [0, 0.00005, 125],
            [0.00005, 0.00005, 130],
        ]
        const firstTarget = [...degreesFromLocalMeters(100, 50), 120]
        const lastTarget = [...degreesFromLocalMeters(100 - 5.56, 50 + 5.56), 130]

        const result = transformTrackCoordinatesBetweenAnchors(sourceCoordinates, firstTarget, lastTarget)

        expect(result).not.toBeNull()
        expect(coordinateDistanceMeters(result.coordinates[0], result.coordinates[1]))
            .toBeCloseTo(coordinateDistanceMeters(sourceCoordinates[0], sourceCoordinates[1]), 2)
        expect(coordinateDistanceMeters(result.coordinates[1], result.coordinates[2]))
            .toBeCloseTo(coordinateDistanceMeters(sourceCoordinates[1], sourceCoordinates[2]), 2)
        expect(coordinateDistanceMeters(result.coordinates[0], result.coordinates[2]))
            .toBeCloseTo(coordinateDistanceMeters(sourceCoordinates[0], sourceCoordinates[2]), 2)
        expect(coordinateDistanceMeters(result.coordinates[0], firstTarget)).toBeLessThan(0.01)
        expect(coordinateDistanceMeters(result.coordinates.at(-1), lastTarget)).toBeLessThan(0.01)
        expect(result.coordinates[0][2]).toBe(120)
        expect(result.coordinates[1][2]).toBe(125)
        expect(result.coordinates[2][2]).toBe(130)
    })

    it('does not inspect the centerline when both trace borders are within the vertical threshold', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(east => Math.abs(east) < 0.1 ? 100 : 200)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.content).toBe(track.content)
        expect(result.changed).toBe(false)
        expect(result.diagnostics).toEqual([])
        expect(terrainMocks.sampleTerrainHeights).toHaveBeenCalledTimes(1)
        expect(terrainMocks.sampleTerrainHeights.mock.calls[0][0]).toHaveLength(6)
        expect(terrainMocks.sampleTerrainHeights.mock.calls[0][0].every(position => Math.abs(eastMeters(position)) > 0.9))
            .toBe(true)
    })

    it('checks every rendered border without entering the correction search', async () => {
        const track = routeTrack([200, 200, 200])
        const progress = []
        mockTerrain(east => east < 0 ? 100 : 200)

        const result = await checkTrackTerrainAlignment(track, {
            onProgress: value => progress.push(value),
            provider,
            traceWidthMeters: 2,
        })

        expect(result).toEqual({status: 'needs-correction', detectedPoints: 3})
        expect(progress.at(-1)).toBe(100)
        expect(progress.every(value => value >= 0 && value <= 100)).toBe(true)
        expect(terrainMocks.sampleTerrainHeights).toHaveBeenCalledOnce()
        expect(terrainMocks.sampleTerrainHeights.mock.calls[0][0]).toHaveLength(6)
    })

    it('reports the current route point and leaves the location callback at the first detected cliff point', async () => {
        const track = routeTrack([200, 200, 200])
        const locations = []
        mockTerrain(east => east < 0 ? 100 : 200)

        await checkTrackTerrainAlignment(track, {
            onLocation: coordinate => locations.push(coordinate),
            provider,
            traceWidthMeters: 2,
        })

        expect(locations).toHaveLength(2)
        expect(locations[0]).toEqual(track.content.geometry.coordinates.at(-1))
        expect(locations.at(-1)).toEqual(track.content.geometry.coordinates[0])
    })

    it('reuses the check-only samples when a clean track is subsequently prepared', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(() => 200)

        await expect(checkTrackTerrainAlignment(track, {provider, traceWidthMeters: 2})).resolves.toEqual({
            status: 'clean',
            detectedPoints: 0,
        })
        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(terrainMocks.sampleTerrainHeights).toHaveBeenCalledOnce()
    })

    it('reports unavailable when terrain samples cannot cover every eligible route point', async () => {
        const track = routeTrack([200, 200, 200])
        terrainMocks.sampleTerrainHeights.mockResolvedValue([])

        await expect(checkTrackTerrainAlignment(track, {provider, traceWidthMeters: 2})).resolves.toEqual({
            status: 'unavailable',
            detectedPoints: 0,
        })
    })

    it('moves toward the compatible side when only one border exceeds the threshold', async () => {
        const track = routeTrack([200, 200, 200])
        const sourceCoordinates = structuredClone(track.content.geometry.coordinates)
        const progress = []
        mockTerrain(east => east < 0 ? 100 : 200)

        const result = await prepareTerrainAlignedTrackContent(track, {
            onProgress: value => progress.push(value),
            provider,
            traceWidthMeters: 2,
        })

        expect(result.changed).toBe(true)
        expect(progress.length).toBeGreaterThan(2)
        expect(progress.at(-1)).toBe(100)
        expect(result.diagnostics).toEqual([])
        expect(result.content.geometry.coordinates[1][0]).toBeGreaterThan(0)
        expect(result.corrections).toContainEqual({
            segmentIndex: 0,
            coordinateIndex: 1,
            sourceCoordinate: sourceCoordinates[1],
            correctedCoordinate: result.content.geometry.coordinates[1],
        })
        expect(result.corrections.every(correction => (
            correction.sourceCoordinate.some((value, index) => value !== correction.correctedCoordinate[index])
        ))).toBe(true)
        expect(getTerrainAlignedTrackContent(track, {provider})).toBe(result.content)
        expect(track.content.geometry.coordinates).toEqual(sourceCoordinates)
        expect(result.content.geometry.coordinates[1][2]).toBe(200)
        expect(result.content.properties.coordinateProperties.times).toEqual(track.content.properties.coordinateProperties.times)
    })

    it('returns source GPX geometry when the owning Journey disables correction', async () => {
        const track = routeTrack([200, 200, 200])
        track.parent = 'journey-a'
        const journey = {antiCliffCorrection: true, slug: 'journey-a'}
        globalThis.lgs = {
            settings: {layers: {terrain: 'terrain-a'}},
            theJourney: journey,
            viewer: {terrainProvider: provider},
        }
        mockTerrain(east => east < 0 ? 100 : 200)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(getTerrainAlignedTrackContent(track, {provider})).toBe(result.content)
        journey.antiCliffCorrection = false
        expect(getTerrainAlignedTrackContent(track, {provider})).toBe(track.content)
    })

    it('reapplies only saved coordinates when the persisted terrain matches the active terrain', async () => {
        const track = routeTrack([200, 200, 200])
        track.parent = 'journey-a'
        track.slug = 'route-a'
        const sourceCoordinate = [...track.content.geometry.coordinates[1]]
        const correctedCoordinate = [sourceCoordinate[0] + 0.00001, sourceCoordinate[1], sourceCoordinate[2]]
        const journey = {
            antiCliffCorrection: true,
            antiCliffCorrectionData: {
                terrainId: 'terrain-a',
                tracks: {
                    'route-a': [{
                        segmentIndex: 0,
                        coordinateIndex: 1,
                        sourceCoordinate,
                        correctedCoordinate,
                    }],
                },
            },
            slug: 'journey-a',
        }
        globalThis.lgs = {
            settings: {layers: {terrain: 'terrain-a'}},
            theJourney: journey,
            viewer: {terrainProvider: provider},
        }

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.persisted).toBe(true)
        expect(result.changed).toBe(true)
        expect(result.content.geometry.coordinates[1]).toEqual(correctedCoordinate)
        expect(track.content.geometry.coordinates[1]).toEqual(sourceCoordinate)
        expect(terrainMocks.sampleTerrainHeights).not.toHaveBeenCalled()
        expect(getTerrainAlignedTrackContent(track, {provider}).geometry.coordinates[1]).toEqual(correctedCoordinate)
        expect(logicalCoordinateSegmentsFromTrack(track)[0][1]).toEqual(correctedCoordinate)
    })

    it('turns correction off and keeps source geometry when the terrain id changes', async () => {
        const track = routeTrack([200, 200, 200])
        track.parent = 'journey-a'
        track.slug = 'route-a'
        const sourceCoordinate = [...track.content.geometry.coordinates[1]]
        const journey = {
            antiCliffCorrection: true,
            antiCliffCorrectionData: {
                terrainId: 'terrain-a',
                tracks: {
                    'route-a': [{
                        segmentIndex: 0,
                        coordinateIndex: 1,
                        sourceCoordinate,
                        correctedCoordinate: [sourceCoordinate[0] + 0.00001, ...sourceCoordinate.slice(1)],
                    }],
                },
            },
            persistToDatabase: vi.fn(async () => {}),
            slug: 'journey-a',
        }
        globalThis.lgs = {
            settings: {layers: {terrain: 'terrain-b'}},
            theJourney: journey,
            viewer: {terrainProvider: provider},
        }

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})
        await vi.waitFor(() => expect(journey.persistToDatabase).toHaveBeenCalledOnce())

        expect(result.persisted).toBe(false)
        expect(result.content).toBe(track.content)
        expect(journey.antiCliffCorrection).toBe(false)
        expect(terrainMocks.sampleTerrainHeights).not.toHaveBeenCalled()
    })

    it('preserves the enabled Journey and saved points while the terrain id is unavailable', () => {
        const track = routeTrack([200, 200, 200])
        track.parent = 'journey-a'
        track.slug = 'route-a'
        const journey = {
            antiCliffCorrection: true,
            antiCliffCorrectionData: {terrainId: 'terrain-a', tracks: {'route-a': []}},
            persistToDatabase: vi.fn(async () => {}),
            slug: 'journey-a',
        }
        globalThis.lgs = {
            settings: {layers: {terrain: null}},
            theJourney: journey,
            viewer: {terrainProvider: provider},
        }

        expect(getTerrainAlignedTrackContent(track, {provider})).toBe(track.content)
        expect(journey.antiCliffCorrection).toBe(true)
        expect(journey.antiCliffCorrectionData).toEqual({terrainId: 'terrain-a', tracks: {'route-a': []}})
        expect(journey.persistToDatabase).not.toHaveBeenCalled()
        expect(terrainMocks.sampleTerrainHeights).not.toHaveBeenCalled()
    })

    it('corrects the complete onset and recovery of a 30-metre terrain break with points every 5.5 metres', async () => {
        const track = routeTrack(Array.from({length: 33}, () => 200))
        const sourceCoordinates = structuredClone(track.content.geometry.coordinates)
        mockTerrain((east, north) => north < 50 || north > 79 || east >= 12
            ? 200
            : 200 - Math.min(40, (north - 45) * 8 / 5.5))

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        const coordinates = result.content.geometry.coordinates
        const offsets = coordinates.map(coordinate => coordinate[0] * (Math.PI / 180) * EARTH_RADIUS_METERS)
        expect(offsets.slice(9, 15).every(offset => offset > 13)).toBe(true)
        expect(Math.max(...offsets.slice(9, 15)) - Math.min(...offsets.slice(9, 15))).toBeLessThan(1)
        expect(offsets.slice(4, 9).some(offset => offset > 0)).toBe(true)
        expect(offsets.slice(15, 21).some(offset => offset > 0)).toBe(true)
        expect(coordinates[0]).toEqual(sourceCoordinates[0])
        expect(coordinates.at(-1)).toEqual(sourceCoordinates.at(-1))
        expect(coordinates.every(coordinate => coordinate[2] === 200)).toBe(true)
        expect(track.content.geometry.coordinates).toEqual(sourceCoordinates)
        offsets.slice(1).forEach((offset, index) => {
            expect(Math.abs(offset - offsets[index])).toBeLessThan(11.2)
        })
    })

    it('follows the nearest safe cliff edge while carrying the previous correction forward', async () => {
        const track = routeTrack(Array.from({length: 8}, () => 200))
        const cliffBoundary = north => 10 + (north * 0.12)
        mockTerrain((east, north) => east >= cliffBoundary(north) ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        const eastOffsets = result.content.geometry.coordinates.map(coordinate => (
            coordinate[0] * (Math.PI / 180) * EARTH_RADIUS_METERS
        ))
        const nearestSafeMargins = result.content.geometry.coordinates.map((coordinate, index) => {
            const north = coordinate[1] * (Math.PI / 180) * EARTH_RADIUS_METERS
            return eastOffsets[index] - cliffBoundary(north)
        })

        expect(nearestSafeMargins.every(margin => margin >= 3 && margin <= 8)).toBe(true)
        expect(eastOffsets.at(-1) - eastOffsets[0]).toBeGreaterThan(2)
        eastOffsets.slice(1).forEach((offset, index) => {
            expect(Math.abs(offset - eastOffsets[index])).toBeLessThan(3)
        })
    })

    it('detects a multi-point residual drop even when individual border errors stay below twenty metres', async () => {
        const track = routeTrack([200, 200, 200, 200])
        const residuals = [0, 15, -15, 0]
        mockTerrain((east, north) => 200 + residuals[Math.round(north / 5.566)])

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.diagnostics.map(diagnostic => diagnostic.coordinateIndex)).toEqual([1, 2])
        expect(result.diagnostics.every(diagnostic => diagnostic.detectionReason === 'longitudinal-break')).toBe(true)
        expect(result.diagnostics.every(diagnostic => diagnostic.terrainBreakMeters === 30)).toBe(true)
    })

    it.each([52, -52])('registers a stable %s-metre vertical reference before correcting a local cliff', async offset => {
        const track = routeTrack(Array.from({length: 80}, (_, index) => 200 + index))
        const sourceCoordinates = structuredClone(track.content.geometry.coordinates)
        const spacing = 0.00005 * Math.PI / 180 * EARTH_RADIUS_METERS
        mockTerrain((east, north) => {
            const reference = 200 + north / spacing + offset
            return north < 50 || north > 79 || east >= 12
                ? reference
                : reference - Math.min(40, (north - 45) * 8 / 5.5)
        })

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.verticalReference.offsetMeters).toBeCloseTo(offset, 5)
        expect(result.verticalReference.inlierCount).toBeGreaterThan(70)
        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        expect(result.content.geometry.coordinates.slice(9, 15).every(coordinate => coordinate[0] > 0)).toBe(true)
        expect(result.content.geometry.coordinates.every((coordinate, index) => coordinate[2] === sourceCoordinates[index][2])).toBe(true)
        expect(result.content.geometry.coordinates[0]).toEqual(sourceCoordinates[0])
        expect(track.content.geometry.coordinates).toEqual(sourceCoordinates)
    })

    it('does not invent a vertical reference when the residuals have no stable majority', async () => {
        const track = routeTrack(Array.from({length: 40}, (_, index) => 200 + index))
        const spacing = 0.00005 * Math.PI / 180 * EARTH_RADIUS_METERS
        mockTerrain((east, north) => 200 + north / spacing + 25 + north / spacing)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.verticalReference.offsetMeters).toBe(0)
        expect(result.changed).toBe(false)
        expect(result.diagnostics).toHaveLength(40)
    })

    it('detects the recorded multi-point cliff sections in the 2140-point Font d’Urle terrain profile', async () => {
        const samples = recordedTerrainProfile.samples
        const track = routeTrack(samples.map(sample => sample[1]))
        track.content.geometry.coordinates = samples.map(([distance, elevation]) => [...degreesFromLocalMeters(0, distance), elevation])
        mockTerrain((east, north) => {
            let low = 0
            let high = samples.length - 1
            while (high - low > 1) {
                const middle = Math.floor((low + high) / 2)
                if (samples[middle][0] <= north) low = middle
                else high = middle
            }
            const progress = Math.max(0, Math.min(1, (north - samples[low][0]) / (samples[high][0] - samples[low][0])))
            const left = samples[low][2] + (samples[high][2] - samples[low][2]) * progress
            const right = samples[low][3] + (samples[high][3] - samples[low][3]) * progress
            return left + (right - left) * Math.max(0, Math.min(1, (east + 1) / 2))
        })

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.verticalReference.offsetMeters).toBeCloseTo(recordedTerrainProfile.expected.verticalReferenceOffset, 2)
        expect(result.statistics.detectedPoints).toBe(recordedTerrainProfile.expected.detectedPoints)
        expect(result.statistics.sections).toBe(recordedTerrainProfile.expected.sections)
        expect(result.statistics.detectedPoints).toBeLessThan(samples.length / 10)
        expect(result.diagnostics.some(point => point.terrainBreakMeters > 130)).toBe(true)
    }, 30000)

    it('corrects a recorded Font d’Urle cliff bend and verifies both final borders against the recorded terrain patch', async () => {
        const {grid} = recordedTerrainCliff
        /** Interpolate the recorded height grid without making any terrain network requests. */
        const heightAt = (east, north) => {
            const x = (east - grid.minEast) / grid.step
            const y = (north - grid.minNorth) / grid.step
            if (x < 0 || y < 0 || x >= grid.columns - 1 || y >= grid.rows - 1) return undefined
            const column = Math.floor(x)
            const row = Math.floor(y)
            const dx = x - column
            const dy = y - row
            const index = row * grid.columns + column
            const first = grid.heights[index] * (1 - dx) + grid.heights[index + 1] * dx
            const second = grid.heights[index + grid.columns] * (1 - dx) + grid.heights[index + grid.columns + 1] * dx
            return first * (1 - dy) + second * dy
        }
        const track = routeTrack(recordedTerrainCliff.coordinates.map(coordinate => coordinate[2]))
        track.content.geometry.coordinates = recordedTerrainCliff.coordinates.map(([east, north, elevation]) => [...degreesFromLocalMeters(east, north), elevation])
        const sourceCoordinates = structuredClone(track.content.geometry.coordinates)
        mockTerrain(heightAt)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.statistics.detectedPoints).toBeGreaterThanOrEqual(14)
        expect(result.statistics.correctedDetectedPoints).toBeGreaterThanOrEqual(12)
        const local = result.content.geometry.coordinates.map(coordinate => [
            coordinate[0] * Math.PI / 180 * EARTH_RADIUS_METERS,
            coordinate[1] * Math.PI / 180 * EARTH_RADIUS_METERS,
            coordinate[2],
        ])
        result.content.geometry.coordinates.forEach((coordinate, index) => {
            if (coordinateDistanceMeters(coordinate, sourceCoordinates[index]) < 0.01) return
            const previous = local[Math.max(0, index - 1)]
            const next = local[Math.min(local.length - 1, index + 1)]
            const deltaEast = next[0] - previous[0]
            const deltaNorth = next[1] - previous[1]
            const length = Math.hypot(deltaEast, deltaNorth)
            const errors = [-1, 1].map(side => Math.abs(heightAt(
                local[index][0] + side * deltaNorth / length,
                local[index][1] - side * deltaEast / length,
            ) - coordinate[2] - result.verticalReference.offsetMeters))
            expect(Math.max(...errors)).toBeLessThanOrEqual(20.000001)
            expect(Math.min(...errors)).toBeLessThanOrEqual(5.000001)
        })
        expect(track.content.geometry.coordinates).toEqual(sourceCoordinates)
    }, 30000)

    it('keeps a genuine steep GPX descent when terrain and GPX elevations descend together', async () => {
        const elevations = [200, 185, 160, 130, 90]
        const track = routeTrack(elevations)
        mockTerrain((east, north) => elevations[Math.round(north / 5.566)])

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.content).toBe(track.content)
        expect(result.diagnostics).toEqual([])
    })

    it('does not propagate longitudinal detection across distinct GPX segments', async () => {
        const track = routeTrack([200, 200, 200, 200])
        const coordinates = track.content.geometry.coordinates
        track.content.geometry = {type: 'MultiLineString', coordinates: [coordinates.slice(0, 2), coordinates.slice(2)]}
        mockTerrain((east, north) => north < 8 ? 215 : 185)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.diagnostics).toEqual([])
    })

    it('refines the nearest compliant offset to one-metre precision', async () => {
        const track = routeTrack([200, 200, 200])
        terrainMocks.sampleTerrainHeights.mockImplementation(async positions => positions.map((position) => {
            const east = eastMeters(position)
            return {...position, height: east < 0 ? 100 : 100 + (east * 2)}
        }))

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        const correctedEastMeters = result.content.geometry.coordinates[1][0] * (Math.PI / 180) * EARTH_RADIUS_METERS
        expect(correctedEastMeters).toBeGreaterThan(46.5)
        expect(correctedEastMeters).toBeLessThan(47.5)
    })

    it.each([0.5, 1, 1.5, 2, 2.5])('keeps the full %s-metre trace width on the safe side of a cliff boundary', async traceWidthMeters => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(east => east >= 10 ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters})

        expect(result.changed, JSON.stringify(result.diagnostics)).toBe(true)
        expect(result.diagnostics).toEqual([])
        const correctedEastMeters = result.content.geometry.coordinates[1][0] * (Math.PI / 180) * EARTH_RADIUS_METERS
        const nearestSafeOffset = 10 + traceWidthMeters / 2 + 2.5
        expect(correctedEastMeters).toBeGreaterThanOrEqual(nearestSafeOffset - 1e-6)
        expect(correctedEastMeters).toBeLessThanOrEqual(nearestSafeOffset + 0.5 + 1e-6)
    })

    it('uses a shared XY translation around a bend when route-normal searches cannot fix its eastbound points', async () => {
        const track = routeTrack(Array.from({length: 9}, () => 200))
        const localPoints = [[0, 0], [0, 5], [0, 10], [5, 10], [10, 10], [15, 10], [20, 10], [25, 10], [30, 10]]
        track.content.geometry.coordinates = localPoints.map(([east, north]) => [...degreesFromLocalMeters(east, north), 200])
        const sourceCoordinates = structuredClone(track.content.geometry.coordinates)
        mockTerrain(east => east >= 12 ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        const coordinates = result.content.geometry.coordinates
        for (let index = 0; index < 5; index += 1) {
            const deltaEast = (coordinates[index][0] - sourceCoordinates[index][0]) * Math.PI / 180 * EARTH_RADIUS_METERS
            const deltaNorth = (coordinates[index][1] - sourceCoordinates[index][1]) * Math.PI / 180 * EARTH_RADIUS_METERS
            expect(deltaEast).toBeGreaterThan(15)
            expect(Math.abs(deltaNorth)).toBeLessThan(0.1)
            if (index > 0) {
                expect(coordinateDistanceMeters(coordinates[index - 1], coordinates[index])).toBeCloseTo(5, 1)
            }
        }
        expect(track.content.geometry.coordinates).toEqual(sourceCoordinates)
    })

    it('rejects an altitude-matching candidate that lies on a steep cliff face', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(east => east < 10
            ? 100
            : east < 15
                ? 100 + ((east - 10) * 20)
                : 200)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        const correctedEastMeters = result.content.geometry.coordinates[1][0] * (Math.PI / 180) * EARTH_RADIUS_METERS
        expect(correctedEastMeters).toBeGreaterThan(17)
        expect(correctedEastMeters).toBeLessThan(18)
    })

    it('rejects a candidate when a narrow cliff drop lies between the profile endpoints', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(east => east < 10 || (east > 14.4 && east < 14.6) ? 100 : 200)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        const correctedEastMeters = result.content.geometry.coordinates[1][0] * (Math.PI / 180) * EARTH_RADIUS_METERS
        expect(correctedEastMeters).toBeGreaterThan(18.49)
        expect(correctedEastMeters).toBeLessThan(19.5)
    })

    it('finds a narrow compatible corridor between the former five-metre lateral search steps', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(east => east >= 9 && east <= 17 ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        const correctedEastMeters = result.content.geometry.coordinates[1][0] * (Math.PI / 180) * EARTH_RADIUS_METERS
        expect(correctedEastMeters).toBeGreaterThanOrEqual(12.49)
        expect(correctedEastMeters).toBeLessThanOrEqual(13.5)
    })

    it('marks the route when its only altitude match is on a cliff face', async () => {
        const track = routeTrack([150, 150, 150])
        mockTerrain(east => east < 10
            ? 100
            : east < 25
                ? 100 + ((east - 10) * 5)
                : 250)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.content).toBe(track.content)
        expect(result.diagnostics).toHaveLength(3)
        expect(result.diagnostics.every(diagnostic => diagnostic.reason === 'cliff-candidate-rejected'))
            .toBe(true)
    })

    it('keeps a verified nearby correction when the opposite search loses terrain farther away', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain((east) => {
            if (east < -24) {
                return undefined
            }

            return east >= 12 ? 200 : 100
        })

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        expect(result.content.geometry.coordinates[1][0]).toBeGreaterThan(0)
    })

    it('keeps verified neighboring corrections when one GPX point has no matching terrain', async () => {
        const track = routeTrack(Array.from({length: 7}, () => 200))
        mockTerrain((east, north) => north > 15 && north < 18 ? 100 : east >= 0 ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.statistics.correctedDetectedPoints).toBe(6)
        expect(result.diagnostics).toHaveLength(1)
        expect(result.diagnostics[0].coordinateIndex).toBe(3)
        expect(result.diagnostics[0].reason).toBe('no-matching-terrain')
        expect(result.content.geometry.coordinates[3]).toEqual(track.content.geometry.coordinates[3])
    })

    it('isolates a rejected terrain batch so available route points can still be aligned', async () => {
        const track = routeTrack([200, 200, 200])
        terrainMocks.sampleTerrainHeights.mockImplementation(async positions => {
            if (positions.some(position => Math.abs((position.latitude * EARTH_RADIUS_METERS) - 5.56) < 0.25)) {
                throw new Error('Simulated unavailable terrain tile')
            }

            return positions.map((position) => {
                const east = eastMeters(position)
                return {...position, height: east < 0 ? 100 : 200}
            })
        })

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toHaveLength(1)
        expect(result.diagnostics[0].coordinateIndex).toBe(1)
        expect(result.diagnostics[0].reason).toBe('terrain-unavailable')
        expect(result.content.geometry.coordinates[0][0]).not.toBe(track.content.geometry.coordinates[0][0])
        expect(result.content.geometry.coordinates[2][0]).not.toBe(track.content.geometry.coordinates[2][0])
    })

    it('rejects an isolated correction that would create a large jump from its previous points', async () => {
        const track = routeTrack([200, 200, 200, 200, 200])
        mockTerrain((east, north) => north >= 9 && north <= 13 && east >= 12 ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.content).toBe(track.content)
        expect(result.diagnostics).toHaveLength(5)
        expect(result.diagnostics.find(diagnostic => diagnostic.coordinateIndex === 2)?.reason)
            .toBe('correction-rejected-for-continuity')
    })

    it('rejects a long-distance correction that would pull a cliff section into a deep detour', async () => {
        const track = routeTrack([100, ...Array.from({length: 20}, () => 200), 100])
        mockTerrain(east => east >= 40 ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.content).toBe(track.content)
        expect(result.diagnostics).toHaveLength(20)
        expect(result.diagnostics.every(diagnostic => diagnostic.reason === 'correction-rejected-for-continuity'))
            .toBe(true)
    })

    it('rejects a correction run when the available terrain cannot provide a continuous route', async () => {
        const track = routeTrack([100, ...Array.from({length: 10}, () => 200), 100])
        const originalCoordinates = structuredClone(track.content.geometry.coordinates)
        mockTerrain((east, north) => {
            const matchingEast = north > 26 && north < 30 ? 23 : 10
            return east >= matchingEast ? 200 : 100
        })

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.content).toBe(track.content)
        expect(result.content.geometry.coordinates).toEqual(originalCoordinates)
        expect(result.diagnostics).toHaveLength(10)
        expect(result.diagnostics.every(diagnostic => diagnostic.reason === 'correction-rejected-for-continuity'))
            .toBe(true)
    })

    it('searches both sides when both borders fail and chooses the only matching terrain corridor', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(east => east >= 17 ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        expect(result.content.geometry.coordinates[1][0]).toBeGreaterThan(0)
    })

    it('uses neighboring corrected points to choose the continuous side when the nearest candidate is opposite', async () => {
        const track = routeTrack([200, 200, 200])
        terrainMocks.sampleTerrainHeights.mockImplementation(async positions => positions.map((position) => {
            const east = eastMeters(position)
            const north = position.latitude * EARTH_RADIUS_METERS
            const height = north < 3
                ? (east >= 12 ? 200 : 100)
                : north < 10
                    ? (east <= -5 || east >= 25 ? 200 : 100)
                    : (east >= 35 ? 200 : 100)
            return {...position, height}
        }))

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
        expect(result.content.geometry.coordinates[0][0]).toBeGreaterThan(0)
        expect(result.content.geometry.coordinates[1][0]).toBeGreaterThan(0)
        expect(result.content.geometry.coordinates[2][0]).toBeGreaterThan(0)
    })

    it('keeps duplicate GPX positions out of the failure overlay when a route tangent can be recovered', async () => {
        const track = routeTrack([200, 200, 200, 200])
        track.content.geometry.coordinates = [[0, 0, 200], [0, 0, 200], [0, 0.00005, 200], [0, 0.0001, 200]]
        mockTerrain(east => east < 0 ? 100 : 200)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(true)
        expect(result.diagnostics).toEqual([])
    })

    it('uses the aligned coordinates for the logical replay path', async () => {
        const track = routeTrack([200, 200, 200])
        track.parent = 'journey#gpx'
        globalThis.lgs = {
            settings:   {layers: {terrain: 'terrain-test'}},
            theJourney: {antiCliffCorrection: true, slug: 'journey#gpx'},
            viewer:     {terrainProvider: provider},
        }
        mockTerrain(east => east < 0 ? 100 : 200)

        await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        const replaySegments = logicalCoordinateSegmentsFromTrack(track)
        expect(replaySegments[0][1][0]).toBeGreaterThan(track.content.geometry.coordinates[1][0])
    })

    it('uses the aligned coordinates for track metric calculations without changing GPX content', async () => {
        const track = new Track('terrain-alignment-metrics', {
            slug:        'terrain-alignment-metrics',
            parent:      'journey#gpx',
            activity:    'trek',
            color:       '#ffffff',
            thickness:   2,
            renderStyle: {widthUnit: 'meters', meterWidth: 2},
            hasAltitude: true,
            content:     routeTrack([200, 200, 200]).content,
        })
        const sourceCoordinates = structuredClone(track.content.geometry.coordinates)
        globalThis.lgs = {
            settings:   {layers: {terrain: 'terrain-test'}},
            theJourney: {antiCliffCorrection: true, slug: 'journey#gpx'},
            viewer:     {terrainProvider: provider},
        }
        mockTerrain(east => east < 0 ? 100 : 200)

        const prepared = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})
        expect(prepared.changed).toBe(true)
        expect(prepared.content.geometry.coordinates[1][0]).toBeGreaterThan(sourceCoordinates[1][0])
        track.calculateMetrics()

        expect(track.metrics.points.some(point => point.longitude > sourceCoordinates[1][0])).toBe(true)
        expect(track.content.geometry.coordinates).toEqual(sourceCoordinates)
    })

    it('marks symmetric solutions as ambiguous instead of selecting a cliff side arbitrarily', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(east => Math.abs(east) >= 12 ? 200 : 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.content).toBe(track.content)
        expect(result.diagnostics).toHaveLength(3)
        expect(result.diagnostics.every(diagnostic => diagnostic.reason === 'ambiguous')).toBe(true)
    })

    it('reports points when neither side reaches terrain compatible with the GPX elevation', async () => {
        const track = routeTrack([200, 200, 200])
        mockTerrain(() => 100)

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.content).toBe(track.content)
        expect(result.diagnostics).toHaveLength(3)
        expect(result.diagnostics.every(diagnostic => diagnostic.reason === 'no-matching-terrain')).toBe(true)
    })

    it('reports unavailable terrain samples without modifying source coordinates', async () => {
        const track = routeTrack([200, 200, 200])
        terrainMocks.sampleTerrainHeights.mockImplementation(async positions => positions.map(position => ({
            ...position,
            height: undefined,
        })))

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.diagnostics).toHaveLength(3)
        expect(result.diagnostics.every(diagnostic => diagnostic.reason === 'terrain-unavailable')).toBe(true)
        expect(track.content.geometry.coordinates[1]).toEqual([0, 0.00005, 200])
    })

    it('does not accept a correction when terrain gaps could hide a closer candidate', async () => {
        const track = routeTrack([200, 200, 200])
        terrainMocks.sampleTerrainHeights.mockImplementation(async positions => positions.map((position) => {
            const east = eastMeters(position)
            return {
                ...position,
                height: east < -1.1 ? undefined : east >= 12 ? 200 : 100,
            }
        }))

        const result = await prepareTerrainAlignedTrackContent(track, {provider, traceWidthMeters: 2})

        expect(result.changed).toBe(false)
        expect(result.diagnostics).toHaveLength(3)
        expect(result.diagnostics.every(diagnostic => diagnostic.reason === 'terrain-unavailable')).toBe(true)
    })
})
