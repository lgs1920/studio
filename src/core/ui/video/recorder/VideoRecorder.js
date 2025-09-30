/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-30
 * Last modified: 2025-09-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoRecorder - Singleton class for recording canvas or media streams.
 * Emits CustomEvents defined in VideoRecorder.events.
 */
import { APP_KEY, SECOND } from '@Core/constants'
import { DateTime }        from 'luxon'
import {
    BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_LOW, QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                          from 'mediabunny'

export class VideoRecorder extends EventTarget {
    /**
     * Custom events emitted by the VideoRecorder.
     * @type {Object.<string, string>}
     */
    static events = {
        START:     'video/start',
        STOP:      'video/stop',
        INFO:      'video/info',
        PAUSE:     'video/pause',
        RESUME:    'video/resume',
        SOURCE:    'video/source',
        ERROR:     'video/error',
        DOWNLOAD: 'video/download',
        MAX_DURATION: 'video/max-duration',
        MAX_SIZE:  'video/max-size',
        FINALIZE: 'video/finalize',
        CANCEL: 'video/cancel',
    }

    /**
     * CSS classes used to indicate recording state.
     * @type {Object.<string, string>}
     */
    static CLASSES = {
        RECORDING: 'recording-in-progress',
        PAUSED:    'recording-paused',
    }

    /**
     * Available quality settings for recording.
     * @type {Array.<{value: number, name: string, short: string}>}
     */
    static QUALITY = [
        {value: QUALITY_LOW, name: 'Low Quality', short: 'L'},
        {value: QUALITY_MEDIUM, name: 'Medium Quality', short: 'M'},
        {value: QUALITY_HIGH, name: 'High Quality', short: 'H'},
        {value: QUALITY_VERY_HIGH, name: 'Very High Quality', short: 'V'},
    ]

    /**
     * Available frame rates for recording.
     * @type {number[]}
     */
    static FPS = [15, 30, 45, 60]

    /**
     * Default frame rate index.
     * @type {number|undefined}
     */
    static DEFAULT_FPS

    /**
     * Default quality index.
     * @type {number|undefined}
     */
    static DEFAULT_QUALITY

    /**
     * Recorded video blob.
     * @private
     * @type {Blob|null}
     */
    #blob = null

    /**
     * Output instance for recording.
     * @private
     * @type {Output|null}
     */
    #output = null

    /**
     * Video source for recording.
     * @private
     * @type {CanvasSource|null}
     */
    #videoSource = null

    /**
     * Request animation frame ID.
     * @private
     * @type {number|null}
     */
    #rafId = null

    /**
     * Simplified timers for frame push and info updates.
     * @private
     * @type {number|null}
     */
    #frameTimer = null
    #infoTimer = null

    /**
     * Current frame timestamp (frame count).
     * @private
     * @type {number}
     */
    #currentTimestamp = 0

    /**
     * Whether recording is paused.
     * @private
     * @type {boolean}
     */
    #isPaused = false

    /**
     * Total paused time in milliseconds.
     * @private
     * @type {number}
     */
    #pausedTime = 0

    /**
     * Timestamp of the last pause.
     * @private
     * @type {number}
     */
    #lastPauseTime = 0

    /**
     * Timestamp of the last frame.
     * @private
     * @type {number}
     */
    #lastFrameTime = 0

    /**
     * Timestamp of the last INFO event check.
     * @private
     * @type {number}
     */
    #lastCheckTime = 0

    /**
     * Timestamp of the last canvas draw.
     * @private
     * @type {number}
     */
    #lastDrawTime = 0

    /**
     * Timestamp of the last write log.
     * @private
     * @type {number}
     */
    #lastWriteLogTime = 0

    /**
     * Recorded size in bytes.
     * @private
     * @type {number}
     */
    #size = 0

    /**
     * Recording duration in milliseconds.
     * @private
     * @type {number}
     */
    #duration = 0

    /**
     * Media stream for recording (e.g., webcam, screen).
     * @private
     * @type {MediaStream|null}
     */
    #stream = null

    /**
     * Frames per second for recording.
     * @private
     * @type {number}
     */
    #fps = VideoRecorder.FPS[VideoRecorder.DEFAULT_FPS] || 30

    /**
     * Recording quality settings.
     * @private
     * @type {{value: number, name: string, short: string}}
     */
    #quality = VideoRecorder.QUALITY[VideoRecorder.DEFAULT_QUALITY] || {value: QUALITY_MEDIUM}

    /**
     * Interval for INFO events in milliseconds.
     * @private
     * @type {number}
     */
    #timeslice = SECOND

    /**
     * Maximum recording duration in milliseconds.
     * @private
     * @type {number}
     */
    #maxDuration = Infinity

    /**
     * Maximum recording size in bytes.
     * @private
     * @type {number}
     */
    #maxSize = Infinity

    /**
     * Timestamp when recording started.
     * @private
     * @type {number}
     */
    #startTime = 0

    /**
     * User-provided metadata to embed in the output container.
     * @private
     * @type {Record<string, any>}
     */
    #metadata = {}

    /**
     * Type of recording source ('canvas' or 'stream').
     * @private
     * @type {string}
     */
    #sourceType = 'unknown'

    /**
     * Canvas used for rendering output.
     * @private
     * @type {HTMLCanvasElement|null}
     */
    #outputCanvas = null

    /**
     * 2D rendering context for the output canvas.
     * @private
     * @type {CanvasRenderingContext2D|null}
     */
    #outputCtx = null

    /**
     * Video element for stream-based recording.
     * @private
     * @type {HTMLVideoElement|null}
     */
    #video = null

    /**
     * Initializes the singleton instance and sets default values.
     */
    constructor() {
        if (VideoRecorder.instance) {
            return VideoRecorder.instance
        }
        super()

        // Set singleton instance and expose globally
        VideoRecorder.instance = this
        __.recorder = this
    }

    /**
     * Gets the recorded size in bytes.
     * @returns {number} Total bytes recorded.
     */
    get size() {
        return this.#size
    }

    /**
     * Gets the recording duration in milliseconds, excluding paused time.
     * @returns {number} Duration in milliseconds.
     */
    get duration() {
        return this.#duration
    }

    /**
     * Initializes recording parameters and creates a default canvas if no stream is set.
     * @param {Object} [options] - Configuration options.
     * @param {number} [options.maxDuration=Infinity] - Maximum recording duration (ms).
     * @param {number} [options.fps=30] - Frames per second.
     * @param {number} [options.timeslice=1000] - Interval for INFO events (ms).
     * @param {number} [options.quality=QUALITY_MEDIUM] - Recording quality.
     * @param {number} [options.maxSize=Infinity] - Maximum recording size (bytes).
     * @param {Object} [options.metadata={}] - Container metadata tags (artist, album, date, description, genre, ...).
     * @throws {Error} If called during recording.
     */
    initialize = ({
                      maxDuration = this.#maxDuration,
                      fps = this.#fps,
                      timeslice = this.#timeslice,
                      quality = this.#quality,
                      maxSize = this.#maxSize,
                      metadata = {},
                  } = {}) => {
        if (this.isRecording()) {
            throw this.#dispatchError('Cannot initialize while recording')
        }

        // Update recording parameters (use direct assignments; private fields cannot be set via Object.assign)
        this.#maxDuration = maxDuration
        this.#maxSize = maxSize
        this.#fps = fps
        this.#timeslice = timeslice
        this.#quality = VideoRecorder.QUALITY.find(q => q.value === quality) || this.#quality
        this.#metadata = metadata || {date: new Date()}

        if (!this.#stream) {
            // Create default canvas if no stream is set
            this.#outputCanvas = document.createElement('canvas')
            this.#outputCanvas.width = 1280
            this.#outputCanvas.height = 720
            this.#outputCtx = this.#outputCanvas.getContext('2d', {alpha: false})
            if (!this.#outputCtx) {
                throw this.#dispatchError('2D context not supported')
            }

            this.#outputCtx.fillStyle = 'black'
            this.#outputCtx.fillRect(0, 0, 1280, 720)
            this.#sourceType = 'canvas'
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
                detail: {type: 'canvas', timestamp: Date.now(), width: 1280, height: 720},
            }))
        }
    }

    /**
     * Sets canvas sources for recording, merging multiple canvases into a single stream.
     * @param {HTMLCanvasElement[]} canvases - Canvases to record.
     * @param {Object} [options] - Rendering options.
     * @param {number} [options.width] - Output width in physical pixels.
     * @param {number} [options.height] - Output height in physical pixels.
     * @param {number} [options.clipX=0] - Clipping region X-coordinate (physical pixels).
     * @param {number} [options.clipY=0] - Clipping region Y-coordinate (physical pixels).
     * @param {number} [options.clipWidth] - Clipping region width (physical pixels).
     * @param {number} [options.clipHeight] - Clipping region height (physical pixels).
     * @throws {Error} If canvases are invalid, recording is active, or clipping parameters are incorrect.
     */
    setSource = (canvases, {width, height, clipX = 0, clipY = 0, clipWidth, clipHeight} = {}) => {
        if (!Array.isArray(canvases) || !canvases.length) {
            throw this.#dispatchError('At least one canvas required')
        }
        if (this.isRecording()) {
            throw this.#dispatchError('Cannot change source while recording')
        }

        // Validate canvas clipping parameters
        const dpr = window.devicePixelRatio || 1
        canvases.forEach((canvas, i) => {
            const canvasWidth = canvas.width * dpr
            const canvasHeight = canvas.height * dpr
            const validatedClipWidth = clipWidth ?? canvasWidth
            const validatedClipHeight = clipHeight ?? canvasHeight
            if (clipX < 0 || clipY < 0 || validatedClipWidth <= 0 || validatedClipHeight <= 0 ||
                clipX + validatedClipWidth > canvasWidth || clipY + validatedClipHeight > canvasHeight) {
                throw this.#dispatchError(`Invalid clipping parameters for canvas ${i}`)
            }
        })

        const finalClipWidth = clipWidth ?? canvases[0].width * dpr
        const finalClipHeight = clipHeight ?? canvases[0].height * dpr
        const outputWidth = width ?? finalClipWidth
        const outputHeight = height ?? finalClipHeight

        // Initialize output canvas
        this.#outputCanvas = document.createElement('canvas')
        this.#outputCanvas.width = outputWidth
        this.#outputCanvas.height = outputHeight
        this.#outputCtx = this.#outputCanvas.getContext('2d', {alpha: false})
        if (!this.#outputCtx) {
            throw this.#dispatchError('2D context not supported')
        }
        this.#outputCtx.imageSmoothingEnabled = false

        // Stop any existing animation frame loop
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
        }

        // Start rendering loop for canvases
        const frameDuration = SECOND / this.#fps
        this.#lastDrawTime = 0
        const draw = (currentTime) => {
            if (currentTime - this.#lastDrawTime < frameDuration) {
                this.#rafId = requestAnimationFrame(draw)
                return
            }
            this.#lastDrawTime = currentTime
            this.#outputCtx.clearRect(0, 0, outputWidth, outputHeight)
            canvases.forEach(canvas => {
                this.#outputCtx.drawImage(canvas, clipX / dpr, clipY / dpr, finalClipWidth / dpr, finalClipHeight / dpr, 0, 0, outputWidth, outputHeight)
            })
            this.#rafId = requestAnimationFrame(draw)
        }
        this.#rafId = requestAnimationFrame(draw)

        this.#sourceType = 'canvas'
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {
                type: 'canvas',
                timestamp: Date.now(),
                width:  outputWidth,
                height: outputHeight,
                canvases,
                clipX,
                clipY,
                clipWidth:  finalClipWidth,
                clipHeight: finalClipHeight,
            },
        }))
    }

    /**
     * Sets a MediaStream as the recording source.
     * @param {MediaStream} stream - Stream to record (e.g., webcam, screen).
     * @throws {TypeError} If stream is not a MediaStream.
     * @throws {Error} If called during recording.
     */
    setStream = async (stream) => {
        if (!(stream instanceof MediaStream)) {
            throw this.#dispatchError('Stream must be a MediaStream', TypeError)
        }
        if (this.isRecording()) {
            throw this.#dispatchError('Cannot change stream while recording')
        }

        // Initialize video element for stream
        this.#video = document.createElement('video')
        this.#video.srcObject = stream
        this.#video.muted = true
        this.#video.playsInline = true
        await this.#video.play()

        const {width, height} = stream.getVideoTracks()[0].getSettings()
        this.#outputCanvas = document.createElement('canvas')
        this.#outputCanvas.width = width
        this.#outputCanvas.height = height
        this.#outputCtx = this.#outputCanvas.getContext('2d', {alpha: false})
        if (!this.#outputCtx) {
            throw this.#dispatchError('2D context not supported')
        }

        // Stop any existing animation frame loop
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
        }

        // Start rendering loop for video stream
        const frameDuration = SECOND / this.#fps
        this.#lastDrawTime = 0
        const draw = (currentTime) => {
            if (currentTime - this.#lastDrawTime < frameDuration) {
                this.#rafId = requestAnimationFrame(draw)
                return
            }
            this.#lastDrawTime = currentTime
            this.#outputCtx.drawImage(this.#video, 0, 0, width, height)
            this.#rafId = requestAnimationFrame(draw)
        }
        this.#rafId = requestAnimationFrame(draw)

        this.#stream = stream
        this.#sourceType = 'stream'
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {type: 'stream', timestamp: Date.now(), width, height},
        }))
    }

    /**
     * Checks if recording is active (not paused).
     * @returns {boolean} True if recording is active.
     */
    isRecording = () => {
        return !!this.#output && !this.#isPaused
    }

    /**
     * Starts recording and emits START event.
     * @throws {Error} If no source is set or recording fails.
     */
    start = async () => {
        if (this.isRecording()) {
            throw this.#dispatchError('Recording already in progress')
        }
        if (!this.#outputCanvas) {
            throw this.#dispatchError('No source set')
        }

        try {
            // Initialize recording state
            this.#size = 0
            this.#duration = 0
            this.#startTime = Date.now()
            this.#pausedTime = 0
            this.#lastPauseTime = 0
            this.#currentTimestamp = 0
            this.#isPaused = false
            this.#lastFrameTime = 0
            this.#lastCheckTime = 0
            this.#lastWriteLogTime = 0

            // Initialize output with MP4 format
            this.#output = new Output({
                                          format: new Mp4OutputFormat({fastStart: false}),
                                          target: new BufferTarget(),
                                      })

            // Apply user metadata before starting encoding
            await this.#setMetadata()

            // Configure video source
            this.#videoSource = new CanvasSource(this.#outputCanvas, {
                codec: 'vp9',
                bitrate: this.#quality.value,
                latencyMode: 'quality',
            })

            this.#output.addVideoTrack(this.#videoSource)

            // Track total bytes written in onwrite
            this.#output.target.onwrite = (start, end) => {
                this.#size += end - start
                const now = Date.now()
                if (now - this.#lastWriteLogTime >= this.#timeslice) {
                    this.#lastWriteLogTime = now
                }
            }

            await this.#output.start()
            this.#setRecordingBodyClasses()

            const frameDuration = Math.max(1, Math.floor(1000 / this.#fps))
            this.#frameTimer = window.setInterval(async () => {
                if (!this.#output) {
                    return
                }
                if (this.#isPaused) {
                    return
                }
                try {
                    // Let mediabunny handle timestamps; we just push a frame
                    await this.#videoSource.add(this.#currentTimestamp / this.#fps, 1 / this.#fps)
                    this.#currentTimestamp++
                    this.#duration = Math.round((this.#currentTimestamp / this.#fps) * SECOND)
                }
                catch (e) {
                    this.#dispatchError(e?.message || String(e))
                }
            }, frameDuration)

            // Periodic INFO updates and cutoff checks
            this.#infoTimer = window.setInterval(() => {
                if (!this.#output) {
                    return
                }
                const now = Date.now()
                this.#lastCheckTime = now
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.INFO, {
                    detail: {
                        timestamp: now,
                        duration:  this.#duration,
                        size:      this.#size,
                        fps:       this.#fps,
                        quality:   this.#quality,
                    },
                }))

                if (this.#duration >= this.#maxDuration) {
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_DURATION, {
                        detail: {timestamp: now, duration: this.#duration, max: this.#maxDuration},
                    }))
                    this.stop().catch(() => {
                    })
                }
                else if (this.#size >= this.#maxSize) {
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_SIZE, {
                        detail: {timestamp: now, size: this.#size, max: this.#maxSize},
                    }))
                    this.stop().catch(() => {
                    })
                }
            }, this.#timeslice)

            this.dispatchEvent(new CustomEvent(VideoRecorder.events.START, {
                detail: {timestamp: this.#startTime},
            }))
        }
        catch (error) {
            this.#cleanBodyClasses()
            throw this.#dispatchError(error.message)
        }
    }

    /**
     * Stops recording and emits STOP event with the recorded blob.
     */
    stop = async () => {
        // Stop animation frame loop
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
            this.#rafId = null
        }
        // Clear simplified timers
        if (this.#frameTimer !== null) {
            window.clearInterval(this.#frameTimer)
            this.#frameTimer = null
        }
        if (this.#infoTimer !== null) {
            window.clearInterval(this.#infoTimer)
            this.#infoTimer = null
        }

        // Close video source
        if (this.#videoSource) {
            await this.#videoSource.close()
            this.#videoSource = null
        }

        if (this.#output && this.#output.state !== 'finalized') {
            const start = Date.now()
            // Finalize output and create blob
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.FINALIZE, {
                detail: {
                    blob:      this.#blob,
                    metadata:  this.#metadata,
                    duration:  this.#duration,
                    size:      this.#size,
                    timestamp: start,
                },
            }))

            await this.#output.finalize()

            this.#blob = this.#output.target?.buffer ? new Blob([this.#output.target.buffer], {type: 'video/mp4'}) : null


            console.log('Finalized output', (Date.now() - start) / 1000)

            // Update size from blob as final check
            this.#size = this.#blob?.size || this.#size

            this.dispatchEvent(new CustomEvent(VideoRecorder.events.STOP, {
                detail: {
                    blob:       this.#blob,
                    metadata: this.#metadata,
                    duration:   this.#duration,
                    size: this.#size,
                    timestamp:  Date.now(),
                },
            }))
            this.#output = null
        }
        else {
            this.#dispatchError('No active recording to stop')
        }
        this.#cleanBodyClasses()
    }

    /**
     * Cancels an ongoing recording without finalizing or producing any output.
     * - Does not emit STOP or FINALIZE
     * - Leaves the current source (canvas/stream) intact so recording can restart later
     * - Resets recording state and CSS classes
     */
    cancel = async () => {
        // Stop animation frame loop
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
            this.#rafId = null
        }
        // Clear timers
        if (this.#frameTimer !== null) {
            window.clearInterval(this.#frameTimer)
            this.#frameTimer = null
        }
        if (this.#infoTimer !== null) {
            window.clearInterval(this.#infoTimer)
            this.#infoTimer = null
        }

        // Close the current encoding video source
        if (this.#videoSource) {
            try {
                await this.#videoSource.close()
            }
            catch (_) {
            }
            this.#videoSource = null
        }

        // Abort/close the encoder output without finalize
        if (this.#output) {
            try {
                if (typeof this.#output.abort === 'function') {
                    await this.#output.abort()
                }
                else if (typeof this.#output.close === 'function') {
                    await this.#output.close()
                }
            }
            catch (_) {
            }
            this.#output = null
        }

        // Ensure no partial data remains
        this.#blob = null
        this.#size = 0
        this.#duration = 0
        this.#isPaused = false
        this.#lastFrameTime = 0
        this.#lastCheckTime = 0
        this.#lastWriteLogTime = 0
        this.#currentTimestamp = 0

        // Clean body classes
        this.#cleanBodyClasses()

        // Inform listeners that the recording was canceled
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.CANCEL, {
            detail: {timestamp: Date.now()},
        }))
    }

    /**
     * Pauses recording and emits PAUSE event.
     */
    pause = () => {
        if (!this.isRecording()) {
            return this.#dispatchError('Cannot pause: not recording')
        }
        this.#isPaused = true
        this.#lastPauseTime = Date.now()
        this.#setPauseBodyClasses()
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.PAUSE, {
            detail: {timestamp: Date.now(), duration: this.#duration},
        }))
    }

    /**
     * Resumes paused recording and emits RESUME event.
     */
    resume = () => {
        if (!this.#isPaused) {
            return this.#dispatchError('Cannot resume: not paused')
        }
        this.#pausedTime += Date.now() - this.#lastPauseTime
        this.#isPaused = false
        this.#setRecordingBodyClasses()
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.RESUME, {
            detail: {timestamp: Date.now(), duration: this.#duration},
        }))
    }

    /**
     * Downloads the recorded blob based on the specified type
     * @param {Object} options - Download options
     * @param {string} options.filename - Name of the file to download
     * @param {string} options.type - Download type ('local', 'local-filesystem', 'remote')
     * @param {string} [options.url] - URL for remote download
     * @param {Object} [options.headers] - Headers for remote download
     * @param {string} [options.path] - Path for local-filesystem download
     * @returns {Promise<void>}
     */
    download = async ({
                          filename = this.filename({}),
                          type = 'local',
                          url,
                          headers,
                          path,
                      } = {}) => {
        // Validate blob existence
        if (!this.#blob) {
            throw this.#dispatchError('No recorded data to download')
        }

        const detailBase = {
            type:      this.#sourceType,
            download:  type,
            timestamp: Date.now(),
            filename:  filename.sanitize(),
            size:      this.#blob.size,
            duration:  this.#duration,
            mime:      this.#blob.type,
        }

        // Common anchor download logic
        const triggerAnchorDownload = (filename, extraDetail = {}) => {
            const urlObj = URL.createObjectURL(this.#blob)
            const link = document.createElement('a')
            link.href = urlObj
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            setTimeout(() => URL.revokeObjectURL(urlObj), 2000)
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                detail: {...detailBase, method, ...extraDetail},
            }))
        }

        try {
            if (type === 'local') {
                triggerAnchorDownload(filename.sanitize())
                return
            }

            if (type === 'local-filesystem') {
                // Prefer File System Access API if available
                if (typeof window.showSaveFilePicker === 'function') {
                    await this.#saveToLocalFileSystem(this.#blob, filename.sanitize(), this.#blob.type, (progress) => {
                        this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                            detail: {
                                ...detailBase,
                                progress, // 0..1
                                type,
                                path,
                            },
                        }))
                    })
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.AFTER_DOWNLOAD, {
                        detail: {
                            ...detailBase,
                            type,
                            path,
                        },
                    }))
                    return
                }

                // Fallback to anchor download if no valid path or FS API unavailable
                if (!path || typeof path !== 'string') {
                    triggerAnchorDownload(filename.sanitize())
                    return
                }
            }

            throw this.#dispatchError(`Invalid download type: ${type}`)
        }
        catch (error) {
            throw this.#dispatchError(error?.message || String(error))
        }
    }

    /**
     * Saves a blob using the File System Access API with progress reporting.
     * Falls back to a single write if streaming is not supported by the UA.
     * @private
     * @param {Blob} blob - The blob to save.
     * @param {string} filename - Suggested filename for saving.
     * @param {string} mime - MIME type of the file.
     * @param {Function} [onProgress] - Callback for reporting save progress.
     */
    #saveToLocalFileSystem = async (blob, filename, mime, onProgress) => {
        // Configure file picker options
        const pickerOpts = {
            suggestedName: filename,
            types:         [{description: 'Video file', accept: {[mime]: [`.${filename.split('.').pop()}`]}}],
        }
        const handle = await window.showSaveFilePicker(pickerOpts)
        const writable = await handle.createWritable()

        // Try streaming write when possible
        if ('stream' in blob && typeof blob.stream === 'function') {
            const reader = blob.stream().getReader()
            let written = 0
            while (true) {
                const {done, value} = await reader.read()
                if (done) {
                    break
                }
                await writable.write(value)
                written += value?.byteLength || 0
                if (typeof onProgress === 'function') {
                    onProgress(Math.min(1, written / blob.size))
                }
            }
            await writable.close()
            return
        }

        // Fallback: single write
        await writable.write(blob)
        if (typeof onProgress === 'function') {
            onProgress(1)
        }
        await writable.close()
    }

    /**
     * Cleans up resources and stops operations.
     */
    dispose = () => {
        // Stop animation frame loop
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
        }
        // Clear simplified timers
        if (this.#frameTimer !== null) {
            window.clearInterval(this.#frameTimer)
            this.#frameTimer = null
        }
        if (this.#infoTimer !== null) {
            window.clearInterval(this.#infoTimer)
            this.#infoTimer = null
        }

        // Close video source
        if (this.#videoSource) {
            this.#videoSource.close()
        }

        // Finalize output
        if (this.#output) {
            this.#output.finalize()
        }

        // Stop media stream tracks
        if (this.#stream) {
            this.#stream.getTracks().forEach(track => track.stop())
        }

        // Pause video element
        if (this.#video) {
            this.#video.pause()
        }

        // Reset blob
        if (this.#blob) {
            this.#blob = null
        }

        // Reset all properties
        this.#output = null
        this.#videoSource = null
        this.#rafId = null
        this.#stream = null
        this.#video = null
        this.#outputCanvas = null
        this.#outputCtx = null
        this.#size = 0
        this.#duration = 0
        this.#startTime = 0
        this.#sourceType = 'unknown'
        this.#pausedTime = 0
        this.#lastPauseTime = 0
        this.#lastFrameTime = 0
        this.#lastCheckTime = 0
        this.#lastDrawTime = 0
        this.#lastWriteLogTime = 0
        this.#cleanBodyClasses()
    }

    /**
     * Generates a filename with optional timestamp prefix.
     * @param {Object} [options] - Filename options.
     * @param {string} [options.filename=APP_KEY] - Base filename.
     * @param {boolean} [options.useTimestamp=true] - Include timestamp prefix.
     * @returns {string} Formatted filename without extension.
     */
    filename = ({filename = APP_KEY, useTimestamp = true}) => {
        const timestamp = useTimestamp ? DateTime.local().toFormat('yyyyLLddHHmm') : ''
        return `${timestamp}${timestamp ? '-' : ''}${filename}`
    }

    /**
     * Dispatches an ERROR event and returns the error.
     * @private
     * @param {string} message - Error message.
     * @param {Function} [ErrorType=Error] - Error constructor.
     * @returns {Error} The created error.
     */
    #dispatchError = (message, ErrorType = Error) => {
        const error = new ErrorType(message)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
            detail: {error, timestamp: Date.now()},
        }))
        return error
    }

    /**
     * Removes recording-related CSS classes from document body.
     * @private
     */
    #cleanBodyClasses = () => {
        document.body.classList.remove(VideoRecorder.CLASSES.RECORDING, VideoRecorder.CLASSES.PAUSED)
    }

    /**
     * Sets paused state CSS class on document body.
     * @private
     */
    #setPauseBodyClasses = () => {
        document.body.classList.remove(VideoRecorder.CLASSES.RECORDING)
        document.body.classList.add(VideoRecorder.CLASSES.PAUSED)
    }

    /**
     * Sets recording state CSS class on document body.
     * @private
     */
    #setRecordingBodyClasses = () => {
        document.body.classList.remove(VideoRecorder.CLASSES.PAUSED)
        document.body.classList.add(VideoRecorder.CLASSES.RECORDING)
    }

    /**
     * Apply container metadata to the output (called before starting the output).
     * @private
     * @returns {Promise<void>}
     */
    #setMetadata = async () => {
        if (!this.#output) {
            throw this.#dispatchError('Output not initialized for metadata')
        }

        try {
            await this.#output.setMetadataTags(this.#metadata)
        }
        catch (e) {
            // Non-fatal: report via ERROR event but continue
            this.#dispatchError(`Failed to set metadata: ${e?.message || String(e)}`)
        }
    }
}