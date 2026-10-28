/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-deferred-exporter.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { Output } from 'mediabunny'
import {PerspectiveFrustum} from 'cesium'
import {
    ReplayDeferredExporter,
    captureReplayDeferredExportContext,
    prepareReplayDeferredExportPlan,
    resolveReplayDeferredExportPlan,
    waitForReplayWidgetsReady,
    prepareReplayTimelineWidgets,
    runReplayDeferredMp4Export,
    exportReplayDeferredDryRun,
    isReplayExportFrameSettled,
} from '@Core/ui/replay/ReplayDeferredExporter'
import { buildReplayVideoRenderSpec } from '@Core/ui/replay/ReplayVideoRenderSpec'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import {WidgetDynamicRenderer} from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {REPLAY_USER_MODE_EXPERT} from '@Core/ui/replay/ReplayUserModeConstants'
import {buildReplayVideoTimeline, resolveReplayVideoFramePhase} from '@Core/ui/replay/ReplayVideoTimeline'
import {createReplayPOISpeedProfile, replayRouteTimeAtPlaybackTime} from '@Core/ui/replay/ReplayPOISpeedProfile'
import {createReplayRecordingPerformance} from '@Core/ui/replay/ReplayRecordingPerformance'
import * as replayOverlayComposer from '@Core/ui/replay/ReplayVideoOverlayComposer'
import * as replayTileReadiness from '@Core/ui/replay/ReplaySceneTileReadiness'
import * as replayWidgetFrames from '@Core/ui/replay/ReplayWidgetFrameRenderers'
import {
    getReplayRecordingMonitorSnapshot,
    subscribeReplayRecordingMonitor,
} from '@Core/ui/replay/ReplayRecordingMonitor'

const mediabunnyMocks = vi.hoisted(() => ({
    failNextCanvasAdd: false,
    canvasAddCount:     0,
    codecProbeCount:    0,
}))

describe('isReplayExportFrameSettled', () => {
    it('keeps moving clip frames on the bounded moving budget', () => {
        expect(isReplayExportFrameSettled({
            frame: {isFirst: false, isLast: false},
            phase: {kind: 'pre-replay', localProgress: 0.5, clip: {clipId: 'zoom-in', params: {}}},
        })).toBe(false)
        expect(isReplayExportFrameSettled({
            frame: {isFirst: false, isLast: false},
            phase: {kind: 'pre-replay', localProgress: 0, clip: {clipId: 'zoom-in', params: {}}},
        })).toBe(true)
        expect(isReplayExportFrameSettled({
            phase: {kind: 'hold', localProgress: 0.5},
        })).toBe(true)
    })
})

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))

if (typeof globalThis.document === 'undefined') {
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.DOMParser = dom.window.DOMParser
    globalThis.HTMLElement = dom.window.HTMLElement
    globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement
    globalThis.CustomEvent = dom.window.CustomEvent
    globalThis.Node = dom.window.Node
}

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
                mediabunnyMocks.canvasAddCount += 1
                if (mediabunnyMocks.failNextCanvasAdd) {
                    mediabunnyMocks.failNextCanvasAdd = false
                    return Promise.reject(new Error('Codec reclaimed due to inactivity.'))
                }
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
        canEncodeVideo: vi.fn(() => {
            mediabunnyMocks.codecProbeCount += 1
            return Promise.resolve(true)
        }),
        getEncodableVideoCodecs: vi.fn(() => {
            mediabunnyMocks.codecProbeCount += 1
            return Promise.resolve(['vp9'])
        }),
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
        this.renderFrame = vi.fn(() => {
            this.options.flushWebGLBuffer?.()
            return Promise.resolve(this.canvas)
        })
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
    delete globalThis.__lgsReplayVideoTrace
    CanvasOverlayComposer.mockClear()
    CanvasOverlayComposer.instances.length = 0
    mediabunnyMocks.failNextCanvasAdd = false
    mediabunnyMocks.canvasAddCount = 0
    mediabunnyMocks.codecProbeCount = 0
})

describe('ReplayDeferredExporter', () => {
    it('registers every timeline instance through its actual catalogue group before capture', async () => {
        const list = new Map()
        const cache = new Map()
        const textComponent = () => null
        const statsComponent = () => null
        const renderer = WidgetDynamicRenderer.instance
        const previousRegistry = renderer.registry
        renderer.registry = {
            getLazyComponent: identifier => identifier === 'TextWidget' ? textComponent : statsComponent,
        }
        globalThis.lgs = {stores: {ui: {widget: {list}}}}
        globalThis.__ = {
            widgets: new Map([
                ['multi-purpose-widgets', {widgets: new Map()}],
                ['journey-widgets', {widgets: new Map([
                    ['text-widget', {component: 'TextWidget', max: 50}],
                    ['journey-stats-widget', {component: 'JourneyStatsWidget', max: 50}],
                ])}],
            ]),
            ui: {
                widgetCache: {
                    get: id => cache.get(id),
                    set: (id, entry) => cache.set(id, entry),
                    getAll: () => cache,
                },
                widgetManager: {
                    maxWidgets: () => 50,
                    isMaxWidgetsReached: () => false,
                },
            },
        }
        try {
            const keys = await prepareReplayTimelineWidgets({
                basicReplay: false,
                replay: {preparationTimeline: {
                    widgetManifest: ['text-widget#title'],
                    tracks: [
                        {id: 'text-widget#title', clips: [{start: 0, end: 10}]},
                        {id: 'text-widget#later', clips: [{start: 5, end: 10}]},
                        {id: 'journey-stats-widget#stats', clips: [{start: 0, end: 10}]},
                    ],
                }},
            })

            expect(keys).toEqual(['text-widget#title', 'text-widget#later', 'journey-stats-widget#stats'])
            for (const id of keys) {
                expect(list.get(id)?.group).toBe('journey-widgets')
                expect(cache.get(id)?.component).toBeTruthy()
            }
        }
        finally {
            renderer.registry = previousRegistry
        }
    })

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
    })

    it('extends the Basic Record timeline for merged POI display windows', () => {
        const basic = {
            duration: 10,
            animatePoisDuringJourneyReplay: true,
            poiAnimationDurationSeconds: 2,
            endFocus: {enabled: false, duration: 0},
        }
        const nearbyPois = [
            {projectedAbscissa: 500, poi: {id: 'first', type: 'poi', expanded: true, replay: {visible: true, animated: true}}},
            {projectedAbscissa: 550, poi: {id: 'second', type: 'poi', expanded: true, replay: {visible: true, animated: true}}},
        ]
        const replay = {
            userMode: 'basic',
            basicPreparationActive: true,
            duration: 10,
            totalDistance: 1000,
            nearbyPois,
        }
        const journey = {slug: 'poi-export-journey', replay: {basic}}
        const sampler = {
            totalDistance: 1000,
            atProgress: progress => ({progress}),
        }
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'basic', basic}}},
            stores: {replay},
        }

        const {plan} = prepareReplayDeferredExportPlan({
            replay,
            journey,
            controller: {duration: 10, direction: 1, sampler},
            fps: 10,
            dimensions: {width: 1280, height: 720},
            sourceCanvas: {width: 1280, height: 720},
        })

        expect(plan.poiSpeedProfile.playbackDurationMillis).toBeGreaterThan(12500)
        expect(plan.poiSpeedProfile.segments.filter(segment => segment.poiHold)).toHaveLength(2)
        expect(plan.videoTimeline.replayDurationMillis).toBe(plan.poiSpeedProfile.playbackDurationMillis)
        expect(plan.outputDurationMillis).toBe(plan.poiSpeedProfile.playbackDurationMillis)
        expect(resolveReplayVideoFramePhase({timeline: plan.videoTimeline, frameTimeMs: 6500}).progress)
            .toBeCloseTo(replayRouteTimeAtPlaybackTime(plan.poiSpeedProfile, 6500) / 10000)
    })

    it('starts the exported Replay at the preparation range start', async () => {
        const seek = vi.fn()
        const sampler = {
            logicalTrackPath: null,
            atProgress: vi.fn(progress => ({
                progress,
                longitude: progress * 10,
                latitude: progress * 5,
                altitude: 100,
            })),
        }
        const replay = {
            preparationTimeline: {
                timeline: {
                    rangeStartMillis: 4_000,
                    rangeEndMillis: 7_000,
                },
            },
        }
        const {plan, exporter} = prepareReplayDeferredExportPlan({
            replay,
            journey: {slug: 'journey-a'},
            controller: {
                duration: 10,
                direction: 1,
                sampler,
                seek,
                currentSample: () => sampler.atProgress(0),
            },
            fps: 10,
        })

        expect(plan.exportWindow).toMatchObject({
            startMillis: 4_000,
            endMillis: 7_000,
            durationMillis: 3_000,
            startProgress: 0.4,
        })
        expect(exporter.timeline.durationMillis).toBe(3_000)
        expect(plan.manifest.durationMillis).toBe(3_000)

        const firstFrame = await exporter.session.renderFrame(0)

        expect(seek).toHaveBeenCalledWith(0.4, undefined)
        expect(firstFrame.logicalFrame.phase).toMatchObject({
            kind: 'replay',
            progress: 0.4,
        })
        expect(firstFrame.logicalFrame.frameTimeMs).toBe(4_000)

        const lastFrame = await exporter.session.renderFrame(exporter.timeline.frameCount - 1)

        expect(seek).toHaveBeenNthCalledWith(2, 0.7, undefined)
        expect(lastFrame.logicalFrame.phase).toMatchObject({
            kind: 'replay',
            progress: 0.7,
        })
        expect(lastFrame.logicalFrame.frameTimeMs).toBe(7_000)
    })

    it('keeps a start clip at its selected local time when the export range begins inside it', async () => {
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_EXPERT}}},
        }
        const replay = {
            preparationTimeline: {
                timeline: {
                    rangeStartMillis: 1_000,
                    rangeEndMillis: 3_500,
                },
            },
            clips: {
                catalog: {
                    intro: {id: 'intro', slots: ['start'], defaults: {duration: 2}},
                },
                start: [{clipId: 'intro', params: {duration: 2}}],
            },
        }
        const sampler = {
            logicalTrackPath: null,
            atProgress: progress => ({progress, longitude: progress, latitude: progress}),
        }
        const {plan, exporter} = prepareReplayDeferredExportPlan({
            replay,
            journey: {slug: 'journey-a'},
            controller: {duration: 10, direction: 1, sampler, seek: vi.fn()},
            fps: 10,
        })

        const firstFrame = await exporter.session.renderFrame(0)
        const lastFrame = await exporter.session.renderFrame(exporter.timeline.frameCount - 1)

        expect(plan.exportWindow).toMatchObject({startMillis: 1_000, endMillis: 3_500, durationMillis: 2_500})
        expect(firstFrame.logicalFrame.phase).toMatchObject({
            kind: 'pre-replay',
            localMillis: 1_000,
            localProgress: 0.5,
        })
        expect(lastFrame.logicalFrame.phase).toMatchObject({kind: 'replay', progress: 0.15})
    })

    it('includes the configured trace-focus outro in a Basic Replay export timeline', () => {
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_EXPERT}}},
        }
        const replay = {
            basicPreparationActive: true,
            clips: {
                catalog: {},
                start:   [{clipId: 'zoom-in', enabled: true, params: {duration: 5}}],
                stop:    [{clipId: 'zoom-out', enabled: true, params: {duration: 3}}],
            },
        }

        const {plan} = prepareReplayDeferredExportPlan({
            replay,
            journey: {slug: 'simple-journey', replay: {basic: {endFocus: {enabled: true, duration: 5}}}},
            controller: {duration: 12.5, direction: 1},
            fps: 30,
        })

        expect(plan.videoTimeline.phases.map(phase => phase.kind)).toEqual(['replay', 'post-replay'])
        expect(plan.videoTimeline.phases[1].clip).toMatchObject({
            id: 'simple-trace-focus',
            params: {duration: 5, focusTarget: 'trace-centroid', heightDelta: 2000, rpm: 12},
        })
        expect(plan.videoTimeline.durationMillis).toBe(17500)
    })

    it('omits the Basic Replay end focus when its Journey setting is off', () => {
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_EXPERT}}},
        }

        const {plan} = prepareReplayDeferredExportPlan({
            replay: {basicPreparationActive: true},
            journey: {slug: 'no-focus-journey', replay: {basic: {endFocus: {enabled: false, duration: 5}}}},
            controller: {duration: 12.5, direction: 1},
            fps: 30,
        })

        expect(plan.videoTimeline.phases.map(phase => phase.kind)).toEqual(['replay'])
        expect(plan.videoTimeline.durationMillis).toBe(12500)
    })

    it('builds the shared interactive and export video render spec from crop, fps, quality, and dpr', () => {
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

    it('waits for replay widgets with wall-clock polling instead of rAF', async () => {
        let now = 0
        const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
        const originalSetTimeout = globalThis.setTimeout
        globalThis.setTimeout = vi.fn((callback, millis = 0) => {
            now += Math.max(1, Number(millis) || 0)
            callback()
            return 1
        })
        const isWidgetReady = vi.fn(() => false)
        globalThis.requestAnimationFrame = vi.fn()

        try {
            const waitPromise = waitForReplayWidgetsReady({
                widgetKeys: ['journey-overlay#1'],
                maxMillis: 120,
                pollIntervalMs: 20,
                isWidgetReady,
            })

            await expect(waitPromise).resolves.toBe(false)
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled()
            expect(isWidgetReady).toHaveBeenCalled()
            const traceEntries = globalThis.__lgsReplayVideoTrace ?? []
            const traceEvents = traceEntries.map(entry => entry.event)
            expect(traceEvents).toContain('export.widgets.wait.start')
            expect(traceEvents).toContain('export.widgets.wait.poll')
            expect(traceEvents).toContain('export.widgets.wait.timeout')
            expect(traceEntries.find(entry => entry.event === 'export.widgets.wait.timeout')?.data).toEqual(expect.objectContaining({
                widgetCount: 1,
                maxMillis: 120,
                missingWidgetKeys: ['journey-overlay#1'],
                pollCount: expect.any(Number),
            }))
        }
        finally {
            nowSpy.mockRestore()
            globalThis.setTimeout = originalSetTimeout
        }
    })

    it('captures a lightweight export context and reuses only matching plans', () => {
        const replay = {
            videoCropRect: {left: 10, top: 20, width: 640, height: 360},
            recordingSync: true,
            savedCameraState: {
                destination: {longitude: 60, latitude: 30, height: 123.457},
                orientation: {heading: 0.25, pitch: -0.75, roll: 0.125},
                altitude: 123.457,
            },
            replayEntryCameraState: {
                destination: {longitude: 2, latitude: 48, height: 900},
                orientation: {heading: 0.8, pitch: -0.5, roll: 0},
                altitude: 900,
            },
        }
        const controller = {
            direction: 1,
            progress: 0.25,
        }
        const widgetEl = document.createElement('div')
        widgetEl.dataset.videoOverlayVisible = 'true'
        globalThis.lgs = {
            viewer: {
                camera: {
                    heading: 0.5,
                    pitch:   -0.5,
                    roll:    0.25,
                    positionCartographic: {
                        longitude: Math.PI / 2,
                        latitude:  Math.PI / 4,
                        height:    321,
                    },
                },
            },
        }

        globalThis.__ = {
            ui: {
                widgetCache: {
                    isMounted: vi.fn(() => true),
                    getAll: vi.fn(() => new Map([
                        ['compass-widget#1', {mounted: true, widgetsBoard: VIDEO_WIDGETS_BOARD}],
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
            cameraState: {
                destination: {longitude: 2, latitude: 48, height: 900},
                orientation: {heading: 0.8, pitch: -0.5, roll: 0},
                altitude: 900,
            },
            recordingSync: true,
            visibleOverlayIds: ['compass-widget#1'],
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
        expect(freshPlan.plan.definition.cameraDefinition).toEqual(expect.objectContaining({
            version: 2,
            position: expect.objectContaining({altitudeMeters: 1200}),
            orientation: expect.objectContaining({pitchRadians: expect.any(Number)}),
        }))
        expect(freshPlan.plan.definition.initialCameraState).toEqual(context.context.cameraState)

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

        replay.savedCameraState = {
            destination: {longitude: 90, latitude: 45, height: 321},
            orientation: {heading: 0.5, pitch: -0.5, roll: 0.25},
            altitude: 321,
        }
        const cameraStalePlan = resolveReplayDeferredExportPlan({
            replay,
            journey: {slug: 'journey-a'},
            controller,
            fps: 30,
            label: 'plan-a',
            dimensions: {width: 1280, height: 720},
            captureMode: 'quality',
            uiToast: {success: vi.fn()},
        })

        expect(cameraStalePlan.reused).toBe(true)
        expect(cameraStalePlan.plan.runtime.contextKey).toBe(context.contextKey)

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

    it('traverses a dry run without allocating capture canvases or encoder output', async () => {
        Output.instances.length = 0
        const renderedIndexes = []
        const onFrame = vi.fn()
        const yieldToBrowser = vi.fn(async () => {})
        const buildCanvas = vi.fn(() => {
            throw new Error('Dry run must not allocate a capture canvas.')
        })
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 1000, fps: 10},
        })

        const result = await exporter.exportMp4({
            dryRun: true,
            label: 'basic-replay-dry-run',
            dimensions: {width: 640, height: 360},
            buildCanvas,
            renderFrame: async ({frame}) => {
                renderedIndexes.push(frame.index)
            },
            onFrame,
            yieldIntervalMs: 0,
            yieldToBrowser,
        })

        expect(result).toMatchObject({dryRun: true, frameCount: 11, renderedFrameCount: 11})
        expect(result).not.toHaveProperty('frames')
        expect(result).not.toHaveProperty('blob')
        expect(renderedIndexes).toEqual(Array.from({length: 11}, (_value, index) => index))
        expect(onFrame).toHaveBeenCalledTimes(11)
        expect(buildCanvas).not.toHaveBeenCalled()
        expect(yieldToBrowser).toHaveBeenCalledTimes(10)
        expect(Output.instances).toHaveLength(0)
        expect(mediabunnyMocks.canvasAddCount).toBe(0)
        expect(mediabunnyMocks.codecProbeCount).toBe(0)
    })

    it.each([false, true])('allows the frame callback to own seeking with dryRun=%s', async dryRun => {
        const seek = vi.fn()
        const exporter = new ReplayDeferredExporter({
            controller: {seek, sampler: {atProgress: progress => ({progress})}},
            timeline: {durationMillis: 1000, fps: 10},
        })
        const result = await exporter.exportMp4({
            dryRun,
            seekBeforeRender: false,
            dimensions: {width: 320, height: 180},
            buildCanvas: dimensions => ({...dimensions, getContext: () => ({clearRect: vi.fn(), drawImage: vi.fn()})}),
            renderFrame: async ({frame}) => {
                expect(seek).toHaveBeenCalledTimes(frame.index)
                seek(frame.progress, frame.sample)
            },
        })

        expect(result.frameCount).toBe(11)
        expect(seek).toHaveBeenCalledTimes(11)
        expect(seek).toHaveBeenNthCalledWith(1, 0, {progress: 0})
        expect(seek).toHaveBeenLastCalledWith(1, {progress: 1})
    })

    it('cancels a dry run after the current frame without creating output', async () => {
        Output.instances.length = 0
        const abortController = new AbortController()
        const renderFrame = vi.fn(({frame}) => {
            if (frame.index === 0) {
                abortController.abort()
            }
        })
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 1000, fps: 10},
        })

        await expect(exporter.exportMp4({
            dryRun: true,
            dimensions: {width: 640, height: 360},
            signal: abortController.signal,
            buildCanvas: () => ({
                width: 0,
                height: 0,
                getContext: () => ({}),
            }),
            renderFrame,
        })).rejects.toMatchObject({name: 'AbortError'})

        expect(renderFrame).toHaveBeenCalledTimes(1)
        expect(Output.instances).toHaveLength(0)
        expect(mediabunnyMocks.codecProbeCount).toBe(0)
    })

    it('propagates logical Replay frame errors during dry run', async () => {
        Output.instances.length = 0
        const error = new Error('Replay camera frame update failed.')
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 1000, fps: 10},
        })

        await expect(exporter.exportMp4({
            dryRun: true,
            dimensions: {width: 640, height: 360},
            buildCanvas: () => ({
                width: 0,
                height: 0,
                getContext: () => ({}),
            }),
            renderFrame: async () => {
                throw error
            },
        })).rejects.toBe(error)

        expect(Output.instances).toHaveLength(0)
        expect(mediabunnyMocks.codecProbeCount).toBe(0)
    })

    it('finalizes a shareable partial mp4 after a graceful stop request', async () => {
        Output.instances.length = 0
        const renderedFrameIndexes = []
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 1000, fps: 10},
        })

        const result = await exporter.exportMp4({
            dimensions: {width: 640, height: 360},
            buildCanvas: () => ({
                width: 0,
                height: 0,
                getContext: () => ({}),
            }),
            renderFrame: async ({frame}) => {
                renderedFrameIndexes.push(frame.index)
                return null
            },
            shouldStop: (_frame, processedFrames) => processedFrames === 2,
        })

        expect(result.frameCount).toBe(2)
        expect(result.frames.map(frame => frame.index)).toEqual([0, 1])
        expect(renderedFrameIndexes).toEqual([0, 1])
        expect(result.blob).toBeInstanceOf(Blob)
        expect(result.blob.size).toBeGreaterThan(0)
        expect(Output.instances.at(-1).finalize).toHaveBeenCalledTimes(1)
        expect(Output.instances.at(-1).cancel).not.toHaveBeenCalled()
    })

    it('finalizes an MP4 timeline that contains POI slowdown ramps and one-second holds', async () => {
        Output.instances.length = 0
        const profile = createReplayPOISpeedProfile({
            entries: [
                {projectedAbscissa: 500, poi: {id: 'poi-hold', expanded: true, replay: {animated: true, visible: true}}},
            ],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings: {
                animatePoisDuringJourneyReplay: true,
                poiAnimationDurationSeconds: 2,
                poiVisibilityMode: 'user',
            },
            enabled: true,
        })
        const timeline = buildReplayVideoTimeline({
            replayDurationMillis: profile.playbackDurationMillis,
            replayProgressProfile: profile,
            fps: 10,
        })
        const exporter = new ReplayDeferredExporter({
            controller: {sampler: {atProgress: progress => ({progress})}},
            timeline,
        })

        const result = await exporter.exportMp4({
            dimensions: {width: 640, height: 360},
            buildCanvas: () => ({
                width: 0,
                height: 0,
                getContext: () => ({clearRect: vi.fn(), drawImage: vi.fn()}),
            }),
            renderFrame: async () => null,
        })

        expect(result.frameCount).toBe(timeline.frameCount)
        expect(result.blob).toBeInstanceOf(Blob)
        expect(result.blob.size).toBeGreaterThan(0)
        expect(Output.instances.at(-1).finalize).toHaveBeenCalledOnce()
    })

    it('cancels the encoder output without finalizing or creating a video blob', async () => {
        Output.instances.length = 0
        const abortController = new AbortController()
        abortController.abort()
        const renderFrame = vi.fn(async () => null)
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 1000, fps: 10},
        })

        await expect(exporter.exportMp4({
            dimensions: {width: 640, height: 360},
            signal: abortController.signal,
            buildCanvas: () => ({
                width: 0,
                height: 0,
                getContext: () => ({}),
            }),
            renderFrame,
        })).rejects.toMatchObject({name: 'AbortError'})

        expect(renderFrame).not.toHaveBeenCalled()
        expect(Output.instances.at(-1).finalize).not.toHaveBeenCalled()
        expect(Output.instances.at(-1).cancel).toHaveBeenCalledTimes(1)
        expect(Output.instances.at(-1).target.buffer).toBeNull()
    })

    it('cancels the output when the codec fails during frame encoding', async () => {
        mediabunnyMocks.failNextCanvasAdd = true
        const exporter = new ReplayDeferredExporter({
            timeline: {durationMillis: 1000, fps: 10},
        })

        await expect(exporter.exportMp4({
            dimensions: {width: 640, height: 360},
            buildCanvas: () => ({
                width: 0,
                height: 0,
                getContext: () => ({}),
            }),
            renderFrame: async () => null,
        })).rejects.toThrow('Codec reclaimed due to inactivity.')

        expect(Output.instances.at(-1).cancel).toHaveBeenCalledTimes(1)
    })

    it('submits a keep-alive frame while a replay frame is rendering', async () => {
        vi.useFakeTimers()
        try {
            let resolveSlowFrame
            const slowFrameStarted = new Promise(resolve => {
                resolveSlowFrame = resolve
            })
            const exporter = new ReplayDeferredExporter({
                timeline: {durationMillis: 1000, fps: 2},
            })
            const exportPromise = exporter.exportMp4({
                dimensions: {width: 640, height: 360},
                buildCanvas: () => ({
                    width: 0,
                    height: 0,
                    getContext: () => ({}),
                }),
                renderFrame: async ({frame}) => {
                    if (frame.index === 1) {
                        resolveSlowFrame()
                        await new Promise(resolve => setTimeout(resolve, 6000))
                    }
                },
            })

            await slowFrameStarted
            await vi.advanceTimersByTimeAsync(5001)
            await vi.advanceTimersByTimeAsync(999)
            await exportPromise

            expect(mediabunnyMocks.canvasAddCount).toBeGreaterThan(3)
        }
        finally {
            vi.useRealTimers()
        }
    })

    it.each(['basic', 'expert'])('runs %s MP4 export with exclusive viewer rendering and restores its loop', async userMode => {
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
            userMode,
            journeySlug: 'journey-a',
            trackSlug: 'track-a',
            progress: 0.25,
            durationMillis: 1000,
            readiness: {enabled: userMode === 'expert'},
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
        const exportViewer = {
            scene: globalThis.lgs.scene,
            useDefaultRenderLoop: true,
            resize: vi.fn(),
            render: vi.fn(() => {
                expect(exportViewer.useDefaultRenderLoop).toBe(false)
                globalThis.lgs.scene.render()
            }),
        }
        globalThis.lgs.viewer = exportViewer

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
        expect(seek).toHaveBeenCalledTimes(result.plan.manifest.frameCount + 1)
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledTimes(result.frameCount + 1)
        expect(exportViewer.render).toHaveBeenCalledTimes(result.frameCount)
        expect(exportViewer.resize).toHaveBeenCalledTimes(result.frameCount)
        expect(exportViewer.useDefaultRenderLoop).toBe(true)
        expect(globalThis.__.ui.replay.refresh).toHaveBeenCalled()
        expect(result.plan.runtime.exportProgress).toBe(1)
        expect(result.plan.runtime.exportProcessedFrames).toBe(result.plan.manifest.frameCount)
        expect(result.plan.runtime.exportEstimatedRemainingMillis).toBe(0)
        expect(result.plan.runtime.exportFileSize).toBe(result.blob.size)
        expect(result.plan.runtime.exportFileSize).toBeGreaterThan(0)
        expect(result.plan.runtime.recordingPerformance).toBe(result.recordingPerformance)
        expect(result.recordingPerformance).toMatchObject({
            status: 'completed', frameCount: result.frameCount, outputBytes: result.blob.size,
            context: {dimensions: {width: 1280, height: 720}, renderHostMode: 'visible'},
        })
        for (const key of ['frameResolution', 'frameRendering', 'replayFrameUpdate', 'sceneTileReadiness', 'cesiumRender', 'widgetStatePublication', 'overlayCapture', 'overlayLayout', 'encoderSubmission']) {
            expect(result.recordingPerformance.stages.find(stage => stage.key === key)).toMatchObject({count: result.frameCount})
        }
    })

    it('restores the main viewer render loop after an encoder failure', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        const scene = {render: vi.fn(), requestRender: vi.fn()}
        const viewer = {scene, useDefaultRenderLoop: true, render: vi.fn()}
        const replay = {durationMillis: 1000, progress: 0, readiness: {enabled: false}, clips: {catalog: {}, start: [], stop: []}}
        globalThis.lgs = {
            scene,
            viewer,
            canvas: sourceCanvas,
            stores: {ui: {video: {fps: 0, quality: 0}}},
        }
        globalThis.__ = {device: {browser: 'chromium'}, ui: {widgetCache: {getAll: () => new Map()}}}
        mediabunnyMocks.failNextCanvasAdd = true

        await expect(runReplayDeferredMp4Export({
            replay,
            journey: {slug: 'journey-a'},
            controller: {duration: 1, progress: 0, seek: vi.fn(), currentSample: () => ({progress: 0})},
            replayMode: null,
            sourceCanvas,
            dimensions: {width: 320, height: 180},
            buildCanvas: dimensions => ({...dimensions, getContext: () => ({clearRect: vi.fn(), drawImage: vi.fn()})}),
            download: vi.fn(),
        })).rejects.toThrow('Codec reclaimed due to inactivity.')

        expect(viewer.render).toHaveBeenCalled()
        expect(viewer.useDefaultRenderLoop).toBe(true)
    })

    it('keeps the export composer canvas at the exact MP4 dimensions when crop and output ratios differ', async () => {
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
    })

    it('traverses start, replay, and stop clips in Dry run without creating a video', async () => {
        Output.instances.length = 0
        let now = 0
        const performanceNow = vi.spyOn(globalThis.performance, 'now').mockImplementation(() => now)
        const monitorSnapshots = []
        const unsubscribeMonitor = subscribeReplayRecordingMonitor(() => {
            monitorSnapshots.push(getReplayRecordingMonitorSnapshot())
        })
        const captureSpies = [
            vi.spyOn(replayOverlayComposer, 'getVisibleReplayVideoWidgetKeys'),
            vi.spyOn(replayOverlayComposer, 'isReplayVideoWidgetReady'),
            vi.spyOn(replayOverlayComposer, 'flushReplayVideoOverlayCanvases'),
            vi.spyOn(replayWidgetFrames, 'commitReplayWidgetFrame'),
        ]
        const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
        const consoleTable = vi.spyOn(console, 'table').mockImplementation(() => {})
        let releaseFirstFrameTiles
        let signalFirstFrameTileWait
        let frameTileWaitCount = 0
        const firstFrameTiles = new Promise(resolve => { releaseFirstFrameTiles = resolve })
        const firstFrameTileWait = new Promise(resolve => { signalFirstFrameTileWait = resolve })
        const tileCoordinator = {
            prepareForCapture: vi.fn(async ({maxMillis}) => {
                if (maxMillis === 250) {
                    frameTileWaitCount += 1
                    if (frameTileWaitCount === 1) {
                        signalFirstFrameTileWait()
                        await firstFrameTiles
                    }
                }
                now += 20
            }),
            dispose: vi.fn(),
        }
        const restoreTileCache = vi.fn()
        const scene = {camera: {}, render: vi.fn()}
        const prepareTileCache = vi.spyOn(replayTileReadiness, 'prepareReplaySceneTileCache')
            .mockReturnValue(restoreTileCache)
        const createTileCoordinator = vi.spyOn(replayTileReadiness, 'createReplaySceneTileReadinessCoordinator')
            .mockReturnValue(tileCoordinator)
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        sourceCanvas.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top: 0,
            width: 320,
            height: 180,
        }))
        const buildCanvas = vi.fn(() => {
            throw new Error('Dry run must not allocate a capture canvas.')
        })
        const renderReplayExportFrame = vi.fn(({phase}) => {
            now += 40
            return {progress: phase.progress}
        })
        const restorePlaybackScene = vi.fn(async () => undefined)
        const preparePlaybackSceneForExport = vi.fn(async () => {
            now += 5000
            return true
        })
        const yieldToBrowser = vi.fn(async () => {})
        const uiToast = {success: vi.fn()}
        const replayMode = {
            preparePlaybackSceneForExport,
            renderReplayExportFrame,
            restorePlaybackScene,
            cesiumScene: () => scene,
        }
        const replay = {
            journeySlug: 'journey-dry-run',
            trackSlug: 'track-dry-run',
            progress: 0,
            durationMillis: 1000,
            videoCropRect: {left: 0, top: 0, width: 320, height: 180},
            clips: {
                catalog: {
                    'zoom-in': {slots: ['start']},
                    landing: {slots: ['stop']},
                },
                start: [{clipId: 'zoom-in', params: {duration: 1}}],
                stop: [{clipId: 'landing', params: {duration: 1}}],
            },
        }
        const controller = {
            duration: 1,
            direction: 1,
            progress: 0,
            sampler: {atProgress: progress => ({progress})},
            currentSample: () => ({progress: 0}),
            seek: vi.fn(),
        }
        globalThis.lgs = {
            canvas: sourceCanvas,
            settings: {
                ui: {
                    replay: {userMode: REPLAY_USER_MODE_EXPERT},
                    video: {fps: 0, quality: 0},
                },
            },
            stores: {
                ui: {
                    video: {fps: 0, quality: 0},
                    widget: {list: new Map()},
                },
            },
            theJourney: {slug: 'journey-dry-run'},
        }
        globalThis.__ = {
            device: {browser: 'chromium'},
            ui: {
                replay: replayMode,
                widgetCache: {getAll: vi.fn(() => new Map())},
                widgetManager: {
                    getElementById: vi.fn(() => null),
                    getWidgetConfig: vi.fn(() => ({})),
                },
            },
        }

        let result
        let dryRunPromise
        try {
            dryRunPromise = exportReplayDeferredDryRun({
                replay,
                journey: {slug: 'journey-dry-run'},
                controller,
                replayMode,
                fps: 10,
                dimensions: {width: 320, height: 180},
                sourceCanvas,
                buildCanvas,
                yieldIntervalMs: 0,
                yieldToBrowser,
                uiToast,
                tileReadinessTimeoutMs: 5000,
            })
            await Promise.race([
                firstFrameTileWait,
                dryRunPromise.then(() => {
                    throw new Error('Dry run completed without waiting for the first frame tiles.')
                }),
            ])
            expect(renderReplayExportFrame).toHaveBeenCalledTimes(5)
            expect(getReplayRecordingMonitorSnapshot().processedFrames).toBe(0)
            releaseFirstFrameTiles()
            result = await dryRunPromise
            captureSpies.forEach(spy => expect(spy).not.toHaveBeenCalled())
            expect(prepareTileCache).toHaveBeenCalledOnce()
            expect(createTileCoordinator).toHaveBeenCalledOnce()
            createTileCoordinator.mock.calls[0][1].renderNow()
            expect(consoleTable).toHaveBeenCalledOnce()
        }
        finally {
            releaseFirstFrameTiles()
            await dryRunPromise?.catch(() => {})
            unsubscribeMonitor()
            performanceNow.mockRestore()
            captureSpies.forEach(spy => spy.mockRestore())
            prepareTileCache.mockRestore()
            createTileCoordinator.mockRestore()
            consoleInfo.mockRestore()
            consoleTable.mockRestore()
        }

        const phases = renderReplayExportFrame.mock.calls.slice(-result.plan.manifest.frameCount)
            .map(([frame]) => frame.phase.kind)
        const dryRunFrameCalls = renderReplayExportFrame.mock.calls.slice(-result.plan.manifest.frameCount)
        const readinessFrameCalls = dryRunFrameCalls.filter(([options]) => options.frame.isFirst
            || options.frame.isLast
            || options.phase.isFinalSceneFrame
            || options.phase.isLastPhaseFrame
            || options.phase.phaseFrameIndex === 0)
        const progressSnapshots = monitorSnapshots.filter(snapshot => snapshot.mode === 'dry-run'
            && snapshot.processedFrames > 0)
        expect(result).toMatchObject({dryRun: true, frameCount: result.plan.manifest.frameCount})
        expect(result).not.toHaveProperty('frames')
        expect(result).not.toHaveProperty('blob')
        expect(dryRunFrameCalls.every(([options]) => options.dryRun === true)).toBe(true)
        // The native frame callback owns seeking. Only the terminal progress restoration seeks here.
        expect(controller.seek).toHaveBeenCalledOnce()
        expect(controller.seek).toHaveBeenCalledWith(0)
        expect(scene.render).toHaveBeenCalledOnce()
        expect(progressSnapshots.length).toBeLessThan(result.plan.manifest.frameCount)
        expect(progressSnapshots.at(-1)).toMatchObject({
            progress: 1,
            processedFrames: result.plan.manifest.frameCount,
        })
        expect(result.timings).toMatchObject({
            frameCount: result.plan.manifest.frameCount,
            cameraTraceMillis: result.plan.manifest.frameCount * 40,
            widgetStateMillis: 0,
            tileReadinessMillis: readinessFrameCalls.length * 20,
            otherMillis: 5220,
            totalMillis: 5220 + result.plan.manifest.frameCount * 40 + readinessFrameCalls.length * 20,
        })
        expect(phases).toContain('pre-replay')
        expect(phases).toContain('replay')
        expect(phases).toContain('post-replay')
        expect(renderReplayExportFrame).toHaveBeenCalledTimes(result.plan.manifest.frameCount + 4)
        expect(tileCoordinator.prepareForCapture.mock.calls.filter(([options]) => options.maxMillis === 100)).toHaveLength(3)
        expect(tileCoordinator.prepareForCapture.mock.calls.filter(([options]) => options.maxMillis === 250))
            .toHaveLength(readinessFrameCalls.length)
        expect(frameTileWaitCount).toBe(readinessFrameCalls.length)
        expect(tileCoordinator.dispose).toHaveBeenCalledOnce()
        expect(restoreTileCache).toHaveBeenCalledOnce()
        expect(yieldToBrowser).toHaveBeenCalledTimes(result.plan.manifest.frameCount - 1)
        expect(restorePlaybackScene).toHaveBeenCalledTimes(2)
        expect(preparePlaybackSceneForExport).toHaveBeenCalledOnce()
        expect(buildCanvas).not.toHaveBeenCalled()
        expect(CanvasOverlayComposer).not.toHaveBeenCalled()
        expect(result.plan.runtime.exportElapsedMillis).toBe(
            5220 + result.plan.manifest.frameCount * 40 + readinessFrameCalls.length * 20,
        )
        expect(result.plan.runtime.exportAverageFrameMillis).toBeLessThan(60)
        expect(result.plan.runtime.exportEstimatedTotalMillis).toBeLessThan(result.plan.manifest.frameCount * 60)
        expect(monitorSnapshots.find(snapshot => snapshot.mode === 'dry-run' && snapshot.processedFrames > 0)).toMatchObject({
            elapsedMillis: 5280,
            estimatedRemainingMillis: null,
        })
        expect(uiToast.success).toHaveBeenCalledWith(expect.objectContaining({
            caption: 'Replay dry run',
        }))
        expect(Output.instances).toHaveLength(0)
        expect(mediabunnyMocks.codecProbeCount).toBe(0)
    })

    it('keeps product Replay export on the main Cesium scene across every clip phase', async () => {
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
        const mainScene = {
            render: vi.fn(),
            requestRender: vi.fn(),
        }
        let activeScene = mainScene
        let tileReadinessScene = null
        let tileReadinessOptions = null
        const tileReadinessCoordinator = {
            prepareForCapture: vi.fn(async () => {
                tileReadinessOptions?.renderNow?.()
                return true
            }),
            dispose: vi.fn(),
        }
        const tileReadinessCoordinatorFactory = vi.spyOn(
            replayTileReadiness,
            'createReplaySceneTileReadinessCoordinator',
        ).mockImplementation((scene, options) => {
            tileReadinessScene = scene
            tileReadinessOptions = options
            return tileReadinessCoordinator
        })
        const isolatedScene = {
            render: vi.fn(),
            requestRender: vi.fn(),
            globe: {tileCacheSize: 100},
        }
        const isolatedCanvas = document.createElement('canvas')
        isolatedCanvas.width = 320
        isolatedCanvas.height = 180
        const isolatedRenderTarget = {
            viewer: {scene: isolatedScene, canvas: isolatedCanvas},
            scene: isolatedScene,
            canvas: isolatedCanvas,
        }
        const isolatedRenderHost = {
            initialize: vi.fn(async () => undefined),
            renderTarget: vi.fn(() => isolatedRenderTarget),
            canvas: vi.fn(() => isolatedCanvas),
            prepareForCapture: vi.fn(async () => true),
            destroy: vi.fn(),
        }
        const isolatedRenderHostFactory = vi.fn(() => isolatedRenderHost)
        const setRenderTarget = vi.fn(target => {
            activeScene = target.scene
        })
        const clearRenderTarget = vi.fn(() => {
            activeScene = mainScene
        })
        const interactiveCamera = {
            heading: 0.5,
            pitch:   -0.5,
            roll:    0.25,
            frustum: new PerspectiveFrustum({
                fov:          Math.PI / 3,
                aspectRatio: 320 / 180,
                near:         1,
                far:          10000,
            }),
            positionCartographic: {
                longitude: Math.PI / 2,
                latitude:  Math.PI / 4,
                height:    321,
            },
        }

        try {
            globalThis.requestAnimationFrame = vi.fn(callback => {
                callback?.()
                return 1
            })
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {userMode: REPLAY_USER_MODE_EXPERT},
                },
            },
            canvas: sourceCanvas,
            scene: mainScene,
            viewer: {
                terrainProvider: {id: 'terrain'},
                imageryLayers: {length: 0, get: vi.fn()},
                scene: {
                    mode: 3,
                    camera: interactiveCamera,
                    globe: {},
                    fog: {},
                },
                camera: interactiveCamera,
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
                        cesiumScene: () => activeScene,
                        setRenderTarget,
                        clearRenderTarget,
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
                    replayEntryCameraState: {
                        destination: {longitude: 90, latitude: 45, height: 321},
                        orientation: {heading: 0.5, pitch: -0.5, roll: 0.25},
                        altitude: 321,
                    },
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
                isolatedRenderHostFactory,
                renderHostMode: 'visible',
            })

            const phases = renderReplayExportFrame.mock.calls.map(([args]) => args.phase.kind)
            expect(result.plan.manifest.durationMillis).toBe(3000)
            expect(phases).toContain('pre-replay')
            expect(phases).toContain('replay')
            expect(phases).toContain('post-replay')
            expect(renderReplayExportFrame.mock.calls.at(-1)?.[0]?.phase).toMatchObject({
                kind: 'post-replay',
                localProgress: 1,
                isFinalSceneFrame: true,
            })
            expect(renderReplayExportFrame.mock.calls.some(([args]) => args.phase.isLastTwoReplayFrames === true)).toBe(true)
            expect(CanvasOverlayComposer.instances.some(instance => instance.addOverlay.mock.calls.length > 0)).toBe(false)
            expect(preparePlaybackSceneForExport).toHaveBeenCalledWith(expect.objectContaining({
                journey: expect.objectContaining({slug: 'journey-a'}),
                progress: 0,
                hideReplayMarker: true,
                cameraState: {
                    destination: {longitude: 90, latitude: 45, height: 321},
                    orientation: {heading: 0.5, pitch: -0.5, roll: 0.25},
                    altitude: 321,
                },
            }))
            expect(restorePlaybackScene).toHaveBeenCalledTimes(2)
            expect(restorePlaybackScene).toHaveBeenNthCalledWith(1, {force: true})
            expect(restorePlaybackScene).toHaveBeenNthCalledWith(2, {force: true})
            expect(isolatedRenderHostFactory).not.toHaveBeenCalled()
            expect(isolatedRenderHost.initialize).not.toHaveBeenCalled()
            expect(isolatedRenderHost.prepareForCapture).not.toHaveBeenCalled()
            expect(isolatedRenderHost.destroy).not.toHaveBeenCalled()
            expect(setRenderTarget).not.toHaveBeenCalled()
            expect(clearRenderTarget).not.toHaveBeenCalled()
            expect(tileReadinessScene).toBe(mainScene)
            expect(tileReadinessCoordinatorFactory).toHaveBeenCalledWith(mainScene, expect.objectContaining({
                renderNow: expect.any(Function),
            }))
            expect(tileReadinessCoordinator.prepareForCapture).toHaveBeenCalled()
            expect(CanvasOverlayComposer.instances[0].sourceCanvas).toBe(sourceCanvas)
            expect(CanvasOverlayComposer.instances[0].options.flushWebGLBuffer).toEqual(expect.any(Function))
            expect(mainScene.render).toHaveBeenCalled()
            expect(isolatedScene.render).not.toHaveBeenCalled()
            expect(result.plan.runtime.exportElapsedMillis).toBe(result.plan.manifest.frameCount * 40)
            expect(result.plan.runtime.exportAverageFrameMillis).toBeCloseTo(40, 1)
            expect(result.plan.runtime.exportEstimatedTotalMillis).toBeCloseTo(result.plan.runtime.exportElapsedMillis, 1)
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled()
            const traceEntries = globalThis.__lgsReplayVideoTrace ?? []
            const traceEvents = traceEntries.map(entry => entry.event)
            expect(traceEvents).toEqual(expect.arrayContaining([
                'export.camera.ownership.start',
                'export.camera.ownership.end',
                'export.run.start',
                'export.run.end',
                'export.interactive.restore.start',
                'export.interactive.restore.end',
                'export.scene.prepare.start',
                'export.scene.prepare.end',
                'export.widgets.wait.start',
                'export.widgets.wait.ready',
                'export.codec.probe.start',
                'export.codec.probe.end',
            ]))
            expect(traceEntries.find(entry => entry.event === 'export.run.end')?.data).toEqual(expect.objectContaining({
                succeeded: true,
                aborted: false,
            }))
        }
        finally {
            performanceNow.mockRestore()
            tileReadinessCoordinatorFactory.mockRestore()
        }
    })

    it('fails isolated Replay export without falling back to the visible canvas', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        const camera = {
            heading: 0.5,
            pitch: -0.5,
            roll: 0,
            frustum: new PerspectiveFrustum({
                fov: Math.PI / 3,
                aspectRatio: 320 / 180,
                near: 1,
                far: 10000,
            }),
            positionCartographic: {longitude: 1, latitude: 0.5, height: 1000},
        }
        const mainScene = {
            mode: 3,
            camera,
            globe: {},
            fog: {},
            render: vi.fn(),
            requestRender: vi.fn(),
        }
        const restorePlaybackScene = vi.fn(async () => undefined)
        const setRenderTarget = vi.fn()
        const clearRenderTarget = vi.fn()
        const renderReplayExportFrame = vi.fn()
        const isolatedRenderHost = {
            initialize: vi.fn(async () => {
                throw new Error('WebGL context unavailable')
            }),
            destroy: vi.fn(),
        }
        const isolatedRenderHostFactory = vi.fn(() => isolatedRenderHost)
        const buildCanvas = vi.fn(() => ({
            width: 320,
            height: 180,
            getContext: () => ({clearRect: vi.fn(), drawImage: vi.fn()}),
        }))
        const replayMode = {
            restorePlaybackScene,
            setRenderTarget,
            clearRenderTarget,
            renderReplayExportFrame,
            cesiumScene: () => mainScene,
        }
        globalThis.lgs = {
            canvas: sourceCanvas,
            scene: mainScene,
            viewer: {
                scene: mainScene,
                camera,
                terrainProvider: {id: 'terrain'},
                imageryLayers: {length: 0, get: vi.fn()},
            },
            stores: {ui: {video: {fps: 10, quality: 0}}},
            theJourney: {slug: 'journey-a'},
        }
        globalThis.__ = {
            device: {browser: 'chromium'},
            ui: {
                replay: replayMode,
                widgetCache: {getAll: vi.fn(() => new Map())},
                widgetManager: {
                    getElementById: vi.fn(() => null),
                    getWidgetConfig: vi.fn(() => ({})),
                },
            },
        }

        let exportError = null
        try {
            await runReplayDeferredMp4Export({
                replay: {
                    progress: 0,
                    durationMillis: 1000,
                    videoCropRect: {left: 0, top: 0, width: 320, height: 180},
                    clips: {catalog: {}, start: [], stop: []},
                },
                journey: {slug: 'journey-a'},
                controller: {
                    duration: 1,
                    direction: 1,
                    progress: 0,
                    sampler: {atProgress: progress => ({progress})},
                    currentSample: () => ({progress: 0}),
                    seek: vi.fn(),
                },
                fps: 10,
                dimensions: {width: 320, height: 180},
                sourceCanvas,
                buildCanvas,
                download: vi.fn(),
                renderHostMode: 'isolated',
                isolatedRenderHostFactory,
            })
        }
        catch (error) {
            exportError = error
        }

        expect(exportError).toMatchObject({
            message: 'Isolated Replay rendering could not be initialized.',
            cause: expect.objectContaining({message: 'WebGL context unavailable'}),
        })
        expect(isolatedRenderHostFactory).toHaveBeenCalledOnce()
        expect(isolatedRenderHost.destroy).toHaveBeenCalledOnce()
        expect(setRenderTarget).not.toHaveBeenCalled()
        expect(clearRenderTarget).not.toHaveBeenCalled()
        expect(renderReplayExportFrame).not.toHaveBeenCalled()
        expect(buildCanvas).not.toHaveBeenCalled()
        expect(CanvasOverlayComposer).not.toHaveBeenCalled()
        expect(mainScene.render).not.toHaveBeenCalled()
        expect(restorePlaybackScene).toHaveBeenCalledTimes(2)
    })

    it('restores the Interactive scene when export preparation fails', async () => {
        const restorePlaybackScene = vi.fn(() => Promise.resolve())
        const preparePlaybackSceneForExport = vi.fn(async () => {
            throw new Error('export preparation failed')
        })

        globalThis.lgs = {
            canvas: {width: 320, height: 180},
            stores: {ui: {video: {fps: 30, quality: 0}}},
            theJourney: {slug: 'journey-a'},
        }
        globalThis.__ = {
            ui: {
                replay: {
                    preparePlaybackSceneForExport,
                    restorePlaybackScene,
                },
                widgetCache: {getAll: vi.fn(() => new Map())},
                widgetManager: {
                    getElementById: vi.fn(() => null),
                    getWidgetConfig: vi.fn(() => ({})),
                },
            },
        }

        await expect(runReplayDeferredMp4Export({
            replay: {
                progress: 0,
                durationMillis: 1000,
                clips: {catalog: {}, start: [], stop: []},
            },
            journey: {slug: 'journey-a'},
            controller: {
                duration: 1,
                progress: 0,
                currentSample: () => ({progress: 0}),
            },
            sourceCanvas: globalThis.lgs.canvas,
            buildCanvas: () => ({
                width: 320,
                height: 180,
                getContext: () => ({clearRect: vi.fn(), drawImage: vi.fn()}),
            }),
            download: vi.fn(),
        })).rejects.toThrow('export preparation failed')

        expect(restorePlaybackScene).toHaveBeenCalledTimes(2)
        expect(restorePlaybackScene).toHaveBeenNthCalledWith(1, {force: true})
        expect(restorePlaybackScene).toHaveBeenNthCalledWith(2, {force: true})
    })
})

describe('Replay export terminal cleanup', () => {
    it.each([false, true])('preserves the encoding outcome and continues cleanup after restoration errors (encoder fails: %s)', async encoderFails => {
        Output.instances.length = 0
        const sceneError = new Error('Terminal scene restoration failed')
        const refreshError = new Error('Preparation refresh failed')
        const restorePlaybackScene = vi.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(sceneError)
        const refresh = vi.fn(() => { throw refreshError })
        const restoreTileCache = vi.fn()
        const prepareTileCache = vi.spyOn(replayTileReadiness, 'prepareReplaySceneTileCache').mockReturnValue(restoreTileCache)
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
        const consoleTable = vi.spyOn(console, 'table').mockImplementation(() => {})
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 320
        sourceCanvas.height = 180
        sourceCanvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 320, height: 180})
        const scene = {render: vi.fn(), requestRender: vi.fn()}
        const viewer = {scene, useDefaultRenderLoop: true, render: vi.fn(), resize: vi.fn()}
        const replay = {
            durationMillis: 1000, progress: 0, readiness: {enabled: false},
            clips: {catalog: {}, start: [], stop: []},
        }
        const replayMode = {
            restorePlaybackScene,
            preparePlaybackSceneForExport: vi.fn(async () => true),
            renderReplayExportFrame: vi.fn(async () => ({})),
            cesiumScene: () => scene,
            refresh,
        }
        const uiToast = {success: vi.fn(), warning: vi.fn()}
        globalThis.lgs = {
            scene, viewer, canvas: sourceCanvas,
            stores: {ui: {video: {fps: 0, quality: 0}}},
            settings: {ui: {replay: {userMode: 'expert'}}},
            theJourney: {slug: 'journey-cleanup'},
        }
        globalThis.__ = {
            device: {browser: 'chromium'},
            ui: {
                replay: replayMode,
                widgetCache: {getAll: () => new Map()},
                widgetManager: {getElementById: () => null, getWidgetConfig: () => ({})},
            },
        }
        mediabunnyMocks.failNextCanvasAdd = encoderFails

        try {
            const exportPromise = runReplayDeferredMp4Export({
                replay,
                journey: {slug: 'journey-cleanup'},
                controller: {duration: 1, progress: 0, seek: vi.fn(), currentSample: () => ({progress: 0})},
                replayMode, sourceCanvas, dimensions: {width: 320, height: 180}, fps: 2,
                buildCanvas: dimensions => ({...dimensions, getContext: () => ({clearRect: vi.fn(), drawImage: vi.fn()})}),
                download: null, uiToast,
            })
            if (encoderFails) {
                await expect(exportPromise).rejects.toThrow('Codec reclaimed due to inactivity.')
            }
            else {
                const result = await exportPromise
                expect(result.blob.size).toBeGreaterThan(0)
                expect(result.recordingPerformance.status).toBe('completed')
                expect(Output.instances.at(-1).finalize).toHaveBeenCalledOnce()
                expect(result.cleanupErrors).toEqual([
                    {stage: 'playback-scene', message: sceneError.message},
                    {stage: 'preparation-refresh', message: refreshError.message},
                ])
            }

            expect(restorePlaybackScene).toHaveBeenCalledTimes(2)
            expect(refresh).toHaveBeenCalledOnce()
            expect(restoreTileCache).toHaveBeenCalledOnce()
            expect(CanvasOverlayComposer.instances.at(-1).dispose).toHaveBeenCalledOnce()
            expect(viewer.useDefaultRenderLoop).toBe(true)
            expect(getReplayRecordingMonitorSnapshot().active).toBe(false)
            expect(replay.deferredExportPlan.runtime.cleanupErrors).toHaveLength(2)
            expect(uiToast.warning).toHaveBeenCalledOnce()
            expect(uiToast.warning.mock.calls[0][0].caption).toBe('Replay video cleanup')
            expect(consoleError).toHaveBeenCalledTimes(2)
            expect(scene.requestRender.mock.invocationCallOrder.at(-1)).toBeGreaterThan(restoreTileCache.mock.invocationCallOrder[0])
        }
        finally {
            prepareTileCache.mockRestore()
            consoleError.mockRestore()
            consoleInfo.mockRestore()
            consoleTable.mockRestore()
        }
    })
})

describe('Record performance diagnostics', () => {
    let info
    let table
    let contextSpy

    beforeEach(() => {
        Output.instances.length = 0
        info = vi.spyOn(console, 'info').mockImplementation(() => {})
        table = vi.spyOn(console, 'table').mockImplementation(() => {})
    })

    afterEach(() => {
        contextSpy?.mockRestore()
        contextSpy = null
        info.mockRestore()
        table.mockRestore()
    })

    it('measures rendering and encoding without adding a redundant encoder canvas copy', async () => {
        let now = 0
        const performance = createReplayRecordingPerformance({now: () => now})
        const onPerformance = vi.fn()
        contextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage: vi.fn(() => { now += 2 }),
            clearRect: vi.fn(),
        })
        const exporter = new ReplayDeferredExporter({timeline: {durationMillis: 200, fps: 10}})
        const result = await exporter.exportMp4({
            dimensions: {width: 320, height: 180},
            browser: 'chromium',
            recordingPerformance: performance,
            onPerformance,
            renderFrame: async ({frame}) => {
                if (frame.index === 0) {
                    const output = Output.instances.at(-1)
                    const source = output.addVideoTrack.mock.calls[0][0]
                    source.add.mockImplementation(() => {
                        now += 7
                        source.target._maxPos += 256
                        source.config.onEncodedPacket({byteLength: 256})
                        return Promise.resolve()
                    })
                    source.close.mockImplementation(() => {
                        now += 13
                        return Promise.resolve()
                    })
                    output.finalize.mockImplementation(() => {
                        now += 17
                        output.target.buffer = new ArrayBuffer(output.target._maxPos)
                        return Promise.resolve()
                    })
                }
                now += 11
            },
            onFrame: async () => { now += 3 },
            onFileSize: () => { now += 1 },
        })
        const report = result.recordingPerformance
        expect(report).toMatchObject({
            status: 'completed', frameCount: 3, keepAliveFrameCount: 0,
            encodedPacketCount: 3, outputBytes: 768, wallMillis: 99,
            frameProductionFps: 45.455,
            context: {browser: 'chromium', fps: 10, codec: 'avc', latencyMode: 'quality'},
        })
        expect(report.stages.find(stage => stage.key === 'encoderCopy')).toBeUndefined()
        expect(report.stages.find(stage => stage.key === 'frameRendering')).toMatchObject({count: 3, totalMillis: 33})
        expect(report.stages.find(stage => stage.key === 'encoderSubmission')).toMatchObject({count: 3, totalMillis: 24})
        expect(report.stages.find(stage => stage.key === 'progressPublication')).toMatchObject({count: 3, totalMillis: 9})
        expect(report.stages.find(stage => stage.key === 'fileSizePublication')).toMatchObject({kind: 'detail', totalMillis: 6})
        expect(report.stages.find(stage => stage.key === 'encoderDrain')).toMatchObject({count: 1, totalMillis: 13})
        expect(report.stages.find(stage => stage.key === 'containerFinalize')).toMatchObject({count: 1, totalMillis: 17})
        expect(report.stages.find(stage => stage.key === 'blobCreation')).toMatchObject({count: 1})
        expect(result.frames.map(frame => frame.frameTimeMs)).toEqual([0, 100, 200])
        expect(result.blob.size).toBe(768)
        expect(onPerformance).toHaveBeenCalledExactlyOnceWith(report)
        expect(info).toHaveBeenCalledExactlyOnceWith('[Replay video] Recording performance:', report)
        expect(table).toHaveBeenCalledOnce()
    })

    it.each(['cancelled', 'failed', 'stopped'])('reports partial %s recordings after the encoder cleanup', async status => {
        const onPerformance = vi.fn()
        const abortController = new AbortController()
        if (status === 'cancelled') {
            abortController.abort()
        }
        mediabunnyMocks.failNextCanvasAdd = status === 'failed'
        const exporter = new ReplayDeferredExporter({timeline: {durationMillis: 1000, fps: 10}})
        const promise = exporter.exportMp4({
            dimensions: {width: 320, height: 180},
            signal: abortController.signal,
            onPerformance,
            buildCanvas: dimensions => ({...dimensions, getContext: () => ({})}),
            renderFrame: async () => null,
            shouldStop: (_frame, processedFrames) => processedFrames === 2,
        })
        if (status === 'stopped') {
            expect((await promise).frameCount).toBe(2)
        }
        else {
            await expect(promise).rejects.toMatchObject({name: status === 'cancelled' ? 'AbortError' : 'Error'})
        }
        expect(onPerformance).toHaveBeenCalledOnce()
        const report = onPerformance.mock.calls[0][0]
        expect(report.status).toBe(status)
        expect(report.frameCount).toBe(status === 'stopped' ? 2 : 0)
        const output = Output.instances.at(-1)
        if (status === 'stopped') {
            expect(output.finalize).toHaveBeenCalledOnce()
        }
        else {
            expect(output.cancel).toHaveBeenCalledOnce()
            expect(report.stages.find(stage => stage.key === 'cancellationCleanup')).toMatchObject({count: 1})
        }
        if (status === 'failed') {
            expect(report.stages.find(stage => stage.key === 'encoderSubmission')).toMatchObject({count: 1})
        }
        expect(table).toHaveBeenCalledOnce()
    })

    it('does not create recording measurements for a dry run', async () => {
        const onPerformance = vi.fn()
        const exporter = new ReplayDeferredExporter({timeline: {durationMillis: 0, fps: 10}})
        const result = await exporter.exportMp4({
            dryRun: true,
            onPerformance,
            renderFrame: async () => null,
        })
        expect(result).not.toHaveProperty('recordingPerformance')
        expect(onPerformance).not.toHaveBeenCalled()
        expect(info).not.toHaveBeenCalled()
        expect(table).not.toHaveBeenCalled()
    })

    it('keeps the recording result when a diagnostic report consumer fails', async () => {
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
        try {
            const exporter = new ReplayDeferredExporter({timeline: {durationMillis: 0, fps: 10}})
            const result = await exporter.exportMp4({
                dimensions: {width: 320, height: 180},
                buildCanvas: dimensions => ({...dimensions, getContext: () => ({})}),
                renderFrame: async () => null,
                onPerformance: () => { throw new Error('Report consumer failed') },
            })
            expect(result).toMatchObject({frameCount: 1, recordingPerformance: {status: 'completed'}})
            expect(result.blob.size).toBeGreaterThan(0)
            expect(warning).toHaveBeenCalledOnce()
        }
        finally {
            warning.mockRestore()
        }
    })
})
