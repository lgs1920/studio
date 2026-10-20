/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-layout.browser.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-20
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {render} from 'vitest-browser-react'
import {page} from 'vitest/browser'
import {afterAll, afterEach, beforeAll, beforeEach, expect, it, vi} from 'vitest'
import {FixPathEditorPanel} from '@Components/MainUI/FixPathEditorPanel'
import {registerLGS1920IconLibrary} from '@Utils/LGS1920IconLibrary'
import {getIconLibrary, registerIconLibrary, unregisterIconLibrary} from '@awesome.me/webawesome/dist/components/icon/library.js'
import '@awesome.me/webawesome/dist/styles/webawesome.css'
import '@Assets/css/themes/wa-lgs1920.css'
import '@Components/MainUI/FixPathEditor.css'

let rendered
let originalViewport
const originalDefaultLibrary = getIconLibrary('default')
const originalApplicationLibrary = getIconLibrary('lgs1920')

beforeAll(() => registerLGS1920IconLibrary())

afterAll(() => {
    registerIconLibrary('default', originalDefaultLibrary)
    if (originalApplicationLibrary) {
        registerIconLibrary('lgs1920', originalApplicationLibrary)
    } else {
        unregisterIconLibrary('lgs1920')
    }
})

beforeEach(() => {
    originalViewport = {width: window.innerWidth, height: window.innerHeight}
})

afterEach(async () => {
    await rendered?.unmount()
    await page.viewport(originalViewport.width, originalViewport.height)
})

/** Render real Web Awesome controls with the production Fix Path theme and layout. */
const renderPointList = async theme => {
    const correction = {
        id: 'layout-section',
        trackSlug: 'layout-track',
        segmentIndex: 0,
        startIndex: 0,
        endIndex: 10,
        controlPoints: Array.from({length: 9}, (_, index) => ({
            id: 'point-' + index,
            ...(index === 7 ? {} : {sourceIndex: index + 1}),
            progress: (index + 1) / 10,
            coordinate: [-179.123456, -89.123456, 4300 + index],
            fixed: index % 2 === 0,
            removed: index === 8,
        })),
    }
    rendered = await render(
        <div className={'wa-theme-lgs1920 ' + theme}>
            <FixPathEditorPanel
                activeCorrectionIndex={0}
                areaMode
                heightUnit="m"
                displayedCorrection={correction}
                displayedTrack={{content: {geometry: {type: 'LineString', coordinates: [[2.3, 48.8, 100], [2.4, 48.9, 110]]}}}}
                orderedCorrections={[correction]}
                projected={{sourcePoints: []}}
                selectedControlPoints={[
                    {trackSlug: 'layout-track', correctionId: 'layout-section', controlPointId: 'point-1'},
                    {trackSlug: 'layout-track', correctionId: 'layout-section', controlPointId: 'point-2'},
                ]}
                selection={{phase: 'choose-start'}}
                handleFixPathShortcut={vi.fn()}
            />
        </div>,
    )
    const panel = document.querySelector('.fix-path-panel')
    await Promise.all(Array.from(panel.querySelectorAll('wa-input, wa-number-input, wa-button'), element => element.updateComplete))
    return panel
}

it.each([
    {width: 1000, height: 800, theme: 'wa-dark'},
    {width: 360, height: 640, theme: 'wa-light'},
])('keeps equal visible gaps and eight complete rows at $width px', async ({width, height, theme}) => {
    await page.viewport(width, height)
    const panel = await renderPointList(theme)
    const rows = Array.from(panel.querySelectorAll('.fix-path-correction-point-row'))
    const fields = rows.map(row => Array.from(row.querySelectorAll('wa-input, wa-number-input'), input => (
        input.shadowRoot.querySelector('[part~="base"]').getBoundingClientRect()
    )))
    const gap = parseFloat(getComputedStyle(panel.querySelector('.fix-path-correction-points-list')).rowGap)
    for (const [index, row] of rows.entries()) {
        for (let column = 1; column < fields[index].length; column++) {
            expect(fields[index][column].left - fields[index][column - 1].right).toBeCloseTo(gap, 1)
        }
        if (index > 0) {
            expect(fields[index][0].top - fields[index - 1][0].bottom).toBeCloseTo(gap, 1)
        }
        const bounds = row.getBoundingClientRect()
        for (const control of row.querySelectorAll('wa-input, wa-number-input, wa-button')) {
            const base = control.shadowRoot.querySelector('[part~="base"]').getBoundingClientRect()
            expect(base.top).toBeGreaterThanOrEqual(bounds.top - 0.1)
            expect(base.bottom).toBeLessThanOrEqual(bounds.bottom + 0.1)
        }
        expect(fields[index][0].width).toBeGreaterThanOrEqual(60)
        expect(fields[index][1].width).toBeGreaterThanOrEqual(60)
        expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
    }
    const longitude = rows[0].querySelector('wa-input[aria-label="Lon"]')
    const altitude = rows[0].querySelector('wa-number-input[aria-label="Height (m)"]')
    expect(rows).toHaveLength(9)
    expect(panel.querySelectorAll('wa-number-input[aria-label="Height (m)"]')).toHaveLength(9)
    expect(longitude.value).toBe('-179.123456')
    expect(altitude.value).toBe('4300')
    expect(longitude.shadowRoot.querySelector('[part~="input"]').value).toBe('-179.123456')
    expect(altitude.shadowRoot.querySelector('[part~="input"]').value).toBe('4300')
    const viewport = panel.querySelector('.fix-path-correction-points-scroll-area .view').getBoundingClientRect()
    expect(fields[7][0].bottom).toBeLessThanOrEqual(viewport.bottom)
    expect(fields[8][0].bottom).toBeGreaterThan(viewport.bottom)
})

it('keeps correction markers clickable and mirrors point colors with duotone status indicators', async () => {
    const panel = await renderPointList('wa-light')
    const markers = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    markers.classList.add('fix-path-markers', 'is-selecting-area')
    const point = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    point.classList.add('fix-path-control-point')
    const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    hitbox.classList.add('fix-path-control-point-hitbox')
    point.append(hitbox)
    markers.append(point)
    panel.append(markers)

    expect(getComputedStyle(point).pointerEvents).toBe('all')
    expect(getComputedStyle(point).cursor).toBe('grab')
    expect(getComputedStyle(hitbox).pointerEvents).toBe('all')
    const inactivePoint = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    inactivePoint.classList.add('fix-path-control-point', 'is-inactive')
    markers.append(inactivePoint)
    expect(getComputedStyle(inactivePoint).cursor).toBe('pointer')
    const statusIcons = [...panel.querySelectorAll('.fix-path-correction-point-status-indicator')]
    expect(statusIcons).toHaveLength(9)
    await Promise.all(statusIcons.map(icon => icon.updateComplete))
    const movedStatus = panel.querySelector('[data-control-point-id="point-0"] .fix-path-correction-point-status-indicator')
    expect(movedStatus.classList.contains('is-moved')).toBe(true)
    // Await actual icon loading: Lit updates alone do not await the SVG resolver.
    await expect.poll(() => statusIcons.every(icon => {
        const paths = icon.shadowRoot?.querySelectorAll('svg path')
        return paths?.length === 2 && [...paths].every(path => Boolean(path.getAttribute('d')))
    })).toBe(true)

    /** Normalize theme token values to the browser's computed color format. */
    const resolveColor = color => {
        const probe = document.createElement('span')
        probe.style.color = color
        panel.append(probe)
        const resolved = getComputedStyle(probe).color
        probe.remove()
        return resolved
    }

    const statusStates = [
        {selector: '.is-moved:not(.is-selected)', count: 3, name: 'circle', primary: '#ffffff', secondary: '#ff3d91'},
        {selector: '.is-unmodified:not(.is-selected)', count: 3, name: 'diamond', primary: '#000000', secondary: '#2680ff'},
        {selector: '.is-selected', count: 2, primary: '#000000', secondary: '#7fff00'},
        {selector: '.is-removed', count: 1, name: 'circle', primary: 'danger-border', secondary: 'danger-fill'},
    ]
    for (const {selector, count, name, primary, secondary} of statusStates) {
        const indicators = statusIcons.filter(icon => icon.matches(selector))
        expect(indicators).toHaveLength(count)
        indicators.forEach(icon => {
            if (name) expect(icon.getAttribute('name')).toBe(name)
            expect(icon.getAttribute('family')).toBe('duotone')
            expect(icon.getAttribute('variant')).toBe('regular')
            expect(icon.classList.contains('poi-duotone-icon')).toBe(false)
            expect(icon.classList.contains('fix-path-correction-point-status-indicator')).toBe(true)
            expect(icon.style.getPropertyValue('--primary-color')).toBe('')
            expect(icon.style.getPropertyValue('--secondary-color')).toBe('')
            const primaryColor = primary === 'danger-border'
                ? getComputedStyle(panel).getPropertyValue('--wa-color-danger-border-normal').trim()
                : primary
            const secondaryColor = secondary === 'danger-fill'
                ? getComputedStyle(panel).getPropertyValue('--wa-color-danger-fill-normal').trim()
                : secondary
            expect(getComputedStyle(icon).getPropertyValue('--primary-color').trim()).toBe(primaryColor)
            expect(getComputedStyle(icon).getPropertyValue('--secondary-color').trim()).toBe(secondaryColor)
            const svg = icon.shadowRoot.querySelector('svg')
            expect(svg.getAttribute('data-prefix')).toBe('fadr')
            const border = svg.querySelector('path.fa-primary')
            const fill = svg.querySelector('path.fa-secondary')
            expect(getComputedStyle(border).fill).toBe(resolveColor(primaryColor))
            expect(getComputedStyle(fill).fill).toBe(resolveColor(secondaryColor))
            expect(getComputedStyle(border).opacity).toBe('1')
            expect(getComputedStyle(fill).opacity).toBe('1')
        })
    }
    expect(panel.querySelector('[data-control-point-id="point-1"] .fix-path-correction-point-status-indicator')
        .getAttribute('name')).toBe('diamond')
    expect(panel.querySelector('[data-control-point-id="point-2"] .fix-path-correction-point-status-indicator')
        .getAttribute('name')).toBe('circle')

    // A selection change must recolor both existing SVG layers without another load.
    const movedBorder = movedStatus.shadowRoot.querySelector('path.fa-primary')
    const movedFill = movedStatus.shadowRoot.querySelector('path.fa-secondary')
    movedStatus.classList.add('is-selected')
    expect(getComputedStyle(movedBorder).fill).toBe('rgb(0, 0, 0)')
    expect(getComputedStyle(movedFill).fill).toBe('rgb(127, 255, 0)')
    movedStatus.classList.remove('is-selected')
    expect(getComputedStyle(movedBorder).fill).toBe('rgb(255, 255, 255)')
    expect(getComputedStyle(movedFill).fill).toBe('rgb(255, 61, 145)')

    const visualStates = [
        {states: ['is-selected', 'is-unmodified'], tag: 'path', fill: 'rgb(127, 255, 0)', stroke: 'rgb(0, 0, 0)'},
        {states: ['is-selected', 'is-moved'], tag: 'circle', fill: 'rgb(127, 255, 0)', stroke: 'rgb(0, 0, 0)'},
        {states: ['is-unmodified'], tag: 'path', fill: 'rgb(38, 128, 255)', stroke: 'rgb(0, 0, 0)'},
        {states: ['is-moved'], tag: 'circle', fill: 'rgb(255, 61, 145)', stroke: 'rgb(255, 255, 255)'},
    ]
    for (const {states, tag, fill, stroke} of visualStates) {
        const point = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        point.classList.add('fix-path-control-point', ...states)
        const visual = document.createElementNS('http://www.w3.org/2000/svg', tag)
        visual.classList.add('fix-path-control-point-visual')
        point.append(visual)
        markers.append(point)
        expect(visual.tagName.toLowerCase()).toBe(tag)
        expect(getComputedStyle(visual).fill).toBe(fill)
        expect(getComputedStyle(visual).stroke).toBe(stroke)
        expect(getComputedStyle(visual).strokeWidth).toBe('2px')
    }

    const inactiveVisualStates = [
        {states: ['is-unmodified'], tag: 'path'},
        {states: ['is-unmodified', 'is-selected'], tag: 'path'},
        {states: ['is-moved'], tag: 'circle'},
        {states: ['is-moved', 'is-selected'], tag: 'circle'},
    ]
    for (const {states, tag} of inactiveVisualStates) {
        const point = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        point.classList.add('fix-path-control-point', ...states, 'is-inactive')
        const visual = document.createElementNS('http://www.w3.org/2000/svg', tag)
        visual.classList.add('fix-path-control-point-visual')
        point.append(visual)
        markers.append(point)
        expect(getComputedStyle(visual).fill).toBe('rgb(146, 153, 163)')
        expect(getComputedStyle(visual).stroke).toBe('rgb(255, 255, 255)')
        expect(getComputedStyle(visual).strokeWidth).toBe('2px')
    }
})
