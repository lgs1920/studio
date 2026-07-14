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
import {
    ReplayDeferredExporter,
    captureReplayDeferredExportContext,
    prepareReplayDeferredExportPlan,
    resolveReplayDeferredExportPlan,
    runReplayDeferredMp4Export,
} from '@Core/ui/replay/ReplayDeferredExporter'

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
            this.buffer = new ArrayBuffer(1024)
            this.onwrite = null
        }
    }

    class FakeCanvasSource {
        constructor(canvas, config) {
            this.canvas = canvas
            this.config = config
            this.add = vi.fn(() => Promise.resolve())
            this.close = vi.fn(() => Promise.resolve())
        }
    }

    class FakeOutput {
        constructor({format, target}) {
            this.format = format
            this.target = target ?? new FakeBufferTarget()
            this.start = vi.fn(() => Promise.resolve())
            this.cancel = vi.fn(() => Promise.resolve())
            this.finalize = vi.fn(() => Promise.resolve())
            this.addVideoTrack = vi.fn()
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

afterEach(() => {
    globalThis.__ = undefined
    globalThis.lgs = undefined
    globalThis.requestAnimationFrame = undefined
    globalThis.cancelAnimationFrame = undefined
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
    })

    it('exports an mp4 with mediabunny using rendered frames', async () => {
        const frames = []
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
    })

    it('runs the deferred mp4 export and downloads the file', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 640
        sourceCanvas.height = 360
        sourceCanvas.getContext = vi.fn(() => ({
            clearRect: vi.fn(),
            drawImage: vi.fn(),
        }))

        const download = vi.fn()
        const seek = vi.fn()
        globalThis.requestAnimationFrame = vi.fn(callback => {
            callback()
            return 1
        })
        globalThis.lgs = {
            canvas: sourceCanvas,
            scene: {
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
        }

        const result = await runReplayDeferredMp4Export({
            replay: {
                journeySlug: 'journey-a',
                trackSlug: 'track-a',
                progress: 0.25,
                durationMillis: 1000,
            },
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
            buildCanvas: () => ({
                width: 640,
                height: 360,
                getContext: () => ({
                    clearRect: vi.fn(),
                    drawImage: vi.fn(),
                }),
            }),
            download,
        })

        expect(result.mimeType).toBe('video/mp4')
        expect(download).toHaveBeenCalledOnce()
        expect(download.mock.calls[0][1]).toMatch(/journey-a-master-export\.mp4$/)
        expect(seek).toHaveBeenCalled()
    })
})
