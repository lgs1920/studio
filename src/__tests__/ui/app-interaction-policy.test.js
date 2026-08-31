/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-interaction-policy.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-08-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const appStyle = readFileSync(resolve('src/assets/css/app.css'), 'utf8')

describe('global UI interaction policy', () => {
    it('disables text selection globally and restores it for editable fields', () => {
        expect(appStyle).toContain('& * {\n        user-select: none !important;')
        expect(appStyle).toContain('[contenteditable="plaintext-only"]')
        expect(appStyle).toContain('wa-number-input')
        expect(appStyle).toContain('user-select: text !important;')
    })

    it('covers text-bearing parts of form web components', () => {
        expect(appStyle).toContain(')::part(input)')
        expect(appStyle).toContain(')::part(display-input)')
    })
})
