###### OBSOLETE #######

# VideoConverter

**VideoConverter** is a JavaScript class designed to convert video files between formats (e.g., MP4, WebM, AVI) using a
remote backend API. It is part of the **LGS1920/studio** project, providing a client-side interface for video conversion
with real-time progress tracking via Server-Sent Events (SSE) or polling. The class integrates with other components
like `VideoRecorder` and `VideoRecorderToolbar` for a seamless video processing workflow.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
    - [Basic Example](#basic-example)
    - [Converting a Video](#converting-a-video)
    - [Converting to AVI](#converting-to-avi)
    - [Using Custom Encoding](#using-custom-encoding)
- [API Reference](#api-reference)
    - [Static Properties](#static-properties)
    - [Static Methods](#static-methods)
    - [Instance Methods](#instance-methods)
- [Configuration Options](#configuration-options)
    - [Quality Preset Details](#quality-preset-details)
- [Error Handling](#error-handling)
- [Dependencies](#dependencies)
- [Browser Compatibility](#browser-compatibility)
- [License](#license)
- [Contact](#contact)

## Features

- **Video Conversion**: Converts video files between supported formats (MP4, WebM, AVI) using a remote backend API with
  FFmpeg.
- **Audio Control**: Supports audio management with options to remove audio (`none`), copy audio without re-encoding (
  `copy`), or re-encode audio with a specified codec (`encode`).
- **Quality Presets**: Supports configurable quality settings (`DRAFT`, `MEDIUM`, `HIGH`, `HIGHEST`) for balancing file
  size and quality, applied via FFmpeg `-crf` and `-preset` parameters.
- **Progress Tracking**: Provides real-time progress updates via callbacks, including percentage, elapsed time, and
  video duration for UI integration (e.g., time remaining).
- **Metadata Support**: Applies custom metadata (e.g., date, album, genre) to the output video.
- **Custom FFmpeg Arguments**: Configures FFmpeg arguments based on format and quality presets, with support for video
  filters, codecs, and custom encoding options.
- **Debug Logging**: Conditional logging controlled by a `debug` flag for detailed troubleshooting.
- **Error Handling**: Robust error detection and logging for invalid inputs, unsupported formats, or conversion
  failures.
- **Resource Management**: Proper cleanup of network resources (SSE connections, polling intervals) to prevent leaks.
- **Flexible Backend Integration**: Communicates with a customizable backend URL for conversion tasks.

## Installation

The `VideoConverter` class requires a remote backend API to handle video conversion. To use it in your project:

1. **Copy the File**:
    - Place `VideoConverter.js` in your project's source directory (e.g., `src/utils/`).

2. **Set Up the Backend**:
    - Ensure a compatible backend API is running (e.g., at `http://localhost:3333`) with endpoints for conversion,
      progress tracking, download, and cancellation.
   - The backend must support FFmpeg-based video conversion and provide SSE or polling for progress updates, including
     video duration.

3. **Import the Module**:
    - Import the `VideoConverter` class in your JavaScript or React application:
      ```javascript
      import { VideoConverter } from './path/to/VideoConverter.js'
      ```

4. **Browser Compatibility**:
    - Ensure your target browsers support modern JavaScript (ES modules), `fetch`, and optionally `EventSource` for SSE.
   - See [Browser Compatibility](#browser-compatibility) for details.

## Usage

### Basic Example

Convert a WebM file to MP4 with audio removed, displaying progress with duration:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function convertVideo() {
    const converter = new VideoConverter({
                                             onProgress: ({percentage, time, duration}) => {
                                                 console.log(`Progress: ${percentage}% (${time ? (time / 1000).toFixed(2) : 0}s/${duration ? (duration / 1000).toFixed(2) : 'unknown'}s)`);
                                                 // Update UI with progress bar and time remaining (duration - time)
                                             },
                                             onLog:      (message) => console.log(`[DEBUG] ${message}`),
                                             backend:    'http://localhost:3333',
                                             sse:        true,
                                             debug:      true // Enable debug logs
                                         })

    try {
        // Load a video file (e.g., from a file input)
        const inputFile = new File([/* video blob */], 'input.webm', {type: 'video/webm'})

        // Convert to MP4 with high quality and no audio
        const outputBlob = await converter.convertVideo(inputFile, 'WEBM', 'MP4', {
            quality: 'HIGH',
            outputFileName: 'converted-video.mp4',
            audio:   VideoConverter.AUDIO_ENCODE.NONE
        })

        // Download the converted video
        const url = URL.createObjectURL(outputBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'converted-video.mp4'
        link.click()
        URL.revokeObjectURL(url)

        // Access duration from conversion data
        const {duration} = converter.getConversionData()
        console.log(`Video duration: ${duration ? (duration / 1000).toFixed(2) : 'unknown'} seconds`)
    }
    catch (error) {
        console.error('Conversion failed:', error.message)
    }
    finally {
        converter.destroy() // Clean up resources
    }
}

convertVideo()
```

### Converting a Video

Convert a WebM file to MP4 with high quality, copied audio, and duration display:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function convertToMP4() {
    const converter = new VideoConverter({
                                             onProgress: ({percentage, time, duration}) => {
                                                 console.log(`Progress: ${percentage}% (${time ? (time / 1000).toFixed(2) : 0}s/${duration ? (duration / 1000).toFixed(2) : 'unknown'}s)`);
                                                 // Update UI with progress bar and time remaining
                                             },
                                             onLog:      (message) => console.log(`[DEBUG] ${message}`),
                                             backend:    'http://localhost:3333',
                                             sse:        true,
                                             debug:      true
                                         })

    const inputFile = new File([/* video blob */], 'input.webm', {type: 'video/webm'})

    try {
        const outputBlob = await converter.convertVideo(inputFile, 'WEBM', 'MP4', {
            quality: 'HIGH',
            outputFileName: 'output.mp4',
            audio:   VideoConverter.AUDIO_ENCODE.COPY,
            metadata: {
                title: 'My Video',
                comment: 'Converted with VideoConverter'
            }
        })

        console.log('Converted video size:', outputBlob.size)
        const {duration} = converter.getConversionData()
        console.log(`Video duration: ${duration ? (duration / 1000).toFixed(2) : 'unknown'} seconds`)
    }
    catch (error) {
        console.error('Conversion error:', error.message)
    }
    finally {
        converter.destroy()
    }
}

convertToMP4()
```

### Converting to AVI

Convert a MP4 file to AVI with medium quality and re-encoded audio:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function convertToAVI() {
    const converter = new VideoConverter({
                                             onProgress: ({percentage, time, duration}) => {
                                                 console.log(`Progress: ${percentage}% (${time ? (time / 1000).toFixed(2) : 0}s/${duration ? (duration / 1000).toFixed(2) : 'unknown'}s)`);
                                                 // Update UI with progress bar and time remaining
                                             },
                                             onLog:      (message) => console.log(`[DEBUG] ${message}`),
                                             backend:    'http://localhost:3333',
                                             sse:        true,
                                             debug:      true
                                         })

    const inputFile = new File([/* video blob */], 'input.mp4', {type: 'video/mp4'})

    try {
        const outputBlob = await converter.convertVideo(inputFile, 'MP4', 'AVI', {
            quality:  'MEDIUM',
            outputFileName: 'output.avi',
            audio:    VideoConverter.AUDIO_ENCODE.ENCODE,
            metadata: {
                title: 'My AVI Video',
                comment: 'Converted to AVI with VideoConverter'
            }
        })

        console.log('Converted AVI video size:', outputBlob.size)
        const {duration} = converter.getConversionData()
        console.log(`Video duration: ${duration ? (duration / 1000).toFixed(2) : 'unknown'} seconds`)
    }
    catch (error) {
        console.error('Conversion error:', error.message)
    }
    finally {
        converter.destroy()
    }
}

convertToAVI()
```

### Using Custom Encoding

Convert a WebM file to MP4 with custom FFmpeg parameters and re-encoded audio:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function convertWithCustomEncoding() {
    const converter = new VideoConverter({
                                             onProgress: ({percentage, time, duration}) => {
                                                 console.log(`Progress: ${percentage}% (${time ? (time / 1000).toFixed(2) : 0}s/${duration ? (duration / 1000).toFixed(2) : 'unknown'}s)`);
                                                 // Update UI with progress bar and time remaining
                                             },
                                             onLog:      (message) => console.log(`[DEBUG] ${message}`),
                                             backend:    'http://localhost:3333',
                                             sse:        true,
                                             debug:      true
                                         })

    const inputFile = new File([/* video blob */], 'input.webm', {type: 'video/webm'})

    try {
        const outputBlob = await converter.convertVideo(inputFile, 'WEBM', 'MP4', {
            outputFileName: 'custom-output.mp4',
            audio:          VideoConverter.AUDIO_ENCODE.ENCODE,
            customEncoding: {
                codec:     'libx264',
                audioCodec: 'aac',
                extraArgs: ['-crf', '18', '-preset', 'slow', '-b:a', '192k']
            },
            metadata:       {
                title: 'Custom Encoded Video',
                comment: 'Converted with custom FFmpeg settings'
            }
        })

        console.log('Custom converted video size:', outputBlob.size)
        const {duration} = converter.getConversionData()
        console.log(`Video duration: ${duration ? (duration / 1000).toFixed(2) : 'unknown'} seconds`)
    }
    catch (error) {
        console.error('Conversion error:', error.message)
    }
    finally {
        converter.destroy()
    }
}

convertWithCustomEncoding()
```

## API Reference

### Static Properties

- `VideoConverter.FORMATS`:
    - Object defining supported formats (`MP4`, `WEBM`, `AVI`).
  - Each format includes `extension`, `codec`, `audioCodec`, `mimeType`, `description`, `videoFilters`, and `extraArgs`.
    - Example: `{ MP4: { extension: 'mp4', codec: 'libx264', audioCodec: 'aac', ... } }`.

- `VideoConverter.QUALITY_PRESETS`:
    - Object defining quality presets (`DRAFT`, `MEDIUM`, `HIGH`, `HIGHEST`).
    - Each preset includes `crf`, `preset`, and `description`.
    - Example: `{ HIGH: { crf: '22', preset: 'fast', description: 'High – slower encode, great visuals' } }`.

- `VideoConverter.AUDIO_ENCODE`:
    - Object defining audio handling options (`NONE`, `COPY`, `ENCODE`).
    - Example: `{ NONE: 'none', COPY: 'copy', ENCODE: 'encode' }`.

### Static Methods

- `VideoConverter.getAvailableFormats()`:
    - Returns the `FORMATS` object.
    - Example: `VideoConverter.getAvailableFormats().MP4` → `{ extension: 'mp4', codec: 'libx264', ... }`.

- `VideoConverter.getQualityPresets()`:
    - Returns the `QUALITY_PRESETS` object.
    - Example: `VideoConverter.getQualityPresets().HIGH` → `{ crf: '22', preset: 'fast', ... }`.

- `VideoConverter.getAudioEncodeOptions()`:
    - Returns the `AUDIO_ENCODE` object.
    - Example: `VideoConverter.getAudioEncodeOptions()` → `{ NONE: 'none', COPY: 'copy', ENCODE: 'encode' }`.

### Instance Methods

1. `constructor({ onProgress, onLog, backend, sse, debug })`
    - Initializes the converter with callbacks and backend configuration.
    - Parameters:
        - `onProgress`: Function called with `{ percentage, time, duration }` for progress updates (time and duration in
          milliseconds).
        - `onLog`: Function called with log messages when `debug` is `true`.
        - `backend`: String, required backend base URL (e.g., `'http://localhost:3333'`).
        - `sse`: Boolean, use SSE (`true`) or polling (`false`) for progress tracking (default: `true`).
        - `debug`: Boolean, enable debug logging (default: `false`).
    - Throws: `Error` if backend URL is not provided.

2. `convertVideo(inputFile, inputFormat, outputFormat, options)`
    - Converts a video file to the specified format via the backend API.
    - Parameters:
        - `inputFile`: `File` or `Blob` (input video).
      - `inputFormat`: String (e.g., `'WEBM'`, `'MP4'`, `'AVI'`).
      - `outputFormat`: String (e.g., `'MP4'`, `'WEBM'`, `'AVI'`).
      - `options`: Object with `quality`, `outputFileName`, `duration`, `metadata`, `customEncoding`, `audio`.
    - Returns: `Promise<Blob>` (converted video).
   - Throws: `Error` for invalid inputs, formats, quality presets, audio options, or conversion failures.

3. `getConversionData()`
    - Returns the current conversion data, including `duration` (in milliseconds) if provided by the backend.
    - Example: `{ success: true, duration: 30000, ... }`.

4. `destroy()`
    - Cleans up resources (SSE connections, polling intervals, timeouts).

## Configuration Options

- **Constructor Options**:
    - `onProgress`: Callback for progress updates (e.g., `{ percentage: 50, time: 10000, duration: 30000 }`).
    - `onLog`: Callback for debug messages, triggered only when `debug` is `true`.
    - `backend`: Required backend URL (e.g., `'http://localhost:3333'`).
    - `sse`: Boolean, enables SSE (`true`) or polling (`false`) (default: `true`).
    - `debug`: Boolean, enables debug logging (default: `false`).

- **`convertVideo` Options**:
    - `quality`: Quality preset (`'DRAFT'`, `'MEDIUM'`, `'HIGH'`, `'HIGHEST'`) (default: `'MEDIUM'`). Maps to FFmpeg
      `-crf` and `-preset` parameters.
    - `outputFileName`: Custom output filename (default: `output.<extension>`).
  - `duration`: Optional video duration in milliseconds for progress calculation (overridden by backend-provided
    duration if available).
    - `metadata`: Object with key-value pairs for video metadata (e.g., `{ title: 'My Video' }`).
    - `customEncoding`: Object with custom FFmpeg settings (optional):
        - `codec`: Video codec (e.g., `libx264`, `libvpx-vp9`, `mpeg4`).
        - `audioCodec`: Audio codec (e.g., `aac`, `opus`, `mp3`).
        - `extraArgs`: Array of FFmpeg arguments (e.g., `['-crf', '18', '-preset', 'slow', '-b:a', '192k']`).
    - `audio`: Audio handling option (default: `'encode'`):
        - `'none'`: Remove audio from the output.
        - `'copy'`: Copy audio without re-encoding.
        - `'encode'`: Re-encode audio using the specified `audioCodec`.

### Quality Preset Details

The `quality` option in `convertVideo` maps to FFmpeg `-crf` and `-preset` parameters, which control the video quality
and encoding speed:

- **CRF (Constant Rate Factor)**:
    - Range: 0–51 (lower values mean higher quality and larger file sizes).
    - Common values used in `QUALITY_PRESETS`:
        - `DRAFT`: `crf: 35` (low quality, smaller files, fastest encoding).
        - `MEDIUM`: `crf: 25` (balanced quality and file size).
        - `HIGH`: `crf: 22` (high quality, larger files).
        - `HIGHEST`: `crf: 18` (near visually lossless, largest files, slowest encoding).

- **Preset**:
    - Controls encoding speed and compression efficiency.
    - Available values (from fastest to slowest):
        - `ultrafast`: Fastest encoding, lowest compression (used in `DRAFT`).
        - `veryfast`: Balanced speed and compression (used in `MEDIUM`).
        - `fast`: Slower encoding, better compression (used in `HIGH`).
        - `slow`: Slowest encoding, best compression (used in `HIGHEST`).

When using `customEncoding`, you can override these defaults by specifying your own `-crf` and `-preset` values in
`extraArgs`.

## Error Handling

The class throws errors for invalid operations and logs them via the `onLog` callback when `debug` is `true`:

```javascript
const converter = new VideoConverter({
                                         onLog:   (message) => console.error('[DEBUG] Converter log:', message),
                                         backend: 'http://localhost:3333',
                                         debug:   true
                                     })

try {
    await converter.convertVideo(invalidFile, 'WEBM', 'MP4')
}
catch (error) {
    console.error('Conversion error:', error.message)
    const {duration} = converter.getConversionData()
    console.log(`Video duration (if available): ${duration ? (duration / 1000).toFixed(2) : 'unknown'} seconds`)
}
```

Common errors:

- Invalid input file (not a `File`/`Blob` or empty).
- Unsupported input or output format (e.g., not `'MP4'`, `'WEBM'`, or `'AVI'`).
- Unsupported quality preset (e.g., not `'DRAFT'`, `'MEDIUM'`, `'HIGH'`, `'HIGHEST'`).
- Unsupported audio option (e.g., not `'none'`, `'copy'`, `'encode'`).
- Backend API failures (e.g., HTTP errors, connection timeouts).
- SSE or polling errors (e.g., connection failures, invalid responses).

## Dependencies

- **Backend API**: A server implementing FFmpeg-based conversion with endpoints for `/convert`, `/progress`,
  `/download`, and `/cancel`.
- **Browser APIs**: Uses `fetch`, `FormData`, `Blob`, and optionally `EventSource` for SSE.

## Browser Compatibility

- **Supported Browsers**:
    - Modern browsers (Chrome, Firefox, Edge, Safari) with support for `fetch`, `FormData`, and ES modules.
    - SSE requires `EventSource` support; polling is used as a fallback for browsers without SSE.
- **MIME Type Support**:
    - Supports `video/mp4`, `video/webm`, and `video/x-msvideo` based on backend FFmpeg configuration.
- **Limitations**:
    - Conversion performance depends on the backend server’s capabilities.
    - Large files may cause delays due to upload/download times.
    - Polling mode may have higher latency compared to SSE.

## License

Copyright © 2025 LGS1920. All rights reserved.

## Contact

- **Email**: contact@lgs1920.fr
- **Team**: LGS1920 Team
- **Project**: LGS1920/studio