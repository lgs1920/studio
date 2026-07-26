/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-overlay-composer.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildReplayVideoComposerOverlays, getReplayVideoOverlayMetrics } from '@Core/ui/replay/ReplayVideoOverlayComposer'

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
        globalThis.lgs = undefined
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

    it('includes hidden replay diagnostics canvases in the HQ composer', () => {
        const container = document.createElement('div')
        const diagnosticsCanvas = document.createElement('canvas')
        diagnosticsCanvas.hidden = true
        diagnosticsCanvas.dataset.replayVideoOverlayCanvas = 'true'
        container.appendChild(diagnosticsCanvas)

        const composer = {
            addOverlay: vi.fn(),
            beginUpdate: vi.fn(),
            endUpdate: vi.fn(),
        }

        globalThis.lgs = {
            viewer: {
                container,
            },
        }

        buildReplayVideoComposerOverlays({
            composer,
            cropRect: {left: 0, top: 0, width: 320, height: 180},
            widgetKeys: ['unused-widget'],
        })

        expect(composer.beginUpdate).toHaveBeenCalledOnce()
        expect(composer.addOverlay).toHaveBeenCalledOnce()
        expect(composer.endUpdate).toHaveBeenCalledOnce()
        expect(composer.addOverlay).toHaveBeenCalledWith(
            diagnosticsCanvas,
            expect.objectContaining({
                w: 320,
                h: 180,
            }),
        )
    })
})
