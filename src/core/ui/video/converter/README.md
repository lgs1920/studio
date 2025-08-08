# VideoConverter

**VideoConverter** is a JavaScript class designed to convert video files between formats (e.g., MP4, WebM) using a
remote backend API. It is part of the **LGS1920/studio** project, providing a client-side interface for video conversion
with real-time progress tracking via Server-Sent Events (SSE) or polling. The class integrates with other components
like `VideoRecorder` and `VideoRecorderToolbar` for a seamless video processing workflow.

## Table of Contents

- Features
- Installation
- Usage
    - Basic Example
    - Converting a Video
- API Reference
    - Static Properties
    - Static Methods
    - Instance Methods
- Configuration Options
- Error Handling
- Dependencies
- Browser Compatibility
- License
- Contact

## Features

- **Video Conversion**: Converts video files between supported formats (MP4, WebM) using a remote backend API with
  FFmpeg.
- **Quality Presets**: Supports configurable quality settings (Medium, High) for balancing file size and quality.
- **Progress Tracking**: Provides real-time progress updates via callbacks, using SSE or polling for percentage updates.
- **Metadata Support**: Applies custom metadata (e.g., date, album, genre) to the output video.
- **Custom FFmpeg Arguments**: Configures FFmpeg arguments based on format and quality presets, with support for video
  filters and codecs.
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
    - The backend must support FFmpeg-based video conversion and provide SSE or polling for progress updates.

3. **Import the Module**:

    - Import the `VideoConverter` class in your JavaScript or React application:

      ```javascript
      import { VideoConverter } from './path/to/VideoConverter.js'
      ```

4. **Browser Compatibility**:

    - Ensure your target browsers support modern JavaScript (ES modules), `fetch`, and optionally `EventSource` for SSE.
    - See Browser Compatibility for details.

## Usage

### Basic Example

Convert a WebM file to MP4 with default settings:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function convertVideo() {
    const converter = new VideoConverter({
                                             onProgress: ({percentage}) => console.log(`Progress: ${percentage}%`),
                                             onLog:      (message) => console.log(`Log: ${message}`),
                                             backend:    'http://localhost:3333',
                                             sse:        true
                                         })

    try {
        // Load a video file (e.g., from a file input)
        const inputFile = new File([/* video blob */], 'input.webm', {type: 'video/webm'})

        // Convert to MP4 with medium quality
        const outputBlob = await converter.convertVideo(inputFile, 'WEBM', 'MP4', {
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

Convert a WebM file to MP4 with high quality and custom metadata:

```javascript
import { VideoConverter } from './VideoConverter.js'

async function convertToMP4() {
    const converter = new VideoConverter({
                                             onProgress: ({percentage}) => console.log(`Progress: ${percentage}%`),
                                             onLog:   (message) => console.log(message),
                                             backend: 'http://localhost:3333',
                                             sse:     true
                                         })

    const inputFile = new File([/* video blob */], 'input.webm', {type: 'video/webm'})

    try {
        const outputBlob = await converter.convertVideo(inputFile, 'WEBM', 'MP4', {
            quality:        'HIGH',
            outputFileName: 'output.mp4',
            metadata:       {
                title:   'My Video',
                comment: 'Converted with VideoConverter'
            }
        })

        console.log('Converted video size:', outputBlob.size)
    }
    catch (error) {
        console.error('Conversion error:', error.message)
    }
}
```

## API Reference

### Static Properties

- `VideoConverter.FORMATS`:

    - Object defining supported formats (`MP4`, `WEBM`).
    - Each format includes `extension`, `codec`, `audioCodec`, `mimeType`, `description`, `videoFilters`, and
      `extraArgs`.
    - Example: `{ MP4: { extension: 'mp4', codec: 'libx264', audioCodec: 'aac', ... } }`.

- `VideoConverter.QUALITY_PRESETS`:

    - Object defining quality presets (`MEDIUM`, `HIGH`).
    - Each preset includes `crf`, `preset`, and `description`.
    - Example: `{ MEDIUM: { crf: '25', preset: 'veryfast', description: 'Medium - balanced' } }`.

### Static Methods

- `VideoConverter.getAvailableFormats()`:

      - Returns the `FORMATS` object.
    - Example: `VideoConverter.getAvailableFormats().MP4` → `{ extension: 'mp4', codec: 'libx264', ... }`.

- `VideoConverter.getQualityPresets()`:

      - Returns the `QUALITY_PRESETS` object.
    - Example: `VideoConverter.getQualityPresets().MEDIUM` → `{ crf: '25', preset: 'veryfast', ... }`.

### Instance Methods

1. `constructor({ onProgress, onLog, backend, sse })`

    - Initializes the converter with callbacks and backend configuration.
    - Parameters:
        - `onProgress`: Function called with `{ percentage, time }` for progress updates.
        - `onLog`: Function called with log messages.
        - `backend`: String, required backend base URL (e.g., `'http://localhost:3333'`).
        - `sse`: Boolean, use SSE (`true`) or polling (`false`) for progress tracking (default: `true`).
    - Throws: `Error` if backend URL is not provided.

2. `convertVideo(inputFile, inputFormat, outputFormat, options)`

    - Converts a video file to the specified format via the backend API.
    - Parameters:
        - `inputFile`: `File` or `Blob` (input video).
        - `inputFormat`: String (e.g., `'WEBM'`, `'MP4'`).
        - `outputFormat`: String (e.g., `'MP4'`, `'WEBM'`).
        - `options`: Object with `quality`, `outputFileName`, `duration`, `metadata`.
    - Returns: `Promise<Blob>` (converted video).
    - Throws: `Error` for invalid inputs, formats, quality presets, or conversion failures.

3. `destroy()`

    - Cleans up resources (SSE connections, polling intervals, timeouts).

## Configuration Options

- `convertVideo` **Options**:

    - `quality`: Quality preset (`'MEDIUM'`, `'HIGH'`) (default: `'MEDIUM'`).
    - `outputFileName`: Custom output filename (default: `output.<extension>`).
    - `duration`: Video duration in milliseconds for progress calculation.
    - `metadata`: Object with key-value pairs for video metadata (e.g., `{ title: 'My Video' }`).

- **FFmpeg Arguments**:

    - Automatically configured based on format and quality presets (e.g., `-c:v libx264`, `-crf 25`,
      `-preset veryfast`).
    - Includes video filters (e.g., `format=yuv420p`) and format-specific arguments (e.g., `-movflags +faststart` for
      MP4).

## Error Handling

The class throws errors for invalid operations and logs them via the `onLog` callback:

```javascript
const converter = new VideoConverter({
                                         onLog:   (message) => console.error('Converter log:', message),
                                         backend: 'http://localhost:3333'
                                     })

try {
    await converter.convertVideo(invalidFile, 'WEBM', 'MP4')
}
catch (error) {
    console.error('Conversion error:', error.message)
}
```

Common errors:

- Invalid input file (not a `File`/`Blob` or empty).
- Unsupported input or output format (e.g., not `'MP4'` or `'WEBM'`).
- Unsupported quality preset (e.g., not `'MEDIUM'` or `'HIGH'`).
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
    - Supports `video/mp4` and `video/webm` based on backend FFmpeg configuration.
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