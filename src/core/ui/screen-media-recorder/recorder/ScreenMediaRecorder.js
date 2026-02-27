/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ScreenMediaRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-27
 * Last modified: 2026-02-27
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
    BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_LOW, QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                                     from 'mediabunny'

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
        {value: QUALITY_LOW, name: 'Low Quality', short: 'L'},
        {value: QUALITY_MEDIUM, name: 'Medium Quality', short: 'M'},
        {value: QUALITY_HIGH, name: 'High Quality', short: 'H'},
        {value: QUALITY_VERY_HIGH, name: 'Ultra High Quality', short: 'V'},
    ]
    /** Supported output frame rates */
    static FPS = [15, 30, 45, 60]

    /** Presets for video recording */
    static VIDEO_PRESETS = new Map([
                                       [
                                           'low', {
                                           quality:     0,  // index of QUALITY array
                                           fps:         0,  // Index of FPS array
                                           name:        'Low',
                                           description: 'Low quality',
                                       },
                                       ],
                                       [
                                           'medium', {
                                           quality:     1,
                                           fps:         1,
                                           name:        'Med',
                                           description: 'Medium quality',
                                       },
                                       ],
                                       [
                                           'high', {
                                           quality:     2,
                                           fps:         2,
                                           name:        'High',
                                           description: 'Very High quality',
                                       },
                                       ],
                                       [
                                           'Ultra', {
                                           quality:     3,
                                           fps:         3,
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
                                       },
                                       ],
                                   ])


    static DEFAULT_FPS_INDEX = 1
    static DEFAULT_QUALITY_INDEX = 2

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
    #sourceType = 'unknown'
    #metadata = null
    #ratio = null
    #type = null
    #snapshot

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
            quality:  this.#quality,
            dimensions: this.#dimensions,
            ratio:    this.#ratio,
            sourceType: this.#sourceType,
            metadata: this.#metadata,
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
            catch (e) {
            }
        }
    }

    async url() {
        if (this.isVideo()) {
            if (!this.#blob) {
                throw this.error('No video')
            }
        }
        else {

            // const base64 = this.#snapshot.toDataURL('image/png')
            // this.#blob = await (await fetch(base64)).blob()
            this.#snapshot.toBlob(blob => {
                this.#blob = blob
            }, 'image/png')

            // TODO: add chunking to png
            //this.#blob = await __.tools.addChunksToPng(this.#blob , this.#metadata)
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
        this.#ctx = canvas.getContext('2d', {alpha: false})
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
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.SOURCE, {
            detail: {type: 'stream', stream, ...this.#dimensions},
        }))
    }

    /** Encode next frame using precise timestamp */
    #recordFrame = () => {
        if (!this.#isRecording || this.#isPaused) {
            return
        }

        const now = performance.now()
        const elapsedMs = now - this.#startTime + this.#pausedTime
        const elapsedSec = elapsedMs / 1000

        this.#videoSource.add(elapsedSec, 1 / this.#fps)
        this.#recordedDuration = elapsedSec

        // Send INFO event with current duration
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
            detail: {
                duration: elapsedMs,
                size:     this.#sizeBytes,
                fps:      this.#fps,
                isPaused: this.#isPaused,
            },
        }))

        this.#rafId = requestAnimationFrame(this.#recordFrame)
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

        // Send INFO event with current duration before pausing
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
            detail: {
                duration: currentDuration,
                size:     this.#sizeBytes,
                fps:      this.#fps,
                isPaused: true,
            },
        }))

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

        // Send INFO event with current duration before resuming
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
            detail: {
                duration: this.#recordedDuration * 1000,
                size:     this.#sizeBytes,
                fps:      this.#fps,
                isPaused: false,
            },
        }))

        document.body.classList.remove(ScreenMediaRecorder.CLASSES.PAUSED)
        this.#recordFrame()
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.RESUME))
    }

    isImage = () => this.#type === ScreenMediaRecorder.IMAGE
    isVideo = () => this.#type === ScreenMediaRecorder.VIDEO

    /** Abort recording and discard data */
    cancelVideo = async () => {
        this.#isRecording = this.#isPaused = false
        cancelAnimationFrame(this.#rafId)
        clearInterval(this.#infoInterval)

        if (this.#videoSource) {
            await this.#videoSource.close()
        }

        if (this.#output) {
            await this.#output.abort?.()
        }

        if (this.#stream) {
            this.#stream.getTracks().forEach(track => track.stopVideo())
        }

        if (this.#videoElement) {
            this.#videoElement.srcObject = null
        }

        this.#reset()
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
        this.#output = new Output({
                                      format:  new Mp4OutputFormat({fastStart: false}),
                                      target:  new BufferTarget(),
                                      process: (a, b, c) => {
                                          console.log(a, b, c)
                                      },
                                  })
        await this.#output.setMetadataTags(this.#metadata)

        const safe = this.#dimensions
        this.#videoSource = new CanvasSource(this.#canvas, {
            codec:                (__.device.browser === NAVIGATOR.firefox && __.device.isMobile) ? 'vp9' : 'avc',
            bitrate:              this.#quality.value,
            alpha:                'discard',
            latencyMode:          'realtime',
            hardwareAcceleration: 'no-preference',
            width:                safe.width,
            height:               safe.height,
        })

        this.#output.addVideoTrack(this.#videoSource, {framerate: this.#fps})
        this.#output.target.onwrite = (_, end) => {
            this.#sizeBytes = end
        }

        await this.#output.start()
        this.#isRecording = true
        this.#startTime = performance.now()
        this.#pausedTime = 0
        document.body.classList.add(ScreenMediaRecorder.CLASSES.RECORDING)

        // Send initial INFO event with duration 0
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
            detail: {
                duration: 0,
                size:     this.#sizeBytes,
                fps:      this.#fps,
                isPaused: this.#isPaused,
            },
        }))

        this.#recordFrame()
        this.#infoInterval = setInterval(() => {
            this.#checkLimits()
        }, this.#timeslice)

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
        this.#recordedDuration = 0
        this.#startTime = 0
        this.#pausedTime = 0
        this.#sizeBytes = 0
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
        this.#blob = await new Promise(resolve => canvas.toBlob(resolve))
        this.#sizeBytes = this.#blob.size
        this.dimensions = {width: canvas.width, height: canvas.height}
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.CAPTURED, {
            detail: {canvas},
        }))

    }
}
