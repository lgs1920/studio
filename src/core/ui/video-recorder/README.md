VideoRecorder

## Overview

`VideoRecorder` is a singleton JavaScript class designed to record canvases or media streams, optimized for Cesium
WebGL2 canvases but adaptable to any canvas or `MediaStream`. It supports recording, pausing, resuming, and stopping
video, with real-time feedback on duration and file size. `VideoRecorder` can detect a `Cesium` WebGL canvas.

### Features

- **Singleton Design**: Ensures a single instance across the application.
- **Canvas Recording**: Captures canvas content with customizable clipping and resolution.
- **MediaStream Support**: Records streams from webcams, screen captures, or other sources.
- **Real-Time Stats**: Displays duration (e.g., `1h 05m 05s`) and file size (e.g., `1.4MB`) via a React-based toolbar.
- **Event-Driven**: Emits custom DOM events (`video/start`, `video/stop`, `video/size`, etc.) for integration.
- **Error Handling**: Manages unsupported MIME types, invalid streams, and WebGL issues.
- **Automatic Download**: Downloads the recorded video as a `.webm` file upon stopping.
- **Configurable Limits**: Supports maximum size and duration constraints.
- **Optimized Rendering**: The `VideoRecorderToolbar` React component uses a memoized `RecorderControls` component to
  prevent unnecessary re-renders of control buttons during frequent duration and size updates.

# Installation

1. **Prerequisites**:

- A modern browser supporting `MediaRecorder`, WebGL2, and `canvas.captureStream`.
- React and Valtio for the `VideoRecorderToolbar` component.
- Shoelace (`SlPopup`, `SlAnimation`, `SlIconButton`) and Font Awesome for UI components.
- Luxon for time formatting in `UnitUtils`.

2. **Set Up Global Context**:

- Create a global `videoRecorder` instance and settings:
  ```javascript
  import { VideoRecorder } from './VideoRecorder.js'
  window.videoRecorder = new VideoRecorder()
  window.lgs = { settings: { ui: { video: { recording: false, paused: false, totalBytes: 0 } } } }
  window.__ = {
      tools: { rem2px: (rem) => rem * 16 },
      ui: { css: { getCSSVariable: (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName) } }
  }
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
- **start()**: Begins recording and emits a `VideoRecorder.event.START` event. Throws an error if no active
  `MediaStream` is available.
- **stop()**: Stops recording, triggers the `onStop` callback, downloads the video, and emits a
  `VideoRecorder.event.STOP` event. Resets internal state for the next recording.
- **pause()**: Pauses recording and emits a `VideoRecorder.event.PAUSE` event. Only works if recording is active.
- **resume()**: Resumes a paused recording and emits a `VideoRecorder.event.RESUME` event.
- **isRecording()**: Returns `true` if recording is active, `false` otherwise.
- **download(filename)**: Triggers a download of the recorded video using the specified or default filename.
- **dispose()**: Cleans up resources, stops recording, and resets the recorder.
- **size**: Getter returning the total recorded bytes.
- **duration**: Getter returning the recording duration in milliseconds, excluding paused time.
- **mimeType**: Getter/setter for the recording MIME type (e.g., `video/webm;codecs=vp9`).

## Events

`VideoRecorder` emits the following custom DOM events, accessible via `addEventListener` using `VideoRecorder.event`
constants:

- **`VideoRecorder.event.START`**: Fired when recording starts. Includes `detail: { timestamp }`.
- **`VideoRecorder.event.STOP`**: Fired when recording stops. Includes `detail: { blob, duration, totalBytes }`.
- **`VideoRecorder.event.SIZE`**: Fired periodically during recording to report size. Includes
  `detail: { totalBytes, chunkSize, timestamp }`.
- **`VideoRecorder.event.PAUSE`**: Fired when recording is paused. Includes `detail: { timestamp, duration }`.
- **`VideoRecorder.event.RESUME`**: Fired when recording resumes. Includes `detail: { timestamp, duration }`.
- **`VideoRecorder.event.SOURCE`**: Fired when a source (canvas or stream) is set. Includes
  `detail: { type, timestamp, ... }`.
- **`VideoRecorder.event.ERROR`**: Fired on recording errors. Includes `detail: { error, timestamp }`.
- **`VideoRecorder.event.MAX_SIZE`**: Fired when the maximum size limit is reached. Includes
  `detail: { totalBytes, timestamp }`.
- **`VideoRecorder.event.MAX_DURATION`**: Fired when the maximum duration is reached. Includes
  `detail: { duration, timestamp }`.

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
  width:  canvas.width,
  height: canvas.height,
  fps:    24,
    useWebGL: true
})

// Start recording
videoRecorder.start()

// Listen for size updates
videoRecorder.addEventListener(VideoRecorder.event.SIZE, (e) => {
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
import React             from 'react'
import { createRoot }    from 'react-dom/client'
import { VideoRecorder } from './VideoRecorder.js'
import { VideoRecorderToolbar } from './VideoRecorderToolbar.jsx'
import { PanelButton }   from './PanelButton.jsx'

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

      videoRecorder.addEventListener(VideoRecorder.event.PAUSE, () => {
            console.log('Recording paused')
        })

      videoRecorder.addEventListener(VideoRecorder.event.RESUME, () => {
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
import { createRoot }    from 'react-dom/client'
import { VideoRecorder } from './VideoRecorder.js'
import { UnitUtils }     from './UnitUtils.js'
import { useSnapshot }   from 'valtio'

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
          width:  canvas.width,
          height: canvas.height,
          fps:    24,
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

      videoRecorder.addEventListener(VideoRecorder.event.START, handleStart)
      videoRecorder.addEventListener(VideoRecorder.event.SIZE, handleSize)
      videoRecorder.addEventListener(VideoRecorder.event.STOP, handleStop)

        return () => {
            clearInterval(interval)
          videoRecorder.removeEventListener(VideoRecorder.event.START, handleStart)
          videoRecorder.removeEventListener(VideoRecorder.event.SIZE, handleSize)
          videoRecorder.removeEventListener(VideoRecorder.event.STOP, handleStop)
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
                disabled={!settings.recording}
            >
                {settings.paused ? 'Resume' : 'Pause'}
            </button>
          <div>Duration: {UnitUtils.convert(duration).toTime()}</div>
          <div>Size: {UnitUtils.convert(size).toSize()}</div>
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
- Emits events using `VideoRecorder.event` constants (e.g., `START`, `SIZE`, `STOP`).
- Manages recording limits (size, duration) and triggers automatic download.
- Tracks duration (excluding pauses) and size in real-time.

**Code Structure**:
- **Constructor**: Enforces singleton pattern.
- **Static Event Constants**:
  - `VideoRecorder.event.START`, `VideoRecorder.event.STOP`, `VideoRecorder.event.SIZE`, etc., for event-driven
    integration.
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
- **Event Handling**: Uses `MediaRecorder` events (`ondataavailable`, `onstop`, `onerror`) and emits custom DOM events
  with `VideoRecorder.event` constants.
- **Optimizations**:
  - Periodic `VideoRecorder.event.SIZE` events via a `setTimeout` loop (every 1000ms) for consistent size updates.
  - Robust stream cleanup in `stop` to prevent issues in subsequent recordings.

**Usage Notes**:
- Requires a valid canvas or `MediaStream`.
- Ensure `MediaRecorder.isTypeSupported` for the chosen MIME type.
- WebGL2 is preferred for Cesium compatibility, with fallback to WebGL.

### VideoRecorderToolbar.jsx

**Purpose**: React component displaying recording controls and stats (duration and size).

**Key Features**:

- Displays duration (e.g., `1h 05m 05s`) and size (e.g., `1.4MB`) using `UnitUtils.toTime` and `UnitUtils.toSize`.
- Provides play/pause and stop buttons using Shoelace `<SlIconButton>` with Font Awesome icons.
- Optimized to prevent unnecessary re-renders of buttons during frequent duration and size updates.
- Uses `VideoRecorder.event` constants for event listeners.

**Optimizations**:

- A memoized `RecorderControls` component (with `React.memo`) isolates `<SlIconButton>` components, re-rendering only
  when `settings.recording`, `settings.paused`, or `__recorder` change.
- Memoized `formatDuration` and `formatSize` with `useCallback` to avoid re-computation.
- `useEffect` depends only on `__recorder`, preventing re-registration of listeners on `settings.recording` changes.
- Decoupled updates: `recordedDuration` updates every 1000ms via `setInterval`, `recordedSize` updates on
  `VideoRecorder.event.SIZE` events.

## Troubleshooting

- **No Download on Stop**: Check logs for `No valid blob to download` or `Cannot download: Blob is empty`. Ensure
  `onStop` is called with a valid `Blob`.
- **Erratic Size Display**: Verify `VideoRecorder.event.SIZE` events in logs (`Size update received`). Check for
  `Size mismatch` errors.
- **Toolbar Not Disappearing**: Ensure `settings.recording` is set to `false` in `handleStop`. Check for
  `Recording still active` logs.
- **Buttons Re-rendering**: Use React DevTools Profiler to confirm `RecorderControls` does not re-render on
  `recordedDuration` or `recordedSize` updates.
- **WebGL Errors**: Look for `Skipping frame: canvas not ready` or `Skipping frame: WebGL context error` in logs,
  indicating canvas issues.

## License

Copyright © 2025 LGS1920. All rights reserved.

---
**Last modified**: 2025-07-11, 12:39 CEST