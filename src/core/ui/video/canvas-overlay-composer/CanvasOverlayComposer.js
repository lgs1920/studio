/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-20
 * Last modified: 2025-11-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * CanvasOverlayComposer – lightweight, Cesium-agnostic 2D compositor
 *
 * Draws a main source canvas (Cesium, Three.js, video, etc.) and arbitrary
 * HTML elements (canvas widgets, <video>, <img>, DOM nodes with canvas rendering)
 * onto a single output canvas at 60 fps.
 *
 * Perfect for recording/streaming when WebGL compositing is overkill or buggy.
 *
 * @example
 *   const composer = new CanvasOverlayComposer(viewer.canvas, {
 *     width: 1920,
 *     height: 1080,
 *     clip: { x: 0, y: 0, width: 1920, height: 1080 },
 *     flushWebGLBuffer: () => viewer.scene.render() // forces Cesium to finish rendering
 *   })
 *
 *   composer.addOverlay(compassCanvas)
 *   composer.addOverlay(textCanvas)
 *
 *   recorder.setCanvas(composer.getCanvas())
 */
export class CanvasOverlayComposer {
    /** @type {HTMLCanvasElement} Main source (Cesium, Three.js, video…) */
    #sourceCanvas

    /** @type {HTMLCanvasElement} Final composited output */
    #outputCanvas

    /** @type {CanvasRenderingContext2D} 2D context of the output canvas */
    #ctx

    /** @type {number} Logical output width (CSS pixels) */
    #outW

    /** @type {number} Logical output height (CSS pixels) */
    #outH

    /** @type {{x:number,y:number,width:number,height:number}|null} Optional clip rectangle in logical pixels */
    #clip = null

    /** @type {Array<{element:HTMLElement|Function,x:number,y:number,w:number,h:number}>} */
    #overlays = []

    /** @type {number|null} requestAnimationFrame handle */
    #raf = null

    /** @type {number} Device pixel ratio */
    #dpr = window.devicePixelRatio || 1

    /** @type {(() => void)|null} Optional callback to flush external WebGL buffers (Cesium, Three.js…) */
    #flushWebGLBuffer = null

    /**
     * @param {HTMLCanvasElement} sourceCanvas                     Main canvas to composite
     * @param {Object} [options={}]
     * @param {{x?:number,y?:number,width?:number,height?:number}|null} [options.clip=null] Clip region (logical
     *     pixels)
     * @param {number|null} [options.width=null]                   Output width in logical pixels
     * @param {number|null} [options.height=null]                  Output height in logical pixels
     * @param {(() => void)|null} [options.flushWebGLBuffer=null]  Called before each draw to ensure external buffers
     *     are flushed
     */
    constructor(sourceCanvas, options = {}) {
        if (!sourceCanvas || !(sourceCanvas instanceof HTMLCanvasElement)) {
            throw new Error('CanvasOverlayComposer: sourceCanvas is required and must be an HTMLCanvasElement')
        }

        this.#sourceCanvas = sourceCanvas

        const {
                  clip   = null,
                  width  = null,
                  height = null,
                  flushWebGLBuffer = null,
              } = options

        this.#clip = clip ? {...clip} : null
        this.#flushWebGLBuffer = typeof flushWebGLBuffer === 'function' ? flushWebGLBuffer : null

        // Resolve logical output size
        this.#outW = width ?? this.#clip?.width ?? sourceCanvas.clientWidth ?? sourceCanvas.width
        this.#outH = height ?? this.#clip?.height ?? sourceCanvas.clientHeight ?? sourceCanvas.height

        this.#outputCanvas = document.createElement('canvas')
        this.#ctx = this.#outputCanvas.getContext('2d', {alpha: false})

        this.#resizeAndScale()
        this.#draw()
        this.#loop()
    }

    /** Resize canvas to match DPR and apply scaling transform */
    #resizeAndScale = () => {
        const physicalW = Math.round(this.#outW * this.#dpr)
        const physicalH = Math.round(this.#outH * this.#dpr)

        this.#outputCanvas.width = physicalW
        this.#outputCanvas.height = physicalH
        this.#outputCanvas.style.width = `${this.#outW}px`
        this.#outputCanvas.style.height = `${this.#outH}px`

        // Scale context so we can work in logical pixels
        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    }

    /** @returns {HTMLCanvasElement} The final composited canvas (feed this to your recorder) */
     getCanvas = () => this.#outputCanvas

     /**
     * Add an overlay element (canvas, video, image, or function returning one)
     *
     * @param {HTMLElement|Function} element          Canvas/video/img or function returning one
     * @param {number} [x]                            X position in logical pixels (auto-detected if omitted)
     * @param {number} [y]                            Y position in logical pixels (auto-detected if omitted)
     * @param {number} [w]                            Width in logical pixels (auto-detected if omitted)
     * @param {number} [h]                            Height in logical pixels (auto-detected if omitted)
     */
    addOverlay = (element, x, y, w, h) => {
        let lx = x
        let ly = y

        const el = typeof element === 'function' ? element() : element

        // Auto-detect position from DOM if not provided
        if (lx === undefined || ly === undefined) {
            const rect = el.getBoundingClientRect()
            lx = rect.left / this.#dpr
            ly = rect.top / this.#dpr
        }

        // Auto-detect size and apply widget scale factor if needed
        const lw = w ?? (el.width ?? el.videoWidth ?? el.clientWidth ?? 0) / LGS_WIDGET_SCALE_FACTOR
        const lh = h ?? (el.height ?? el.videoHeight ?? el.clientHeight ?? 0) / LGS_WIDGET_SCALE_FACTOR

        this.#overlays.push({
                                element,           // keep original reference (or factory function)
                                x: Number(lx),
                                y: Number(ly),
                                w: lw,
                                h: lh,
                            })

        this.#draw()
    }

    /** Remove all overlays and redraw */
    clearOverlays = () => {
        this.#overlays = []
        this.#draw()
    }

    /** Perform a single composite draw (called every frame) */
    #draw = () => {
        // Ensure external WebGL engines (Cesium, Three.js) have finished rendering
        this.#flushWebGLBuffer?.()

        const ctx = this.#ctx
        const w = this.#outW
        const h = this.#outH

        // Clear with solid black (no transparency issues during recording)
        ctx.clearRect(0, 0, w, h)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, w, h)

        // Draw main source with optional clip (physical pixels)
        const clip = this.#clip
                     ? {
                x:     this.#clip.x * this.#dpr,
                y:     this.#clip.y * this.#dpr,
                width: this.#clip.width * this.#dpr,
                height: this.#clip.height * this.#dpr,
            }
                     : {
                x:     0,
                y:     0,
                width: this.#sourceCanvas.width,
                height: this.#sourceCanvas.height,
            }

        ctx.drawImage(
            this.#sourceCanvas,
            clip.x,
            clip.y,
            clip.width,
            clip.height,
            0,
            0,
            w,
            h,
        )

        // Draw all overlays in order
        for (const o of this.#overlays) {
            const el = typeof o.element === 'function' ? o.element() : o.element
            if (el) {
                ctx.drawImage(el, o.x, o.y, o.w, o.h)
            }
        }
    }

    /** Main animation loop – 60 fps guaranteed */
    #loop = () => {
        this.#draw()
        this.#raf = requestAnimationFrame(this.#loop)
    }

    /**
     * Change output resolution at runtime
     * @param {number} width  Logical width
     * @param {number} height Logical height
     */
    setSize = (width, height) => {
        this.#outW = width
        this.#outH = height
        this.#resizeAndScale()
        this.#draw()
    }

    /** Clean up resources */
    dispose = () => {
        if (this.#raf) {
            cancelAnimationFrame(this.#raf)
            this.#raf = null
        }
        this.#flushWebGLBuffer = null
        this.#overlays = []
    }
}