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
 * Last modified: 2026-10-22
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

describe('Fix Path map cursor branding', () => {
    it('uses the application brand token for its Font Awesome cursor icons', () => {
        expect(fixPathEditorStyleSource).toMatch(/\.fix-path-journey-cursor\s*\{[^}]*color:\s*var\(--wa-color-brand\);/s)
    })

    it('keeps substituted selection and guide cursors centered at native cursor scale', () => {
        expect(fixPathEditorStyleSource).toMatch(/\.fix-path-journey-cursor\s*\{[^}]*transform:\s*translate\(-50%, -50%\);/s)
        expect(fixPathEditorStyleSource).toMatch(/&\.is-area-selection-cursor\s*\{\s*font-size:\s*1\.5rem;/s)
        expect(appStyleSource).toMatch(/\.replay-widget-guide-drag-cursor\s*\{[^}]*width:\s*1\.5rem;[^}]*height:\s*1\.5rem;/s)
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
