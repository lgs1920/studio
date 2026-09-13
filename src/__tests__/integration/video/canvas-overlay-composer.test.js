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
 * Last modified: 2026-09-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, test, vi} from 'vitest'
import {CanvasOverlayComposer} from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'

describe('CanvasOverlayComposer recording path', () => {
    let composer

    afterEach(() => {
        composer?.dispose()
        vi.restoreAllMocks()
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
        globalThis.requestAnimationFrame = vi.fn(() => 1)
        globalThis.cancelAnimationFrame = vi.fn()
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
})
