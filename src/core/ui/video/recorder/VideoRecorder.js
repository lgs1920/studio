/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-04
 * Last modified: 2025-09-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoRecorder - Singleton class for recording canvas or media streams.
 * Emits CustomEvents defined in VideoRecorder.events.
 */
import { APP_KEY, LGS_PROJECT, SECOND } from '@Core/constants'
import axios                            from 'axios'
import { DateTime }                     from 'luxon'
import {
    BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_LOW, QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                                       from 'mediabunny'

export class VideoRecorder extends EventTarget {
    static events = {
        START:  'video/start',
        STOP:   'video/stop',
        INFO: 'video/info',
        PAUSE:  'video/pause',
        RESUME: 'video/resume',
        SOURCE: 'video/source',
        ERROR:  'video/error',
        DOWNLOAD: 'video/download',
        MAX_DURATION: 'video/max-duration',
    }

    static CLASSES = {
        RECORDING: 'recording-in-progress',
        PAUSED:    'recording-paused',
    }

    static QUALITY = [
        {value: QUALITY_LOW, name: 'Low Quality', short: 'L'},
        {value: QUALITY_MEDIUM, name: 'Medium Quality', short: 'M'},
        {value: QUALITY_HIGH, name: 'High Quality', short: 'H'},
        {value: QUALITY_VERY_HIGH, name: 'Very High Quality', short: 'V'},
    ]

    static FPS = [15, 30, 45, 60]
    static DEFAULT_FPS
    static DEFAULT_QUALITY

    #blob = null
    #output = null
    #videoSource = null
    #rafId = null
    #currentTimestamp = 0
    #isPaused = false
    #pausedTime = 0
    #lastPauseTime = 0
    #lastFrameTime = 0
    #lastCheckTime = 0
    #lastDrawTime = 0

    constructor() {
        if (VideoRecorder.instance) {
            return VideoRecorder.instance
        }
        super()

        this.stream = null
        this.fps = VideoRecorder.FPS[VideoRecorder.DEFAULT_FPS] || 30
        this.quality = VideoRecorder.QUALITY[VideoRecorder.DEFAULT_QUALITY] || {value: QUALITY_MEDIUM}
        this.timeslice = SECOND
        this.maxDuration = Infinity
        this.totalBytes = 0
        this.startTime = 0
        this.sourceType = 'unknown'
        this.outputCanvas = null
        this.outputCtx = null
        this.video = null

        VideoRecorder.instance = this
        // Ensure global __.recorder is set
        window.__ = window.__ || {}
        window.__.recorder = this
    }

    /**
     * Gets the recorded size in bytes.
     * @returns {number} Total bytes recorded.
     */
    get size() {
        return this.totalBytes
    }

    /**
     * Gets the recording duration in milliseconds, excluding paused time.
     * @returns {number} Duration in milliseconds.
     */
    get duration() {
        // Convert accumulated frames to milliseconds using FPS
        return Math.round((this.#currentTimestamp / this.fps) * SECOND)
    }

    /**
     * Initializes recording parameters and creates a default canvas if no stream is set.
     * @param {Object} [options] - Configuration options.
     * @param {number} [options.maxDuration=Infinity] - Maximum recording duration (ms).
     * @param {number} [options.fps=30] - Frames per second.
     * @param {number} [options.timeslice=1000] - Interval for INFO events (ms).
     * @param {number} [options.quality=QUALITY_MEDIUM] - Recording quality.
     * @throws {Error} If called during recording.
     */
    initialize({
                   maxDuration = this.maxDuration,
                   fps = this.fps,
                   timeslice = this.timeslice,
                   quality = this.quality,
               } = {}) {
        if (this.isRecording()) {
            throw this.#dispatchError('Cannot initialize while recording')
        }

        Object.assign(this, {
            maxDuration,
            fps,
            timeslice,
            quality: VideoRecorder.QUALITY.find(q => q.value === quality) || this.quality,
        })

        if (!this.stream) {
            this.outputCanvas = document.createElement('canvas')
            this.outputCanvas.width = 1280
            this.outputCanvas.height = 720
            this.outputCtx = this.outputCanvas.getContext('2d', {alpha: false})
            if (!this.outputCtx) {
                throw this.#dispatchError('2D context not supported')
            }

            this.outputCtx.fillStyle = 'black'
            this.outputCtx.fillRect(0, 0, 1280, 720)
            this.sourceType = 'canvas'
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
    setSource(canvases, {width, height, clipX = 0, clipY = 0, clipWidth, clipHeight} = {}) {
        if (!Array.isArray(canvases) || !canvases.length) {
            throw this.#dispatchError('At least one canvas required')
        }
        if (this.isRecording()) {
            throw this.#dispatchError('Cannot change source while recording')
        }

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

        this.outputCanvas = document.createElement('canvas')
        this.outputCanvas.width = outputWidth
        this.outputCanvas.height = outputHeight
        this.outputCtx = this.outputCanvas.getContext('2d', {alpha: false})
        if (!this.outputCtx) {
            throw this.#dispatchError('2D context not supported')
        }
        this.outputCtx.imageSmoothingEnabled = false

        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
        }
        const frameDuration = SECOND / this.fps
        this.#lastDrawTime = 0
        const draw = (currentTime) => {
            if (currentTime - this.#lastDrawTime < frameDuration) {
                this.#rafId = requestAnimationFrame(draw)
                return
            }
            this.#lastDrawTime = currentTime
            this.outputCtx.clearRect(0, 0, outputWidth, outputHeight)
            canvases.forEach(canvas => {
                this.outputCtx.drawImage(canvas, clipX / dpr, clipY / dpr, finalClipWidth / dpr, finalClipHeight / dpr, 0, 0, outputWidth, outputHeight)
            })
            this.#rafId = requestAnimationFrame(draw)
        }
        this.#rafId = requestAnimationFrame(draw)

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
            },
        }))
    }

    /**
     * Sets a MediaStream as the recording source.
     * @param {MediaStream} stream - Stream to record (e.g., webcam, screen).
     * @throws {TypeError} If stream is not a MediaStream.
     * @throws {Error} If called during recording.
     */
    async setStream(stream) {
        if (!(stream instanceof MediaStream)) {
            throw this.#dispatchError('Stream must be a MediaStream', TypeError)
        }
        if (this.isRecording()) {
            throw this.#dispatchError('Cannot change stream while recording')
        }

        this.video = document.createElement('video')
        this.video.srcObject = stream
        this.video.muted = true
        this.video.playsInline = true
        await this.video.play()

        const {width, height} = stream.getVideoTracks()[0].getSettings()
        this.outputCanvas = document.createElement('canvas')
        this.outputCanvas.width = width
        this.outputCanvas.height = height
        this.outputCtx = this.outputCanvas.getContext('2d', {alpha: false})
        if (!this.outputCtx) {
            throw this.#dispatchError('2D context not supported')
        }

        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
        }
        const frameDuration = SECOND / this.fps
        this.#lastDrawTime = 0
        const draw = (currentTime) => {
            if (currentTime - this.#lastDrawTime < frameDuration) {
                this.#rafId = requestAnimationFrame(draw)
                return
            }
            this.#lastDrawTime = currentTime
            this.outputCtx.drawImage(this.video, 0, 0, width, height)
            this.#rafId = requestAnimationFrame(draw)
        }
        this.#rafId = requestAnimationFrame(draw)

        this.stream = stream
        this.sourceType = 'stream'
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.SOURCE, {
            detail: {type: 'stream', timestamp: Date.now(), width, height},
        }))
    }

    /**
     * Checks if recording is active (not paused).
     * @returns {boolean} True if recording is active.
     */
    isRecording() {
        return !!this.#output && !this.#isPaused
    }

    /**
     * Starts recording and emits START event.
     * @throws {Error} If no source is set or recording fails.
     */
    async start() {
        if (this.isRecording()) {
            throw this.#dispatchError('Recording already in progress')
        }
        if (!this.outputCanvas) {
            throw this.#dispatchError('No source set')
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

            this.#output = new Output({format: new Mp4OutputFormat(), target: new BufferTarget()})
            this.#videoSource = new CanvasSource(this.outputCanvas, {
                codec:   'vp9',
                bitrate: this.quality.value,
                latencyMode: 'quality',
                keyFrameInterval: 5,
            })

            this.#output.addVideoTrack(this.#videoSource)
            await this.#output.start()
            document.body.classList.add(VideoRecorder.CLASSES.RECORDING)

            const frameDuration = SECOND / this.fps
            const frameLoop = (currentTime) => {
                if (!this.#output) {
                    return
                }

                // Skip frames while paused but keep RAF going
                if (this.#isPaused) {
                    this.#rafId = requestAnimationFrame(frameLoop)
                    return
                }

                if (currentTime - this.#lastFrameTime >= frameDuration) {
                    try {
                        // Encoder expects timestamps in SECONDS, not milliseconds
                        const ptsSec = this.#currentTimestamp / this.fps
                        const durSec = 1 / this.fps
                        this.#videoSource.add(ptsSec, durSec)

                        // Advance frame count and mark last frame time
                        this.#currentTimestamp += 1
                        this.#lastFrameTime = currentTime
                    }
                    catch (e) {
                        this.#dispatchError(e?.message || String(e))
                        return
                    }
                }

                // Periodic INFO updates and max-duration cutoff
                if (Date.now() - this.#lastCheckTime >= this.timeslice) {
                    this.#lastCheckTime = Date.now()
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.INFO, {
                        detail: {
                            timestamp: this.#lastCheckTime,
                            duration:  this.duration,
                            size:      this.totalBytes,
                            fps:       this.fps,
                            quality:   this.quality,
                        },
                    }))

                    if (this.duration >= this.maxDuration) {
                        this.dispatchEvent(new CustomEvent(VideoRecorder.events.MAX_DURATION, {
                            detail: {duration: this.duration},
                        }))
                        this.stop().catch(() => {
                        })
                        return
                    }
                }

                this.#rafId = requestAnimationFrame(frameLoop)
            }
            this.#rafId = requestAnimationFrame(frameLoop)
            this.dispatchEvent(new CustomEvent(VideoRecorder.events.START, {
                detail: {timestamp: this.startTime},
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
    async stop() {
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
            this.#rafId = null
        }
        if (this.#videoSource) {
            await this.#videoSource.close()
            this.#videoSource = null
        }
        if (this.#output && this.#output.state !== 'finalized') {
            await this.#output.finalize()
            this.#blob = this.#output.target?.buffer ? new Blob([this.#output.target.buffer], {type: 'video/mp4'}) : null
            this.totalBytes = this.#blob?.size || 0

            const metadata = {
                artist: lgs.servers.studio.name,
                date:   DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
                description: `Visit ${lgs.servers.site.protocol}://${lgs.servers.site.domain}`,
                album:  LGS_PROJECT,
                genre:  'Adventure',
            }

            this.dispatchEvent(new CustomEvent(VideoRecorder.events.STOP, {
                detail: {
                    blob:       this.#blob,
                    metadata,
                    duration:   this.duration,
                    totalBytes: this.totalBytes,
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
     * Pauses recording and emits PAUSE event.
     */
    pause() {
        if (!this.isRecording()) {
            return this.#dispatchError('Cannot pause: not recording')
        }
        this.#isPaused = true
        this.#lastPauseTime = Date.now()
        this.#setPauseBodyClasses()
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.PAUSE, {
            detail: {timestamp: Date.now(), duration: this.duration},
        }))
    }

    /**
     * Resumes paused recording and emits RESUME event.
     */
    resume() {
        if (!this.#isPaused) {
            return this.#dispatchError('Cannot resume: not paused')
        }
        this.#pausedTime += Date.now() - this.#lastPauseTime
        this.#isPaused = false
        this.#setRecordingBodyClasses()
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.RESUME, {
            detail: {timestamp: Date.now(), duration: this.duration},
        }))
    }

    /**
     * Downloads the recorded video.
     * @param {Object} [options] - Download options.
     * @param {string} [options.filename] - Filename without extension (defaults to timestamped name).
     * @param {string} [options.type='local'] - Download type ('local', 'local-filesystem', 'remote').
     * @param {string} [options.url] - URL for remote upload (required for 'remote').
     * @param {Object} [options.headers] - HTTP headers for remote upload.
     * @param {string} [options.path] - File path for local-filesystem download (kept for backward compatibility).
     * @throws {Error} If no recorded data, invalid type, or required options missing.
     */
    async download({
                       filename = (typeof this.filename === 'function' ? this.filename({}) : 'video'),
                       type = 'local',
                       url,
                       headers,
                       path,
                   } = {}) {
        if (!this.#blob) {
            throw this.#dispatchError('No recorded data to download')
        }

        const extFromType = (t) => {
            if (t === 'video/mp4') {
                return 'mp4'
            }
            if (t === 'video/webm') {
                return 'webm'
            }
            if (t === 'video/ogg') {
                return 'ogv'
            }
            return 'mp4'
        }
        const mime = this.#blob.type || 'video/mp4'
        const ext = extFromType(mime)
        const safeBase = String(filename || 'video').trim().replace(/[\/\\:*?"<>|]/g, '_')
        const finalFilename = safeBase.endsWith(`.${ext}`) ? safeBase : `${safeBase}.${ext}`

        const detailBase = {
            type:         this.sourceType,
            downloadType: type,
            timestamp:    Date.now(),
            filename:     finalFilename,
            size:         this.#blob.size,
            mime,
        }

        try {
            if (type === 'local') {
                const urlObj = URL.createObjectURL(this.#blob)
                const link = document.createElement('a')
                link.href = urlObj
                link.download = finalFilename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                setTimeout(() => URL.revokeObjectURL(urlObj), 2000)

                this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                    detail: {...detailBase, method: 'anchor'},
                }))
                return
            }

            if (type === 'local-filesystem') {
                // Prefer File System Access API if available
                if (typeof window.showSaveFilePicker === 'function') {
                    await this.#saveToLocalFileSystem(this.#blob, finalFilename, mime, (progress) => {
                        this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                            detail: {
                                ...detailBase,
                                stage:  'saving',
                                progress, // 0..1
                                method: 'fs-access',
                                // Backward-compat fields
                                blob: this.#blob,
                                path,
                            },
                        }))
                    })
                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                        detail: {
                            ...detailBase,
                            method: 'fs-access',
                            stage:  'done',
                            // Backward-compat fields
                            blob: this.#blob,
                            path,
                        },
                    }))
                    return
                }

                // Backward-compatible behavior: expose blob and path in the event for host environments
                if (!path || typeof path !== 'string') {
                    // No usable FS API and no valid path: fallback to classic download
                    const urlObj = URL.createObjectURL(this.#blob)
                    const link = document.createElement('a')
                    link.href = urlObj
                    link.download = finalFilename
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    setTimeout(() => URL.revokeObjectURL(urlObj), 2000)

                    this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                        detail: {...detailBase, method: 'anchor-fallback', requestedPath: path, blob: this.#blob, path},
                    }))
                    return
                }

                // If a host (e.g., Electron, native bridge) watches events to perform the write,
                // keep emitting the blob and desired path.
                this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                    detail: {...detailBase, method: 'host-path', blob: this.#blob, path},
                }))
                return
            }

            if (type === 'remote') {
                if (!url || typeof url !== 'string' || !/^https:\/\//i.test(url)) {
                    throw this.#dispatchError('Valid HTTPS URL required for remote download')
                }

                const formData = new FormData()
                formData.append('file', this.#blob, finalFilename)

                const response = await axios.post(url, formData, {
                    headers:          {
                        ...(headers || {}),
                        // Do not set Content-Type here; axios/FormData will set proper boundary.
                    },
                    onUploadProgress: (evt) => {
                        const total = evt.total ?? this.#blob.size
                        const progress = total ? evt.loaded / total : undefined
                        this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                            detail: {
                                ...detailBase,
                                stage:         'uploading',
                                method:        'remote',
                                url,
                                uploadedBytes: evt.loaded,
                                totalBytes:    total,
                                progress,
                            },
                        }))
                    },
                    withCredentials:  false,
                    timeout:          120000,
                })

                if (response?.status < 200 || response?.status >= 300) {
                    throw this.#dispatchError(`Remote upload failed: ${response?.status} ${response?.statusText || ''}`.trim())
                }

                this.dispatchEvent(new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                    detail: {
                        ...detailBase,
                        method: 'remote',
                        url,
                        stage:  'done',
                        status: response.status,
                        data:   response.data,
                    },
                }))
                return
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
     */
    async #saveToLocalFileSystem(blob, suggestedName, mime, onProgress) {
        const pickerOpts = {
            suggestedName,
            types: [{description: 'Video file', accept: {[mime]: [`.${suggestedName.split('.').pop()}`]}}],
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
    dispose() {
        if (this.#rafId) {
            cancelAnimationFrame(this.#rafId)
        }
        if (this.#videoSource) {
            this.#videoSource.close()
        }
        if (this.#output) {
            this.#output.finalize()
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
        }
        if (this.video) {
            this.video.pause()
        }
        if (this.#blob) {
            this.#blob = null
        }

        this.#output = null
        this.#videoSource = null
        this.#rafId = null
        this.stream = null
        this.video = null
        this.outputCanvas = null
        this.outputCtx = null
        this.totalBytes = 0
        this.startTime = 0
        this.sourceType = 'unknown'
        this.#pausedTime = 0
        this.#lastPauseTime = 0
        this.#lastFrameTime = 0
        this.#lastCheckTime = 0
        this.#lastDrawTime = 0
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
     * @param {string} message - Error message.
     * @param {Function} [ErrorType=Error] - Error constructor.
     * @returns {Error} The created error.
     * @private
     */
    #dispatchError(message, ErrorType = Error) {
        const error = new ErrorType(message)
        this.dispatchEvent(new CustomEvent(VideoRecorder.events.ERROR, {
            detail: {error, timestamp: Date.now()},
        }))
        return error
    }

    #cleanBodyClasses() {
        document.body.classList.remove(VideoRecorder.CLASSES.RECORDING, VideoRecorder.CLASSES.PAUSED)
    }

    #setPauseBodyClasses() {
        document.body.classList.remove(VideoRecorder.CLASSES.RECORDING)
        document.body.classList.add(VideoRecorder.CLASSES.PAUSED)
    }

    #setRecordingBodyClasses() {
        document.body.classList.remove(VideoRecorder.CLASSES.PAUSED)
        document.body.classList.add(VideoRecorder.CLASSES.RECORDING)
    }
}