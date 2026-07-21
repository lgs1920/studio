/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-deferred-exporter.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified: 2026-07-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it, vi } from 'vitest'
import { Output } from 'mediabunny'
import {
    ReplayDeferredExporter,
    captureReplayDeferredExportContext,
    prepareReplayDeferredExportPlan,
    resolveReplayDeferredExportPlan,
    runReplayDeferredMp4Export,
} from '@Core/ui/replay/ReplayDeferredExporter'
import { buildReplayVideoRenderSpec } from '@Core/ui/replay/ReplayVideoRenderSpec'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'

vi.hoisted(() => {
    if (!Object.getOwnPropertyDescriptor(document, 'adoptedStyleSheets')) {
        Object.defineProperty(document, 'adoptedStyleSheets', {
            configurable: true,
            get:          () => [],
            set:          () => {},
        })
    }
})
vi.mock('mediabunny', () => {
    class FakeBufferTarget {
        constructor() {
            this.buffer = null
            this._maxPos = 0
            this.onwrite = null
        }
    }

    class FakeCanvasSource {
        constructor(canvas, config) {
            this.canvas = canvas
            this.config = config
            this.target = null
            this.add = vi.fn(() => {
                if (this.target) {
                    this.target._maxPos += 256
                }
                this.config.onEncodedPacket?.({
                    byteLength: 256,
                    sideData:   {},
                })
                return Promise.resolve()
            })
            this.close = vi.fn(() => Promise.resolve())
        }
    }

    class FakeOutput {
        static instances = []

        constructor({format, target}) {
            this.format = format
            this.target = target ?? new FakeBufferTarget()
            FakeOutput.instances.push(this)
            this.start = vi.fn(() => Promise.resolve())
            this.cancel = vi.fn(() => Promise.resolve())
            this.finalize = vi.fn(() => {
                this.target.buffer = new ArrayBuffer(Math.max(0, this.target._maxPos))
                return Promise.resolve()
            })
            this.addVideoTrack = vi.fn(source => {
                source.target = this.target
            })
            this.setMetadataTags = vi.fn(() => Promise.resolve())
        }
    }

    return {
        BufferTarget: FakeBufferTarget,
        CanvasSource: FakeCanvasSource,
        Mp4OutputFormat: class FakeMp4OutputFormat {
            constructor(options) {
                this.options = options
            }
        },
        Output: FakeOutput,
        QUALITY_HIGH: 1,
        QUALITY_MEDIUM: 1,
        QUALITY_VERY_HIGH: 1,
        canEncodeVideo: vi.fn(() => Promise.resolve(true)),
        getEncodableVideoCodecs: vi.fn(() => Promise.resolve(['vp9'])),
    }
})

vi.mock('@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer', () => {
    const instances = []
    const CanvasOverlayComposerMock = vi.fn(function FakeCanvasOverlayComposer(sourceCanvas, options = {}) {
        const outputDpr = Math.max(1, Number(options.outputDpr) || 1)
        this.sourceCanvas = sourceCanvas
        this.options = options
        this.canvas = {
            width:  Math.round((Number(options.width) || 0) * outputDpr),
            height: Math.round((Number(options.height) || 0) * outputDpr),
        }
        this.beginUpdate = vi.fn()
        this.addOverlay = vi.fn()
        this.endUpdate = vi.fn()
        this.renderFrame = vi.fn(() => Promise.resolve(this.canvas))
        this.getCanvas = vi.fn(() => this.canvas)
        this.dispose = vi.fn()
        instances.push(this)
    })
    CanvasOverlayComposerMock.instances = instances

    return {
        CanvasOverlayComposer: CanvasOverlayComposerMock,
    }
})

afterEach(() => {
    globalThis.__ = undefined
    globalThis.lgs = undefined
    globalThis.requestAnimationFrame = undefined
    globalThis.cancelAnimationFrame = undefined
    CanvasOverlayComposer.mockClear()
    CanvasOverlayComposer.instances.length = 0
})

describe('ReplayDeferredExporter', () => {
    it('exports rendered frames with a manifest', async () => {
        const onFrame = vi.fn(async () => undefined)
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 1000, fps: 10},
            render: async ({frame}) => ({index: frame.index, progress: frame.progress}),
        })

        const payload = await exporter.exportFrames({
            label: 'master-export',
            metadata: {journeySlug: 'test-journey'},
            onFrame,
        })

        expect(payload.manifest.label).toBe('master-export')
        expect(payload.manifest.frameCount).toBe(11)
        expect(payload.manifest.metadata).toEqual({journeySlug: 'test-journey'})
        expect(payload.frames).toHaveLength(11)
        expect(payload.frames[0].renderResult.index).toBe(0)
        expect(payload.frames.at(-1).renderResult.index).toBe(10)
        expect(onFrame).toHaveBeenCalledTimes(11)
    })

    it('allows custom artifact building', async () => {
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 500, fps: 5},
            buildArtifact: payload => ({
                frameCount: payload.frameCount,
                label: payload.manifest.label,
            }),
            render: async ({frame}) => frame.index,
        })

        const payload = await exporter.exportFrames({label: 'custom'})

        expect(payload).toEqual({
            frameCount: 4,
            label: 'custom',
        })
    })

    it('prepares and stores a deferred export plan', () => {
        const replay = {journeySlug: 'replay-journey'}
        const journey = {slug: 'journey-a'}
        const controller = {duration: 12.5, direction: -1}
        const uiToast = {success: vi.fn()}

        const result = prepareReplayDeferredExportPlan({
            replay,
            journey,
            controller,
            fps: 24,
            label: 'deferred-master',
            dimensions: {width: 1920, height: 1080},
            captureMode: 'quality',
            metadata: {quality: 'ultra'},
            mediaMetadata: {artist: 'LGS1920', date: '2026-07-18', album: 'Studio'},
            uiToast,
        })

        expect(result.plan.label).toBe('deferred-master')
        expect(result.plan.manifest.frameCount).toBeGreaterThan(0)
        expect(result.plan.manifest.metadata).toMatchObject({
            journeySlug: 'journey-a',
            captureMode: 'quality',
            dimensions: {width: 1920, height: 1080},
            quality: 'ultra',
        })
        expect(result.plan.dimensions).toEqual({width: 1920, height: 1080})
        expect(result.plan.mediaMetadata).toEqual({artist: 'LGS1920', date: '2026-07-18', album: 'Studio'})
        expect(result.plan.renderSpec).toMatchObject({
            captureMode: 'quality',
            dimensions:  {width: 1920, height: 1080},
        })
        expect(result.plan.captureMode).toBe('quality')
        expect(result.plan.runtime.contextKey).toEqual(expect.any(String))
        expect(result.plan.runtime.context).toMatchObject({
            captureMode: 'quality',
            dimensions: {width: 1920, height: 1080},
        })
        expect(replay.deferredExportPlan).toBe(result.plan)
        expect(uiToast.success).toHaveBeenCalledWith({
            caption: 'Replay export',
            text:    'Master export plan prepared.',
        })
    })

    it('builds the shared draft and HQ video render spec from crop, fps, quality, and dpr', () => {
        const spec = buildReplayVideoRenderSpec({
            cropRect: {left: 10, top: 20, width: 640, height: 360},
            video: {
                fps: 0,
                quality: 0,
                captureMode: 'quality',
            },
            device: {
                dpr: 2,
                browser: 'chromium',
                mobile: false,
            },
            sourceCanvas: {
                width: 1280,
                height: 720,
            },
        })

        expect(spec).toMatchObject({
            fps:         30,
            qualityIndex: 0,
            captureMode: 'quality',
            cropRect:    {left: 10, top: 20, width: 640, height: 360},
            composerClip: {x: 10, y: 20, width: 640, height: 360},
            dimensions:  {width: 1280, height: 720},
            outputDpr:   2,
        })
    })

    it('supports the 15 fps medium-quality preset in the video render spec', () => {
        const spec = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 640, height: 360},
            video: {
                fps: 3,
                quality: 0,
                captureMode: 'speed',
            },
            device: {
                dpr: 1,
                browser: 'chromium',
                mobile: false,
            },
            sourceCanvas: {
                width: 640,
                height: 360,
            },
        })

        expect(spec).toMatchObject({
            fps:         15,
            fpsIndex:    3,
            qualityIndex: 0,
            pixelBudget:  3_240_000,
            dimensions:  {width: 640, height: 360},
        })
    })

    it('captures a lightweight export context and reuses only matching plans', () => {
        const replay = {
            videoCropRect: {left: 10, top: 20, width: 640, height: 360},
            recordingSync: true,
        }
        const controller = {
            direction: 1,
            progress: 0.25,
        }
        const widgetEl = document.createElement('div')
        widgetEl.dataset.videoOverlayVisible = 'true'

        globalThis.__ = {
            ui: {
                widgetCache: {
                    isMounted: vi.fn(() => true),
                    getAll: vi.fn(() => new Map([
                        ['journey-overlay#1', {mounted: true}],
                    ])),
                },
                widgetManager: {
                    getElementById: vi.fn(() => widgetEl),
                },
            },
        }

        const context = captureReplayDeferredExportContext({
            replay,
            controller,
            dimensions: {width: 1280, height: 720},
            captureMode: 'quality',
            fps: 30,
        })

        expect(context.context).toMatchObject({
            captureMode: 'quality',
            dimensions: {width: 1280, height: 720},
            cropRect: {left: 10, top: 20, width: 640, height: 360},
            recordingSync: true,
            visibleOverlayIds: ['journey-overlay#1'],
        })

        const freshPlan = prepareReplayDeferredExportPlan({
            replay,
            journey: {slug: 'journey-a'},
            controller,
            fps: 30,
            label: 'plan-a',
            dimensions: {width: 1280, height: 720},
            captureMode: 'quality',
            uiToast: {success: vi.fn()},
        })

        expect(freshPlan.plan.runtime.contextKey).toBe(context.contextKey)

        const reusedPlan = resolveReplayDeferredExportPlan({
            replay,
            journey: {slug: 'journey-a'},
            controller,
            fps: 30,
            label: 'plan-a',
            dimensions: {width: 1280, height: 720},
            captureMode: 'quality',
            uiToast: {success: vi.fn()},
        })

        expect(reusedPlan.reused).toBe(true)
        expect(reusedPlan.plan).toBe(freshPlan.plan)

        replay.videoCropRect = {left: 10, top: 20, width: 800, height: 360}
        const stalePlan = resolveReplayDeferredExportPlan({
            replay,
            journey: {slug: 'journey-a'},
            controller,
            fps: 30,
            label: 'plan-a',
            dimensions: {width: 1280, height: 720},
            captureMode: 'quality',
            uiToast: {success: vi.fn()},
        })

        expect(stalePlan.reused).toBe(false)
        expect(stalePlan.plan.runtime.contextKey).not.toBe(context.contextKey)
        expect(stalePlan.plan.renderSpec.cropRect).toEqual({left: 10, top: 20, width: 800, height: 360})
    })

    it('exports an mp4 with mediabunny using rendered frames', async () => {
        Output.instances.length = 0
        const frames = []
        const mediaMetadata = {artist: 'LGS1920', date: '2026-07-18', album: 'Studio'}
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 1000, fps: 10},
            controller: {
                sampler: {atProgress: progress => ({progress})},
                seek: vi.fn(),
                currentSample: () => null,
            },
        })

        const result = await exporter.exportMp4({
            dimensions: {width: 640, height: 360},
            metadata: mediaMetadata,
            buildCanvas: () => ({
                width: 0,
                height: 0,
                getContext: () => ({}),
            }),
            renderFrame: async ({frame}) => {
                frames.push(frame.index)
                return null
            },
            onFrame: async rendered => {
                frames.push(`on:${rendered.index}`)
            },
        })

        expect(result.mimeType).toBe('video/mp4')
        expect(result.extension).toBe('mp4')
        expect(result.blob).toBeInstanceOf(Blob)
        expect(result.frames).toHaveLength(11)
        expect(frames[0]).toBe(0)
        expect(frames).toContain('on:0')
        expect(Output.instances.at(-1).setMetadataTags).toHaveBeenCalledWith(mediaMetadata)
    })

    it('runs the deferred mp4 export and downloads the file', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 640
        sourceCanvas.height = 360
        sourceCanvas.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top:  0,
            width: 640,
            height: 360,
        }))

        const widgetCanvas = document.createElement('canvas')
        widgetCanvas.className = 'lgs-widget-canvas'
        widgetCanvas.width = 200
        widgetCanvas.height = 100
        widgetCanvas.getBoundingClientRect = vi.fn(() => ({
            left: 40,
            top:  50,
            width: 200,
            height: 100,
        }))

        const widgetEl = document.createElement('div')
        widgetEl.appendChild(widgetCanvas)

        const download = vi.fn()
        const seek = vi.fn()
        const exportContext = {
            clearRect: vi.fn(),
            drawImage: vi.fn(),
            save:      vi.fn(),
            restore:   vi.fn(),
            translate:  vi.fn(),
            rotate:    vi.fn(),
        }
        globalThis.requestAnimationFrame = vi.fn(callback => {
            callback()
            return 1
        })
        globalThis.lgs = {
            canvas: sourceCanvas,
            scene: {
                render: vi.fn(),
                requestRender: vi.fn(),
            },
            stores: {
                ui: {
                    video: {
                        fps: 0,
                        quality: 0,
                    },
                },
            },
            theJourney: {
                slug: 'journey-a',
            },
        }
        globalThis.__ = {
            device: {
                browser: 'chromium',
            },
            ui: {
                replay: {
                    refresh: vi.fn(),
                },
                widgetCache: {
                    getAll: vi.fn(() => new Map([
                        ['journey-overlay#1', {mounted: true}],
                    ])),
                },
                widgetManager: {
                    getElementById: vi.fn(() => widgetEl),
                    getWidgetConfig: vi.fn(() => ({
                        position: {left: 40, top: 50},
                        rotate: 45,
                        zIndex: 10,
                    })),
                },
            },
        }
        const replay = {
            journeySlug: 'journey-a',
            trackSlug: 'track-a',
            progress: 0.25,
            durationMillis: 1000,
            videoCropRect: {left: 0, top: 0, width: 640, height: 360},
        }
        prepareReplayDeferredExportPlan({
            replay,
            journey: {slug: 'journey-a'},
            controller: {
                duration: 1,
                direction: 1,
                progress: 0.25,
                seek,
            },
            label: 'journey-a-master-export',
            dimensions: {width: 1280, height: 720},
            captureMode: 'quality',
            sourceCanvas,
            uiToast: {success: vi.fn()},
        })
        const buildCanvas = vi.fn(dimensions => ({
            width: dimensions.width,
            height: dimensions.height,
            getContext: () => exportContext,
        }))

        const result = await runReplayDeferredMp4Export({
            replay,
            journey: {
                slug: 'journey-a',
            },
            controller: {
                duration: 1,
                direction: 1,
                progress: 0.25,
                seek,
            },
            sourceCanvas,
            buildCanvas,
            download,
        })

        expect(result.mimeType).toBe('video/mp4')
        expect(buildCanvas).toHaveBeenCalledWith({width: 1280, height: 720})
        expect(result.plan.dimensions).toEqual({width: 1280, height: 720})
        expect(result.plan.renderSpec).toMatchObject({
            cropRect:  {left: 0, top: 0, width: 640, height: 360},
            dimensions: {width: 1280, height: 720},
            outputDpr: 2,
        })
        expect(CanvasOverlayComposer).toHaveBeenCalledWith(sourceCanvas, expect.objectContaining({
            clip:      {x: 0, y: 0, width: 640, height: 360},
            width:     640,
            height:    360,
            fps:       0,
            outputDpr: 2,
        }))
        expect(result.plan.captureMode).toBe('quality')
        expect(download).toHaveBeenCalledOnce()
        expect(download.mock.calls[0][1]).toMatch(/journey-a-master-export\.mp4$/)
        expect(seek).toHaveBeenCalled()
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledTimes(1)
        expect(globalThis.__.ui.replay.refresh).toHaveBeenCalled()
        expect(result.plan.runtime.exportProgress).toBe(1)
        expect(result.plan.runtime.exportProcessedFrames).toBe(result.plan.manifest.frameCount)
        expect(result.plan.runtime.exportEstimatedRemainingMillis).toBe(0)
        expect(result.plan.runtime.exportFileSize).toBe(result.blob.size)
        expect(result.plan.runtime.exportFileSize).toBeGreaterThan(0)
    })

    it('keeps the HQ composer canvas at the exact MP4 dimensions when crop and output ratios differ', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 1280
        sourceCanvas.height = 800
        sourceCanvas.getBoundingClientRect = vi.fn(() => ({
            left:   0,
            top:    0,
            width:  640,
            height: 400,
        }))

        const exportContext = {
            clearRect: vi.fn(),
            drawImage: vi.fn(),
        }
        const replay = {
            journeySlug: 'journey-a',
            trackSlug: 'track-a',
            progress: 0,
            durationMillis: 1000,
            videoCropRect: {left: 0, top: 0, width: 640, height: 400},
        }

        globalThis.requestAnimationFrame = vi.fn(callback => {
            callback()
            return 1
        })
        globalThis.lgs = {
            canvas: sourceCanvas,
            scene: {
                render: vi.fn(),
                requestRender: vi.fn(),
            },
            stores: {
                ui: {
                    video: {
                        fps: 0,
                        quality: 0,
                    },
                },
            },
        }
        globalThis.__ = {
            device: {
                browser: 'chromium',
            },
            ui: {
                replay: {
                    refresh: vi.fn(),
                },
                widgetCache: {
                    getAll: vi.fn(() => new Map()),
                },
                widgetManager: {
                    getElementById: vi.fn(() => null),
                    getWidgetConfig: vi.fn(() => ({})),
                },
            },
        }

        prepareReplayDeferredExportPlan({
            replay,
            journey: {slug: 'journey-a'},
            controller: {
                duration: 1,
                direction: 1,
                progress: 0,
                seek: vi.fn(),
            },
            label: 'journey-a-master-export',
            dimensions: {width: 1280, height: 720},
            captureMode: 'quality',
            sourceCanvas,
            uiToast: {success: vi.fn()},
        })

        await runReplayDeferredMp4Export({
            replay,
            journey: {slug: 'journey-a'},
            controller: {
                duration: 1,
                direction: 1,
                progress: 0,
                seek: vi.fn(),
            },
            sourceCanvas,
            buildCanvas: dimensions => ({
                width: dimensions.width,
                height: dimensions.height,
                getContext: () => exportContext,
            }),
            download: vi.fn(),
        })

        const composerOptions = CanvasOverlayComposer.mock.calls[0][1]
        expect(composerOptions.outputDpr).toBeCloseTo(1.8, 5)
        expect(composerOptions.width).toBeCloseTo(1280 / 1.8, 5)
        expect(composerOptions.height).toBe(400)
        expect(CanvasOverlayComposer.instances[0].canvas).toMatchObject({
            width:  1280,
            height: 720,
        })
        expect(exportContext.drawImage).toHaveBeenCalledWith(
            expect.objectContaining({width: 1280, height: 720}),
            0,
            0,
            1280,
            720,
            0,
            0,
            1280,
            720,
        )
    })

    it('routes HQ export frames through start, replay, and stop clip phases', async () => {
        let now = 0
        const performanceNow = vi.spyOn(globalThis.performance, 'now').mockImplementation(() => now)
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        sourceCanvas.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top:  0,
            width: 320,
            height: 180,
        }))

        const exportContext = {
            clearRect: vi.fn(),
            drawImage: vi.fn(),
        }
        const seek = vi.fn(progress => ({progress}))
        const renderReplayExportFrame = vi.fn(({phase}) => {
            now += 40
            return {progress: phase.progress}
        })
        const preparePlaybackSceneForExport = vi.fn(() => true)
        const restorePlaybackScene = vi.fn()

        try {
            globalThis.requestAnimationFrame = vi.fn(callback => {
                callback()
                return 1
            })
            globalThis.lgs = {
                canvas: sourceCanvas,
                scene: {
                    render: vi.fn(),
                    requestRender: vi.fn(),
                },
                stores: {
                    ui: {
                        video: {
                            fps: 0,
                            quality: 0,
                        },
                    },
                },
                theJourney: {
                    slug: 'journey-a',
                },
            }
            globalThis.__ = {
                device: {
                    browser: 'chromium',
                },
                ui: {
                    replay: {
                        renderReplayExportFrame,
                        preparePlaybackSceneForExport,
                        restorePlaybackScene,
                    },
                    widgetCache: {
                        getAll: vi.fn(() => new Map()),
                    },
                    widgetManager: {
                        getElementById: vi.fn(() => null),
                        getWidgetConfig: vi.fn(() => ({})),
                    },
                },
            }

            const result = await runReplayDeferredMp4Export({
                replay: {
                    journeySlug: 'journey-a',
                    trackSlug: 'track-a',
                    progress: 0,
                    durationMillis: 1000,
                    clips: {
                        catalog: {
                            'zoom-in': {
                                slots: ['start'],
                            },
                            landing: {
                                slots: ['stop'],
                            },
                        },
                        start: [{clipId: 'zoom-in', params: {duration: 1}}],
                        stop:  [{clipId: 'landing', params: {duration: 1}}],
                    },
                },
                journey: {
                    slug: 'journey-a',
                },
                controller: {
                    duration: 1,
                    direction: 1,
                    progress: 0,
                    sampler: {
                        atProgress: progress => ({progress}),
                    },
                    currentSample: () => ({progress: 0}),
                    seek,
                },
                fps: 10,
                sourceCanvas,
                buildCanvas: () => ({
                    width: 320,
                    height: 180,
                    getContext: () => exportContext,
                }),
                download: vi.fn(),
            })

            const phases = renderReplayExportFrame.mock.calls.map(([args]) => args.phase.kind)
            expect(result.plan.manifest.durationMillis).toBe(3000)
            expect(phases).toContain('start')
            expect(phases).toContain('replay')
            expect(phases).toContain('stop')
            expect(renderReplayExportFrame.mock.calls.at(-1)?.[0]?.phase).toMatchObject({
                kind: 'stop',
                localProgress: 1,
                isFinalSceneFrame: true,
            })
            expect(renderReplayExportFrame.mock.calls.some(([args]) => args.phase.isLastTwoReplayFrames === true)).toBe(true)
            expect(CanvasOverlayComposer.instances.some(instance => instance.addOverlay.mock.calls.length > 0)).toBe(false)
            expect(preparePlaybackSceneForExport).toHaveBeenCalledWith(expect.objectContaining({
                journey: expect.objectContaining({slug: 'journey-a'}),
                progress: 0,
                hideReplayMarker: true,
            }))
            expect(restorePlaybackScene).toHaveBeenCalledWith({force: true})
            expect(result.plan.runtime.exportElapsedMillis).toBe(result.plan.manifest.frameCount * 40)
            expect(result.plan.runtime.exportAverageFrameMillis).toBeCloseTo(40, 1)
            expect(result.plan.runtime.exportEstimatedTotalMillis).toBeCloseTo(result.plan.runtime.exportElapsedMillis, 1)
        }
        finally {
            performanceNow.mockRestore()
        }
    })
})
