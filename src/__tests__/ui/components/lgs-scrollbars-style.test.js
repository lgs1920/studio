/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: lgs-scrollbars-style.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-31
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const styleSource = readFileSync(resolve('src/assets/css/theme.css'), 'utf8')

describe('LGS scrollbar styles', () => {
    it('shares the timeline scrollbar visual contract', () => {
        expect(styleSource).toContain('--lgs-scrollbar-track-color: color-mix(in oklab, var(--wa-color-text-quiet) 22%, transparent);')
        expect(styleSource).toContain('--lgs-scrollbar-thumb-color: var(--lgs-switch-active-track-color);')
        expect(styleSource).toContain('border-radius: 999px;')
        expect(styleSource).toContain('right: 2px;')
        expect(styleSource).toContain('outline: 2px solid var(--wa-color-focus, var(--wa-color-brand));')
        expect(styleSource).toContain('outline-offset: 1px;')
    })
})
