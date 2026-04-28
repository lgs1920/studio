/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-28
 * Last modified: 2026-04-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_EFFECTIVE } from '@Core/constants'

/**
 * CanvasOverlayComposer
 * High-performance compositor for recording. It draws a main source canvas and
 * optional overlay canvases, including a clipped backdrop blur region.
 *
 * Design goals:
 * - Keep GC pressure low by reusing overlay objects.
 * - Avoid redundant work by precomputing constants per overlay.
 * - Allow FPS throttling so composition matches recording FPS.
 */
export class CanvasOverlayComposer {
    #sourceCanvas
    #outputCanvas
    #ctx
    #blurCanvas
    #blurCtx
    #outW = 1920
    #outH = 1080
    #clip = null
    #overlays = []
    #overlaysCount = 0
    #raf = null
    #lastFrameTime = 0
    #minFrameMs = 0
    #fixedMinFrameMs = 0
    #dpr = window.devicePixelRatio || 1
    #sourceDpr = 1
    #flushWebGLBuffer = null
    #blurBufferDirty = true
    #running = false

    // Cached source rect to avoid allocations inside the render loop.
    #srcRect = {x: 0, y: 0, w: 0, h: 0}

    /**
     * @param {HTMLCanvasElement} sourceCanvas - Source canvas to composite.
     * @param {Object} options
     * @param {{x:number,y:number,width:number,height:number}|null} [options.clip=null] - Crop region in CSS pixels.
     * @param {number} [options.width=1920] - Output width in CSS pixels.
     * @param {number} [options.height=1080] - Output height in CSS pixels.
     * @param {number} [options.fps=0] - Target FPS for composition (0 = no throttle).
     * @param {Function|null} [options.flushWebGLBuffer=null] - Optional callback to flush a WebGL scene.
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
                  fps = 0,
                  flushWebGLBuffer = null,
              } = options

        this.#clip = clip ? {...clip} : null
        this.#outW = width
        this.#outH = height
        this.#minFrameMs = (typeof fps === 'number' && fps > 0) ? (1000 / fps) : 0
        this.#fixedMinFrameMs = this.#minFrameMs
        this.#flushWebGLBuffer = typeof flushWebGLBuffer === 'function' ? flushWebGLBuffer : null

        this.#outputCanvas = document.createElement('canvas')
        this.#ctx = this.#outputCanvas.getContext('2d', {alpha: false, desynchronized: true})
        this.#blurCanvas = document.createElement('canvas')
        this.#blurCtx = this.#blurCanvas.getContext('2d', {alpha: false, desynchronized: true})

        this.#ctx.imageSmoothingEnabled = true
        this.#ctx.imageSmoothingQuality = 'high'
        this.#ctx.fillStyle = '#000000'
        this.#ctx.fillStyle = '#000000'

        this.#updateSourceDpr()
        this.#computeSourceRect()
        this.#resizeOutputCanvas()
        this.#running = true
        this.#loop()
    }

    #updateSourceDpr = () => {
        const rect = this.#sourceCanvas.getBoundingClientRect()
        this.#sourceDpr = rect.width > 0 ? this.#sourceCanvas.width / rect.width : 1
    }

    #computeSourceRect = () => {
        if (this.#clip) {
            this.#srcRect.x = this.#clip.x * this.#sourceDpr
            this.#srcRect.y = this.#clip.y * this.#sourceDpr
            this.#srcRect.w = this.#clip.width * this.#sourceDpr
            this.#srcRect.h = this.#clip.height * this.#sourceDpr
        }
        else {
            this.#srcRect.x = 0
            this.#srcRect.y = 0
            this.#srcRect.w = this.#sourceCanvas.width
            this.#srcRect.h = this.#sourceCanvas.height
        }
    }

    #resizeOutputCanvas = () => {
        const physicalW = Math.round(this.#outW * this.#dpr)
        const physicalH = Math.round(this.#outH * this.#dpr)

        this.#outputCanvas.width = physicalW
        this.#outputCanvas.height = physicalH
        this.#outputCanvas.style.width = `${this.#outW}px`
        this.#outputCanvas.style.height = `${this.#outH}px`

        this.#blurCanvas.width = physicalW
        this.#blurCanvas.height = physicalH

        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
        this.#blurCtx.setTransform(1, 0, 0, 1, 0, 0)
    }

    /** @returns {HTMLCanvasElement} Output canvas used for recording. */
    getCanvas = () => this.#outputCanvas

    /**
     * Forces an immediate composite frame render.
     * Useful for one-shot captures where waiting for the internal rAF loop would
     * otherwise produce an empty or stale frame.
     *
     * @param {{waitForNextFrame?: boolean}} [options]
     * @returns {Promise<HTMLCanvasElement|null>}
     */
    renderFrame = async ({waitForNextFrame = false} = {}) => {
        if (!this.#running || !this.#outputCanvas) {
            return this.#outputCanvas
        }

        if (waitForNextFrame) {
            await new Promise(resolve => requestAnimationFrame(() => resolve()))
        }

        this.#updateSourceDpr()
        this.#computeSourceRect()
        this.#draw()
        return this.#outputCanvas
    }

    /**
     * Start an overlay update batch. Use with addOverlay(), then endUpdate().
     * This resets the active overlay count while keeping pooled objects alive.
     */
    beginUpdate = () => {
        this.#overlaysCount = 0
    }

    /** End an overlay update batch. Kept for API clarity. */
    endUpdate = () => {
    }

    /**
     * Set composition FPS. If set to 0, renders every rAF tick.
     * @param {number} fps
     */
    setFps = (fps = 0) => {
        this.#fixedMinFrameMs = (typeof fps === 'number' && fps > 0) ? (1000 / fps) : 0
        this.#minFrameMs = this.#fixedMinFrameMs
    }

    #traceRoundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath()
        const radius = Math.max(0, Math.min(r, w / 2, h / 2))

        if (radius === 0) {
            ctx.rect(x, y, w, h)
            return
        }

        ctx.moveTo(x + radius, y)
        ctx.arcTo(x + w, y, x + w, y + h, radius)
        ctx.arcTo(x + w, y + h, x, y + h, radius)
        ctx.arcTo(x, y + h, x, y, radius)
        ctx.arcTo(x, y, x + w, y, radius)
        ctx.closePath()
    }

    /**
     * Add an overlay. Overlay objects are pooled to reduce allocations.
     * @param {HTMLCanvasElement|Function} element - Canvas or getter returning a canvas.
     * @param {Object} options
     * @param {number} [options.x] - Left in CSS pixels relative to clip.
     * @param {number} [options.y] - Top in CSS pixels relative to clip.
     * @param {number} [options.w] - Width in CSS pixels.
     * @param {number} [options.h] - Height in CSS pixels.
     * @param {number} [options.contentWidth] - Content width (excluding shadows).
     * @param {number} [options.contentHeight] - Content height (excluding shadows).
     * @param {number} [options.blur=0] - Backdrop blur radius in CSS pixels.
     * @param {number} [options.radius=0] - Corner radius in CSS pixels.
     * @param {number} [options.rotate=0] - Rotation in degrees.
     * @param {number|{x:number,y:number}} [options.scale=1] - Scale factor.
     * @param {number} [options.zIndex=0] - Z order.
     * @param {{top:number,right:number,bottom:number,left:number}} [options.shadowMargins]
     */
    addOverlay = (element, options = {}) => {
        const elGetter = typeof element === 'function' ? element : () => element
        const initialEl = elGetter()
        if (!initialEl) {
            return
        }

        const {
                  x, y, w, h,
                  contentWidth, contentHeight,
                  blur          = 0,
                  radius        = 0,
                  rotate        = 0,
                  scale         = 1,
                  zIndex = 0,
                  shadowMargins = {top: 0, right: 0, bottom: 0, left: 0},
              } = options

        const elRect = initialEl.getBoundingClientRect ? initialEl.getBoundingClientRect() : null
        const hasNumericWidth = typeof initialEl.width === 'number'

        const elDpr = elRect && elRect.width > 0 && hasNumericWidth ? (initialEl.width / elRect.width) : 1
        const elLogicalWidth = hasNumericWidth ? (initialEl.width / elDpr) : (elRect?.width ?? 0)

        let posX, posY, rawWidth, rawHeight

        if (typeof x === 'number' && typeof y === 'number') {
            posX = x
            posY = y
            rawWidth = w ?? elLogicalWidth
            rawHeight = h ?? (elRect?.height ?? 0)
        }
        else {
            const sourceRect = this.#sourceCanvas.getBoundingClientRect()
            posX = elRect.left - sourceRect.left
            posY = elRect.top - sourceRect.top
            if (this.#clip) {
                posX -= this.#clip.x
                posY -= this.#clip.y
            }
            rawWidth = elRect.width
            rawHeight = elRect.height
        }

        const scaleFactor = LGS_WIDGET_SCALE_EFFECTIVE
        const imgAspectRatio = initialEl.height / initialEl.width
        const cssScale = typeof scale === 'object' ? (scale.x ?? 1) : scale

        const logicalContentW = typeof contentWidth === 'number' ? contentWidth : (rawWidth / scaleFactor)
        const logicalContentH = typeof contentHeight === 'number' ? contentHeight : ((rawHeight ?? (logicalContentW * imgAspectRatio)) / scaleFactor)

        const totalW = logicalContentW + (shadowMargins.left + shadowMargins.right)
        const totalH = logicalContentH + (shadowMargins.top + shadowMargins.bottom)

        // Pooling: reuse overlay objects to limit allocations.
        const index = this.#overlaysCount++
        const overlay = this.#overlays[index] ?? (this.#overlays[index] = {})

        overlay.getElement = elGetter
        overlay.cx = posX + totalW / 2
        overlay.cy = posY + totalH / 2
        overlay.w = totalW
        overlay.h = totalH
        overlay.contentWidth = logicalContentW
        overlay.contentHeight = logicalContentH
        overlay.blur = blur
        overlay.blurPx = blur > 0 ? (blur * this.#dpr * cssScale) : 0
        overlay.radius = radius
        overlay.rad = (rotate * Math.PI) / 180
        overlay.scale = cssScale
        overlay.zIndex = zIndex
        overlay.dx = -(logicalContentW / 2) - shadowMargins.left
        overlay.dy = -(logicalContentH / 2) - shadowMargins.top
    }

    /**
     * Composite one frame into the output canvas.
     * Draw order: background -> source -> overlay blur -> overlay content.
     */
    #draw = () => {
        this.#flushWebGLBuffer?.()

        const ctx = this.#ctx
        const dpr = this.#dpr
        const physW = this.#outputCanvas.width
        const physH = this.#outputCanvas.height

        ctx.fillRect(0, 0, this.#outW, this.#outH)
        this.#blurBufferDirty = true

        // Main source render.
        ctx.drawImage(
            this.#sourceCanvas,
            this.#srcRect.x, this.#srcRect.y, this.#srcRect.w, this.#srcRect.h,
            0, 0, this.#outW, this.#outH,
        )

        const len = this.#overlaysCount
        for (let i = 0; i < len; i++) {
            const overlay = this.#overlays[i]
            const el = overlay.getElement()
            if (!el) {
                continue
            }

            const hw = overlay.contentWidth / 2
            const hh = overlay.contentHeight / 2

            if (overlay.blur > 0) {
                // Backdrop blur, clipped to the rounded rect.
                if (this.#blurBufferDirty) {
                    this.#blurCtx.drawImage(this.#outputCanvas, 0, 0, physW, physH, 0, 0, physW, physH)
                    this.#blurBufferDirty = false
                }

                ctx.save()
                ctx.translate(overlay.cx, overlay.cy)
                ctx.rotate(overlay.rad)
                ctx.scale(overlay.scale, overlay.scale)
                this.#traceRoundedRect(ctx, -hw, -hh, overlay.contentWidth, overlay.contentHeight, overlay.radius)
                ctx.clip()

                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.filter = `blur(${overlay.blurPx}px)`
                ctx.drawImage(this.#blurCanvas, 0, 0, physW, physH, 0, 0, physW, physH)

                ctx.restore()
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            }

            // Overlay content.
            ctx.save()
            ctx.translate(overlay.cx, overlay.cy)
            ctx.rotate(overlay.rad)
            ctx.scale(overlay.scale, overlay.scale)

            ctx.drawImage(
                el,
                0, 0, el.width, el.height,
                overlay.dx, overlay.dy, overlay.w, overlay.h,
            )

            ctx.restore()
            this.#blurBufferDirty = true
        }
    }

    /** Main rAF loop with optional FPS throttling. */
    #loop = () => {
        if (!this.#running) {
            return
        }
        this.#raf = requestAnimationFrame((time) => {
            if (!this.#running) {
                return
            }
            if (!this.#minFrameMs || (time - this.#lastFrameTime) >= this.#minFrameMs) {
                this.#lastFrameTime = time
                this.#draw()
            }
            this.#loop()
        })
    }

    /** Stop rendering and release references. */
    dispose = () => {
        this.#running = false
        if (this.#raf) {
            cancelAnimationFrame(this.#raf)
        }
        this.#raf = null
        if (this.#outputCanvas) {
            this.#outputCanvas.width = 0
            this.#outputCanvas.height = 0
        }
        if (this.#blurCanvas) {
            this.#blurCanvas.width = 0
            this.#blurCanvas.height = 0
        }
        this.#ctx = null
        this.#blurCtx = null
        this.#sourceCanvas = null
        this.#outputCanvas = null
        this.#blurCanvas = null
        this.#overlays = []
        this.#overlaysCount = 0
        this.#flushWebGLBuffer = null
    }
}
