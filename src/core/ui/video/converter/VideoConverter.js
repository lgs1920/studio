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
import { SECOND }    from '@Core/constants'
import { UIToast }   from '@Utils/UIToast'
import { UnitUtils } from '@Utils/UnitUtils'

// VideoConverter class for converting video files using FFmpeg.wasm
export class VideoConverter {
    // Supported video formats with their configurations
    static FORMATS = {
        MP4:  {
            extension:    'mp4',
            codec:        'libx264',
            audioCodec:   'aac',
            mimeType:     'video/mp4',
            description:  'MP4 (H.264/AAC)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:  ['-movflags', '+faststart', '-progress', 'pipe:2'],
            timeFactor: 1.0,
        },
        WEBM: {
            extension:    'webm',
            codec:        'libvpx-vp9',
            audioCodec:   'opus',
            mimeType:     'video/webm',
            description:  'WebM (VP9/Opus)',
            videoFilters: 'format=vp9',
            extraArgs:  ['-progress', 'pipe:2'],
            timeFactor: 1.2,
        },
        AVI:  {
            extension:    'avi',
            codec:        'mpeg4',
            audioCodec:   'mp3',
            mimeType:     'video/x-msvideo',
            description:  'AVI (MPEG-4/MP3)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:  ['-progress', 'pipe:2'],
            timeFactor: 0.9,
        },
        MOV:  {
            extension:    'mov',
            codec:        'libx264',
            audioCodec:   'aac',
            mimeType:     'video/quicktime',
            description:  'MOV (H.264/AAC)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:  ['-progress', 'pipe:2'],
            timeFactor: 1.0,
        },
    }

    // Quality presets for video conversion
    static QUALITY_PRESETS = {
        LOW:    {
            crf:         '28',
            preset:      'veryfast',
            description: 'Low - fast ',
            timeFactor: 0.7,
        },
        MEDIUM: {
            crf:         '23',
            preset:      'fast',
            description: 'Medium - balanced',
            timeFactor: 1.0,
        },
        HIGH:   {
            crf:         '18',
            preset:      'medium',
            description: 'High - slower',
            timeFactor: 1.5,
        },
        ULTRA:  {
            crf:         '15',
            preset:      'slow',
            description: 'Ultra - slowest',
            timeFactor: 2.0,
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
     * Loads FFmpeg.wasm and initializes the instance
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
            this.ffmpeg.on('log', ({type, message}) => {
                this.onLog(`[${type}] ${message}`)
            })
            this.ffmpeg.on('progress', (event) => {
                const {progress, time} = event
                this.onLog(`Raw FFmpeg progress event: ${JSON.stringify(event)}`)

                if (this.currentConversion) {
                    let percentage = 0

                    // Use time-based progress since progress is unreliable
                    if (time && this.currentConversion.videoDuration) {
                        const timeInSeconds = time / 1000000
                        const timeBasedProgress = Math.min(timeInSeconds / this.currentConversion.videoDuration, 1)
                        percentage = Math.round(timeBasedProgress * 90) // Cap at 90% during FFmpeg processing
                        this.progressFallback.lastValidProgress = percentage
                    }
                    else {
                        const elapsed = Date.now() - this.currentConversion.startTime
                        const estimatedProgress = Math.min(this.progressFallback.lastValidProgress + (elapsed / 30000) * 10, 90)
                        percentage = Math.round(estimatedProgress)
                        this.onLog('Warning: Using elapsed time estimation due to missing videoDuration or invalid time')
                    }

                    percentage = Math.max(0, Math.min(90, percentage))
                    this.onProgress({percentage, time: time || 0})
                }
            })
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
            const coreURL = await this.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
            const wasmURL = await this.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
            this.onLog(`Core URL: ${coreURL}`)
            this.onLog(`WASM URL: ${wasmURL}`)
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
     * Estimates the conversion time for a given video file
     * @param {File|Blob} inputFile - Input video file (WebM)
     * @param {string} outputFormat - Target format (MP4, WEBM, AVI, MOV)
     * @param {string} [quality='MEDIUM'] - Quality preset (LOW, MEDIUM, HIGH, ULTRA)
     * @returns {Promise<number>} Estimated conversion time in seconds
     * @throws {Error} If estimation fails
     */
    async getEstimatedTime(inputFile, outputFormat, quality = 'MEDIUM') {
        if (!(inputFile instanceof File || inputFile instanceof Blob)) {
            this.onLog('Input must be a File or Blob')
            throw new Error('Input must be a File or Blob')
        }
        if (!inputFile.type.includes('webm') && !inputFile.name.toLowerCase().endsWith('.webm')) {
            this.onLog('Input file must be WebM format')
            throw new Error('Input file must be WebM format')
        }
        if (!VideoConverter.FORMATS[outputFormat]) {
            this.onLog(`Unsupported output format: ${outputFormat}`)
            throw new Error(`Unsupported output format: ${outputFormat}`)
        }
        if (!VideoConverter.QUALITY_PRESETS[quality]) {
            this.onLog(`Unsupported quality preset: ${quality}`)
            throw new Error(`Unsupported quality preset: ${quality}`)
        }

        try {
            const videoInfo = await this.getVideoInfo(inputFile)
            const duration = videoInfo.duration || 60
            const fileSizeMB = inputFile.size / 1000000
            const format = VideoConverter.FORMATS[outputFormat]
            const qualityPreset = VideoConverter.QUALITY_PRESETS[quality]

            const baseTime = duration * format.timeFactor * qualityPreset.timeFactor
            const sizeFactor = Math.max(1, fileSizeMB / 100)
            let estimatedTime = baseTime * sizeFactor
            estimatedTime += 5
            estimatedTime = Math.max(10, estimatedTime)

            this.onLog(`Estimated conversion time: ${estimatedTime.toFixed(2)}s for ${inputFile.name} (${outputFormat}, ${quality})`)
            return estimatedTime
        }
        catch (error) {
            this.onLog(`Failed to estimate conversion time: ${error.message}`)
            throw new Error(`Failed to estimate conversion time: ${error.message}`)
        }
    }

    /**
     * Converts a WebM video to the specified format
     * @param {File|Blob} inputFile - Input video file (WebM)
     * @param {string} outputFormat - Target format (MP4, WEBM, AVI, MOV)
     * @param {Object} [options] - Conversion options
     * @param {string} [options.quality='MEDIUM'] - Quality preset (LOW, MEDIUM, HIGH, ULTRA)
     * @param {string} [options.outputFileName] - Custom output filename
     * @returns {Promise<Blob>} Converted video as a Blob
     * @throws {Error} If conversion fails
     */
    async convertVideo(inputFile, outputFormat, options = {}) {
        if (!this.isLoaded) {
            await this.loadFFmpeg()
        }
        if (!(inputFile instanceof File || inputFile instanceof Blob)) {
            this.onLog('Input must be a File or Blob')
            this.conversionData = {
                success:          false,
                completed:        true,
                inputFormat:      null,
                outputFormat,
                inputFileDetails: null,
                conversionTime:   0,
                errorMessage:     'Input must be a File or Blob',
            }
            this.onProgress({percentage: 100, time: 0})
            throw new Error('Input must be a File or Blob')
        }
        if (!inputFile.type.includes('webm') && !inputFile.name.toLowerCase().endsWith('.webm')) {
            this.onLog('Input file must be WebM format')
            this.conversionData = {
                success:          false,
                completed:        true,
                inputFormat:      null,
                outputFormat,
                inputFileDetails: null,
                conversionTime:   0,
                errorMessage:     'Input file must be WebM format',
            }
            this.onProgress({percentage: 100, time: 0})
            throw new Error('Input file must be WebM format')
        }
        if (inputFile.size === 0) {
            this.onLog('Input file is empty')
            this.conversionData = {
                success:          false,
                completed:        true,
                inputFormat:      null,
                outputFormat,
                inputFileDetails: null,
                conversionTime:   0,
                errorMessage:     'Input file is empty',
            }
            this.onProgress({percentage: 100, time: 0})
            throw new Error('Input file is empty')
        }
        const {quality = 'MEDIUM', outputFileName} = options
        if (!VideoConverter.FORMATS[outputFormat]) {
            this.onLog(`Unsupported output format: ${outputFormat}`)
            this.conversionData = {
                success:          false,
                completed:        true,
                inputFormat:      'WEBM',
                outputFormat,
                inputFileDetails: {
                    name: inputFile.name,
                    size: inputFile.size,
                    type: inputFile.type,
                },
                conversionTime:   0,
                errorMessage:     `Unsupported output format: ${outputFormat}`,
            }
            this.onProgress({percentage: 100, time: 0})
            throw new Error(`Unsupported output format: ${outputFormat}`)
        }
        if (!VideoConverter.QUALITY_PRESETS[quality]) {
            this.onLog(`Unsupported quality preset: ${quality}`)
            this.conversionData = {
                success:          false,
                completed:        true,
                inputFormat:      'WEBM',
                outputFormat,
                inputFileDetails: {
                    name: inputFile.name,
                    size: inputFile.size,
                    type: inputFile.type,
                },
                conversionTime:   0,
                errorMessage:     `Unsupported quality preset: ${quality}`,
            }
            this.onProgress({percentage: 100, time: 0})
            throw new Error(`Unsupported quality preset: ${quality}`)
        }
        const format = VideoConverter.FORMATS[outputFormat]
        const qualityPreset = VideoConverter.QUALITY_PRESETS[quality]
        const inputFileName = 'input.webm'
        const outputName = outputFileName || `output.${format.extension}`
        try {
            this.conversionData = {
                success:          false,
                completed:        false,
                inputFormat:      'WEBM',
                outputFormat,
                inputFileDetails: {
                    name: inputFile.name,
                    size: inputFile.size,
                    type: inputFile.type,
                },
                conversionTime:   0,
                errorMessage:     null,
            }
            this.onLog(`Starting conversion: ${inputFile.name || 'WebM'} → ${outputFormat} (${quality}, input size: ${(inputFile.size / 1000000).toFixed(2)} MB)`)
            this.onProgress({percentage: 0, time: 0})

            // Get video duration for progress calculation
            const startTime = Date.now()
            const videoInfo = await this.getVideoInfo(inputFile)
            this.currentConversion = {
                startTime,
                inputFileName,
                outputName,
                videoDuration: videoInfo.duration || null,
            }
            this.inputFile = inputFile
            const hasAudio = videoInfo.audioStream !== undefined
            this.onLog(`Input video info: ${JSON.stringify(videoInfo, null, 2)}`)

            this.onLog('Writing input file to FFmpeg filesystem...')
            const inputData = await this.fetchFile(inputFile)
            if (!inputData || inputData.byteLength === 0) {
                this.onLog('Input file data is empty or invalid')
                this.conversionData = {
                    success:          false,
                    completed:        true,
                    inputFormat:      'WEBM',
                    outputFormat,
                    inputFileDetails: {
                        name: inputFile.name,
                        size: inputFile.size,
                        type: inputFile.type,
                    },
                    conversionTime:   0,
                    errorMessage:     'Input file data is empty or invalid',
                }
                this.onProgress({percentage: 100, time: 0})
                throw new Error('Input file data is empty or invalid')
            }
            await this.ffmpeg.writeFile(inputFileName, inputData)
            this.onProgress({percentage: 10, time: 0})

            // Optimize FFmpeg arguments for speed
            const args = [
                '-i', inputFileName,
                '-c:v', format.codec,
                ...(format.codec === 'libx264' || format.codec === 'mpeg4' ? ['-crf', qualityPreset.crf, '-preset', qualityPreset.preset] : []),
                ...(format.extraArgs || []),
                ...(format.videoFilters ? ['-vf', format.videoFilters] : []),
                ...(hasAudio ? ['-c:a', format.audioCodec, '-b:a', '128k'] : ['-an']), // Optimize audio bitrate
                '-threads', '4', // Use multi-threading for faster processing
                '-y',
                outputName,
            ]
            this.onLog(`FFmpeg command: ffmpeg ${args.join(' ')}`)
            this.onLog('Executing FFmpeg conversion...')
            const execStart = Date.now()
            const result = await this.ffmpeg.exec(args)
            const execDuration = (Date.now() - execStart) / 1000
            this.onLog(`FFmpeg execution completed in ${execDuration.toFixed(2)}s`)

            if (result !== 0) {
                this.onLog(`FFmpeg execution failed with code ${result}`)
                this.conversionData = {
                    success:          false,
                    completed:        true,
                    inputFormat:      'WEBM',
                    outputFormat,
                    inputFileDetails: {
                        name: inputFile.name,
                        size: inputFile.size,
                        type: inputFile.type,
                    },
                    conversionTime:   0,
                    errorMessage:     `FFmpeg failed with code ${result}`,
                }
                this.onProgress({percentage: 100, time: 0})
                throw new Error(`FFmpeg failed with code ${result}`)
            }

            this.onLog('Reading output file...')
            const readStart = Date.now()
            const outputData = await this.ffmpeg.readFile(outputName)
            const readDuration = (Date.now() - readStart) / 1000
            this.onLog(`Output file read in ${readDuration.toFixed(2)}s`)

            if (!outputData || outputData.byteLength === 0) {
                this.onLog('Output file is empty or missing')
                this.conversionData = {
                    success:          false,
                    completed:        true,
                    inputFormat:      'WEBM',
                    outputFormat,
                    inputFileDetails: {
                        name: inputFile.name,
                        size: inputFile.size,
                        type: inputFile.type,
                    },
                    conversionTime:   0,
                    errorMessage:     'Output file is empty or missing',
                }
                this.onProgress({percentage: 100, time: 0})
                throw new Error('Output file is empty or missing')
            }

            this.onLog('Creating output Blob...')
            const blobStart = Date.now()
            const mimeType = format.mimeType
            this.outputFile = new Blob([outputData], {type: mimeType})
            const blobDuration = (Date.now() - blobStart) / 1000
            this.onLog(`Output Blob created in ${blobDuration.toFixed(2)}s`)

            if (!(this.outputFile instanceof Blob) || this.outputFile.size === 0) {
                this.onLog('Failed to create valid output file')
                this.conversionData = {
                    success:          false,
                    completed:        true,
                    inputFormat:      'WEBM',
                    outputFormat,
                    inputFileDetails: {
                        name: inputFile.name,
                        size: inputFile.size,
                        type: inputFile.type,
                    },
                    conversionTime:   0,
                    errorMessage:     'Failed to create valid output file',
                }
                this.onProgress({percentage: 100, time: 0})
                throw new Error('Failed to create valid file')
            }

            this.conversionTime = ((Date.now() - this.currentConversion.startTime) / 1000).toFixed(2)
            this.conversionData = {
                success:          true,
                completed:        true,
                inputFormat:      'WEBM',
                outputFormat,
                inputFileDetails: {
                    name: inputFile.name,
                    size: inputFile.size,
                    type: inputFile.type,
                },
                conversionTime:   this.conversionTime,
                errorMessage:     null,
            }
            this.onLog(`Output file created: type=${this.outputFile.type}, size=${(this.outputFile.size / 1000000).toFixed(2)} MB`)
            this.onLog(`Conversion completed in ${this.conversionTime}s`)
            this.onLog(`Original size: ${(this.inputFile.size / 1000000).toFixed(2)} MB`)
            this.onLog(`Output size: ${(this.outputFile.size / 1000000).toFixed(2)} MB`)
            this.onProgress({percentage: 100, time: 0})

            UIToast.success({
                                caption: sprintf(`Conversion completed in ${UnitUtils.convert(this.conversionTime * SECOND).toTime()}`),
                                text:    `Original size: ${(this.inputFile.size / 1000000).toFixed(2)} MB <br>`
                                             + `Output size: ${(this.outputFile.size / 1000000).toFixed(2)} MB`,
                            }, 2000000)
            return this.outputFile
        }
        catch (error) {
            this.onLog(`Conversion failed: ${error.message}`)
            this.conversionData = {
                success:          false,
                completed:        true,
                inputFormat:      'WEBM',
                outputFormat,
                inputFileDetails: {
                    name: inputFile.name,
                    size: inputFile.size,
                    type: inputFile.type,
                },
                conversionTime:   this.conversionTime || ((Date.now() - this.currentConversion?.startTime || 0) / 1000).toFixed(2),
                errorMessage:     error.message,
            }
            this.onProgress({percentage: 100, time: 0})
            throw error
        }
        finally {
            this.onLog('Cleaning up files...')
            const cleanupStart = Date.now()
            await this.#cleanupFile(inputFileName)
            await this.#cleanupFile(outputName)
            const cleanupDuration = (Date.now() - cleanupStart) / 1000
            this.onLog(`Cleanup completed in ${cleanupDuration.toFixed(2)}s`)
            this.currentConversion = null
            if (!this.conversionData.completed) {
                this.conversionData.completed = true
                this.onProgress({percentage: 100, time: 0})
            }
        }
    }

    /**
     * Retrieves metadata from a video file
     * @param {File|Blob} videoFile - Input video file
     * @returns {Promise<Object>} Video metadata (duration, resolution, etc.)
     * @throws {Error} If metadata extraction fails
     */
    async getVideoInfo(videoFile) {
        if (!this.isLoaded) {
            await this.loadFFmpeg()
        }
        if (!(videoFile instanceof File || videoFile instanceof Blob)) {
            this.onLog('Input must be a File or Blob')
            throw new Error('Input must be a File or Blob')
        }
        const inputFileName = 'info_input.webm'
        let logOutput = ''
        try {
            const logHandler = ({message}) => {
                logOutput += message + '\n'
                this.onLog(message)
            }
            this.ffmpeg.on('log', logHandler)
            const inputData = await this.fetchFile(videoFile)
            if (!inputData || inputData.byteLength === 0) {
                this.onLog('Input file for info is empty or invalid')
                throw new Error('Input file for info is empty or invalid')
            }
            await this.ffmpeg.writeFile(inputFileName, inputData)
            const result = await this.ffmpeg.exec(['-i', inputFileName, '-f', 'null', '-'])
            if (result !== 0) {
                this.onLog(`FFmpeg info extraction failed with code ${result}`)
                throw new Error(`FFmpeg info extraction failed`)
            }
            const info = this.#parseFFmpegLog(logOutput)
            info.size = videoFile.size
            info.type = videoFile.type
            info.name = videoFile.name
            info.audioStream = logOutput.includes('audio') ? true : undefined
            return info
        }
        catch (error) {
            this.onLog(`Failed to get video info: ${error.message}`)
            return {error: error.message}
        }
        finally {
            this.ffmpeg.off('log')
            await this.#cleanupFile(inputFileName)
        }
    }

    /**
     * Cleans up a file from FFmpeg's virtual filesystem
     * @param {string} path - File path to clean up
     * @private
     */
    async #cleanupFile(path) {
        try {
            if (this.ffmpeg && typeof this.ffmpeg.FS === 'function' && this.ffmpeg.FS('stat', path)) {
                await this.ffmpeg.deleteFile(path)
                this.onLog(`Files cleaned up: ${path}`)
            }
        }
        catch (error) {
            this.onLog(`Cleanup failed for ${path}: ${error.message}`)
        }
    }

    /**
     * Parses FFmpeg log output to extract video metadata
     * @param {string} log - FFmpeg log output
     * @returns {Object} Parsed metadata (duration, resolution)
     * @private
     */
    #parseFFmpegLog(log) {
        const info = {}
        const durationMatch = log.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        if (durationMatch) {
            info.duration = parseInt(durationMatch[1]) * 3600 +
                parseInt(durationMatch[2]) * 60 +
                parseFloat(durationMatch[3])
        }
        const resolutionMatch = log.match(/(\d{3,4})x(\d{3,4})/)
        if (resolutionMatch) {
            info.resolution = {
                width:  parseInt(resolutionMatch[1]),
                height: parseInt(resolutionMatch[2]),
            }
        }
        return info
    }

    /**
     * Gets MIME type for a given file extension
     * @param {string} extension - File extension
     * @returns {string} MIME type
     * @throws {Error} If no MIME type is found
     * @private
     */
    #getMimeType(extension) {
        const format = Object.values(VideoConverter.FORMATS).find(f => f.extension === extension.toLowerCase())
        if (!format) {
            this.onLog(`No MIME type defined for extension: ${extension}`)
            throw new Error(`No MIME type defined for extension: ${extension}`)
        }
        return format.mimeType
    }

    /**
     * Terminates FFmpeg and cleans up resources
     */
    destroy() {
        if (this.ffmpeg) {
            this.ffmpeg.terminate()
            this.ffmpeg = null
        }
        this.isLoaded = false
    }
}