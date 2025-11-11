# VideoElementManager

`VideoElementManager` is a JavaScript singleton class that manages 2D video elements on a Cesium viewer using a 2D
canvas. It leverages [SnapDOM](https://github.com/zumerlab/snapdom) to capture individual HTML elements (e.g., UI
components or containers with Shoelace/FontAwesome) as images with high speed and accuracy. These images are rendered
onto a Cesium canvas to create a video output, typically used with tools like `MediaRecorder`.

## Features

- 📸 Captures individual HTML elements (including Shoelace Web Components or FontAwesome icons) as `ImageBitmap` using
  SnapDOM.
- ⚡ Optimized rendering with hash-based change detection to update only modified video elements.
- 🖼️ Supports precise positioning and sizing of video elements on a Cesium canvas.
- 📦 Uses Valtio for reactive state management of video elements.
- 🔄 Pre-caches resources for faster initial rendering.
- 🔒 Singleton design ensures only one instance exists.

## Installation

### Prerequisites

- **Node.js** and **Bun** (for runtime and package management).
- **Cesium**: A Cesium viewer instance is required for rendering.
- **SnapDOM**: For DOM-to-image capture.
- **Valtio**: For reactive state management.

### Install Dependencies

Using Bun:

```bash
bun install @zumer/snapdom valtio
```

### CDN (Optional)

For browser-based setups:

```html

<script src="https://unpkg.com/@zumer/snapdom/dist/snapdom.min.js"></script>
<script src="https://unpkg.com/valtio@1.11.2/dist/valtio.umd.js"></script>
```

## Usage

### Basic Example

```javascript
import { VideoElementManager } from './VideoElementManager.js'

// Initialize Cesium viewer and canvas
const viewer = new Cesium.Viewer('cesiumContainer')
const canvas2D = document.createElement('canvas')
canvas2D.width = 800
canvas2D.height = 600

// Create manager (singleton, only one instance is created)
const manager = new VideoElementManager(viewer, canvas2D)

// Add a video element (e.g., a Shoelace component or HTML container)
const element = document.querySelector('#my-video-element') // e.g., <sl-card> or <div>
await manager.addVideoElement('element1', element, {x: 100, y: 100}, {width: 200, height: 150})

// Update a specific video element
await manager.updateVideoElement('element1')

// Remove a video element
manager.removeVideoElement('element1')

// Example: Capture canvas as video with MediaRecorder
const stream = canvas2D.captureStream(30) // 30 FPS
const recorder = new MediaRecorder(stream)
recorder.ondataavailable = (event) => {
    if (event.data.size) {
        const url = URL.createObjectURL(event.data)
        const video = document.createElement('video')
        video.src = url
        document.body.appendChild(video)
    }
}
recorder.start()
```

### Using with Shoelace and FontAwesome

If your video elements include Shoelace Web Components or FontAwesome icons:

```javascript
import { faStar } from '@fortawesome/pro-regular-svg-icons'
import '@shoelace-style/shoelace/dist/components/icon/icon.js'
import '@shoelace-style/shoelace/dist/components/card/card.js'

// Create a video element with Shoelace and FontAwesome
const element = document.createElement('sl-card')
element.innerHTML = `
  <sl-icon name="star" slot="header"></sl-icon>
  <div>Video Element Content</div>
`
document.body.appendChild(element)

// Add to manager
await manager.addVideoElement('element1', element, {x: 50, y: 50}, {width: 300, height: 200})
```

## API

### Constructor

```javascript
new VideoElementManager(viewer, canvas2D)
```

- `viewer`: Cesium viewer instance.
- `canvas2D`: HTML canvas element for rendering video elements.
- Note: The constructor returns the singleton instance if it already exists.

### Methods

- `addVideoElement(id, element, screenPos, size)`: Adds a video element to the canvas.
- `updateVideoElement(id)`: Updates a specific video element if its DOM changes.
- `updateAllVideoElements()`: Updates all video elements.
- `removeVideoElement(id)`: Removes a video element by ID.

## Notes

- **Singleton**: Only one instance of `VideoElementManager` can exist. Calling `new VideoElementManager()` multiple
  times returns the same instance.
- **SnapDOM**: Automatically pre-caches resources in the constructor for faster rendering. Configure `useProxy` in
  `#renderSnap` if CORS issues occur with external assets (e.g., images or fonts).
- **FontAwesome**: Ensure icons are imported from `@fortawesome/pro-regular-svg-icons` and registered with Shoelace's
  `<sl-icon>`.
- **Performance**: Only changed video elements are re-rendered, thanks to hash-based change detection.
- **Video Output**: Use `MediaRecorder` or similar to capture the canvas as a video stream (see example above).
- **Bun**: Use Bun as the runtime for development and production.

## Development

```bash
# Clone the project
git clone <your-repo>
cd <your-repo>

# Install dependencies
bun install

# Run your app
bun run index.js
```

## License

MIT © [Your Name]