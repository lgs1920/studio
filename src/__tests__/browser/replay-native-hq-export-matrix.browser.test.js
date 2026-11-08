/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-native-hq-export-matrix.browser.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, expect, test, vi} from 'vitest'
import {Cartesian3, CesiumWidget, Color, EllipsoidTerrainProvider, SceneMode} from 'cesium'
import {ALL_FORMATS, BlobSource, Input} from 'mediabunny'
import 'cesium/Build/Cesium/Widgets/widgets.css'

import {CanvasOverlayComposer} from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {IsolatedReplayRenderHost} from '@Core/ui/replay/IsolatedReplayRenderHost'
import {ReplayDeferredExporter} from '@Core/ui/replay/ReplayDeferredExporter'
import {
    buildReplayVideoRenderSpec,
    REPLAY_VIDEO_READINESS_POLICIES,
    REPLAY_VIDEO_RENDER_HOST_MODES,
    REPLAY_VIDEO_RENDER_QUALITIES,
    REPLAY_VIDEO_RESOLUTION_PROFILES,
} from '@Core/ui/replay/ReplayVideoRenderSpec'
import {REPLAY_VIDEO_FPS} from '@Core/ui/replay/ReplayVideoSettings'

const matrixEnabled = import.meta.env.VITE_REPLAY_NATIVE_HQ_MATRIX === 'true'
const previousLgs = globalThis.lgs

const matrix = [
    {
        name: 'Standard automatic landscape', mode: REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD, crop: {width: 704, height: 396}, dpr: 3,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC, fps: 30, qualityIndex: 0,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD, readiness: REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE,
        expected: {width: 1920, height: 1080},
    },
    {
        name: 'Native HQ 720p landscape', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 1280, height: 720}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.HD_720, fps: 30, qualityIndex: 0,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD, readiness: REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE,
        expected: {width: 1280, height: 720},
    },
    {
        name: 'Native HQ 1080p landscape', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 1920, height: 1080}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD, fps: 30, qualityIndex: 1,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD, readiness: REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE,
        expected: {width: 1920, height: 1080},
    },
    {
        name: 'Native HQ QHD landscape', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 2560, height: 1440}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.QHD_1440, fps: 45, qualityIndex: 1,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.HIGH, readiness: REPLAY_VIDEO_READINESS_POLICIES.STRICT, expected: {width: 2560, height: 1440},
    },
    {
        name: 'Native HQ 4K landscape at 30 FPS', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 3840, height: 2160}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K, fps: 30, qualityIndex: 2,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.HIGH, readiness: REPLAY_VIDEO_READINESS_POLICIES.STRICT,
        expected: {width: 3840, height: 2160},
    },
    {
        name: 'Native HQ 4K landscape at 60 FPS', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 3840, height: 2160}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K, fps: 60, qualityIndex: 2,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM, readiness: REPLAY_VIDEO_READINESS_POLICIES.STRICT,
        expected: {width: 3840, height: 2160},
    },
    {
        name: 'Native HQ 1080p portrait', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 1080, height: 1920}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD, fps: 30, qualityIndex: 0,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD, readiness: REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE,
        expected: {width: 1080, height: 1920},
    },
    {
        name: 'Native HQ QHD portrait at 60 FPS', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 1440, height: 2560}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.QHD_1440, fps: 60, qualityIndex: 1,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.HIGH, readiness: REPLAY_VIDEO_READINESS_POLICIES.STRICT, expected: {width: 1440, height: 2560},
    },
    {
        name: 'Native HQ 4K portrait', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 2160, height: 3840}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K, fps: 30, qualityIndex: 2,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM, readiness: REPLAY_VIDEO_READINESS_POLICIES.STRICT,
        expected: {width: 2160, height: 3840},
    },
    {
        name: 'Native HQ 4K portrait with rounded CSS crop bounds', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ,
        crop: {width: 674, height: 1199}, ratio: '9x16', dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K, fps: 30, qualityIndex: 2,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM, readiness: REPLAY_VIDEO_READINESS_POLICIES.STRICT,
        expected: {width: 2160, height: 3840},
    },
    {
        name: 'Native HQ custom ultra-wide', mode: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, crop: {width: 3840, height: 1200}, dpr: 1,
        profile: REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM, customDimensions: {width: 3840, height: 1200}, fps: 30, qualityIndex: 1,
        lod: REPLAY_VIDEO_RENDER_QUALITIES.HIGH, readiness: REPLAY_VIDEO_READINESS_POLICIES.STRICT, expected: {width: 3840, height: 1200},
    },
]

/** Create a Cesium descriptor containing only browser-local terrain and the globe. */
const createLocalSceneDescriptor = () => ({
    sceneMode: SceneMode.SCENE3D,
    mapProjection: null,
    terrainProvider: new EllipsoidTerrainProvider(),
    imageryLayers: [],
    base3dDefinition: null,
    compatibilityLimitations: [],
    environment: {
        shadows: false,
        backgroundColor: Color.BLACK,
        globe: {show: true, baseColor: Color.ROYALBLUE},
        fog: {enabled: false},
        skyAtmosphere: {show: false},
    },
})

/** Create a logical crop canvas for the render-spec resolver. */
const createCropCanvas = ({width, height}) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    return canvas
}

/** Build the selected settings object and resolve its physical export dimensions. */
const resolveMatrixRenderSpec = entry => {
    const video = {
        fps: REPLAY_VIDEO_FPS.indexOf(entry.fps),
        quality: entry.qualityIndex,
        ratio: entry.ratio,
        renderHostMode: entry.mode,
        resolutionProfile: entry.profile,
        customDimensions: entry.customDimensions,
        renderQuality: entry.lod,
        readinessPolicy: entry.readiness,
    }
    return buildReplayVideoRenderSpec({
        cropRect: {left: 0, top: 0, ...entry.crop},
        sourceCanvas: createCropCanvas(entry.crop),
        video,
        settings: {},
        device: {dpr: entry.dpr, browser: 'chromium', mobile: false},
    })
}

/** Assert encoded MP4 track geometry, packet rate, and full sample duration. */
const verifyMp4Metadata = async ({blob, dimensions, fps, expectedFrameCount}) => {
    const input = new Input({source: new BlobSource(blob), formats: ALL_FORMATS})
    try {
        const track = await input.getPrimaryVideoTrack()
        expect(track).not.toBeNull()
        expect(await track.getDisplayWidth()).toBe(dimensions.width)
        expect(await track.getDisplayHeight()).toBe(dimensions.height)
        expect(await track.getCodedWidth()).toBe(dimensions.width)
        expect(await track.getCodedHeight()).toBe(dimensions.height)

        const packetStats = await track.computePacketStats()
        expect(packetStats.packetCount).toBe(expectedFrameCount)
        expect(packetStats.averagePacketRate).toBeCloseTo(fps, 0)
        expect(await input.computeDuration([track])).toBeCloseTo(expectedFrameCount / fps, 2)
    }
    finally {
        input.dispose()
    }
}

afterEach(() => {
    globalThis.lgs = previousLgs
})

test.skipIf(!matrixEnabled)('renders, composites and encodes the nine Native HQ settings combinations', async ({skip}) => {
    vi.stubGlobal('CESIUM_BASE_URL', new URL('/node_modules/cesium/Build/Cesium/', location.href).href)
    if (typeof VideoEncoder === 'undefined') {
        skip('This browser has no WebCodecs video encoder')
    }
    if (!/Chrome\//i.test(navigator.userAgent) || /Edg\//i.test(navigator.userAgent)) {
        skip('The high-resolution matrix currently targets Chromium')
    }

    for (const entry of matrix) {
        const caseStartedAt = performance.now()
        const spec = resolveMatrixRenderSpec(entry)
        expect(spec.dimensions).toEqual(entry.expected)
        expect(spec.fps).toBe(entry.fps)
        expect(spec.qualityIndex).toBe(entry.qualityIndex)
        expect(spec.renderQuality).toBe(entry.lod)
        expect(spec.readinessPolicy).toBe(entry.readiness)

        const sourceContainer = document.createElement('div')
        sourceContainer.style.cssText = `position:fixed;left:-100000px;top:0;width:${entry.crop.width}px;height:${entry.crop.height}px`
        document.body.append(sourceContainer)
        let visibleWidget = null
        let isolatedHost = null
        let nativeViewer = null
        let renderHostContainer = null
        let composer = null
        try {
            let sourceCanvas
            let actualCesiumDimensions
            if (entry.mode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ) {
                const viewportDpr = Math.max(1, Math.min(
                    spec.dimensions.width / entry.crop.width,
                    spec.dimensions.height / entry.crop.height,
                ))
                isolatedHost = new IsolatedReplayRenderHost({
                    dimensions: spec.dimensions,
                    viewportDimensions: {
                        width: spec.dimensions.width / viewportDpr,
                        height: spec.dimensions.height / viewportDpr,
                    },
                    descriptor: createLocalSceneDescriptor(),
                    maximumScreenSpaceError: spec.maximumScreenSpaceError,
                    readiness: {enabled: true, policy: spec.readinessPolicy},
                })
                await isolatedHost.initialize()
                sourceCanvas = isolatedHost.canvas()
                nativeViewer = isolatedHost.viewer()
                renderHostContainer = document.querySelector('[data-replay-render-host="isolated"]')
                nativeViewer.scene.globe.baseColor = Color.ROYALBLUE
                nativeViewer.camera.setView({destination: Cartesian3.fromDegrees(2, 46, 9000000)})
                actualCesiumDimensions = {
                    width: isolatedHost.scene().drawingBufferWidth,
                    height: isolatedHost.scene().drawingBufferHeight,
                }
            }
            else {
                visibleWidget = new CesiumWidget(sourceContainer, {
                    baseLayer: false,
                    terrainProvider: new EllipsoidTerrainProvider(),
                    useDefaultRenderLoop: false,
                    useBrowserRecommendedResolution: false,
                    requestRenderMode: true,
                    contextOptions: {webgl: {failIfMajorPerformanceCaveat: false}},
                })
                visibleWidget.resolutionScale = spec.dimensions.width / entry.crop.width
                visibleWidget.resize()
                visibleWidget.scene.globe.baseColor = Color.ROYALBLUE
                visibleWidget.camera.setView({destination: Cartesian3.fromDegrees(2, 46, 9000000)})
                visibleWidget.render()
                sourceCanvas = visibleWidget.canvas
                actualCesiumDimensions = {
                    width: visibleWidget.scene.drawingBufferWidth,
                    height: visibleWidget.scene.drawingBufferHeight,
                }
            }
            expect(actualCesiumDimensions).toEqual(entry.expected)

            const visibleCrop = spec.cropRect
            const logicalOutputWidth = entry.mode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ
                ? spec.dimensions.width
                : spec.dimensions.width / spec.outputDpr
            const logicalOutputHeight = entry.mode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ
                ? spec.dimensions.height
                : spec.dimensions.height / spec.outputDpr
            const outputCanvas = document.createElement('canvas')
            const marker = document.createElement('canvas')
            marker.width = 24
            marker.height = 24
            marker.getContext('2d').fillStyle = '#ff00ff'
            marker.getContext('2d').fillRect(0, 0, marker.width, marker.height)

            const timelineDuration = 1000 / entry.fps
            const exporter = new ReplayDeferredExporter({
                timeline: {durationMillis: timelineDuration, fps: entry.fps},
                controller: {sampler: {atProgress: progress => ({progress}), totalDistance: 0}, currentSample: () => null},
            })
            globalThis.lgs = {stores: {ui: {video: {
                quality: entry.qualityIndex,
                fps: REPLAY_VIDEO_FPS.indexOf(entry.fps),
            }}}}
            const encoder = await exporter.prepareRuntime({dimensions: spec.dimensions, browser: 'chromium'})
            expect(encoder.qualityLevel).toBe(['medium', 'high', 'very-high'][entry.qualityIndex])

            const result = await exporter.exportMp4({
                dimensions: spec.dimensions,
                browser: 'chromium',
                buildCanvas: () => outputCanvas,
                renderFrame: async ({frame, canvas}) => {
                    if (isolatedHost) {
                        expect(await isolatedHost.prepareForCapture({maxMillis: 2500})).toBe(true)
                    }
                    else {
                        visibleWidget.render()
                    }
                    if (!composer) {
                        composer = new CanvasOverlayComposer(sourceCanvas, {
                            clip: entry.mode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ
                                ? {x: 0, y: 0, width: sourceCanvas.width, height: sourceCanvas.height}
                                : visibleCrop,
                            width: logicalOutputWidth,
                            height: logicalOutputHeight,
                            outputDpr: spec.outputDpr,
                            fps: entry.fps,
                            continuousRendering: false,
                            outputCanvas: canvas,
                        })
                    }
                    composer.beginUpdate()
                    marker.getContext('2d').fillStyle = frame.index % 2 ? '#00ffff' : '#ff00ff'
                    marker.getContext('2d').fillRect(0, 0, marker.width, marker.height)
                    composer.addOverlay(marker, {x: 24, y: 24, w: 24, h: 24})
                    expect(await composer.renderFrame()).toBe(canvas)
                    expect(canvas).toMatchObject(entry.expected)
                },
            })

            expect(result.blob.size).toBeGreaterThan(0)
            expect(result.mimeType).toBe('video/mp4')
            expect(result.frames).toHaveLength(2)
            expect(outputCanvas).toMatchObject(entry.expected)
            const markerPixel = outputCanvas.getContext('2d').getImageData(
                Math.round(30 * spec.outputDpr),
                Math.round(30 * spec.outputDpr),
                1,
                1,
            ).data
            expect(markerPixel[0]).toBeLessThan(20)
            expect(markerPixel[1]).toBeGreaterThan(200)
            expect(markerPixel[2]).toBeGreaterThan(200)
            await verifyMp4Metadata({
                blob: result.blob,
                dimensions: entry.expected,
                fps: entry.fps,
                expectedFrameCount: 2,
            })
            const gl = sourceCanvas.getContext('webgl2') ?? sourceCanvas.getContext('webgl')
            const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info')
            console.info('[Replay Native HQ matrix]', JSON.stringify({
                case: entry.name,
                browser: /firefox/i.test(navigator.userAgent) ? 'firefox' : /edg/i.test(navigator.userAgent) ? 'edge' : 'chromium',
                selected: {
                    resolutionProfile: spec.resolutionProfile,
                    output: spec.dimensions,
                    fps: spec.fps,
                    encodingQuality: encoder.qualityLevel,
                    cesiumDetail: spec.renderQuality,
                    maximumScreenSpaceError: spec.maximumScreenSpaceError,
                    readinessPolicy: spec.readinessPolicy,
                },
                observed: {
                    cesiumDrawingBuffer: actualCesiumDimensions,
                    compositionCanvas: {width: outputCanvas.width, height: outputCanvas.height},
                    webglMaximumRenderbufferSize: gl?.getParameter(gl.MAX_RENDERBUFFER_SIZE) ?? null,
                    webglMaximumTextureSize: gl?.getParameter(gl.MAX_TEXTURE_SIZE) ?? null,
                    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
                    encodedFrameCount: result.frames.length,
                    mp4Bytes: result.blob.size,
                    elapsedMillis: Math.round(performance.now() - caseStartedAt),
                },
            }))
        }
        finally {
            composer?.dispose()
            isolatedHost?.destroy()
            if (visibleWidget && !visibleWidget.isDestroyed()) {
                visibleWidget.destroy()
            }
            if (nativeViewer) {
                expect(nativeViewer.isDestroyed()).toBe(true)
                expect(renderHostContainer?.isConnected).toBe(false)
            }
            if (visibleWidget) {
                expect(visibleWidget.isDestroyed()).toBe(true)
            }
            sourceContainer.remove()
        }
    }
}, 600000)

test('fails a pending Native HQ capture on real WebGL context loss and releases host resources', async ({skip}) => {
    vi.stubGlobal('CESIUM_BASE_URL', new URL('/node_modules/cesium/Build/Cesium/', location.href).href)
    const pendingReadiness = new Promise(() => {})
    const readiness = {
        prepareForCapture: () => pendingReadiness,
        dispose: vi.fn(),
    }
    const host = new IsolatedReplayRenderHost({
        dimensions: {width: 320, height: 180},
        viewportDimensions: {width: 320, height: 180},
        descriptor: createLocalSceneDescriptor(),
        readiness: {enabled: true, policy: REPLAY_VIDEO_READINESS_POLICIES.STRICT},
        createReadinessCoordinator: () => readiness,
    })

    try {
        await host.initialize()
        const canvas = host.canvas()
        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
        const loseContext = gl?.getExtension('WEBGL_lose_context')
        if (!loseContext) {
            skip('The browser does not expose WEBGL_lose_context')
        }
        const ownedContainer = canvas.parentElement
        const pendingCapture = host.prepareForCapture({maxMillis: 10000})
        loseContext.loseContext()
        await expect(pendingCapture).rejects.toThrow('WebGL context was lost during export')

        host.destroy()
        expect(readiness.dispose).toHaveBeenCalledOnce()
        expect(host.canvas()).toBeNull()
        expect(ownedContainer.isConnected).toBe(false)
    }
    finally {
        host.destroy()
    }
}, 30000)
