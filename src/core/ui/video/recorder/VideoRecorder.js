/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-20
 * Last modified: 2025-11-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoRecorder - High-performance singleton recorder using mediabunny.
 * Supports canvas compositing, MediaStream, pause/resume, metadata, limits and download.
 * Fully event-driven.
 */
import { APP_KEY, SECOND } from '@Core/constants'
import { DateTime }        from 'luxon'
import {
    BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_LOW, QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                          from 'mediabunny'

/**
 * @class VideoRecorder
 * @extends EventTarget
 */
export class VideoRecorder extends EventTarget {
    /** @type {Object<string, string>} Custom events emitted by the recorder */
    static events = {
        START:    'video/start',
        STOP:     'video/stop',
        PAUSE:    'video/pause',
        RESUME:   'video/resume',
        INFO:     'video/info',
        SOURCE:   'video/source',
        ERROR:    'video/error',
        DOWNLOAD: 'video/download',
        FINALIZE: 'video/finalize',
        CANCEL:   'video/cancel',
        MAX_DURATION: 'video/max-duration',
        MAX_SIZE: 'video/max-size',
    }

    /** @type {Object<string, string>} CSS classes used for visual feedback */
    static CLASSES = {
        RECORDING: 'recording-in-progress',
        PAUSED:    'recording-paused',
    }

    /** @type {Array<{value: number, name: string, short: string}>} Quality presets */
    static QUALITY = [
        {value: QUALITY_LOW, name: 'Low Quality', short: 'L'},
        {value: QUALITY_MEDIUM, name: 'Medium Quality', short: 'M'},
        {value: QUALITY_HIGH, name: 'High Quality', short: 'H'},
        {value: QUALITY_VERY_HIGH, name: 'Very High Quality', short: 'V'},
    ]

    /** @type {number[]} Available frame-rates */
    static FPS = [15, 30, 45, 60]
    /** @type {number} Index of default FPS (30) */
    static DEFAULT_FPS = 1
    /** @type {number} Index of default quality (High) */
    static DEFAULT_QUALITY = 2

    /** @private @type {VideoRecorder|null} Singleton instance */
    static instance

    /** @private @type {Blob|null} Recorded video blob */
    #blob = null
    /** @private @type {Output|null} mediabunny output instance */
    #output = null
    /** @private @type {CanvasSource|null} Canvas source for mediabunny */
    #videoSource = null
    /** @private @type {MediaStream|null} Optional MediaStream source */
    #stream = null
    /** @private @type {HTMLCanvasElement|null} Canvas used as source */
    #outputCanvas = null
    /** @private @type {CanvasRenderingContext2D|null} 2D context of output canvas */
    #outputCtx = null
    /** @private @type {HTMLVideoElement|null} Video element for MediaStream source */
    #videoElement = null

    /** @private @type {number|null} requestAnimationFrame ID (stream drawing) */
    #rafId = null
    /** @private @type {number|null} setInterval ID for frame pushing */
    #frameInterval = null
    /** @private @type {number|null} setInterval ID for INFO events */
    #infoInterval = null

    /** @private @type {boolean} True when recording is active */
    #isRecording = false
    /** @private @type {boolean} True when recording is paused */
    #isPaused = false
    /** @private @type {number} performance.now() at recording start */
    #startTime = 0
    /** @private @type {number} performance.now() at last resume */
    #recordingBaseTime = 0
    /** @private @type {number} Accumulated recorded time excluding pauses (ms) */
    #accumulatedTime = 0
    /** @private @type {number} Number of frames pushed */
    #frameCount = 0
    /** @private @type {number} Current recorded duration in milliseconds */
    #duration = 0
    /** @private @type {number} Current recorded size in bytes */
    #sizeBytes = 0

    /** @private @type {number} Recording FPS */
    #fps = VideoRecorder.FPS[VideoRecorder.DEFAULT_FPS]
    /** @private @type {{value: number, name: string, short: string}} Selected quality */
    #quality = VideoRecorder.QUALITY[VideoRecorder.DEFAULT_QUALITY]
    /** @private @type {number} Maximum allowed duration (ms) */
    #maxDuration = Infinity
    /** @private @type {number} Maximum allowed size (bytes) */
    #maxSize = Infinity
    /** @private @type {number} Interval between INFO events (ms) */
    #timeslice = SECOND
    /** @private @type {Record<string, any>} Metadata embedded in MP4 container */
    #metadata = {}
    /** @private @type {string} Source type ('canvas' | 'stream') */
    #sourceType = 'unknown'
    /** @private @type {{width: number, height: number}} Output dimensions */
    #dimensions = {width: 1920, height: 1080}
    /** @private @type {any} Ratio configuration object */
    #ratio = null

    constructor() {
        super()
        if (VideoRecorder.instance) {
            return VideoRecorder.instance
        }
        VideoRecorder.instance = this
        __.recorder = this
    }

    /**
     * Public read-only information about the last recorded video.
     * @returns {{blob: Blob|null, size: number, duration: number, fps: number, quality: object, metadata: object,
     *     dimensions: object, ratio: any, sourceType: string}}
     */
    get videoData() {
        return {
            blob:       this.#blob,
            size:       this.#sizeBytes,
            duration:   this.#duration,
            fps:        this.#fps,
            quality:    this.#quality,
            metadata:   this.#metadata,
            dimensions: this.#dimensions,
            ratio:      this.#ratio,
            sourceType: this.#sourceType,
        }
    }

    /** @returns {boolean} True while recording is active and not paused */
    isRecording = () => this.#isRecording && !this.#isPaused

    /** @returns {boolean} True when recording is paused */
    isPaused = () => this.#isPaused

    /**
     * Initialise global recording parameters.
     * @param {Object} [options]
     * @param {number} [options.maxDuration=Infinity] Maximum duration in ms
     * @param {number} [options.maxSize=Infinity] Maximum size in bytes
     * @param {number} [options.fps] Frames per second
     * @param {number} [options.quality] Quality constant (QUALITY_*)
     * @param {number} [options.timeslice=1000] INFO event interval in ms
     * @param {Record<string, any>} [options.metadata] MP4 container metadata
     * @param {{width: number, height: number}} [options.dimensions]
     * @param {any} [options.ratio]
     */
    initialize = ({
                      maxDuration = Infinity,
                      maxSize = Infinity,
                      fps = this.#fps,
                      quality = this.#quality.value,
                      timeslice = SECOND,
                      metadata = {},
                      dimensions = this.#dimensions,
                      ratio = null,
                  } = {}) => {
        if (this.#isRecording) {
            throw this.#error('Cannot initialize while recording')
        }

        this.#maxDuration = maxDuration
        this.#maxSize = maxSize
        this.#fps = VideoRecorder.FPS.includes(fps) ? fps : this.#fps
        this.#quality = VideoRecorder.QUALITY.find(q => q.value === quality) || this.#quality
        this.#timeslice = timeslice
        this.#metadata = {...metadata, date: new Date()}
        this.#dimensions = dimensions
        this.#ratio = ratio
    }

    /**
     * Set a ready-to-record canvas (recommended when using CanvasOverlayComposer).
     * @param {HTMLCanvasElement} canvas The final composited canvas.
     */
    setCanvas = (canvas) => {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw this.#error('Invalid canvas')
        }
        if (this.#isRecording) {
            throw this.#error('Cannot change source while recording')
        }

        this.#cleanupSource()
        this.#outputCanvas = canvas
        this.#outputCtx = canvas.getContext('2d', {alpha: false})
        this.#sourceType = 'canvas'
        this.#dimensions = {width: canvas.width, height: canvas.height}

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {type: 'canvas', canvas, ...this.#dimensions},
        }))
    }

    /**
     * Set a MediaStream as source (webcam, screen-share, etc.).
     * @param {MediaStream} stream The stream to record.
     */
    setStream = async (stream) => {
        if (!(stream instanceof MediaStream)) {
            throw this.#error('Invalid MediaStream')
        }
        if (this.#isRecording) {
            throw this.#error('Cannot change source while recording')
        }

        this.#cleanupSource()

        this.#videoElement = document.createElement('video')
        this.#videoElement.srcObject = stream
        this.#videoElement.muted = true
        this.#videoElement.playsInline = true
        await this.#videoElement.play()

        const track = stream.getVideoTracks()[0]
        const s = track.getSettings()
        this.#dimensions = {width: s.width, height: s.height}

        this.#outputCanvas = document.createElement('canvas')
        this.#outputCanvas.width = s.width
        this.#outputCanvas.height = s.height
        this.#outputCtx = this.#outputCanvas.getContext('2d', {alpha: false})

        const draw = () => {
            if (this.#videoElement.readyState >= 2) {
                this.#outputCtx.drawImage(this.#videoElement, 0, 0)
            }
            this.#rafId = requestAnimationFrame(draw)
        }
        draw()

        this.#stream = stream
        this.#sourceType = 'stream'

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {type: 'stream', stream, ...this.#dimensions},
        }))
    }

    /** Start recording */
    start = async () => {
        if (this.#isRecording) {
            throw this.#error('Already recording')
        }
        if (!this.#outputCanvas) {
            throw this.#error('No source set')
        }

        this.#resetRecordingState()

        this.#output = new Output({
                                      format: new Mp4OutputFormat({fastStart: false}),
                                      target: new BufferTarget(),
                                  })

        await this.#output.setMetadataTags(this.#metadata)

        this.#videoSource = new CanvasSource(this.#outputCanvas, {
            codec:       'vp9',
            bitrate:     this.#quality.value,
            alpha:       'keep',
            latencyMode: 'realtime',
            width:       this.#outputCanvas.clientWidth || this.#outputCanvas.width / devicePixelRatio,
            height:      this.#outputCanvas.clientHeight || this.#outputCanvas.height / devicePixelRatio,
        })

        this.#output.addVideoTrack(this.#videoSource,
                                   {framerate: this.#fps, keyframeInterval: 10})
        this.#output.target.onwrite = (start, end) => (this.#sizeBytes += end - start)

        await this.#output.start()
        this.#setBodyClass(VideoRecorder.CLASSES.RECORDING)

        const frameMs = 1000 / this.#fps
        this.#frameInterval = setInterval(() => {
            if (this.#isPaused || !this.#videoSource) {
                return
            }

            const durationSec = this.#duration / 1000
            this.#videoSource.add(durationSec, 1 / this.#fps)
            this.#frameCount++
            this.#duration = this.#getCurrentDuration()
        }, frameMs)

        this.#infoInterval = setInterval(() => {
            this.#emitInfo()
            this.#checkLimits()
        }, this.#timeslice)

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.START))
    }

    /** Stop recording and produce the final Blob */
    stop = async () => {
        if (!this.#isRecording) {
            return
        }

        this.#clearIntervals()

        if (this.#videoSource) {
            await this.#videoSource.close()
        }
        if (this.#output) {
            await this.#output.finalize()
            this.#blob = new Blob([this.#output.target.buffer], {type: 'video/mp4'})
            this.#sizeBytes = this.#blob.size
        }

        this.#isRecording = false
        this.#removeBodyClass()

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.STOP, {detail: this.videoData}))
    }

    /** Cancel recording – no file is produced */
    cancel = async () => {
        this.#clearIntervals()
        if (this.#videoSource) {
            await this.#videoSource.close()
        }
        if (this.#output) {
            await (this.#output.abort?.() ?? this.#output.close?.())
        }

        this.#resetRecordingState()
        this.#isRecording = false
        this.#removeBodyClass()
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.CANCEL))
    }

    /** Pause current recording */
    pause = () => {
        if (!this.#isRecording || this.#isPaused) {
            return
        }
        this.#isPaused = true
        this.#accumulatedTime += performance.now() - this.#recordingBaseTime
        this.#setBodyClass(VideoRecorder.CLASSES.PAUSED)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.PAUSE))
    }

    /** Resume paused recording */
    resume = () => {
        if (!this.#isPaused) {
            return
        }
        this.#isPaused = false
        this.#recordingBaseTime = performance.now()
        this.#setBodyClass(VideoRecorder.CLASSES.RECORDING)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.RESUME))
    }

    /**
     * Download the recorded video.
     * @param {{filename?: string, type?: 'local'|'local-filesystem'}} [options]
     */
    download = async ({filename = this.filename(), type = 'local'} = {}) => {
        if (!this.#blob) {
            throw this.#error('No video to download')
        }

        const url = URL.createObjectURL(this.#blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filename}.mp4`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 100)

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
            detail: {filename, size: this.#blob.size, type},
        }))
    }

    /**
     * Generates a clean filename with an optional timestamp prefix.
     * @param {{filename?: string, useTimestamp?: boolean}} [options]
     * @param {string} [options.filename=APP_KEY] Base name.
     * @param {boolean} [options.useTimestamp=true] Prepend current date/time.
     * @returns {string} Filename without extension.
     */
    filename = ({filename = APP_KEY, useTimestamp = true} = {}) => {
        const base = String(filename).trim() || APP_KEY
        if (!useTimestamp) {
            return base
        }
        const stamp = DateTime.now().toFormat('yyyyLLdd-HHmmss')
        return `${stamp}-${base}`
    }

    /** Full cleanup – call when destroying the recorder */
    dispose = () => {
        this.cancel()
        this.#cleanupSource()
        this.#blob = null
        this.#removeBodyClass()
    }

    // ────────────────────────────── Private helpers ──────────────────────────────

    /** Reset all recording state variables */
    #resetRecordingState = () => {
        this.#isRecording = true
        this.#isPaused = false
        this.#startTime = performance.now()
        this.#recordingBaseTime = this.#startTime
        this.#accumulatedTime = 0
        this.#frameCount = 0
        this.#duration = 0
        this.#sizeBytes = 0
    }

    /** @returns {number} Current recorded duration in milliseconds */
    #getCurrentDuration = () => {
        if (!this.#isRecording) {
            return this.#duration
        }
        const elapsed = this.#isPaused ? 0 : performance.now() - this.#recordingBaseTime
        return this.#accumulatedTime + elapsed
    }

    /** Clear all timers and animation frames */
    #clearIntervals = () => {
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
        }
        if (this.#frameInterval) {
            clearInterval(this.#frameInterval)
        }
        if (this.#infoInterval) {
            clearInterval(this.#infoInterval)
        }
        this.#rafId = this.#frameInterval = this.#infoInterval = null
    }

    /** Stop MediaStream tracks and clean canvas references */
    #cleanupSource = () => {
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
        }
        if (this.#stream) {
            this.#stream.getTracks().forEach(t => t.stop())
        }
        if (this.#videoElement) {
            this.#videoElement.srcObject = null
        }
        this.#stream = this.#videoElement = this.#outputCanvas = this.#outputCtx = null
    }

    /** Emit periodic INFO event */
    #emitInfo = () => {
        this.#duration = this.#getCurrentDuration()
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.INFO, {
            detail: {
                duration: this.#duration,
                size:     this.#sizeBytes,
                fps:      this.#fps,
                isPaused: this.#isPaused,
            },
        }))
    }

    /** Check max duration / size limits */
    #checkLimits = () => {
        if (this.#duration >= this.#maxDuration) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_DURATION))
            this.stop()
        }
        else if (this.#sizeBytes >= this.#maxSize) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_SIZE))
            this.stop()
        }
    }

    /** Apply CSS class to document.body */
    #setBodyClass = (cls) => {
        document.body.classList.remove(VideoRecorder.CLASSES.RECORDING, VideoRecorder.CLASSES.PAUSED)
        document.body.classList.add(cls)
    }

    /** Remove recording CSS classes from document.body */
    #removeBodyClass = () => {
        document.body.classList.remove(VideoRecorder.CLASSES.RECORDING, VideoRecorder.CLASSES.PAUSED)
    }

    /**
     * Dispatch ERROR event and throw.
     * @param {string} msg Error message.
     * @returns {never}
     */
    #error = (msg) => {
        const err = new Error(msg)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {detail: {error: err}}))
        throw err
    }
}