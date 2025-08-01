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
    // Supported video formats
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

    // Quality presets
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

    // Public attributes
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
        this.onProgress = onProgress || (() => {
        })
        this.onLog = onLog || (() => {
        })
        this.backendConfig = backendConfig || {domain: 'http://dev.lgs1920.fr', port: 3333}
        this.backendBase = `${this.backendConfig.domain}:${this.backendConfig.port}/convert`
        this.lastProgressPercentage = 0
    }

    /**
     * Returns available video formats
     * @returns {Object} Supported formats configuration
     */
    static getAvailableFormats() {
        return VideoConverter.FORMATS
    }

    /**
     * Returns available quality presets
     * @returns {Object} Quality presets configuration
     */
    static getQualityPresets() {
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
        if (!(inputFile instanceof File || inputFile instanceof Blob) || inputFile.size === 0) {
            this.onLog(`Invalid input file: type=${inputFile?.type}, size=${inputFile?.size}`)
            throw new Error('Invalid input file')
        }
        if (!VideoConverter.FORMATS[inputFormat]) {
            this.onLog(`Invalid input format: ${inputFormat}`)
            throw new Error(`Unsupported input format: ${inputFormat}`)
        }
        if (!VideoConverter.FORMATS[outputFormat]) {
            this.onLog(`Unsupported output format: ${outputFormat}`)
            throw new Error(`Unsupported output format: ${outputFormat}`)
        }

        const {quality = 'MEDIUM', outputFileName, duration} = options
        if (!VideoConverter.QUALITY_PRESETS[quality]) {
            this.onLog(`Unsupported quality preset: ${quality}`)
            throw new Error(`Unsupported quality preset: ${quality}`)
        }

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

            startTime = Date.now()

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

            // Prepare FormData for conversion
            const formData = new FormData()
            formData.append('file', inputFile, inputFileName)
            formData.append('body', JSON.stringify({
                                                       from:     inputFormat,
                                                       to:       outputFormat,
                                                       params:   args,
                                                       duration: duration,
                                                   }))

            // Send conversion request with explicit progress tracking request
            this.onLog(`Sending conversion request to ${this.backendBase}`)

            const response = await lgs.axios.post(this.backendBase, formData, {
                headers:         {
                    'Content-Type': 'multipart/form-data',
                    'Accept':              'application/octet-stream',
                    'X-Request-Progress':  'true', // Signal that we want progress updates
                    'X-Progress-Interval': '500', // Request updates every 500ms
                },
                responseType:    'blob',
                withCredentials: true,
            })

            // Get conversion ID from HTTP headers
            conversionId = response.headers['x-conversion-id']
            if (!conversionId) {
                this.onLog('No conversion ID received from HTTP headers')
                throw new Error('No conversion ID received')
            }
            this.onLog(`Received conversion ID from HTTP headers: ${conversionId}`)

            // Initialize SSE with conversionId immediately after getting the ID
            const _sseUrl = `${this.backendBase}/progress/${conversionId}`
            this.onLog(`Initializing SSE at ${_sseUrl}`)

            // Add parameters to SSE URL for better debugging
            const sseUrlWithParams = `${_sseUrl}?debug=true&interval=500`
            this.onLog(`SSE URL with params: ${sseUrlWithParams}`)

            // Add a small delay to ensure backend is ready for SSE connection
            await new Promise(resolve => setTimeout(resolve, 200))

            eventSource = new EventSource(sseUrlWithParams, {
                withCredentials: true,
            })

            // Add detailed SSE state logging
            this.onLog(`EventSource created. ReadyState: ${eventSource.readyState}`)

            ssePromise = new Promise((resolve, reject) => {
                let hasReceivedData = false
                let connectionTimeout = null
                let heartbeatTimeout = null
                let messageCount = 0
                let lastProgressTime = Date.now()

                // Set a connection timeout
                connectionTimeout = setTimeout(() => {
                    if (!hasReceivedData) {
                        this.onLog('SSE connection timeout - no data received')
                        eventSource.close()
                        reject(new Error('SSE connection timeout'))
                    }
                }, 15000) // 15 seconds timeout

                // Reset heartbeat timeout on each message
                const resetHeartbeat = () => {
                    if (heartbeatTimeout) {
                        clearTimeout(heartbeatTimeout)
                    }
                    heartbeatTimeout = setTimeout(() => {
                        if (!isDone) {
                            this.onLog(`SSE heartbeat timeout - no messages for 45s. Last message count: ${messageCount}`)
                            eventSource.close()
                            reject(new Error('SSE heartbeat timeout'))
                        }
                    }, 45000) // 45 seconds without messages
                }

                eventSource.onopen = () => {
                    this.onLog(`SSE connection opened successfully. ReadyState: ${eventSource.readyState}`)
                    hasReceivedData = true
                    if (connectionTimeout) {
                        clearTimeout(connectionTimeout)
                        connectionTimeout = null
                    }
                    resetHeartbeat()
                }

                eventSource.onmessage = (event) => {
                    messageCount++
                    const now = Date.now()
                    const timeSinceLastProgress = now - lastProgressTime

                    this.onLog(`SSE message #${messageCount} received (${timeSinceLastProgress}ms since last): ${event.data}`)
                    hasReceivedData = true
                    resetHeartbeat()

                    try {
                        const data = JSON.parse(event.data)

                        // Log all received data fields for debugging
                        this.onLog(`SSE data fields: ${Object.keys(data).join(', ')}`)

                        // Handle heartbeat/keep-alive messages
                        if (data.type === 'heartbeat' || data.type === 'keepalive') {
                            this.onLog('SSE heartbeat/keepalive received')
                            return
                        }

                        // Handle start message
                        if (data.started) {
                            this.onLog(`Conversion started for ID: ${data.conversionId}`)
                            lastProgressTime = now
                        }

                        if (data.percentage !== undefined) {
                            const progressInfo = `Progress update: ${data.percentage.toFixed(2)}% (time: ${data.timeSec || 'N/A'}s)`
                            this.onLog(progressInfo)

                            // Log progress timing
                            if (this.lastProgressPercentage !== undefined) {
                                const progressDiff = data.percentage - this.lastProgressPercentage
                                this.onLog(`Progress increment: +${progressDiff.toFixed(2)}% in ${timeSinceLastProgress}ms`)
                            }

                            this.onProgress({
                                                percentage: Number(data.percentage.toFixed(2)),
                                                time:       data.timeSec,
                                            })
                            this.lastProgressPercentage = data.percentage
                            lastProgressTime = now
                        }

                        if (data.done) {
                            this.onLog(`Conversion completed via SSE. Total messages received: ${messageCount}`)
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
                        else if (data.error) {
                            this.onLog(`SSE error message: ${data.error}`)
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
                        this.onLog(`Failed to parse SSE message #${messageCount}: ${error.message}. Raw data: ${event.data}`)
                        if (isDone) {
                            this.onLog('Ignoring parse error as conversion is complete')
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

                eventSource.onerror = (error) => {
                    this.onLog(`SSE error event for ${_sseUrl}. ReadyState: ${eventSource.readyState}, Error:`, error)

                    if (isDone) {
                        this.onLog('Ignoring SSE error as conversion is complete')
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
                        this.onLog(`SSE connection closed by server. Total messages received: ${messageCount}`)
                        if (connectionTimeout) {
                            clearTimeout(connectionTimeout)
                        }
                        if (heartbeatTimeout) {
                            clearTimeout(heartbeatTimeout)
                        }
                        reject(new Error(`SSE connection closed for ${_sseUrl}`))
                    }
                    else {
                        this.onLog(`SSE connection error, ReadyState: ${eventSource.readyState}. EventSource will try to reconnect.`)
                        // EventSource will automatically try to reconnect for CONNECTING state
                    }
                }
            })

            // Wait for SSE completion with a race condition fallback
            try {
                await Promise.race([
                                       ssePromise,
                                       // Fallback timeout in case SSE completely fails
                                       new Promise((_, reject) =>
                                                       setTimeout(() => reject(new Error('SSE process timeout after 10 minutes')), 600000),
                                       ),
                                   ])
            }
            catch (sseError) {
                this.onLog(`SSE process failed: ${sseError.message}. Conversion may still be successful.`)
                // Don't throw here - the conversion might still be successful
                // The blob response should still be valid
            }

            // Update conversion data
            const totalTime = (Date.now() - startTime) / 1000
            this.conversionTime = totalTime
            this.inputFile = inputFile
            this.outputFile = response.data
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

            this.onLog(`Conversion completed in ${totalTime.toFixed(2)}s`)
            return response.data
        }
        catch (error) {
            if (eventSource) {
                eventSource.close()
            }
            this.onLog(`Conversion failed: ${error.message}`)
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
                conversionTime:   ((Date.now() - startTime) / 1000) || 0,
                errorMessage:     error.message,
            }
            this.onProgress({percentage: 100})
            throw error
        }
    }

    /**
     * Destroys the converter instance
     */
    destroy() {
        this.onLog('VideoConverter destroyed')
    }
}