/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConverter.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-08
 * Last modified: 2025-08-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_PROJECT } from '@Core/constants'

/**
 * VideoConverter class for converting video files using a remote API
 *
 * @class VideoConverter
 * @description Handles video conversion through a remote backend API with real-time progress tracking via Server-Sent
 *     Events (SSE) or polling
 * @example
 * const converter = new VideoConverter({
 *   onProgress: ({percentage}) => console.log(`Progress: ${percentage}%`),
 *   onLog: (message) => console.log(message),
 *   backend: 'http://localhost:3333',
 *   sse: true // Use SSE (true) or polling (false)
 * })
 *
 * const convertedBlob = await converter.convertVideo(file, 'WEBM', 'MP4', {
 *   quality: 'HIGH',
 *   outputFileName: 'my-video.mp4'
 * })
 */
export class VideoConverter {
    static FORMATS = {
        MP4:  {
            extension: 'mp4',
            codec:     'libx264',
            audioCodec: 'aac',
            mimeType:  'video/mp4',
            description: 'MP4 (H.264/AAC)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs: [
                '-movflags', '+faststart', // Enables fast playback start for streaming
            ]
        },
        WEBM: {
            extension: 'webm',
            codec:     'libvpx-vp9',
            audioCodec: 'opus',
            mimeType:  'video/webm',
            description: 'WebM (VP9/Opus)',
            videoFilters: 'format=yuv420p',
            extraArgs: [
                '-speed', '8',             // Encoding speed (higher = faster, lower quality)
                '-threads', '0',            // Use all available CPU threads
            ],
        },
        AVI:  {
            extension:    'avi',
            codec:        'mpeg4',
            audioCodec:   'mp3',
            mimeType:     'video/x-msvideo',
            description:  'AVI (MPEG-4/MP3)',
            videoFilters: 'format=yuv420p',
            extraArgs:    [
                '-qscale:v', '3',           // Variable bitrate quality (lower = better)
            ]
        }
    }

    static QUALITY_PRESETS = {
        DRAFT:   {
            crf:         '35',                    // Very low quality, suitable for fast previews
            preset:      'ultrafast',
            description: 'Draft – ultra-fast, minimal quality',
        },
        MEDIUM: {
            crf:         '25',                    // Balanced quality and encoding speed
            preset: 'veryfast',
            description: 'Medium – balanced quality/speed',
        },
        HIGH:    {
            crf:         '22',                    // High quality, slower encoding
            preset:      'fast',
            description: 'High – slower, better quality',
        },
        HIGHEST: {
            crf:         '18',                    // Maximum quality, slowest encoding
            preset:      'slow',
            description: 'Highest – best quality, slow encoding',
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
        success:      false,
        completed:    false,
        inputFormat:  null,
        outputFormat: null,
        inputFileDetails: null,
        conversionTime: 0,
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

    /**
     * Creates an instance of VideoConverter
     *
     * @param {Object} options - Configuration options
     * @param {Function} [options.onProgress] - Callback for progress updates. Receives {percentage: number, time?:
     *     number}
     * @param {Function} [options.onLog] - Callback for logging messages. Receives string message
     * @param {string} options.backend - Backend base URL (e.g., http://dev.lgs1920.fr:3333)
     * @param {boolean} [options.sse=true] - Use SSE (true) or polling (false) for progress tracking
     * @throws {Error} If backend URL is not provided
     * @memberof VideoConverter
     */
    constructor({onProgress, onLog, backend, sse = true} = {}) {
        this.onProgress = onProgress || (() => {
        })
        this.onLog = onLog || (() => {
        })
        this.#sse = sse
        if (!backend) {
            throw new Error('Backend URL is required')
        }
        // Accept backend URL as provided
        this.backend = `${backend}`
        this.convertURL = `${this.backend}/convert`
        this.lastProgressPercentage = 0
    }

    /**
     * Returns available video formats
     *
     * @static
     * @returns {Object} Supported formats configuration with codec, extension, and other settings
     * @memberof VideoConverter
     */
    static getAvailableFormats = () => {
        return VideoConverter.FORMATS
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
     * Converts a video by sending it to the remote API
     *
     * @async
     * @param {File|Blob} inputFile - Input video file to convert
     * @param {string} inputFormat - Input format key (e.g., 'WEBM', 'MP4')
     * @param {string} outputFormat - Target format key (e.g., 'MP4', 'WEBM')
     * @param {Object} [options={}] - Conversion options
     * @param {string} [options.quality='MEDIUM'] - Quality preset key ('MEDIUM', 'HIGH')
     * @param {string} [options.outputFileName] - Custom output filename
     * @param {number} [options.duration] - Video duration in milliseconds for progress calculation
     * @param {Object} [options.metadata] - Metadata key-value pairs to apply to the output video
     * @returns {Promise<Blob>} Converted video as a Blob
     * @throws {Error} If input file is invalid, format is unsupported, or conversion fails
     * @memberof VideoConverter
     */
    convertVideo = async (inputFile, inputFormat, outputFormat, options = {}) => {
        // Validate input file
        if (!(inputFile instanceof File || inputFile instanceof Blob) || inputFile.size === 0) {
            this.onLog(`Invalid input file: type=${inputFile?.type}, size=${inputFile?.size}`)
            throw new Error('Invalid input file')
        }

        // Validate input format
        if (!VideoConverter.FORMATS[inputFormat]) {
            this.onLog(`Invalid input format: ${inputFormat}`)
            throw new Error(`Unsupported input format: ${inputFormat}`)
        }

        // Validate output format
        if (!VideoConverter.FORMATS[outputFormat]) {
            this.onLog(`Unsupported output format: ${outputFormat}`)
            throw new Error(`Unsupported output format: ${outputFormat}`)
        }

        // Extract and validate options
        const {quality = 'MEDIUM', outputFileName, duration, metadata} = options
        if (!VideoConverter.QUALITY_PRESETS[quality]) {
            this.onLog(`Unsupported quality preset: ${quality}`)
            throw new Error(`Unsupported quality preset: ${quality}`)
        }

        // Get format and quality configurations
        const format = VideoConverter.FORMATS[outputFormat]
        const qualityPreset = VideoConverter.QUALITY_PRESETS[quality]
        const inputFileName = `input.${VideoConverter.FORMATS[inputFormat].extension}`
        const outputName = outputFileName || `output.${format.extension}`
        const startTime = Date.now()

        // Merge default metadata with provided metadata, prioritizing provided values
        const _defaultMetadata = {
            date:  new Date().toISOString().split('T')[0],
            album: LGS_PROJECT,
            genre: 'Adventure',
        }
        const _metadata = {..._defaultMetadata, ...metadata}

        try {
            // Initialize conversion state
            this.#resetConversionState(inputFile, inputFormat, outputFormat)
            this.onLog(`Starting conversion: ${inputFile.name || 'input'} (${inputFormat}) → ${outputFormat} as ${outputName}`)
            this.onLog(`Metadata applied: ${JSON.stringify(_metadata)}`)
            this.onProgress({percentage: 0})

            // Build FFmpeg arguments and prepare request
            const formData = this.#buildConversionRequest(inputFile, {
                inputFileName,
                format,
                qualityPreset,
                inputFormat,
                outputFormat,
                duration,
                metadata: _metadata,
            })

            // Send conversion request
            const response = await this.#sendConversionRequest(formData)
            const {conversionId, message, urls} = await response.json()
            this.sseURL = this.#sse ? `${this.backend}${urls.progress}?sse=true` : `${this.backend}${urls.progress}?sse=false`
            this.downloadURL = `${this.backend}${urls.download}`
            this.cancelURL = `${this.backend}${urls.cancel}`
            this.onLog(`Received conversion ID: ${conversionId} with message ${message}`)

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

            this.onLog(`Conversion completed in ${totalTime.toFixed(2)}s`)
            return blob
        }
        catch (error) {
            this.#cleanup()
            const totalTime = (Date.now() - startTime) / 1000
            this.#updateConversionError(inputFile, inputFormat, outputFormat, totalTime, error.message)

            this.onLog(`Conversion failed: ${error.message}`)
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
            success:          false,
            completed:        false,
            inputFormat,
            outputFormat,
            inputFileDetails: {
                name: inputFile.name || 'input',
                size: inputFile.size,
                type: inputFile.type,
            },
            conversionTime:   0,
            errorMessage:     null,
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
     * @returns {FormData} Prepared form data for the API request
     * @memberof VideoConverter
     */
    #buildConversionRequest = (inputFile, options) => {
        const {inputFileName, format, qualityPreset, inputFormat, outputFormat, duration, metadata} = options

        // Build FFmpeg command arguments
        const args = [
            '-c:v', format.codec,
            '-vf', format.videoFilters,
            '-preset', qualityPreset.preset,
            '-crf', qualityPreset.crf,
        ]

        if (format.audioCodec) {
            args.push('-c:a', format.audioCodec, '-b:a', '128k')
        }
        else {
            args.push('-an')
        }
        args.push(...format.extraArgs, '-y')

        // Prepare FormData for API request
        const formData = new FormData()
        formData.append('file', inputFile, inputFileName)
        formData.append('body', JSON.stringify({
                                                   from:   inputFormat,
                                                   to:     outputFormat,
                                                   params: args,
                                                   duration,
                                                   metadata,
                                                   verbose: false,
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
        this.onLog(`Sending POST request to ${this.convertURL}`)
        try {
            const response = await fetch(this.convertURL, {
                method:      'POST',
                body:        formData,
                credentials: 'include',
                headers:     {
                    'X-Request-Progress': 'true',
                    'X-Progress-Interval': '500',
                },
            })

            if (!response.ok) {
                const errorText = await this.#readResponseData(response)
                throw new Error(`HTTP error: ${response.status}, ${errorText}`)
            }

            this.onLog(`Received response: status=${response.status}`)
            return response
        }
        catch (error) {
            this.onLog(`Fetch error: ${error.message}`)
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
        this.onLog(`Initiating progress tracking: ${this.sseURL} (sse=${this.#sse})`)

        return new Promise((resolve, reject) => {
            // Set connection timeout
            this.#connectionTimeout = setTimeout(() => {
                if (!this.#hasReceivedData) {
                    this.#cleanup()
                    reject(new Error('Progress tracking timeout after 30s'))
                }
            }, 30000) // 30s timeout

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
            this.onLog(`Invalid SSE response format: ${text}`)
            return null
        }
        catch (error) {
            this.onLog(`Failed to parse SSE response: ${error.message}, raw: ${text}`)
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
                    headers:     {
                        'Accept': 'application/json',
                    },
                })
                if (!response.ok) {
                    const errorText = await this.#readResponseData(response)
                    this.onLog(`HTTP error: ${response.status}, response: ${errorText}`)
                    if (response.status === 500) {
                        this.onLog('Server error (500), continuing polling')
                        return
                    }
                    throw new Error(`HTTP error: ${response.status}`)
                }

                const contentType = response.headers.get('Content-Type')
                const text = await this.#readResponseData(response)
                this.onLog(`Polling response: ${text}, Content-Type: ${contentType}`)

                let eventData
                if (contentType && contentType.includes('application/json')) {
                    // Expected JSON response
                    try {
                        const data = JSON.parse(text.trim())
                        if (!data.success || !data.event || !data.data) {
                            this.onLog(`Invalid JSON response format: ${text}`)
                            return
                        }
                        eventData = {event: data.event, data: data.data}
                    }
                    catch (parseError) {
                        this.onLog(`Failed to parse JSON response: ${parseError.message}, raw: ${text}`)
                        return
                    }
                }
                else if (contentType && contentType.includes('text/event-stream')) {
                    // Fallback to parsing SSE format
                    eventData = this.#parseSseResponse(text)
                    if (!eventData) {
                        return
                    }
                }
                else {
                    this.onLog(`Unexpected Content-Type: ${contentType}, response: ${text}`)
                    return
                }

                // Simulate SSE event
                const event = {data: JSON.stringify(eventData.data)}
                console.log('Simulating SSE event:', eventData)
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
                this.onLog(`Polling error: ${error.message}`)
                if (!this.#isDone) {
                    this.#cleanup()
                    reject(new Error(`Polling failed: ${error.message}`))
                }
            }
        }

        // Start polling
        this.#pollInterval = setInterval(poll, this.#pollDelay)
        poll() // Immediate first poll
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
        this.onLog(`Cancelled event: ${event.data}`)
        try {
            const data = JSON.parse(event.data)
            this.#cleanup()
            reject(new Error(`Conversion cancelled: ${data.message}`))
        }
        catch (error) {
            this.onLog(`Failed to parse cancelled event: ${error.message}`)
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
        this.onLog(`Start event: ${event.data}`)
        try {
            const data = JSON.parse(event.data)
            this.#hasReceivedData = true
            this.#clearConnectionTimeout()
            this.#resetHeartbeatTimeout()
            this.onProgress({percentage: 0})
            this.lastProgressPercentage = 0
        }
        catch (error) {
            this.onLog(`Failed to parse start event: ${error.message}`)
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
        this.onLog(`Progress event: ${event.data}`)
        try {
            const data = JSON.parse(event.data)
            this.#hasReceivedData = true
            this.#resetHeartbeatTimeout()

            if (data.percentage !== undefined) {
                this.onLog(`Progress update: ${data.percentage.toFixed(2)}% (time: ${data.timeSec}s)`)
                this.onProgress({percentage: Number(data.percentage.toFixed(2))})
                this.lastProgressPercentage = data.percentage
            }
        }
        catch (error) {
            this.onLog(`Failed to parse progress event: ${error.message}`)
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
        this.onLog(`Complete event: ${event.data}`)


        try {
            const data = JSON.parse(event.data)
            if (data.done) {
                this.#isDone = true
                this.#cleanup()
                resolve()
            }
        }
        catch (error) {
            this.onLog(`Failed to parse complete event: ${error.message}`)
            if (this.#isDone) {
                this.onLog('Ignoring parse error as conversion is complete')
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
        this.onLog(`Error event: ${event.data}`)
        try {
            const data = JSON.parse(event.data)
            this.#cleanup()
            reject(new Error(`Conversion failed: ${data.error}`))
        }
        catch (error) {
            this.onLog(`Failed to parse error event: ${error.message}`)
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
        this.onLog('SSE heartbeat received')
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
        this.onLog(`SSE connection error for ${this.sseURL}. ReadyState: ${this.#eventSource?.readyState}`)
        if (this.#isDone) {
            this.onLog('Ignoring SSE error as conversion is complete')
            this.#cleanup()
            resolve()
        }
        else {
            this.onLog('SSE connection failed before conversion completion')
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
        } // No heartbeat in polling mode
        if (this.#heartbeatTimeout) {
            clearTimeout(this.#heartbeatTimeout)
        }
        this.#heartbeatTimeout = setTimeout(() => {
            if (!this.#isDone) {
                this.#cleanup()
                this.onLog('SSE heartbeat timeout after 45s')
            }
        }, 45000) // 45s timeout
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
            success:          true,
            completed:        true,
            inputFormat,
            outputFormat,
            inputFileDetails: {
                name: inputFile.name || 'input',
                size: inputFile.size,
                type: inputFile.type,
            },
            conversionTime:   totalTime,
            errorMessage:     null,
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
            success:          false,
            completed:        true,
            inputFormat,
            outputFormat,
            inputFileDetails: {
                name: inputFile.name || 'input',
                size: inputFile.size,
                type: inputFile.type,
            },
            conversionTime:   totalTime || 0,
            errorMessage:     errorMessage,
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
        this.onLog('VideoConverter destroyed')
    }
}