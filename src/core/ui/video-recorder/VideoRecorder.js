/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-08
 * Last modified: 2025-07-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoRecorder - Singleton class to record canvas or media stream
 * Emits DOM CustomEvents: 'video/start', 'video/stop', 'video/size', 'video/pause', 'video/resume', 'video/source',
 * 'video/error'
 */
export class VideoRecorder extends EventTarget {
    /**
     * Creates a VideoRecorder instance
     * @param {MediaStream|null} stream - Initial MediaStream to record (optional, can be set later with setStream or
     *     setSource)
     * @param {(blob: Blob, duration: number) => void} onStop - Callback invoked when recording stops, receiving the
     *     recorded Blob and duration
     * @param {string} [mimeType='video/webm'] - MIME type for recording (e.g., 'video/webm', 'video/mp4;codecs=vp9')
     * @param {Object} [options] - Additional configuration options
     * @param {number} [options.maxSize=Infinity] - Maximum recording size in bytes
     * @param {number} [options.maxDuration=Infinity] - Maximum recording duration in milliseconds
     * @throws {TypeError} If onStop is not a function or stream is not a MediaStream
     * @throws {Error} If mimeType is not supported by MediaRecorder
     */
    constructor(stream, onStop, mimeType = 'video/webm', {maxSize = Infinity, maxDuration = Infinity} = {}) {
        if (VideoRecorder.instance) {
            return VideoRecorder.instance
        }
        super()

        if (stream && !(stream instanceof MediaStream)) {
            throw new TypeError('stream must be a MediaStream')
        }
        if (typeof onStop !== 'function') {
            throw new TypeError('onStop must be a function')
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            throw new Error(`MIME type ${mimeType} is not supported`)
        }

        this.stream = stream
        this.onStop = onStop
        this._mimeType = mimeType
        this.maxSize = maxSize
        this.maxDuration = maxDuration
        this.mediaRecorder = null
        this.chunks = []
        this.totalBytes = 0
        this.startTime = 0
        this.stopRendering = null

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
     * @returns {string} MIME type (e.g., 'video/webm')
     */
    get mimeType() {
        return this._mimeType
    }

    /**
     * Sets the MIME type for recording (must not be recording)
     * @param {string} value - MIME type (e.g., 'video/webm', 'video/mp4;codecs=vp9')
     * @throws {Error} If called while recording or if MIME type is not supported
     */
    set mimeType(value) {
        if (this.isRecording()) {
            throw new Error('Cannot change MIME type while recording')
        }
        if (!MediaRecorder.isTypeSupported(value)) {
            throw new Error(`MIME type ${value} is not supported`)
        }
        this._mimeType = value
    }

    /**
     * Sets canvas source(s) to be recorded. If multiple canvases are provided, they are merged into a single stream.
     * @param {HTMLCanvasElement[]} canvases - Array of canvases to record
     * @param {Object} [options] - Configuration options
     * @param {number} [options.width=1280] - Output width of the composite canvas
     * @param {number} [options.height=720] - Output height of the composite canvas
     * @param {boolean} [options.useWebGL=true] - Use WebGL for rendering (if multiple canvases)
     * @param {number} [options.fps=30] - Frames per second for the captured stream
     * @throws {Error} If no canvases are provided, recording is active, or WebGL/2D context is not supported
     */
    setSource(canvases, {width = 1280, height = 720, useWebGL = true, fps = 30} = {}) {
        if (!Array.isArray(canvases) || canvases.length === 0) {
            throw new Error('You must provide at least one canvas')
        }
        if (this.isRecording()) {
            throw new Error('Cannot change source while recording')
        }

        // Stop any existing rendering loop
        this.stopRendering?.()
        this.stopRendering = null

        if (canvases.length === 1 && !useWebGL) {
            this.stream = canvases[0].captureStream(fps)
            this.dispatchEvent(new CustomEvent('video/source', {
                detail: {type: 'canvas', timestamp: Date.now(), width, height, canvases},
            }))
            return
        }

        const compCanvas = document.createElement('canvas')
        compCanvas.width = width
        compCanvas.height = height

        if (useWebGL) {
            const gl = compCanvas.getContext('webgl', {preserveDrawingBuffer: true})
            if (!gl) {
                throw new Error('WebGL not supported')
            }

            let rafId
            const draw = () => {
                gl.clearColor(0, 0, 0, 1)
                gl.clear(gl.COLOR_BUFFER_BIT)
                // TODO: Implement WebGL texture rendering for canvases
                rafId = requestAnimationFrame(draw)
            }

            draw()
            this.stopRendering = () => cancelAnimationFrame(rafId)
        }
        else {
            const ctx = compCanvas.getContext('2d', {alpha: false})
            if (!ctx) {
                throw new Error('2D context not supported')
            }

            let rafId
            const draw = () => {
                ctx.clearRect(0, 0, width, height)
                const cols = Math.ceil(Math.sqrt(canvases.length))
                const rows = Math.ceil(canvases.length / cols)
                const cellW = width / cols
                const cellH = height / rows

                canvases.forEach((c, i) => {
                    const x = (i % cols) * cellW
                    const y = Math.floor(i / cols) * cellH
                    ctx.drawImage(c, 0, 0, c.width, c.height, x, y, cellW, cellH)
                })

                rafId = requestAnimationFrame(draw)
            }

            draw()
            this.stopRendering = () => cancelAnimationFrame(rafId)
        }

        this.stream = compCanvas.captureStream(fps)
        this.dispatchEvent(new CustomEvent('video/source', {
            detail: {type: 'canvas', timestamp: Date.now(), width, height, canvases},
        }))
    }

    /**
     * Starts recording and emits 'video/start' event
     * @throws {Error} If no active MediaStream is available or MediaRecorder fails
     */
    start() {
        if (this.isRecording()) {
            return
        }
        if (!this.stream || !this.stream.active) {
            throw new Error('No active MediaStream available')
        }

        try {
            this.chunks = []
            this.totalBytes = 0
            this.startTime = Date.now()

            this.mediaRecorder = new MediaRecorder(this.stream, {mimeType: this._mimeType})

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.chunks.push(e.data)
                    this.totalBytes += e.data.size

                    this.dispatchEvent(new CustomEvent('video/size', {
                        detail: {totalBytes: this.totalBytes, chunkSize: e.data.size, timestamp: Date.now()},
                    }))
                }
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, {type: this._mimeType})
                const duration = this.duration
                this.onStop?.(blob, duration)

                this.dispatchEvent(new CustomEvent('video/stop', {
                    detail: {blob, duration, totalBytes: this.totalBytes},
                }))
            }

            this.mediaRecorder.onerror = (e) => {
                this.dispatchEvent(new CustomEvent('video/error', {
                    detail: {error: e.error, timestamp: Date.now()},
                }))
                this.stop()
            }

            this.mediaRecorder.start()

            // Monitor size and duration limits
            const checkLimits = () => {
                if (this.isRecording() && (this.totalBytes >= this.maxSize || this.duration >= this.maxDuration)) {
                    this.stop()
                }
                else if (this.isRecording()) {
                    setTimeout(checkLimits, 100)
                }
            }
            checkLimits()

            this.dispatchEvent(new CustomEvent('video/start', {
                detail: {timestamp: this.startTime},
            }))
        }
        catch (error) {
            this.dispatchEvent(new CustomEvent('video/error', {
                detail: {error, timestamp: Date.now()},
            }))
            throw error
        }
    }

    /**
     * Stops the recording and emits 'video/stop' event
     */
    stop() {
        if (this.isRecording()) {
            this.mediaRecorder.stop()
        }
    }

    /**
     * Pauses the recording and emits 'video/pause' event
     */
    pause() {
        if (this.isRecording()) {
            this.mediaRecorder.pause()
            this.dispatchEvent(new CustomEvent('video/pause', {
                detail: {timestamp: Date.now(), duration: this.duration},
            }))
        }
    }

    /**
     * Resumes a paused recording and emits 'video/resume' event
     */
    resume() {
        if (this.mediaRecorder?.state === 'paused') {
            this.mediaRecorder.resume()
            this.dispatchEvent(new CustomEvent('video/resume', {
                detail: {timestamp: Date.now(), duration: this.duration},
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
     */
    setStream(stream) {
        if (!(stream instanceof MediaStream)) {
            throw new TypeError('stream must be a MediaStream')
        }
        if (this.isRecording()) {
            throw new Error('Cannot change stream while recording')
        }

        this.stopRendering?.()
        this.stopRendering = null
        this.stream = stream

        this.dispatchEvent(new CustomEvent('video/source', {
            detail: {type: 'stream', timestamp: Date.now()},
        }))
    }

    /**
     * Triggers a download of the recorded video
     * @param {string} [filename='video'] - Base name for the file (extension inferred from MIME type)
     */
    download(filename = 'video') {
        const blob = new Blob(this.chunks, {type: this._mimeType})
        const ext = this._mimeType.split('/')[1].split(';')[0] || 'webm'
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url
        link.download = `${filename}.${ext}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setTimeout(() => URL.revokeObjectURL(url), 2000)
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
    }
}