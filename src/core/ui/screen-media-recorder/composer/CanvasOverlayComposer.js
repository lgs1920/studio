/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-20
 * Last modified: 2026-01-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

// Build Metadata
// Generated on: 2026-01-20 21:30:15
// Build ID: LGS-COMP-20260120-2130-D20-STABLE

/**
 * CanvasOverlayComposer
 * High-fidelity compositor using a transform-first approach.
 * By applying scale via the context matrix, all geometric properties
 * (dimensions, radius, offsets) are naturally projected.
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

    #traceRoundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath()
        if (r <= 0) {
            ctx.rect(x, y, w, h)
            return
        }
        const radius = Math.min(r, w / 2, h / 2)
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + w - radius, y)
        ctx.arcTo(x + w, y, x + w, y + radius, radius)
        ctx.lineTo(x + w, y + h - radius)
        ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
        ctx.lineTo(x + radius, y + h)
        ctx.arcTo(x, y + h, x, y + h - radius, radius)
        ctx.lineTo(x, y + radius)
        ctx.arcTo(x, y, x + radius, y, radius)
        ctx.closePath()
    }

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

        let posX, posY, width, height

        // Calculate logical base size (ignoring external CSS scale)
        if (typeof x === 'number' && typeof y === 'number') {
            posX = x
            posY = y
            width = w ?? (el.width / this.#dpr)
            height = h ?? (el.height / this.#dpr)
        }
        else {
            const rect = el.getBoundingClientRect()
            const sourceRect = this.#sourceCanvas.getBoundingClientRect()
            posX = rect.left - sourceRect.left
            posY = rect.top - sourceRect.top
            if (this.#clip) {
                posX -= this.#clip.x
                posY -= this.#clip.y
            }
            width = rect.width
            height = rect.height
        }

        const scaleFactor = el.classList?.contains('lgs-widget-canvas') ? LGS_WIDGET_SCALE_FACTOR : 1
        const cssScale = typeof scale === 'object' ? (scale.x ?? 1) : scale

        // Base logical dimensions (normalized only by the internal buffer factor)
        const baseContentW = contentWidth || (width / scaleFactor)
        const baseContentH = contentHeight || (height / scaleFactor)

        // The pivot must be the logical center of the element in the final layout
        const cx = posX + shadowMargins.left + baseContentW / 2
        const cy = posY + shadowMargins.top + baseContentH / 2

        this.#overlays.push({
                                element,
                                cx, cy,
                                w:             width / scaleFactor,
                                h:             height / scaleFactor,
                                contentWidth:  baseContentW,
                                contentHeight: baseContentH,
                                blur,
                                radius, // Stored as logical pixels
                                rotate,
                                scale:         cssScale,
                                shadowMargins,
                            })

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

        drawMainSource()

        for (const overlay of this.#overlays) {
            const el = typeof overlay.element === 'function' ? overlay.element() : overlay.element
            if (!el) {
                continue
            }

            const rad = (overlay.rotate * Math.PI) / 180
            const hw = overlay.contentWidth / 2
            const hh = overlay.contentHeight / 2

            // Backdrop Blur
            if (overlay.blur > 0) {
                ctx.save()
                ctx.translate(overlay.cx, overlay.cy)
                ctx.rotate(rad)
                ctx.scale(overlay.scale, overlay.scale)

                this.#traceRoundedRect(ctx, -hw, -hh, overlay.contentWidth, overlay.contentHeight, overlay.radius)
                ctx.clip()

                ctx.resetTransform()
                ctx.scale(this.#dpr, this.#dpr)
                ctx.filter = `blur(${overlay.blur}px)`
                drawMainSource()

                ctx.restore()
            }

            ctx.save()
            ctx.translate(overlay.cx, overlay.cy)
            ctx.rotate(rad)
            ctx.scale(overlay.scale, overlay.scale)

            // DEBUG: The red border now perfectly matches the scaled radius
            ctx.strokeStyle = 'red'
            ctx.lineWidth = 1 / overlay.scale
            this.#traceRoundedRect(ctx, -hw, -hh, overlay.contentWidth, overlay.contentHeight, overlay.radius)
            ctx.stroke()

            this.#drawSnapshotAligned(ctx, el, overlay, hw, hh)
            ctx.restore()
        }
    }

    #drawSnapshotAligned(ctx, el, overlay, hw, hh) {
        // Position relative to the pivot. shadowMargins are base logical pixels.
        const dx = -hw - overlay.shadowMargins.left
        const dy = -hh - overlay.shadowMargins.top

        ctx.drawImage(
            el,
            0, 0, el.width, el.height,
            dx, dy, overlay.w, overlay.h,
        )
    }

    #loop = () => {
        this.#draw()
        this.#raf = requestAnimationFrame(this.#loop)
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