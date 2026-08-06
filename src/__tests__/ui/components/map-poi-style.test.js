/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-style.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-24
 * Last modified: 2026-07-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const loadMapPOIStyle = () => readFileSync('src/components/MainUI/MapPOI/style.css', 'utf8')

describe('Map POI style', () => {
    it('uses a real border and keeps the shrinked POI background scoped to the card', () => {
        const css = loadMapPOIStyle()

        expect(css).toContain('.poi-card-inner {')
        expect(css).toContain('position: relative;')
        expect(css).toContain('z-index: 0;')
        expect(css).toContain('.poi-icon-wrapper.poi-shrinked {')
        expect(css).toContain('transform: rotate(-45deg);')
        expect(css).toContain('.poi-shrinked .poi-card-inner {')
        expect(css).toContain('box-sizing: border-box;')
        expect(css).toContain('border: var(--poi-border-width) solid var(--lgs-poi-color);')
        expect(css).toContain('box-shadow: none;')
        expect(css).not.toContain('box-shadow: inset 0 0 0 var(--poi-border-width) var(--lgs-poi-color);')
    })
})
