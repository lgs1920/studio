/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: on-map-theme-style.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-27
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const styleSource = readFileSync(resolve('src/assets/css/themes/wa-lgs1920-on-map.css'), 'utf8')
const appStyleSource = readFileSync(resolve('src/assets/css/app.css'), 'utf8')
const fixPathEditorStyleSource = readFileSync(resolve('src/components/MainUI/FixPathEditor.css'), 'utf8')

describe('substituted map cursors', () => {
    it('keeps standard Fix Path cursor icons branded', () => {
        expect(fixPathEditorStyleSource).toMatch(/\.fix-path-journey-cursor\s*\{[^}]*color:\s*var\(--wa-color-brand\);/s)
    })

    it('centers 20-pixel cursor icons with a white outline and subdued dark halos', () => {
        expect(fixPathEditorStyleSource).toMatch(/\.fix-path-journey-cursor\s*\{[^}]*transform:\s*translate\(-50%, -50%\);/s)
        expect(fixPathEditorStyleSource).toMatch(/&\.is-area-selection-cursor\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;[^}]*font-size:\s*24px;/s)
        const areaSelectionCursorStyle = fixPathEditorStyleSource.split('&.is-area-selection-cursor {')[1]?.split('\n    &.is-visible')[0]
        expect(areaSelectionCursorStyle).toBeDefined()
        expect(areaSelectionCursorStyle).not.toMatch(/color:/)
        expect(areaSelectionCursorStyle).toContain('width: 20px;')
        expect(areaSelectionCursorStyle).toContain('height: 20px;')
        expect(areaSelectionCursorStyle).toContain('font-size: 20px;')
        expect(fixPathEditorStyleSource).toContain('filter: drop-shadow(0 0 0.5px #8a8a8a);')
        expect(fixPathEditorStyleSource).toContain('&::part(svg)')
        expect(fixPathEditorStyleSource).toContain('stroke: #ffffff;')
        expect(fixPathEditorStyleSource).toContain('stroke-width: 3px;')
        expect(appStyleSource).toMatch(/\.replay-widget-guide-drag-cursor\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/s)
        expect(appStyleSource).toContain('color: #000000;')
        expect(appStyleSource).toContain('width: 20px;')
        expect(appStyleSource).toContain('height: 20px;')
        expect(appStyleSource).toContain('font-size: 20px;')
        expect(appStyleSource).toContain('filter: drop-shadow(0 0 0.5px #8a8a8a) drop-shadow(0 0.5px 1.25px #000000);')
        expect(appStyleSource).toContain('&::part(svg)')
        expect(appStyleSource).toContain('stroke: #ffffff;')
        expect(appStyleSource).toContain('stroke-width: 3px;')
    })
})

describe('Replay guide menu typography', () => {
    it('uses the application font size for menu items and icons', () => {
        expect(appStyleSource).toMatch(/\.replay-widget-guide-context-menu-item\s*\{\s*font-size:\s*var\(--lgs-font-size\);/)
        expect(appStyleSource).toMatch(/& wa-icon\s*\{\s*font-size:\s*var\(--lgs-font-size\);/)
    })
})

describe('on-map selected controls', () => {
    it('keeps selected controls visibly distinct from their surface', () => {
        expect(styleSource).toContain('--lgs-card-on-map-selected-bg-color: color-mix(in oklab, var(--wa-color-brand) 18%, var(--lgs-card-on-map-bg-color) 82%);')
        expect(styleSource).toContain('--lgs-card-on-map-selected-border-color: var(--lgs-card-on-map-hover-outline-color);')
        expect(styleSource).toContain('outline-color: var(--lgs-card-on-map-selected-border-color);')
    })
})

describe('on-map disabled controls', () => {
    it('slightly reduces the visibility of disabled buttons and their contents', () => {
        expect(styleSource).toContain('.wa-theme-lgs1920-on-map:is(wa-button, wa-icon-button)[disabled]')
        expect(styleSource).toContain('opacity: 0.85;')
    })
})
