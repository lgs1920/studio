/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-geometry.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-20
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {
    cloneCorrectionList,
    findClosestRoutePosition,
    getControlPointCoordinate,
    isRouteCoordinateScreenHit,
    projectEditOverlay,
} from '@Components/MainUI/FixPathEditorGeometry'
import {getFixPathSegmentDistanceMeters, getFixPathSourceFingerprint} from '@Utils/cesium/fixPathCorrections'
import {Cartesian3} from 'cesium'

describe('Fix Path editor geometry', () => {
    it('checks nearby route hits against the terrain at the route pixel instead of the pointer pixel', () => {
        const coordinate = [1, 2, 0]
        const worldPosition = Cartesian3.fromDegrees(1, 2, 0.5)
        const nearerSlope = Cartesian3.fromDegrees(1, 2, 500)
        const projectedPosition = {x: 105, y: 205}
        const scene = {
            globe: {getHeight: () => 0},
            cartesianToCanvasCoordinates: () => projectedPosition,
            pickPositionSupported: true,
            pickPosition: vi.fn(position => position.x === 105 && position.y === 205 ? worldPosition : nearerSlope),
        }
        const camera = {positionWC: Cartesian3.fromDegrees(1, 2, 1000)}

        expect(isRouteCoordinateScreenHit(scene, camera, {x: 110, y: 200}, coordinate)).toBe(true)
        expect(scene.pickPosition).toHaveBeenCalledWith(projectedPosition)

        scene.pickPosition.mockReturnValue(nearerSlope)
        expect(isRouteCoordinateScreenHit(scene, camera, {x: 110, y: 200}, coordinate)).toBe(false)
        scene.pickPosition.mockClear()
        expect(isRouteCoordinateScreenHit(scene, camera, {x: 140, y: 200}, coordinate)).toBe(false)
        expect(scene.pickPosition).not.toHaveBeenCalled()
    })

    it('finds the nearest route interval across a MultiLineString and the antimeridian', () => {
        const geometry = {
            type: 'MultiLineString',
            coordinates: [
                [[179.999, 0, 0], [-179.999, 0, 0]],
                [[0, 0, 0], [0.001, 0, 0]],
            ],
        }

        expect(findClosestRoutePosition(geometry, [-180, 0.0001]))
            .toMatchObject({segmentIndex: 0, index: 0})
        expect(findClosestRoutePosition(geometry, [-180, 0.0001]).progress).toBeCloseTo(0.5, 6)
        expect(findClosestRoutePosition(geometry, [-180, 0.0001]).distanceMeters).toBeCloseTo(11.1, 0)
        expect(findClosestRoutePosition(geometry, [-180, 0.0001]).coordinate).toEqual([-180, 0, 0])
        expect(findClosestRoutePosition(geometry, [Number.NaN, 0])).toBeNull()
    })

    it('snaps a picked position to the route and interpolates its elevation', () => {
        const geometry = {
            type: 'LineString',
            coordinates: [[0, 0, 10], [0.001, 0, 30]],
        }

        const routePosition = findClosestRoutePosition(geometry, [0.0005, 0.0001])

        expect(routePosition.coordinate[0]).toBeCloseTo(0.0005, 8)
        expect(routePosition.coordinate[1]).toBe(0)
        expect(routePosition.coordinate[2]).toBeCloseTo(20, 8)
    })

    it('restores one source-point neighbor around a persisted edit at each section edge', () => {
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: Array.from({length: 5}, (_, index) => [index * 0.01, 0, index * 10]),
            },
        }
        const savedCorrection = {
            id: 'sparse-section',
            segmentIndex: 0,
            startIndex: 2,
            endIndex: 2,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 2, 2),
            controlPoints: [{
                id: 'fix-point-0-2',
                sourceIndex: 2,
                progress: 0.5,
                coordinate: [0.00002, 0.00001, 20],
                fixed: true,
            }],
        }

        const [restored] = cloneCorrectionList([savedCorrection], content)

        expect(getFixPathSegmentDistanceMeters(content, 0, 1, 3)).toBeGreaterThan(500)
        expect(restored.startIndex).toBe(1)
        expect(restored.endIndex).toBe(3)
        expect(restored.controlPoints.map(point => point.sourceIndex)).toEqual([1, 2, 3])
        expect(restored.controlPoints.map(point => point.fixed)).toEqual([false, true, false])
        expect(restored.sourceFingerprint).toBe(getFixPathSourceFingerprint(content, 0, 1, 3))
    })

    it('preserves a newly added manual point without synthesizing neighboring route points', () => {
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: Array.from({length: 5}, (_, index) => [index * 0.01, 0, index * 10]),
            },
        }
        const adjacentCorrection = {
            id: 'neighboring-source-section',
            segmentIndex: 0,
            startIndex: 0,
            endIndex: 1,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 0, 1),
            controlPoints: [0, 1].map(sourceIndex => ({
                id: 'fix-point-0-' + sourceIndex,
                sourceIndex,
                progress: sourceIndex,
                coordinate: content.geometry.coordinates[sourceIndex],
                fixed: false,
                removed: false,
            })),
        }
        const correction = {
            id: 'manual-point-section',
            segmentIndex: 0,
            startIndex: 2,
            endIndex: 3,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 2, 3),
            controlPoints: [{
                id: 'manual-point',
                progress: 0.5,
                coordinate: [0.025, 0.001, 25],
                fixed: true,
                removed: false,
            }],
        }

        const restoredCorrections = cloneCorrectionList([adjacentCorrection, correction], content)
        const restored = restoredCorrections.find(item => item.id === correction.id)

        expect(restoredCorrections).toHaveLength(2)
        expect(restored.controlPoints).toHaveLength(1)
        expect(restored.controlPoints[0]).toMatchObject({id: 'manual-point', coordinate: [0.025, 0.001, 25]})
    })

    it('retains erased source-point status when a saved correction is reloaded', () => {
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: Array.from({length: 3}, (_, index) => [index * 0.00001, 0, index * 10]),
            },
        }
        const savedCorrection = {
            id: 'section-with-erasure',
            segmentIndex: 0,
            startIndex: 0,
            endIndex: 2,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 0, 2),
            controlPoints: [{
                id: 'fix-point-0-1',
                sourceIndex: 1,
                progress: 0.5,
                coordinate: content.geometry.coordinates[1],
                fixed: false,
                removed: true,
                erased: true,
            }],
        }

        const [restored] = cloneCorrectionList([savedCorrection], content)

        expect(restored.controlPoints.find(point => point.sourceIndex === 1))
            .toMatchObject({removed: true, erased: true})
    })

    it('keeps unmodified source controls on the original GPX geometry', () => {
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[0, 0, 10], [0.001, 0.002, 20], [0.002, 0, 30]],
            },
        }
        const correctedContent = {
            ...content,
            geometry: {
                ...content.geometry,
                coordinates: [[0, 0, 10], [0.001, 0.0005, 20], [0.002, 0, 30]],
            },
        }
        const correction = {segmentIndex: 0, startIndex: 0, endIndex: 2}
        const point = {
            id: 'fix-point-0-1',
            sourceIndex: 1,
            progress: 0.5,
            coordinate: [0.001, 0.002, 20],
            fixed: false,
        }

        expect(getControlPointCoordinate(content, correction, point, correctedContent)).toEqual([0.001, 0.002, 20])
        expect(getControlPointCoordinate(content, correction, {...point, fixed: true, coordinate: [0.001, 0.003, 24]}, correctedContent))
            .toEqual([0.001, 0.003, 24])
    })

    it('ignores null elevations when interpolating the altitude of a manual control point', () => {
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[0, 0, null], [0.001, 0, 100]],
            },
        }
        const correction = {segmentIndex: 0, startIndex: 0, endIndex: 1}
        const point = {
            id: 'manual-control',
            progress: 0.25,
            coordinate: [0.00025, 0.001, null],
            fixed: true,
        }

        expect(getControlPointCoordinate(content, correction, point)[2]).toBe(100)
    })

    it('performs one terrain visibility query for control points in the same screen cell', () => {
        const worldPosition = Cartesian3.fromDegrees(0, 0, 0)
        const scene = {
            camera: {positionWC: Cartesian3.fromDegrees(0, 0, 1000)},
            cartesianToCanvasCoordinates: () => ({x: 10, y: 10}),
            pickPositionSupported: true,
            pickPosition: vi.fn(() => worldPosition),
        }
        const canvas = {
            width: 100,
            height: 100,
            getBoundingClientRect: () => ({width: 100, height: 100, left: 0, top: 0}),
        }
        const overlay = {getBoundingClientRect: () => ({width: 100, height: 100, left: 0, top: 0})}
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {type: 'LineString', coordinates: [[0, 0, 0]]},
        }
        const corrections = {
            journey: [{
                id: 'section',
                segmentIndex: 0,
                startIndex: 0,
                endIndex: 0,
                controlPoints: [
                    {id: 'first', progress: 0, coordinate: [0, 0, 0], fixed: true},
                    {id: 'second', progress: 0, coordinate: [0, 0, 0], fixed: true},
                ],
            }],
        }

        const projected = projectEditOverlay(
            {scene, canvas},
            overlay,
            [],
            [{slug: 'journey', content}],
            corrections,
            null,
            null,
        )

        expect(projected.controlPoints).toHaveLength(2)
        expect(scene.pickPosition).toHaveBeenCalledTimes(1)
    })
})
