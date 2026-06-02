/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-render-style.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import {
    TRACK_RENDER_STYLE_DEFAULT_GAP_COLOR,
    TRACK_RENDER_STYLE_TRANSPARENT_GAP_COLOR,
    normalizeTrackRenderStyle,
} from '@Utils/cesium/trackRenderStyle'

describe('track render style', () => {
    it('keeps dash gap transparent unless bicolor is enabled', () => {
        const style = normalizeTrackRenderStyle({
                                                    dash: {
                                                        enabled:  true,
                                                        biColor:  false,
                                                        gapColor: 'rgba(30, 144, 255, 0.85)',
                                                    },
                                                })

        expect(style.dash.biColor).toBe(false)
        expect(style.dash.gapColor).toBe(TRACK_RENDER_STYLE_TRANSPARENT_GAP_COLOR)
    })

    it('forces a visible white gap color when bicolor is enabled from a transparent gap', () => {
        const style = normalizeTrackRenderStyle({
                                                    dash: {
                                                        enabled:  true,
                                                        biColor:  true,
                                                        gapColor: 'rgba(255, 255, 255, 0)',
                                                    },
                                                })

        expect(style.dash.biColor).toBe(true)
        expect(style.dash.gapColor).toBe(TRACK_RENDER_STYLE_DEFAULT_GAP_COLOR)
    })

    it('keeps legacy non-transparent gap colors bicolor', () => {
        const style = normalizeTrackRenderStyle({
                                                    dash: {
                                                        enabled:  true,
                                                        gapColor: 'rgba(30, 144, 255, 0.85)',
                                                    },
                                                })

        expect(style.dash.biColor).toBe(true)
        expect(style.dash.gapColor).toBe('rgba(30, 144, 255, 0.85)')
    })
})
