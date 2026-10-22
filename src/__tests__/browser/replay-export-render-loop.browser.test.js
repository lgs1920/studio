/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-export-render-loop.browser.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-22
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {server} from 'vitest/browser'
import {afterEach, expect, test, vi} from 'vitest'
import {CallbackProperty, Cartesian3, CesiumWidget, Color, EllipsoidTerrainProvider} from 'cesium'
import {BufferTarget, CanvasSource, Mp4OutputFormat, Output} from 'mediabunny'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import {acquireReplayExportRenderLoop} from '@Core/ui/replay/ReplayExportRenderLoop'
import {ReplayFrameTimeline} from '@Core/ui/replay/ReplayFrameTimeline'

const resources = []

afterEach(async () => {
    for (const dispose of resources.splice(0).reverse()) {
        await dispose()
    }
    vi.unstubAllGlobals()
})

test('renders updated terrain entities into a real MP4 with the default loop suspended', async () => {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2')
    expect(gl, 'The actual browser runner must support WebGL 2').not.toBeNull()
    gl.clearColor(0.25, 0.5, 0.75, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const pixel = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    expect(Array.from(pixel)).toEqual([64, 128, 191, 255])
    gl.getExtension('WEBGL_lose_context')?.loseContext()

    vi.stubGlobal('CESIUM_BASE_URL', new URL('/node_modules/cesium/Build/Cesium/', location.href).href)
    const host = document.createElement('div')
    host.style.cssText = 'width:320px;height:180px'
    document.body.append(host)
    resources.push(() => host.remove())
    const viewer = new CesiumWidget(host, {
        baseLayer: false,
        terrainProvider: new EllipsoidTerrainProvider(),
        useDefaultRenderLoop: true,
        skyBox: false,
        skyAtmosphere: false,
        contextOptions: {webgl: {preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false}},
    })
    resources.push(() => viewer.destroy())
    viewer.scene.globe.baseColor = Color.DARKSLATEGRAY
    viewer.camera.setView({destination: Cartesian3.fromDegrees(2, 46, 14000)})
    const loop = acquireReplayExportRenderLoop({viewer})
    resources.push(() => loop.release())
    expect(viewer.useDefaultRenderLoop).toBe(false)
    const route = Array.from({length: 4096}, (_, index) => Cartesian3.fromDegrees(
        1.96 + (index * 0.08 / 4095),
        46 + Math.sin(index / 300) * 0.008,
        0,
    ))
    let positions = route.slice(0, 2)
    let cursor = route[0]
    viewer.entities.add({polyline: {
        positions: new CallbackProperty(() => positions, false),
        clampToGround: true,
        width: 5,
        material: Color.MAGENTA,
        granularity: 8,
    }})
    viewer.entities.add({
        position: new CallbackProperty(() => cursor, false),
        point: {pixelSize: 12, color: Color.YELLOW, outlineColor: Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Infinity},
    })
    await expect.poll(() => {
        loop.render()
        return viewer.scene.globe.tilesLoaded
    }, {timeout: 15000}).toBe(true)

    const framePixels = []
    const frameSnapshots = []
    const timeline = new ReplayFrameTimeline({durationMillis: 500, fps: 10})
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const context = canvas.getContext('2d')
    const output = new Output({format: new Mp4OutputFormat(), target: new BufferTarget()})
    const source = new CanvasSource(canvas, {codec: 'avc', bitrate: 1_000_000})
    output.addVideoTrack(source, {frameRate: 10})
    let finalized = false
    resources.push(async () => {
        if (!finalized) {
            await output.cancel()
        }
    })
    const startedAt = performance.now()
    await output.start()
    const frameTimes = []
    for (const index of [0, 1, 2, 3, 4, 5]) {
        const frame = timeline.frameAtIndex(index)
        frameTimes.push(frame.frameTimeMs)
        positions = route.slice(0, Math.max(2, Math.round(frame.progress * route.length)))
        cursor = positions.at(-1)
        loop.render()
        context.drawImage(viewer.canvas, 0, 0, canvas.width, canvas.height)
        framePixels.push(context.getImageData(0, 0, canvas.width, canvas.height).data)
        if (frame.isFirst || frame.isLast) {
            frameSnapshots.push(canvas.toDataURL('image/png'))
        }
        await source.add(frame.frameTimeMs / 1000, frame.frameIntervalMs / 1000)
    }
    await source.close()
    await output.finalize()
    finalized = true
    const blob = new Blob([output.target.buffer], {type: 'video/mp4'})
    const elapsedMillis = performance.now() - startedAt
    expect(blob.size).toBeGreaterThan(0)
    expect(timeline.frameCount).toBe(6)
    expect(frameTimes).toEqual([0, 100, 200, 300, 400, 500])
    expect(framePixels[0].some((channel, index) => channel !== framePixels[5][index])).toBe(true)
    const magentaPixels = framePixels[5].filter((channel, index, pixels) => index % 4 === 0
        && channel > 150 && pixels[index + 1] < 100 && pixels[index + 2] > 150).length
    expect(magentaPixels).toBeGreaterThan(20)
    expect(viewer.useDefaultRenderLoop).toBe(false)

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const videoBase64 = btoa(Array.from(bytes, value => String.fromCharCode(value)).join(''))
    await server.commands.writeFile('/tmp/lgs-replay-render-loop.mp4', videoBase64, 'base64')
    await server.commands.writeFile('/tmp/lgs-replay-render-loop-first.png', frameSnapshots[0].split(',')[1], 'base64')
    await server.commands.writeFile('/tmp/lgs-replay-render-loop-last.png', frameSnapshots[1].split(',')[1], 'base64')
    // Save the captured pixels before resuming autonomous dense-geometry draws.
    console.info('Replay render-loop visual check', {frames: timeline.frameCount, dimensions: [320, 180], elapsedMillis, magentaPixels})
    loop.release()
    expect(viewer.useDefaultRenderLoop).toBe(true)
}, 60000)
