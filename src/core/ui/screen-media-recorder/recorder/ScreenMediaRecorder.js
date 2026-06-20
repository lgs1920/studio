/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ScreenMediaRecorder.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * VideoRecorder.js – Stable mediabunny recorder
 * Uses CanvasSource → BufferTarget → MP4.
 * Forces even dimensions and reports real-time duration and size via INFO event.
 ******************************************************************************/
import { APP_KEY, NAVIGATOR, SECOND } from '@Core/constants'
import { DateTime }                   from 'luxon'
import {
    BufferTarget, canEncodeVideo, CanvasSource, getEncodableVideoCodecs, Mp4OutputFormat, Output, QUALITY_HIGH,
    QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                                     from 'mediabunny'

const INFO_INTERVAL_MS = 250
const VIDEO_CODEC_PROBE_TIMEOUT_MS = 2500
const VIDEO_START_TIMEOUT_MS = 8000
const VIDEO_FIRST_PACKET_TIMEOUT_MS = 3500
const VIDEO_START_CLEANUP_TIMEOUT_MS = 2000
const VIDEO_EMPTY_OUTPUT_MAX_BYTES = 256

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
    #nextFrameDueMs = 0
    #frameLoopActive = false
    #pendingFrameWrites = new Set()
    #encodedFrames = 0
    #encodedPackets = 0
    #currentFps = 0
    #lastInfoSampleTimeMs = null
    #lastInfoFrameCount = 0
    #firstEncodedPacketMonitorId = 0

    constructor() {
        super()
        if (ScreenMediaRecorder.instance) {
            return ScreenMediaRecorder.instance
        }
        ScreenMediaRecorder.instance = this
        __.recorder = this
    }

    #getAverageFps = () => {
        if (this.#recordedDuration <= 0 || this.#encodedFrames <= 0) {
            return 0
        }
        return this.#encodedFrames / this.#recordedDuration
    }

    /** Current recorded video metadata */
    get mediaData() {
        return {
            blob:     this.#blob,
            size:     this.#sizeBytes,
            duration: this.#recordedDuration * 1000, // Convert to milliseconds
            fps:      this.#fps,
            averageFps: this.#getAverageFps(),
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
                      dimensions = null,
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
        if (dimensions?.width > 0 && dimensions?.height > 0) {
            this.#dimensions = this.#getEncoderSafeSize(dimensions.width, dimensions.height)
        }

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
        const averageFps = this.#getAverageFps()
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
            detail: {
                duration: durationMs,
                size:     this.#sizeBytes,
                fps:      this.#fps,
                averageFps,
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
        if (!this.#isRecording || this.#isPaused) {
            this.#frameLoopActive = false
            return
        }
        this.#frameLoopActive = true
        this.#rafId = requestAnimationFrame(this.#processFrame)
    }

    /** Encode next frame using the current real-time timestamp. */
    #processFrame = () => {
        if (!this.#isRecording || this.#isPaused || !this.#videoSource) {
            this.#frameLoopActive = false
            return
        }

        const now = performance.now()
        const elapsedMs = now - this.#startTime + this.#pausedTime

        if (elapsedMs + 0.5 < this.#nextFrameDueMs) {
            this.#scheduleNextFrame()
            return
        }

        const elapsedSec = elapsedMs / 1000

        const pendingWrite = this.#submitVideoFrame(elapsedSec, this.#frameIntervalSec)
        if (!pendingWrite) {
            return
        }

        this.#encodedFrames += 1
        this.#recordedDuration = elapsedSec
        this.#nextFrameDueMs = elapsedMs + this.#frameIntervalMs

        this.#scheduleNextFrame()
    }

    #stopScheduling = () => {
        this.#frameLoopActive = false
        cancelAnimationFrame(this.#rafId)
        clearInterval(this.#infoInterval)
    }

    #clearRuntimeReferences = () => {
        this.#firstEncodedPacketMonitorId += 1
        this.#videoSource = null
        this.#output = null
        this.#rafId = null
        this.#infoInterval = null
        this.#frameLoopActive = false
        this.#pendingFrameWrites.clear()
    }

    #submitVideoFrame = (timestampSec, durationSec, encodeOptions = undefined) => {
        let pendingWrite
        try {
            pendingWrite = Promise.resolve(this.#videoSource.add(timestampSec, durationSec, encodeOptions))
        }
        catch (error) {
            this.#handleFrameEncodingError(error)
            return null
        }

        pendingWrite = pendingWrite
            .catch(error => this.#handleFrameEncodingError(error))
            .finally(() => this.#pendingFrameWrites.delete(pendingWrite))

        this.#pendingFrameWrites.add(pendingWrite)
        return pendingWrite
    }

    #handleFrameEncodingError = (error) => {
        if (!this.#isRecording) {
            return
        }
        if (this.#encodedPackets === 0) {
            void this.#failActiveRecording(error)
            return
        }
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.ERROR, {detail: {error}}))
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
        this.#nextFrameDueMs = this.#recordedDuration * 1000

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

        try {
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
            this.#videoSource = new CanvasSource(this.#canvas, this.#getCanvasSourceConfig(outputConfig, safe))

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

            await this.#withTimeout(
                this.#output.start(),
                VIDEO_START_TIMEOUT_MS,
                'Video recording start timed out on this browser.',
                true,
            )
            this.#isRecording = true
            this.#isPaused = false
            this.#startTime = performance.now()
            this.#pausedTime = 0
            this.#nextFrameDueMs = 0
            document.body.classList.add(ScreenMediaRecorder.CLASSES.RECORDING)

            this.#emitInfo(0)
            this.#startMonitoring()
            this.#scheduleNextFrame()
            this.#submitVideoFrame(0, this.#frameIntervalSec, {keyFrame: true})

            this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.START))
            this.#startFirstEncodedPacketMonitor()
        }
        catch (error) {
            await this.#cleanupFailedStart()
            throw error
        }
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
        this.#nextFrameDueMs = 0
        this.#frameLoopActive = false
        this.#pendingFrameWrites.clear()
        this.#encodedFrames = 0
        this.#encodedPackets = 0
        this.#currentFps = 0
        this.#lastInfoSampleTimeMs = null
        this.#lastInfoFrameCount = 0
        this.#firstEncodedPacketMonitorId += 1
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

    #getVideoHardwareAcceleration = () => 'no-preference'

    #getAvcLevelHex = (safe) => {
        const macroblocks = Math.ceil(safe.width / 16) * Math.ceil(safe.height / 16)
        const macroblocksPerSecond = macroblocks * this.#fps

        // Level 4.2 covers 1080p60. Above that, request level 5.1.
        if (macroblocks > 8704 || macroblocksPerSecond > 522240) {
            return '33'
        }

        return '2a'
    }

    #getAvcVideoOutputCandidates = (safe) => {
        const levelHex = this.#getAvcLevelHex(safe)
        return [
            {codec: 'avc', fullCodecString: `avc1.42e0${levelHex}`, label: `baseline-${levelHex}`},
            {codec: 'avc', fullCodecString: `avc1.4d40${levelHex}`, label: `main-${levelHex}`},
            {codec: 'avc', fullCodecString: `avc1.6400${levelHex}`, label: `high-${levelHex}`},
            {codec: 'avc', fullCodecString: null, label: 'mediabunny-default'},
        ]
    }

    #withTimeout = async (promise, timeoutMs, message, reportError = false) => {
        let timeoutId = null
        try {
            return await Promise.race([
                                          promise,
                                          new Promise((_, reject) => {
                                              timeoutId = setTimeout(() => {
                                                  reject(reportError ? this.error(message) : new Error(message))
                                              }, timeoutMs)
                                          }),
                                      ])
        }
        finally {
            clearTimeout(timeoutId)
        }
    }

    #canEncodeVideoCandidate = async (candidate, safe, hardwareAcceleration) => {
        try {
            return await this.#withTimeout(
                canEncodeVideo(candidate.codec, {
                    width:       safe.width,
                    height:      safe.height,
                    bitrate:     this.#quality.value,
                    alpha:       'discard',
                    latencyMode: 'realtime',
                    hardwareAcceleration,
                    ...(candidate.fullCodecString ? {fullCodecString: candidate.fullCodecString} : {}),
                }),
                VIDEO_CODEC_PROBE_TIMEOUT_MS,
                `Video codec probe timed out for ${candidate.label}.`,
            )
        }
        catch {
            return false
        }
    }

    #resolveVideoOutput = async (safe) => {
        const hardwareAcceleration = this.#getVideoHardwareAcceleration()

        if (__.device.browser !== NAVIGATOR.firefox) {
            const avcCandidates = this.#getAvcVideoOutputCandidates(safe)
            const probeResults = []
            for (const candidate of avcCandidates) {
                const supported = await this.#canEncodeVideoCandidate(candidate, safe, hardwareAcceleration)
                probeResults.push({
                                      codec:           candidate.codec,
                                      fullCodecString: candidate.fullCodecString,
                                      label:           candidate.label,
                                      supported,
                                  })
                if (!supported) {
                    continue
                }

                return {
                    codec:           candidate.codec,
                    fullCodecString: candidate.fullCodecString,
                    format:          new Mp4OutputFormat({fastStart: false}),
                    mimeType:        'video/mp4',
                    extension:       'mp4',
                    hardwareAcceleration,
                }
            }

        }

        const codecCandidates = ['vp9']
        const codecProbeOptions = {
            width:                safe.width,
            height:               safe.height,
            bitrate:              this.#quality.value,
            alpha:                'discard',
            latencyMode:          'realtime',
            hardwareAcceleration,
        }
        const encodableCodecs = await this.#withTimeout(
            getEncodableVideoCodecs(codecCandidates, codecProbeOptions),
            VIDEO_CODEC_PROBE_TIMEOUT_MS,
            `Video codec probe timed out for ${codecCandidates.join(', ')}.`,
        )
        const codec = encodableCodecs[0] ?? null
        if (!codec) {
            return null
        }
        return {
            codec,
            fullCodecString: null,
            format:    new Mp4OutputFormat({fastStart: false}),
            mimeType:  'video/mp4',
            extension: 'mp4',
            hardwareAcceleration,
        }
    }

    #getCanvasSourceConfig = (outputConfig, safe) => ({
        codec:                outputConfig.codec,
        bitrate:              this.#quality.value,
        alpha:                'discard',
        latencyMode:          'realtime',
        hardwareAcceleration: outputConfig.hardwareAcceleration,
        ...(outputConfig.fullCodecString ? {fullCodecString: outputConfig.fullCodecString} : {}),
        transform:          {
            width:  safe.width,
            height: safe.height,
        },
        sizeChangeBehavior: 'fill',
        onEncoderConfig:    () => {},
        onEncodedPacket:    () => {
            this.#encodedPackets += 1
        },
    })

    #startFirstEncodedPacketMonitor = () => {
        const monitorId = ++this.#firstEncodedPacketMonitorId
        setTimeout(() => {
            if (monitorId !== this.#firstEncodedPacketMonitorId || !this.#isRecording || this.#encodedPackets > 0) {
                return
            }

            void this.#failActiveRecording(new Error('Video encoder did not produce any MP4 frame on this browser.'))
        }, VIDEO_FIRST_PACKET_TIMEOUT_MS)
    }

    #emitRecorderError = (error) => {
        const safeError = error instanceof Error ? error : new Error(String(error))
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.ERROR, {detail: {error: safeError}}))
        return safeError
    }

    #failActiveRecording = async (error) => {
        if (!this.#isRecording && !this.#isPaused) {
            return
        }

        this.#emitRecorderError(error)
        try {
            await this.cancelVideo()
        }
        catch {
            this.#reset()
            this.#clearRuntimeReferences()
            document.body.classList.remove(ScreenMediaRecorder.CLASSES.RECORDING, ScreenMediaRecorder.CLASSES.PAUSED)
            this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.CANCEL))
        }
    }

    #isEmptyFinalizedVideo = () => !(this.#blob instanceof Blob) || this.#blob.size <= VIDEO_EMPTY_OUTPUT_MAX_BYTES

    #discardFinalizedVideo = (error) => {
        this.#emitRecorderError(error)
        this.#reset()
        this.#clearRuntimeReferences()
        document.body.classList.remove(ScreenMediaRecorder.CLASSES.RECORDING, ScreenMediaRecorder.CLASSES.PAUSED)
        this.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.CANCEL))
    }

    #cleanupFailedStart = async () => {
        this.#isRecording = this.#isPaused = false
        this.#stopScheduling()

        if (this.#output) {
            try {
                await this.#withTimeout(
                    this.#output.cancel?.() ?? Promise.resolve(),
                    VIDEO_START_CLEANUP_TIMEOUT_MS,
                    'Video recording startup cleanup timed out.',
                )
            }
            catch {
                return
            }
        }
        else if (this.#videoSource) {
            try {
                this.#videoSource.close()
            }
            catch {
                return
            }
        }

        this.#reset()
        this.#clearRuntimeReferences()
        document.body.classList.remove(ScreenMediaRecorder.CLASSES.RECORDING, ScreenMediaRecorder.CLASSES.PAUSED)
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

        if (this.#pendingFrameWrites.size) {
            await Promise.allSettled([...this.#pendingFrameWrites])
        }

        if (this.#videoSource) {
            await this.#videoSource.close()
        }

        if (this.#output) {
            await this.#output.finalize()
            this.#blob = new Blob([this.#output.target.buffer], {type: this.#mimeType})
            this.#sizeBytes = this.#blob.size
        }

        if (this.#isEmptyFinalizedVideo()) {
            this.#discardFinalizedVideo(new Error('Video encoder produced an empty MP4 output on this browser.'))
            return
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
