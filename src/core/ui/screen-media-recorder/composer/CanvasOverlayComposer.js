/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-19
 * Last modified: 2026-01-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * CanvasOverlayComposer
 * A high-performance 2D compositor designed for HiDPI environments.
 * It manages a main source canvas and overlays elements with advanced effects
 * like backdrop blur, rounded clipping, and shadow-aware positioning.
 */
export class CanvasOverlayComposer {
    #sourceCanvas
    #outputCanvas
    #ctx
    #outW = 1920
    #outH = 1080
    #clip = null
    #overlays = []
    #raf = null
    #dpr = window.devicePixelRatio || 1
    #sourceDpr = 1
    #flushWebGLBuffer = null

    /**
     * @param {HTMLCanvasElement} sourceCanvas - The background source provider
     * @param {Object} [options={}] - Configuration options
     */
    constructor(sourceCanvas, options = {}) {
        if (!(sourceCanvas instanceof HTMLCanvasElement)) {
            throw new Error('CanvasOverlayComposer: sourceCanvas must be an HTMLCanvasElement')
        }

        this.#sourceCanvas = sourceCanvas

        const {
                  clip = null,
                  width = 1920,
                  height = 1080,
                  flushWebGLBuffer = null,
              } = options

        this.#clip = clip ? {...clip} : null
        this.#outW = width
        this.#outH = height
        this.#flushWebGLBuffer = typeof flushWebGLBuffer === 'function' ? flushWebGLBuffer : null

        this.#outputCanvas = document.createElement('canvas')
        this.#ctx = this.#outputCanvas.getContext('2d', {alpha: false})

        this.#ctx.imageSmoothingEnabled = true
        this.#ctx.imageSmoothingQuality = 'high'

        this.#updateSourceDpr()
        this.#resizeOutputCanvas()
        this.#draw()
        this.#loop()
    }

    #updateSourceDpr = () => {
        const rect = this.#sourceCanvas.getBoundingClientRect()
        this.#sourceDpr = rect.width > 0 ? this.#sourceCanvas.width / rect.width : 1
    }

    #resizeOutputCanvas = () => {
        const physicalW = Math.round(this.#outW * this.#dpr)
        const physicalH = Math.round(this.#outH * this.#dpr)

        this.#outputCanvas.width = physicalW
        this.#outputCanvas.height = physicalH
        this.#outputCanvas.style.width = `${this.#outW}px`
        this.#outputCanvas.style.height = `${this.#outH}px`

        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    }

    getCanvas = () => this.#outputCanvas

    /**
     * Adds an overlay to the rendering stack and computes its transformation metadata.
     * * @param {HTMLElement|(() => HTMLElement)} element - The source element (Canvas, Video, or Image) or a function
     * returning it.
     * @param {Object} [options={}] - Configuration for positioning and effects.
     * @param {number} [options.x] - Custom logical X position. If omitted, calculated via getBoundingClientRect.
     * @param {number} [options.y] - Custom logical Y position. If omitted, calculated via getBoundingClientRect.
     * @param {number} [options.w] - Custom logical width of the full buffer.
     * @param {number} [options.h] - Custom logical height of the full buffer.
     * @param {number} [options.contentW] - The explicit width of the UI component inside the buffer (excluding
     *     shadows).
     * @param {number} [options.contentH] - The explicit height of the UI component inside the buffer (excluding
     *     shadows).
     * @param {number} [options.blur=0] - Backdrop blur radius in pixels.
     * @param {number} [options.radius=0] - Corner radius for clipping the content area.
     * @param {number} [options.rotate=0] - Rotation in degrees applied at the center of the content.
     * @param {number|Object} [options.scale=1] - Scaling factor (number or {x, y} object).
     * @param {Object} [options.shadowMargins] - Padding around content used for shadow rendering.
     * @param {number} [options.shadowMargins.top] - Top shadow margin.
     * @param {number} [options.shadowMargins.right] - Right shadow margin.
     * @param {number} [options.shadowMargins.bottom] - Bottom shadow margin.
     * @param {number} [options.shadowMargins.left] - Left shadow margin.
     */
    addOverlay = (element, options = {}) => {
        const el = typeof element === 'function' ? element() : element
        if (!el) {
            return
        }

        const {
                  x, y, w, h,
                  contentW, contentH,
                  blur          = 0,
                  radius        = 0,
                  rotate        = 0,
                  scale         = 1,
                  shadowMargins = {top: 0, right: 0, bottom: 0, left: 0},
              } = options

        let posX, posY, width, height

        if (typeof x === 'number' && typeof y === 'number') {
            posX = x
            posY = y
            width = w ?? el.width ?? 0
            height = h ?? el.height ?? 0
        }
        else {
            const rect = el.getBoundingClientRect()
            const sourceRect = this.#sourceCanvas.getBoundingClientRect()

            posX = (rect.left - sourceRect.left) * this.#sourceDpr
            posY = (rect.top - sourceRect.top) * this.#sourceDpr
            width = rect.width * this.#sourceDpr
            height = rect.height * this.#sourceDpr

            if (this.#clip) {
                posX -= this.#clip.x
                posY -= this.#clip.y
            }
        }

        const scaleFactor = el.classList?.contains('lgs-widget-canvas') ? LGS_WIDGET_SCALE_FACTOR : 1
        const cssScale = typeof scale === 'object' ? (scale.x ?? 1) : scale

        const actualContentW = contentW || (width / scaleFactor)
        const actualContentH = contentH || (height / scaleFactor)

        // Calculate center based on content position + half dimensions
        const contentPosX = posX + shadowMargins.left
        const contentPosY = posY + shadowMargins.top
        const cx = contentPosX + actualContentW / 2
        const cy = contentPosY + actualContentH / 2
        // Pushed variables in this.#overlays:
        // - element: Source (Canvas/Video/Image) or getter.
        // - cx / cy: Center coordinates of the CONTENT area in the output canvas.
        // - w / h: Logical dimensions of the full source buffer (including shadows).
        // - contentW / contentH: Dimensions of the UI component excluding shadow margins.
        // - shadowMargins: Offsets {top, right, bottom, left} defining shadow space in the buffer.
        // - blur: Backdrop blur radius.
        // - radius: Corner radius for content clipping.
        // - rotate: Rotation angle in degrees.
        // - scale: Scale factor for the entire element.

        this.#overlays.push({
                                element,
                                cx, cy,
                                w: width / scaleFactor,
                                h: height / scaleFactor,
                                contentW: actualContentW,
                                contentH: actualContentH,
                                blur,
                                radius,
                                rotate,
                                scale: cssScale,
                                shadowMargins,
                            })

        this.#draw()
    }

    clearOverlays = () => {
        this.#overlays = []
        this.#draw()
    }

    #draw = () => {
        this.#flushWebGLBuffer?.()
        const ctx = this.#ctx

        ctx.clearRect(0, 0, this.#outW, this.#outH)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, this.#outW, this.#outH)

        let srcX = 0, srcY = 0, srcW = this.#sourceCanvas.width, srcH = this.#sourceCanvas.height
        if (this.#clip) {
            srcX = this.#clip.x * this.#sourceDpr
            srcY = this.#clip.y * this.#sourceDpr
            srcW = this.#clip.width * this.#sourceDpr
            srcH = this.#clip.height * this.#sourceDpr
        }

        const drawMainSource = () => {
            ctx.drawImage(this.#sourceCanvas, srcX, srcY, srcW, srcH, 0, 0, this.#outW, this.#outH)
        }

        // 1. Draw background
        drawMainSource()

        // 2. Draw overlays
        for (const o of this.#overlays) {
            const el = typeof o.element === 'function' ? o.element() : o.element
            if (!el) {
                continue
            }

            const rad = (o.rotate * Math.PI) / 180

            // Apply backdrop blur if requested
            if (o.blur > 0) {
                ctx.save()
                ctx.translate(o.cx, o.cy)
                ctx.rotate(rad)
                ctx.scale(o.scale, o.scale)

                ctx.beginPath()
                const hw = o.contentW / 2
                const hh = o.contentH / 2

                // Define the mask based on content area only
                if (o.radius > 0) {
                    ctx.roundRect(-hw, -hh, o.contentW, o.contentH, o.radius)
                }
                else {
                    ctx.rect(-hw, -hh, o.contentW, o.contentH)
                }
                ctx.clip()

                // --- Step B: Reset transformation to draw the background correctly ---
                // We go back to the base DPR scale so (0,0) is top-left of the whole canvas
                ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
                ctx.filter = `blur(${o.blur}px)`
                drawMainSource()
                ctx.restore()
            }

            ctx.save()
            // Transformations are performed around the CONTENT center
            ctx.translate(o.cx, o.cy)
            ctx.rotate(rad)
            ctx.scale(o.scale, o.scale)

            // The canvas includes shadow rendering
            // We want to position the canvas so its CONTENT is centered at (0, 0)

            // The content center within the canvas is at:
            const contentCenterInCanvasX = o.shadowMargins.left + o.contentW / 2
            const contentCenterInCanvasY = o.shadowMargins.bottom + o.contentH / 2

            // To center the content at (0, 0), draw the canvas at:
            const offsetX = -contentCenterInCanvasX
            const offsetY = -contentCenterInCanvasY

            // DEBUG: Draw a red rect around the blur/content area
            // ctx.strokeStyle = 'red'
            // ctx.lineWidth = 2 / o.scale
            // ctx.strokeRect(-o.contentW / 2, -o.contentH / 2, o.contentW, o.contentH)

            ctx.drawImage(el, offsetX, offsetY, o.w, o.h)
            ctx.restore()
        }
    }

    #loop = () => {
        this.#draw()
        this.#raf = requestAnimationFrame(this.#loop)
    }

    setSize = (width, height) => {
        this.#outW = width
        this.#outH = height
        this.#resizeOutputCanvas()
        this.#draw()
    }

    handleResize = () => {
        this.#resizeOutputCanvas()
        this.#draw()
    }

    dispose = () => {
        if (this.#raf) {
            cancelAnimationFrame(this.#raf)
        }
        this.#raf = null
        this.#overlays = []
        this.#flushWebGLBuffer = null
    }
}