/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConverter.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-27
 * Last modified: 2025-07-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

    // VideoConverter class for converting video files using FFmpeg.wasm
export class VideoConverter {
    // Supported video formats with optimized configurations for SPEED
    static FORMATS = {
        MP4:  {
            extension:    'mp4',
            codec:        'libx264',
            audioCodec:   'aac',
            mimeType:     'video/mp4',
            description:  'MP4 (H.264/AAC)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:  [
                '-movflags', '+faststart',
                '-tune', 'zerolatency',
                '-x264-params', 'ref=1:bframes=0:me=dia:subme=1:trellis=0',
                '-threads', '0',
                '-preset', 'ultrafast',
            ],
            timeFactor: 0.5,
        },
        WEBM: {
            extension:    'webm',
            codec:        'libvpx-vp9',
            audioCodec:   'opus',
            mimeType:     'video/webm',
            description:  'WebM (VP9/Opus)',
            videoFilters: 'format=yuv420p',
            extraArgs:    [
                '-speed', '8',
                '-tile-columns', '4',
                '-frame-parallel', '1',
                '-threads', '0',
                '-deadline', 'realtime',
                '-cpu-used', '8',
            ],
            timeFactor:   0.6,
        },
        AVI:  {
            extension:    'avi',
            codec:        'mpeg4',
            audioCodec:   'mp3',
            mimeType:     'video/x-msvideo',
            description:  'AVI (MPEG-4/MP3)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:  [
                '-threads', '0',
                '-qscale:v', '5',
            ],
            timeFactor: 0.3,
        },
        MOV:  {
            extension:    'mov',
            codec:        'libx264',
            audioCodec:   'aac',
            mimeType:     'video/quicktime',
            description:  'MOV (H.264/AAC)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:  [
                '-movflags', '+faststart',
                '-tune', 'zerolatency',
                '-preset', 'ultrafast',
                '-threads', '0',
            ],
            timeFactor: 0.5,
        },
    }

    // Quality presets optimized for SPEED over quality
    static QUALITY_PRESETS = {
        DRAFT:     {
            crf:         '30',
            preset:      'ultrafast',
            description: 'Draft - very fast',
            timeFactor:  0.2,
        },
        LOW:       {
            crf:         '28',
            preset:      'ultrafast',
            description: 'Low - fast',
            timeFactor:  0.3,
        },
        MEDIUM: {
            crf:        '25',
            preset:     'veryfast',
            description: 'Medium - balanced',
            timeFactor: 0.5,
        },
        HIGH:      {
            crf:         '22',
            preset:      'fast',
            description: 'High - slower',
            timeFactor:  0.8,
        },
        EXCELLENT: {
            crf:         '19',
            preset:      'medium',
            description: 'Excellent - slow',
            timeFactor:  1.2,
        },
        PERFECT:   {
            crf:         '16',
            preset:      'slow',
            description: 'Perfect - very slow',
            timeFactor:  2.0,
        },
    }

    // Public attributes
    conversionTime = 0
    inputFile = null
    outputFile = null
    conversionData = {
        success:          false,
        completed:        false,
        inputFormat:      null,
        outputFormat:     null,
        inputFileDetails: null,
        conversionTime:   0,
        errorMessage:     null,
    }

    /**
     * Creates an instance of VideoConverter
     * @param {Object} options - Configuration options
     * @param {Function} [options.onProgress] - Callback for progress updates
     * @param {Function} [options.onLog] - Callback for logging messages
     */
    constructor({onProgress, onLog} = {}) {
        this.ffmpeg = null
        this.isLoaded = false
        this.onProgress = onProgress || (() => {
        })
        this.onLog = onLog || (() => {
        })
        this.currentConversion = null
        this.progressFallback = {
            startTime:         null,
            estimatedDuration: null,
            lastValidProgress: 0,
        }
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
     * Loads FFmpeg.wasm and initializes the instance with speed optimizations
     * @throws {Error} If FFmpeg loading fails
     */
    async loadFFmpeg() {
        if (this.isLoaded) {
            this.onLog('FFmpeg already loaded')
            return
        }
        try {
            this.onLog('Loading FFmpeg.wasm...')
            const {FFmpeg} = await import('@ffmpeg/ffmpeg')
            const {fetchFile, toBlobURL} = await import('@ffmpeg/util')
            this.ffmpeg = new FFmpeg()
            this.fetchFile = fetchFile
            this.toBlobURL = toBlobURL

            // Optimize log handling - only log errors
            this.ffmpeg.on('log', ({type, message}) => {
                if (type === 'error') {
                    this.onLog(`[${type}] ${message}`)
                }
            })

            this.ffmpeg.on('progress', (event) => {
                const {progress, time} = event

                if (this.currentConversion) {
                    let percentage = 0

                    // Improved time-based progress calculation
                    if (time && this.currentConversion.videoDuration) {
                        const timeInSeconds = time / 1000000
                        const timeBasedProgress = Math.min(timeInSeconds / this.currentConversion.videoDuration, 1)
                        percentage = Math.round(timeBasedProgress * 90)
                        this.progressFallback.lastValidProgress = percentage
                    }
                    else if (progress >= 0 && progress <= 1 && !isNaN(progress)) {
                        // Use FFmpeg progress if valid
                        percentage = Math.round(progress * 90)
                        this.progressFallback.lastValidProgress = percentage
                    }
                    else {
                        // Fallback to time estimation
                        const elapsed = Date.now() - this.currentConversion.startTime
                        const estimatedProgress = Math.min(this.progressFallback.lastValidProgress + (elapsed / 10000) * 5, 90)
                        percentage = Math.round(estimatedProgress)
                    }

                    percentage = Math.max(0, Math.min(90, percentage))
                    this.onProgress({percentage, time: time || 0})
                }
            })

            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
            const coreURL = await this.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
            const wasmURL = await this.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')

            await this.ffmpeg.load({coreURL, wasmURL})
            this.isLoaded = true
            this.onLog('FFmpeg loaded successfully')
        }
        catch (error) {
            this.onLog(`Failed to load FFmpeg: ${error.message}`)
            throw new Error(`Failed to load FFmpeg: ${error.message}`)
        }
    }

    /**
     * Estimates the conversion time (optimized for speed)
     * @param {File|Blob} inputFile - Input video file (WebM)
     * @param {string} outputFormat - Target format (MP4, WEBM, AVI, MOV)
     * @param {string} [quality='MEDIUM'] - Quality preset
     * @returns {Promise<number>} Estimated conversion time in seconds
     */
    async getEstimatedTime(inputFile, outputFormat, quality = 'MEDIUM') {
        if (!(inputFile instanceof File || inputFile instanceof Blob)) {
            throw new Error('Input must be a File or Blob')
        }
        if (!inputFile.type.includes('webm') && !inputFile.name?.toLowerCase().endsWith('.webm')) {
            throw new Error('Input file must be WebM format')
        }
        if (!VideoConverter.FORMATS[outputFormat]) {
            throw new Error(`Unsupported output format: ${outputFormat}`)
        }
        if (!VideoConverter.QUALITY_PRESETS[quality]) {
            throw new Error(`Unsupported quality preset: ${quality}`)
        }

        try {
            // Quick estimation without full video info for speed
            const fileSizeMB = inputFile.size / 1000000
            const format = VideoConverter.FORMATS[outputFormat]
            const qualityPreset = VideoConverter.QUALITY_PRESETS[quality]

            // Simplified estimation based on file size
            const baseTime = Math.max(5, fileSizeMB * 0.1)
            const estimatedTime = baseTime * format.timeFactor * qualityPreset.timeFactor

            this.onLog(`Quick estimated conversion time: ${estimatedTime.toFixed(2)}s for ${fileSizeMB.toFixed(2)}MB file`)
            return Math.max(3, estimatedTime)
        }
        catch (error) {
            this.onLog(`Failed to estimate conversion time: ${error.message}`)
            return 10
        }
    }

    /**
     * Converts a WebM video with maximum speed optimizations
     * @param {File|Blob} inputFile - Input video file (WebM)
     * @param {string} outputFormat - Target format (MP4, WEBM, AVI, MOV)
     * @param {Object} [options] - Conversion options
     * @param {string} [options.quality='MEDIUM'] - Quality preset
     * @param {string} [options.outputFileName] - Custom output filename
     * @param {boolean} [options.fastMode=true] - Enable maximum speed mode
     * @returns {Promise<Blob>} Converted video as a Blob
     */
    async convertVideo(inputFile, outputFormat, options = {}) {
        if (!this.isLoaded) {
            await this.loadFFmpeg()
        }

        // Input validation with early returns
        if (!(inputFile instanceof File || inputFile instanceof Blob) || inputFile.size === 0) {
            throw new Error('Invalid input file')
        }
        if (!inputFile.type.includes('webm') && !inputFile.name?.toLowerCase().endsWith('.webm')) {
            throw new Error('Input file must be WebM format')
        }

        const {quality = 'MEDIUM', outputFileName, fastMode = true} = options

        if (!VideoConverter.FORMATS[outputFormat] || !VideoConverter.QUALITY_PRESETS[quality]) {
            throw new Error('Invalid format or quality preset')
        }

        const format = VideoConverter.FORMATS[outputFormat]
        const qualityPreset = VideoConverter.QUALITY_PRESETS[quality]
        const inputFileName = 'input.webm'
        const outputName = outputFileName || `output.${format.extension}`

        try {
            this.conversionData.success = false
            this.conversionData.completed = false

            this.onLog(`Starting FAST conversion: ${inputFile.name || 'WebM'} → ${outputFormat}`)
            this.onProgress({percentage: 0, time: 0})

            const startTime = Date.now()

            // Get basic video info first
            let videoDuration = null
            let hasAudio = false
            try {
                const quickInfo = await this.getVideoInfo(inputFile)
                videoDuration = quickInfo.duration
                hasAudio = quickInfo.audioStream !== undefined
                this.onLog(`Video info: duration=${videoDuration}s, hasAudio=${hasAudio}`)
            }
            catch (e) {
                this.onLog(`Warning: Could not get video info: ${e.message}`)
                videoDuration = Math.max(10, inputFile.size / 1000000)
                hasAudio = true
            }

            this.currentConversion = {
                startTime,
                inputFileName,
                outputName,
                videoDuration,
            }

            // Write input file
            const inputData = await this.fetchFile(inputFile)
            await this.ffmpeg.writeFile(inputFileName, inputData)
            this.onProgress({percentage: 10, time: 0})

            // Build FFmpeg command
            const args = [
                '-i', inputFileName,
                '-c:v', format.codec,
            ]

            // Add codec-specific parameters based on format
            if (format.codec === 'libx264') {
                args.push(
                    '-vf', format.videoFilters,
                    '-preset', qualityPreset.preset,
                    '-crf', qualityPreset.crf,
                )
                if (fastMode) {
                    args.push('-x264-params', 'ref=1:bframes=0:me=dia:subme=1:trellis=0')
                }
            }
            else if (format.codec === 'mpeg4') {
                args.push(
                    '-vf', format.videoFilters,
                    '-qscale:v', '5',
                )
            }
            else if (format.codec === 'libvpx-vp9') {
                args.push(
                    '-vf', format.videoFilters,
                    '-speed', '8',
                    '-cpu-used', '8',
                )
            }

            // Handle audio
            if (hasAudio && format.audioCodec) {
                args.push('-c:a', format.audioCodec, '-b:a', '128k')
            }
            else {
                args.push('-an')
            }

            // Add format-specific extra args
            if (format.extraArgs) {
                args.push(...format.extraArgs)
            }

            // Final parameters
            args.push(
                '-map_metadata', '-1',
                '-avoid_negative_ts', 'make_zero',
                '-y',
                outputName,
            )

            this.onLog(`FFmpeg command: ffmpeg ${args.join(' ')}`)

            // Execute conversion
            const execStart = Date.now()
            const result = await this.ffmpeg.exec(args)
            const execDuration = (Date.now() - execStart) / 1000

            if (result !== 0) {
                this.onLog(`FFmpeg execution failed with code ${result}`)

                // Try fallback command
                this.onLog('Trying fallback conversion...')
                const fallbackArgs = [
                    '-i', inputFileName,
                    '-c:v', 'libx264',
                    '-vf', 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
                    '-preset', 'ultrafast',
                    '-crf', '28',
                    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
                    '-y',
                    outputName,
                ]

                this.onLog(`Fallback command: ffmpeg ${fallbackArgs.join(' ')}`)
                const fallbackResult = await this.ffmpeg.exec(fallbackArgs)

                if (fallbackResult !== 0) {
                    throw new Error(`FFmpeg failed with code ${result}, fallback also failed with code ${fallbackResult}`)
                }
            }

            this.onProgress({percentage: 90, time: 0})

            // Read output
            const outputData = await this.ffmpeg.readFile(outputName)
            if (!outputData || outputData.byteLength === 0) {
                throw new Error('Output file is empty')
            }

            const outputBlob = new Blob([outputData], {type: format.mimeType})

            // Log performance metrics
            const totalTime = (Date.now() - startTime) / 1000
            const compressionRatio = ((1 - outputBlob.size / inputFile.size) * 100)

            this.onLog(`FAST conversion completed in ${totalTime.toFixed(2)}s`)
            this.onLog(`Input: ${(inputFile.size / 1000000).toFixed(2)}MB → Output: ${(outputBlob.size / 1000000).toFixed(2)}MB`)
            this.onLog(`Compression: ${compressionRatio.toFixed(1)}%, Speed: ${(inputFile.size / 1000000 / totalTime).toFixed(2)} MB/s`)

            this.conversionData.success = true
            this.conversionData.completed = true
            this.conversionData.conversionTime = totalTime

            this.onProgress({percentage: 100, time: 0})
            return outputBlob

        }
        catch (error) {
            this.onLog(`FAST conversion failed: ${error.message}`)
            this.conversionData.success = false
            this.conversionData.completed = true
            this.conversionData.errorMessage = error.message
            throw error
        }
        finally {
            await this.#cleanupFile(inputFileName)
            await this.#cleanupFile(outputName)
            this.currentConversion = null
        }
    }

    /**
     * Cleans up a file from FFmpeg's virtual filesystem
     * @param {string} path - File path to clean up
     * @private
     */
    async #cleanupFile(path) {
        try {
            if (this.ffmpeg && path) {
                await this.ffmpeg.deleteFile(path)
                this.onLog(`File cleaned up: ${path}`)
            }
        }
        catch (error) {
            this.onLog(`Cleanup failed for ${path}: ${error.message}`)
        }
    }

    /**
     * Gets basic video info quickly (optimized version)
     * @param {File|Blob} videoFile - Input video file
     * @returns {Promise<Object>} Basic video metadata
     */
    async getVideoInfo(videoFile) {
        if (!this.isLoaded) {
            await this.loadFFmpeg()
        }

        const inputFileName = 'info_input.webm'
        let logOutput = ''

        try {
            const logHandler = ({message}) => {
                logOutput += message + '\n'
            }

            this.ffmpeg.on('log', logHandler)

            const inputData = await this.fetchFile(videoFile)
            await this.ffmpeg.writeFile(inputFileName, inputData)

            // Quick probe with timeout
            await Promise.race([
                                   this.ffmpeg.exec(['-i', inputFileName, '-t', '0.1', '-f', 'null', '-']),
                                   new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
                               ])

            const info = this._parseFFmpegLog(logOutput)
            info.size = videoFile.size
            info.type = videoFile.type
            info.name = videoFile.name
            info.audioStream = logOutput.includes('Audio:') ? true : undefined

            return info

        }
        catch (error) {
            // Return basic fallback info
            return {
                duration: Math.max(10, videoFile.size / 2000000),
                size:     videoFile.size,
                type:     videoFile.type,
                name:     videoFile.name,
                error:    error.message,
            }
        }
        finally {
            this.ffmpeg.off('log')
            await this._cleanupFile(inputFileName)
        }
    }

    /**
     * Cleanup file (fire and forget for speed)
     * @param {string} path - File path
     * @private
     */
    async _cleanupFile(path) {
        try {
            if (this.ffmpeg) {
                // Don't wait for cleanup to complete
                this.ffmpeg.deleteFile(path).catch(() => {
                })
            }
        }
        catch (error) {
            // Ignore cleanup errors
        }
    }

    /**
     * Parse FFmpeg log (simplified)
     * @param {string} log - FFmpeg log
     * @returns {Object} Parsed info
     * @private
     */
    _parseFFmpegLog(log) {
        const info = {}

        // Quick duration extraction
        const durationMatch = log.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        if (durationMatch) {
            info.duration = parseInt(durationMatch[1]) * 3600 +
                parseInt(durationMatch[2]) * 60 +
                parseFloat(durationMatch[3])
        }

        // Quick resolution extraction
        const resolutionMatch = log.match(/(\d{3,4})x(\d{3,4})/)
        if (resolutionMatch) {
            info.resolution = {
                width: parseInt(resolutionMatch[1]),
                height: parseInt(resolutionMatch[2]),
            }
        }

        return info
    }

    /**
     * Destroy converter
     */
    destroy() {
        if (this.ffmpeg) {
            this.ffmpeg.terminate()
            this.ffmpeg = null
        }
        this.isLoaded = false
        this.currentConversion = null
        this.onLog('VideoConverter destroyed')
    }
}