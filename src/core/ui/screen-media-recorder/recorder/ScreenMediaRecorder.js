/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ScreenMediaRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-28
 * Last modified: 2026-04-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * VideoRecorder.js – Stable mediabunny recorder
 * Uses CanvasSource → BufferTarget → MP4
 * Forces even dimensions, 'avc' codec, no hardware acceleration
 * Real-time duration and size reporting via INFO event
 ******************************************************************************/
import { APP_KEY, NAVIGATOR, SECOND } from '@Core/constants'
import { DateTime }                   from 'luxon'
import {
    BufferTarget, CanvasSource, getFirstEncodableVideoCodec, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_MEDIUM,
    QUALITY_VERY_HIGH,
}                                     from 'mediabunny'

const INFO_INTERVAL_MS = 250

/**
 * Singleton class responsible for screen/canvas/stream recording using mediabunny
 * @extends EventTarget
 */
export class ScreenMediaRecorder extends EventTarget {
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
        FINALIZE: 'video/finalize',
        CAPTURED: 'video/captured',
        MAX_DURATION: 'video/max-duration',
        MAX_SIZE: 'video/max-size',
    }

    /** Body classes applied during recording states */
    static CLASSES = {RECORDING: 'recording-in-progress', PAUSED: 'recording-paused'}

    /** Bitrate presets from mediabunny (in bits per second) */
    static QUALITY = [
        // {value: QUALITY_LOW, name: 'Low Quality', short: 'L'},
        {value: QUALITY_MEDIUM, name: 'Medium Quality', short: 'M'},
        {value: QUALITY_HIGH, name: 'High Quality', short: 'H'},
        {value: QUALITY_VERY_HIGH, name: 'Ultra High Quality', short: 'V'},
    ]
    /** Supported output frame rates */
    static FPS = [30, 45, 60]

    /** Presets for video recording */
    static VIDEO_PRESETS = new Map([
                                       [
                                           'medium', {
                                           quality: 0,
                                           fps:     0,
                                           name:        'Med',
                                           description: 'Medium quality',
                                       },
                                       ],
                                       [
                                           'high', {
                                           quality: 1,
                                           fps:     1,
                                           name:        'High',
                                           description: 'Very High quality',
                                       },
                                       ],
                                       [
                                           'Ultra', {
                                           quality: 2,
                                           fps:     2,
                                           name:        'Ultra',
                                           description: 'Ultra High quality',
                                       },
                                       ],
                                       [
                                           'custom', {
                                           quality:     10,
                                           fps:         10,
                                           name:        'Flex',
                                           description: 'Define yours',
                                           submenu: true,
                                       },
                                       ],
                                   ])


    static DEFAULT_FPS_INDEX = 0
    static DEFAULT_QUALITY_INDEX = 0

    static instance
    static VIDEO = 'video'
    static IMAGE = 'image'

    // Private instance fields
    #blob = null
    #output = null
    #videoSource = null
    #canvas = null
    #ctx = null
    #stream = null
    #videoElement = null
    #rafId = null
    #infoInterval = null
    #isRecording = false
    #isPaused = false
    #startTime = 0
    #pausedTime = 0
    #recordedDuration = 0
    #sizeBytes = 0
    #fps = ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX]
    #quality = ScreenMediaRecorder.QUALITY[ScreenMediaRecorder.DEFAULT_QUALITY_INDEX]
    #maxDuration = Infinity
    #maxSize = Infinity
    #timeslice = SECOND
    #dimensions = {width: 1920, height: 1080}
    #videoCodec = null
    #sourceType = 'unknown'
    #metadata = null
    #ratio = null
    #type = null
    #snapshot
    #mimeType = 'video/mp4'
    #extension = 'mp4'
    #frameIntervalMs = 1000 / ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX]
    #frameIntervalSec = 1 / ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX]
    #nextFrameIndex = 0
    #frameLoopActive = false
    #frameWriteInFlight = false
    #encodedFrames = 0
    #currentFps = 0
    #lastInfoSampleTimeMs = null
    #lastInfoFrameCount = 0

    constructor() {
        super()
        if (ScreenMediaRecorder.instance) {
            return ScreenMediaRecorder.instance
        }
        ScreenMediaRecorder.instance = this
        __.recorder = this
    }

    /** Current recorded video metadata */
    get mediaData() {
        return {
            blob:     this.#blob,
            size:     this.#sizeBytes,
            duration: this.#recordedDuration * 1000, // Convert to milliseconds
            fps:      this.#fps,
            currentFps: this.#currentFps,
            quality:  this.#quality,
            codec:     this.#videoCodec,
            dimensions: this.#dimensions,
            ratio:    this.#ratio,
            sourceType: this.#sourceType,
            metadata: this.#metadata,
            mimeType:  this.#mimeType,
            extension: this.#extension,
        }
    }

    /** @returns {boolean} true if actively recording (not paused) */
    isRecording = () => this.#isRecording && !this.#isPaused

    /** @returns {boolean} true if recording is currently paused */
    isPaused = () => this.#isPaused

    get type() {
        return this.#type
    }

    set type(type) {
        this.#type = type
    }

    /**
     * Update quality preset (and encoder bitrate if possible).
     * Safe to call during recording; will no-op if not supported.
     * @param {number} index
     */
    setQualityIndex = (index) => {
        const q = ScreenMediaRecorder.QUALITY[index]
        if (!q) {
            return
        }
        this.#quality = q
        if (this.#videoSource && 'bitrate' in this.#videoSource) {
            try {
                this.#videoSource.bitrate = q.value
            }
            catch {
                // Ignore runtime bitrate adjustment failures.
            }
        }
    }

    async url() {
        if (!this.#blob) {
            if (this.isVideo()) {
                throw this.error('No video')
            }
            if (!(this.#snapshot instanceof HTMLCanvasElement)) {
                throw this.error('No snapshot')
            }
            this.#blob = await this.#canvasToBlob(this.#snapshot, 'image/png')
        }
        return {url: URL.createObjectURL(this.#blob), blob: this.#blob}
    }

    /**
     * Configure recording parameters
     */
    initialize = ({
                      fps,
                      quality = QUALITY_HIGH,
                      maxDuration = Infinity,
                      maxSize = Infinity,
                      timeslice = SECOND,
                      metadata = null,
                      ratio,
                  } = {}) => {
        if (this.#isRecording) {
            throw this.error('Cannot initialize while recording')
        }
        if (fps && ScreenMediaRecorder.FPS.includes(fps)) {
            this.#fps = fps
            this.#frameIntervalMs = 1000 / fps
            this.#frameIntervalSec = 1 / fps
        }
        const q = ScreenMediaRecorder.QUALITY.find(i => i.value === quality)
        if (q) {
            this.#quality = q
        }
        this.#maxDuration = maxDuration
        this.#maxSize = maxSize
        this.#timeslice = timeslice
        this.#metadata = {...(metadata || {date: new Date()})}
        this.#ratio = lgs.configuration.videoFormats.find(f => f.value === ratio)

    }

    /**
     * Set canvas as input source
     */
    setCanvas = (canvas) => {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw this.error('Invalid canvas')
        }
        if (this.#isRecording) {
            throw this.error('Cannot change source while recording')
        }
        this.#canvas = canvas
        this.#ctx = canvas.getContext('2d', {alpha: false, desynchronized: true})
        this.#dimensions = this.#getEncoderSafeSize(canvas.width, canvas.height)
        this.#sourceType = 'canvas'
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.SOURCE, {
            detail: {type: 'canvas', canvas, ...this.#dimensions},
        }))
    }

    /**
     * Set MediaStream as input source
     */
    setStream = async (stream) => {
        if (!(stream instanceof MediaStream)) {
            throw this.error('Invalid stream')
        }
        if (this.#isRecording) {
            throw this.error('Cannot change source while recording')
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
        this.#ctx = this.#canvas.getContext('2d', {alpha: false, desynchronized: true})

        const copyFrame = () => {
            if (this.#videoElement.readyState >= 2) {
                this.#ctx.drawImage(this.#videoElement, 0, 0, this.#dimensions.width, this.#dimensions.height)
            }
            this.#rafId = requestAnimationFrame(copyFrame)
        }
        copyFrame()

        this.#stream = stream
        this.#sourceType = 'stream'
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.SOURCE, {
            detail: {type: 'stream', stream, ...this.#dimensions},
        }))
    }

    #updateCurrentFps = (sampleTimeMs = performance.now()) => {
        if (!this.#isRecording || this.#isPaused) {
            this.#currentFps = 0
            this.#lastInfoSampleTimeMs = sampleTimeMs
            this.#lastInfoFrameCount = this.#encodedFrames
            return this.#currentFps
        }

        if (this.#lastInfoSampleTimeMs == null || sampleTimeMs <= this.#lastInfoSampleTimeMs) {
            this.#lastInfoSampleTimeMs = sampleTimeMs
            this.#lastInfoFrameCount = this.#encodedFrames
            return this.#currentFps
        }

        const frameDelta = this.#encodedFrames - this.#lastInfoFrameCount
        const durationDeltaSec = (sampleTimeMs - this.#lastInfoSampleTimeMs) / 1000

        if (frameDelta >= 0 && durationDeltaSec > 0) {
            this.#currentFps = frameDelta / durationDeltaSec
        }

        this.#lastInfoSampleTimeMs = sampleTimeMs
        this.#lastInfoFrameCount = this.#encodedFrames
        return this.#currentFps
    }

    #emitInfo = (durationMs = this.#recordedDuration * 1000) => {
        const currentFps = this.#updateCurrentFps()
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
            detail: {
                duration: durationMs,
                size:     this.#sizeBytes,
                fps:      this.#fps,
                currentFps,
                isPaused: this.#isPaused,
            },
        }))
    }

    #startMonitoring = () => {
        clearInterval(this.#infoInterval)
        const cadence = Math.max(100, Math.min(INFO_INTERVAL_MS, this.#timeslice))
        this.#infoInterval = setInterval(() => {
            if (!this.#isRecording) {
                return
            }
            this.#checkLimits()
            this.#emitInfo()
        }, cadence)
    }

    #scheduleNextFrame = () => {
        if (!this.#isRecording || this.#isPaused || this.#frameWriteInFlight) {
            this.#frameLoopActive = false
            return
        }
        this.#frameLoopActive = true
        this.#rafId = requestAnimationFrame(this.#processFrame)
    }

    /** Encode frames at the requested FPS while respecting encoder backpressure. */
    #processFrame = async () => {
        if (!this.#isRecording || this.#isPaused || !this.#videoSource) {
            this.#frameLoopActive = false
            return
        }

        const now = performance.now()
        const elapsedMs = now - this.#startTime + this.#pausedTime
        const dueFrameIndex = Math.floor(elapsedMs / this.#frameIntervalMs)

        if (dueFrameIndex < this.#nextFrameIndex) {
            this.#scheduleNextFrame()
            return
        }

        const frameIndex = dueFrameIndex
        this.#frameWriteInFlight = true

        try {
            await this.#videoSource.add(frameIndex / this.#fps, this.#frameIntervalSec)
            this.#encodedFrames += 1
            this.#nextFrameIndex = frameIndex + 1
            this.#recordedDuration = this.#nextFrameIndex * this.#frameIntervalSec
        }
        catch (error) {
            if (this.#isRecording) {
                console.error('[ScreenMediaRecorder] Frame encoding failed', error)
                this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.ERROR, {detail: {error}}))
            }
        }
        finally {
            this.#frameWriteInFlight = false
        }

        this.#scheduleNextFrame()
    }

    #stopScheduling = () => {
        this.#frameLoopActive = false
        cancelAnimationFrame(this.#rafId)
        clearInterval(this.#infoInterval)
    }

    #clearRuntimeReferences = () => {
        this.#videoSource = null
        this.#output = null
        this.#rafId = null
        this.#infoInterval = null
        this.#frameWriteInFlight = false
        this.#frameLoopActive = false
    }

    /** Pause encoding */
    pauseVideo = () => {
        if (!this.#isRecording || this.#isPaused) {
            return
        }

        const now = performance.now()
        const currentDuration = now - this.#startTime + this.#pausedTime

        this.#isPaused = true
        this.#pausedTime += now - this.#startTime

        this.#emitInfo(currentDuration)

        document.body.classList.add(ScreenMediaRecorder.CLASSES.PAUSED)
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.PAUSE))
    }

    /** Resume encoding after pause */
    resumeVideo = () => {
        if (!this.#isPaused) {
            return
        }

        this.#isPaused = false
        this.#startTime = performance.now()

        this.#emitInfo()

        document.body.classList.remove(ScreenMediaRecorder.CLASSES.PAUSED)
        if (!this.#frameLoopActive) {
            this.#scheduleNextFrame()
        }
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.RESUME))
    }

    isImage = () => this.#type === ScreenMediaRecorder.IMAGE
    isVideo = () => this.#type === ScreenMediaRecorder.VIDEO

    /** Abort recording and discard data */
    cancelVideo = async () => {
        this.#isRecording = this.#isPaused = false
        this.#stopScheduling()

        if (this.#videoSource) {
            await this.#videoSource.close()
        }

        if (this.#output) {
            await this.#output.cancel?.()
        }

        if (this.#stream) {
            this.#stream.getTracks().forEach(track => track.stop())
        }

        if (this.#videoElement) {
            this.#videoElement.pause?.()
            this.#videoElement.srcObject = null
        }

        this.#reset()
        this.#clearRuntimeReferences()
        document.body.classList.remove(ScreenMediaRecorder.CLASSES.RECORDING, ScreenMediaRecorder.CLASSES.PAUSED)
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.CANCEL))
    }

    /** Begin encoding */
    startVideo = async () => {
        if (this.#isRecording) {
            throw this.error('Already recording')
        }
        if (!this.#canvas) {
            throw this.error('No source set')
        }

        this.#reset()
        const safe = this.#dimensions
        const outputConfig = await this.#resolveVideoOutput(safe)
        if (!outputConfig) {
            throw this.error(`No supported video codec for ${safe.width}x${safe.height} on this browser.`)
        }
        const {codec, format, mimeType, extension} = outputConfig
        this.#videoCodec = codec
        this.#mimeType = mimeType
        this.#extension = extension
        this.#output = new Output({
                                      format,
                                      target: new BufferTarget(),
                                  })
        await this.#output.setMetadataTags(this.#metadata)
        this.#videoSource = new CanvasSource(this.#canvas, {
            codec,
            bitrate:              this.#quality.value,
            alpha:                'discard',
            latencyMode:          'realtime',
            hardwareAcceleration: 'no-preference',
            width:                safe.width,
            height:               safe.height,
        })

        const maximumPacketCount = Number.isFinite(this.#maxDuration)
                                   ? Math.ceil(this.#maxDuration * this.#fps) + this.#fps
                                   : undefined
        this.#output.addVideoTrack(this.#videoSource, {
            frameRate: this.#fps,
            ...(maximumPacketCount ? {maximumPacketCount} : {}),
        })
        this.#output.target.onwrite = (_, end) => {
            this.#sizeBytes = end
        }

        await this.#output.start()
        this.#isRecording = true
        this.#isPaused = false
        this.#startTime = performance.now()
        this.#pausedTime = 0
        this.#nextFrameIndex = 0
        document.body.classList.add(ScreenMediaRecorder.CLASSES.RECORDING)

        this.#emitInfo(0)
        this.#startMonitoring()
        this.#scheduleNextFrame()

        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
    }

    /**
     * Trigger browser download of recorded file
     */
    download = async ({filename = this.filename()} = {}) => {
        const url = (await this.url()).url

        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 100)
    }

    /** Generate timestamped filename */
    filename = () => `${DateTime.now().toFormat('yyyyLLdHHmm')}-${APP_KEY}`

    /** Reset all internal counters and references */
    #reset = () => {
        this.#blob = null
        this.#snapshot = null
        this.#videoCodec = null
        this.#mimeType = 'video/mp4'
        this.#extension = 'mp4'
        this.#recordedDuration = 0
        this.#startTime = 0
        this.#pausedTime = 0
        this.#sizeBytes = 0
        this.#nextFrameIndex = 0
        this.#frameWriteInFlight = false
        this.#frameLoopActive = false
        this.#encodedFrames = 0
        this.#currentFps = 0
        this.#lastInfoSampleTimeMs = null
        this.#lastInfoFrameCount = 0
    }

    /** Enforce max duration and max size limits */
    #checkLimits = () => {
        if (this.#recordedDuration >= this.#maxDuration) {
            this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.MAX_DURATION))
            this.stopVideo()
        }
        else if (this.#sizeBytes >= this.#maxSize) {
            this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.MAX_SIZE))
            this.stopVideo()
        }
    }

    /** Ensure width and height are even (required by most encoders) */
    #getEncoderSafeSize = (w, h) => {
        const width = w - (w % 2) || 2
        const height = h - (h % 2) || 2
        return {width, height}
    }

    #canvasToBlob = async (canvas, mimeType = 'image/png') => {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw this.error('Invalid canvas')
        }

        let blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType))
        if (!(blob instanceof Blob) || blob.size === 0) {
            try {
                const dataUrl = canvas.toDataURL(mimeType)
                blob = await fetch(dataUrl).then(response => response.blob())
            }
            catch {
                blob = null
            }
        }
        if (!(blob instanceof Blob) || blob.size === 0) {
            throw this.error('Snapshot generation failed')
        }
        return blob
    }

    #resolveVideoOutput = async (safe) => {
        const codecCandidates = __.device.browser === NAVIGATOR.firefox
                                ? ['vp9', 'av1']
                                : ['avc', 'vp9', 'av1']
        const codec = await getFirstEncodableVideoCodec(codecCandidates, {
            width:                safe.width,
            height:               safe.height,
            bitrate:              this.#quality.value,
            alpha:                'discard',
            latencyMode:          'realtime',
            hardwareAcceleration: 'no-preference',
        })
        if (!codec) {
            return null
        }
        return {
            codec,
            format:    new Mp4OutputFormat({fastStart: false}),
            mimeType:  'video/mp4',
            extension: 'mp4',
        }
    }

    /**
     * Internal error handler
     */
    error = (msg) => {
        const err = new Error(msg)
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.ERROR, {detail: {error: err}}))
        return err
    }

    /** Finalize MP4 and emit STOP */
    stopVideo = async () => {
        if (!this.#isRecording) {
            return
        }
        this.type = ScreenMediaRecorder.VIDEO
        this.#isRecording = false
        this.#stopScheduling()

        if (this.#videoSource) {
            await this.#videoSource.close()
        }

        if (this.#output) {
            await this.#output.finalize()
            this.#blob = new Blob([this.#output.target.buffer], {type: this.#mimeType})
            this.#sizeBytes = this.#blob.size
        }

        this.#emitInfo()
        this.#clearRuntimeReferences()
        document.body.classList.remove(ScreenMediaRecorder.CLASSES.RECORDING, ScreenMediaRecorder.CLASSES.PAUSED)
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.STOP, {
            detail: {
                ...this.mediaData,
                duration: this.#recordedDuration * 1000,
            },
        }))
    }

    /** Finalize snapshot and emit CAPTURED event*/
    captureScreenshot = async (canvas) => {
        this.type = ScreenMediaRecorder.IMAGE
        this.#snapshot = canvas
        this.#mimeType = 'image/png'
        this.#extension = 'png'
        this.#blob = await this.#canvasToBlob(canvas, this.#mimeType)
        this.#sizeBytes = this.#blob.size
        this.#dimensions = {width: canvas.width, height: canvas.height}
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.CAPTURED, {
            detail: {canvas, blob: this.#blob},
        }))

    }
}
