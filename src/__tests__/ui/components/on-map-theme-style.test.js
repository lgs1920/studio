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
 * Last modified: 2026-09-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const styleSource = readFileSync(resolve('src/assets/css/themes/wa-lgs1920-on-map.css'), 'utf8')

describe('on-map selected controls', () => {
    it('keeps selected controls visibly distinct from their surface', () => {
        expect(styleSource).toContain('--lgs-card-on-map-selected-bg-color: color-mix(in oklab, var(--wa-color-brand) 18%, var(--lgs-card-on-map-bg-color) 82%);')
        expect(styleSource).toContain('--lgs-card-on-map-selected-border-color: var(--lgs-card-on-map-hover-outline-color);')
        expect(styleSource).toContain('outline-color: var(--lgs-card-on-map-selected-border-color);')
    })
})
