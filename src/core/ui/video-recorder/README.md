# VideoRecorder Class

The `VideoRecorder` class is a singleton JavaScript module designed to record media streams or canvas content, with
support for clipping specific regions of the source. It can record from a single `MediaStream` (e.g., webcam or screen)
or a single canvas, with Cesium compatibility for WebGL-based rendering. The recorded output can be saved as a video
file in formats like WebM or MP4, depending on browser support, and emits custom DOM events to track recording progress.

## Features

- **Singleton Pattern**: Ensures a single instance for consistent state management
- **Flexible Source Input**: Record from a `MediaStream` or a single `HTMLCanvasElement`
- **Region Clipping**: Record a specific region of the canvas source
- **Event-Driven**: Emits custom events (`video/start`, `video/stop`, `video/size`, etc.) for real-time updates
- **Pause/Resume**: Pause and resume recordings with corresponding events
- **Size/Duration Limits**: Automatically stop recording when size or duration thresholds are reached
- **MIME Type Support**: Configure recording format with validation for supported MIME types
- **Resource Cleanup**: Dispose method to free memory and stop operations
- **Download Capability**: Save recordings as downloadable video files with timestamped filenames and emit
  `video/download` event
- **Cesium Compatibility**: Supports Cesium canvas rendering and uses `Cesium.requestAnimationFrame` and
  `Cesium.cancelAnimationFrame` if available
- **Alpha Channel Support**: Option to preserve alpha channel for translucent areas, with optimized texture filtering
  for sharp rendering
- **Robust Shader Handling**: Uses shaders from `shaders.js` for WebGL 1.0 and 2.0, with detailed error logging

## Installation

Include the `VideoRecorder` class and shaders in your project:

```javascript
import { VideoRecorder } from './VideoRecorder.js'
import { vertexShaderWebGL1, fragmentShaderWebGL1, vertexShaderWebGL2, fragmentShaderWebGL2 } from './shaders.js'
```

Ensure your project environment supports ES modules, `MediaRecorder`, `HTMLCanvasElement.captureStream`, and WebGL (1.0
or 2.0). If using Cesium, load it via a `<script>` tag or module import to make `window.Cesium` available.

## Usage

### 1. Initialize the Recorder

Create a `VideoRecorder` instance and initialize it with a required `onStop` callback and optional configuration
parameters. A default WebGL canvas stream (1280x720, 30 FPS) is created if no stream is set.

```javascript
const recorder = new VideoRecorder()
const onStop = (blob, duration) => {
  console.log(`Recording stopped. Duration: ${duration}ms, Size: ${blob.size} bytes`)
}
recorder.initialize(onStop, 'video/webm;codecs=vp9', {
  maxSize:     1024 * 1024 * 100, // 100 MB limit
  maxDuration: 60000, // 60 seconds limit
  bitrate: 12000000, // 12 Mbps for better quality
  filename:    'my-recording' // Default filename for download (without extension)
})
```

### 2. Set a Recording Source

#### From a Canvas

To record a single canvas, optionally clipping a specific region with alpha channel preservation:

```javascript
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
const ctx = canvas.getContext('2d', {alpha: true})
const animate = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = `hsla(${Date.now() % 360}, 50%, 50%, 0.5)`
  ctx.fillRect(100, 100, 400, 300)
  window.Cesium?.requestAnimationFrame(animate) || requestAnimationFrame(animate)
}
animate()
recorder.setSource([canvas], {
  width:         400,
  height:        300,
  fps:           30,
  clipX:         100,
  clipY:         100,
  clipWidth:     400,
  clipHeight:    300,
  preserveAlpha: true // Preserve translucent areas
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

**Note**: To clip a `MediaStream` or add translucent overlays, draw it onto a canvas first:

```javascript
const video = document.createElement('video')
video.srcObject = stream
video.play()
const canvas = document.createElement('canvas')
canvas.width = 1280
canvas.height = 720
const ctx = canvas.getContext('2d', {alpha: true})
const draw = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = 0.5 // Translucent overlay
  ctx.fillStyle = 'blue'
  ctx.fillRect(100, 100, 400, 300)
  ctx.globalAlpha = 1.0
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  window.Cesium?.requestAnimationFrame(draw) || requestAnimationFrame(draw)
}
draw()
recorder.setSource([canvas], {clipX: 100, clipY: 100, clipWidth: 400, clipHeight: 300, preserveAlpha: true})
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
recorder.addEventListener('video/error', e => {
  console.error('Recording error:', e.detail.error)
})
recorder.start()
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

### 5. Download the Recording

Save the recorded video with a timestamped filename and listen for the `video/download` event:

```javascript
recorder.addEventListener('video/download', e => {
  console.log(`Video downloaded: ${e.detail.filename}, Size: ${e.detail.size} bytes, Source: ${e.detail.type}`)
})
recorder.download() // Saves as 'YYYYMMDDHHMM-my-recording.webm'
```

Alternatively, specify a different filename or Blob:

```javascript
recorder.download('custom-video', myBlob) // Saves as 'YYYYMMDDHHMM-custom-video.webm'
```

### 6. Clean Up

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
- **`video/size`**: Fired when new data is available or periodically
  - `detail`: `{ totalBytes: number, chunkSize: number, timestamp: number }`
- **`video/pause`**: Fired when recording is paused
  - `detail`: `{ timestamp: number, duration: number }`
- **`video/resume`**: Fired when recording resumes
  - `detail`: `{ timestamp: number, duration: number }`
- **`video/source`**: Fired when a new source is set
  - `detail`:
    `{ type: 'stream' | 'canvas', timestamp: number, [width: number, height: number, canvases: HTMLCanvasElement[], clipX: number, clipY: number, clipWidth: number, clipHeight: number, preserveAlpha: boolean] }`
- **`video/download`**: Fired when a video is downloaded
  - `detail`: `{ type: 'stream' | 'canvas' | 'unknown', timestamp: number, filename: string, size: number }`
- **`video/error`**: Fired on recording or download errors
  - `detail`: `{ error: Error, timestamp: number }`
- **`video/max-size`**: Fired when the maximum size limit is reached
  - `detail`: `{ totalBytes: number, timestamp: Date.now() }`
- **`video/max-duration`**: Fired when the maximum duration limit is reached
  - `detail`: `{ duration: number, timestamp: number }`

## Notes

- **Browser Compatibility**: Requires modern browsers supporting `MediaRecorder`, `HTMLCanvasElement.captureStream`, and
  WebGL (1.0 or 2.0). Ensure WebGL is enabled
- **MIME Types**: Use `MediaRecorder.isTypeSupported(mimeType)` to check supported formats. Prefer
  `'video/webm;codecs=vp9'` for better quality with translucent areas, or `'video/mp4;codecs=h264'` if supported
- **Bitrate**: A high bitrate (e.g., 12 Mbps or more) reduces compression artifacts in translucent areas. Adjust via the
  `bitrate` option in `initialize`
- **Alpha Channel**: Use the `preserveAlpha: true` option in `setSource` to maintain translucent areas. Note that some
  codecs (e.g., VP9) may not fully support alpha channels, so test with `preserveAlpha: false` if issues persist
- **Clipping Parameters**: Ensure `clipX`, `clipY`, `clipWidth`, and `clipHeight` are within the source canvas bounds
- **WebGL Rendering**: Uses `gl.NEAREST` filtering for sharp rendering of solid colors. The alpha channel is preserved
  when `preserveAlpha: true`
- **Shader Debugging**: If shader compilation fails, check the console for detailed error messages from
  `gl.getShaderInfoLog`. Shaders in `shaders.js` are compatible with WebGL 1.0 and 2.0 and support alpha channels
- **Cesium Integration**: Supports Cesium canvas rendering and uses `Cesium.requestAnimationFrame` and
  `Cesium.cancelAnimationFrame` if available. Ensure Cesium is loaded
- **Performance**: WebGL rendering with `preserveAlpha: true` may be resource-intensive. Use `preserveAlpha: false` for
  simpler scenarios
- **Resource Management**: Call `dispose` to prevent memory leaks
- **Filename**: The `download` method generates timestamped filenames (e.g., `YYYYMMDDHHMM-video.webm`). The
  `video/download` event provides the filename and size
- **Download Event**: The `video/download` event is emitted after a successful download attempt. Check the `video/error`
  event for download failures

## Example

Record a canvas with a translucent overlay and listen for the download event:

```javascript
import { VideoRecorder } from './VideoRecorder.js'

const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d', {alpha: true})
const animate = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = `hsla(${Date.now() % 360}, 50%, 50%, 0.5)`
  ctx.fillRect(100, 100, 400, 300)
  window.Cesium?.requestAnimationFrame(animate) || requestAnimationFrame(animate)
}
animate()

const recorder = new VideoRecorder()
recorder.initialize((blob, duration) => {
  console.log(`Recording complete: ${duration}ms, ${blob.size} bytes`)
}, 'video/webm;codecs=vp9', {maxDuration: 10000, bitrate: 12000000, filename: 'test-video'})

recorder.setSource([canvas], {
  width:         400,
  height:        300,
  fps:           30,
  clipX:         100,
  clipY:         100,
  clipWidth:     400,
  clipHeight:    300,
  preserveAlpha: true
})

recorder.addEventListener('video/start', () => console.log('Started'))
recorder.addEventListener('video/stop', (e) => {
  console.log('Stopped')
  recorder.download(undefined, e.detail.blob)
})
recorder.addEventListener('video/download', (e) => {
  console.log(`Downloaded: ${e.detail.filename}, Size: ${e.detail.size} bytes, Source: ${e.detail.type}`)
})
recorder.addEventListener('video/error', (e) => console.error('Error:', e.detail.error))

recorder.start()
setTimeout(() => recorder.stop(), 5000)
```

## License

Copyright © 2025 LGS1920. All rights reserved.