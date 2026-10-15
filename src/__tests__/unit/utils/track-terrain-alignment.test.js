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
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const terrainMocks = vi.hoisted(() => ({sampleTerrainHeights: vi.fn()}))

vi.mock('@Utils/cesium/TerrainUtils', () => ({
    TerrainUtils: {sampleTerrainHeights: terrainMocks.sampleTerrainHeights},
}))

import {getTerrainAlignedTrackRenderContent} from '@Utils/cesium/trackTerrainAlignment'

const METERS_PER_DEGREE = 111320
const provider = {}

/** Convert Cesium cartographic coordinates to degrees for terrain fixtures. */
const degreesOf = position => ({
    longitude: position.longitude * (180 / Math.PI),
    latitude:  position.latitude * (180 / Math.PI),
})

/** Build a northbound route with the supplied GPX altitude samples. */
const routeContent = altitudes => ({
    type: 'Feature',
    geometry: {
        type: 'LineString',
        coordinates: altitudes.map((altitude, index) => [0, index * 0.0001, altitude]),
    },
    properties: {},
})

describe('terrain alignment for rendered tracks', () => {
    beforeEach(() => {
        terrainMocks.sampleTerrainHeights.mockReset()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('leaves ordinary traces unchanged when the nearby terrain has no cliff wall', async () => {
        const content = routeContent([120, 120, 120, 120, 120])
        terrainMocks.sampleTerrainHeights.mockImplementation(async positions => positions.map(position => {
            const {longitude, latitude} = degreesOf(position)
            const northMeters = latitude * METERS_PER_DEGREE
            const eastMeters = longitude * METERS_PER_DEGREE
            return {...position, height: 100 + (northMeters * 3) + (eastMeters * 0.1)}
        }))

        const aligned = await getTerrainAlignedTrackRenderContent(content, {provider})

        expect(aligned).toBe(content)
        expect(aligned.geometry.coordinates).toEqual(content.geometry.coordinates)
    })

    it('blends a cliff correction into adjacent points to avoid a sharp trace kink', async () => {
        const content = routeContent([200, 200, 200, 200, 200])
        terrainMocks.sampleTerrainHeights.mockImplementation(async positions => positions.map(position => {
            const {longitude, latitude} = degreesOf(position)
            const isMisalignedCliffPoint = Math.abs(latitude - 0.0002) < 1e-8
            const height = isMisalignedCliffPoint && longitude <= 0 ? 100 : 200
            return {...position, height}
        }))

        const aligned = await getTerrainAlignedTrackRenderContent(content, {
            provider,
            traceWidthMeters: 6,
        })

        expect(aligned).not.toBe(content)
        expect(aligned.geometry.coordinates[0]).toEqual(content.geometry.coordinates[0])
        expect(aligned.geometry.coordinates[1][0]).toBeGreaterThan(content.geometry.coordinates[1][0])
        expect(aligned.geometry.coordinates[2][0]).toBeGreaterThan(aligned.geometry.coordinates[1][0])
        expect(aligned.geometry.coordinates[2][0]).toBeGreaterThan(aligned.geometry.coordinates[3][0])
        expect(aligned.geometry.coordinates[3][0]).toBeGreaterThan(content.geometry.coordinates[3][0])
        expect((aligned.geometry.coordinates[2][0] - content.geometry.coordinates[2][0]) * METERS_PER_DEGREE)
            .toBeCloseTo(5.5, 1)
        expect(aligned.geometry.coordinates[2][2]).toBe(content.geometry.coordinates[2][2])
        expect(aligned.geometry.coordinates[4]).toEqual(content.geometry.coordinates[4])
    })
})
