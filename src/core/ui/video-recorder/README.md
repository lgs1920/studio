# VideoRecorder.js

`VideoRecorder` is a singleton JavaScript class for recording video from a canvas or MediaStream, using the
`MediaRecorder` API. It supports WebM and MP4 formats, emits lifecycle events, and provides configuration options for
quality and performance.

## Features

- Record from one or multiple HTML canvases or a MediaStream (e.g., webcam, screen).
- Configurable FPS, bitrate, and timeslice for recording.
- Supports `video/webm` (VP8/VP9) and `video/mp4` (if supported by the browser).
- Outputs files with a timestamped filename (`yyyymmddhhmmss-filename.webm` or `.mp4`).
- Emits CustomEvents for recording lifecycle (start, stop, pause, resume, etc.).
- Optimized for performance, including conditional canvas rendering for Firefox.
- Sharp 2D rendering with configurable clipping and no image smoothing.
- Size and duration limits to prevent excessive recordings.
- No external dependencies.

## Usage

### Installation

Include `VideoRecorder.js` in your project:

```html

<script src="VideoRecorder.js"></script>
```

### Basic Example
```javascript
// Create a canvas with a sharp animation
const canvas = document.createElement('canvas')
canvas.width = 640
canvas.height = 360
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')
let lastHue = 0
const animate = () => {
  const hue = (Date.now() % 360)
  if (hue !== lastHue) {
    lastHue = hue
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = `hsl(${hue}, 50%, 50%)`
    ctx.fillRect(50, 50, 400, 200)
    ctx.font = '24px Arial'
    ctx.fillStyle = 'white'
    ctx.fillText('Sharp Text', 75, 100)
  }
  requestAnimationFrame(animate)
}
animate()

// Initialize VideoRecorder
const recorder = new VideoRecorder()
recorder.initialize(
        (blob, duration) => {
          console.log(`Recording complete: ${duration}ms, ${blob.size} bytes`)
          recorder.download()
        },
        'video/mp4',
        {
          fps:         24,
          bitrate:     4000000,
          timeslice:   500,
          filename:    'my-recording',
          maxSize:     5 * 1024 * 1024, // 5 MB
          maxDuration: 5000 // 5 seconds
        }
)

// Set canvas source with clipping
recorder.setSource([canvas], {
  clipX:         50,
  clipY:         50,
  clipWidth:     400,
  clipHeight:    200,
  onNeedsRedraw: () => lastHue !== (Date.now() % 360)
})

// Record and handle events
recorder.addEventListener(VideoRecorder.events.START, e => console.log('START:', e.detail))
recorder.addEventListener(VideoRecorder.events.STOP, e => console.log('STOP:', e.detail))
recorder.addEventListener(VideoRecorder.events.SIZE, e => console.log('SIZE:', e.detail))
recorder.start()
setTimeout(() => recorder.stop(), 3000)
```

## Events

`VideoRecorder` emits the following `CustomEvent` types, accessible via the `VideoRecorder.events` object:

| Constant                            | Event Name           | Description                                | Detail Object                                                                       |
|-------------------------------------|----------------------|--------------------------------------------|-------------------------------------------------------------------------------------|
| `VideoRecorder.events.START`        | `video/start`        | Fired when recording starts                | `{ timestamp: number }`                                                             |
| `VideoRecorder.events.STOP`         | `video/stop`         | Fired when recording stops                 | `{ blob: Blob, duration: number, totalBytes: number }`                              |
| `VideoRecorder.events.SIZE`         | `video/size`         | Fired when new data is available           | `{ totalBytes: number, chunkSize: number, timestamp: number }`                      |
| `VideoRecorder.events.PAUSE`        | `video/pause`        | Fired when recording is paused             | `{ timestamp: number, duration: number }`                                           |
| `VideoRecorder.events.RESUME`       | `video/resume`       | Fired when recording resumes               | `{ timestamp: number, duration: number }`                                           |
| `VideoRecorder.events.SOURCE`       | `video/source`       | Fired when a new source is set             | `{ type: 'canvas' \| 'stream', timestamp: number, [width, height, ...] }`           |
| `VideoRecorder.events.ERROR`        | `video/error`        | Fired on errors (e.g., invalid parameters) | `{ error: Error, timestamp: number }`                                               |
| `VideoRecorder.events.DOWNLOAD`     | `video/download`     | Fired when a video is downloaded           | `{ type: 'canvas' \| 'stream', timestamp: number, filename: string, size: number }` |
| `VideoRecorder.events.MAX_SIZE`     | `video/max-size`     | Fired when max size limit is reached       | `{ totalBytes: number, timestamp: number }`                                         |
| `VideoRecorder.events.MAX_DURATION` | `video/max-duration` | Fired when max duration limit is reached   | `{ duration: number, timestamp: number }`                                           |

## API

### Constructor

```javascript
const recorder = new VideoRecorder()
```

Creates or returns the singleton `VideoRecorder` instance. Use `initialize` to configure.

### Methods

#### `initialize(onStop, mimeType = 'video/webm;codecs=vp9', options)`

Configures the recorder.

- **Parameters**:
  - `onStop: (blob: Blob, duration: number) => void` - Callback invoked when recording stops.
  - `mimeType: string` - MIME type (e.g., `'video/webm;codecs=vp9'`, `'video/mp4'`). Falls back to `'video/webm'` if
    unsupported.
  - `options: Object`:
    - `maxSize: number` - Max recording size in bytes (default: `Infinity`).
    - `maxDuration: number` - Max recording duration in milliseconds (default: `Infinity`).
    - `fps: number` - Frames per second for canvas stream (default: 24).
    - `bitrate: number` - Video bitrate in bits per second (default: 4000000, 4 Mbps).
    - `timeslice: number` - Interval for `SIZE` events in milliseconds (default: 200).
    - `filename: string` - Base filename for downloads, without date or extension (default: `'video'`).

- **Throws**:
  - `Error` if called while recording.
  - `TypeError` if `onStop` is not a function.
  - `Error` if `mimeType` is unsupported.

#### `setSource(canvases, options)`

Sets one or more canvases as the recording source.

- **Parameters**:
  - `canvases: HTMLCanvasElement[]` - Array of canvases to record.
  - `options: Object`:
    - `width: number` - Output width (defaults to `clipWidth`).
    - `height: number` - Output height (defaults to `clipHeight`).
    - `clipX: number` - X-coordinate of clipping region (default: 0).
    - `clipY: number` - Y-coordinate of clipping region (default: 0).
    - `clipWidth: number` - Width of clipping region (defaults to canvas width).
    - `clipHeight: number` - Height of clipping region (defaults to canvas height).
    - `preserveAlpha: boolean` - Preserve alpha channel (default: false).
    - `onNeedsRedraw: () => boolean` - Optional callback to signal when redraw is needed (for performance).

- **Throws**:
  - `Error` if no canvases provided, recording is active, 2D context is unsupported, or clipping parameters are invalid.

#### `setStream(stream)`

Sets a MediaStream as the recording source.

- **Parameters**:
  - `stream: MediaStream` - MediaStream to record (e.g., from webcam).

- **Throws**:
  - `TypeError` if `stream` is not a MediaStream.
  - `Error` if called while recording.

#### `start()`

Starts recording and emits `START` event.

- **Throws**:
  - `Error` if no active MediaStream or recording is already in progress.

#### `stop()`

Stops recording and emits `STOP` event.

#### `pause()`

Pauses recording and emits `PAUSE` event.

- **Throws**:
  - `Error` if not recording.

#### `resume()`

Resumes a paused recording and emits `RESUME` event.

- **Throws**:
  - `Error` if not paused.

#### `download()`

Downloads the recorded video as `yyyymmddhhmmss-filename.webm` or `.mp4`.

- **Throws**:
  - `Error` if no recorded data.

#### `dispose()`

Cleans up resources (stops recording, rendering, and tracks).

#### `isRecording(): boolean`

Returns `true` if recording is active.

#### `size: number` (getter)

Returns total bytes recorded.

#### `duration: number` (getter)

Returns recording duration in milliseconds.

#### `mimeType: string` (getter/setter)

Gets or sets the MIME type (e.g., `'video/webm'`, `'video/mp4'`).

- **Throws**:
  - `Error` if set while recording or if MIME type is unsupported.

## Notes

- For best quality, match `setSource` output resolution (`width`, `height`) to `clipWidth` and `clipHeight`.
- Use `video/mp4` or `video/webm;codecs=vp8` for better performance in Firefox.
- Set `onNeedsRedraw` in `setSource` to optimize rendering by skipping unchanged frames.
- Check browser support for `MediaRecorder` and `canvas.captureStream` (available in modern browsers).
- WebGPU is not required but may improve canvas rendering performance in Firefox Nightly with `dom.webgpu.enabled=true`.

## Performance Tips for Firefox

- Use lower `fps` (e.g., 15) or `bitrate` (e.g., 3000000) for smoother recording.
- Prefer `video/mp4` or `video/webm;codecs=vp8` for faster encoding.
- Reduce resolution (e.g., 640x360) to lower CPU/GPU load.
- Ensure hardware acceleration is enabled (`about:support` > “Graphics” > “Compositing” should show “WebRender”).
- Use `onNeedsRedraw` to skip unnecessary canvas redraws.
- Increase `timeslice` (e.g., 500ms) to reduce `SIZE` event frequency.