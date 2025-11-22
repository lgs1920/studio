/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-22
 * Last modified: 2025-11-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * VideoRecorder.js – Stable mediabunny recorder
 * Uses CanvasSource → BufferTarget → MP4
 * Forces even dimensions, 'avc' codec, no hardware acceleration
 * Real-time duration and size reporting via INFO event
 ******************************************************************************/

import { APP_KEY, SECOND } from '@Core/constants'
import { DateTime }        from 'luxon'
import {
    BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_LOW, QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                          from 'mediabunny'

/**
 * Singleton class responsible for screen/canvas/stream recording using mediabunny
 * @extends EventTarget
 */
export class VideoRecorder extends EventTarget {
    /** Event names dispatched by the recorder */
    static events = {
        START:    'video/start',
        STOP:     'video/stop',
        PAUSE:    'video/pause',
        RESUME:   'video/resume',
        INFO:     'video/info',
        SOURCE:   'video/source',
        ERROR:    'video/error',
        DOWNLOAD: 'video/download',
        CANCEL:   'video/cancel',
        MAX_DURATION: 'video/max-duration',
        MAX_SIZE: 'video/max-size',
    }

    /** Body classes applied during recording states */
    static CLASSES = {RECORDING: 'recording-in-progress', PAUSED: 'recording-paused'}

    /** Bitrate presets from mediabunny (in bits per second) */
    static QUALITY = [
        {value: QUALITY_LOW, name: 'Low Quality', short: 'L'},
        {value: QUALITY_MEDIUM, name: 'Medium Quality', short: 'M'},
        {value: QUALITY_HIGH, name: 'High Quality', short: 'H'},
        {value: QUALITY_VERY_HIGH, name: 'Very High Quality', short: 'V'},
    ]

    /** Supported output frame rates */
    static FPS = [15, 30, 45, 60]
    static DEFAULT_FPS_INDEX = 1
    static DEFAULT_QUALITY_INDEX = 2
    static instance

    // ─────────────────────── Private instance fields ───────────────────────
    #blob = null                    // Final Blob after finalize()
    #output = null                  // mediabunny Output instance
    #videoSource = null             // CanvasSource encoder instance
    #canvas = null                  // Offscreen canvas used as encoder input
    #ctx = null                     // 2D context of #canvas
    #stream = null                  // Reference to original MediaHandle (if source is stream)
    #videoElement = null            // Hidden <video> element for stream → canvas copy

    #rafId = null                   // requestAnimationFrame handle
    #infoInterval = null            // setInterval handle for INFO events

    #isRecording = false            // true when encoder is running
    #isPaused = false               // true when recording is paused
    #startTime = 0                  // performance.now() at last start/resume
    #pausedTime = 0                 // Total time spent in paused state (ms)
    #recordedDuration = 0           // Current recorded duration in seconds
    #sizeBytes = 0                  // Current encoded size in bytes (updated via onwrite)

    #fps = VideoRecorder.FPS[VideoRecorder.DEFAULT_FPS_INDEX]
    #quality = VideoRecorder.QUALITY[VideoRecorder.DEFAULT_QUALITY_INDEX]
    #maxDuration = Infinity         // Recording stops when reached (seconds)
    #maxSize = Infinity             // Recording stops when reached (bytes)
    #timeslice = SECOND             // Interval between INFO events (ms)
    #dimensions = {width: 1920, height: 1080}
    #sourceType = 'unknown'         // 'canvas' | 'stream'

    constructor() {
        super()
        if (VideoRecorder.instance) {
            return VideoRecorder.instance
        }
        VideoRecorder.instance = this
        __.recorder = this
    }

    /** Current recorded video metadata */
    get videoData() {
        return {
            blob:       this.#blob,
            size:       this.#sizeBytes,
            duration: this.#recordedDuration,
            fps:        this.#fps,
            quality:    this.#quality,
            dimensions: this.#dimensions,
            sourceType: this.#sourceType,
        }
    }

    /** @returns {boolean} true if actively recording (not paused) */
    isRecording = () => this.#isRecording && !this.#isPaused

    /** @returns {boolean} true if recording is currently paused */
    isPaused = () => this.#isPaused

    /**
     * Configure recording parameters
     * @param {Object} opts
     * @param {number} [opts.fps] - Frames per second (24, 30, or 60)
     * @param {number} [opts.quality] - Bitrate from QUALITY presets
     * @param {number} [opts.maxDuration] - Max duration in seconds
     * @param {number} [opts.maxSize] - Max file size in bytes
     * @param {number} [opts.timeslice] - INFO event interval in ms
     */
    initialize = ({
                      fps,
                      quality = QUALITY_HIGH,
                      maxDuration = Infinity,
                      maxSize = Infinity,
                      timeslice = SECOND,
                  } = {}) => {
        if (this.#isRecording) {
            throw this.#error('Cannot initialize while recording')
        }
        if (fps && VideoRecorder.FPS.includes(fps)) {
            this.#fps = fps
        }
        const q = VideoRecorder.QUALITY.find(i => i.value === quality)
        if (q) {
            this.#quality = q
        }
        this.#maxDuration = maxDuration
        this.#maxSize = maxSize
        this.#timeslice = timeslice
    }

    /**
     * Set canvas as input source
     * @param {HTMLCanvasElement} canvas
     */
    setCanvas = (canvas) => {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw this.#error('Invalid canvas')
        }
        if (this.#isRecording) {
            throw this.#error('Cannot change source while recording')
        }

        this.#canvas = canvas
        this.#ctx = canvas.getContext('2d', {alpha: false})
        this.#dimensions = this.#getEncoderSafeSize(canvas.width, canvas.height)
        this.#sourceType = 'canvas'

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {type: 'canvas', canvas, ...this.#dimensions},
        }))
    }

    /**
     * Set MediaStream as input source (webcam/screen share)
     * @param {MediaStream} stream
     */
    setStream = async (stream) => {
        if (!(stream instanceof MediaStream)) {
            throw this.#error('Invalid stream')
        }
        if (this.#isRecording) {
            throw this.#error('Cannot change source while recording')
        }

        this.#videoElement = document.createElement('video')
        this.#videoElement.srcObject = stream
        this.#videoElement.muted = true
        this.#videoElement.playsInline = true
        await this.#videoElement.play()

        const track = stream.getVideoTracks()[0]
        const settings = track.getSettings()
        this.#dimensions = this.#getEncoderSafeSize(settings.width, settings.height)

        this.#canvas = document.createElement('canvas')
        this.#canvas.width = this.#dimensions.width
        this.#canvas.height = this.#dimensions.height
        this.#ctx = this.#canvas.getContext('2d', {alpha: false})

        const copyFrame = () => {
            if (this.#videoElement.readyState >= 2) {
                this.#ctx.drawImage(this.#videoElement, 0, 0, this.#dimensions.width, this.#dimensions.height)
            }
            this.#rafId = requestAnimationFrame(copyFrame)
        }
        copyFrame()

        this.#stream = stream
        this.#sourceType = 'stream'
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {
                type: 'stream',
                stream, ...this.#dimensions,
            },
        }))
    }

    /** Begin encoding */
    start = async () => {
        if (this.#isRecording) {
            throw this.#error('Already recording')
        }
        if (!this.#canvas) {
            throw this.#error('No source set')
        }

        this.#reset()

        this.#output = new Output({
                                      format: new Mp4OutputFormat({fastStart: false}),
                                      target: new BufferTarget(),
                                  })

        await this.#output.setMetadataTags({})

        const safe = this.#dimensions

        this.#videoSource = new CanvasSource(this.#canvas, {
            codec:                'avc',                         // Required by mediabunny for H.264
            bitrate:              this.#quality.value,
            alpha:                'discard',
            latencyMode: 'realtime',
            hardwareAcceleration: 'no-preference', // Ensures compatibility
            width:                safe.width,
            height:               safe.height,
        })

        this.#output.addVideoTrack(this.#videoSource, {framerate: this.#fps})

        // Real-time size tracking from BufferTarget
        this.#output.target.onwrite = (_, end) => {
            this.#sizeBytes = end
        }

        await this.#output.start()

        this.#isRecording = true
        this.#startTime = performance.now()
        document.body.classList.add(VideoRecorder.CLASSES.RECORDING)
        this.#recordFrame()

        this.#infoInterval = setInterval(() => {
            this.#checkLimits()
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.INFO, {
                detail: {
                    duration: this.#recordedDuration,
                    size:     this.#sizeBytes,
                    fps:      this.#fps,
                    isPaused: this.#isPaused,
                },
            }))
        }, this.#timeslice)

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.START))
    }

    /** Encode next frame using precise timestamp */
    #recordFrame = () => {
        if (!this.#isRecording || this.#isPaused) {
            return
        }
        const now = performance.now()
        const elapsed = (now - this.#startTime - this.#pausedTime) / 1000
        this.#videoSource.add(elapsed, 1 / this.#fps)
        this.#recordedDuration = elapsed
        this.#rafId = requestAnimationFrame(this.#recordFrame)
    }

    /** Finalize MP4 and emit STOP */
    stop = async () => {
        if (!this.#isRecording) {
            return
        }
        this.#isRecording = false
        cancelAnimationFrame(this.#rafId)
        clearInterval(this.#infoInterval)
        if (this.#videoSource) {
            await this.#videoSource.close()
        }
        if (this.#output) {
            await this.#output.finalize()
            this.#blob = new Blob([this.#output.target.buffer], {type: 'video/mp4'})
            this.#sizeBytes = this.#blob.size
        }
        document.body.classList.remove(VideoRecorder.CLASSES.RECORDING, VideoRecorder.CLASSES.PAUSED)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.STOP, {detail: this.videoData}))
    }

    /** Pause encoding */
    pause = () => {
        if (!this.#isRecording || this.#isPaused) {
            return
        }
        this.#isPaused = true
        this.#pausedTime += performance.now() - this.#startTime
        document.body.classList.add(VideoRecorder.CLASSES.PAUSED)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.PAUSE))
    }

    /** Resume encoding after pause */
    resume = () => {
        if (!this.#isPaused) {
            return
        }
        this.#isPaused = false
        this.#startTime = performance.now()
        document.body.classList.remove(VideoRecorder.CLASSES.PAUSED)
        this.#recordFrame()
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.RESUME))
    }

    /** Abort recording and discard data */
    cancel = async () => {
        this.#isRecording = this.#isPaused = false
        cancelAnimationFrame(this.#rafId)
        clearInterval(this.#infoInterval)
        if (this.#videoSource) {
            await this.#videoSource.close()
        }
        if (this.#output) {
            await this.#output.abort?.()
        }
        this.#reset()
        document.body.classList.remove(VideoRecorder.CLASSES.RECORDING, VideoRecorder.CLASSES.PAUSED)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.CANCEL))
    }

    /**
     * Trigger browser download of recorded file
     * @param {Object} [options]
     * @param {string} [options.filename]
     */
    download = ({filename = this.filename()} = {}) => {
        if (!this.#blob) {
            throw this.#error('No video')
        }
        const url = URL.createObjectURL(this.#blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filename}.mp4`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 100)
    }

    /** Generate timestamped filename */
    filename = () => `${DateTime.now().toFormat('yyyyLLdd-HHmmss')}-${APP_KEY}`

    /** Reset all internal counters and references */
    #reset = () => {
        this.#blob = null
        this.#recordedDuration = 0
        this.#startTime = 0
        this.#pausedTime = 0
        this.#sizeBytes = 0
    }

    /** Enforce max duration and max size limits */
    #checkLimits = () => {
        if (this.#recordedDuration >= this.#maxDuration) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_DURATION))
            this.stop()
        }
        else if (this.#sizeBytes >= this.#maxSize) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_SIZE))
            this.stop()
        }
    }

    /** Ensure width and height are even (required by most encoders) */
    #getEncoderSafeSize = (w, h) => {
        const width = w - (w % 2) || 2
        const height = h - (h % 2) || 2
        return {width, height}
    }

    /**
     * Internal error handler – dispatches ERROR event then throws
     * @param {string} msg
     */
    #error = (msg) => {
        const err = new Error(msg)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {detail: {error: err}}))
        throw err
    }
}