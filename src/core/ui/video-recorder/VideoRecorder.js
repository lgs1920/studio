/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-13
 * Last modified: 2025-07-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

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
     * @property {string} SIZE - Fired when new data is available
     * @property {string} PAUSE - Fired when recording is paused
     * @property {string} RESUME - Fired when recording resumes
     * @property {string} SOURCE - Fired when a new source is set
     * @property {string} ERROR - Fired on recording or download errors
     * @property {string} DOWNLOAD - Fired when a video is downloaded
     * @property {string} MAX_SIZE - Fired when maximum size limit is reached
     * @property {string} MAX_DURATION - Fired when maximum duration limit is reached
     */
    static events = {
        START:        'video/start',
        STOP:         'video/stop',
        SIZE:         'video/size',
        PAUSE:        'video/pause',
        RESUME:       'video/resume',
        SOURCE:       'video/source',
        ERROR:        'video/error',
        DOWNLOAD: 'video/download',
        MAX_SIZE:     'video/max-size',
        MAX_DURATION: 'video/max-duration',
    }

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
        this._mimeType = 'video/webm'
        this.filename = 'video' // Default filename
        this.fps = 24 // Default FPS optimized for Firefox
        this.bitrate = 4000000 // Default bitrate (4 Mbps) for performance
        this.timeslice = 200 // Default timeslice for SIZE events
        this.maxSize = Infinity
        this.maxDuration = Infinity
        this.mediaRecorder = null
        this.chunks = []
        this.totalBytes = 0
        this.startTime = 0
        this.stopRendering = null
        this.sourceType = 'unknown'
        this.needsRedraw = true // Flag to optimize canvas rendering

        VideoRecorder.instance = this
    }

    /**
     * Gets the total size recorded in bytes
     * @returns {number} Total bytes recorded
     */
    get size() {
        return this.totalBytes || 0
    }

    /**
     * Gets the elapsed time since recording started
     * @returns {number} Duration in milliseconds
     */
    get duration() {
        return this.startTime ? Date.now() - this.startTime : 0
    }

    /**
     * Gets the current recording MIME type
     * @returns {string} MIME type (e.g., 'video/webm', 'video/mp4')
     */
    get mimeType() {
        return this._mimeType
    }

    /**
     * Sets the MIME type for recording (must not be recording)
     * @param {string} value - MIME type (e.g., 'video/webm', 'video/mp4')
     * @throws {Error} If called while recording or if MIME type is not supported
     */
    set mimeType(value) {
        if (this.isRecording()) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot change MIME type while recording'), timestamp: Date.now()},
            }))
            throw new Error('Cannot change MIME type while recording')
        }
        if (!MediaRecorder.isTypeSupported(value)) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error(`MIME type ${value} is not supported`), timestamp: Date.now()},
            }))
            throw new Error(`MIME type ${value} is not supported`)
        }
        this._mimeType = value
    }

    /**
     * Initializes the recorder with configuration parameters
     * Creates a default 2D canvas stream if no stream is set
     * @param {(blob: Blob, duration: number) => void} onStop - Callback invoked when recording stops, receiving the
     *     recorded Blob and duration
     * @param {string} [mimeType='video/webm;codecs=vp9'] - MIME type for recording (e.g., 'video/webm', 'video/mp4')
     * @param {Object} [options] - Additional configuration options
     * @param {number} [options.maxSize=Infinity] - Maximum recording size in bytes
     * @param {number} [options.maxDuration=Infinity] - Maximum recording duration in milliseconds
     * @param {number} [options.fps=24] - Frames per second for the captured stream
     * @param {number} [options.bitrate=4000000] - Video bitrate in bits per second (default 4 Mbps)
     * @param {number} [options.timeslice=200] - Interval in milliseconds for periodic SIZE events
     * @param {string} [options.filename='video'] - Base filename for downloads (without date prefix or extension)
     * @throws {TypeError} If onStop is not a function
     * @throws {Error} If mimeType is not supported by MediaRecorder or if called while recording
     */
    initialize(onStop, mimeType = 'video/webm;codecs=vp9', {
        maxSize = Infinity,
        maxDuration = Infinity,
        fps = 24,
        bitrate = 4000000,
        timeslice = 200,
        filename = 'video',
    }                           = {}) {
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
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {
                    error:     new Error(`MIME type ${mimeType} is not supported, falling back to video/webm`),
                    timestamp: Date.now(),
                },
            }))
            mimeType = 'video/webm' // Fallback to default
        }

        this.onStop = onStop
        this._mimeType = mimeType
        this.maxSize = maxSize
        this.maxDuration = maxDuration
        this.fps = fps
        this.bitrate = bitrate
        this.timeslice = timeslice
        this.filename = filename

        if (!this.stream) {
            // Create a default 2D canvas stream
            const defaultCanvas = document.createElement('canvas')
            defaultCanvas.width = 1280
            defaultCanvas.height = 720
            const ctx = defaultCanvas.getContext('2d', {alpha: false})
            if (!ctx) {
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                    detail: {error: new Error('2D context not supported for default stream'), timestamp: Date.now()},
                }))
                throw new Error('2D context not supported for default stream')
            }

            // Clear canvas with black background
            ctx.fillStyle = 'black'
            ctx.fillRect(0, 0, defaultCanvas.width, defaultCanvas.height)

            this.stream = defaultCanvas.captureStream(this.fps)
            this.sourceType = 'canvas'
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
                detail: {type: 'canvas', timestamp: Date.now(), width: 1280, height: 720},
            }))
            this.stopRendering = () => {
            }
        }
    }

    /**
     * Sets canvas source(s) to be recorded. If multiple sources are provided, they are merged into a single stream
     * Uses 2D canvas context for rendering with clipping support
     * Note: For best quality, match output width/height to clipWidth/clipHeight and use 'video/webm;codecs=vp9' or
     * 'video/mp4'
     * @param {HTMLCanvasElement[]} canvases - Array of canvases to record
     * @param {Object} [options] - Configuration options
     * @param {number} [options.width] - Output width of the composite canvas (defaults to clipWidth)
     * @param {number} [options.height] - Output height of the composite canvas (defaults to clipHeight)
     * @param {number} [options.clipX=0] - X-coordinate of the top-left corner of the clipping region
     * @param {number} [options.clipY=0] - Y-coordinate of the top-left corner of the clipping region
     * @param {number} [options.clipWidth] - Width of the clipping region (defaults to canvas width)
     * @param {number} [options.clipHeight] - Height of the clipping region (defaults to canvas height)
     * @param {boolean} [options.preserveAlpha=false] - Preserve alpha channel in output canvas
     * @param {Function} [options.onNeedsRedraw] - Optional callback to signal when canvas needs redraw
     * @throws {Error} If no canvases are provided, recording is active, 2D context is not supported, or clipping
     *     parameters are invalid
     */
    setSource(canvases, {
        width,
        height,
        clipX = 0,
        clipY = 0,
        clipWidth,
        clipHeight,
        preserveAlpha = false,
        onNeedsRedraw,
    } = {}) {
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

        // Validate clipping parameters for all canvases
        canvases.forEach((canvas, i) => {
            clipWidth = clipWidth ?? canvas.width
            clipHeight = clipHeight ?? canvas.height
            if (clipX < 0 || clipY < 0 || clipWidth <= 0 || clipHeight <= 0 ||
                clipX + clipWidth > canvas.width || clipY + clipHeight > canvas.height) {
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                    detail: {error: new Error(`Invalid clipping parameters for canvas ${i}`), timestamp: Date.now()},
                }))
                throw new Error(`Invalid clipping parameters for canvas ${i}`)
            }
        })
        clipWidth = clipWidth ?? canvases[0].width
        clipHeight = clipHeight ?? canvases[0].height

        // Default output resolution to clipped region to avoid scaling
        width = width ?? clipWidth
        height = height ?? clipHeight

        // Stop any existing rendering loop
        this.stopRendering?.()
        this.stopRendering = null

        // Create output canvas for final stream
        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = width
        outputCanvas.height = height
        const outputCtx = outputCanvas.getContext('2d', {alpha: preserveAlpha})
        if (!outputCtx) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('2D context not supported'), timestamp: Date.now()},
            }))
            throw new Error('2D context not supported')
        }
        // Disable image smoothing for sharp rendering
        outputCtx.imageSmoothingEnabled = false

        // Render single or multiple canvases
        let rafId
        const draw = () => {
            if (!this.needsRedraw && onNeedsRedraw && !onNeedsRedraw()) {
                rafId = requestAnimationFrame(draw)
                return
            }
            this.needsRedraw = false
            outputCtx.clearRect(0, 0, width, height)
            if (canvases.length === 1) {
                // Single canvas with clipping
                outputCtx.drawImage(
                    canvases[0],
                    clipX, clipY, clipWidth, clipHeight, // Source region
                    0, 0, width, height, // Destination region
                )
            }
            else {
                // Multiple canvases arranged in a grid
                const cols = Math.ceil(Math.sqrt(canvases.length))
                const rows = Math.ceil(canvases.length / cols)
                const cellW = width / cols
                const cellH = height / rows

                canvases.forEach((canvas, i) => {
                    const x = (i % cols) * cellW
                    const y = Math.floor(i / cols) * cellH
                    outputCtx.drawImage(
                        canvas,
                        clipX, clipY, clipWidth, clipHeight,
                        x, y, cellW, cellH,
                    )
                })
            }
            rafId = requestAnimationFrame(draw)
        }

        draw()
        this.stopRendering = () => cancelAnimationFrame(rafId)

        this.stream = outputCanvas.captureStream(this.fps)
        this.sourceType = 'canvas'
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {
                type: 'canvas',
                timestamp: Date.now(),
                width,
                height,
                canvases,
                clipX,
                clipY,
                clipWidth,
                clipHeight,
                preserveAlpha,
            }
        }))
    }

    /**
     * Starts recording and emits START event
     * @throws {Error} If no active MediaStream is available or MediaRecorder fails
     */
    start() {
        if (this.isRecording()) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Recording already in progress'), timestamp: Date.now()},
            }))
            return
        }
        if (!this.stream || !this.stream.active) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('No active MediaStream available'), timestamp: Date.now()},
            }))
            throw new Error('No active MediaStream available')
        }

        try {
            this.chunks = []
            this.totalBytes = 0
            this.startTime = Date.now()

            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType:           this._mimeType,
                videoBitsPerSecond: this.bitrate,
            })

            this.mediaRecorder.ondataavailable = (e) => {
                // console.log('Data available:', e.data.size) // Debug log
                this.chunks.push(e.data)
                this.totalBytes += e.data.size
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.SIZE, {
                    detail: {totalBytes: this.totalBytes, chunkSize: e.data.size, timestamp: Date.now()},
                }))
            }

            this.mediaRecorder.onstop = () => {
                // console.log('MediaRecorder stopped') // Debug log
                const blob = new Blob(this.chunks, {type: this._mimeType})
                const duration = this.duration
                this.onStop?.(blob, duration)

                this.dispatchEvent(new CustomEvent(VideoRecorder.events.STOP, {
                    detail: {blob, duration, totalBytes: this.totalBytes},
                }))
            }

            this.mediaRecorder.onerror = (e) => {
                // console.log('MediaRecorder error:', e.error) // Debug log
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                    detail: {error: e.error, timestamp: Date.now()},
                }))
                this.stop()
            }

            // console.log('Starting MediaRecorder with bitrate:', this.bitrate, 'timeslice:', this.timeslice) // Debug
            // log
            this.mediaRecorder.start(this.timeslice)

            // Monitor size and duration limits
            const checkLimits = () => {
                if (!this.isRecording()) {
                    return
                }
                const currentTime = Date.now()
                if (this.totalBytes >= this.maxSize) {
                    // console.log('Max size reached:', this.totalBytes) // Debug log
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_SIZE, {
                        detail: {totalBytes: this.totalBytes, timestamp: currentTime},
                    }))
                    this.stop()
                }
                else if (this.duration >= this.maxDuration) {
                    // console.log('Max duration reached:', this.duration) // Debug log
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_DURATION, {
                        detail: {duration: this.duration, timestamp: currentTime},
                    }))
                    this.stop()
                }
                else {
                    setTimeout(checkLimits, 100)
                }
            }
            checkLimits()

            this.dispatchEvent(new CustomEvent(VideoRecorder.events.START, {
                detail: {timestamp: this.startTime},
            }))
        }
        catch (error) {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error, timestamp: Date.now()},
            }))
            throw error
        }
    }

    /**
     * Stops the recording and emits STOP event
     */
    stop() {
        if (this.isRecording()) {
            // console.log('Stopping recording') // Debug log
            this.mediaRecorder.stop()
        }
        else {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('No active recording to stop'), timestamp: Date.now()},
            }))
        }
    }

    /**
     * Pauses the recording and emits PAUSE event
     */
    pause() {
        if (this.isRecording()) {
            // console.log('Pausing recording') // Debug log
            this.mediaRecorder.pause()
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.PAUSE, {
                detail: {timestamp: Date.now(), duration: this.duration},
            }))
        }
        else {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot pause: not recording'), timestamp: Date.now()},
            }))
        }
    }

    /**
     * Resumes a paused recording and emits RESUME event
     */
    resume() {
        if (this.mediaRecorder?.state === 'paused') {
            // console.log('Resuming recording') // Debug log
            this.mediaRecorder.resume()
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.RESUME, {
                detail: {timestamp: Date.now(), duration: this.duration},
            }))
        }
        else {
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                detail: {error: new Error('Cannot resume: not paused'), timestamp: Date.now()},
            }))
        }
    }

    /**
     * Checks if recording is ongoing
     * @returns {boolean} True if recording is active
     */
    isRecording() {
        return this.mediaRecorder?.state === 'recording'
    }

    /**
     * Sets a MediaStream directly as the recording source
     * @param {MediaStream} stream - MediaStream to record (e.g., from webcam or screen)
     * @throws {TypeError} If stream is not a MediaStream
     * @throws {Error} If called while recording
     */
    setStream(stream) {
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

        this.stopRendering?.()
        this.stopRendering = null
        this.stream = stream
        this.sourceType = 'stream'

        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {type: 'stream', timestamp: Date.now()},
        }))
    }

    /**
     * Triggers a download of the recorded video and emits DOWNLOAD event
     * Uses format yyyymmddhhmmss-filename with extension based on MIME type
     */
    download() {
        try {
            if (!this.chunks.length) {
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
                    detail: {error: new Error('No recorded data to download'), timestamp: Date.now()},
                }))
                throw new Error('No recorded data to download')
            }
            const blob = new Blob(this.chunks, {type: this._mimeType})
            const ext = this._mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
            const now = new Date()
            const datePrefix = now.toISOString().replace(/[-:T.]/g, '').slice(0, 12) // yyyymmddhhmm
            const fullFilename = `${datePrefix}${now.getSeconds().toString().padStart(2, '0')}-${this.filename}.${ext}`
            const url = URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = url
            link.download = fullFilename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setTimeout(() => URL.revokeObjectURL(url), 2000)

            // console.log('Downloading:', fullFilename) // Debug log
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                detail: {
                    type:      this.sourceType,
                    timestamp: Date.now(),
                    filename:  fullFilename,
                    size:      blob.size,
                },
            }))
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
    dispose() {
        this.stop()
        this.stopRendering?.()
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
            this.stream = null
        }
        this.mediaRecorder = null
        this.chunks = []
        this.totalBytes = 0
        this.startTime = 0
        this.stopRendering = null
        this.sourceType = 'unknown'
        this.needsRedraw = true
    }
}