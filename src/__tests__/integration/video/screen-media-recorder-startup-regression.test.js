/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: screen-media-recorder-startup-regression.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-29
 * Last modified on: 2026-06-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
