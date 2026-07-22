/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-overlay-composer.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getReplayVideoOverlayMetrics } from '@Core/ui/replay/ReplayVideoOverlayComposer'

describe('getReplayVideoOverlayMetrics', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getShadowMargins: vi.fn((x, y, blur, spread = 0) => ({
                        top:    Math.max(0, blur + spread - y),
                        right:  Math.max(0, blur + spread + x),
                        bottom: Math.max(0, blur + spread + y),
                        left:   Math.max(0, blur + spread - x),
                    })),
                },
            },
        }
    })

    afterEach(() => {
        globalThis.__ = undefined
    })

    it('does not turn text shadows into overlay margins', () => {
        const element = {children: []}
        const originalGetComputedStyle = globalThis.getComputedStyle
        globalThis.getComputedStyle = vi.fn(() => ({
            backdropFilter: 'none',
            borderRadius:    '0px',
            borderWidth:     '0px',
            boxShadow:       'none',
            textShadow:      'rgba(0, 0, 0, 0.5) 0px 4px 8px',
        }))

        expect(getReplayVideoOverlayMetrics(element).margins).toEqual({top: 0, right: 0, bottom: 0, left: 0})

        globalThis.getComputedStyle = originalGetComputedStyle
    })
})
