/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-widget-capture.browser.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {page} from 'vitest/browser'
import {afterEach, expect, test, vi} from 'vitest'
import {Cartesian3, CesiumWidget, Color, EllipsoidTerrainProvider} from 'cesium'
import {snapdom} from '@zumer/snapdom'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import {Widget2Canvas} from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'
import {CanvasOverlayComposer} from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {prepareReplaySceneTilesForCapture} from '@Core/ui/replay/ReplaySceneTileReadiness'
import {ReplayDeferredExporter} from '@Core/ui/replay/ReplayDeferredExporter'

const resources = []

/** Build a real DOM stats fixture with the same capture effects as a scene widget. */
const createWidgetFixture = () => {
    const element = document.createElement('div')
    element.style.cssText = 'width:240px;padding:12px;font:24px sans-serif;color:white;background:rgba(0,0,0,0.7);border:2px solid white;border-radius:12px'
    element.innerHTML = '<div>Distance</div><strong>120 m</strong>'
    document.body.append(element)
    resources.push(() => element.remove())
    return element
}

/** Read pixels to include completed raster work in the measured composition workload. */
const readPixels = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data

/** Compare buffers without expanding every channel into assertion diagnostics. */
const samePixels = (left, right) => left.length === right.length && left.every((channel, index) => channel === right[index])

afterEach(() => {
    resources.splice(0).reverse().forEach(dispose => dispose())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

test('captures real widget changes and reuses unchanged or hidden frames', async () => {
    const element = createWidgetFixture()
    let visible = true
    const mirror = new Widget2Canvas(element, {refreshMode: 'manual', captureWholeWidget: true, scale: 1, dpr: 1, isVisible: () => visible})
    resources.push(() => mirror.destroy())
    await mirror.init()
    const draw = vi.spyOn(mirror.getContext(), 'drawImage')
    const originalPixels = readPixels(mirror.getCanvas())
    for (let frame = 0; frame < 30; frame++) {
        expect(await mirror.flush({onlyIfDirty: true})).toBe(true)
    }
    expect(draw).not.toHaveBeenCalled()
    visible = false
    element.querySelector('strong').textContent = '222 m'
    expect(await mirror.flush({onlyIfDirty: true})).toBe(false)
    expect(samePixels(readPixels(mirror.getCanvas()), originalPixels)).toBe(true)
    visible = true
    expect(await mirror.flush({onlyIfDirty: true})).toBe(true)
    expect(draw).toHaveBeenCalledOnce()
    expect(samePixels(readPixels(mirror.getCanvas()), originalPixels)).toBe(false)

    // Timing is informational: correctness never depends on a machine's speed.
    if (import.meta.env.VITE_REPLAY_CAPTURE_BENCHMARK === 'true') {
        const samples = {forced: [], reused: []}
        for (let round = 0; round < 6; round++) {
            for (const mode of round % 2 ? ['reused', 'forced'] : ['forced', 'reused']) {
                const start = performance.now()
                for (let frame = 0; frame < 30; frame++) {
                    if (mode === 'forced') {
                        const capture = await snapdom(element, {scale: 1, dpr: 1, embedFonts: true})
                        await capture.toCanvas()
                    }
                    else {
                        await mirror.flush({onlyIfDirty: true})
                    }
                }
                samples[mode].push(performance.now() - start)
            }
        }
        console.info('Replay widget benchmark (30 unchanged frames, warm SnapDOM)', JSON.stringify(samples))
    }
}, 60000)

test('preserves Cesium crop pixels with direct composition', async ({skip}) => {
    vi.stubGlobal('CESIUM_BASE_URL', new URL('/node_modules/cesium/Build/Cesium/', location.href).href)
    const host = document.createElement('div')
    host.style.cssText = 'width:640px;height:360px'
    document.body.append(host)
    resources.push(() => host.remove())
    let viewer
    try {
        viewer = new CesiumWidget(host, {
            baseLayer: false, terrainProvider: new EllipsoidTerrainProvider(),
            useDefaultRenderLoop: false, skyBox: false, skyAtmosphere: false,
            contextOptions: {webgl: {preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false}},
        })
    }
    catch (error) {
        skip(`WebGL context is unavailable: ${error.message}`)
    }
    resources.push(() => viewer.destroy())
    viewer.scene.globe.baseColor = Color.ROYALBLUE
    viewer.camera.setView({destination: Cartesian3.fromDegrees(2, 46, 9000000)})
    await prepareReplaySceneTilesForCapture({scene: viewer.scene, maxMillis: 5000})
    const widget = createWidgetFixture()
    const mirror = new Widget2Canvas(widget, {refreshMode: 'manual', captureWholeWidget: true, scale: 1, dpr: 1})
    resources.push(() => mirror.destroy())
    await mirror.init()
    const options = {
        clip: {x: 80, y: 40, width: 480, height: 280}, width: 320, height: 180, outputDpr: 1,
        continuousRendering: false, flushWebGLBuffer: () => viewer.render(),
    }
    const reference = new CanvasOverlayComposer(viewer.canvas, options)
    resources.push(() => reference.dispose())
    reference.beginUpdate()
    reference.addOverlay(mirror.getCanvas(), {x: 8, y: 8, w: 120, h: 50})
    await reference.renderFrame()
    const referencePixels = readPixels(reference.getCanvas())
    expect(referencePixels.some((channel, index) => index % 4 === 2 && channel > 100)).toBe(true)
    const outputCanvas = document.createElement('canvas')
    outputCanvas.dataset.testid = 'replay-capture-frame'
    document.body.append(outputCanvas)
    resources.push(() => outputCanvas.remove())
    const direct = new CanvasOverlayComposer(viewer.canvas, {...options, outputCanvas})
    resources.push(() => direct.dispose())
    direct.beginUpdate()
    direct.addOverlay(mirror.getCanvas(), {x: 8, y: 8, w: 120, h: 50})
    expect(await direct.renderFrame()).toBe(outputCanvas)
    expect(samePixels(readPixels(outputCanvas), referencePixels)).toBe(true)
    await page.getByTestId('replay-capture-frame').screenshot({path: '/tmp/lgs-replay-capture.png'})
}, 60000)

test('encodes dynamic widget updates and disappearance into a real MP4', async ({skip}) => {
    if (typeof VideoEncoder === 'undefined') {
        skip('This browser has no WebCodecs video encoder')
    }
    const widget = createWidgetFixture()
    const mirror = new Widget2Canvas(widget, {refreshMode: 'manual', captureWholeWidget: true, scale: 1, dpr: 1})
    resources.push(() => mirror.destroy())
    await mirror.init()
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = 320
    sourceCanvas.height = 180
    const sourceContext = sourceCanvas.getContext('2d')
    sourceContext.fillStyle = 'royalblue'
    sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height)
    const direct = new CanvasOverlayComposer(sourceCanvas, {width: 320, height: 180, outputDpr: 1, continuousRendering: false})
    resources.push(() => direct.dispose())
    const outputCanvas = direct.getCanvas()
    const exporter = new ReplayDeferredExporter({
        timeline: {durationMillis: 500, fps: 10},
        controller: {sampler: {atProgress: progress => ({progress})}, currentSample: () => null},
    })
    const framePixels = []
    const result = await exporter.exportMp4({
        dimensions: {width: 320, height: 180}, buildCanvas: () => outputCanvas,
        renderFrame: async ({frame}) => {
            widget.querySelector('strong').textContent = `${120 + frame.index} m`
            await mirror.flush({onlyIfDirty: true})
            direct.beginUpdate()
            if (frame.index < 3) {
                direct.addOverlay(mirror.getCanvas(), {x: 8, y: 8, w: 120, h: 50})
            }
            await direct.renderFrame()
            framePixels.push(readPixels(outputCanvas))
        },
    })
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.mimeType).toBe('video/mp4')
    expect(framePixels).toHaveLength(6)
    expect(samePixels(framePixels[0], framePixels[1])).toBe(false)
    expect(samePixels(framePixels[2], framePixels[3])).toBe(false)
    expect(samePixels(framePixels[3], framePixels[4])).toBe(true)
}, 60000)
