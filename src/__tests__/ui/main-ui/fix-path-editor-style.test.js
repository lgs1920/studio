/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-style.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const loadFixPathStyle = () => readFileSync(resolve('src/components/MainUI/FixPathEditor.css'), 'utf8')

describe('Fix Path editor layout', () => {
    it('keeps Web Awesome input borders within the correction row height', () => {
        const css = loadFixPathStyle()
        const inputBaseRule = css.match(/\.fix-path-correction-point-row wa-input::part\(base\) \{([^}]*)\}/)
        const rowRules = [...css.matchAll(/\.fix-path-correction-point-row \{([^}]*)\}/g)]
        const rowRule = rowRules.at(-1)

        expect(inputBaseRule?.[1]).toContain('box-sizing: border-box;')
        expect(inputBaseRule?.[1]).toContain('height: var(--fix-path-correction-row-height);')
        expect(rowRule?.[1]).toContain('align-items: stretch;')
    })
})
