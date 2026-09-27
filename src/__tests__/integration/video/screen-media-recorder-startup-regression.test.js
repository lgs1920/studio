/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: screen-media-recorder-startup-regression.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-29
 * Last modified: 2026-09-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('mediabunny', () => {
    class FakeVideoSample {
        constructor(canvas, init) {
            this.canvas = canvas
            this.timestamp = init.timestamp
            this.duration = init.duration
            this.close = vi.fn()
        }
    }

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
            this.add = vi.fn(() => new Promise((resolve, reject) => {
                const stats = globalThis.__screenRecorderTestSourceStats
                if (stats) {
                    stats.active += 1
                    stats.maxConcurrent = Math.max(stats.maxConcurrent, stats.active)
                }

                const settle = () => {
                    if (stats) {
                        stats.active -= 1
                    }
                    if (globalThis.__screenRecorderTestFrameError) {
                        reject(globalThis.__screenRecorderTestFrameError)
                        return
                    }
                    config.onEncodedPacket?.()
                    resolve()
                }

                const delay = Number(globalThis.__screenRecorderTestSourceDelayMs) || 0
                if (delay > 0) {
                    setTimeout(settle, delay)
                }
                else {
                    settle()
                }
            }))
            this.close = vi.fn(() => Promise.resolve())
        }
    }

    class FakeVideoSampleSource extends FakeCanvasSource {
        constructor(config) {
            super(null, config)
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
        VideoSample: FakeVideoSample,
        VideoSampleSource: FakeVideoSampleSource,
        canEncodeVideo: vi.fn(() => globalThis.__screenRecorderTestCodecProbe ?? Promise.resolve(true)),
        getEncodableVideoCodecs: vi.fn(() => Promise.resolve([])),
    }
})

describe('ScreenMediaRecorder startup', () => {
    let canvas
    let recorder
    let errorHandler

    beforeEach(() => {
        vi.useFakeTimers()
        globalThis.__ = {
            device: {
                browser: 'chromium',
            },
        }
        globalThis.lgs = {
            configuration: {
                videoFormats: [
                    {value: '16:9'},
                ],
            },
        }
        globalThis.__screenRecorderTestCodecProbe = null
        globalThis.__screenRecorderTestFrameError = null
        globalThis.__screenRecorderTestSourceDelayMs = 0
        globalThis.__screenRecorderTestSourceStats = null
        let rafCalls = 0
        globalThis.requestAnimationFrame = vi.fn((callback) => {
            rafCalls += 1
            if (rafCalls <= 2) {
                queueMicrotask(() => callback(performance.now()))
            }
            return rafCalls
        })
        globalThis.cancelAnimationFrame = vi.fn()
        globalThis.document.body.classList.remove('recording-in-progress', 'recording-paused')

        ScreenMediaRecorder.instance = null
        recorder = new ScreenMediaRecorder()
        canvas = document.createElement('canvas')
        canvas.width = 1920
        canvas.height = 1080
        canvas.getContext = vi.fn(() => ({}))
        recorder.setCanvas(canvas)
        recorder.initialize({
            fps:        30,
            quality:    1,
            maxDuration: 60,
            maxSize:    1000000,
            ratio:      '16:9',
        })

        errorHandler = vi.fn()
        recorder.addEventListener(ScreenMediaRecorder.events.ERROR, errorHandler)
    })

    afterEach(async () => {
        if (recorder?.isRecording?.()) {
            await recorder.cancelVideo()
        }
        recorder?.removeEventListener?.(ScreenMediaRecorder.events.ERROR, errorHandler)
        ScreenMediaRecorder.instance = null
        vi.useRealTimers()
        globalThis.__ = undefined
        globalThis.lgs = undefined
        globalThis.__screenRecorderTestCodecProbe = undefined
        globalThis.__screenRecorderTestFrameError = undefined
        globalThis.__screenRecorderTestSourceDelayMs = undefined
        globalThis.__screenRecorderTestSourceStats = undefined
        globalThis.requestAnimationFrame = undefined
        globalThis.cancelAnimationFrame = undefined
    })

    it('does not fail early while the first submitted frame is still waiting for its first MP4 packet', async () => {
        await recorder.startVideo()

        expect(recorder.isRecording()).toBe(true)

        await vi.advanceTimersByTimeAsync(3500)

        expect(errorHandler).not.toHaveBeenCalled()
        expect(recorder.isRecording()).toBe(true)
    })

    it('does not resurrect a cancelled recorder after codec startup resolves', async () => {
        let resolveCodecProbe
        globalThis.__screenRecorderTestCodecProbe = new Promise(resolve => {
            resolveCodecProbe = resolve
        })

        const started = vi.fn()
        recorder.addEventListener(ScreenMediaRecorder.events.START, started)
        const startPromise = recorder.startVideo()

        await Promise.resolve()
        await recorder.cancelVideo()
        resolveCodecProbe(true)
        await startPromise

        expect(started).not.toHaveBeenCalled()
        expect(recorder.isRecording()).toBe(false)
    })

    it('reports repeated frame encoding errors at most once every 30 seconds', async () => {
        await recorder.startVideo()
        globalThis.__screenRecorderTestFrameError = new DOMException('Codec Reclaimed', 'QuotaExceededError')

        await vi.advanceTimersByTimeAsync(1000)

        expect(errorHandler).toHaveBeenCalledTimes(1)
        expect(errorHandler.mock.calls[0][0].detail.error.message).toBe('Codec Reclaimed')

        await vi.advanceTimersByTimeAsync(29000)

        expect(errorHandler).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(1000)

        expect(errorHandler).toHaveBeenCalledTimes(2)
    })

    it('falls back to a timer when the post-start animation frame is suspended', async () => {
        const frameCaptureReady = vi.fn(async () => undefined)
        recorder.initialize({
            fps:         30,
            quality:     1,
            maxDuration: 60,
            maxSize:     1000000,
            ratio:       '16:9',
            captureMode: 'speed',
            frameCaptureReady,
        })

        await recorder.startVideo()
        await vi.advanceTimersByTimeAsync(50)

        expect(frameCaptureReady).toHaveBeenCalled()
        expect(errorHandler).not.toHaveBeenCalled()
    })

    it('runs frameCaptureReady before speed-mode encoded frames when provided', async () => {
        const frameCaptureReady = vi.fn(async () => undefined)
        globalThis.requestAnimationFrame = vi.fn((callback) => {
            queueMicrotask(() => callback(performance.now()))
            return 1
        })

        recorder.initialize({
            fps:        30,
            quality:    1,
            maxDuration: 60,
            maxSize:    1000000,
            ratio:      '16:9',
            captureMode: 'speed',
            frameCaptureReady,
        })

        await recorder.startVideo()
        await Promise.resolve()
        await Promise.resolve()

        expect(frameCaptureReady).toHaveBeenCalled()
        expect(errorHandler).not.toHaveBeenCalled()
    })

    it('serializes speed-mode frame writes while the encoder applies backpressure', async () => {
        const stats = {active: 0, maxConcurrent: 0}
        globalThis.__screenRecorderTestSourceDelayMs = 100
        globalThis.__screenRecorderTestSourceStats = stats

        await recorder.startVideo()
        await vi.advanceTimersByTimeAsync(550)

        expect(stats.maxConcurrent).toBe(1)
        expect(errorHandler).not.toHaveBeenCalled()

        const stopPromise = recorder.stopVideo()
        await vi.advanceTimersByTimeAsync(2000)
        await stopPromise
    })

    it('prepares the first encoded frame after the recording state is dispatched', async () => {
        const frameCaptureReady = vi.fn(async () => undefined)
        const started = vi.fn(() => {
            recorder.setFrameCaptureReady(frameCaptureReady)
        })
        recorder.addEventListener(ScreenMediaRecorder.events.START, started)

        await recorder.startVideo()

        expect(started).toHaveBeenCalledOnce()
        expect(frameCaptureReady).toHaveBeenCalledOnce()

        recorder.removeEventListener(ScreenMediaRecorder.events.START, started)
    })

    it('exposes the 15 fps medium-quality preset', () => {
        expect(ScreenMediaRecorder.FPS).toContain(15)
        expect(ScreenMediaRecorder.VIDEO_PRESETS.get('15-medium')).toMatchObject({
            fps:         3,
            quality:     0,
            name:        'Low',
            description: '15 FPS / Medium quality',
        })
    })
})
