/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-screen-selection.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import {
    appendScreenSelectionVertex,
    buildSmoothClosedScreenSelectionGeometry,
    buildSourcePointSvgPath,
    createScreenPolygonTester,
    createScreenScanYieldClock,
    findClosestSourcePoint,
    groupScreenSelectionPointsByRoute,
    isScreenPointInsideArea,
    isScreenPointInsidePolygon,
    normalizeScreenSelectionArea,
} from '@Utils/cesium/fixPathScreenSelection'

describe('Fix Path screen area selection', () => {
    it('normalizes a drag in any direction and includes points on its edges', () => {
        const area = normalizeScreenSelectionArea({x: 90, y: 80}, {x: 10, y: 20})

        expect(area).toEqual({left: 10, top: 20, right: 90, bottom: 80, width: 80, height: 60})
        expect(isScreenPointInsideArea({x: 10, y: 80}, area)).toBe(true)
        expect(isScreenPointInsideArea({x: 91, y: 80}, area)).toBe(false)
    })

    it('selects points inside a non-rectangular polygon, including its border', () => {
        const polygon = [
            {x: 0, y: 0},
            {x: 40, y: 0},
            {x: 40, y: 10},
            {x: 10, y: 10},
            {x: 10, y: 40},
            {x: 0, y: 40},
        ]

        expect(isScreenPointInsidePolygon({x: 5, y: 30}, polygon)).toBe(true)
        expect(isScreenPointInsidePolygon({x: 30, y: 5}, polygon)).toBe(true)
        expect(isScreenPointInsidePolygon({x: 30, y: 30}, polygon)).toBe(false)
        expect(isScreenPointInsidePolygon({x: 10, y: 25}, polygon)).toBe(true)
        expect(isScreenPointInsidePolygon({x: 30, y: 30}, polygon.slice(0, 2))).toBe(false)
    })

    it('reuses a prepared polygon test and rejects points outside its bounds', () => {
        const polygon = [
            {x: 0, y: 0},
            {x: 40, y: 0},
            {x: 40, y: 10},
            {x: 10, y: 10},
            {x: 10, y: 40},
            {x: 0, y: 40},
        ]
        const containsPoint = createScreenPolygonTester(polygon)

        expect(containsPoint).toBeTypeOf('function')
        expect(containsPoint({x: 5, y: 30})).toBe(true)
        expect(containsPoint({x: 10, y: 25})).toBe(true)
        expect(containsPoint({x: 30, y: 30})).toBe(false)
        expect(containsPoint({x: 50, y: 50})).toBe(false)
        expect(createScreenPolygonTester([{x: 0, y: 0}, {x: Number.NaN, y: 1}, {x: 1, y: 0}])).toBeNull()
    })

    it('only requests a scan yield after its time slice is consumed', () => {
        let currentTime = 10
        const yieldClock = createScreenScanYieldClock(8, () => currentTime)

        expect(yieldClock.shouldYield()).toBe(false)
        currentTime += 7
        expect(yieldClock.shouldYield()).toBe(false)
        currentTime += 1
        expect(yieldClock.shouldYield()).toBe(true)
        yieldClock.reset()
        expect(yieldClock.shouldYield()).toBe(false)
    })

    it('keeps separate route and segment intersections in separate lasso zones', () => {
        const points = [
            {trackSlug: 'track-a', segmentIndex: 0, index: 1},
            {trackSlug: 'track-a', segmentIndex: 0, index: 2},
            {trackSlug: 'track-a', segmentIndex: 0, index: 3},
            {trackSlug: 'track-a', segmentIndex: 0, index: 7},
            {trackSlug: 'track-a', segmentIndex: 0, index: 8},
            {trackSlug: 'track-a', segmentIndex: 1, index: 0},
            {trackSlug: 'track-b', segmentIndex: 0, index: 1},
        ]

        expect(groupScreenSelectionPointsByRoute(points).map(zone => zone.map(point => [
            point.trackSlug,
            point.segmentIndex,
            point.index,
        ]))).toEqual([
            [['track-a', 0, 1], ['track-a', 0, 2], ['track-a', 0, 3]],
            [['track-a', 0, 7], ['track-a', 0, 8]],
            [['track-a', 1, 0]],
            [['track-b', 0, 1]],
        ])
    })

    it('appends separated lasso vertices and ignores near-duplicates', () => {
        const vertices = [{x: 10, y: 10}]

        expect(appendScreenSelectionVertex(vertices, {x: 11, y: 11})).toBe(vertices)
        expect(appendScreenSelectionVertex(vertices, {x: 20, y: 10})).toEqual([
            {x: 10, y: 10},
            {x: 20, y: 10},
        ])
        expect(appendScreenSelectionVertex(vertices, {x: NaN, y: 10})).toBe(vertices)
    })

    it('closes the lasso with a smooth Bezier segment and matching hit-test geometry', () => {
        const vertices = [
            {x: 10, y: 10},
            {x: 100, y: 10},
            {x: 100, y: 100},
            {x: 10, y: 100},
        ]
        const geometry = buildSmoothClosedScreenSelectionGeometry(vertices)

        expect(geometry.path.match(/C/g)).toHaveLength(vertices.length)
        expect(geometry.path).toMatch(/10 10$/)
        expect(geometry.polygon).toHaveLength(vertices.length * 8)
        expect(geometry.polygon.at(-1).x).not.toBe(vertices.at(-1).x)
        expect(isScreenPointInsidePolygon({x: 0, y: 55}, geometry.polygon)).toBe(true)
        expect(isScreenPointInsidePolygon({x: -10, y: 55}, geometry.polygon)).toBe(false)
    })

    it('draws many source squares in one SVG path and resolves pointer hits', () => {
        const points = [
            {trackSlug: 'track-a', segmentIndex: 0, index: 2, x: 30, y: 40},
            {trackSlug: 'track-b', segmentIndex: 1, index: 8, x: 90, y: 100},
        ]

        expect(buildSourcePointSvgPath(points, 8)).toBe('M26 36h8v8h-8ZM86 96h8v8h-8Z')
        expect(findClosestSourcePoint(points, {x: 32, y: 38})).toBe(points[0])
        expect(findClosestSourcePoint(points, {x: 60, y: 60})).toBeNull()
    })
})
