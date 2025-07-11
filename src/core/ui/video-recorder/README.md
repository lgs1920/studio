# VideoRecorder

## Overview

`VideoRecorder` is a singleton JavaScript class designed to record canvases or media streams, optimized for Cesium
WebGL2 canvases but adaptable to any canvas or `MediaStream`. It supports recording, pausing, resuming, and stopping
video, with real-time feedback on duration and file size.`VideoRecorder` can detect a `Cesium` WEBGL canvas.

### Features

- **Singleton Design**: Ensures a single instance across the application.
- **Canvas Recording**: Captures canvas content with customizable clipping and resolution.
- **MediaStream Support**: Records streams from webcams, screen captures, or other sources.
- **Real-Time Stats**: Displays duration and file size via a React-based toolbar.
- **Event-Driven**: Emits custom DOM events (`video/start`, `video/stop`, `video/size`, etc.) for integration.
- **Error Handling**: Manages unsupported MIME types, invalid streams, and WebGL issues.
- **Automatic Download**: Downloads the recorded video as a `.webm` file upon stopping.
- **Configurable Limits**: Supports maximum size and duration constraints.

## Installation

1. **Prerequisites**:

- A modern browser supporting `MediaRecorder`, WebGL2, and `canvas.captureStream`.

4. **Set Up Global Context**:

- Create a global `videoRecorder` instance:
  ```javascript
  import { VideoRecorder } from './VideoRecorder.js'
  window.videoRecorder = new VideoRecorder()
  ```

## Methods

The `VideoRecorder` class provides the following methods:

- **constructor()**: Creates a singleton instance of `VideoRecorder`. Returns the existing instance if already created.
- **initialize(onStop, mimeType, options)**: Configures the recorder with a callback, MIME type, and options (e.g.,
  `maxSize`, `maxDuration`, `bitrate`, `filename`). Throws an error if called during recording or if `mimeType` is
  unsupported.
- **setSource(canvases, options)**: Sets one or more canvases as the recording source, with options for resolution, FPS,
  and clipping. Uses WebGL for Cesium compatibility. Throws an error if called during recording or if parameters are
  invalid.
- **setStream(stream)**: Sets a `MediaStream` (e.g., webcam) as the recording source. Throws an error if called during
  recording or if `stream` is not a `MediaStream`.
- **start()**: Begins recording and emits a `video/start` event. Throws an error if no active `MediaStream` is
  available.
- **stop()**: Stops recording, triggers the `onStop` callback, downloads the video, and emits a `video/stop` event.
  Resets internal state for the next recording.
- **pause()**: Pauses recording and emits a `video/pause` event. Only works if recording is active.
- **resume()**: Resumes a paused recording and emits a `video/resume` event.
- **isRecording()**: Returns `true` if recording is active, `false` otherwise.
- **download(filename)**: Triggers a download of the recorded video using the specified or default filename.
- **dispose()**: Cleans up resources, stops recording, and resets the recorder.
- **size**: Getter returning the total recorded bytes.
- **duration**: Getter returning the recording duration in milliseconds, excluding paused time.
- **mimeType**: Getter/setter for the recording MIME type (e.g., `video/webm;codecs=vp9`).

## Events

`VideoRecorder` emits the following custom DOM events, accessible via `addEventListener`:

- **`video/start`**: Fired when recording starts. Includes `detail: { timestamp }`.
- **`video/stop`**: Fired when recording stops. Includes `detail: { blob, duration, totalBytes }`.
- **`video/size`**: Fired periodically during recording to report size. Includes
  `detail: { totalBytes, chunkSize, timestamp }`.
- **`video/pause`**: Fired when recording is paused. Includes `detail: { timestamp, duration }`.
- **`video/resume`**: Fired when recording resumes. Includes `detail: { timestamp, duration }`.
- **`video/source`**: Fired when a source (canvas or stream) is set. Includes `detail: { type, timestamp, ... }`.
- **`video/error`**: Fired on recording errors. Includes `detail: { error, timestamp }`.
- **`video/max-size`**: Fired when the maximum size limit is reached. Includes `detail: { totalBytes, timestamp }`.
- **`video/max-duration`**: Fired when the maximum duration is reached. Includes `detail: { duration, timestamp }`.

## Usage Examples

### JavaScript Example: Basic Canvas Recording

Record a Cesium canvas for 10 seconds and download the video.

```javascript
import { VideoRecorder } from './VideoRecorder.js'

// Create a global recorder instance
window.videoRecorder = new VideoRecorder()

// Get a canvas
const canvas = document.querySelector('canvas.cesium-widget')

// Initialize the recorder
videoRecorder.initialize((blob, duration) => {
    console.log(`Recording stopped, duration: ${duration}ms, blob size: ${blob.size} bytes`)
    videoRecorder.download()
}, 'video/webm;codecs=vp9', {
                             maxSize:     1024 * 1024 * 100, // 100 MB
                             maxDuration: 60000, // 60 seconds
                             bitrate:     12000000,
                             filename:    'my-recording'
                         })

// Set the canvas as the source
videoRecorder.setSource([canvas], {
    width:    canvas.width,
    height:   canvas.height,
    fps:      24,
    useWebGL: true
})

// Start recording
videoRecorder.start()

// Listen for size updates
videoRecorder.addEventListener('video/size', (e) => {
    console.log(`Size update: ${e.detail.totalBytes} bytes`)
})

// Stop after 10 seconds
setTimeout(() => {
    videoRecorder.stop()
}, 10000)
```

### React Example: Using VideoRecorderToolbar and PanelButton

Integrate the toolbar and button in a React app to control recording.

```javascript
import React                    from 'react'
import { createRoot }           from 'react-dom/client'
import { VideoRecorder }        from './VideoRecorder.js'
import { VideoRecorderToolbar } from './VideoRecorderToolbar.jsx'
import { PanelButton }          from './PanelButton.jsx'

// Set up global recorder and state
window.videoRecorder = new VideoRecorder()
window.lgs = {settings: {ui: {video: {recording: false, paused: false, totalBytes: 0}}}}
window.__ = {
    tools: {rem2px: (rem) => rem * 16},
    ui:    {css: {getCSSVariable: (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName)}}
}

const App = () => {
    return (
        <div>
            <PanelButton tooltip="top"/>
            <VideoRecorderToolbar tooltip="bottom"/>
        </div>
    )
}

const root = createRoot(document.getElementById('root'))
root.render(<App/>)
```

### JavaScript Example: Recording a Webcam Stream

Record a webcam stream with pause and resume functionality.

```javascript
import { VideoRecorder } from './VideoRecorder.js'

window.videoRecorder = new VideoRecorder()

navigator.mediaDevices.getUserMedia({video: true})
    .then((stream) => {
        videoRecorder.initialize((blob, duration) => {
            console.log(`Recording stopped, duration: ${duration}ms, blob size: ${blob.size} bytes`)
            videoRecorder.download()
        }, 'video/webm;codecs=vp9', {
                                     maxSize:     1024 * 1024 * 50, // 50 MB
                                     maxDuration: 30000, // 30 seconds
                                     filename:    'webcam-recording'
                                 })

        videoRecorder.setStream(stream)
        videoRecorder.start()

        videoRecorder.addEventListener('video/pause', () => {
            console.log('Recording paused')
        })

        videoRecorder.addEventListener('video/resume', () => {
            console.log('Recording resumed')
        })

        setTimeout(() => {
            videoRecorder.pause()
        }, 5000)

        setTimeout(() => {
            videoRecorder.resume()
        }, 7000)

        setTimeout(() => {
            videoRecorder.stop()
        }, 10000)
    })
    .catch((error) => {
        console.error('Failed to access webcam:', error)
    })
```

### React Example: Custom Recording Controls

Create custom React buttons to control the recorder without the default toolbar.

```javascript
import React, { useEffect, useState } from 'react'
import { createRoot }                 from 'react-dom/client'
import { VideoRecorder }              from './VideoRecorder.js'
import { useSnapshot }                from 'valtio'

window.videoRecorder = new VideoRecorder()
window.lgs = {settings: {ui: {video: {recording: false, paused: false, totalBytes: 0}}}}

const CustomControls = () => {
    const $settings = lgs.settings.ui.video
    const settings = useSnapshot($settings)
    const [duration, setDuration] = useState(0)
    const [size, setSize] = useState(0)

    useEffect(() => {
        const canvas = document.querySelector('canvas.cesium-widget')
        if (!canvas) {
            console.error('Canvas not found')
            return
        }

        videoRecorder.initialize((blob, duration) => {
            console.log(`Recording stopped, duration: ${duration}ms, blob size: ${blob.size} bytes`)
            videoRecorder.download()
        }, 'video/webm;codecs=vp9', {
                                     maxSize:     1024 * 1024 * 100,
                                     maxDuration: 60000,
                                     bitrate:     12000000,
                                     filename:    'custom-recording'
                                 })

        videoRecorder.setSource([canvas], {
            width:    canvas.width,
            height:   canvas.height,
            fps:      24,
            useWebGL: true
        })

        const handleSize = (e) => {
            setSize(e.detail.totalBytes)
            $settings.totalBytes = e.detail.totalBytes
        }

        const handleStart = () => {
            $settings.recording = true
            $settings.paused = false
            setDuration(0)
            setSize(0)
        }

        const handleStop = () => {
            $settings.recording = false
            $settings.paused = false
            setDuration(0)
            setSize(0)
        }

        const interval = setInterval(() => {
            if (settings.recording) {
                setDuration(videoRecorder.duration)
            }
        }, 1000)

        videoRecorder.addEventListener('video/start', handleStart)
        videoRecorder.addEventListener('video/size', handleSize)
        videoRecorder.addEventListener('video/stop', handleStop)

        return () => {
            clearInterval(interval)
            videoRecorder.removeEventListener('video/start', handleStart)
            videoRecorder.removeEventListener('video/size', handleSize)
            videoRecorder.removeEventListener('video/stop', handleStop)
            if (settings.recording) {
                videoRecorder.stop()
            }
        }
    }, [settings.recording])

    return (
        <div>
            <button onClick={() => settings.recording ? videoRecorder.stop() : videoRecorder.start()}>
                {settings.recording ? 'Stop' : 'Start'} Recording
            </button>
            <button
                onClick={() => settings.recording && (settings.paused ? videoRecorder.resume() : videoRecorder.pause())}
                disabled={!settings.recording}>
                {settings.paused ? 'Resume' : 'Pause'}
            </button>
            <div>Duration: {Math.floor(duration / 1000)}s</div>
            <div>Size: {(size / 1024 / 1024).toFixed(2)} MB</div>
        </div>
    )
}

const root = createRoot(document.getElementById('root'))
root.render(<CustomControls/>)
```

## File Details

### VideoRecorder.js

**Purpose**: Core logic for recording canvas or media streams, handling WebGL rendering, and managing recording state.

**Key Features**:

- Singleton pattern to ensure a single instance.
- Supports Cesium WebGL2 canvases via custom WebGL rendering.
- Emits events for start, stop, size, pause, resume, and errors.
- Manages recording limits (size, duration) and triggers automatic download.

**Code Structure**:

- **Constructor**: Enforces singleton pattern.
- **Private Methods**:
    - `#isCesiumCanvas`: Detects Cesium canvases using class names, WebGL properties, and global Cesium objects.
    - `#isRecording`: Internal check for recording state.
- **Public Methods**:
    - `initialize`: Sets up recording parameters and `onStop` callback.
    - `setSource`: Configures canvas source with WebGL rendering and clipping.
    - `setStream`: Sets a `MediaStream` as the source.
    - `start`, `stop`, `pause`, `resume`: Control recording lifecycle.
    - `download`: Triggers video file download.
    - `dispose`: Cleans up resources.
- **Getters**: `size`, `duration`, `mimeType` for real-time stats.
- **Event Handling**: Uses `MediaRecorder` events (`ondataavailable`, `onstop`, `onerror`) and emits custom DOM events.
- **Error Handling**: Logs errors for WebGL issues, empty chunks, and recording failures.
- **Optimizations**:
    - Periodic `video/size` events via an interval to ensure consistent size updates.
    - Robust stream cleanup in `stop` to prevent issues in subsequent recordings.

**Usage Notes**:

- Requires a valid canvas or `MediaStream`.
- Ensure `MediaRecorder.isTypeSupported` for the chosen MIME type.
- WebGL2 is preferred for Cesium compatibility, with fallback to WebGL.

## Troubleshooting

- **No Download on Stop**: Check logs for `No valid blob to download` or `Cannot download: Blob is empty`. Ensure
  `onStop` is called with a valid `Blob`.
- **Erratic Size Display**: Verify `video/size` events in logs (`Chunk received`, `Size update received`). Check for
  `Size mismatch` errors.
- **Toolbar Not Disappearing**: Ensure `settings.recording` is set to `false` in `handleStop`. Check for
  `Recording still active` logs.
- **WebGL Errors**: Look for `Skipping frame: canvas not ready` or `Skipping frame: WebGL context error` in logs,
  indicating canvas issues.

## License

Copyright © 2025 LGS1920. All rights reserved.

---
**Last modified**: 2025-07-10, 19:38 CEST