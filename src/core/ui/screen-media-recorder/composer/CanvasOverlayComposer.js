/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-27
 * Last modified: 2025-11-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * CanvasOverlayComposer – Lightweight 2D compositor for HiDPI environments
 *
 * Captures a source canvas (Cesium, Three.js, <video>, etc.) — optionally clipped —
 * and composites arbitrary DOM elements (widgets, HUD, compass, video overlays…)
 * onto a single output canvas at fixed logical resolution (default 1920×1080).
 *
 * Fully HiDPI-aware and works reliably with devicePixelRatio ≠ 1 and non-zero clip offsets.
 */
export class CanvasOverlayComposer {
    /** Source canvas (Cesium scene, Three.js renderer, video element, etc.) */
    #sourceCanvas

    /** Final composited canvas — the one you feed to MediaRecorder or WebRTC */
    #outputCanvas

    /** 2D rendering context of the output canvas */
    #ctx

    /** Logical output width in pixels (CSS pixels, e.g. 1920) */
    #outW = 1920

    /** Logical output height in pixels (e.g. 1080) */
    #outH = 1080

    /** Optional clipping rectangle in source canvas logical pixels */
    #clip = null

    /** Array of overlay objects to draw on top of the source */
    #overlays = []

    /** requestAnimationFrame handle for the render loop */
    #raf = null

    /** Page device pixel ratio (window.devicePixelRatio) */
    #dpr = window.devicePixelRatio || 1

    /** Actual DPR of the source canvas — recomputed every frame (critical for Cesium) */
    #sourceDpr = 1

    /** Optional callback to force WebGL buffer flush before each frame (e.g. viewer.scene.render) */
    #flushWebGLBuffer = null

    /**
     * Creates a new CanvasOverlayComposer instance
     *
     * @param {HTMLCanvasElement} sourceCanvas                    The main source canvas to composite
     * @param {Object} [options={}]
     * @param {{x?:number,y?:number,width?:number,height?:number}|null} [options.clip=null] Clip region in source
     *     logical pixels
     * @param {number} [options.width=1920]                       Desired logical output width
     * @param {number} [options.height=1080]                      Desired logical output height
     * @param {(() => void)|null} [options.flushWebGLBuffer=null] Callback executed before each frame to ensure WebGL
     *     rendering is complete
     */
    constructor(sourceCanvas, options = {}) {
        if (!(sourceCanvas instanceof HTMLCanvasElement)) {
            throw new Error('CanvasOverlayComposer: sourceCanvas must be an HTMLCanvasElement')
        }

        this.#sourceCanvas = sourceCanvas

        const {
                  clip  = null,
                  width = 1920,
                  height = 1080,
                  flushWebGLBuffer = null,
              } = options

        this.#clip = clip ? {...clip} : null
        this.#outW = width
        this.#outH = height
        this.#flushWebGLBuffer = typeof flushWebGLBuffer === 'function' ? flushWebGLBuffer : null

        // Create output canvas with opaque background (better for recording)
        this.#outputCanvas = document.createElement('canvas')
        this.#ctx = this.#outputCanvas.getContext('2d', {alpha: false})

        // Initialize DPR, size, and start rendering
        this.#updateSourceDpr()
        this.#resizeOutputCanvas()
        this.#draw()
        this.#loop()
    }

    /** Recomputes the real DPR of the source canvas (can change dynamically with Cesium) */
    #updateSourceDpr = () => {
        const rect = this.#sourceCanvas.getBoundingClientRect()
        this.#sourceDpr = rect.width > 0 ? this.#sourceCanvas.width / rect.width : 1
    }

    /** Resizes the output canvas to match device pixel ratio and sets scaling transform */
    #resizeOutputCanvas = () => {
        const physicalW = Math.round(this.#outW * this.#dpr)
        const physicalH = Math.round(this.#outH * this.#dpr)

        this.#outputCanvas.width = physicalW
        this.#outputCanvas.height = physicalH
        this.#outputCanvas.style.width = `${this.#outW}px`
        this.#outputCanvas.style.height = `${this.#outH}px`

        // Scale context so all drawing calls use logical pixels
        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    }

    /** Returns the final composited canvas (use this with MediaRecorder, getUserMedia, etc.) */
    getCanvas = () => this.#outputCanvas

    /**
     * Adds an overlay element on top of the source canvas
     *
     * Position and size are automatically adjusted for HiDPI and clip offset.
     *
     * @param {HTMLElement|(() => HTMLElement)} element           DOM element or factory function returning one
     * @param {number} [x]                                        Manual X position in logical pixels (relative to clip)
     * @param {number} [y]                                        Manual Y position in logical pixels
     * @param {number} [w]                                        Manual width in logical pixels
     * @param {number} [h]                                        Manual height in logical pixels
     */
    addOverlay = (element, x, y, w, h) => {
        const el = typeof element === 'function' ? element() : element
        if (!el) {
            return
        }

        let posX, posY, width, height

        // Manual positioning — values already in logical output space
        if (typeof x === 'number' && typeof y === 'number') {
            posX = x
            posY = y
            width = w ?? el.width ?? el.videoWidth ?? el.clientWidth ?? 0
            height = h ?? el.height ?? el.videoHeight ?? el.clientHeight ?? 0
        }
        else {
            // Auto-detect position and size from DOM layout
            const rect = el.getBoundingClientRect()
            const sourceRect = this.#sourceCanvas.getBoundingClientRect()

            // Convert CSS pixels → source canvas logical pixels
            const cssX = rect.left - sourceRect.left
            const cssY = rect.top - sourceRect.top

            posX = cssX * this.#sourceDpr
            posY = cssY * this.#sourceDpr

            // Physical size in source canvas pixels
            width = rect.width * this.#sourceDpr
            height = rect.height * this.#sourceDpr

            // Adjust position if a clip region is active (critical fix)
            if (this.#clip) {
                posX -= this.#clip.x
                posY -= this.#clip.y
            }
        }

        // Apply scale factor for LGS widgets rendered at higher internal resolution
        const scaleFactor = el.classList?.contains('lgs-widget-canvas') ? LGS_WIDGET_SCALE_FACTOR : 1

        this.#overlays.push({
                                element,
                                x: posX,
                                y: posY,
                                w: width / scaleFactor,
                                h: height / scaleFactor,
                            })

        this.#draw()
    }

    /** Removes all overlays and redraws */
    clearOverlays = () => {
        this.#overlays = []
        this.#draw()
    }

    /** Draws a single composite frame */
    #draw = () => {
        // Ensure WebGL rendering is finished (Cesium/Three.js)
        this.#flushWebGLBuffer?.()

        // Source DPR can change every frame — always recompute
        this.#updateSourceDpr()

        const ctx = this.#ctx

        // Solid black background (prevents transparency issues in recordings)
        ctx.clearRect(0, 0, this.#outW, this.#outH)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, this.#outW, this.#outH)

        // --- Draw clipped source canvas ---
        let srcX = 0, srcY = 0, srcW = this.#sourceCanvas.width, srcH = this.#sourceCanvas.height

        if (this.#clip) {
            srcX = this.#clip.x * this.#sourceDpr
            srcY = this.#clip.y * this.#sourceDpr
            srcW = this.#clip.width * this.#sourceDpr
            srcH = this.#clip.height * this.#sourceDpr
        }

        ctx.drawImage(
            this.#sourceCanvas,
            srcX, srcY, srcW, srcH,   // source rectangle (physical pixels)
            0, 0, this.#outW, this.#outH, // destination (logical pixels)
        )

        // --- Draw all overlays in order ---
        for (const o of this.#overlays) {
            const el = typeof o.element === 'function' ? o.element() : o.element
            if (el) {
                ctx.drawImage(el, o.x, o.y, o.w, o.h)
            }
        }
    }

    /** Main 60 FPS render loop */
    #loop = () => {
        this.#draw()
        this.#raf = requestAnimationFrame(this.#loop)
    }

    /**
     * Changes the output resolution at runtime
     *
     * @param {number} width  New logical width
     * @param {number} height New logical height
     */
    setSize = (width, height) => {
        this.#outW = width
        this.#outH = height
        this.#resizeOutputCanvas()
        this.#draw()
    }

    /** Call on window resize to keep output canvas crisp */
    handleResize = () => {
        this.#resizeOutputCanvas()
        this.#draw()
    }

    /** Cleans up resources — call when composer is no longer needed */
    dispose = () => {
        if (this.#raf) {
            cancelAnimationFrame(this.#raf)
        }
        this.#raf = null
        this.#overlays = []
        this.#flushWebGLBuffer = null
    }
}