/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-01
 * Last modified: 2025-09-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_PROJECT, SECOND } from '@Core/constants'
import { DateTime }            from 'luxon'
import {
    BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_LOW, QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                              from 'mediabunny'

/**
 * VideoRecorder - Singleton class to record canvas or media stream
 * Emits DOM CustomEvents defined in VideoRecorder.events
 */
export class VideoRecorder extends EventTarget {
    /**
     * Event names for recording lifecycle
     * @type {Object}
     * @property {string} START - Fired when recording starts
     * @property {string} STOP - Fired when recording stops
     * @property {string} INFO - Fired when new data is available
     * @property {string} PAUSE - Fired when recording is paused
     * @property {string} RESUME - Fired when recording resumes
     * @property {string} SOURCE - Fired when a new source is set
     * @property {string} ERROR - Fired on recording or download errors
     * @property {string} DOWNLOAD - Fired when a video is downloaded
     * @property {string} MAX_DURATION - Fired when maximum duration limit is reached
     */
    static events = {
        START:        'video/start',
        STOP:         'video/stop',
        INFO: 'video/info',
        PAUSE:        'video/pause',
        RESUME:       'video/resume',
        SOURCE:       'video/source',
        ERROR:        'video/error',
        DOWNLOAD: 'video/download',
        MAX_DURATION: 'video/max-duration',
    }

    static CLASSES = {
        recording: 'recording-in-progress',
        paused: 'recording-paused',
    }

    static QUALITY = {
        low:       {value: QUALITY_LOW, name: 'Low'},
        medium:    {value: QUALITY_MEDIUM, name: 'Medium'},
        high:      {value: QUALITY_HIGH, name: 'High'},
        very_high: {value: QUALITY_VERY_HIGH, name: 'Very High'},
    }
    static DEFAULT_QUALITY = VideoRecorder.QUALITY.medium

    static FPS = [15, 30, 45, 60]
    static DEFAULT_FPS = 1

    // Private fields for pause and frame loop management
    #pausedTime = 0
    #lastPauseTime = 0
    #output = null
    #videoSource = null
    #rafId = null
    #currentTimestamp = 0
    #isPaused = false
    #lastFrameTime = 0
    #lastCheckTime = 0

    /**
     * Creates a VideoRecorder instance
     * Use initialize() to configure recording parameters
     */
    constructor() {
        if (VideoRecorder.instance) {
            return VideoRecorder.instance
        }
        super()

        this.stream = null
        this.onStop = null
        this._mimeType = 'video/mp4'
        this.filename = 'video' // Default filename
        this.fps = VideoRecorder.FPS[VideoRecorder.DEFAULT_FPS]
        this.quality = VideoRecorder.QUALITY.medium.value
        this.timeslice = SECOND // Default timeslice for INFO events
        this.maxDuration = Infinity
        this.totalBytes = 0
        this.startTime = 0
        this.sourceType = 'unknown'
        this.outputCanvas = null
        this.outputCtx = null
        this.video = null

        VideoRecorder.instance = this
    }

    /**
     * Gets the total size recorded in bytes
     * @returns {number} Total bytes recorded (only accurate after stop in current version)
     */
    get size() {
        return this.totalBytes || 0
    }

    /**
     * Gets the elapsed recording time in milliseconds, excluding paused time
     * @returns {number} Effective duration in milliseconds
     */
    get duration() {
        return this.#currentTimestamp * SECOND
    }

    /**
     * Gets the current recording MIME type
     * @returns {string} MIME type ('video/mp4')
     */
    get mimeType() {
        return this._mimeType
    }

    /**
     * Sets the MIME type for recording (must not be recording)
     * @param {string} value - MIME type ('video/mp4')
     * @throws {Error} If called while recording or if MIME type is not 'video/mp4'
     */
    set mimeType(value) {
        if (this.isRecording()) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot change MIME type while recording'), timestamp: Date.now()},
            }))
            throw new Error('Cannot change MIME type while recording')
        }
        if (value !== 'video/mp4') {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Only video/mp4 is supported'), timestamp: Date.now()},
            }))
            throw new Error('Only video/mp4 is supported')
        }
        this._mimeType = value
    }

    /**
     * Initializes the recorder with configuration parameters
     * Creates a default 2D canvas if no stream is set
     * @param {(blob: Blob, duration: number) => void} onStop - Callback invoked when recording stops, receiving the
     *     recorded Blob and duration
     * @param {Object} [options] - Configuration options
     * @param {number} [options.maxDuration=Infinity] - Maximum recording duration in milliseconds
     * @param {number} [options.fps=30] - Frames per second for the captured stream
     * @param {number} [options.timeslice=1000] - Interval in milliseconds for periodic INFO events
     * @param {string} [options.filename='video'] - Base filename for downloads (without date prefix or extension)
     * @param {number} [options.quality=QUALITY_MEDIUM] - Recording quality (QUALITY_LOW, QUALITY_MEDIUM, QUALITY_HIGH)
     * @throws {TypeError} If onStop is not a function or quality is invalid
     * @throws {Error} If called while recording
     */
    initialize = (onStop, {
        maxDuration = this.maxDuration,
        fps = this.fps,
        timeslice = this.timeslice,
        filename = this.filename,
        quality = this.quality,
    } = {}) => {
        if (this.isRecording()) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot initialize while recording'), timestamp: Date.now()},
            }))
            throw new Error('Cannot initialize while recording')
        }
        if (typeof onStop !== 'function') {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new TypeError('onStop must be a function'), timestamp: Date.now()},
            }))
            throw new TypeError('onStop must be a function')
        }
        if (![QUALITY_LOW, QUALITY_MEDIUM, QUALITY_HIGH].includes(quality)) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new TypeError('Invalid quality value'), timestamp: Date.now()},
            }))
            throw new TypeError('Invalid quality value')
        }

        this.onStop = onStop
        Object.assign(this, {maxDuration, fps, timeslice, filename, quality})
        console.log(this)
        if (!this.stream) {
            // Create a default 2D canvas
            this.outputCanvas = document.createElement('canvas')
            this.outputCanvas.width = 1280
            this.outputCanvas.height = 720
            this.outputCtx = this.outputCanvas.getContext('2d', {alpha: false})
            if (!this.outputCtx) {
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                    detail: {error: new Error('2D context not supported for default stream'), timestamp: Date.now()},
                }))
                throw new Error('2D context not supported for default stream')
            }

            // Clear canvas with black background
            this.outputCtx.fillStyle = 'black'
            this.outputCtx.fillRect(0, 0, this.outputCanvas.width, this.outputCanvas.height)

            this.sourceType = 'canvas'
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
                detail: {type: 'canvas', timestamp: Date.now(), width: 1280, height: 720},
            }))
        }
    }

    /**
     * Sets canvas source(s) to be recorded. If multiple sources are provided, they are merged into a single stream
     * Uses 2D canvas context for rendering with clipping support
     * Note: Output canvas is set in physical pixels to preserve quality on high-DPI displays
     * Clipping parameters (clipX, clipY, clipWidth, clipHeight) are in physical pixels
     * For best quality, match output width/height to clipWidth/clipHeight
     * @param {HTMLCanvasElement[]} canvases - Array of canvases to record (dimensions in CSS pixels)
     * @param {Object} [options] - Configuration options
     * @param {number} [options.width] - Output width of the composite canvas in physical pixels (defaults to
     *     clipWidth)
     * @param {number} [options.height] - Output height of the composite canvas in physical pixels (defaults to
     *     clipHeight)
     * @param {number} [options.clipX=0] - X-coordinate of the top-left corner of the clipping region in physical
     *     pixels
     * @param {number} [options.clipY=0] - Y-coordinate of the top-left corner of the clipping region in physical
     *     pixels
     * @param {number} [options.clipWidth] - Width of the clipping region in physical pixels (defaults to canvas width
     *     * dpr)
     * @param {number} [options.clipHeight] - Height of the clipping region in physical pixels (defaults to canvas
     *     height * dpr)
     * @throws {Error} If no canvases are provided, recording is active, 2D context is not supported, or clipping
     *     parameters are invalid
     */
    setSource = (canvases, {
        width,
        height,
        clipX = 0,
        clipY = 0,
        clipWidth,
        clipHeight,
    } = {}) => {
        if (!Array.isArray(canvases) || canvases.length === 0) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('You must provide at least one canvas'), timestamp: Date.now()},
            }))
            throw new Error('You must provide at least one canvas')
        }
        if (this.isRecording()) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot change source while recording'), timestamp: Date.now()},
            }))
            throw new Error('Cannot change source while recording')
        }

        // Get device pixel ratio
        const dpr = window.devicePixelRatio || 1

        // Validate clipping parameters for all canvases in physical pixels
        canvases.forEach((canvas, i) => {
            const canvasWidth = canvas.width * dpr
            const canvasHeight = canvas.height * dpr
            const validatedClipWidth = clipWidth ?? canvasWidth
            const validatedClipHeight = clipHeight ?? canvasHeight
            if (clipX < 0 || clipY < 0 || validatedClipWidth <= 0 || validatedClipHeight <= 0 ||
                clipX + validatedClipWidth > canvasWidth || clipY + validatedClipHeight > canvasHeight) {
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                    detail: {
                        error:     new Error(`Invalid clipping parameters for canvas ${i}`),
                        timestamp: Date.now(),
                    }
                }))
                throw new Error(`Invalid clipping parameters for canvas ${i}`)
            }
        })

        // Default clip dimensions to first canvas in physical pixels
        const finalClipWidth = clipWidth ?? canvases[0].width * dpr
        const finalClipHeight = clipHeight ?? canvases[0].height * dpr

        // Default output resolution to clipped region in physical pixels
        const outputWidth = width ?? finalClipWidth
        const outputHeight = height ?? finalClipHeight

        // Create output canvas for final stream in physical pixels
        this.outputCanvas = document.createElement('canvas')
        this.outputCanvas.width = outputWidth
        this.outputCanvas.height = outputHeight
        this.outputCtx = this.outputCanvas.getContext('2d', {alpha: false})
        if (!this.outputCtx) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('2D context not supported'), timestamp: Date.now()},
            }))
            throw new Error('2D context not supported')
        }
        // Disable image smoothing for sharp rendering
        this.outputCtx.imageSmoothingEnabled = false

        // Render single or multiple canvases
        let rafId
        const draw = () => {
            this.outputCtx.clearRect(0, 0, outputWidth, outputHeight)
            canvases.forEach((canvas) => {
                this.outputCtx.drawImage(
                    canvas,
                    clipX / dpr, clipY / dpr, finalClipWidth / dpr, finalClipHeight / dpr,
                    0, 0, outputWidth, outputHeight,
                )
            })
            rafId = requestAnimationFrame(draw)
        }
        draw()

        this.sourceType = 'canvas'
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
            }
        }))
    }

    /**
     * Sets a MediaStream directly as the recording source, drawing to canvas for capture
     * @param {MediaStream} stream - MediaStream to record (e.g., from webcam or screen)
     * @throws {TypeError} If stream is not a MediaStream
     * @throws {Error} If called while recording
     */
    setStream = async (stream) => {
        if (!(stream instanceof MediaStream)) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new TypeError('stream must be a MediaStream'), timestamp: Date.now()},
            }))
            throw new TypeError('stream must be a MediaStream')
        }
        if (this.isRecording()) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot change stream while recording'), timestamp: Date.now()},
            }))
            throw new Error('Cannot change stream while recording')
        }

        this.video = document.createElement('video')
        this.video.srcObject = stream
        this.video.muted = true
        this.video.playsInline = true
        await this.video.play()

        const videoTrack = stream.getVideoTracks()[0]
        const {width, height} = videoTrack.getSettings()

        this.outputCanvas = document.createElement('canvas')
        this.outputCanvas.width = width
        this.outputCanvas.height = height
        this.outputCtx = this.outputCanvas.getContext('2d', {alpha: false})

        let rafId
        const draw = () => {
            this.outputCtx.drawImage(this.video, 0, 0, width, height)
            rafId = requestAnimationFrame(draw)
        }
        draw()

        this.stream = stream
        this.sourceType = 'stream'

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {type: 'stream', timestamp: Date.now(), width, height},
        }))
    }

    /**
     * Checks if recording is ongoing (not paused)
     * @returns {boolean} True if recording is active (not paused or inactive)
     */
    isRecording = () => {
        return !!this.#output && !this.#isPaused
    }

    /**
     * Starts recording and emits START event
     * @throws {Error} If no active source is available or recording fails
     */
    start = async () => {
        if (this.isRecording()) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Recording already in progress'), timestamp: Date.now()},
            }))
            return
        }
        if (!this.outputCanvas) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('No source set'), timestamp: Date.now()},
            }))
            throw new Error('No source set')
        }

        try {
            this.totalBytes = 0
            this.startTime = Date.now()
            this.#pausedTime = 0
            this.#lastPauseTime = 0
            this.#currentTimestamp = 0
            this.#isPaused = false
            this.#lastFrameTime = 0
            this.#lastCheckTime = 0

            this.#output = new Output({
                                          format: new Mp4OutputFormat(),
                                          target: new BufferTarget(),
                                      })

            this.#videoSource = new CanvasSource(this.outputCanvas, {
                codec:            'avc',
                bitrate:          this.quality,
                latencyMode:      'realtime',
                keyFrameInterval: 5,
            })

            this.#output.addVideoTrack(this.#videoSource)

            await this.#output.start()

            document.body.classList.add(VideoRecorder.CLASSES.recording)

            // Frame-based loop for adding frames and checking limits
            const frameDuration = SECOND / this.fps
            const frameLoop = async (currentTime) => {
                if (!this.#output || this.#isPaused) {
                    return
                }

                // Add frame if enough time has elapsed for the next frame
                if (currentTime - this.#lastFrameTime >= frameDuration) {
                    try {
                        await this.#videoSource.add(this.#currentTimestamp, frameDuration / SECOND)
                        this.#currentTimestamp += frameDuration / SECOND
                        this.#lastFrameTime = currentTime
                    }
                    catch (e) {
                        this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                            detail: {error: e, timestamp: Date.now()},
                        }))
                        this.stop()
                        return
                    }
                }

                // Check limits and emit INFO if timeslice has elapsed
                if (currentTime - this.#lastCheckTime >= this.timeslice) {
                    this.totalBytes = this.#output.target.buffer?.byteLength || 0
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.INFO, {
                        detail: {
                            totalBytes: this.totalBytes,
                            duration:   this.duration,
                            timestamp:  Date.now(),
                        },
                    }))

                    if (this.duration >= this.maxDuration) {
                        this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_DURATION, {
                            detail: {duration: this.duration, timestamp: Date.now()},
                        }))
                        this.stop()
                        return
                    }

                    this.#lastCheckTime = currentTime
                }

                this.#rafId = requestAnimationFrame(frameLoop)
            }

            this.#rafId = requestAnimationFrame(frameLoop)

            this.dispatchEvent(new CustomEvent(VideoRecorder.events.START, {
                detail: {timestamp: this.startTime},
            }))
        }
        catch (error) {
            this.cleanBodyClasses()
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error, timestamp: Date.now()},
            }))
            throw error
        }
    }

    /**
     * Stops the recording and emits STOP event
     */
    stop = async () => {
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
            this.#rafId = null
        }
        if (this.#videoSource) {
            await this.#videoSource.close()
            this.#videoSource = null
        }
        if (this.#output) {
            await this.#output.finalize()
            const buffer = this.#output.target.buffer
            const blob = new Blob([buffer], {type: this._mimeType})
            const duration = this.duration
            this.totalBytes = this.#output.target.buffer?.byteLength || 0
            const totalBytes = this.totalBytes

            const metadata = {
                artist:      lgs.servers.studio.name,
                date:        DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
                description: `Visit ${lgs.servers.site.protocol}://${lgs.servers.site.domain}`,
                album:       LGS_PROJECT,
                genre:       'Adventure',
            }

            this.onStop?.({blob, metadata, duration, totalBytes, timestamp: Date.now()})

            this.dispatchEvent(new CustomEvent(VideoRecorder.events.STOP, {
                detail: {blob, metadata, duration, totalBytes},
            }))

            // Destroy output
            this.#output = null
        }
        else {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('No active recording to stop'), timestamp: Date.now()},
            }))
        }

        this.cleanBodyClasses()
    }

    /**
     * Cleans the body classes to remove the recording indicators
     */
    cleanBodyClasses = () => {
        document.body.classList.remove(VideoRecorder.CLASSES.recording)
        document.body.classList.remove(VideoRecorder.CLASSES.paused)
    }

    /**
     * Sets body classes for paused state
     */
    setPauseBodyClasses = () => {
        document.body.classList.remove(VideoRecorder.CLASSES.recording)
        document.body.classList.add(VideoRecorder.CLASSES.paused)
    }

    /**
     * Sets body classes for recording state
     */
    setRecordingBodyClasses = () => {
        document.body.classList.remove(VideoRecorder.CLASSES.paused)
        document.body.classList.add(VideoRecorder.CLASSES.recording)
    }

    /**
     * Pauses the recording and emits PAUSE event
     */
    pause = () => {
        if (this.isRecording()) {
            this.#isPaused = true
            this.#lastPauseTime = Date.now()
            this.setPauseBodyClasses()
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.PAUSE, {
                detail: {timestamp: Date.now(), duration: this.duration},
            }))
        }
        else {
            this.cleanBodyClasses()
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot pause: not recording'), timestamp: Date.now()},
            }))
        }
    }

    /**
     * Resumes a paused recording and emits RESUME event
     */
    resume = () => {
        if (this.#isPaused) {
            this.#pausedTime += Date.now() - this.#lastPauseTime
            this.#isPaused = false
            this.setRecordingBodyClasses()
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.RESUME, {
                detail: {timestamp: Date.now(), duration: this.duration},
            }))
        }
        else {
            this.cleanBodyClasses()
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot resume: not paused'), timestamp: Date.now()},
            }))
        }
    }

    /**
     * Triggers a download of the recorded video and emits DOWNLOAD event
     * Supports local download (via link or UI-provided path) and remote upload via HTTP
     * Uses format yyyymmddhhmmss-filename with extension mp4
     * @param {Object} [targetOptions] - Download target options
     * @param {string} [targetOptions.type='local'] - Download type ('local', 'local-filesystem', 'remote')
     * @param {string} [targetOptions.url] - URL for remote upload (required if type is 'remote')
     * @param {Object} [targetOptions.headers] - HTTP headers for remote upload (e.g., { Authorization: 'Bearer token'
     *     })
     * @param {string} [targetOptions.path] - File path for local-filesystem (required if type is 'local-filesystem')
     * @throws {Error} If no recorded data, invalid target type, or required options are missing
     */
    download = async ({type = 'local', url, headers, path} = {}) => {
        try {
            if (!this.#output) {
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                    detail: {error: new Error('No recorded data to download'), timestamp: Date.now()},
                }))
                throw new Error('No recorded data to download')
            }

            const ext = 'mp4'
            const now = new Date()
            const datePrefix = now.toISOString().replace(/[-:T.]/g, '').slice(0, 12) // yyyymmddhhmm
            const fullFilename = `${datePrefix}${now.getSeconds().toString().padStart(2, '0')}-${this.filename}.${ext}`
            const detail = {
                type:         this.sourceType,
                downloadType: type,
                timestamp:    Date.now(),
                filename:     fullFilename,
            }

            const buffer = this.#output.target.buffer
            const blob = new Blob([buffer], {type: this._mimeType})

            if (type === 'local') {
                // Local download via link
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = fullFilename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                setTimeout(() => URL.revokeObjectURL(url), 2000)
                detail.size = blob.size
            }
            else if (type === 'local-filesystem') {
                // Local download with UI-provided path
                if (!path || typeof path !== 'string') {
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                        detail: {
                            error:     new Error('Path is required for local-filesystem download'),
                            timestamp: Date.now(),
                        },
                    }))
                    throw new Error('Path is required for local-filesystem download')
                }
                detail.blob = blob
                detail.path = path
                detail.size = blob.size
            }
            else if (type === 'remote') {
                // Remote upload using fetch
                if (!url || !url.startsWith('https://')) {
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                        detail: {
                            error:     new Error('Valid HTTPS URL required for remote download'),
                            timestamp: Date.now(),
                        },
                    }))
                    throw new Error('Valid HTTPS URL required for remote download')
                }
                const formData = new FormData()
                formData.append('file', blob, fullFilename)
                const response = await fetch(url, {
                    method:  'POST',
                    headers: headers || {},
                    body:    formData,
                })
                if (!response.ok) {
                    throw new Error(`Remote upload failed: ${response.status} ${response.statusText}`)
                }
                detail.size = blob.size
                detail.url = url
            }
            else {
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                    detail: {error: new Error(`Invalid download type: ${type}`), timestamp: Date.now()},
                }))
                throw new Error(`Invalid download type: ${type}`)
            }

            this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {detail}))
        }
        catch (error) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error, timestamp: Date.now()},
            }))
            throw error
        }
    }

    /**
     * Cleans up resources and stops any ongoing operations
     */
    dispose = () => {
        this.stop()
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
            this.stream = null
        }
        if (this.video) {
            this.video.pause()
            this.video = null
        }
        this.#output = null
        this.totalBytes = 0
        this.startTime = 0
        this.#pausedTime = 0
        this.#lastPauseTime = 0
        this.sourceType = 'unknown'
        this.outputCanvas = null
        this.outputCtx = null
    }
}