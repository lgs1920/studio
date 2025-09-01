# VideoRecorder

**VideoRecorder** is a singleton JavaScript class designed to record video from HTML canvas elements or MediaStream
sources (e.g., webcam, screen capture) in a browser environment using the **Mediabunny** library. It is part of the *
*LGS1920/studio** project, providing robust video recording capabilities with customizable settings for frame rate,
quality, and duration limits. The class emits custom DOM events to facilitate integration with UI components, such as a
React-based toolbar.

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
    - Configurable frame rate (FPS), quality (`QUALITY_LOW`, `QUALITY_MEDIUM`, `QUALITY_HIGH`), and maximum duration.
- **Frame-Based Processing**: Uses `requestAnimationFrame` for frame capture and periodic checks, ensuring smooth
  integration with browser rendering.
- **Event-Driven Architecture**: Emits custom DOM events (`video/start`, `video/stop`, `video/info`, etc.) for seamless
  integration with UI components.
- **Clipping and Compositing**: Supports clipping regions for canvas sources and compositing multiple canvases into a
  single stream.
- **Download Capability**: Supports local downloads (via link or UI-provided path) and remote uploads via HTTP POST with
  timestamped filenames.
- **Pause/Resume**: Allows pausing and resuming recordings with accurate duration tracking.
- **Error Handling**: Robust error detection and reporting via custom events.
- **Resource Management**: Proper cleanup of streams and resources via the `dispose` method.

## Installation

The `VideoRecorder` class is a JavaScript module that relies on the **Mediabunny** library for video encoding and
recording. To use it in your project:

1. **Install Mediabunny**:
   Ensure Mediabunny is installed in your project:
   ```bash
   bun add mediabunny
   ```

2. **Copy the File**:
   Place `VideoRecorder.js` in your project's source directory (e.g., `src/utils/`).

3. **Import the Module**:
   Import the `VideoRecorder` class in your JavaScript or React application:
   ```javascript
   import { VideoRecorder } from './path/to/VideoRecorder.js'
   ```

4. **Ensure Browser Compatibility**:
   Verify that your target browsers support the necessary APIs for Mediabunny, canvas/MediaStream capture, and
   `requestAnimationFrame`. The `video/mp4` format requires browser support for MP4 encoding.

## Usage

### Basic Example

Initialize and start recording a default canvas stream:

```javascript
import { VideoRecorder, QUALITY_HIGH } from './VideoRecorder.js'

const recorder = new VideoRecorder()

// Initialize with a callback to handle the recorded video
recorder.initialize(({blob, duration, metadata, totalBytes}) => {
    console.log('Recording stopped:', {blob, duration, metadata, totalBytes})
}, {
                        filename:    'my-video',
                        maxDuration: 10 * 60 * 1000, // 10 minutes
                        fps:         60,
                        quality:     QUALITY_HIGH
                    })

// Start recording
recorder.start()

// Stop recording after 5 seconds
setTimeout(() => recorder.stop(), 5000)

// Download the recorded video
recorder.download({type: 'local'})
```

### Recording a Canvas

Record from a specific canvas with clipping:

```javascript
import { VideoRecorder, QUALITY_MEDIUM } from './VideoRecorder.js'

const canvas = document.createElement('canvas')
canvas.width = 1920
canvas.height = 1080
const ctx = canvas.getContext('2d')
// Draw something on the canvas
ctx.fillStyle = 'blue'
ctx.fillRect(0, 0, canvas.width, canvas.height)

const recorder = new VideoRecorder()
recorder.initialize(({blob, duration, metadata, totalBytes}) => {
    console.log('Recording stopped:', {blob, duration, metadata, totalBytes})
}, {quality: QUALITY_MEDIUM})

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
```

### Recording a MediaStream

Record from a webcam stream:

```javascript
import { VideoRecorder } from './VideoRecorder.js'

async function startWebcamRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({video: true})
    const recorder = new VideoRecorder()
    recorder.initialize(({blob, duration, metadata, totalBytes}) => {
        console.log('Recording stopped:', {blob, duration, metadata, totalBytes})
    })

    // Set the webcam stream as the source
    await recorder.setStream(stream)

    // Start recording
    recorder.start()

    // Clean up
    return () => recorder.dispose()
}
```

### Handling Downloads

Handle different download types (`local`, `local-filesystem`, `remote`):

```javascript
import { VideoRecorder } from './VideoRecorder.js'

const recorder = new VideoRecorder()
recorder.initialize(({blob, duration, metadata, totalBytes}) => {
    console.log('Recording stopped:', {blob, duration, metadata, totalBytes})
})

// Listen for download events
recorder.addEventListener(VideoRecorder.events.DOWNLOAD, ({detail}) => {
    if (detail.downloadType === 'local-filesystem') {
        // Example using File System Access API in the UI
        window.showSaveFilePicker({
                                      suggestedName: detail.path,
                                      types:         [{description: 'MP4 Video', accept: {'video/mp4': ['.mp4']}}]
                                  }).then(fileHandle => fileHandle.createWritable())
            .then(writable => writable.write(detail.blob).then(() => writable.close()))
            .catch(error => console.error('Download error:', error))
    }
})

// Start and stop recording
recorder.start()
setTimeout(() => {
    recorder.stop()
    // Download to local filesystem with a UI-provided path
    recorder.download({type: 'local-filesystem', path: 'my-video.mp4'})
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

### Instance Properties

- **`size`** (getter): Returns the total bytes recorded (`number`). In the current version, this value is only accurate
  after stopping the recording (this will change in future versions).
- **`duration`** (getter): Returns the elapsed recording time in milliseconds, excluding paused time (`number`).
- **`mimeType`** (getter/setter):
    - Gets or sets the MIME type for recording (only `'video/mp4'` is supported).
    - Throws an error if changed during recording or if an unsupported MIME type is set.

### Methods

1. **`initialize(onStop, options)`**
    - Configures the recorder with a callback and settings.
    - Parameters:
        - `onStop`: Function to handle the recorded `Blob`, `duration`, `metadata`, `totalBytes`, and `timestamp`.
        - `options`: Object with `maxDuration`, `fps`, `timeslice`, `filename`, `quality`.
    - Throws: `TypeError` if `onStop` is not a function or `quality` is invalid; `Error` if called during recording.

2. **`setSource(canvases, options)`**
    - Sets one or more canvases as the recording source.
    - Parameters:
        - `canvases`: Array of `HTMLCanvasElement`.
        - `options`: Object with `width`, `height`, `clipX`, `clipY`, `clipWidth`, `clipHeight`.
    - Throws: `Error` if invalid canvases, clipping parameters, or called during recording.

3. **`setStream(stream)`**
    - Sets a `MediaStream` as the recording source.
    - Parameters:
        - `stream`: `MediaStream` instance.
    - Throws: `TypeError` if `stream` is not a `MediaStream`; `Error` if called during recording.

4. **`start()`**
    - Starts recording using a frame-based loop (`requestAnimationFrame`) and emits `START` event.
    - Throws: `Error` if no active source or recording is already in progress.

5. **`stop()`**
    - Stops recording and emits `STOP` event, providing the final `totalBytes` (in the current version, `totalBytes` is
      only accurate in this event; this will change in future versions).

6. **`pause()`**
    - Pauses recording and emits `PAUSE` event.
    - Throws: `Error` if not recording.

7. **`resume()`**
    - Resumes a paused recording and emits `RESUME` event.
    - Throws: `Error` if not paused.

8. **`isRecording()`**
    - Returns `true` if recording is active (not paused).

9. **`download(options)`**
    - Triggers a download of the recorded video with a timestamped filename.
    - Parameters:
        - `options`: Object with `type` (`'local'`, `'local-filesystem'`, `'remote'`), `url` (for `remote`), `headers` (
          for `remote`), `path` (for `local-filesystem`).
    - Emits `DOWNLOAD` event.
    - Throws: `Error` if no recorded data, invalid download type, or missing required options.

10. **`dispose()`**
    - Cleans up resources (stops recording, streams, etc.).

## Events

The `VideoRecorder` class extends `EventTarget` and emits the following custom DOM events:

| Event Name           | Description                              | Detail Properties                                                                                                                                  |
|----------------------|------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `video/start`        | Fired when recording starts              | `timestamp`                                                                                                                                        |
| `video/stop`         | Fired when recording stops               | `blob`, `metadata`, `duration`, `totalBytes` (final size, accurate only in this event in the current version; this will change in future versions) |
| `video/info`         | Fired periodically during recording      | `totalBytes` (not accurate in the current version; this will change in future versions), `duration`, `timestamp`                                   |
| `video/pause`        | Fired when recording is paused           | `timestamp`, `duration`                                                                                                                            |
| `video/resume`       | Fired when recording resumes             | `timestamp`, `duration`                                                                                                                            |
| `video/source`       | Fired when a new source is set           | `type`, `timestamp`, `width`, `height`, `canvases`, `clipX`, `clipY`, `clipWidth`, `clipHeight` (for canvas)                                       |
| `video/error`        | Fired on errors                          | `error`, `timestamp`                                                                                                                               |
| `video/download`     | Fired when a video is downloaded         | `type`, `downloadType`, `timestamp`, `filename`, `size`, `blob` (for `local-filesystem`), `path` (for `local-filesystem`), `url` (for `remote`)    |
| `video/max-duration` | Fired when max duration limit is reached | `duration`, `timestamp`                                                                                                                            |

Example of listening to events:

```javascript
recorder.addEventListener(VideoRecorder.events.START, () => {
    console.log('Recording started')
})
recorder.addEventListener(VideoRecorder.events.STOP, ({detail}) => {
    console.log('Recording stopped:', detail.totalBytes, 'bytes,', detail.duration, 'ms')
})
```

## Configuration Options

- **`initialize` Options**:
    - `maxDuration`: Maximum recording duration in milliseconds (default: `Infinity`).
  - `fps`: Frames per second (default: `30`).
  - `timeslice`: Interval for `INFO` events in milliseconds (default: `1000`).
    - `filename`: Base filename for downloads (default: `'video'`).
  - `quality`: Recording quality (`QUALITY_LOW`, `QUALITY_MEDIUM`, `QUALITY_HIGH`; default: `QUALITY_MEDIUM`).

- **`setSource` Options**:
    - `width`, `height`: Output resolution in physical pixels (defaults to `clipWidth`, `clipHeight`).
    - `clipX`, `clipY`: Top-left corner of the clipping region in physical pixels (default: `0`).
    - `clipWidth`, `clipHeight`: Clipping region size in physical pixels (defaults to canvas dimensions).

- **`download` Options**:
    - `type`: Download type (`'local'`, `'local-filesystem'`, `'remote'`; default: `'local'`).
    - `url`: HTTPS URL for remote upload (required for `remote`).
    - `headers`: HTTP headers for remote upload (optional).
    - `path`: File path for local filesystem download (required for `local-filesystem`).

## Error Handling

The class throws errors for invalid operations and emits `video/error` events with details:

```javascript
recorder.addEventListener(VideoRecorder.events.ERROR, ({detail}) => {
    console.error('Recorder error:', detail.error.message)
})
```

Common errors:

- Unsupported MIME type (only `video/mp4` is supported).
- Invalid canvas or clipping parameters.
- No active source (canvas or MediaStream).
- Operations attempted during active recording.
- Missing required options for download.

## Dependencies

- **Mediabunny**: Used for video encoding and recording (`Output`, `Mp4OutputFormat`, `BufferTarget`, `CanvasSource`).
- **Luxon**: Used for timestamp formatting in metadata.
- **@Core/constants**: Provides project-specific constants (e.g., `LGS_PROJECT`).

**Browser Support**:

- Requires modern browsers with support for canvas APIs, MediaStream, `requestAnimationFrame`, and Mediabunny's encoding
  capabilities.
- The `video/mp4` format requires browser support for MP4 encoding.

## License

Copyright © 2025 LGS1920. All rights reserved.

This software is proprietary and may not be copied, modified, or distributed without permission from LGS1920.

## Contact

- **Email**: [contact@lgs1920.fr](mailto:contact@lgs1920.fr)
- **Team**: LGS1920 Team
- **Project**: LGS1920/studio

For support or inquiries, please contact the LGS1920 team via email.