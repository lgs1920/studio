/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: drawerResize.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    clampDrawerWidth,
    DRAWER_RESIZE_DEFAULT_WIDTH,
    DRAWER_RESIZE_MIN_WIDTH,
    getDrawerResizeBounds,
    getDrawerResizeDelta,
    getDrawerOutwardDistance,
    qualifiesForFastDrawerExpansion,
} from './drawerResize.js'
import { describe, expect, it } from 'vitest'

describe('drawer resize policy', () => {
    it('calculates the shared desktop bounds', () => {
        expect(getDrawerResizeBounds(1280)).toEqual({min: 448, max: 720})
        expect(getDrawerResizeBounds(600)).toEqual({min: 448, max: 448})
    })

    it('keeps widths inside the configured bounds', () => {
        const bounds = getDrawerResizeBounds(1280)

        expect(clampDrawerWidth(100, bounds)).toBe(DRAWER_RESIZE_MIN_WIDTH)
        expect(clampDrawerWidth(500, bounds)).toBe(500)
        expect(clampDrawerWidth(1000, bounds)).toBe(720)
        expect(clampDrawerWidth(Number.NaN, bounds)).toBe(DRAWER_RESIZE_DEFAULT_WIDTH)
    })

    it('supports a drawer-specific maximum', () => {
        expect(getDrawerResizeBounds(1280, 560)).toEqual({min: 448, max: 560})
        expect(getDrawerResizeBounds(600, 560)).toEqual({min: 448, max: 560})
    })

    it('resolves viewport-height maximums', () => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 600})

        expect(getDrawerResizeBounds(1280, '80vh')).toEqual({min: 448, max: 480})
    })

    it('calculates direction-aware pointer deltas', () => {
        expect(getDrawerResizeDelta('start', 100, 180)).toBe(80)
        expect(getDrawerResizeDelta('end', 900, 820)).toBe(80)
        expect(getDrawerOutwardDistance('end', 900, 820)).toBe(80)
        expect(getDrawerOutwardDistance('end', 900, 940)).toBe(0)
    })

    it('recognizes only deliberate fast expansion gestures', () => {
        expect(qualifiesForFastDrawerExpansion({distance: 100, duration: 100})).toBe(true)
        expect(qualifiesForFastDrawerExpansion({distance: 100, duration: 300})).toBe(false)
        expect(qualifiesForFastDrawerExpansion({distance: 40, duration: 50})).toBe(false)
    })
})
