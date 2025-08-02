/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConverter.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-02
 * Last modified: 2025-08-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

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
    conversionData = {
        success:      false,
        completed:    false,
        inputFormat:  null,
        outputFormat: null,
        inputFileDetails: null,
        conversionTime: 0,
        errorMessage: null,
    }

    /**
     * Creates an instance of VideoConverter
     * @param {Object} options - Configuration options
     * @param {Function} [options.onProgress] - Callback for progress updates
     * @param {Function} [options.onLog] - Callback for logging messages
     * @param {Object} [options.backendConfig] - Backend configuration { domain, port }
     */
    constructor({onProgress, onLog, backendConfig} = {}) {
        // Initialize progress callback with default empty function
        this.onProgress = onProgress || (() => {
        })
        // Initialize logging callback with default empty function
        this.onLog = onLog || (() => {
        })
        // Set backend configuration with default values
        this.backendConfig = backendConfig || {domain: 'http://dev.lgs1920.fr', port: 3333}
        // Construct base URL for conversion API
        this.backendBase = `${this.backendConfig.domain}:${this.backendConfig.port}/convert`
        // Track last progress percentage for updates
        this.lastProgressPercentage = 0
    }

    /**
     * Returns available video formats
     * @returns {Object} Supported formats configuration
     */
    static getAvailableFormats() {
        // Return the static FORMATS configuration
        return VideoConverter.FORMATS
    }

    /**
     * Returns available quality presets
     * @returns {Object} Quality presets configuration
     */
    static getQualityPresets() {
        // Return the static QUALITY_PRESETS configuration
        return VideoConverter.QUALITY_PRESETS
    }

    /**
     * Converts a video by sending it to the remote API
     * @param {File|Blob} inputFile - Input video file
     * @param {string} inputFormat - Input format (e.g., WEBM, MP4)
     * @param {string} outputFormat - Target format (e.g., MP4, WEBM)
     * @param {Object} [options] - Conversion options
     * @param {string} [options.quality='MEDIUM'] - Quality preset
     * @param {string} [options.outputFileName] - Custom output filename
     * @param {number} [options.duration] - Video duration in milliseconds
     * @returns {Promise<Blob>} Converted video as a Blob
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
        let eventSource = null
        let isDone = false
        let conversionId = null
        let ssePromise = null
        let startTime = Date.now()

        try {
            // Initialize conversion data
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
            this.onLog(`Starting conversion: ${inputFile.name || 'input'} (${inputFormat}) → ${outputFormat} as ${outputName}`)
            this.onProgress({percentage: 0})

            // Record conversion start time
            startTime = Date.now()

            // Build FFmpeg command arguments
            const args = [
                '-c:v', format.codec,
                '-vf', format.videoFilters,
                '-preset', qualityPreset.preset,
                '-crf', qualityPreset.crf,
            ]

            // Add audio codec if specified
            if (format.audioCodec) {
                args.push('-c:a', format.audioCodec, '-b:a', '128k')
            }
            else {
                args.push('-an')
            }
            // Add extra format-specific arguments
            args.push(...format.extraArgs, '-y')

            // Prepare FormData for API request
            const formData = new FormData()
            formData.append('file', inputFile, inputFileName)
            formData.append('body', JSON.stringify({
                                                       from:     inputFormat,
                                                       to:       outputFormat,
                                                       params:   args,
                                                       duration: duration,
                                                   }))

            // Send conversion request to backend
            const response = await lgs.axios.post(this.backendBase, formData, {
                headers:      {
                    'Content-Type': 'multipart/form-data',
                    'Accept':              'application/octet-stream',
                    'X-Request-Progress':  'true', // Request progress updates
                    'X-Progress-Interval': '500', // Update interval in milliseconds
                },
                responseType: 'blob',
                withCredentials: true,
            })

            // Extract conversion ID from response headers
            conversionId = response.headers['x-conversion-id']
            if (!conversionId) {
                this.onLog('No conversion ID received from HTTP headers')
                throw new Error('No conversion ID received')
            }

            // Construct SSE URL for progress tracking
            const sseUrl = `${this.backendBase}/progress/${conversionId}?debug=true&interval=500`

            // Wait briefly to ensure backend is ready for SSE
            await new Promise(resolve => setTimeout(resolve, 200))

            // Initialize EventSource for progress updates
            eventSource = new EventSource(sseUrl, {
                withCredentials: true,
            })

            // Create promise to handle SSE events
            ssePromise = new Promise((resolve, reject) => {
                let hasReceivedData = false
                let connectionTimeout = null
                let heartbeatTimeout = null

                // Set connection timeout
                connectionTimeout = setTimeout(() => {
                    if (!hasReceivedData) {
                        eventSource.close()
                        reject(new Error('SSE connection timeout'))
                    }
                }, 15000)

                // Manage heartbeat timeout for connection health
                const resetHeartbeat = () => {
                    if (heartbeatTimeout) {
                        clearTimeout(heartbeatTimeout)
                    }
                    heartbeatTimeout = setTimeout(() => {
                        if (!isDone) {
                            eventSource.close()
                            reject(new Error('SSE heartbeat timeout'))
                        }
                    }, 45000)
                }

                // Handle SSE connection open
                eventSource.onopen = () => {
                    hasReceivedData = true
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout)
                        connectionTimeout = null
                    }
                    resetHeartbeat()
                }

                // Handle SSE messages
                eventSource.onmessage = (event) => {
                    hasReceivedData = true
                    resetHeartbeat()

                    try {
                        const data = JSON.parse(event.data)

                        // Handle heartbeat messages
                        if (data.type === 'heartbeat' || data.type === 'keepalive') {
                            return
                        }

                        // Handle conversion start
                        if (data.started) {
                            // Conversion started, no additional action needed
                        }

                        // Update progress if percentage is provided
                        if (data.percentage !== undefined) {
                            this.onProgress({
                                                percentage: Number(data.percentage.toFixed(2)),
                                                time: data.timeSec,
                                            })
                            this.lastProgressPercentage = data.percentage
                        }

                        // Handle completion
                        if (data.done) {
                            isDone = true
                            if (connectionTimeout) {
                                clearTimeout(connectionTimeout)
                            }
                            if (heartbeatTimeout) {
                                clearTimeout(heartbeatTimeout)
                            }
                            eventSource.close()
                            resolve()
                        }
                        // Handle errors
                        else if (data.error) {
                            if (connectionTimeout) {
                                clearTimeout(connectionTimeout)
                            }
                            if (heartbeatTimeout) {
                                clearTimeout(heartbeatTimeout)
                            }
                            eventSource.close()
                            reject(new Error(`Conversion failed: ${data.error}`))
                        }
                    }
                    catch (error) {
                        if (isDone) {
                            if (connectionTimeout) {
                                clearTimeout(connectionTimeout)
                            }
                            if (heartbeatTimeout) {
                                clearTimeout(heartbeatTimeout)
                            }
                            eventSource.close()
                            resolve()
                        }
                    }
                }

                // Handle SSE errors
                eventSource.onerror = (error) => {
                    if (isDone) {
                        if (connectionTimeout) {
                            clearTimeout(connectionTimeout)
                        }
                        if (heartbeatTimeout) {
                            clearTimeout(heartbeatTimeout)
                        }
                        eventSource.close()
                        resolve()
                    }
                    else if (eventSource.readyState === EventSource.CLOSED) {
                        if (connectionTimeout) {
                            clearTimeout(connectionTimeout)
                        }
                        if (heartbeatTimeout) {
                            clearTimeout(heartbeatTimeout)
                        }
                        reject(new Error('SSE connection closed by server'))
                    }
                    // EventSource will attempt to reconnect automatically
                }
            })

            // Wait for SSE completion with timeout
            try {
                await Promise.race([
                                       ssePromise,
                                       new Promise((_, reject) =>
                                                       setTimeout(() => reject(new Error('SSE process timeout after 10 minutes')), 600000)
                                       )
                                   ])
            }
            catch (sseError) {
                // SSE failure doesn't necessarily mean conversion failed
                // Continue with response processing
            }

            // Calculate total conversion time
            const totalTime = (Date.now() - startTime) / 1000

            // Update instance properties
            this.conversionTime = totalTime
            this.inputFile = inputFile
            this.outputFile = response.data

            // Update conversion data
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
                errorMessage:   null,
            }

            this.onLog(`Conversion completed in ${totalTime.toFixed(2)}s`)
            return response.data
        }
        catch (error) {
            // Clean up EventSource if it exists
            if (eventSource) {
                eventSource.close()
            }

            // Update conversion data with error information
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
                conversionTime: ((Date.now() - startTime) / 1000) || 0,
                errorMessage:   error.message,
            }

            this.onLog(`Conversion failed: ${error.message}`)
            this.onProgress({percentage: 100})
            throw error
        }
    }

    /**
     * Destroys the converter instance
     */
    destroy() {
        // Log destruction of the instance
        this.onLog('VideoConverter destroyed')
    }
}