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
 * Last modified: 2026-10-30
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
        expect(css).toContain('z-index: 1;')
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

    it('connects sticks to the card edge and adds a matching round endpoint', () => {
        const css = loadMapPOIStyle()
        const cardStyle = css.slice(css.indexOf('.poi-card {'), css.indexOf('.poi-card.poi-card--stick-above {'))
        const leaderStyle = css.slice(css.indexOf('.poi-expanded-leader-space {'), css.indexOf('.poi-shrinked .poi-card-inner {'))

        expect(cardStyle).toContain('--poi-expanded-leader-gap: 0px;')
        expect(cardStyle).toContain('--poi-open-frame-line-width: calc(1.5 * var(--poi-border-width));')
        expect(cardStyle).toContain('--poi-expanded-leader-gap: var(--poi-open-frame-line-width);')
        expect(leaderStyle).toContain('width: 0;')
        expect(leaderStyle).toContain('height: 0;')
        expect(leaderStyle).toContain('width: calc(3 * var(--poi-border-width));')
        expect(leaderStyle).toContain('height: calc(3 * var(--poi-border-width));')
        expect(leaderStyle).toContain('transform: translate(-50%, -50%);')
        expect(leaderStyle).toContain('border-radius: 50%;')
        expect(leaderStyle).toContain('background-color: var(--lgs-poi-border-color);')
    })

    it('keeps left and right sticks attached to their selected card edge', () => {
        const css = loadMapPOIStyle()
        const leftStart = css.indexOf('.poi-card.poi-card--stick-left {')
        const rightStart = css.indexOf('.poi-card.poi-card--stick-right {', leftStart + 1)
        const rightEnd = css.indexOf('.used-in-menu .poi-card {', rightStart)
        const leftStyle = css.slice(leftStart, rightStart)
        const rightStyle = css.slice(rightStart, rightEnd)

        expect(leftStyle).toContain('flex-direction: row-reverse;')
        expect(leftStyle).toContain('rotate(calc(-1 * var(--poi-expanded-leader-angle, 0deg)))')
        expect(leftStyle).toContain('transform-origin: right center;')
        expect(leftStyle).toContain('right: 100%;')
        expect(leftStyle).toContain('var(--poi-expanded-leader-x, 1rem) - var(--poi-expanded-leader-edge-offset, 0px)')
        expect(leftStyle).toContain('right: calc(-1 * var(--poi-expanded-leader-edge-offset, 0px));')
        expect(rightStyle).toContain('flex-direction: row;')
        expect(rightStyle).toContain('rotate(var(--poi-expanded-leader-angle, 0deg))')
        expect(rightStyle).toContain('transform-origin: left center;')
        expect(rightStyle).toContain('left: 100%;')
        expect(rightStyle).toContain('var(--poi-expanded-leader-x, 1rem) + var(--poi-expanded-leader-edge-offset, 0px)')
        expect(rightStyle).toContain('left: var(--poi-expanded-leader-edge-offset, 0px);')
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

    it('provides the selected named card styles and full-width underline states', () => {
        const css = loadMapPOIStyle()

        for (const styleName of ['pill', 'side-accent', 'round-badge', 'underline', 'open-frame', 'slanted-banner', 'rounded', 'icon-frame']) {
            expect(css).toContain(`.poi-card-inner--style-${styleName}`)
        }
        const underlineStyle = css.slice(
            css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card-inner--style-underline {'),
            css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card.poi-card--style-open-frame'),
        )
        expect(underlineStyle).toContain('background-color: var(--lgs-poi-background-color);')
        expect(underlineStyle).toContain('background-color: rgba(0, 0, 0, 0.01);')
        expect(underlineStyle).toContain('bottom: calc(-1 * var(--poi-border-width));')
        expect(underlineStyle).toContain('top: calc(-1 * var(--poi-border-width));')
        expect(underlineStyle).toContain('height: var(--poi-border-width);')
        expect(underlineStyle).not.toContain('box-shadow: inset')
        expect(css).toContain('width: calc(var(--poi-expanded-leader-position, 50%) + var(--poi-open-frame-line-width));')
        expect(css).toContain('.poi-card-inner--style-icon-frame')
        const sideAccentStyle = css.slice(
            css.indexOf('.poi-card-inner--style-side-accent {'),
            css.indexOf('\n}', css.indexOf('.poi-card-inner--style-side-accent {')),
        )
        expect(sideAccentStyle).toContain('border: var(--poi-border-width) solid var(--lgs-poi-border-color);')
        expect(sideAccentStyle).not.toContain('border-left-width:')
        expect(sideAccentStyle).not.toContain('border-right')
        const roundBadgeStyle = css.slice(
            css.indexOf('.poi-card-inner--style-round-badge {'),
            css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card-inner--style-underline'),
        )
        expect(roundBadgeStyle).toContain('box-sizing: border-box;')
        expect(roundBadgeStyle).toContain('padding: calc(0.35 * var(--lgs-font-size)) 0 calc(0.35 * var(--lgs-font-size)) calc(2.8 * var(--lgs-font-size) + var(--poi-border-width));')
        expect(roundBadgeStyle).toContain('inset: 0 0 0 calc(1.1 * var(--lgs-font-size));')
        expect(roundBadgeStyle).toContain('& .poi-title {\n        display: contents;')
        expect(roundBadgeStyle).toContain('left: 0;')
        expect(roundBadgeStyle).toContain('border: var(--poi-border-width) solid var(--lgs-poi-border-color);')
        expect(roundBadgeStyle).toContain('border-radius: 50%;')
        expect(roundBadgeStyle).toContain('    border: 0;')
        expect(roundBadgeStyle).toContain('border: var(--poi-border-width) solid var(--lgs-poi-border-color);')
        const roundBadgeTextPanel = roundBadgeStyle.slice(
            roundBadgeStyle.indexOf('& .poi-card-content {'),
            roundBadgeStyle.indexOf('& .poi-title {'),
        )
        expect(roundBadgeTextPanel).toContain('border: var(--poi-border-width) solid var(--lgs-poi-border-color);')
        const openFrameStyle = css.slice(
            css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card.poi-card--style-open-frame'),
            css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card-inner--style-slanted-banner'),
        )
        expect(openFrameStyle).toContain('border: 0;')
        expect(openFrameStyle).toContain('height: 30%;')
        expect(openFrameStyle).toContain('left: calc(-1 * var(--poi-open-frame-line-width));')
        expect(openFrameStyle).toContain('border-width: 0 0 var(--poi-open-frame-line-width) var(--poi-open-frame-line-width);')
        expect(openFrameStyle).toContain('width: calc(var(--poi-expanded-leader-position, 50%) + var(--poi-open-frame-line-width));')
        expect(openFrameStyle).toContain('width: calc(100% - var(--poi-expanded-leader-position, 50%) + var(--poi-open-frame-line-width));')
        expect(openFrameStyle).not.toContain('poi-expanded-leader-x')
        expect(openFrameStyle).toContain('width: 30%;')
        expect(openFrameStyle).not.toContain('poi-card--stick-horizontal-position-80')
        expect(openFrameStyle).toContain('right: calc(-1 * var(--poi-open-frame-line-width));')
        expect(openFrameStyle).not.toContain('border-block:')
        const slantedBannerStyle = css.slice(
            css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card-inner--style-slanted-banner'),
            css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card-inner--style-rounded'),
        )
        expect(slantedBannerStyle).toContain('transform: skewX(-15deg);')
        expect(slantedBannerStyle).toContain('border: var(--poi-border-width) solid var(--lgs-poi-border-color);')
        expect(slantedBannerStyle).toContain('& .poi-card-content {\n        position: relative;\n        z-index: 1;')
        expect(slantedBannerStyle).toContain('padding-inline: calc(3 * var(--poi-padding));')
        const iconFrameStyle = css.slice(
            css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card-inner--style-icon-frame'),
            css.indexOf('\n.poi-card-content {\n    display: flex;', css.indexOf('.poi-icon-wrapper:not(.poi-shrinked) .poi-card-inner--style-icon-frame')),
        )
        expect(iconFrameStyle).toContain('border: 0;')
        expect(iconFrameStyle).toContain('background: transparent;')
        expect(iconFrameStyle).toContain('--poi-icon-frame-item-size: calc(1.4em + 2 * var(--poi-padding) + 2 * var(--poi-border-width));')
        expect(iconFrameStyle).toContain('margin-left: calc(var(--poi-icon-frame-item-size) + var(--poi-padding));')
        expect(iconFrameStyle).toContain('& .poi-title {\n        display: contents;')
        expect(iconFrameStyle).toContain('line-height: 1.4;')
        expect(iconFrameStyle).toContain('width: var(--poi-icon-frame-item-size);')
        expect(iconFrameStyle).toContain('height: var(--poi-icon-frame-item-size);')
        expect(iconFrameStyle).toContain('& .poi-card-content--title-only {\n        align-items: stretch;')
        const iconFrameTextPanel = iconFrameStyle.slice(
            iconFrameStyle.indexOf('& .poi-card-content {'),
            iconFrameStyle.indexOf('& .poi-title {'),
        )
        const iconFrameIcon = iconFrameStyle.slice(
            iconFrameStyle.indexOf('& .poi-category-title-icon {'),
            iconFrameStyle.indexOf('& .poi-card-content--title-only {'),
        )
        expect(iconFrameTextPanel).toContain('background: var(--lgs-poi-background-color);')
        expect(iconFrameIcon).toContain('background: var(--lgs-poi-background-color);')
    })

    it('centers a single title line and sizes its minimum content height from the POI line-height', () => {
        const css = loadMapPOIStyle()
        const singleLineStyle = css.slice(css.indexOf('.poi-card-content--title-only {'))

        expect(singleLineStyle).toContain('min-height: 1.4em;')
        expect(singleLineStyle).toContain('line-height: 1.4;')
        expect(singleLineStyle).not.toContain('var(--lgs-font-size) * 1.4')
    })
})
