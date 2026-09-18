Here is the complete Markdown code for the `tech-doc/specs/CORE-WIDGET-MANAGER-WIDGET-2-CANVAS-README.md` file.

# Widget2Canvas — High-Performance DOM-to-Canvas Mirroring

The implementation uses `@zumer/snapdom` `3.0.0`.

A lightweight, production-ready class that replaces a DOM widget with a perfectly synced canvas
using [@zumer/snapdom](https://github.com/zumer/snapdom).

Ideal for:

- Exporting complex UI components (SVG, animations, CSS filters, etc.)
- Canvas-based rendering engines
- PDF/image generation
- Real-time mirroring with zero visual flash

---

## Features

| Feature                  | Description                                                      |
|--------------------------|------------------------------------------------------------------|
| **Zero flash**           | Original element hidden only after its display value is captured |
| **Perfect layout**       | Preserves `display: flex`, `grid`, `inline-block`, etc.          |
| **Real-time sync**       | `MutationObserver` triggers update on any DOM change             |
| **High performance**     | Batched updates via `queueMicrotask` — no redundant renders      |
| **Direct canvas output** | Uses `snapdom.toCanvas()`                                        |
| **Easy cleanup**         | Full `destroy()` restores original DOM                           |

---

## Widget Zones

`Widget2Canvas` can mirror a widget in two modes:

- `static-widget-part`
- `dynamic-widget-part`

Rules:

- Mark the stable shell of a widget as `static-widget-part`
- Mark every value, icon, or block that changes during replay as `dynamic-widget-part`
- Static parts are captured once and cached
- Dynamic parts are recaptured when they mutate
- If a static part contains dynamic descendants, those descendants must also be marked dynamic so the static capture does not keep stale text or duplicated values
- Canvas elements are treated as dynamic bitmap sources and are copied directly instead of being frozen through DOM snapshotting
- If no zone is marked, `Widget2Canvas` falls back to a full-widget capture

This contract is especially important for video/replay widgets, where the visible DOM and the recorded canvas must stay aligned without stacking old and new text.

## SnapDOM 3 capture contract

SnapDOM 3 automatically reuses eligible unchanged captures and can recapture
only affected subtrees when a local change is observable. `Widget2Canvas` keeps
explicit static and dynamic zones around that behavior so Replay can decide
which parts are allowed to change for a canonical frame.

The application also follows the v3 migration rules:

- `snapdom.preCapture()` is used for capture-intent preparation;
- the removed v2 `preCache`, `fast`, `burst`, and `compress` options are not
  part of the capture contract;
- `invalidate: true` is reserved for changes SnapDOM cannot observe, such as
  selected programmatic CSSOM updates;
- v3 automatic font embedding and resource caching reduce repeated setup work,
  but do not remove the cost of rasterizing a changed DOM subtree;
- `width` and `height` are treated as final output dimensions when supplied,
  while `scale` and `dpr` control raster resolution when explicit dimensions are
  not used;
- `capture.meta` geometry is retained when the canvas mirror is positioned, so
  viewBox size and content offsets do not distort the widget during composition.

For Replay recording, a static widget zone should be captured once per layout
revision. A dynamic zone should be refreshed only after its canonical Replay
frame state changes. If a refresh is already running, the newest requested
state must remain queued and replace obsolete intermediate work before the next
canvas update.

---

## Installation

```
bash
npm install @zumer/snapdom
```
---

## Usage

### 1. Import the class

```
js
import { Widget2Canvas } from './path/to/Widget2Canvas.js'
```
### 2. Initialize on a DOM element

```
js
// Select your widget (excluding overlays, tooltips, etc.)
const target = document.querySelector('.my-widget')

// Create the canvas mirror
const mirror = new Widget2Canvas(target, {
scale:             2,                    // Optional: 2x resolution
includeBackground: true,     // Default: true
includeShadowDom:  true       // Default: true
})
```
> The original element is automatically hidden and replaced by a canvas.

---

## Public API

| Method           | Description                                       |
|------------------|---------------------------------------------------|
| `getCanvas()`    | Returns the visible `<canvas>` element            |
| `getContext()`   | Returns the 2D context (`ctx`) for drawing on top |
| `show()`         | Sets canvas `opacity: 1`                          |
| `hide()`         | Sets canvas `opacity: 0`                          |
| `showOriginal()` | Shows original DOM, hides canvas                  |
| `hideOriginal()` | Hides original DOM (default state)                |
| `destroy()`      | Removes canvas, restores original element         |

### Example: Draw on top of the mirrored canvas

```
js
const ctx = mirror.getContext()
ctx.fillStyle = 'red'
ctx.fillRect(10, 10, 50, 50)
```
---

## CSS (Required)

Add this to your global stylesheet:

```
css
/* Off-screen clone — must be visible to snapdom */
.lgs-widget-clone {
position: absolute !important;
top: -99999px !important;
left: -99999px !important;
visibility: visible !important;
pointer-events: none !important;
contain: layout style paint;
}

/* Visible canvas — inherits layout from original */
.lgs-widget-canvas {
position: absolute;
top: 0;
left: 0;
width: 100%;
height: 100%;
pointer-events: none;
opacity: 1;
display: block;
}
```
> The canvas automatically inherits `position`, `top`, `left`, `transform`, etc. from the parent.

---

## Advanced: React Integration (Hook)

```
tsx
import {useRef, useEffect} from 'react'
import {Widget2Canvas} from './Widget2Canvas'

export function useWidget2Canvas(ref, options = {}) {
const mirrorRef = useRef(null)

    useEffect(() => {
        if (!ref.current) return

        const target = ref.current.querySelector(':scope > :not(.lgs-widget-inner-overlay)')
        if (!target) return

        const mirror = new Widget2Canvas(target, options)
        mirrorRef.current = mirror

        return () => {
            mirror.destroy()
        }
    }, [ref, options])

    return mirrorRef.current
}
```
Usage in component:

```
tsx
function MyWidget() {
const widgetRef = useRef(null)
const mirror = useWidget2Canvas(widgetRef)

    return <div ref={widgetRef} className="lgs-widget">…</div>
}
```
---

## Performance Tips

- **Avoid rapid mutations** — batch DOM updates when possible
- **Use `scale: 1`** for maximum speed (unless exporting high-DPI)
- **Reuse unchanged captures** — let SnapDOM 3 retain eligible results and
  invalidate only when an unobservable change requires it
- **Refresh dynamic zones selectively** — do not snapshot a complete widget for
  every Replay frame when only one dynamic part changed
- **Call `destroy()`** on component unmount to prevent memory leaks

---

## Limitations

- Does **not** capture:
    - `<iframe>` content
    - WebGL canvases (use `toDataURL()` instead)
    - Cross-origin images without `crossOrigin="anonymous"`
- CSS `:hover` states are captured only if active during render

---

## License

© 2025 LGS1920 — All rights reserved.
