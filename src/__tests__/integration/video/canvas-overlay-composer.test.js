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
 * Last modified: 2026-10-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, test, vi} from 'vitest'
import {CanvasOverlayComposer} from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {createReplayRecordingPerformance} from '@Core/ui/replay/ReplayRecordingPerformance'

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
        composer = new CanvasOverlayComposer(source, {
            width: 320, height: 180, outputDpr: 1, continuousRendering: false, outputCanvas,
        })
        expect(await composer.renderFrame()).toBe(outputCanvas)
        composer.dispose()
        expect(outputCanvas.width).toBe(320)
        expect(outputCanvas.height).toBe(180)
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
