# VideoRecorder

**VideoRecorder** is a singleton JavaScript class designed to record video from HTML canvas elements or MediaStream
sources (e.g., webcam, screen capture) in a browser environment using the **Mediabunny** library. It is part of the *
*LGS1920/studio** project, providing robust video recording capabilities with customizable settings for frame rate,
quality, maximum duration, and size limits. The class emits custom DOM events to facilitate integration with UI
components, such as a React-based toolbar, and supports advanced features like pausing, resuming, canceling, and
downloading recordings.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
    - [Basic Example](#basic-example)
    - [Recording a Canvas](#recording-a-canvas)
    - [Recording a MediaStream](#recording-a-mediastream)
  - [Handling Downloads](#handling-downloads)
- [API Reference](#api-reference)
    - [Static Properties](#static-properties)
    - [Instance Properties](#instance-properties)
    - [Methods](#methods)
- [Events](#events)
- [Configuration Options](#configuration-options)
- [Error Handling](#error-handling)
- [Dependencies](#dependencies)
- [License](#license)
- [Contact](#contact)

## Features

- **Singleton Pattern**: Ensures a single instance of the recorder for consistent state management across the
  application.
- **Flexible Source Support**: Records from HTML canvas elements (single or multiple) or MediaStream sources (e.g.,
  webcam, screen).
- **Customizable Recording**:
    - Supports `video/mp4` format using Mediabunny's `Mp4OutputFormat`.
  - Configurable frame rate (15, 30, 45, 60 FPS), quality (`QUALITY_LOW`, `QUALITY_MEDIUM`, `QUALITY_HIGH`,
    `QUALITY_VERY_HIGH`), maximum duration, and maximum size.
- **Frame-Based Processing**: Uses `requestAnimationFrame` for frame capture and periodic checks, ensuring smooth
  integration with browser rendering.
- **Event-Driven Architecture**: Emits custom DOM events (`video/start`, `video/stop`, `video/info`, etc.) for seamless
  integration with UI components.
- **Clipping and Compositing**: Supports clipping regions for canvas sources and compositing multiple canvases into a
  single stream.
- **Download Capability**: Supports multiple download types:
    - `local`: Browser-based download via a temporary anchor link.
    - `local-filesystem`: Uses the File System Access API for saving to the local filesystem with progress reporting.
    - (Note: `remote` download is referenced but not implemented in the current code; future updates may add this
      feature.)
- **Pause/Resume**: Allows pausing and resuming recordings with accurate duration tracking, excluding paused time.
- **Cancel Recording**: Supports canceling an ongoing recording without producing output, preserving the source for
  future recordings.
- **Error Handling**: Robust error detection and reporting via custom `video/error` events.
- **Resource Management**: Proper cleanup of streams, canvases, and resources via the `dispose` method.
- **Metadata Support**: Embeds user-provided metadata (e.g., artist, album, date) in the output container.

## Installation

The `VideoRecorder` class is a JavaScript module that relies on the **Mediabunny** library for video encoding and
recording. To use it in your project:

1. **Install Dependencies**:
   Ensure Mediabunny and Luxon are installed in your project using Bun:
   ```bash
   bun add mediabunny luxon
   ```

2. **Copy the File**:
   Place `VideoRecorder.js` in your project's source directory (e.g., `src/utils/`).

3. **Import the Module**:
   Import the `VideoRecorder` class in your JavaScript or React application:
   ```javascript
   import { VideoRecorder } from './path/to/VideoRecorder.js'
   ```

4. **Ensure Browser Compatibility**:
   Verify that your target browsers support the necessary APIs for Mediabunny, canvas/MediaStream capture,
   `requestAnimationFrame`, and the File System Access API (for `local-filesystem` downloads). The `video/mp4` format
   requires browser support for MP4 encoding.

## Usage

### Basic Example

Initialize and start recording a default canvas stream:

```javascript
/**
 * Basic example of recording a default canvas and downloading the result
 */
import { ScreenMediaRecorder, QUALITY_HIGH } from './ScreenMediaRecorder.js'

const recorder = new ScreenMediaRecorder()

// Initialize with custom settings
recorder.initialize({
                        maxDuration: 10 * 60 * 1000, // 10 minutes
                        fps:         60,
                        quality:  QUALITY_HIGH,
                        metadata: {artist: 'LGS1920', title: 'Demo Recording'}
                    })

// Start recording
recorder.start()

// Stop recording after 5 seconds and download
setTimeout(() => {
    recorder.stop().then(() => {
        recorder.download({type: 'local', filename: 'my-video.mp4'})
    })
}, 5000)
```

### Recording a Canvas

Record from a specific canvas with clipping:

```javascript
/**
 * Example of recording from a canvas with clipping
 */
import { ScreenMediaRecorder, QUALITY_MEDIUM } from './ScreenMediaRecorder.js'

const canvas = document.createElement('canvas')
canvas.width = 1920
canvas.height = 1080
const ctx = canvas.getContext('2d')
// Draw something on the canvas
ctx.fillStyle = 'blue'
ctx.fillRect(0, 0, canvas.width, canvas.height)

const recorder = new ScreenMediaRecorder()
recorder.initialize({
                        quality:  QUALITY_MEDIUM,
                        metadata: {description: 'Canvas recording example'}
                    })

// Set the canvas as the source with a clipping region
recorder.setSource([canvas], {
    clipX:      100,
    clipY:      100,
    clipWidth:  800,
    clipHeight: 600,
    width:      800, // Output resolution
    height:     600
})

// Start recording
recorder.start()

// Stop after 5 seconds
setTimeout(() => recorder.stop(), 5000)
```

### Recording a MediaStream

Record from a webcam stream:

```javascript
/**
 * Example of recording from a webcam stream
 */
import { ScreenMediaRecorder } from './ScreenMediaRecorder.js'

const startWebcamRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({video: true})
    const recorder = new ScreenMediaRecorder()
    recycler.initialize({
                            metadata: {genre: 'Webcam', date: new Date().toISOString()}
                        })

    // Set the webcam stream as the source
    await recorder.setStream(stream)

    // Start recording
    recorder.start()

    // Stop after 5 seconds and clean up
    setTimeout(() => {
        recorder.stop()
        recorder.dispose()
    }, 5000)
}

startWebcamRecording()
```

### Handling Downloads

Handle different download types (`local`, `local-filesystem`):

```javascript
/**
 * Example of handling downloads with File System Access API
 */
import { ScreenMediaRecorder } from './ScreenMediaRecorder.js'

const recorder = new ScreenMediaRecorder()
recorder.initialize({
                        maxDuration: 5 * 60 * 1000 // 5 minutes
                    })

// Listen for download events
recorder.addEventListener(ScreenMediaRecorder.events.DOWNLOAD, ({detail}) => {
    console.log('Download started:', detail.filename, detail.type)
    if (detail.type === 'local-filesystem') {
        console.log('Progress:', detail.progress * 100, '%')
    }
})

// Start and stop recording
recorder.start()
setTimeout(() => {
    recorder.stop().then(() => {
        // Download to local filesystem
        recorder.download({type: 'circular-filesystem', filename: 'my-video.mp4'})
    })
}, 5000)
```

## API Reference

### Static Properties

- **`VideoRecorder.events`**:
    - Object defining custom event names for the recording lifecycle.
    - Example: `VideoRecorder.events.START` → `'video/start'`.
    - See [Events](#events) for details.

- **`VideoRecorder.CLASSES`**:
    - Object defining CSS classes applied to the `<body>` element during recording (`recording-in-progress`) and pause (
      `recording-paused`).

- **`VideoRecorder.QUALITY`**:
    - Array of quality settings (`QUALITY_LOW`, `QUALITY_MEDIUM`, `QUALITY_HIGH`, `QUALITY_VERY_HIGH`) with `value`,
      `name`, and `short` properties.

- **`VideoRecorder.FPS`**:
    - Array of supported frame rates (15, 30, 45, 60).

- **`VideoRecorder.DEFAULT_FPS`**:
    - Default frame rate index (optional, defaults to 30 FPS if undefined).

- **`VideoRecorder.DEFAULT_QUALITY`**:
    - Default quality index (optional, defaults to `QUALITY_MEDIUM` if undefined).

### Instance Properties

- **`size`** (getter):
    - Returns the total bytes recorded (`number`).
    - Updated during recording via the `onwrite` callback and finalized in the `stop` method.

- **`duration`** (getter):
    - Returns the elapsed recording time in milliseconds, excluding paused time (`number`).

### Methods

1. **`initialize = ({ maxDuration, fps, timeslice, quality, maxSize, metadata } = {})`**
    - Configures the recorder with recording parameters and creates a default canvas if no stream is set.
    - Parameters:
        - `maxDuration`: Maximum recording duration in milliseconds (default: `Infinity`).
        - `fps`: Frames per second (default: 30).
        - `timeslice`: Interval for `INFO` events in milliseconds (default: 1000).
        - `quality`: Recording quality (default: `QUALITY_MEDIUM`).
        - `maxSize`: Maximum recording size in bytes (default: `Infinity`).
        - `metadata`: User-provided metadata for the output container (default: `{ date: new Date() }`).
    - Throws: `Error` if called during recording.

2. **`setSource = (canvases, { width, height, clipX, clipY, clipWidth, clipHeight } = {})`**
    - Sets one or more canvases as the recording source with optional clipping.
    - Parameters:
        - `canvases`: Array of `HTMLCanvasElement`.
        - `options`: Object with `width`, `height`, `clipX`, `clipY`, `clipWidth`, `clipHeight`.
    - Throws: `Error` if invalid canvases, clipping parameters, or called during recording.

3. **`setStream = async (stream)`**
    - Sets a `MediaStream` as the recording source.
    - Parameters:
        - `stream`: `MediaStream` instance.
    - Throws: `TypeError` if `stream` is not a `MediaStream`; `Error` if called during recording.

4. **`start = async ()`**
    - Starts recording using a frame-based loop (`requestAnimationFrame`) and emits `START` event.
    - Throws: `Error` if no active source or recording is already in progress.

5. **`stop = async ()`**
    - Stops recording, finalizes the output, and emits `STOP` and `FINALIZE` events with the recorded `Blob`,
      `duration`, `metadata`, and `size`.
    - Throws: `Error` if no active recording.

6. **`cancel = async ()`**
    - Cancels an ongoing recording without finalizing or producing output, emits `CANCEL` event, and preserves the
      source for future recordings.
    - Does not emit `STOP` or `FINALIZE` events.

7. **`pause = ()`**
    - Pauses recording and emits `PAUSE` event.
    - Throws: `Error` if not recording.

8. **`resume = ()`**
    - Resumes a paused recording and emits `RESUME` event.
    - Throws: `Error` if not paused.

9. **`isRecording = ()`**
    - Returns `true` if recording is active (not paused).

10. **`download = async ({ filename, type, url, headers, path } = {})`**
    - Triggers a download of the recorded video with a timestamped filename.
    - Parameters:
        - `filename`: Name of the file (default: generated from `APP_KEY` with timestamp).
        - `type`: Download type (`'local'`, `'local-filesystem'`; default: `'local'`).
        - `url`: HTTPS URL for remote upload (not implemented in current code).
        - `headers`: HTTP headers for remote upload (not implemented in current code).
        - `path`: File path for `local-filesystem` download.
    - Emits `DOWNLOAD` event with progress for `local-filesystem`.
    - Throws: `Error` if no recorded data, invalid download type, or missing required options.

11. **`dispose = ()`**
    - Cleans up resources (stops recording, streams, canvases, etc.) and resets internal state.

12. **`filename = ({ filename, useTimestamp } = {})`**
    - Generates a filename with an optional timestamp prefix.
    - Parameters:
        - `filename`: Base filename (default: `APP_KEY`).
        - `useTimestamp`: Include timestamp prefix (default: `true`).
    - Returns: Formatted filename as a string.

## Events

The `VideoRecorder` class extends `EventTarget` and emits the following custom DOM events:

| Event Name           | Description                              | Detail Properties                                                                                            |
|----------------------|------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `video/start`        | Fired when recording starts              | `timestamp`                                                                                                  |
| `video/stop`         | Fired when recording stops               | `blob`, `metadata`, `duration`, `size`, `timestamp`                                                          |
| `video/info`         | Fired periodically during recording      | `timestamp`, `duration`, `size`, `fps`, `quality`                                                            |
| `video/pause`        | Fired when recording is paused           | `timestamp`, `duration`                                                                                      |
| `video/resume`       | Fired when recording resumes             | `timestamp`, `duration`                                                                                      |
| `video/source`       | Fired when a new source is set           | `type`, `timestamp`, `width`, `height`, `canvases`, `clipX`, `clipY`, `clipWidth`, `clipHeight` (for canvas) |
| `video/error`        | Fired on errors                          | `error`, `timestamp`                                                                                         |
| `video/download`     | Fired when a video is downloaded         | `type`, `download`, `timestamp`, `filename`, `size`, `duration`, `mime`, `progress` (for `local-filesystem`) |
| `video/max-duration` | Fired when max duration limit is reached | `timestamp`, `duration`, `max`                                                                               |
| `video/max-size`     | Fired when max size limit is reached     | `timestamp`, `size`, `max`                                                                                   |
| `video/finalize`     | Fired when output is finalized           | `blob`, `metadata`, `duration`, `size`, `timestamp`                                                          |
| `video/cancel`       | Fired when recording is canceled         | `timestamp`                                                                                                  |

Example of listening to events:

```javascript
recorder.addEventListener(ScreenMediaRecorder.events.START, () => {
    console.log('Recording started')
})
recorder.addEventListener(ScreenMediaRecorder.events.STOP, ({detail}) => {
    console.log('Recording stopped:', detail.size, 'bytes,', detail.duration, 'ms')
})
```

## Configuration Options

- **`initialize` Options**:
    - `maxDuration`: Maximum recording duration in milliseconds (default: `Infinity`).
  - `fps`: Frames per second (default: 30).
  - `timeslice`: Interval for `INFO` events in milliseconds (default: 1000).
  - `quality`: Recording quality (`QUALITY_LOW`, `QUALITY_MEDIUM`, `QUALITY_HIGH`, `QUALITY_VERY_HIGH`; default:
    `QUALITY_MEDIUM`).
  - `maxSize`: Maximum recording size in bytes (default: `Infinity`).
  - `metadata`: User-provided metadata (e.g., artist, album, date; default: `{ date: new Date() }`).

- **`setSource` Options**:
    - `width`, `height`: Output resolution in physical pixels (defaults to `clipWidth`, `clipHeight`).
  - `clipX`, `clipY`: Top-left corner of the clipping region in physical pixels (default: 0).
    - `clipWidth`, `clipHeight`: Clipping region size in physical pixels (defaults to canvas dimensions).

- **`download` Options**:
    - `type`: Download type (`'local'`, `'local-filesystem'`; default: `'local'`).
    - `filename`: Name of the file (default: generated with timestamp and `APP_KEY`).
    - `url`: HTTPS URL for remote upload (not implemented).
    - `headers`: HTTP headers for remote upload (not implemented).
    - `path`: File path for `local-filesystem` download.

## Error Handling

The class throws errors for invalid operations and emits `video/error` events with details:

```javascript
recorder.addEventListener(ScreenMediaRecorder.events.ERROR, ({detail}) => {
    console.error('Recorder error:', detail.error.message)
})
```

Common errors:

- No active source (canvas or MediaStream).
- Invalid canvas or clipping parameters.
- Operations attempted during active recording.
- No recorded data for download.
- Invalid download type or missing required options.
- Failure to set metadata (non-fatal, reported via `ERROR` event).

## Dependencies

- **Mediabunny**: Used for video encoding and recording (`Output`, `Mp4OutputFormat`, `BufferTarget`, `CanvasSource`).
- **Luxon**: Used for timestamp formatting in metadata and filenames.
- **@Core/constants**: Provides project-specific constants (e.g., `APP_KEY`, `SECOND`).

**Browser Support**:

- Requires modern browsers with support for canvas APIs, MediaStream, `requestAnimationFrame`, and Mediabunny's encoding
  capabilities.
- The `video/mp4` format requires browser support for MP4 encoding.
- The File System Access API (for `local-filesystem` downloads) is supported in modern browsers like Chrome and Edge but
  may require a fallback for unsupported browsers.

## License

Copyright © 2025 LGS1920. All rights reserved.

This software is proprietary and may not be copied, modified, or distributed without permission from LGS1920.

## Contact

- **Email**: [contact@lgs1920.fr](mailto:contact@lgs1920.fr)
- **Team**: LGS1920 Team
- **Project**: LGS1920/studio

For support or inquiries, please contact the LGS1920 team via email.