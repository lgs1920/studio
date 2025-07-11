# VideoRecorder Class

The `VideoRecorder` class is a singleton JavaScript module designed to record media streams or canvas content, with
support for clipping specific regions of the source. It can record from a single `MediaStream` (e.g., webcam or screen),
a single canvas, or multiple canvases merged into a single stream using either 2D or WebGL rendering. The recorded
output can be saved as a video file in formats like WebM or MP4, depending on browser support, and emits custom DOM
events to track recording progress.

## Features

- **Singleton Pattern**: Ensures a single instance for consistent state management
- **Flexible Source Input**: Record from a `MediaStream` or one or more `HTMLCanvasElement` sources
- **Canvas Merging**: Combine multiple canvases into a grid layout using 2D or WebGL rendering
- **Region Clipping**: Record a specific region of the canvas source(s) in both 2D and WebGL modes
- **Event-Driven**: Emits custom events (`video/start`, `video/stop`, `video/size`, etc.) for real-time updates
- **Pause/Resume**: Pause and resume recordings with corresponding events
- **Size/Duration Limits**: Automatically stop recording when size or duration thresholds are reached
- **MIME Type Support**: Configure recording format with validation for supported MIME types
- **Resource Cleanup**: Dispose method to free memory and stop operations
- **Download Capability**: Save recordings as downloadable video files with configurable filename

## Installation

The `VideoRecorder` class is a standalone ES module. Include it in your project using:

```javascript
import { VideoRecorder } from './VideoRecorder.js'
```

Ensure your project environment supports ES modules and modern browser APIs (`MediaRecorder`, `HTMLCanvasElement`,
`WebGL`).

## Usage

### 1. Initialize the Recorder

Create a `VideoRecorder` instance and initialize it with a required `onStop` callback and optional configuration
parameters. A default WebGL canvas stream (1280x720, 30 FPS) is created if no stream is set.

```javascript
const recorder = new VideoRecorder()
const onStop = (blob, duration) => {
  console.log(`Recording stopped. Duration: ${duration}ms, Size: ${blob.size} bytes`)
}
recorder.initialize(onStop, 'video/webm', {
  maxSize:     1024 * 1024 * 100, // 100 MB limit
  maxDuration: 60000, // 60 seconds limit
  bitrate:     5000000, // 5 Mbps
  filename:    'my-recording' // Default filename for download (without extension)
})
```

### 2. Set a Recording Source

#### From a Canvas

To record a single canvas or merge multiple canvases, optionally clipping a specific region in 2D or WebGL mode:

```javascript
const canvas = document.querySelector('canvas')
recorder.setSource([canvas], {
  width:      1920,
  height:     1080,
  fps:        60,
  clipX:      100,      // Start clipping 100px from the left
  clipY:      50,       // Start clipping 50px from the top
  clipWidth:  800,  // Clip an 800px wide region
  clipHeight: 600  // Clip a 600px tall region
})

// For multiple canvases (merged into a grid, with WebGL)
const canvases = [canvas1, canvas2, canvas3]
recorder.setSource(canvases, {
  width:      1280,
  height:     720,
  useWebGL:   true,
  fps:        30,
  clipX:      0,
  clipY:      0,
  clipWidth:  640,
  clipHeight: 360
})
```

#### From a MediaStream

To record from a webcam or screen:

```javascript
navigator.mediaDevices.getUserMedia({video: true})
        .then(stream => {
          recorder.setStream(stream)
        })
        .catch(err => console.error('Failed to get stream:', err))
```

**Note**: To clip a `MediaStream`, draw it onto a canvas first and use `setSource` with clipping parameters:

```javascript
const video = document.createElement('video')
video.srcObject = stream
video.play()
const canvas = document.createElement('canvas')
canvas.width = 1280
canvas.height = 720
const ctx = canvas.getContext('2d')
const draw = () => {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  requestAnimationFrame(draw)
}
draw()
recorder.setSource([canvas], {clipX: 100, clipY: 100, clipWidth: 400, clipHeight: 300})
```

### 3. Start/Stop Recording

Start recording and listen for events:

```javascript
recorder.addEventListener('video/start', e => {
  console.log('Recording started at:', e.detail.timestamp)
})

recorder.addEventListener('video/size', e => {
  console.log(`Recorded ${e.detail.totalBytes} bytes`)
})

recorder.addEventListener('video/stop', e => {
  console.log(`Recording stopped. Duration: ${e.detail.duration}ms`)
})

recorder.start()

// Stop after some time
setTimeout(() => recorder.stop(), 5000)
```

### 4. Pause/Resume Recording

Pause and resume the recording process:

```javascript
recorder.addEventListener('video/pause', e => {
  console.log('Recording paused at:', e.detail.timestamp)
})

recorder.addEventListener('video/resume', e => {
  console.log('Recording resumed at:', e.detail.timestamp)
})

setTimeout(() => recorder.pause(), 2000)
setTimeout(() => recorder.resume(), 4000)
```

### 5. Display Video Preview

The recorded video can be previewed using a separate component (e.g., `VideoPreview`) that listens for the `video/stop`
event and displays the video in a dialog:

```javascript
import { VideoPreview } from './VideoPreview.jsx'

// Render VideoPreview in your main app
function App() {
    return (
        <div>
          <PanelButton tooltip="top"/>
          <VideoRecorderToolbar tooltip="top"/>
          <VideoPreview/>
        </div>
    )
}
```

### 6. Download the Recording

Save the recorded video as a file using the filename specified during initialization:

```javascript
recorder.download() // Saves as 'my-recording.webm' if filename was set to 'my-recording'
```

Alternatively, specify a different filename or provide a specific Blob:

```javascript
recorder.download('custom-video', myBlob) // Saves as 'custom-video.webm' using myBlob
```

### 7. Clean Up

Free resources when done:

```javascript
recorder.dispose()
```

## Events

The `VideoRecorder` emits the following custom DOM events:

- **`video/start`**: Fired when recording starts
  - `detail`: `{ timestamp: number }`
- **`video/stop`**: Fired when recording stops
  - `detail`: `{ blob: Blob, duration: number, totalBytes: number }`
- **`video/size`**: Fired when new data is available
  - `detail`: `{ totalBytes: number, chunkSize: number, timestamp: number }`
- **`video/pause`**: Fired when recording is paused
  - `detail`: `{ timestamp: number, duration: number }`
- **`video/resume`**: Fired when recording resumes
  - `detail`: `{ timestamp: number, duration: number }`
- **`video/source`**: Fired when a new source is set
  - `detail`:
    `{ type: 'stream' | 'canvas', timestamp: number, [width: number, height: number, canvases: HTMLCanvasElement[], clipX: number, clipY: number, clipWidth: number, clipHeight: number] }`
- **`video/error`**: Fired on recording errors
  - `detail`: `{ error: Error, timestamp: number }`
- **`video/max-size`**: Fired when the maximum size limit is reached
  - `detail`: `{ totalBytes: number, timestamp: number }`
- **`video/max-duration`**: Fired when the maximum duration limit is reached
  - `detail`: `{ duration: number, timestamp: number }`

## Example

Below is a complete example recording a clipped region of a canvas:

```javascript
import { VideoRecorder } from './VideoRecorder.js'

// Create a canvas with animation
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')
const animate = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = `hsl(${Date.now() % 360}, 50%, 50%)`
  ctx.fillRect(100, 100, 400, 300)
  requestAnimationFrame(animate)
}
animate()

// Initialize recorder
const recorder = new VideoRecorder()
recorder.initialize((blob, duration) => {
  console.log(`Recording complete: ${duration}ms, ${blob.size} bytes`)
}, 'video/webm', {maxDuration: 10000, filename: 'test-video'})

// Set canvas as source with clipping
recorder.setSource([canvas], {
  width:      400,
  height:     300,
  fps:        30,
  clipX:      100,
  clipY:      100,
  clipWidth:  400,
  clipHeight: 300
})

// Listen for events
recorder.addEventListener('video/start', () => console.log('Started'))
recorder.addEventListener('video/stop', (e) => {
  console.log('Stopped')
  recorder.download(undefined, e.detail.blob)
})

// Start and stop recording
recorder.start()
setTimeout(() => recorder.stop(), 5000)
```

## Notes

- **Browser Compatibility**: Requires modern browsers supporting `MediaRecorder`, `HTMLCanvasElement.captureStream`, and
  WebGL for multi-canvas or WebGL-based rendering
- **MIME Types**: Use `MediaRecorder.isTypeSupported(mimeType)` to check supported formats (e.g.,
  `'video/webm;codecs=vp9'`)
- **Clipping Parameters**: The clipping region (`clipX`, `clipY`, `clipWidth`, `clipHeight`) must be within the bounds
  of each source canvas. If not specified, the entire canvas is used
- **WebGL Clipping**: In WebGL mode, clipping is achieved by adjusting texture coordinates to render only the desired
  region of each canvas
- **Performance**: WebGL mode may be more resource-intensive for multiple canvases due to texture updates; consider
  using 2D mode for simpler scenarios
- **Resource Management**: Always call `dispose` when the recorder is no longer needed to prevent memory leaks
- **Filename**: The `filename` option in `initialize` sets the default name for downloaded files (without extension).
  The extension is inferred from the MIME type (e.g., `.webm` for `video/webm`)
- **Download with Blob**: The `download` method accepts an optional `Blob` parameter, allowing external components (
  e.g.,
  `VideoPreview`) to provide a specific Blob instead of using the recorded chunks

## License

Copyright © 2025 LGS1920. All rights reserved.