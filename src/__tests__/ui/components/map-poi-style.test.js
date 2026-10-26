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
 * Last modified: 2026-10-26
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

    it('renders reduced map POIs at 80% of their previous diameter', () => {
        const css = loadMapPOIStyle()
        const shrinkedStyle = css.slice(css.indexOf('.poi-icon-wrapper.poi-shrinked {'))
        const menuOverride = shrinkedStyle.indexOf('.poi-icon-wrapper.poi-shrinked.used-in-menu {')

        expect(shrinkedStyle.slice(0, menuOverride)).toContain('--dimension: calc(0.8 * var(--poi-reduce-dimension));')
        expect(shrinkedStyle.slice(menuOverride)).toContain('--dimension: var(--poi-in-menu-dimension);')
    })

    it('keeps the expanded title icon upright and the configured card width within its canvas', () => {
        const css = loadMapPOIStyle()
        const genericRotation = css.indexOf('.poi-card-inner svg, :not(.poi-shrinked) .poi-card-inner wa-icon::part(svg)')
        const titleIconOverride = css.indexOf(
            '.poi-icon-wrapper:not(.poi-shrinked) .poi-card-inner .poi-title .poi-category-title-icon::part(svg)',
        )
        const overrideEnd = css.indexOf('}', titleIconOverride)

        expect(css).toContain('width: var(--poi-expanded-dimension);')
        expect(css).toContain('box-sizing: border-box;')
        expect(titleIconOverride).toBeGreaterThan(genericRotation)
        expect(css.slice(titleIconOverride, overrideEnd)).toContain('transform: none;')
    })

    it('keeps one source-styled POI DOM as the move cursor', () => {
        const css = loadMapPOIStyle()
        const moveStyles = css.slice(css.indexOf('.poi-move-overlay-root {'))
        const pressedMarkerStyle = moveStyles.slice(moveStyles.indexOf('& wa-button.poi-move-marker[aria-pressed="true"]'))
        const previewStyle = moveStyles.slice(moveStyles.indexOf('& .poi-icon-wrapper.poi-move-preview {'))
        const shrinkedWrapper = css.slice(
            css.indexOf('.poi-icon-wrapper.poi-shrinked {'),
            css.indexOf('}', css.indexOf('.poi-icon-wrapper.poi-shrinked {')),
        )
        const shrinkedIconRotation = css.indexOf('.poi-shrinked .poi-card-inner .poi-as-flag::part(svg)')

        expect(shrinkedIconRotation).toBeGreaterThan(-1)
        expect(shrinkedWrapper).toContain('transform: rotate(-45deg);')
        expect(css.slice(shrinkedIconRotation, css.indexOf('}', shrinkedIconRotation))).toContain('transform: rotate(-45deg);')
        expect(moveStyles).not.toContain('.poi-move-cursor')
        expect(moveStyles).toContain('& .poi-move-marker-content {\n        display: contents;')
        expect(pressedMarkerStyle).not.toContain('opacity: 0;')
        expect(previewStyle).toContain('position: relative;')
        expect(previewStyle).toContain('&.poi-shrinked {\n            transform: none;')
        expect(moveStyles).not.toContain('.poi-card-inner--move-preview')
        expect(moveStyles).not.toContain('poi-card-inner-background {\n            display: none;')
        expect(moveStyles).toContain('transform: translate(-50%, -50%);')
        expect(moveStyles).toContain('background: transparent;')
        expect(moveStyles).toContain('--lgs-button-plain-bg-hover-color: transparent;')
        expect(moveStyles).toContain('--lgs-card-on-map-selected-bg-color: transparent;')
        expect(moveStyles).toContain('--lgs-card-on-map-selected-bg-image: none;')
    })
})
