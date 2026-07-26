/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: text-utils.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-05-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import { decodeHTMLEntities }   from '@Utils/TextUtils'

describe('TextUtils', () => {
    it('decodes named and numeric HTML entities', () => {
        expect(decodeHTMLEntities('Cr&ecirc;te &amp; caf&eacute; &#39;test&#39;')).toBe('Cr\u00eate & caf\u00e9 \'test\'')
    })

    it('decodes descriptions that were encoded more than once', () => {
        expect(decodeHTMLEntities('Fran&amp;ccedil;ais')).toBe('Fran\u00e7ais')
    })

    it('keeps plain text unchanged', () => {
        expect(decodeHTMLEntities('Plain text')).toBe('Plain text')
    })
})
