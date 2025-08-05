/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConverter.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-05
 * Last modified: 2025-08-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoConverter class for converting video files using a remote API
 *
 * @class VideoConverter
 * @description Handles video conversion through a remote backend API with real-time progress tracking via Server-Sent
 *     Events (SSE)
 * @example
 * const converter = new VideoConverter({
 *   onProgress: ({percentage}) => console.log(`Progress: ${percentage}%`),
 *   onLog: (message) => console.log(message),
 *   backend: 'http://localhost:3333'
 * });
 *
 * const convertedBlob = await converter.convertVideo(file, 'WEBM', 'MP4', {
 *   quality: 'HIGH',
 *   outputFileName: 'my-video.mp4'
 * });
 */
export class VideoConverter {
    // Supported video formats configuration
    static FORMATS = {
        MP4:  {
            extension:  'mp4',
            codec:      'libx264',
            audioCodec: 'aac',
            mimeType:   'video/mp4',
            description: 'MP4 (H.264/AAC)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:  [
                '-movflags', '+faststart',
                '-preset', 'ultrafast',
            ]
        },
        WEBM: {
            extension:  'webm',
            codec:      'libvpx-vp9',
            audioCodec: 'opus',
            mimeType:   'video/webm',
            description: 'WebM (VP9/Opus)',
            videoFilters: 'format=yuv420p',
            extraArgs:  [
                '-speed', '8',
                '-threads', '0',
            ]
        }
    }

    // Quality presets configuration
    static QUALITY_PRESETS = {
        MEDIUM: {
            crf: '25',
            preset: 'veryfast',
            description: 'Medium - balanced',
        },
        HIGH:   {
            crf:         '22',
            preset:      'fast',
            description: 'High - slower',
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

    /**
     * Creates an instance of VideoConverter
     *
     * @param {Object} options - Configuration options
     * @param {Function} [options.onProgress] - Callback for progress updates. Receives {percentage: number, time?:
     *     number}
     * @param {Function} [options.onLog] - Callback for logging messages. Receives string message
     * @param {string} options.backend - Backend base URL (e.g., http://dev.lgs1920.fr:3333)
     * @throws {Error} If backend URL is not provided
     * @memberof VideoConverter
     */
    constructor({onProgress, onLog, backend} = {}) {
        this.onProgress = onProgress || (() => {
        })
        this.onLog = onLog || (() => {
        })
        if (!backend) {
            throw new Error('Backend URL is required')
        }
        // Accept backend URL as provided (e.g., http://dev.lgs1920.fr:3333)
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
    static getAvailableFormats() {
        return VideoConverter.FORMATS
    }

    /**
     * Returns available quality presets
     *
     * @static
     * @returns {Object} Quality presets configuration with CRF values and descriptions
     * @memberof VideoConverter
     */
    static getQualityPresets() {
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
     * @returns {Promise<Blob>} Converted video as a Blob
     * @throws {Error} If input file is invalid, format is unsupported, or conversion fails
     * @memberof VideoConverter
     */
    async convertVideo(inputFile, inputFormat, outputFormat, options = {}) {
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
        const {quality = 'MEDIUM', outputFileName, duration} = options
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

        try {
            // Initialize conversion state
            this.#resetConversionState(inputFile, inputFormat, outputFormat)
            this.onLog(`Starting conversion: ${inputFile.name || 'input'} (${inputFormat}) → ${outputFormat} as ${outputName}`)
            this.onProgress({percentage: 0})

            // Build FFmpeg arguments and prepare request
            const formData = this.#buildConversionRequest(inputFile, inputFileName, format, qualityPreset, inputFormat, outputFormat, duration)

            // Send conversion request
            const response = await this.#sendConversionRequest(formData)
            const {conversionId, message, urls} = JSON.parse(await response.data.text())
            this.sseURL = `${this.backend}${urls.progress}?sse=true`
            this.downloadURL = `${this.backend}${urls.progress}`
            this.cancelURL = `${this.backend}${urls.cancel}`
            console.log(this.backend)
            this.onLog(`Received conversion ID: ${conversionId} with message ${message}`)

            // Initialize and wait for SSE completion
            await this.#initializeSSEConnection()

            // Calculate and update final conversion data
            const totalTime = (Date.now() - startTime) / 1000
            this.#updateConversionSuccess(inputFile, inputFormat, outputFormat, totalTime)

            this.onLog(`Conversion completed in ${totalTime.toFixed(2)}s`)
            return response.data
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
     * @param {Object} response - Axios response object
     * @returns {Promise<string>} Response data as string
     * @private
     * @memberof VideoConverter
     */
    async #readResponseData(response) {
        if (!response.data) {
            return 'No data'
        }
        if (response.data instanceof Blob) {
            return await response.data.text()
        }
        return JSON.stringify(response.data)
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
    #resetConversionState(inputFile, inputFormat, outputFormat) {
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
     * @param {string} inputFileName - Input filename
     * @param {Object} format - Output format configuration
     * @param {Object} qualityPreset - Quality preset configuration
     * @param {string} inputFormat - Input format key
     * @param {string} outputFormat - Output format key
     * @param {number} [duration] - Video duration in milliseconds
     * @returns {FormData} Prepared form data for the API request
     * @memberof VideoConverter
     */
    #buildConversionRequest(inputFile, inputFileName, format, qualityPreset, inputFormat, outputFormat, duration) {
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
                                                   from:     inputFormat,
                                                   to:       outputFormat,
                                                   params:   args,
                                                   duration: duration,
                                                   verbose:  false, // Enable verbose logging for debugging
                                               }))

        return formData
    }

    /**
     * Sends the conversion request to the backend API
     *
     * @private
     * @async
     * @param {FormData} formData - Form data to send
     * @returns {Promise<Object>} Axios response object
     * @throws {Error} If the request fails
     * @memberof VideoConverter
     */
    async #sendConversionRequest(formData) {
        this.onLog(`Sending POST request to ${this.convertURL}`)
        try {
            const response = await lgs.axios.post(this.convertURL, formData, {
                headers:      {
                    'Content-Type':        'multipart/form-data',
                    'Accept':              'application/octet-stream',
                    'X-Request-Progress':  'true',
                    'X-Progress-Interval': '500',
                },
                responseType: 'blob',
                withCredentials: true,
            })

            this.onLog(`Received response: status=${response.status}, headers=${JSON.stringify(response.headers)}`)
            return response
        }
        catch (axiosError) {
            let errorDetails = `Axios POST error: ${axiosError.message}`
            if (axiosError.response) {
                errorDetails += `, status: ${axiosError.response.status}, data: ${await this.#readResponseData(axiosError.response)}`
            }
            this.onLog(errorDetails)
            throw new Error(`Failed to send conversion request: ${axiosError.message}`)
        }
    }

    /**
     * Initializes the Server-Sent Events connection for progress tracking
     *
     * @private
     * @async
     * @returns {Promise<void>} Resolves when conversion is complete
     * @throws {Error} If SSE connection fails or times out
     * @memberof VideoConverter
     */
    async #initializeSSEConnection() {
        this.onLog(`Initiating SSE connection: ${this.sseURL}`)
        this.#eventSource = new EventSource(this.sseURL, {
            withCredentials: true,
        })

        return new Promise((resolve, reject) => {
            // Set connection timeout
            this.#connectionTimeout = setTimeout(() => {
                if (!this.#hasReceivedData) {
                    this.#cleanup()
                    reject(new Error('SSE connection timeout after 30s'))
                }
            }, 30000) // 30s timeout

            // Setup event listeners
            this.#setupSSEEventListeners(resolve, reject)
        })
    }

    /**
     * Sets up all Server-Sent Events listeners
     *
     * @private
     * @param {Function} resolve - Promise resolve function
     * @param {Function} reject - Promise reject function
     * @memberof VideoConverter
     */
    #setupSSEEventListeners(resolve, reject) {
        this.#eventSource.addEventListener('start', (event) => this.#handleStartEvent(event))
        this.#eventSource.addEventListener('progress', (event) => this.#handleProgressEvent(event))
        this.#eventSource.addEventListener('complete', (event) => this.#handleCompleteEvent(event, resolve))
        this.#eventSource.addEventListener('error', (event) => this.#handleErrorEvent(event, reject))
        this.#eventSource.addEventListener('heartbeat', (event) => this.#handleHeartbeatEvent(event))

        this.#eventSource.onerror = () => this.#handleConnectionError(resolve, reject)
    }

    /**
     * Handles SSE 'start' event
     *
     * @private
     * @param {Event} event - SSE event object
     * @memberof VideoConverter
     */
    #handleStartEvent(event) {
        this.onLog(`SSE start event: ${event.data}`)
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
     * Handles SSE 'progress' event
     *
     * @private
     * @param {Event} event - SSE event object
     * @memberof VideoConverter
     */
    #handleProgressEvent(event) {
        this.onLog(`SSE progress event: ${event.data}`)
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
     * Handles SSE 'complete' event
     *
     * @private
     * @param {Event} event - SSE event object
     * @param {Function} resolve - Promise resolve function
     * @memberof VideoConverter
     */
    #handleCompleteEvent(event, resolve) {
        this.onLog(`SSE complete event: ${event.data}`)
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
     * Handles SSE 'error' event
     *
     * @private
     * @param {Event} event - SSE event object
     * @param {Function} reject - Promise reject function
     * @memberof VideoConverter
     */
    #handleErrorEvent(event, reject) {
        this.onLog(`SSE error event for ${this.sseURL}. ReadyState: ${this.#eventSource.readyState}, Error: ${event.data || 'No data'}`)
        try {
            const data = event.data ? JSON.parse(event.data) : {error: 'Unknown SSE error'}
            this.#cleanup()
            reject(new Error(`Conversion failed: ${data.error}`))
        }
        catch (error) {
            this.onLog(`Failed to parse error event: ${error.message}`)
            this.#cleanup()
            reject(new Error(`SSE error: ${error.message}`))
        }
    }

    /**
     * Handles SSE 'heartbeat' event
     *
     * @private
     * @param {Event} event - SSE event object
     * @memberof VideoConverter
     */
    #handleHeartbeatEvent(event) {
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
    #handleConnectionError(resolve, reject) {
        this.onLog(`SSE connection error for ${this.sseURL}. ReadyState: ${this.#eventSource.readyState}`)
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
    #resetHeartbeatTimeout() {
        if (this.#heartbeatTimeout) {
            clearTimeout(this.#heartbeatTimeout)
        }
        this.#heartbeatTimeout = setTimeout(() => {
            if (!this.#isDone) {
                this.#cleanup()
                // Note: This should trigger a rejection, but we're in a timeout context
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
    #clearConnectionTimeout() {
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
    #updateConversionSuccess(inputFile, inputFormat, outputFormat, totalTime) {
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
    #updateConversionError(inputFile, inputFormat, outputFormat, totalTime, errorMessage) {
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
     * Cleans up resources (event source, timeouts)
     *
     * @private
     * @memberof VideoConverter
     */
    #cleanup() {
        if (this.#eventSource) {
            this.#eventSource.close()
            this.#eventSource = null
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
    destroy() {
        this.#cleanup()
        this.onLog('VideoConverter destroyed')
    }
}