/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-canvas-geometry.test.js
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

import {describe, expect, it, vi} from 'vitest'
import {calculatePOIContentPixelOffset} from '@Components/MainUI/MapPOI/poiCanvasGeometry'

describe('POI canvas geometry', () => {
    it('keeps the visible card centered as the configured maximum width changes', () => {
        const measurements = [
            {
                canvasWidth: 226,
                elementBounds: {left: 0, right: 226, width: 226},
                cardBounds: {left: 26, right: 226},
            },
            {
                canvasWidth: 346,
                elementBounds: {left: 0, right: 346, width: 346},
                cardBounds: {left: 26, right: 346},
            },
        ]

        measurements.forEach(({canvasWidth, elementBounds, cardBounds}) => {
            const element = {
                getBoundingClientRect: () => elementBounds,
                querySelector: vi.fn(() => ({getBoundingClientRect: () => cardBounds})),
            }

            const offset = calculatePOIContentPixelOffset(element, canvasWidth)

            expect(offset.x).toBeCloseTo(-13)
            expect(offset.y).toBe(0)
        })
    })

    it('returns a neutral offset when the captured content has no measurable card', () => {
        const element = {
            getBoundingClientRect: () => ({left: 0, right: 100, width: 100}),
            querySelector: vi.fn(() => null),
        }

        expect(calculatePOIContentPixelOffset(element, 100)).toEqual({x: 0, y: 0})
    })
})
