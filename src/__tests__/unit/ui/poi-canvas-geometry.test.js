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
 * Last modified: 2026-10-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {
    calculatePOICanvasCapturePadding,
    calculatePOIContentPixelOffset,
    calculatePOIStickEdgeOffset,
} from '@Components/MainUI/MapPOI/poiCanvasGeometry'

describe('POI canvas geometry', () => {
    it('keeps the visible card centered as the configured maximum width changes', () => {
        const measurements = [
            {
                canvasWidth: 226,
                canvasHeight: 100,
                elementBounds: {left: 0, right: 226, top: 0, bottom: 100, width: 226, height: 100},
                cardBounds: {left: 26, right: 226},
            },
            {
                canvasWidth: 346,
                canvasHeight: 100,
                elementBounds: {left: 0, right: 346, top: 0, bottom: 100, width: 346, height: 100},
                cardBounds: {left: 26, right: 346},
            },
        ]

        measurements.forEach(({canvasWidth, canvasHeight, elementBounds, cardBounds}) => {
            const element = {
                getBoundingClientRect: () => elementBounds,
                querySelector: vi.fn(selector => selector === '.poi-card-inner'
                    ? {getBoundingClientRect: () => cardBounds}
                    : null),
            }

            const offset = calculatePOIContentPixelOffset(element, canvasWidth, canvasHeight)

            expect(offset.x).toBeCloseTo(-13)
            expect(offset.y).toBe(-50)
        })
    })

    it('returns a neutral offset when the captured content has no measurable card', () => {
        const element = {
            getBoundingClientRect: () => ({left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100}),
            querySelector: vi.fn(() => null),
        }

        expect(calculatePOIContentPixelOffset(element, 100, 100)).toEqual({x: 0, y: 0})
    })

    it.each([
        {name: 'pill left', geometry: {style: 'pill', side: 'left', width: 200, height: 50, position: 20}, expected: 5},
        {name: 'pill right', geometry: {style: 'pill', side: 'right', width: 200, height: 50, position: 20}, expected: -5},
        {name: 'pill center', geometry: {style: 'pill', side: 'right', width: 200, height: 50, position: 50}, expected: 0},
        {name: 'slanted upper edge', geometry: {style: 'slanted-banner', side: 'left', width: 200, height: 100, position: 20}, expected: 8.0384757729},
        {name: 'slanted lower edge', geometry: {style: 'slanted-banner', side: 'right', width: 200, height: 100, position: 80}, expected: -8.0384757729},
        {name: 'rounded corner', geometry: {style: 'rounded', side: 'right', width: 100, height: 50, position: 10, borderRadius: 10}, expected: -1.3397459622},
    ])('aligns a $name anchor with its visible outline', ({geometry, expected}) => {
        expect(calculatePOIStickEdgeOffset(geometry)).toBeCloseTo(expected, 6)
    })

    it.each([
        {name: 'round endpoint', geometry: {borderWidth: 3}, expectedPadding: 6},
        {name: 'Open Frame stroke', geometry: {borderWidth: 3, openFrameLineWidth: 4.5}, expectedPadding: 6},
        {name: 'slanted frame', geometry: {borderWidth: 3, slantedContentHeight: 120}, expectedPadding: 21},
    ])('pads capture for $name overflow', ({geometry, expectedPadding}) => {
        expect(calculatePOICanvasCapturePadding(geometry)).toBe(expectedPadding)
    })

    it.each([
        {anchorLeft: 180, anchorTop: 170, expectedX: -10, expectedY: 0},
        {anchorLeft: 160, anchorTop: 220, expectedX: 10, expectedY: -50},
    ])('offsets the image so its geographic anchor reaches the Cesium position', ({
        anchorLeft,
        anchorTop,
        expectedX,
        expectedY,
    }) => {
        const anchor = {getBoundingClientRect: () => ({left: anchorLeft, top: anchorTop})}
        const card = {getBoundingClientRect: () => ({left: 20, right: 120})}
        const element = {
            getBoundingClientRect: () => ({left: 20, right: 320, top: 20, bottom: 320, width: 300, height: 300}),
            querySelector: vi.fn(selector => {
                if (selector === '.poi-geographic-anchor') {
                    return anchor
                }

                return selector === '.poi-card-inner' ? card : null
            }),
        }

        const offset = calculatePOIContentPixelOffset(element, 300, 300)

        expect(offset.x).toBeCloseTo(expectedX)
        expect(offset.y).toBeCloseTo(expectedY)
    })
})
