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
    // Supported video formats with their configurations
    static FORMATS = {
        MP4:  {
            extension:    'mp4',
            codec:        'libx264',
            audioCodec:   'aac',
            mimeType:     'video/mp4',
            description:  'MP4 (H.264/AAC)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:    ['-movflags', '+faststart', '-fps_mode', 'vfr'],
        },
        WEBM: {
            extension:    'webm',
            codec:        'libvpx-vp9',
            audioCodec:   'opus',
            mimeType:     'video/webm',
            description:  'WebM (VP9/Opus)',
            videoFilters: 'format=vp9',
            extraArgs:    ['-fps_mode', 'vfr'],
        },
        AVI:  {
            extension:    'avi',
            codec:        'mpeg4',
            audioCodec:   'mp3',
            mimeType:     'video/x-msvideo',
            description:  'AVI (MPEG-4/MP3)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:    ['-fps_mode', 'vfr'],
        },
        MOV:  {
            extension:    'mov',
            codec:        'libx264',
            audioCodec:   'aac',
            mimeType:     'video/quicktime',
            description:  'MOV (H.264/AAC)',
            videoFilters: 'format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            extraArgs:    ['-fps_mode', 'vfr'],
        },
    }

    // Quality presets for video conversion
    static QUALITY_PRESETS = {
        LOW:    {
            crf:         '28',
            preset:      'veryfast',
            description: 'Low - fast ',
        },
        MEDIUM: {
            crf:         '23',
            preset:      'fast',
            description: 'Medium - balanced',
        },
        HIGH:   {
            crf:         '18',
            preset:      'medium',
            description: 'High - slower',
        },
        ULTRA:  {
            crf:         '15',
            preset:      'slow',
            description: 'Ultra - slowest',
        },
    }

    /**
     * Creates an instance of VideoConverter
     * @param {Object} options - Configuration options
     * @param {Function} [options.onProgress] - Callback for progress updates
     * @param {Function} [options.onLog] - Callback for logging messages
     */
    constructor({onProgress, onLog} = {}) {
        // FFmpeg instance for video processing
        this.ffmpeg = null
        // Flag indicating if FFmpeg is loaded
        this.isLoaded = false
        // Progress callback, defaults to no-op
        this.onProgress = onProgress || (() => {
        })
        // Log callback, defaults to no-op
        this.onLog = onLog || (() => {
        })
        // Tracks current conversion state
        this.currentConversion = null
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
        // Skip if already loaded
        if (this.isLoaded) {
            this.onLog('FFmpeg already loaded')
            return
        }
        try {
            this.onLog('Loading FFmpeg.wasm...')
            // Dynamically import FFmpeg and utility functions
            const {FFmpeg} = await import('@ffmpeg/ffmpeg')
            const {fetchFile, toBlobURL} = await import('@ffmpeg/util')
            this.ffmpeg = new FFmpeg()
            this.fetchFile = fetchFile
            this.toBlobURL = toBlobURL
            // Set up logging
            this.ffmpeg.on('log', ({type, message}) => {
                this.onLog(`[${type}] ${message}`)
            })
            // Set up progress tracking
            this.ffmpeg.on('progress', ({progress, time}) => {
                if (this.currentConversion) {
                    const percentage = Math.max(0, Math.min(100, Math.round(progress * 100)))
                    this.onProgress({percentage, time})
                }
            })
            // Load FFmpeg core and wasm
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
        // Ensure FFmpeg is loaded
        if (!this.isLoaded) {
            await this.loadFFmpeg()
        }
        // Validate input file
        if (!(inputFile instanceof File || inputFile instanceof Blob)) {
            this.onLog('Input must be a File or Blob')
            throw new Error('Input must be a File or Blob')
        }
        // Restrict input to WebM
        if (!inputFile.type.includes('webm') && !inputFile.name.toLowerCase().endsWith('.webm')) {
            this.onLog('Input file must be WebM format')
            throw new Error('Input file must be WebM format')
        }
        // Check for empty file
        if (inputFile.size === 0) {
            this.onLog('Input file is empty')
            throw new Error('Input file is empty')
        }
        // Validate output format and quality
        const {quality = 'MEDIUM', outputFileName} = options
        if (!VideoConverter.FORMATS[outputFormat]) {
            this.onLog(`Unsupported output format: ${outputFormat}`)
            throw new Error(`Unsupported output format: ${outputFormat}`)
        }
        if (!VideoConverter.QUALITY_PRESETS[quality]) {
            this.onLog(`Unsupported quality preset: ${quality}`)
            throw new Error(`Unsupported quality preset: ${quality}`)
        }
        const format = VideoConverter.FORMATS[outputFormat]
        const qualityPreset = VideoConverter.QUALITY_PRESETS[quality]
        const inputFileName = 'input.webm'
        const outputName = outputFileName || `output.${format.extension}`
        try {
            // Initialize conversion tracking
            this.currentConversion = {
                startTime: Date.now(),
                inputFileName,
                outputName,
            }
            this.onLog(`Starting conversion: ${inputFile.name || 'WebM'} → ${outputFormat} (${quality}, input size: ${(inputFile.size / 1000000).toFixed(2)} MB)`)
            this.onProgress({percentage: 0, time: 0})
            // Get video metadata
            const videoInfo = await this.getVideoInfo(inputFile)
            const hasAudio = videoInfo.audioStream !== undefined
            this.onLog(`Input video info: ${JSON.stringify(videoInfo, null, 2)}`)
            this.onLog('Writing input file to FFmpeg filesystem...')
            // Read input file
            const inputData = await this.fetchFile(inputFile)
            if (!inputData || inputData.byteLength === 0) {
                this.onLog('Input file data is empty or invalid')
                throw new Error('Input file data is empty or invalid')
            }
            await this.ffmpeg.writeFile(inputFileName, inputData)
            this.onProgress({percentage: 10, time: 0})
            // Build FFmpeg command
            const args = [
                '-i', inputFileName,
                '-c:v', format.codec,
                ...(format.codec === 'libx264' || format.codec === 'mpeg4' ? ['-crf', qualityPreset.crf, '-preset', qualityPreset.preset] : []),
                ...(format.extraArgs || []),
                ...(format.videoFilters ? ['-vf', format.videoFilters] : []),
                ...(hasAudio ? ['-c:a', format.audioCodec] : ['-an']),
                '-y',
                outputName,
            ]
            this.onLog(`FFmpeg command: ffmpeg ${args.join(' ')}`)
            this.onLog('Executing FFmpeg conversion...')
            // Execute conversion
            const result = await this.ffmpeg.exec(args)
            if (result !== 0) {
                this.onLog(`FFmpeg execution failed with code ${result}`)
                throw new Error(`FFmpeg failed with code ${result}`)
            }
            this.onProgress({percentage: 90, time: 0})
            this.onLog('Reading output file...')
            // Read output file
            const outputData = await this.ffmpeg.readFile(outputName)
            if (!outputData || outputData.byteLength === 0) {
                this.onLog('Output file is empty or missing')
                throw new Error('Output file is empty or missing')
            }
            this.onProgress({percentage: 95, time: 0})
            // Clean up temporary files
            await this._cleanupFile(inputFileName)
            await this._cleanupFile(outputName)
            // Create output Blob
            const mimeType = format.mimeType
            const outputBlob = new Blob([outputData], {type: mimeType})
            if (!(outputBlob instanceof Blob) || outputBlob.size === 0) {
                this.onLog('Failed to create valid output blob')
                throw new Error('Failed to create valid blob')
            }
            // Log conversion details
            this.onLog(`Output blob created: type=${outputBlob.type}, size=${(outputBlob.size / 1000000).toFixed(2)} MB`)
            const conversionTime = ((Date.now() - this.currentConversion.startTime) / 1000).toFixed(2)
            this.onLog(`Conversion completed in ${conversionTime}s`)
            this.onLog(`Original size: ${(inputFile.size / 1000000).toFixed(2)} MB`)
            this.onLog(`Output size: ${(outputBlob.size / 1000000).toFixed(2)} MB`)
            this.onProgress({percentage: 100, time: 0})
            return outputBlob
        }
        catch (error) {
            this.onLog(`Conversion failed: ${error.message}`)
            throw error
        }
        finally {
            // Ensure cleanup even on failure
            await this._cleanupFile(inputFileName)
            await this._cleanupFile(outputName)
            this.currentConversion = null
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
            // Capture FFmpeg logs
            const logHandler = ({message}) => {
                logOutput += message + '\n'
                this.onLog(message)
            }
            this.ffmpeg.on('log', logHandler)
            // Write input file
            const inputData = await this.fetchFile(videoFile)
            if (!inputData || inputData.byteLength === 0) {
                this.onLog('Input file for info is empty or invalid')
                throw new Error('Input file for info is empty or invalid')
            }
            await this.ffmpeg.writeFile(inputFileName, inputData)
            // Run FFmpeg to extract info
            const result = await this.ffmpeg.exec(['-i', inputFileName, '-f', 'null', '-'])
            if (result !== 0) {
                this.onLog(`FFmpeg info extraction failed with code ${result}`)
                throw new Error(`FFmpeg info extraction failed`)
            }
            // Parse metadata from logs
            const info = this._parseFFmpegLog(logOutput)
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
            await this._cleanupFile(inputFileName)
        }
    }

    /**
     * Cleans up a file from FFmpeg's virtual filesystem
     * @param {string} path - File path to clean up
     * @private
     */
    async _cleanupFile(path) {
        try {
            // Check if file exists before deleting
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
    _parseFFmpegLog(log) {
        const info = {}
        // Extract duration
        const durationMatch = log.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        if (durationMatch) {
            info.duration = parseInt(durationMatch[1]) * 3600 +
                parseInt(durationMatch[2]) * 60 +
                parseFloat(durationMatch[3])
        }
        // Extract resolution
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
    _getMimeType(extension) {
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
        // Terminate FFmpeg instance if it exists
        if (this.ffmpeg) {
            this.ffmpeg.terminate()
            this.ffmpeg = null
        }
        this.isLoaded = false
    }
}