/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConverter.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-29
 * Last modified: 2025-08-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { APP_KEY, LGS_PROJECT } from '@Core/constants'
import { DateTime }             from 'luxon'

/**
 * VideoConverter class for converting video files using a remote API
 *
 * @class VideoConverter
 * @description Handles video conversion through a remote backend API with real-time progress tracking via Server-Sent
 *     Events (SSE) or polling. Supports video filters for format compatibility and optimization.
 * @example
 * const converter = new VideoConverter({
 *   onProgress: ({percentage, time, duration}) => console.log(`Progress: ${percentage}% (${time}/${duration}ms)`),
 *   onLog: (message) => console.log(message),
 *   backend: 'http://localhost:3333',
 *   sse: true, // Use SSE (true) or polling (false)
 *   debug: true // Enable debug logs
 * })
 *
 * const convertedBlob = await converter.convertVideo(file, 'WEBM', 'MP4', {
 *   quality: 'HIGH',
 *   outputFileName: 'my-video.mp4',
 *   audio: VideoConverter.AUDIO_ENCODE.NONE, // 'none', 'copy', or 'encode'
 *   customEncoding: { codec: 'libx264', audioCodec: 'aac', videoFilters: 'format=yuv420p', extraArgs: ['-movflags',
 *     '+faststart'] }
 * })
 */
export class VideoConverter {
    // Audio encoding options
    static AUDIO_ENCODE = {
        NONE:   'none',
        COPY:   'copy',
        ENCODE: 'encode',
    }

    // Formats (container + codecs)
    static VIDEO_FORMATS = {
        MP4:  {
            extension: 'mp4',
            codec:    'libx264',
            audioCodec: 'aac',
            mimeType: 'video/mp4',
            description: 'MP4 (H.264/AAC)',
            videoFilters: 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
            // Container/streaming optimizations only
            extraArgs: [
                '-movflags', '+faststart',
            ],
        },
        WEBM: {
            extension: 'webm',
            codec:     'libvpx-vp9',
            audioCodec: 'opus',
            mimeType:  'video/webm',
            description: 'WebM (VP9/Opus)',
            videoFilters: 'format=yuv420p',
            extraArgs: [
                '-speed', '8',
                '-threads', '0',
            ],
        },
        AVI:  {
            extension:   'avi',
            codec:       'mpeg4',
            audioCodec:  'mp3',
            mimeType:    'video/x-msvideo',
            description: 'AVI (MPEG-4/MP3)',
            videoFilters: 'format=yuv420p',
            extraArgs: [
                '-qscale:v', '3',
            ],
        },
    }

    // Quality presets (encoder speed + CRF)
    static QUALITY_PRESETS = {
        DRAFT:   {
            crf:         '35',
            preset:      'ultrafast',
            text:        'Draft',
            description: 'Blazing speed, minimal quality',
        },
        MEDIUM:  {
            crf:         '25',
            preset:      'veryfast',
            text:        'Medium',
            description: 'Balanced speed & quality',
        },
        HIGH:    {
            crf:         '22',
            preset:      'fast',
            text:        'High',
            description: 'Slower encode, great visuals',
        },
        HIGHEST: {
            crf:         '18',
            preset:      'slow',
            text:        'Highest',
            description: 'Top-notch quality, slow render',
        },
    }

    // Public attributes to store conversion state
    conversionTime = 0
    inputFile = null
    outputFile = null
    sseURL = null
    downloadURL = null
    cancelURL = null
    convertURL = null

    conversionData = {
        success:     false,
        completed:   false,
        inputFormat: null,
        outputFormat: null,
        inputFileDetails: null,
        conversionTime: 0,
        duration: null,
        errorMessage: null,
    }

    // Private attributes
    #eventSource = null
    #connectionTimeout = null
    #heartbeatTimeout = null
    #hasReceivedData = false
    #isDone = false
    #pollInterval = null
    #pollDelay = 2000
    #sse = true
    #DEBUG = false

    /**
     * Creates an instance of VideoConverter
     *
     * @param {Object} options - Configuration options
     * @param {Function} [options.onProgress] - Callback for progress updates. Receives {percentage: number, time?:
     *     number, duration?: number}
     * @param {Function} [options.onLog] - Callback for logging messages. Receives string message
     * @param {string} options.backend - Backend base URL (e.g., http://dev.lgs1920.fr:3333)
     * @param {boolean} [options.sse=true] - Use SSE (true) or polling (false) for progress tracking
     * @param {boolean} [options.debug=false] - Enable debug logging
     * @throws {Error} If backend URL is not provided
     * @memberof VideoConverter
     */
    constructor({onProgress, onLog, backend, sse = true, debug = false} = {}) {
        this.onProgress = onProgress || (() => {
        })
        this.onLog = onLog || (() => {
        })
        this.#sse = sse
        this.#DEBUG = debug
        if (!backend) {
            throw new Error('Backend URL is required')
        }
        this.backend = `${backend}`
        this.convertURL = `${this.backend}/convert`
        this.lastProgressPercentage = 0
    }

    /**
     * Returns the current conversion data
     *
     * @returns {Object} Conversion data including duration
     * @memberof VideoConverter
     */
    getConversionData = () => {
        return this.conversionData
    }

    /**
     * Returns available video formats
     *
     * @static
     * @returns {Object} Supported formats configuration with codec, extension, video filters, and other settings
     * @memberof VideoConverter
     */
    static getAvailableFormats = () => {
        return VideoConverter.VIDEO_FORMATS
    }

    /**
     * Returns available quality presets
     *
     * @static
     * @returns {Object} Quality presets configuration with CRF values and descriptions
     * @memberof VideoConverter
     */
    static getQualityPresets = () => {
        return VideoConverter.QUALITY_PRESETS
    }

    /**
     * Returns available audio encoding options
     *
     * @static
     * @returns {Object} Supported audio encoding options
     * @memberof VideoConverter
     */
    static getAudioEncodeOptions = () => {
        return VideoConverter.AUDIO_ENCODE
    }

    /**
     * Generate a filename for the converted video
     * @param {string} format - Output format key (e.g., 'MP4', 'WEBM')
     * @param {string} [filenamePrefix=APP_KEY] - Prefix for the filename
     * @returns {string} Generated filename with timestamp, prefix, and extension
     */
    fileName = (format, filenamePrefix = APP_KEY) => {
        const timestamp = DateTime.local().toFormat('yyyyLLddHHmm')
        const fileExtension = VideoConverter.VIDEO_FORMATS[format]?.extension || 'webm'
        return `${timestamp}-${filenamePrefix}.${fileExtension}`
    }
    /**
     * Converts a video by sending it to the remote API
     *
     * @async
     * @param {File|Blob} inputFile - Input video file to convert
     * @param {string} inputFormat - Input format key (e.g., 'WEBM', 'MP4')
     * @param {string} outputFormat - Target format key (e.g., 'MP4', 'WEBM')
     * @param {Object} [options={}] - Conversion options
     * @param {string} [options.quality='MEDIUM'] - Quality preset key ('DRAFT', 'MEDIUM', 'HIGH', 'HIGHEST')
     * @param {string} [options.outputFileName] - Custom output filename
     * @param {number} [options.duration] - Video duration in milliseconds for progress calculation
     * @param {Object} [options.metadata] - Metadata key-value pairs to apply to the output video
     * @param {Object} [options.customEncoding] - Custom encoding settings to be processed by the backend
     * @param {string} [options.audio='encode'] - Audio encoding option ('none', 'copy', 'encode')
     * @returns {Promise<Blob>} Converted video as a Blob
     * @throws {Error} If input file is invalid, format is unsupported, or conversion fails
     * @memberof VideoConverter
     */
    convertVideo = async (inputFile, inputFormat, outputFormat, options = {}) => {
        // Validate input file
        if (!(inputFile instanceof File || inputFile instanceof Blob) || inputFile.size === 0) {
            if (this.#DEBUG) {
                this.onLog(`Invalid input file: type=${inputFile?.type}, size=${inputFile?.size}`)
            }
            throw new Error('Invalid input file')
        }

        // Validate input format
        if (!VideoConverter.VIDEO_FORMATS[inputFormat]) {
            if (this.#DEBUG) {
                this.onLog(`Invalid input format: ${inputFormat}`)
            }
            throw new Error(`Unsupported input format: ${inputFormat}`)
        }

        // Validate output format
        if (!VideoConverter.VIDEO_FORMATS[outputFormat]) {
            if (this.#DEBUG) {
                this.onLog(`Unsupported output format: ${outputFormat}`)
            }
            throw new Error(`Unsupported output format: ${outputFormat}`)
        }

        // Extract and validate options
        const {
                  quality = 'MEDIUM',
                  outputFileName,
                  duration,
                  metadata,
                  customEncoding,
                  audio = VideoConverter.AUDIO_ENCODE.ENCODE,
              } = options
        if (!VideoConverter.QUALITY_PRESETS[quality]) {
            if (this.#DEBUG) {
                this.onLog(`Unsupported quality preset: ${quality}`)
            }
            throw new Error(`Unsupported quality preset: ${quality}`)
        }

        // Validate audio option
        if (!Object.values(VideoConverter.AUDIO_ENCODE).includes(audio)) {
            if (this.#DEBUG) {
                this.onLog(`Invalid audio option: ${audio}`)
            }
            throw new Error(`Unsupported audio option: ${audio}. Must be one of ${Object.values(VideoConverter.AUDIO_ENCODE).join(', ')}`)
        }

        // Validate customEncoding if provided
        if (customEncoding) {
            if (typeof customEncoding !== 'object' || !customEncoding.codec || !customEncoding.extension) {
                if (this.#DEBUG) {
                    this.onLog(`Invalid customEncoding: must be an object with 'codec' and 'extension' properties`)
                }
                throw new Error('Invalid customEncoding configuration')
            }
            if (this.#DEBUG) {
                this.onLog(`Using custom encoding settings: ${JSON.stringify(customEncoding)}`)
            }
        }

        // Get format and quality configurations
        const format = customEncoding || VideoConverter.VIDEO_FORMATS[outputFormat]
        const qualityPreset = VideoConverter.QUALITY_PRESETS[quality]
        const inputFileName = `input.${VideoConverter.VIDEO_FORMATS[inputFormat].extension}`
        const outputName = outputFileName || `output.${format.extension}`
        const startTime = Date.now()

        // Merge default metadata with provided metadata, prioritizing provided values
        const _defaultMetadata = {
            date: new Date().toISOString().split('T')[0],
            album: LGS_PROJECT,
            genre: 'Adventure',
        }
        const _metadata = {..._defaultMetadata, ...metadata}

        try {
            // Initialize conversion state
            this.#resetConversionState(inputFile, inputFormat, outputFormat)
            if (this.#DEBUG) {
                this.onLog(`Starting conversion: ${inputFile.name || 'input'} (${inputFormat}) → ${outputFormat} as ${outputName}, audio: ${audio}, quality: ${quality}`)
                this.onLog(`Metadata applied: ${JSON.stringify(_metadata)}`)
            }
            this.onProgress({percentage: 0})

            // Build request with customEncoding, audio, and videoFilters
            const formData = this.#buildConversionRequest(inputFile, {
                inputFileName,
                format,
                qualityPreset,
                inputFormat,
                outputFormat,
                duration,
                metadata: _metadata,
                customEncoding,
                audio,
            })
            // Send conversion request
            const response = await this.#sendConversionRequest(formData)
            const {conversionId, message, urls} = await response.data

            this.sseURL = this.#sse ? `${this.backend}${urls.progress}?sse=true` : `${this.backend}${urls.progress}?sse=false`
            this.downloadURL = `${this.backend}${urls.download}`
            this.cancelURL = `${this.backend}${urls.cancel}`
            if (this.#DEBUG) {
                this.onLog(`Received conversion ID: ${conversionId} with message ${message}`)
            }

            // Initialize and wait for completion
            await this.#initializeSSEConnection()

            // Fetch the converted file
            const downloadResponse = await fetch(this.downloadURL, {
                credentials: 'include',
            })
            if (!downloadResponse.ok) {
                throw new Error(`Download failed: ${downloadResponse.status}`)
            }
            const blob = await downloadResponse.blob()

            // Calculate and update final conversion data
            const totalTime = (Date.now() - startTime) / 1000
            this.#updateConversionSuccess(inputFile, inputFormat, outputFormat, totalTime)

            if (this.#DEBUG) {
                this.onLog(`Conversion completed in ${totalTime.toFixed(2)}s`)
            }
            return blob
        }
        catch (error) {
            this.#cleanup()
            const totalTime = (Date.now() - startTime) / 1000
            this.#updateConversionError(inputFile, inputFormat, outputFormat, totalTime, error.message)

            if (this.#DEBUG) {
                this.onLog(`Conversion failed: ${error.message}`)
            }
            this.onProgress({percentage: 100})
            throw error
        }
    }

    /**
     * Helper to read response data for error logging
     *
     * @async
     * @param {Response} response - Fetch response object
     * @returns {Promise<string>} Response data as string
     * @private
     * @memberof VideoConverter
     */
    #readResponseData = async (response) => {
        try {
            if (!response.body) {
                return 'No data'
            }
            return await response.text()
        }
        catch (error) {
            return 'Error reading response data'
        }
    }

    /**
     * Resets the conversion state for a new conversion
     *
     * @private
     * @param {File|Blob} inputFile - Input file
     * @param {string} inputFormat - Input format key
     * @param {string} outputFormat - Output format key
     * @memberof VideoConverter
     */
    #resetConversionState = (inputFile, inputFormat, outputFormat) => {
        this.conversionData = {
            success:        false,
            completed:      false,
            inputFormat,
            outputFormat,
            inputFileDetails: {
                name: inputFile.name || 'input',
                size: inputFile.size,
                type: inputFile.type,
            },
            conversionTime: 0,
            duration: null,
            errorMessage:   null,
        }
        this.#hasReceivedData = false
        this.#isDone = false
    }

    /**
     * Builds the FormData request for video conversion
     *
     * @private
     * @param {File|Blob} inputFile - Input file
     * @param {Object} options - Conversion options
     * @param {string} options.inputFileName - Input filename
     * @param {Object} options.format - Output format configuration
     * @param {Object} options.qualityPreset - Quality preset configuration
     * @param {string} options.inputFormat - Input format key
     * @param {string} options.outputFormat - Output format key
     * @param {number} [options.duration] - Video duration in milliseconds
     * @param {Object} [options.metadata] - Metadata key-value pairs to apply to the output video
     * @param {Object} [options.customEncoding] - Custom encoding settings to be processed by the backend
     * @param {string} options.audio - Audio encoding option
     * @returns {FormData} Prepared form data for the API request
     * @memberof VideoConverter
     */
    #buildConversionRequest = (inputFile, options) => {
        const {
                  inputFileName,
                  inputFormat,
                  outputFormat,
                  duration,
                  metadata,
                  customEncoding,
                  qualityPreset,
                  format,
                  audio,
              } = options

        // Prepare encoding configuration with quality preset parameters
        const encodingConfig = {
            ...format,
            extraArgs:    [
                ...(customEncoding?.extraArgs || format.extraArgs || []),
                '-crf', qualityPreset.crf,
                '-preset', qualityPreset.preset,
            ],
            videoFilters: customEncoding?.videoFilters || format.videoFilters,
        }

        // Prepare FormData for API request
        const formData = new FormData()
        formData.append('file', inputFile, inputFileName)
        formData.append('body', JSON.stringify({
                                                   from:           inputFormat,
                                                   to:             outputFormat,
                                                   duration,
                                                   metadata,
                                                   customEncoding: encodingConfig,
                                                   audio,
                                                   verbose:        this.#DEBUG,
                                               }))
        return formData
    }

    /**
     * Sends the conversion request to the backend API
     *
     * @private
     * @async
     * @param {FormData} formData - Form data to send
     * @returns {Promise<Response>} Fetch response object
     * @throws {Error} If the request fails
     * @memberof VideoConverter
     */
    #sendConversionRequest = async (formData) => {
        if (this.#DEBUG) {
            this.onLog(`Sending POST request to ${this.convertURL}`)
        }

        try {
            const response = await lgs.axios.post(this.convertURL, formData, {
                headers: {
                    'X-Request-Progress': 'true',
                    'X-Progress-Interval': '500',
                },
                withCredentials: true,
            })
            console.log(response)
            if (response.status !== 200) {
                const errorText = await this.#readResponseData(response)
                throw new Error(`HTTP error: ${response.status}, ${errorText}`)
            }

            if (this.#DEBUG) {
                this.onLog(`Received response: status=${response.status}`)
            }
            return response
        }
        catch (error) {
            if (this.#DEBUG) {
                this.onLog(`Fetch error: ${error.message}`)
            }
            throw new Error(`Failed to send conversion request: ${error.message}`)
        }
    }

    /**
     * Initializes progress tracking via SSE or polling
     *
     * @private
     * @async
     * @returns {Promise<void>} Resolves when conversion is complete
     * @throws {Error} If connection or polling fails
     * @memberof VideoConverter
     */
    #initializeSSEConnection = async () => {
        if (this.#DEBUG) {
            this.onLog(`Initiating progress tracking: ${this.sseURL} (sse=${this.#sse})`)
        }

        return new Promise((resolve, reject) => {
            // Set connection timeout
            this.#connectionTimeout = setTimeout(() => {
                if (!this.#hasReceivedData) {
                    this.#cleanup()
                    reject(new Error('Progress tracking timeout after 30s'))
                }
            }, 30000)

            if (this.#sse) {
                // SSE mode
                this.#eventSource = new EventSource(this.sseURL, {
                    withCredentials: true,
                })
                // Setup event listeners
                this.#setupSSEEventListeners(resolve, reject)
            }
            else {
                // Polling mode
                this.#pollProgress(resolve, reject)
            }
        })
    }

    /**
     * Parses SSE-like response for polling mode
     *
     * @private
     * @param {string} text - Raw response text
     * @returns {Object|null} Parsed event object with event and data properties, or null if invalid
     * @memberof VideoConverter
     */
    #parseSseResponse = (text) => {
        try {
            const lines = text.trim().split('\n')
            let event = null
            let data = null

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('event: ')) {
                    event = lines[i].substring(7).trim()
                }
                else if (lines[i].startsWith('data: ')) {
                    data = JSON.parse(lines[i].substring(6).trim())
                }
            }

            if (event && data) {
                return {event, data}
            }
            if (this.#DEBUG) {
                this.onLog(`Invalid SSE response format: ${text}`)
            }
            return null
        }
        catch (error) {
            if (this.#DEBUG) {
                this.onLog(`Failed to parse SSE response: ${error.message}, raw: ${text}`)
            }
            return null
        }
    }

    /**
     * Polls the progress endpoint periodically
     *
     * @private
     * @param {Function} resolve - Promise resolve function
     * @param {Function} reject - Promise reject function
     * @memberof VideoConverter
     */
    #pollProgress = (resolve, reject) => {
        const poll = async () => {
            try {
                const response = await fetch(this.sseURL, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                    },
                })
                if (!response.ok) {
                    const errorText = await this.#readResponseData(response)
                    if (this.#DEBUG) {
                        this.onLog(`HTTP error: ${response.status}, response: ${errorText}`)
                    }
                    if (response.status === 500) {
                        if (this.#DEBUG) {
                            this.onLog('Server error (500), continuing polling')
                        }
                        return
                    }
                    throw new Error(`HTTP error: ${response.status}`)
                }

                const contentType = response.headers.get('Content-Type')
                const text = await this.#readResponseData(response)
                if (this.#DEBUG) {
                    this.onLog(`Polling response: ${text}, Content-Type: ${contentType}`)
                }

                let eventData
                if (contentType && contentType.includes('application/json')) {
                    try {
                        const data = JSON.parse(text.trim())
                        if (!data.success || !data.event || !data.data) {
                            if (this.#DEBUG) {
                                this.onLog(`Invalid JSON response format: ${text}`)
                            }
                            return
                        }
                        eventData = {event: data.event, data: data.data}
                    }
                    catch (parseError) {
                        if (this.#DEBUG) {
                            this.onLog(`Failed to parse JSON response: ${parseError.message}, raw: ${text}`)
                        }
                        return
                    }
                }
                else if (contentType && contentType.includes('text/event-stream')) {
                    eventData = this.#parseSseResponse(text)
                    if (!eventData) {
                        return
                    }
                }
                else {
                    if (this.#DEBUG) {
                        this.onLog(`Unexpected Content-Type: ${contentType}, response: ${text}`)
                    }
                    return
                }

                // Simulate SSE event
                const event = {data: JSON.stringify(eventData.data)}
                if (this.#DEBUG) {
                    console.log('Simulating SSE event:', eventData)
                }
                this.#hasReceivedData = true
                this.#clearConnectionTimeout()

                switch (eventData.event) {
                    case 'start':
                        this.#handleStartEvent(event)
                        break
                    case 'progress':
                        this.#handleProgressEvent(event)
                        break
                    case 'complete':
                        this.#handleCompleteEvent(event, resolve)
                        clearInterval(this.#pollInterval)
                        break
                    case 'error':
                        this.#handleErrorEvent(event, reject)
                        clearInterval(this.#pollInterval)
                        break
                    case 'cancelled':
                        this.#handleCancelledEvent(event, reject)
                        clearInterval(this.#pollInterval)
                        break
                }
            }
            catch (error) {
                if (this.#DEBUG) {
                    this.onLog(`Polling error: ${error.message}`)
                }
                if (!this.#isDone) {
                    this.#cleanup()
                    reject(new Error(`Polling failed: ${error.message}`))
                }
            }
        }

        // Start polling
        this.#pollInterval = setInterval(poll, this.#pollDelay)
        poll()
    }

    /**
     * Handles SSE or polling 'cancelled' event
     *
     * @private
     * @param {Event} event - SSE or simulated polling event object
     * @param {Function} reject - Promise reject function
     * @memberof VideoConverter
     */
    #handleCancelledEvent = (event, reject) => {
        if (this.#DEBUG) {
            this.onLog(`Cancelled event: ${event.data}`)
        }
        try {
            const data = JSON.parse(event.data)
            this.#cleanup()
            reject(new Error(`Conversion cancelled: ${data.message}`))
        }
        catch (error) {
            if (this.#DEBUG) {
                this.onLog(`Failed to parse cancelled event: ${error.message}`)
            }
            this.#cleanup()
            reject(new Error(`Cancelled event error: ${error.message}`))
        }
    }

    /**
     * Sets up all Server-Sent Events listeners
     *
     * @private
     * @param {Function} resolve - Promise resolve function
     * @param {Function} reject - Promise reject function
     * @memberof VideoConverter
     */
    #setupSSEEventListeners = (resolve, reject) => {
        this.#eventSource.addEventListener('start', (event) => this.#handleStartEvent(event))
        this.#eventSource.addEventListener('progress', (event) => this.#handleProgressEvent(event))
        this.#eventSource.addEventListener('complete', (event) => this.#handleCompleteEvent(event, resolve))
        this.#eventSource.addEventListener('error', (event) => this.#handleErrorEvent(event, reject))
        this.#eventSource.addEventListener('cancelled', (event) => this.#handleCancelledEvent(event, reject))
        this.#eventSource.addEventListener('heartbeat', (event) => this.#handleHeartbeatEvent(event))

        this.#eventSource.onerror = () => this.#handleConnectionError(resolve, reject)
    }

    /**
     * Handles SSE or polling 'start' event
     *
     * @private
     * @param {Event} event - SSE or simulated polling event object
     * @memberof VideoConverter
     */
    #handleStartEvent = (event) => {
        if (this.#DEBUG) {
            this.onLog(`Start event: ${event.data}`)
        }
        try {
            const data = JSON.parse(event.data)
            this.#hasReceivedData = true
            this.#clearConnectionTimeout()
            this.#resetHeartbeatTimeout()
            this.onProgress({percentage: 0})
            this.lastProgressPercentage = 0
        }
        catch (error) {
            if (this.#DEBUG) {
                this.onLog(`Failed to parse start event: ${error.message}`)
            }
        }
    }

    /**
     * Handles SSE or polling 'progress' event
     *
     * @private
     * @param {Event} event - SSE or simulated polling event object
     * @memberof VideoConverter
     */
    #handleProgressEvent = (event) => {
        if (this.#DEBUG) {
            this.onLog(`Progress event: ${event.data}`)
        }
        try {
            const data = JSON.parse(event.data)
            this.#hasReceivedData = true
            this.#resetHeartbeatTimeout()

            if (data.percentage !== undefined) {
                const progressData = {
                    percentage: Number(data.percentage.toFixed(2)),
                    time:       data.timeSec !== undefined ? Number(data.timeSec) * 1000 : undefined,
                    duration:   data.duration !== undefined ? Number(data.duration) : undefined,
                }
                if (data.duration !== undefined) {
                    this.conversionData.duration = Number(data.duration)
                }
                if (this.#DEBUG) {
                    this.onLog(`Progress update: ${progressData.percentage}% (time: ${data.timeSec}s, duration: ${data.duration}ms)`)
                }
                this.onProgress(progressData)
                this.lastProgressPercentage = data.percentage
            }
        }
        catch (error) {
            if (this.#DEBUG) {
                this.onLog(`Failed to parse progress event: ${error.message}`)
            }
        }
    }

    /**
     * Handles SSE or polling 'complete' event
     *
     * @private
     * @param {Event} event - SSE or simulated polling event object
     * @param {Function} resolve - Promise resolve function
     * @memberof VideoConverter
     */
    #handleCompleteEvent = (event, resolve) => {
        if (this.#DEBUG) {
            this.onLog(`Complete event: ${event.data}`)
        }
        try {
            const data = JSON.parse(event.data)
            if (data.done) {
                this.#isDone = true
                this.#cleanup()
                resolve()
            }
        }
        catch (error) {
            if (this.#DEBUG) {
                this.onLog(`Failed to parse complete event: ${error.message}`)
            }
            if (this.#isDone) {
                if (this.#DEBUG) {
                    this.onLog('Ignoring parse error as conversion is complete')
                }
                this.#cleanup()
                resolve()
            }
        }
    }

    /**
     * Handles SSE or polling 'error' event
     *
     * @private
     * @param {Event} event - SSE or simulated polling event object
     * @param {Function} reject - Promise reject function
     * @memberof VideoConverter
     */
    #handleErrorEvent = (event, reject) => {
        if (this.#DEBUG) {
            this.onLog(`Error event: ${event.data}`)
        }
        try {
            const data = JSON.parse(event.data)
            this.#cleanup()
            reject(new Error(`Conversion failed: ${data.error}`))
        }
        catch (error) {
            if (this.#DEBUG) {
                this.onLog(`Failed to parse error event: ${error.message}`)
            }
            this.#cleanup()
            reject(new Error(`Error event: ${error.message}`))
        }
    }

    /**
     * Handles SSE 'heartbeat' event
     *
     * @private
     * @param {Event} event - SSE event object
     * @memberof VideoConverter
     */
    #handleHeartbeatEvent = (event) => {
        if (this.#DEBUG) {
            this.onLog('SSE heartbeat received')
        }
        this.#hasReceivedData = true
        this.#resetHeartbeatTimeout()
    }

    /**
     * Handles SSE connection errors
     *
     * @private
     * @param {Function} resolve - Promise resolve function
     * @param {Function} reject - Promise reject function
     * @memberof VideoConverter
     */
    #handleConnectionError = (resolve, reject) => {
        if (this.#DEBUG) {
            this.onLog(`SSE connection error for ${this.sseURL}. ReadyState: ${this.#eventSource?.readyState}`)
        }
        if (this.#isDone) {
            if (this.#DEBUG) {
                this.onLog('Ignoring SSE error as conversion is complete')
            }
            this.#cleanup()
            resolve()
        }
        else {
            if (this.#DEBUG) {
                this.onLog('SSE connection failed before conversion completion')
            }
            this.#cleanup()
            reject(new Error(`SSE connection failed for ${this.sseURL}`))
        }
    }

    /**
     * Resets the heartbeat timeout
     *
     * @private
     * @memberof VideoConverter
     */
    #resetHeartbeatTimeout = () => {
        if (!this.#sse) {
            return
        }
        if (this.#heartbeatTimeout) {
            clearTimeout(this.#heartbeatTimeout)
        }
        this.#heartbeatTimeout = setTimeout(() => {
            if (!this.#isDone) {
                this.#cleanup()
                if (this.#DEBUG) {
                    this.onLog('SSE heartbeat timeout after 45s')
                }
            }
        }, 45000)
    }

    /**
     * Clears the connection timeout
     *
     * @private
     * @memberof VideoConverter
     */
    #clearConnectionTimeout = () => {
        if (this.#connectionTimeout) {
            clearTimeout(this.#connectionTimeout)
            this.#connectionTimeout = null
        }
    }

    /**
     * Updates conversion data on successful completion
     *
     * @private
     * @param {File|Blob} inputFile - Input file
     * @param {string} inputFormat - Input format key
     * @param {string} outputFormat - Output format key
     * @param {number} totalTime - Total conversion time in seconds
     * @memberof VideoConverter
     */
    #updateConversionSuccess = (inputFile, inputFormat, outputFormat, totalTime) => {
        this.conversionData = {
            success:        true,
            completed:      true,
            inputFormat,
            outputFormat,
            inputFileDetails: {
                name: inputFile.name || 'input',
                size: inputFile.size,
                type: inputFile.type,
            },
            conversionTime: totalTime,
            duration: this.conversionData.duration,
            errorMessage:   null,
        }
    }

    /**
     * Updates conversion data on error
     *
     * @private
     * @param {File|Blob} inputFile - Input file
     * @param {string} inputFormat - Input format key
     * @param {string} outputFormat - Output format key
     * @param {number} totalTime - Total conversion time in seconds
     * @param {string} errorMessage - Error message
     * @memberof VideoConverter
     */
    #updateConversionError = (inputFile, inputFormat, outputFormat, totalTime, errorMessage) => {
        this.conversionData = {
            success:        false,
            completed:      true,
            inputFormat,
            outputFormat,
            inputFileDetails: {
                name: inputFile.name || 'input',
                size: inputFile.size,
                type: inputFile.type,
            },
            conversionTime: totalTime || 0,
            duration: this.conversionData.duration,
            errorMessage:   errorMessage,
        }
    }

    /**
     * Cleans up resources (event source, timeouts, polling interval)
     *
     * @private
     * @memberof VideoConverter
     */
    #cleanup = () => {
        if (this.#eventSource) {
            this.#eventSource.close()
            this.#eventSource = null
        }
        if (this.#pollInterval) {
            clearInterval(this.#pollInterval)
            this.#pollInterval = null
        }
        this.#clearConnectionTimeout()
        if (this.#heartbeatTimeout) {
            clearTimeout(this.#heartbeatTimeout)
            this.#heartbeatTimeout = null
        }
    }

    /**
     * Destroys the converter instance and cleans up all resources
     *
     * @public
     * @memberof VideoConverter
     */
    destroy = () => {
        this.#cleanup()
        if (this.#DEBUG) {
            this.onLog('VideoConverter destroyed')
        }
    }
}