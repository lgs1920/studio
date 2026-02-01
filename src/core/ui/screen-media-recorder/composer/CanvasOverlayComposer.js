/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-01
 * Last modified: 2026-02-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_EFFECTIVE } from '@Core/constants'

// Build Metadata
// Generated on: 2026-01-20 23:45:10
// Build ID: LGS-COMP-20260120-2345-H01-FINAL

/**
 * CanvasOverlayComposer
 * Version H01: Focus sur le respect du ratio d'aspect et la précision du tracé d'arc.
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
                  border = 0,
                  shadowMargins = {top: 0, right: 0, bottom: 0, left: 0},
              } = options

        const elRect = el.getBoundingClientRect ? el.getBoundingClientRect() : null
        const hasNumericWidth = typeof el.width === 'number'
        const hasNumericHeight = typeof el.height === 'number'
        const elDpr = elRect && elRect.width > 0 && hasNumericWidth ? (el.width / elRect.width) : 1
        const elLogicalWidth = hasNumericWidth ? (el.width / elDpr) : (elRect?.width ?? 0)
        const elLogicalHeight = hasNumericHeight ? (el.height / elDpr) : (elRect?.height ?? 0)

        let posX, posY, rawWidth, rawHeight

        if (typeof x === 'number' && typeof y === 'number') {
            posX = x
            posY = y
            rawWidth = w ?? elLogicalWidth
            rawHeight = h ?? elLogicalHeight
        }
        else {
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
        // The content dimensions in logical pixel
        const logicalContentW = typeof contentWidth === 'number'
                                ? contentWidth
                                : (rawWidth / scaleFactor)
        const logicalContentH = typeof contentHeight === 'number'
                                ? contentHeight
                                : ((rawHeight ?? (logicalContentW * imgAspectRatio)) / scaleFactor)

        // Apply the shadow margins.
        const totalW = logicalContentW + (shadowMargins.left + shadowMargins.right)
        const totalH = logicalContentH + (shadowMargins.top + shadowMargins.bottom)

        // Pivot centered on the full box (content + shadows)
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
                                border,
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
            const radius = Math.max(0, Math.min(overlay.radius * overlay.scale, hw, hh))

            ctx.save()
            ctx.translate(overlay.cx, overlay.cy)
            ctx.rotate(rad)
            const viewScale = overlay.scale
            ctx.scale(viewScale, viewScale)

            // Backdrop Blur
            if (overlay.blur > 0) {
                ctx.save()
                this.#traceRoundedRect(ctx,
                                       -hw, -hh,
                                       overlay.contentWidth,
                                       overlay.contentHeight,
                                       radius)
                ctx.clip()

                ctx.resetTransform()
                ctx.scale(this.#dpr, this.#dpr)
                ctx.filter = `blur(${overlay.blur * this.#dpr}px)`
                drawMainSource()
                ctx.restore()
            }

            // Debug Border
            ctx.strokeStyle = 'red'
            ctx.lineWidth = 1 / overlay.scale
            // this.#traceRoundedRect(ctx,
            //                        -hw, -hh,
            //                        overlay.contentWidth,
            //                        overlay.contentHeight,
            //                        radius)
            //ctx.stroke()

            // Snapshot
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
