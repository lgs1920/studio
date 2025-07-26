# VideoRecorder

**VideoRecorder** is a singleton JavaScript class designed to record video from HTML canvas elements or MediaStream
sources (e.g., webcam, screen capture) in a browser environment. It is part of the **LGS1920/studio** project, providing
robust video recording capabilities with customizable settings for MIME types, bitrate, frame rate, size limits, and
duration limits. The class emits custom DOM events to facilitate integration with UI components, such as the
`VideoRecorderToolbar` React component.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
    - [Basic Example](#basic-example)
    - [Recording a Canvas](#recording-a-canvas)
    - [Recording a MediaStream](#recording-a-mediastream)
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
    - Supports MIME types like `video/webm` and `video/mp4` (if supported by the browser).
    - Configurable frame rate (FPS), bitrate, maximum size, and maximum duration.
- **Event-Driven Architecture**: Emits custom DOM events (`start`, `stop`, `pause`, `resume`, `size`, etc.) for seamless
  integration with UI components.
- **Clipping and Compositing**: Supports clipping regions for canvas sources and compositing multiple canvases into a
  single stream.
- **Download Capability**: Automatically generates downloadable video files with timestamped filenames.
- **Error Handling**: Robust error detection and reporting via custom events.
- **Resource Management**: Proper cleanup of streams and resources via the `dispose` method.

## Installation

The `VideoRecorder` class is a standalone JavaScript module that runs in modern browsers supporting the `MediaRecorder`
API and `canvas.captureStream`. To use it in your project:

1. **Copy the File**:

- Place `VideoRecorder.js` in your project's source directory (e.g., `src/utils/`).

2. **Import the Module**:

- Import the `VideoRecorder` class in your JavaScript or React application:
  ```javascript
  import { VideoRecorder } from './path/to/VideoRecorder.js'
  ```

3. **Ensure Browser Compatibility**:

- Verify that your target browsers support `MediaRecorder`, `canvas.captureStream`, and the desired MIME types (
  `video/webm` is widely supported; `video/mp4` may require specific codecs).

No external dependencies are required, as the class uses native browser APIs.

## Usage

### Basic Example

Initialize and start recording a default canvas stream:

```javascript
import { VideoRecorder } from './VideoRecorder.js'

const recorder = new VideoRecorder()

// Initialize with a callback to handle the recorded video
recorder.initialize((blob, duration) => {
    console.log('Recording stopped:', {blob, duration})
}, 'video/webm', {
                        filename:    'my-video',
                        maxSize:     100 * 1024 * 1024, // 100 MB
                        maxDuration: 10 * 60 * 1000, // 10 minutes
                        fps:         30,
                        bitrate:     8000000 // 8 Mbps
                    })

// Start recording
recorder.start()

// Stop recording after 5 seconds
setTimeout(() => recorder.stop(), 5000)

// Download the recorded video
recorder.download()
```

### Recording a Canvas

Record from a specific canvas with clipping:

```javascript
import { VideoRecorder } from './VideoRecorder.js'

const canvas = document.createElement('canvas')
canvas.width = 1920
canvas.height = 1080
const ctx = canvas.getContext('2d')
// Draw something on the canvas
ctx.fillStyle = 'blue'
ctx.fillRect(0, 0, canvas.width, canvas.height)

const recorder = new VideoRecorder()
recorder.initialize((blob, duration) => {
  console.log('Recording stopped:', {blob, duration})
}, 'video/webm')

// Set the canvas as the source with a clipping region
recorder.setSource([canvas], {
  clipX:         100,
  clipY:         100,
  clipWidth:     800,
  clipHeight:    600,
  width:         800, // Output resolution
  height:        600,
  onNeedsRedraw: () => true // Force redraw every frame
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
  recorder.initialize((blob, duration) => {
    console.log('Recording stopped:', {blob, duration})
  })

  // Set the webcam stream as the source
  recorder.setStream(stream)

  // Start recording
  recorder.start()

  // Clean up
  return () => recorder.dispose()
}
```

## API Reference

### Static Properties

- **`VideoRecorder.events`**:
    - Object defining custom event names for the recording lifecycle.
    - Example: `VideoRecorder.events.START` → `'video/start'`.
    - See [Events](#events) for details.

### Instance Properties

- **`size`** (getter): Returns the total bytes recorded (`number`).
- **`duration`** (getter): Returns the elapsed recording time in milliseconds (`number`).
- **`mimeType`** (getter/setter):
    - Gets or sets the MIME type for recording (e.g., `'video/webm'`).
    - Throws an error if changed during recording or if the MIME type is unsupported.
- **Internal State** (not meant for direct access):
    - `stream`, `mediaRecorder`, `chunks`, `totalBytes`, `startTime`, `fps`, `bitrate`, `maxSize`, `maxDuration`,
      `filename`, `sourceType`, `needsRedraw`, etc.

### Methods

1. **`initialize(onStop, mimeType = 'video/webm;codecs=vp9', options)`**

- Configures the recorder with a callback and settings.
- Parameters:
    - `onStop`: Function to handle the recorded `Blob` and duration.
    - `mimeType`: String, e.g., `'video/webm'`.
    - `options`: Object with `maxSize`, `maxDuration`, `fps`, `bitrate`, `timeslice`, `filename`.
- Throws: `TypeError` or `Error` if invalid.

2. **`setSource(canvases, options)`**

- Sets one or more canvases as the recording source.
- Parameters:
    - `canvases`: Array of `HTMLCanvasElement`.
    - `options`: Object with `width`, `height`, `clipX`, `clipY`, `clipWidth`, `clipHeight`, `preserveAlpha`,
      `onNeedsRedraw`.
- Throws: `Error` if invalid canvases or clipping parameters.

3. **`setStream(stream)`**

- Sets a `MediaStream` as the recording source.
- Parameters:
    - `stream`: `MediaStream` instance.
- Throws: `TypeError` or `Error` if invalid.

4. **`start()`**

- Starts recording and emits `START` event.
- Throws: `Error` if no active stream or recording is already in progress.

5. **`stop()`**

- Stops recording and emits `STOP` event.

6. **`pause()`**

- Pauses recording and emits `PAUSE` event.
- Throws: `Error` if not recording.

7. **`resume()`**

- Resumes a paused recording and emits `RESUME` event.
- Throws: `Error` if not paused.

8. **`isRecording()`**

- Returns `true` if recording is active.

9. **`download()`**

- Triggers a download of the recorded video with a timestamped filename.
- Emits `DOWNLOAD` event.
- Throws: `Error` if no recorded data.

10. **`dispose()`**

- Cleans up resources (stops recording, streams, etc.).

## Events

The `VideoRecorder` class extends `EventTarget` and emits custom DOM events:

| Event Name           | Description                              | Detail Properties                                                                                                                            |
|----------------------|------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| `video/start`        | Fired when recording starts              | `timestamp`                                                                                                                                  |
| `video/stop`         | Fired when recording stops               | `blob`, `duration`, `totalBytes`                                                                                                             |
| `video/size`         | Fired when new data is available         | `totalBytes`, `chunkSize`, `timestamp`                                                                                                       |
| `video/pause`        | Fired when recording is paused           | `timestamp`, `durati on`                                                                                                                     || `video/r       esume` | Fired when recording resumes | `timestamp`, `duration` |
| `video/source`       | Fired when a new source is set           | `type`, `timestamp`, `width`, `height`, `canva ses`, `clipX`,         `clipY`, `clipWidth`, `clipHeight`, `preserv eAlpha` (for canva     s) |
| `video/error`        | Fired on errors                          | `error`, `timestamp`                                                                                                                         |
| `video/downloa d`    | Fired when a      video is downloaded    | `type`, `timestamp`, `filename`, `size`                                                                                                      |
| `vid eo/max-size`    | Fired w hen max size limit is reached    | `totalBytes`, `timestamp`                                                                                                                    |
| `video/max-duration` | Fired when max duration limit is reached | `duration`, `timestamp`                                                                                                                      |

Example of listening to events:

```javascript
recorder.addEventListener(VideoRecorder.events.START, () => {
  console.log('Recording started')
})
recorder.addEventListener(VideoRecorder.events.SIZE, (e) => {
  console.log('New data:', e.detail.totalBytes, 'bytes')
})
```

## Configuration Options

- **`initialize` Options**:
    - `maxSize`: Maximum recording size in bytes (default: `Infinity`).
    - `maxDuration`: Maximum recording duration in milliseconds (default: `Infinity`).
    - `fps`: Frames per second (default: `24`).
    - `bitrate`: Video bitrate in bits per second (default: `4000000`).
    - `timeslice`: Interval for `SIZE` events in milliseconds (default: `200`).
    - `filename`: Base filename for downloads (default: `'video'`).

- **`setSource` Options**:
    - `width`, `height`: Output resolution (defaults to `clipWidth`, `clipHeight`).
    - `clipX`, `clipY`: Top-left corner of the clipping region (default: `0`).
    - `clipWidth`, `clipHeight`: Clipping region size (defaults to canvas dimensions).
    - `preserveAlpha`: Preserve canvas alpha channel (default: `false`).
    - `onNeedsRedraw`: Callback to optimize canvas redraws (optional).

## Error Handling

The class throws errors for invalid operations (e.g., changing MIME type during recording) and emits `video/error`
events with details:

```javascript
recorder.addEventListener(VideoRecorder.events.ERROR, (e) => {
  console.error('Recorder error:', e.detail.error.message)
})
```

Common errors:

- Unsupported MIME type.
- Invalid canvas or clipping parameters.
- No active MediaStream.
- Operations attempted during active recording.

## Dependencies

- **None**: Uses native browser APIs (`MediaRecorder`, `canvas.captureStream`, `EventTarget`).
- **Browser Support**:
    - Modern browsers (Chrome, Firefox, Edge, Safari) with `MediaRecorder` support.
    - Check `MediaRecorder.isTypeSupported` for MIME type compatibility.
    - `video/mp4` may require specific codecs and browser support.

## License

Copyright © 2025 LGS1920. All rights reserved.

This software is proprietary and may not be copied, modified, or distributed without permission from LGS1920.

## Contact

- **Email**: [contact@lgs1920.fr](mailto:contact@lgs1920.fr)
- **Team**: LGS1920 Team
- **Project**: LGS1920/studio

For support or inquiries, please contact the LGS1920 team via email.

---