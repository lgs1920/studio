/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-11
 * Last modified: 2025-07-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { fragmentShaderWebGL1, fragmentShaderWebGL2, vertexShaderWebGL1, vertexShaderWebGL2 } from './shaders.js'

/**
 * VideoRecorder - Singleton class to record canvas or media stream
 * Emits DOM CustomEvents: 'video/start', 'video/stop', 'video/size', 'video/pause',
 * 'video/resume', 'video/source', 'video/error', 'video/max-size', 'video/max-duration'
 */
export class VideoRecorder extends EventTarget {
    static #instance = null // Singleton instance
    // Private properties for recording state
    #stream = null // MediaStream for recording
    #onStop = null // Callback for stop event
    #_mimeType = 'video/webm;codecs=vp9' // MIME type for recording
    #maxSize = Infinity // Max size in bytes
    #maxDuration = Infinity // Max duration in milliseconds
    #bitrate = 12000000 // Video bitrate
    #filename = 'video' // Default filename
    #mediaRecorder = null // MediaRecorder instance
    #chunks = [] // Recorded data chunks
    #totalBytes = 0 // Total bytes recorded
    #startTime = 0 // Start timestamp
    #pausedTime = 0 // Paused time
    #lastPauseStart = 0 // Last pause start
    #stopRendering = null // Stops WebGL rendering
    #lastFrameTime = 0 // Last frame timestamp

    /**
     * Creates a VideoRecorder instance
     * Returns existing instance if already created
     */
    constructor() {
        // Enforce singleton pattern
        if (VideoRecorder.#instance) {
            return VideoRecorder.#instance
        }
        // Initialize EventTarget for custom events
        super()
        // Set singleton instance
        VideoRecorder.#instance = this
    }

    /**
     * Gets total bytes recorded
     * @returns {number} Bytes recorded
     */
    get size() {
        // Return current recorded size
        return this.#totalBytes || 0
    }

    /**
     * Gets recording duration, excluding paused time
     * @returns {number} Duration in milliseconds
     */
    get duration() {
        // Return 0 if not started
        if (!this.#startTime) {
            return 0
        }
        // Calculate elapsed time minus pauses
        const elapsed = Date.now() - this.#startTime - this.#pausedTime
        // Adjust for pause state
        const adjusted = this.#mediaRecorder?.state === 'paused' ? elapsed - (Date.now() - this.#lastPauseStart) : elapsed
        return Math.round(adjusted)
    }

    /**
     * Gets the recording MIME type
     * @returns {string} MIME type
     */
    get mimeType() {
        return this.#_mimeType
    }

    /**
     * Sets the MIME type for recording
     * @param {string} value - MIME type
     * @throws {Error} If recording or unsupported MIME type
     */
    set mimeType(value) {
        // Prevent changes during recording
        if (this.isRecording()) {
            throw new Error('Cannot change MIME type while recording')
        }
        // Validate MIME type
        if (!MediaRecorder.isTypeSupported(value)) {
            throw new Error(`MIME type ${value} is not supported`)
        }
        this.#_mimeType = value
    }

    /**
     * Checks if a canvas is a Cesium canvas
     * @param {HTMLCanvasElement} canvas - Canvas to check
     * @returns {boolean} True if Cesium canvas
     */
    #isCesiumCanvas(canvas) {
        // Validate canvas type
        if (!(canvas instanceof HTMLCanvasElement)) {
            return false
        }
        // Get WebGL context
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
        if (!gl) {
            return false
        }
        // Check Cesium-specific indicators
        const hasCesiumClass = canvas.classList.contains('cesium-widget') ||
            canvas.closest('.cesium-widget') !== null
        const hasViewer = window.lgs?.viewer?.canvas === canvas
        const hasCesiumGlobal = !!window.Cesium
        const extensions = gl.getSupportedExtensions()
        const hasCesiumExtensions = extensions.includes('EXT_color_buffer_float') ||
            extensions.includes('OES_texture_float')
        const renderer = gl.getParameter(gl.RENDERER)
        const isWebGLRenderer = renderer.includes('WebGL') || renderer.includes('WebKit')
        const hasCesiumProperties = window.lgs?.scene || window.lgs?.camera || window.lgs?.viewer?.scene?.render
        const hasNonStandardDimensions = canvas.width > 0 && canvas.height > 0 && (canvas.width % 2 !== 0 || canvas.height % 2 !== 0)
        return hasCesiumClass || hasViewer || hasCesiumGlobal || hasCesiumExtensions || isWebGLRenderer || hasCesiumProperties || hasNonStandardDimensions
    }

    /**
     * Initializes recorder with parameters
     * @param {(blob: Blob, duration: number) => void} onStop - Stop callback
     * @param {string} [mimeType='video/webm;codecs=vp9'] - MIME type
     * @param {Object} [options] - Configuration options
     * @throws {Error} If recording or invalid parameters
     */
    initialize(onStop, mimeType = 'video/webm;codecs=vp9', {
        maxSize = Infinity,
        maxDuration = Infinity,
        bitrate = 12000000,
        filename = 'video',
    }                           = {}) {
        // Prevent initialization during recording
        if (this.isRecording()) {
            throw new Error('Cannot initialize while recording')
        }
        // Validate onStop callback
        if (typeof onStop !== 'function') {
            throw new TypeError('onStop must be a function')
        }
        // Fallback to default MIME type if unsupported
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm'
        }
        // Set configuration
        this.#onStop = onStop
        this.#_mimeType = mimeType
        this.#maxSize = maxSize
        this.#maxDuration = maxDuration
        this.#bitrate = bitrate
        this.#filename = filename
        // Create default stream if none exists
        if (!this.#stream) {
            const defaultCanvas = document.createElement('canvas')
            defaultCanvas.width = 1280
            defaultCanvas.height = 720
            const gl = defaultCanvas.getContext('webgl2', {preserveDrawingBuffer: true, antialias: true})
            if (!gl) {
                throw new Error('WebGL2 not supported')
            }
            gl.clearColor(0, 0, 0, 1)
            gl.clear(gl.COLOR_BUFFER_BIT)
            this.#stream = defaultCanvas.captureStream(30) // Use 30 FPS for smoother default
            this.#stopRendering = () => {
            }
        }
    }

    /**
     * Sets canvas source(s) for recording
     * @param {HTMLCanvasElement[]} canvases - Canvases to record
     * @param {Object} [options] - Configuration options
     * @throws {Error} If invalid parameters or recording
     */
    setSource(canvases, {
        width,
        height,
        useWebGL = true,
        fps = 30, // Default to 30 FPS for smoother video
        clipX = 0,
        clipY = 0,
        clipWidth,
        clipHeight,
    } = {}) {
        // Validate input
        if (!Array.isArray(canvases) || canvases.length === 0) {
            throw new Error('At least one canvas required')
        }
        if (this.isRecording()) {
            throw new Error('Cannot change source while recording')
        }
        // Set default clipping dimensions
        clipWidth = clipWidth ?? canvases[0].width
        clipHeight = clipHeight ?? canvases[0].height
        // Validate clipping parameters
        canvases.forEach((canvas, i) => {
            if (clipX < 0 || clipY < 0 || clipWidth <= 0 || clipHeight <= 0 ||
                clipX + clipWidth > canvas.width || clipY + clipHeight > canvas.height) {
                throw new Error(`Invalid clipping parameters for canvas ${i}`)
            }
        })
        // Set output dimensions
        width = width ?? clipWidth
        height = height ?? clipHeight
        // Handle device pixel ratio
        const dpr = window.devicePixelRatio || 1
        // Create output canvas
        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = width * dpr
        outputCanvas.height = height * dpr
        const outputCtx = outputCanvas.getContext('2d', {alpha: false})
        if (!outputCtx) {
            throw new Error('2D context not supported')
        }
        outputCtx.scale(dpr, dpr)
        // Check if canvas is Cesium
        const isCesium = this.#isCesiumCanvas(canvases[0])
        // Create composition canvas for WebGL
        const compCanvas = document.createElement('canvas')
        compCanvas.width = clipWidth * dpr
        compCanvas.height = clipHeight * dpr
        const gl = compCanvas.getContext('webgl2', {preserveDrawingBuffer: true, antialias: true}) ||
            compCanvas.getContext('webgl', {preserveDrawingBuffer: true, antialias: true})
        if (!gl) {
            throw new Error('WebGL not supported')
        }
        // Determine WebGL version
        const isWebGL2 = gl instanceof WebGL2RenderingContext
        // Select appropriate shaders
        const vertexShaderSource = isWebGL2 ? vertexShaderWebGL2 : vertexShaderWebGL1
        const fragmentShaderSource = isWebGL2 ? fragmentShaderWebGL2 : fragmentShaderWebGL1
        // Create shader
        const createShader = (type, source) => {
            const shader = gl.createShader(type)
            gl.shaderSource(shader, source)
            gl.compileShader(shader)
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const log = gl.getShaderInfoLog(shader)
                gl.deleteShader(shader)
                throw new Error(`Shader compilation error: ${log}`)
            }
            return shader
        }
        // Create and link program
        const program = gl.createProgram()
        try {
            gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexShaderSource))
            gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentShaderSource))
            gl.linkProgram(program)
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(`Program linking error: ${gl.getProgramInfoLog(program)}`)
            }
            gl.useProgram(program)
        }
        catch (error) {
            throw error
        }
        // Set up position buffer
        const positionBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
        const positions = new Float32Array([-1, -1, -1, 1, 1, -1, 1, -1, -1, 1, 1, 1])
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
        const positionLocation = gl.getAttribLocation(program, 'a_position')
        gl.enableVertexAttribArray(positionLocation)
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
        // Set up texture coordinate buffer
        const texCoordBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
        const texCoords = new Float32Array([0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0])
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)
        const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')
        gl.enableVertexAttribArray(texCoordLocation)
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
        // Create texture
        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        if (isWebGL2) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, clipWidth * dpr, clipHeight * dpr, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        }
        // Calculate clipped texture coordinates
        const texX = clipX / canvases[0].width
        const texY = clipY / canvases[0].height
        const texWidth = clipWidth / canvases[0].width
        const texHeight = clipHeight / canvases[0].height
        const clippedTexCoords = new Float32Array([
                                                      texX, texY + texHeight,
                                                      texX, texY,
                                                      texX + texWidth, texY + texHeight,
                                                      texX + texWidth, texY + texHeight,
                                                      texX, texY,
                                                      texX + texWidth, texY,
                                                  ])
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, clippedTexCoords, gl.STATIC_DRAW)
        // Set up animation frame
        let rafId
        const raf = window.Cesium?.requestAnimationFrame ? window.Cesium.requestAnimationFrame : window.requestAnimationFrame
        // Target frame interval (ms)
        const frameInterval = 1000 / fps
        let lastFrameTime = performance.now()
        // Render loop
        const draw = (currentTime) => {
            // Validate canvas dimensions
            if (canvases[0].width === 0 || canvases[0].height === 0) {
                rafId = raf(draw)
                return
            }
            // Check WebGL context validity
            if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) {
                console.error('WebGL context error or lost')
                this.dispatchEvent(new CustomEvent('video/error', {
                    detail: {error: new Error('WebGL context error or lost'), timestamp: Date.now()},
                }))
                rafId = raf(draw)
                return
            }
            // Control FPS precisely
            const deltaTime = currentTime - lastFrameTime
            if (deltaTime < frameInterval) {
                rafId = raf(draw)
                return
            }
            lastFrameTime = currentTime - (deltaTime % frameInterval) // Align to frame interval
            // Render Cesium scene if applicable
            if (isCesium && window.lgs?.viewer?.scene?.render) {
                window.lgs.viewer.scene.render()
            }
            // Set up WebGL viewport
            gl.viewport(0, 0, clipWidth * dpr, clipHeight * dpr)
            gl.clearColor(0, 0, 0, 1)
            gl.clear(gl.COLOR_BUFFER_BIT)
            // Bind texture and draw
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texImage2D(gl.TEXTURE_2D, 0, isWebGL2 ? gl.RGBA8 : gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvases[0])
            gl.drawArrays(gl.TRIANGLES, 0, 6)
            // Draw to output canvas
            outputCtx.clearRect(0, 0, width, height)
            outputCtx.drawImage(compCanvas, 0, 0, width, height)
            // Schedule next frame
            rafId = raf(draw)
        }
        // Start rendering
        this.#lastFrameTime = performance.now()
        rafId = raf(draw)
        // Set cleanup function
        this.#stopRendering = () => {
            window.Cesium?.cancelAnimationFrame(rafId) || cancelAnimationFrame(rafId)
            gl.deleteTexture(texture)
            gl.deleteBuffer(positionBuffer)
            gl.deleteBuffer(texCoordBuffer)
            gl.deleteProgram(program)
        }
        // Set stream and emit event
        this.#stream = outputCanvas.captureStream(fps)
        // Verify stream tracks
        if (!this.#stream.getVideoTracks().length) {
            console.error('No video tracks in stream')
            this.dispatchEvent(new CustomEvent('video/error', {
                detail: {error: new Error('No video tracks in stream'), timestamp: Date.now()},
            }))
        }
        this.dispatchEvent(new CustomEvent('video/source', {
            detail: {
                type:      'canvas',
                timestamp: Date.now(),
                width,
                height,
                canvases,
                clipX,
                clipY,
                clipWidth,
                clipHeight,
            },
        }))
    }

    /**
     * Starts recording and emits 'video/start' event
     * @throws {Error} If no active stream or MediaRecorder fails
     */
    start() {
        // Prevent multiple recordings
        if (this.isRecording()) {
            return
        }
        // Ensure stream exists and is active
        if (!this.#stream || !this.#stream.active || !this.#stream.getVideoTracks().length) {
            const defaultCanvas = document.createElement('canvas')
            defaultCanvas.width = 1280
            defaultCanvas.height = 720
            const gl = defaultCanvas.getContext('webgl2', {preserveDrawingBuffer: true, antialias: true})
            if (!gl) {
                throw new Error('WebGL2 not supported')
            }
            gl.clearColor(0, 0, 0, 1)
            gl.clear(gl.COLOR_BUFFER_BIT)
            this.#stream = defaultCanvas.captureStream(30) // Use 30 FPS for smoother default
            this.#stopRendering = () => {
            }
        }
        try {
            // Clean up existing recorder
            if (this.#mediaRecorder) {
                this.#mediaRecorder.ondataavailable = null
                this.#mediaRecorder.onstop = null
                this.#mediaRecorder.onerror = null
                this.#mediaRecorder = null
            }
            // Reset state
            this.#chunks = []
            this.#totalBytes = 0
            this.#startTime = Date.now()
            this.#pausedTime = 0
            this.#lastPauseStart = 0
            // Initialize MediaRecorder
            this.#mediaRecorder = new MediaRecorder(this.#stream, {
                mimeType:           this.#_mimeType,
                videoBitsPerSecond: this.#bitrate,
            })
            // Handle data chunks
            this.#mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.#chunks.push(e.data)
                    this.#totalBytes += e.data.size
                    this.dispatchEvent(new CustomEvent('video/size', {
                        detail: {totalBytes: this.#totalBytes, chunkSize: e.data.size, timestamp: Date.now()},
                    }))
                }
            }
            // Handle stop event
            this.#mediaRecorder.onstop = () => {
                const blob = new Blob(this.#chunks, {type: this.#_mimeType})
                const duration = this.duration
                if (typeof this.#onStop === 'function' && blob.size > 0) {
                    this.#onStop(blob, duration)
                }
                this.dispatchEvent(new CustomEvent('video/stop', {
                    detail: {
                        blob,
                        duration,
                        totalBytes: this.#totalBytes,
                    },
                }))
            }
            // Handle errors
            this.#mediaRecorder.onerror = (e) => {
                console.error('MediaRecorder error:', e.error)
                this.dispatchEvent(new CustomEvent('video/error', {
                    detail: {error: e.error, timestamp: Date.now()},
                }))
                this.stop()
            }
            // Start recording with smaller chunk interval
            this.#mediaRecorder.start(100) // Collect chunks every 100ms for smoother capture
            // Monitor size and duration limits
            const checkLimits = () => {
                if (this.isRecording()) {
                    if (this.#totalBytes >= this.#maxSize) {
                        this.dispatchEvent(new CustomEvent('video/max-size', {
                            detail: {totalBytes: this.#totalBytes, timestamp: Date.now()},
                        }))
                        this.stop()
                    }
                    else if (this.duration > this.#maxDuration + 1000) {
                        this.dispatchEvent(new CustomEvent('video/max-duration', {
                            detail: {duration: this.duration, timestamp: Date.now()},
                        }))
                        this.stop()
                    }
                    else {
                        setTimeout(checkLimits, 100)
                    }
                }
            }
            checkLimits()
            // Emit size events periodically
            const emitSizeEvent = () => {
                if (this.isRecording()) {
                    this.dispatchEvent(new CustomEvent('video/size', {
                        detail: {totalBytes: this.#totalBytes, chunkSize: 0, timestamp: Date.now()},
                    }))
                    setTimeout(emitSizeEvent, 1000)
                }
            }
            emitSizeEvent()
            // Emit start event
            this.dispatchEvent(new CustomEvent('video/start', {
                detail: {timestamp: this.#startTime},
            }))
        }
        catch (error) {
            console.error('Failed to start recording:', error)
            this.dispatchEvent(new CustomEvent('video/error', {
                detail: {error, timestamp: Date.now()},
            }))
            throw error
        }
    }

    /**
     * Stops recording and emits 'video/stop' event
     */
    stop() {
        // Stop recording if active
        if (this.#mediaRecorder && (this.#mediaRecorder.state === 'recording' || this.#mediaRecorder.state === 'paused')) {
            const blob = new Blob(this.#chunks, {type: this.#_mimeType})
            const duration = this.duration
            this.#mediaRecorder.stop()
            // Trigger onStop callback
            if (typeof this.#onStop === 'function' && blob.size > 0) {
                this.#onStop(blob, duration)
            }
            // Emit stop event
            this.dispatchEvent(new CustomEvent('video/stop', {
                detail: {
                    blob,
                    duration,
                    totalBytes: this.#totalBytes,
                },
            }))
            // Clean up recorder
            this.#mediaRecorder.ondataavailable = null
            this.#mediaRecorder.onstop = null
            this.#mediaRecorder.onerror = null
            this.#mediaRecorder = null
            // Reset state
            this.#chunks = []
            this.#totalBytes = 0
            this.#startTime = 0
            this.#pausedTime = 0
            this.#lastPauseStart = 0
            // Clean up rendering
            this.#stopRendering?.()
            // Stop stream
            if (this.#stream) {
                this.#stream.getTracks().forEach(track => track.stop())
                this.#stream = null
            }
            this.#stopRendering = null
        }
    }

    /**
     * Pauses recording and emits 'video/pause' event
     */
    pause() {
        // Pause if recording
        if (this.isRecording()) {
            this.#lastPauseStart = Date.now()
            this.#mediaRecorder.pause()
            this.dispatchEvent(new CustomEvent('video/pause', {
                detail: {timestamp: Date.now(), duration: this.duration},
            }))
        }
    }

    /**
     * Resumes paused recording and emits 'video/resume' event
     */
    resume() {
        // Resume if paused
        if (this.#mediaRecorder?.state === 'paused') {
            this.#pausedTime += Date.now() - this.#lastPauseStart
            this.#mediaRecorder.resume()
            this.dispatchEvent(new CustomEvent('video/resume', {
                detail: {timestamp: Date.now(), duration: this.duration},
            }))
        }
    }

    /**
     * Checks if recording is active
     * @returns {boolean} True if recording
     */
    #isRecording() {
        return this.#mediaRecorder?.state === 'recording'
    }

    /**
     * Public method to check recording status
     * @returns {boolean} True if recording
     */
    isRecording() {
        return this.#isRecording()
    }

    /**
     * Sets a MediaStream as recording source
     * @param {MediaStream} stream - Stream to record
     * @throws {Error} If invalid stream or recording
     */
    setStream(stream) {
        // Validate stream
        if (!(stream instanceof MediaStream)) {
            throw new TypeError('stream must be a MediaStream')
        }
        if (this.isRecording()) {
            throw new Error('Cannot change stream while recording')
        }
        // Clean up existing rendering
        this.#stopRendering?.()
        this.#stopRendering = null
        // Set new stream
        this.#stream = stream
        // Verify stream tracks
        if (!this.#stream.getVideoTracks().length) {
            console.error('No video tracks in stream')
            this.dispatchEvent(new CustomEvent('video/error', {
                detail: {error: new Error('No video tracks in stream'), timestamp: Date.now()},
            }))
        }
        // Emit source event
        this.dispatchEvent(new CustomEvent('video/source', {
            detail: {type: 'stream', timestamp: Date.now()},
        }))
    }

    /**
     * Triggers download of recorded video
     * @param {string} [filename] - Output filename
     */
    download(filename = this.#filename) {

        const timestamped = () => {
            const now = new Date()
            const timestamp =
                      now.getFullYear().toString() +
                      String(now.getMonth() + 1).padStart(2, '0') +
                      String(now.getDate()).padStart(2, '0') +
                      String(now.getHours()).padStart(2, '0') +
                      String(now.getMinutes()).padStart(2, '0')

            return `${timestamp}-${this.#filename}`
        }


        // Create blob from chunks
        const blob = new Blob(this.#chunks, {type: this.#_mimeType})
        if (blob.size === 0) {
            return
        }
        // Generate download link
        const ext = this.#_mimeType.split('/')[1].split(';')[0] || 'webm'
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${timestamped()}.${ext}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        // Clean up URL
        setTimeout(() => URL.revokeObjectURL(url), 2000)
    }

    /**
     * Cleans up resources and stops operations
     */
    dispose() {
        // Stop recording and clean up
        this.stop()
        this.#stopRendering?.()
        if (this.#stream) {
            this.#stream.getTracks().forEach(track => track.stop())
            this.#stream = null
        }
        this.#mediaRecorder = null
        this.#chunks = []
        this.#totalBytes = 0
        this.#startTime = 0
        this.#pausedTime = 0
        this.#lastPauseStart = 0
        this.#stopRendering = null
        this.#lastFrameTime = 0
    }
}