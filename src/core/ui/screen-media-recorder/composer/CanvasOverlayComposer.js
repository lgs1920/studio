/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-26
 * Last modified: 2026-02-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_EFFECTIVE } from '@Core/constants'

/**
 * CanvasOverlayComposer
 * Manages complex multi-layer composition including real-time backdrop blur effects.
 * It synchronizes a source canvas (usually WebGL) with multiple 2D overlays.
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
     * @param {HTMLCanvasElement} sourceCanvas - The primary source canvas to be composed.
     * @param {Object} options - Configuration for clipping, dimensions, and buffer management.
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

        // High-quality interpolation for scaled overlays
        this.#ctx.imageSmoothingEnabled = true
        this.#ctx.imageSmoothingQuality = 'high'

        this.#updateSourceDpr()
        this.#resizeOutputCanvas()
        this.#loop()
    }

    /**
     * Calculates the device pixel ratio of the source canvas based on its layout size.
     */
    #updateSourceDpr = () => {
        const rect = this.#sourceCanvas.getBoundingClientRect()
        this.#sourceDpr = rect.width > 0 ? this.#sourceCanvas.width / rect.width : 1
    }

    /**
     * Updates physical canvas dimensions to match the display size multiplied by DPR.
     */
    #resizeOutputCanvas = () => {
        const physicalW = Math.round(this.#outW * this.#dpr)
        const physicalH = Math.round(this.#outH * this.#dpr)

        this.#outputCanvas.width = physicalW
        this.#outputCanvas.height = physicalH
        this.#outputCanvas.style.width = `${this.#outW}px`
        this.#outputCanvas.style.height = `${this.#outH}px`

        // Apply global scale to match logical coordinate system
        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    }

    /**
     * Accessor for the resulting composed canvas.
     */
    getCanvas = () => this.#outputCanvas

    /**
     * Generates a rounded rectangle path.
     * Used for clipping regions and backdrop-blur boundaries.
     */
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
     * Adds an overlay to the composition stack.
     * Handles both absolute positioning and relative positioning based on the source canvas.
     */
    addOverlay = (element, options = {}) => {
        const el = typeof element === 'function' ? element() : element
        if (!el) {
            return
        }

        const {
                  x, y, w, h,
                  contentWidth, contentHeight,
                  blur          = 0,
                  radius        = 0,
                  rotate        = 0,
                  scale         = 1,
                  shadowMargins = {top: 0, right: 0, bottom: 0, left: 0},
              } = options

        const elRect = el.getBoundingClientRect ? el.getBoundingClientRect() : null
        const hasNumericWidth = typeof el.width === 'number'
        const hasNumericHeight = typeof el.height === 'number'

        // Calculate the internal scale of the element if it's a canvas
        const elDpr = elRect && elRect.width > 0 && hasNumericWidth ? (el.width / elRect.width) : 1
        const elLogicalWidth = hasNumericWidth ? (el.width / elDpr) : (elRect?.width ?? 0)

        let posX, posY, rawWidth, rawHeight

        if (typeof x === 'number' && typeof y === 'number') {
            posX = x
            posY = y
            rawWidth = w ?? elLogicalWidth
            rawHeight = h ?? (elRect?.height ?? 0)
        }
        else {
            // Coordinate transformation relative to source canvas viewport
            const rect = elRect
            const sourceRect = this.#sourceCanvas.getBoundingClientRect()
            posX = rect.left - sourceRect.left
            posY = rect.top - sourceRect.top
            if (this.#clip) {
                posX -= this.#clip.x
                posY -= this.#clip.y
            }
            rawWidth = rect.width
            rawHeight = rect.height
        }

        const scaleFactor = LGS_WIDGET_SCALE_EFFECTIVE
        const imgAspectRatio = el.height / el.width

        const cssScale = typeof scale === 'object' ? (scale.x ?? 1) : scale
        const logicalContentW = typeof contentWidth === 'number'
                                ? contentWidth
                                : (rawWidth / scaleFactor)
        const logicalContentH = typeof contentHeight === 'number'
                                ? contentHeight
                                : ((rawHeight ?? (logicalContentW * imgAspectRatio)) / scaleFactor)

        const totalW = logicalContentW + (shadowMargins.left + shadowMargins.right)
        const totalH = logicalContentH + (shadowMargins.top + shadowMargins.bottom)

        // Compute center for rotation and scaling transformations
        const cx = posX + totalW / 2
        const cy = posY + totalH / 2

        this.#overlays.push({
                                element,
                                cx, cy,
                                w:             totalW,
                                h:             totalH,
                                contentWidth:  logicalContentW,
                                contentHeight: logicalContentH,
                                blur,
                                radius,
                                rotate,
                                scale:         cssScale,
                                shadowMargins,
                            })
    }

    /**
     * Orchestrates the frame rendering.
     * Implements a back-to-front draw order with support for dynamic backdrop sampling.
     */
    #draw = () => {
        // Ensure WebGL sources are synchronized before sampling
        this.#flushWebGLBuffer?.()
        const ctx = this.#ctx

        // Reset buffer with opaque background
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

        // Background composition
        ctx.drawImage(this.#sourceCanvas, srcX, srcY, srcW, srcH, 0, 0, this.#outW, this.#outH)

        for (const overlay of this.#overlays) {
            const el = typeof overlay.element === 'function' ? overlay.element() : overlay.element
            if (!el) {
                continue
            }

            const rad = (overlay.rotate * Math.PI) / 180
            const hw = overlay.contentWidth / 2
            const hh = overlay.contentHeight / 2
            const radius = Math.max(0, Math.min(overlay.radius, hw, hh))

            // BACKDROP BLUR PASS
            if (overlay.blur > 0) {
                ctx.save()
                // Define the clipping region for the blur effect
                ctx.translate(overlay.cx, overlay.cy)
                ctx.rotate(rad)
                ctx.scale(overlay.scale, overlay.scale)
                this.#traceRoundedRect(ctx, -hw, -hh, overlay.contentWidth, overlay.contentHeight, radius)
                ctx.restore()

                ctx.save()
                ctx.clip()

                // Filter calibrated to logical units; context is already scaled by DPR
                ctx.filter = `blur(${overlay.blur * overlay.scale}px)`

                // Resample the existing buffer to generate the blurred backdrop
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.drawImage(
                    this.#outputCanvas,
                    0, 0, this.#outputCanvas.width, this.#outputCanvas.height,
                    0, 0, this.#outputCanvas.width, this.#outputCanvas.height,
                )
                ctx.restore()

                // Revert to logical transform for the foreground pass
                ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
            }

            // OVERLAY CONTENT PASS
            ctx.save()
            ctx.translate(overlay.cx, overlay.cy)
            ctx.rotate(rad)
            ctx.scale(overlay.scale, overlay.scale)

            const dx = -hw - overlay.shadowMargins.left
            const dy = -hh - overlay.shadowMargins.top

            ctx.drawImage(
                el,
                0, 0, el.width, el.height,
                dx, dy, overlay.w, overlay.h,
            )

            ctx.restore()
        }
    }

    /**
     * Internal animation loop.
     */
    #loop = () => {
        this.#draw()
        this.#raf = requestAnimationFrame(this.#loop)
    }

    /**
     * Cleans up resources and stops the render loop.
     */
    dispose = () => {
        if (this.#raf) {
            cancelAnimationFrame(this.#raf)
        }
        this.#raf = null
        this.#overlays = []
        this.#flushWebGLBuffer = null
    }
}