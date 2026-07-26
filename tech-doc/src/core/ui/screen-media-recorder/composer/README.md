---
title: CanvasOverlayComposer
---

# CanvasOverlayComposer — Detailed Guide

This document explains how `CanvasOverlayComposer` works, why it exists, and how it is wired into the recording flow. It
is intentionally long and explicit so you can maintain it without re-reading the entire code.

## Overview

`CanvasOverlayComposer` is a high‑performance compositor used for recording:

- It renders a **source canvas** (the main WebGL/scene output).
- It draws **overlay canvases** (widgets) on top.
- It optionally applies a **backdrop blur** inside rounded rectangles.
- It produces a **single output canvas** for the recorder.

The implementation is tuned for:

- Low GC pressure (object pooling + precomputed constants)
- Stable performance (FPS throttling)
- Correct compositing in screen‑recording context

## Core Data Flow

1. **Source canvas** is drawn into the output canvas.
2. **Backdrop blur** is applied per overlay:
    - A rounded rect clip is created in overlay space.
    - The current output buffer is blurred and drawn inside the clip.
3. **Overlay content** is drawn on top.

The output canvas becomes the recording input (`ScreenMediaRecorder.setCanvas()`).

## Key Concepts

### 1) Output Canvas vs. Source Canvas

- **Source canvas**: the original WebGL/scene canvas (`lgs.canvas`).
- **Output canvas**: a new 2D canvas owned by `CanvasOverlayComposer`.
- Only the output is passed to the recorder.

### 2) Backdrop Blur

The blur is a *post‑composition* effect:

1. We draw the **current output** into an offscreen buffer.
2. We blur that buffer.
3. We draw the blurred buffer **inside a rounded rect clip**.

This mimics a CSS `backdrop-filter` but is performed manually in the compositor.

Important behavior:

- The blur **is clipped by rounded corners**, not by actual overlay alpha.
- If you use a semi‑transparent background, the blur is still visible in the clip area.
- This is the same behavior as a plain rounded mask, not a per‑pixel alpha mask.

### 3) Overlay Pooling

`addOverlay()` reuses objects instead of allocating new ones:

- `beginUpdate()` resets the *active* overlay count.
- `addOverlay()` fills a pooled object at index `N`.
- `endUpdate()` is a no‑op but keeps the API explicit.

This avoids GC spikes when overlays are updated repeatedly.

### 4) FPS Throttling

The composer can throttle to a target FPS:

- `fps = 0` → render every `requestAnimationFrame`.
- `fps = 30` → render at most every 33.33 ms.

This prevents composing more frames than the encoder can consume.

## Public API

### Constructor

```js
const composer = new CanvasOverlayComposer(sourceCanvas, {
    clip:             {x, y, width, height},
    width:            1920,
    height:           1080,
    fps:              30,
    flushWebGLBuffer: () => lgs.scene.render()
})
```

Options:

- `clip`: crop region (CSS pixels) inside the source canvas.
- `width`, `height`: output dimensions (CSS pixels).
- `fps`: target composition FPS.
- `flushWebGLBuffer`: optional callback to flush WebGL before 2D draw.

### beginUpdate / endUpdate

```js
composer.beginUpdate()
// addOverlay calls...
composer.endUpdate()
```

Use this pair every time you rebuild overlays.

### addOverlay

```js
composer.addOverlay(canvasEl, {
    x, y, w, h,
    contentWidth, contentHeight,
    blur:          6,
    radius:        12,
    rotate:        0,
    scale:         1,
    zIndex:        5,
    shadowMargins: {top: 4, right: 4, bottom: 6, left: 4}
})
```

Notes:

- `contentWidth/Height` should exclude shadow margins.
- `blur` and `radius` are in CSS pixels.
- `scale` can be a number or `{x, y}`.

### setFps

```js
composer.setFps(30)
```

Updates the throttle target at runtime.

### getCanvas

```js
const out = composer.getCanvas()
recorder.setCanvas(out)
```

Returns the output canvas used by the recorder.

### dispose

Stops the rAF loop and releases references.

```js
composer.dispose()
```

## How It Is Used in Recording

In `VideoRecordingScreenArea.jsx`:

- The recorder is initialized with:
    - `fps` from user settings
    - `timeslice` (softened to reduce event overhead)
- The composer is created once per record/snapshot.
- Overlays are rebuilt on a **rAF‑controlled timer** (every `OVERLAYS_REFRESH_MS`).
- Overlay metrics (blur/radius/shadow) are cached for `METRICS_CACHE_TTL_MS`.

This keeps the overlay list fresh without constant allocations.

## Handling CSS Variables for Blur

`getOverlayMetrics()` supports CSS variables:

```css
.widget {
    backdrop-filter: blur(var(--lgs-blur-s));
}
```

The code resolves `--lgs-blur-s` via `getComputedStyle(el)`.

## Example: Basic Recording Setup

```js
const composer = new CanvasOverlayComposer(lgs.canvas, {
    clip:             {x, y, width, height},
    width,
    height,
    fps:              ScreenMediaRecorder.FPS[$video.fps],
    flushWebGLBuffer: () => lgs.scene.render()
})

composer.beginUpdate()
widgets.forEach(widget => {
    composer.addOverlay(widget.canvas, widget.options)
})
composer.endUpdate()

recorder.setCanvas(composer.getCanvas())
recorder.startVideo()
```

## Example: Live Overlay Refresh

```js
const refresh = () => {
    composer.beginUpdate()
    widgets.forEach(widget => composer.addOverlay(widget.canvas, widget.options))
    composer.endUpdate()
}

let last = 0
const tick = (t) => {
    if (t - last > 250) {
        last = t
        refresh()
    }
    requestAnimationFrame(tick)
}

requestAnimationFrame(tick)
```

This refreshes overlay positions/sizes without GC spikes.

## Known Limitations

- Backdrop blur is **clipped to a rounded rect**, not to per‑pixel alpha.
- If your widget uses a semi‑transparent background, the blur is still visible
  inside the rounded rect even in fully transparent sub‑areas.
- This matches the current implementation and keeps the blur fast.

## Tips

- If a widget does not blur, check:
    - `backdrop-filter` resolves to a numeric value (CSS variables are supported).
    - The overlay element used for metrics actually has the blur style.
- If performance drops:
    - Increase `OVERLAYS_REFRESH_MS`.
    - Increase `METRICS_CACHE_TTL_MS`.
    - Lower composition FPS via `setFps()`.

---

If you need a version that masks blur by actual alpha, it will require a separate
alpha mask render pass (more expensive). The current version favors stability.
