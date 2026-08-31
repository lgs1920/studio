/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-overlay-composer.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-08-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    buildReplayVideoComposerOverlays,
    getReplayVideoOverlayMetrics,
    resolveReplayVideoWidgetScale,
} from '@Core/ui/replay/ReplayVideoOverlayComposer'
import { Widget2Canvas } from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'

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

    it('does not derive widget scale from a rotated bounding box', () => {
        const widget = document.createElement('div')
        widget.style.width = '100px'
        widget.style.height = '40px'
        widget.style.transform = 'rotate(45deg)'
        widget.getBoundingClientRect = () => ({width: 100, height: 100})

        expect(resolveReplayVideoWidgetScale(widget, 1)).toEqual({x: 1, y: 1})
    })

    it('reads scale from a CSS matrix when DOMMatrix is unavailable', () => {
        const widget = document.createElement('div')
        widget.style.transform = 'matrix(2, 0, 0, 3, 0, 0)'

        expect(resolveReplayVideoWidgetScale(widget, 1)).toEqual({x: 2, y: 3})
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

    it('can bypass replay widget visibility filtering during HQ export', () => {
        const widgetEl = document.createElement('div')
        widgetEl.hidden = true
        const widgetCanvas = document.createElement('canvas')
        widgetCanvas.className = 'lgs-widget-canvas'
        widgetCanvas.width = 160
        widgetCanvas.height = 90
        widgetEl.appendChild(widgetCanvas)

        const composer = {
            addOverlay: vi.fn(),
            beginUpdate: vi.fn(),
            endUpdate: vi.fn(),
        }

        globalThis.lgs = {
            viewer: {
                container: document.createElement('div'),
            },
        }
        globalThis.__ = {
            ui: {
                widgetCache: {
                    getAll: vi.fn(() => new Map([
                        ['journey-stats-widget', {mounted: true}],
                    ])),
                },
                widgetManager: {
                    getElementById: vi.fn(() => widgetEl),
                    getWidgetConfig: vi.fn(() => ({
                        position: {left: 12, top: 24},
                    })),
                },
            },
        }

        buildReplayVideoComposerOverlays({
            composer,
            cropRect: {left: 0, top: 0, width: 320, height: 180},
            widgetKeys: ['journey-stats-widget'],
            skipVisibilityChecks: true,
        })

        expect(composer.beginUpdate).toHaveBeenCalledOnce()
        expect(composer.addOverlay).toHaveBeenCalledOnce()
        expect(composer.endUpdate).toHaveBeenCalledOnce()
        expect(composer.addOverlay).toHaveBeenCalledWith(
            widgetCanvas,
            expect.objectContaining({
                x: 12,
                y: 24,
                w: 160,
                h: 90,
            }),
        )
    })

    it('maps crop-relative widget geometry into an isolated host viewport', () => {
        const widgetEl = document.createElement('div')
        const widgetCanvas = document.createElement('canvas')
        widgetCanvas.className = 'lgs-widget-canvas'
        widgetCanvas.style.width = '100px'
        widgetCanvas.style.height = '40px'
        widgetEl.appendChild(widgetCanvas)
        const composer = {
            addOverlay: vi.fn(),
            beginUpdate: vi.fn(),
            endUpdate: vi.fn(),
        }
        globalThis.lgs = {viewer: {container: document.createElement('div')}}
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getElementById: vi.fn(() => widgetEl),
                    getWidgetConfig: vi.fn(() => ({position: {left: 30, top: 50}})),
                },
            },
        }

        buildReplayVideoComposerOverlays({
            composer,
            cropRect: {left: 10, top: 20, width: 320, height: 180},
            coordinateScale: {x: 2, y: 0.5},
            widgetKeys: ['scaled-widget'],
            skipVisibilityChecks: true,
        })

        expect(composer.addOverlay).toHaveBeenCalledWith(
            widgetCanvas,
            expect.objectContaining({
                x: 40,
                y: 15,
                w: 200,
                h: 20,
            }),
        )
    })

    it('uses the latest SnapDOM capture geometry for the overlay size', () => {
        const widgetEl = document.createElement('div')
        const widgetCanvas = document.createElement('canvas')
        widgetCanvas.className = 'lgs-widget-canvas'
        widgetCanvas.style.width = '100px'
        widgetCanvas.style.height = '40px'
        widgetEl.appendChild(widgetCanvas)
        const composer = {
            addOverlay: vi.fn(),
            beginUpdate: vi.fn(),
            endUpdate: vi.fn(),
        }
        globalThis.lgs = {viewer: {container: document.createElement('div')}}
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getElementById: vi.fn(() => widgetEl),
                    getWidgetConfig: vi.fn(() => ({
                        dimensions: {width: 100, height: 60},
                        position: {left: 30, top: 50},
                    })),
                },
            },
        }

        const captureGeometrySpy = vi.spyOn(Widget2Canvas, 'get').mockReturnValue({
            getCaptureGeometry: () => ({width: 100, height: 60, offsetX: 4, offsetY: 6}),
        })

        buildReplayVideoComposerOverlays({
            composer,
            cropRect: {left: 0, top: 0, width: 320, height: 180},
            widgetKeys: ['stats-widget'],
            skipVisibilityChecks: true,
        })

        expect(composer.addOverlay).toHaveBeenCalledWith(
            widgetCanvas,
            expect.objectContaining({
                x: 26,
                y: 44,
                w: 100,
                h: 60,
            }),
        )

        captureGeometrySpy.mockRestore()
    })

    it('uses the shared visibility resolver unless an explicit bypass is requested', () => {
        const widgetEl = document.createElement('div')
        widgetEl.dataset.videoOverlayVisible = 'false'
        const widgetCanvas = document.createElement('canvas')
        widgetCanvas.className = 'lgs-widget-canvas'
        widgetEl.appendChild(widgetCanvas)

        const composer = {
            addOverlay: vi.fn(),
            beginUpdate: vi.fn(),
            endUpdate: vi.fn(),
        }

        globalThis.lgs = {
            viewer: {
                container: document.createElement('div'),
            },
            stores: {
                replay: {
                    recordingSync: true,
                    dynamicFrameState: null,
                },
            },
        }
        globalThis.__ = {
            ui: {
                widgetCache: {
                    getAll: vi.fn(() => new Map([
                        ['custom-widget', {mounted: true}],
                    ])),
                },
                widgetManager: {
                    getElementById: vi.fn(() => widgetEl),
                    getWidgetConfig: vi.fn(() => ({})),
                },
            },
        }

        buildReplayVideoComposerOverlays({
            composer,
            cropRect: {left: 0, top: 0, width: 320, height: 180},
            widgetKeys: ['custom-widget'],
        })

        expect(composer.beginUpdate).toHaveBeenCalledOnce()
        expect(composer.addOverlay).not.toHaveBeenCalled()
        expect(composer.endUpdate).toHaveBeenCalledOnce()
    })
})
