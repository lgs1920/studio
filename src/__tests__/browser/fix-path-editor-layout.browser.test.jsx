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
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {FixPathEditorPanel} from '@Components/MainUI/FixPathEditorPanel'
import '@awesome.me/webawesome/dist/styles/webawesome.css'
import '@Assets/css/themes/wa-lgs1920.css'
import '@Components/MainUI/FixPathEditor.css'

let rendered
let originalViewport

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
            progress: (index + 1) / 10,
            coordinate: [2.3, 48.8, 100 + index],
        })),
    }
    rendered = await render(
        <div className={'wa-theme-lgs1920 ' + theme}>
            <FixPathEditorPanel
                activeCorrectionIndex={0}
                areaMode
                displayedCorrection={correction}
                displayedTrack={{content: {geometry: {type: 'LineString', coordinates: [[2.3, 48.8, 100], [2.4, 48.9, 110]]}}}}
                orderedCorrections={[correction]}
                projected={{sourcePoints: []}}
                selectedControlPoints={[]}
                selection={{phase: 'choose-start'}}
                handleFixPathShortcut={vi.fn()}
            />
        </div>,
    )
    const panel = document.querySelector('.fix-path-panel')
    await Promise.all(Array.from(panel.querySelectorAll('wa-input, wa-button'), element => element.updateComplete))
    return panel
}

it.each([
    {width: 1000, height: 800, theme: 'wa-dark'},
    {width: 360, height: 640, theme: 'wa-light'},
])('keeps equal visible gaps and eight complete rows at $width px', async ({width, height, theme}) => {
    await page.viewport(width, height)
    const panel = await renderPointList(theme)
    const rows = Array.from(panel.querySelectorAll('.fix-path-correction-point-row'))
    const fields = rows.map(row => Array.from(row.querySelectorAll('wa-input'), input => (
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
        for (const control of row.querySelectorAll('wa-input, wa-button')) {
            const base = control.shadowRoot.querySelector('[part~="base"]').getBoundingClientRect()
            expect(base.top).toBeGreaterThanOrEqual(bounds.top - 0.1)
            expect(base.bottom).toBeLessThanOrEqual(bounds.bottom + 0.1)
        }
    }
    const viewport = panel.querySelector('.fix-path-correction-points-scroll-area .view').getBoundingClientRect()
    expect(fields[7][0].bottom).toBeLessThanOrEqual(viewport.bottom)
    expect(fields[8][0].top).toBeGreaterThanOrEqual(viewport.bottom)
})
