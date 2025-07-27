# VideoConverter

**VideoConverter** is a JavaScript class designed to convert WebM video files to various formats (e.g., MP4, AVI, MOV,
MKV) using FFmpeg.wasm in a browser environment. It is part of the **LGS1920/studio** project, providing a client-side
solution for video format conversion with customizable quality presets and progress tracking. The class is designed to
integrate with other components like `VideoRecorder` and `VideoRecorderToolbar` for a seamless video processing
workflow.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
    - [Basic Example](#basic-example)
    - [Converting a Video](#converting-a-video)
    - [Getting Video Information](#getting-video-information)
- [API Reference](#api-reference)
    - [Static Properties](#static-properties)
    - [Static Methods](#static-methods)
    - [Instance Methods](#instance-methods)
- [Configuration Options](#configuration-options)
- [Error Handling](#error-handling)
- [Dependencies](#dependencies)
- [Browser Compatibility](#browser-compatibility)
- [License](#license)
- [Contact](#contact)

## Features

- **WebM Conversion**: Converts WebM videos to multiple formats (MP4, AVI, MOV, MKV, WebM with H.264/AAC) using
  FFmpeg.wasm.
- **Quality Presets**: Supports configurable quality settings (Low, Medium, High, Lossless) for balancing file size and
  quality.
- **Progress Tracking**: Provides real-time progress updates via callbacks, including percentage and estimated time.
- **Video Metadata**: Extracts metadata (e.g., duration, resolution) from WebM files.
- **Custom FFmpeg Arguments**: Allows advanced users to specify custom FFmpeg arguments for fine-tuned conversions.
- **Client-Side Processing**: Runs entirely in the browser, leveraging FFmpeg.wasm for cross-platform compatibility.
- **Error Handling**: Robust error detection and logging for invalid inputs, unsupported formats, or conversion
  failures.
- **Resource Management**: Proper cleanup of FFmpeg resources to prevent memory leaks.

## Installation

The `VideoConverter` class requires FFmpeg.wasm and its utilities, which are dynamically imported during initialization.
To use it in your project:

1. **Copy the File**:
    - Place `VideoConverter.js` in your project's source directory (e.g., `src/utils/`).

2. **Install FFmpeg.wasm**:
    - Alternatively, install via bun:
      ```bash
      bun install @ffmpeg/ffmpeg@0.12.6 @ffmpeg/util@0.12.6
      ```

3. **Import the Module**:
    - Import the `VideoConverter` class in your JavaScript or React application:
      ```javascript
      import { VideoConverter } from './path/to/VideoConverter.js'
      ```

4. **Browser Compatibility**:
    - Ensure your target browsers support WebAssembly and modern JavaScript (ES modules).
      See [Browser Compatibility](#browser-compatibility) for details.

## Usage

### Basic Example

Convert a WebM file to MP4 with default settings:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function convertVideo() {
    const converter = new VideoConverter({
                                             onProgress: ({
                                                              percentage,
                                                              time
                                                          }) => console.log(`Progress: ${percentage}%`),
                                             onLog:      (message) => console.log(`Log: ${message}`)
                                         })

    try {
        // Load a WebM file (e.g., from a file input)
        const inputFile = new File([/* WebM blob */], 'input.webm', {type: 'video/webm'})

        // Convert to MP4 with medium quality
        const outputBlob = await converter.convertVideo(inputFile, 'MP4', {
            quality:        'MEDIUM',
            outputFileName: 'converted-video.mp4'
        })

        // Download the converted video
        const url = URL.createObjectURL(outputBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'converted-video.mp4'
        link.click()
        URL.revokeObjectURL(url)
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

Convert a WebM file to MOV with high quality and custom FFmpeg arguments:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function convertToMOV() {
    const converter = new VideoConverter({
                                             onProgress: ({percentage}) => console.log(`Progress: ${percentage}%`),
                                             onLog:      (message) => console.log(message)
                                         })

    const inputFile = new File([/* WebM blob */], 'input.webm', {type: 'video/webm'})

    try {
        const outputBlob = await converter.convertVideo(inputFile, 'MOV', {
            quality:        'HIGH',
            outputFileName: 'output.mov',
            customArgs:     {
                '-vf': 'scale=1280:720' // Scale to 720p
            }
        })

        console.log('Converted video size:', outputBlob.size)
    }
    catch (error) {
        console.error('Conversion error:', error.message)
    }
}
```

### Getting Video Information

Retrieve metadata from a WebM file:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function getVideoInfo() {
    const converter = new VideoConverter({
                                             onLog: (message) => console.log(message)
                                         })

    const inputFile = new File([/* WebM blob */], 'input.webm', {type: 'video/webm'})

    try {
        const info = await converter.getVideoInfo(inputFile)
        console.log('Video Info:', {
            duration:   info.duration, // Duration in seconds
            resolution: info.resolution, // { width, height }
            size:       info.size, // Size in bytes
            type:       info.type, // MIME type
            name:       info.name // File name
        })
    }
    catch (error) {
        console.error('Error getting video info:', error.message)
    }
}
```

## API Reference

### Static Properties

- **`VideoConverter.FORMATS`**:
    - Object defining supported output formats (`MP4`, `AVI`, `MOV`, `MKV`, `WEBM_H264`).
    - Each format includes `extension`, `codec`, `audioCodec`, and `description`.

- **`VideoConverter.QUALITY_PRESETS`**:
    - Object defining quality presets (`LOW`, `MEDIUM`, `HIGH`, `LOSSLESS`).
    - Each preset includes `crf`, `preset`, and `description`.

### Static Methods

- **`VideoConverter.getAvailableFormats()`**:
    - Returns the `FORMATS` object.
    - Example: `VideoConverter.getAvailableFormats().MP4` →
      `{ extension: 'mp4', codec: 'libx264', audioCodec: 'aac', description: '...' }`.

- **`VideoConverter.getQualityPresets()`**:
    - Returns the `QUALITY_PRESETS` object.
    - Example: `VideoConverter.getQualityPresets().MEDIUM` → `{ crf: '23', preset: 'medium', description: '...' }`.

- **`VideoConverter.estimateOutputSize(inputSize, quality, outputFormat)`**:
    - Estimates the output file size based on input size, quality preset, and output format.
    - Parameters:
        - `inputSize`: Number (bytes).
        - `quality`: String (e.g., `'MEDIUM'`).
        - `outputFormat`: String (e.g., `'MP4'`).
    - Returns: Number (estimated bytes).
    - Throws: `Error` for invalid quality or format.

### Instance Methods

1. **`constructor({ onProgress, onLog })`**
    - Initializes the converter with optional progress and log callbacks.
    - Parameters:
        - `onProgress`: Function called with `{ percentage, time }`.
        - `onLog`: Function called with log messages.

2. **`loadFFmpeg()`**
    - Loads FFmpeg.wasm asynchronously.
    - Returns: `Promise<void>`.
    - Throws: `Error` if FFmpeg fails to load.

3. **`convertVideo(inputFile, outputFormat, options)`**
    - Converts a WebM file to the specified format.
    - Parameters:
        - `inputFile`: `File` or `Blob` (WebM).
        - `outputFormat`: String (e.g., `'MP4'`).
        - `options`: Object with `quality`, `outputFileName`, `customArgs`.
    - Returns: `Promise<Blob>` (converted video).
    - Throws: `Error` for invalid inputs, formats, or conversion failures.

4. **`getVideoInfo(videoFile)`**
    - Retrieves metadata from a WebM file.
    - Parameters:
        - `videoFile`: `File` or `Blob` (WebM).
    - Returns: `Promise<Object>` with `duration`, `resolution`, `size`, `type`, `name`.
    - Throws: `Error` for invalid inputs.

5. **`cancelConversion()`**
    - Attempts to cancel the current conversion (note: FFmpeg.wasm has limited cancellation support).

6. **`getConversionStatus()`**
    - Returns the current conversion status or `null` if none.
    - Returns: Object with `inputFile`, `outputFormat`, `quality`, `startTime`.

7. **`destroy()`**
    - Cleans up FFmpeg resources and resets the converter.

## Configuration Options

- **`convertVideo` Options**:
    - `quality`: Quality preset (`'LOW'`, `'MEDIUM'`, `'HIGH'`, `'LOSSLESS'`) (default: `'MEDIUM'`).
    - `outputFileName`: Custom output filename (default: `output.<extension>`).
    - `customArgs`: Object with FFmpeg arguments (e.g., `{ '-vf': 'scale=1280:720' }`).

- **FFmpeg Arguments**:
    - Default arguments include `-c:v`, `-c:a`, `-crf`, `-preset`, and `-movflags +faststart`.
    - Custom arguments are appended to allow flexibility (e.g., video filters, bitrate overrides).

## Error Handling

The class throws errors for invalid operations and logs them via the `onLog` callback:

```javascript
const converter = new VideoConverter({
                                         onLog: (message) => console.error('Converter log:', message)
                                     })

try {
    await converter.convertVideo(invalidFile, 'MP4')
}
catch (error) {
    console.error('Conversion error:', error.message)
}
```

Common errors:

- Invalid input file (not WebM).
- Unsupported output format or quality preset.
- FFmpeg.wasm loading or execution failures.
- Invalid custom FFmpeg arguments.

## Dependencies

- **FFmpeg.wasm**: Required for video conversion.
    - Version: `@ffmpeg/ffmpeg@0.12.6`, `@ffmpeg/util@0.12.6`.
    - Install via CDN or npm (see [Installation](#installation)).
- **Browser APIs**: Uses `File`, `Blob`, and WebAssembly.

## Browser Compatibility

- **Supported Browsers**:
    - Modern browsers (Chrome, Firefox, Edge, Safari) with WebAssembly support.
    - FFmpeg.wasm requires significant memory and CPU resources; ensure adequate hardware for smooth performance.
- **MIME Type Support**:
    - Output formats depend on FFmpeg.wasm codecs (`libx264`, `aac`, `mp3`).
    - Some formats (e.g., AVI) may have compatibility issues in certain browsers.
- **Limitations**:
    - FFmpeg.wasm does not support native cancellation, so `cancelConversion` is limited.
    - Large files or high-quality conversions may be slow on low-end devices.

## License

Copyright © 2025 LGS1920. All rights reserved.

This software is proprietary and may not be copied, modified, or distributed without permission from LGS1920.

## Contact

- **Email**: [contact@lgs1920.fr](mailto:contact@lgs1920.fr)
- **Team**: LGS1920 Team
- **Project**: LGS1920/studio

For support or inquiries, please contact the LGS1920 team via email.

---