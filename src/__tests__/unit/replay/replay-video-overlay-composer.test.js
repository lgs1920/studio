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
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    buildReplayVideoComposerOverlays,
    flushReplayVideoOverlayCanvases,
    getReplayVideoOverlayMetrics,
    isReplayVideoWidgetReady,
    resolveReplayVideoWidgetScale,
} from '@Core/ui/replay/ReplayVideoOverlayComposer'
import { Widget2Canvas } from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'
import { registerReplayWidgetFrameRenderer } from '@Core/ui/replay/ReplayWidgetFrameRenderers'

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

    it('does not include hidden replay diagnostics canvases in the video', () => {
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
        expect(composer.addOverlay).not.toHaveBeenCalled()
        expect(composer.endUpdate).toHaveBeenCalledOnce()
    })

    it('includes visible replay diagnostics canvases in the video', () => {
        const container = document.createElement('div')
        const diagnosticsCanvas = document.createElement('canvas')
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

        expect(composer.addOverlay).toHaveBeenCalledWith(
            diagnosticsCanvas,
            expect.objectContaining({
                w: 320,
                h: 180,
            }),
        )
    })

    it('can bypass replay widget visibility filtering during Replay export', () => {
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
                    ['compass-widget', {mounted: true}],
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
            widgetKeys: ['compass-widget'],
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
            widgetKeys: ['compass-widget'],
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
            widgetKeys: ['compass-widget'],
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

describe('Replay video widget capture canvas resolution', () => {
    afterEach(() => {
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('resolves the Widget2Canvas sibling used by mounted widgets', () => {
        const container = document.createElement('div')
        const widgetElement = document.createElement('div')
        const captureCanvas = document.createElement('canvas')
        captureCanvas.className = 'lgs-widget-canvas'
        captureCanvas.width = 160
        captureCanvas.height = 90
        container.append(captureCanvas, widgetElement)

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
                    isMounted: vi.fn(() => true),
                },
                widgetManager: {
                    getElementById: vi.fn(() => widgetElement),
                    getWidgetConfig: vi.fn(() => ({position: {left: 12, top: 24}})),
                },
            },
        }

        buildReplayVideoComposerOverlays({
            composer,
            cropRect: {left: 0, top: 0, width: 320, height: 180},
            widgetKeys: ['credits-widget#video'],
        })

        expect(isReplayVideoWidgetReady('credits-widget#video')).toBe(true)
        expect(composer.addOverlay).toHaveBeenCalledWith(
            captureCanvas,
            expect.objectContaining({
                x: 12,
                y: 24,
                w: 160,
                h: 90,
            }),
        )
    })
})

describe('Replay widget frame capture', () => {
    const unregister = []

    beforeEach(() => {
        globalThis.__ = {ui: {widgetManager: {getElementById: vi.fn()}}}
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'expert'}}},
            stores: {replay: {recordingSync: true, active: true, playing: true}},
        }
    })

    afterEach(() => {
        unregister.splice(0).forEach(cleanup => cleanup())
        vi.restoreAllMocks()
        vi.useRealTimers()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('flushes and composes the same visible set across the final replay boundary', async () => {
        const elements = new Map(['dynamic-stats-widget#video', 'journey-stats-widget#video'].map(widgetId => {
            const element = document.createElement('div')
            const canvas = document.createElement('canvas')
            canvas.className = 'lgs-widget-canvas'
            element.append(canvas)
            return [widgetId, element]
        }))
        __.ui.widgetManager.getElementById.mockImplementation(widgetId => elements.get(widgetId))
        const flush = vi.spyOn(Widget2Canvas, 'flush').mockResolvedValue(true)
        const dynamicRender = vi.fn()
        const journeyRender = vi.fn()
        unregister.push(registerReplayWidgetFrameRenderer('dynamic-stats-widget#video', dynamicRender))
        unregister.push(registerReplayWidgetFrameRenderer('journey-stats-widget#video', journeyRender))
        const composer = {beginUpdate: vi.fn(), addOverlay: vi.fn(), endUpdate: vi.fn()}
        for (const replayFrameIndex of [4, 8, 4]) {
            lgs.stores.replay.framePhase = {kind: 'replay', replayFrameIndex, replayFrameCount: 10}
            const keys = await flushReplayVideoOverlayCanvases({widgetKeys: [...elements.keys()], strict: true})
            const expected = replayFrameIndex === 8 ? 'journey-stats-widget#video' : 'dynamic-stats-widget#video'
            expect(keys).toEqual([expected])
            expect(flush).toHaveBeenLastCalledWith(expected, {onlyIfDirty: true})
            buildReplayVideoComposerOverlays({composer, widgetKeys: keys})
            expect(composer.addOverlay).toHaveBeenLastCalledWith(elements.get(expected).firstChild, expect.any(Object))
        }
        expect(flush).toHaveBeenCalledTimes(3)
        expect(dynamicRender).toHaveBeenCalledTimes(2)
        expect(journeyRender).toHaveBeenCalledTimes(1)
    })

    it('does no capture or discovery for an explicitly empty widget set', async () => {
        const flush = vi.spyOn(Widget2Canvas, 'flush').mockResolvedValue(true)
        expect(await flushReplayVideoOverlayCanvases({widgetKeys: []})).toEqual([])
        expect(flush).not.toHaveBeenCalled()
        expect(__.ui.widgetManager.getElementById).not.toHaveBeenCalled()
    })

    it('respects user-hidden widgets before a positive overlay visibility hint', async () => {
        const element = document.createElement('div')
        element.dataset.videoOverlayVisible = 'true'
        __.ui.widgetManager.getElementById.mockReturnValue(element)
        lgs.stores.ui = {widget: {list: new Map([['custom-widget', {visible: false}]])}}
        const flush = vi.spyOn(Widget2Canvas, 'flush').mockResolvedValue(true)
        expect(await flushReplayVideoOverlayCanvases({widgetKeys: ['custom-widget']})).toEqual([])
        expect(flush).not.toHaveBeenCalled()
    })

    it('rejects a timed-out visible capture instead of encoding stale pixels', async () => {
        vi.useFakeTimers()
        __.ui.widgetManager.getElementById.mockReturnValue(document.createElement('div'))
        vi.spyOn(Widget2Canvas, 'flush').mockReturnValue(new Promise(() => {}))
        const capture = flushReplayVideoOverlayCanvases({widgetKeys: ['custom-widget'], strict: true, timeoutMs: 100})
        const rejection = expect(capture).rejects.toThrow('custom-widget')
        await vi.advanceTimersByTimeAsync(100)
        await rejection
        expect(vi.getTimerCount()).toBe(0)
    })

    it('waits for a visible widget mirror to register during Replay startup', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(0)
        __.ui.widgetManager.getElementById.mockReturnValue(document.createElement('div'))
        const mirror = {setFrameDriven: vi.fn()}
        vi.spyOn(Widget2Canvas, 'get').mockImplementation(() => Date.now() >= 16 ? mirror : null)
        const flush = vi.spyOn(Widget2Canvas, 'flush')
            .mockResolvedValueOnce(false)
            .mockResolvedValue(true)
        const captureMirrors = new Set()
        const capture = flushReplayVideoOverlayCanvases({
            widgetKeys: ['logo-widget'], strict: true, timeoutMs: 100, captureMirrors,
        })

        await vi.advanceTimersByTimeAsync(16)

        await expect(capture).resolves.toEqual(['logo-widget'])
        expect(flush).toHaveBeenCalledTimes(2)
        expect(mirror.setFrameDriven).toHaveBeenCalledWith(true)
        expect(captureMirrors).toEqual(new Set([mirror]))
        expect(vi.getTimerCount()).toBe(0)
    })

    it('aborts an in-flight widget capture and releases its timeout', async () => {
        vi.useFakeTimers()
        __.ui.widgetManager.getElementById.mockReturnValue(document.createElement('div'))
        const controller = new AbortController()
        vi.spyOn(Widget2Canvas, 'flush').mockImplementation(() => {
            controller.abort()
            return new Promise(() => {})
        })
        await expect(flushReplayVideoOverlayCanvases({
            widgetKeys: ['custom-widget'], strict: true, signal: controller.signal,
        })).rejects.toMatchObject({name: 'AbortError'})
        expect(vi.getTimerCount()).toBe(0)
    })

    it('preserves a replacement renderer when an obsolete component unmounts', async () => {
        const obsolete = vi.fn()
        const replacement = vi.fn()
        const releaseObsolete = registerReplayWidgetFrameRenderer('custom-widget', obsolete)
        unregister.push(registerReplayWidgetFrameRenderer('custom-widget', replacement))
        releaseObsolete()
        __.ui.widgetManager.getElementById.mockReturnValue(document.createElement('div'))
        vi.spyOn(Widget2Canvas, 'flush').mockResolvedValue(true)
        await flushReplayVideoOverlayCanvases({widgetKeys: ['custom-widget'], frameState: {index: 7}})
        expect(obsolete).not.toHaveBeenCalled()
        expect(replacement).toHaveBeenCalledWith({index: 7})
    })
})
