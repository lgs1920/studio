/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-editor.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified: 2026-07-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyEditor } from '@Core/ui/JourneyEditor'
import { COLOR_SWATCHES_NONE, COLOR_SWATCHES_RANDOM, COLOR_SWATCHES_SEQUENCE } from '@Core/constants'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { proxy } from 'valtio'

describe('JourneyEditor.newColor', () => {
    beforeEach(() => {
        globalThis.lgs = {
            settings: {
                swatches: {
                    list: ['#ee6666', '#fac858', '#ffffff'],
                    current: undefined,
                },
                getSwatches: {
                    distribution: COLOR_SWATCHES_SEQUENCE,
                },
            },
            journeyEditorStore: proxy({}),
        }
        JourneyEditor.instance = undefined
    })

    afterEach(() => {
        JourneyEditor.instance = undefined
        globalThis.lgs = undefined
        vi.restoreAllMocks()
    })

    it('returns the first palette color when sequence index is missing', () => {
        const editor = new JourneyEditor()

        expect(editor.newColor()).toBe('#ee6666')
        expect(globalThis.lgs.settings.swatches.current).toBe(1)
    })

    it('falls back to the first palette color when swatches are set to none', () => {
        globalThis.lgs.settings.getSwatches.distribution = COLOR_SWATCHES_NONE

        const editor = new JourneyEditor()

        expect(editor.newColor()).toBe('#ee6666')
        expect(globalThis.lgs.settings.swatches.current).toBe(1)
    })

    it('keeps advancing through the palette in sequence mode', () => {
        const editor = new JourneyEditor()

        expect(editor.newColor()).toBe('#ee6666')
        expect(editor.newColor()).toBe('#fac858')
    })

    it('keeps advancing even if the settings cursor is reset externally', () => {
        const editor = new JourneyEditor()

        expect(editor.newColor()).toBe('#ee6666')
        globalThis.lgs.settings.swatches.current = 0
        expect(editor.newColor()).toBe('#fac858')
    })

    it('supports random mode without returning undefined', () => {
        globalThis.lgs.settings.getSwatches.distribution = COLOR_SWATCHES_RANDOM
        vi.spyOn(Math, 'random').mockReturnValue(0.9)

        const editor = new JourneyEditor()

        expect(editor.newColor()).toBe('#ffffff')
    })
})
