/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: canvas-overlay-composer.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-13
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, test, vi} from 'vitest'
import {CanvasOverlayComposer} from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {createReplayRecordingPerformance} from '@Core/ui/replay/ReplayRecordingPerformance'

/**
 * Create the 2D canvas methods exercised by the compositor tests.
 * @returns {Object} Mocked canvas rendering context.
 */
const createMockCanvasContext = () => ({
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
})

/**
 * Stub jsdom's missing 2D canvas context for one compositor test.
 */
const stubCanvasContext = () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => createMockCanvasContext())
}

describe('CanvasOverlayComposer recording path', () => {
    let composer

    afterEach(() => {
        composer?.dispose()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    test('renders a clipped source with a blurred overlay during a manual capture', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 800
        sourceCanvas.height = 450
        sourceCanvas.getBoundingClientRect = () => ({width: 800, height: 450, left: 10, top: 20})

        const overlayCanvas = document.createElement('canvas')
        overlayCanvas.width = 240
        overlayCanvas.height = 120
        overlayCanvas.getBoundingClientRect = () => ({width: 240, height: 120, left: 110, top: 80})

        const flushWebGLBuffer = vi.fn()
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        stubCanvasContext()
        composer = new CanvasOverlayComposer(sourceCanvas, {
            clip: {x: 10, y: 20, width: 400, height: 225},
            width: 400,
            height: 225,
            fps: 30,
            outputDpr: 1,
            flushWebGLBuffer,
        })

        composer.setContinuousRendering(false)
        composer.beginUpdate()
        composer.addOverlay(overlayCanvas, {
            blur: 8,
            radius: 12,
            rotate: 4,
            scale: {x: 1.1, y: 1.1},
            shadowMargins: {top: 2, right: 3, bottom: 4, left: 5},
        })
        composer.endUpdate()

        const outputCanvas = await composer.renderFrame()

        expect(outputCanvas.width).toBe(400)
        expect(outputCanvas.height).toBe(225)
        expect(flushWebGLBuffer).toHaveBeenCalledOnce()
        expect(globalThis.cancelAnimationFrame).toHaveBeenCalled()
    })

    test('renders only requested frames when constructed for deterministic export', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        const flushWebGLBuffer = vi.fn()
        vi.stubGlobal('requestAnimationFrame', vi.fn())
        stubCanvasContext()
        composer = new CanvasOverlayComposer(sourceCanvas, {
            width: 320, height: 180, outputDpr: 1,
            continuousRendering: false, flushWebGLBuffer,
        })
        await composer.renderFrame()
        await composer.renderFrame()
        expect(flushWebGLBuffer).toHaveBeenCalledTimes(2)
        expect(requestAnimationFrame).not.toHaveBeenCalled()
    })

    test('composes directly into the caller-owned frame without disposing its pixels', async () => {
        const source = document.createElement('canvas')
        const outputCanvas = document.createElement('canvas')
        source.width = 320
        source.height = 180
        stubCanvasContext()
        composer = new CanvasOverlayComposer(source, {
            width: 320, height: 180, outputDpr: 1, continuousRendering: false, outputCanvas,
        })
        expect(await composer.renderFrame()).toBe(outputCanvas)
        composer.dispose()
        expect(outputCanvas.width).toBe(320)
        expect(outputCanvas.height).toBe(180)
    })

    test('allocates a matching unsmoothed blur buffer only when a blurred overlay is added', () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        const overlayCanvas = document.createElement('canvas')
        const originalCreateElement = document.createElement.bind(document)
        const createdCanvases = []
        const canvasContexts = new WeakMap()
        vi.spyOn(document, 'createElement').mockImplementation((tagName, ...args) => {
            const element = originalCreateElement(tagName, ...args)
            if (tagName !== 'canvas') {
                return element
            }

            const context = {setTransform: vi.fn(), fillStyle: '#000000'}
            let imageSmoothingEnabled = false
            let imageSmoothingQuality = 'low'
            Object.defineProperties(context, {
                imageSmoothingEnabled: {
                    get: () => imageSmoothingEnabled,
                    set: value => { imageSmoothingEnabled = value },
                },
                imageSmoothingQuality: {
                    get: () => imageSmoothingQuality,
                    set: value => { imageSmoothingQuality = value },
                },
            })
            canvasContexts.set(element, context)
            createdCanvases.push(element)
            element.getContext = () => context
            for (const dimension of ['width', 'height']) {
                let value = element[dimension]
                Object.defineProperty(element, dimension, {
                    configurable: true,
                    get: () => value,
                    set: nextValue => {
                        value = nextValue
                        context.imageSmoothingEnabled = false
                        context.imageSmoothingQuality = 'low'
                    },
                })
            }
            return element
        })

        composer = new CanvasOverlayComposer(sourceCanvas, {
            width: 320,
            height: 180,
            outputDpr: 2,
            continuousRendering: false,
        })

        expect(createdCanvases).toHaveLength(1)
        composer.addOverlay(overlayCanvas, {blur: 2})
        expect(createdCanvases).toHaveLength(2)
        const outputContext = canvasContexts.get(composer.getCanvas())
        const blurContext = canvasContexts.get(createdCanvases.find(canvas => canvas !== composer.getCanvas()))
        expect(composer.getCanvas().width).toBe(640)
        expect(composer.getCanvas().height).toBe(360)
        expect(outputContext.imageSmoothingEnabled).toBe(true)
        expect(outputContext.imageSmoothingQuality).toBe('high')
        expect(blurContext.imageSmoothingEnabled).toBe(false)
    })

    test('uses the overlay canvas CSS box instead of assuming a fixed bitmap DPR', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        sourceCanvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 320, height: 180})
        const overlayCanvas = document.createElement('canvas')
        overlayCanvas.width = 400
        overlayCanvas.height = 200
        overlayCanvas.getBoundingClientRect = () => ({left: 10, top: 20, width: 100, height: 50})
        const context = {
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'low',
            drawImage: vi.fn(),
            fillRect: vi.fn(),
            setTransform: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            scale: vi.fn(),
        }
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
        composer = new CanvasOverlayComposer(sourceCanvas, {
            width: 320,
            height: 180,
            outputDpr: 1,
            continuousRendering: false,
        })
        composer.addOverlay(overlayCanvas, {
            frameRotate: 90,
            frameRotationOrigin: {x: 25, y: 10},
        })

        await composer.renderFrame()

        const overlayDraw = context.drawImage.mock.calls.find(call => call[0] === overlayCanvas)
        expect(overlayDraw[7]).toBe(100)
        expect(overlayDraw[8]).toBe(50)
        expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2)
        expect(context.translate).toHaveBeenCalledWith(-25, -15)
    })

    test('excludes the scene flush from composition timings and reports the nested blur cost', async () => {
        let now = 0
        const performance = createReplayRecordingPerformance({now: () => now})
        performance.start({fps: 30})
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        sourceCanvas.getBoundingClientRect = () => {
            now += 2
            return {width: 320, height: 180, left: 0, top: 0}
        }
        const overlayCanvas = document.createElement('canvas')
        overlayCanvas.width = 40
        overlayCanvas.height = 20
        const drawImage = vi.fn(() => { now += 3 })
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage, fillRect: vi.fn(), setTransform: vi.fn(),
            save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
            beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
        })
        composer = new CanvasOverlayComposer(sourceCanvas, {
            width: 320, height: 180, outputDpr: 1,
            continuousRendering: false,
            flushWebGLBuffer: () => { now += 100 },
            recordingPerformance: performance,
        })
        composer.addOverlay(overlayCanvas, {x: 0, y: 0, w: 40, h: 20, blur: 4})
        await composer.renderFrame()
        const report = performance.finish()
        expect(report.stages.find(stage => stage.key === 'sourceLayout')).toMatchObject({count: 1, totalMillis: 2})
        expect(report.stages.find(stage => stage.key === 'composition')).toMatchObject({count: 1, totalMillis: 12})
        expect(report.stages.find(stage => stage.key === 'compositionBlur')).toMatchObject({kind: 'detail', count: 1, totalMillis: 6})
        expect(drawImage).toHaveBeenCalledTimes(4)
        expect(report.wallMillis).toBeGreaterThanOrEqual(114)
    })
})
