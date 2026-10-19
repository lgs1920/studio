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
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import {
    buildSourcePointSvgPath,
    findClosestSourcePoint,
    isScreenPointInsideArea,
    normalizeScreenSelectionArea,
} from '@Utils/cesium/fixPathScreenSelection'

describe('Fix Path screen area selection', () => {
    it('normalizes a drag in any direction and includes points on its edges', () => {
        const area = normalizeScreenSelectionArea({x: 90, y: 80}, {x: 10, y: 20})

        expect(area).toEqual({left: 10, top: 20, right: 90, bottom: 80, width: 80, height: 60})
        expect(isScreenPointInsideArea({x: 10, y: 80}, area)).toBe(true)
        expect(isScreenPointInsideArea({x: 91, y: 80}, area)).toBe(false)
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
