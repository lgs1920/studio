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
     * @param {Object} [options.clip] - Source clipping area {x, y, width, height}
     * @param {number} [options.width=1920] - Logical output width
     * @param {number} [options.height=1080] - Logical output height
     * @param {Function} [options.flushWebGLBuffer] - WebGL synchronization callback
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

    /**
     * Updates the source DPR based on the physical/CSS ratio of the source canvas
     * @private
     */
    #updateSourceDpr = () => {
        const rect = this.#sourceCanvas.getBoundingClientRect()
        this.#sourceDpr = rect.width > 0 ? this.#sourceCanvas.width / rect.width : 1
    }

    /**
     * Adjusts the output canvas buffer size for HiDPI displays
     * @private
     */
    #resizeOutputCanvas = () => {
        const physicalW = Math.round(this.#outW * this.#dpr)
        const physicalH = Math.round(this.#outH * this.#dpr)

        this.#outputCanvas.width = physicalW
        this.#outputCanvas.height = physicalH
        this.#outputCanvas.style.width = `${this.#outW}px`
        this.#outputCanvas.style.height = `${this.#outH}px`

        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    }

    /**
     * @returns {HTMLCanvasElement} The result canvas element
     */
    getCanvas = () => this.#outputCanvas

    /**
     * Adds an overlay to the rendering stack and computes its transformation metadata.
     * @param {HTMLElement|(() => HTMLElement)} element - The source element (Canvas, Video, or Image) or a function
     *     returning it.
     * @param {Object} [options={}] - Configuration for positioning and effects.
     * @param {number} [options.x] - Custom logical X position. If omitted, calculated via getBoundingClientRect.
     * @param {number} [options.y] - Custom logical Y position. If omitted, calculated via getBoundingClientRect.
     * @param {number} [options.w] - Custom logical width of the full buffer (including shadows).
     * @param {number} [options.h] - Custom logical height of the full buffer (including shadows).
     * @param {number} [options.contentW] - The explicit width of the UI component area (excluding shadows).
     * @param {number} [options.contentH] - The explicit height of the UI component area (excluding shadows).
     * @param {number} [options.blur=0] - Backdrop blur radius in pixels.
     * @param {number} [options.borderWidth=0] - Uniform border thickness in logical pixels.
     * @param {number} [options.radius=0] - Corner radius in pixels (relative to buffer resolution).
     * @param {number} [options.rotate=0] - Rotation in degrees.
     * @param {number|Object} [options.scale=1] - Transform scale factor.
     * @param {Object} [options.shadowMargins] - Padding around content for shadow rendering.
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
                  borderWidth = 0,
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

        const isWidget = el.classList?.contains('lgs-widget-canvas')
        const scaleFactor = isWidget ? LGS_WIDGET_SCALE_FACTOR : 1
        const cssScale = typeof scale === 'object' ? (scale.x ?? 1) : scale

        const actualContentW = contentW || (width / scaleFactor)
        const actualContentH = contentH || (height / scaleFactor)

        // The pivot point is the center of the UI component area
        const contentPosX = posX + shadowMargins.left
        const contentPosY = posY + shadowMargins.top
        const cx = contentPosX + actualContentW / 2
        const cy = contentPosY + actualContentH / 2

        this.#overlays.push({
                                element,
                                cx, cy,
                                w: width / scaleFactor,
                                h: height / scaleFactor,
                                contentW: actualContentW,
                                contentH: actualContentH,
                                blur,
                                borderWidth,
                                radius,
                                rotate,
                                scale: cssScale,
                                scaleFactor,
                                shadowMargins,
                            })

        this.#draw()
    }

    /**
     * Removes all overlays and refreshes display
     */
    clearOverlays = () => {
        this.#overlays = []
        this.#draw()
    }

    /**
     * Core rendering process
     * @private
     */
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

        // 1. Draw background source
        drawMainSource()

        // 2. Process overlays
        for (const o of this.#overlays) {
            const el = typeof o.element === 'function' ? o.element() : o.element
            if (!el) {
                continue
            }

            const rad = (o.rotate * Math.PI) / 180

            // Apply Backdrop Blur with Border awareness
            if (o.blur > 0) {
                ctx.save()
                ctx.translate(o.cx, o.cy)
                ctx.rotate(rad)
                ctx.scale(o.scale, o.scale)

                ctx.beginPath()

                // Inset the mask by (borderWidth + anti-aliasing safety)
                // to prevent blur bleeding under or outside the borders.
                const inset = 0.5 + o.borderWidth * o.scale
                const hw = Math.max(0, (o.contentW / 2) - inset)
                const hh = Math.max(0, (o.contentH / 2) - inset)

                // Radius must be normalized to logical geometry (scaleFactor) and reduced by inset
                const r = Math.max(0, (o.radius / o.scaleFactor) * o.scale - inset)

                if (r > 0) {
                    ctx.roundRect(-hw, -hh, hw * 2, hh * 2, r)
                }
                else {
                    ctx.rect(-hw, -hh, hw * 2, hh * 2)
                }
                ctx.clip()

                // Draw blurred background inside the mask
                ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
                ctx.filter = `blur(${o.blur}px)`
                drawMainSource()
                ctx.restore()
            }

            // Draw Overlay Element
            ctx.save()
            ctx.translate(o.cx, o.cy)
            ctx.rotate(rad)
            ctx.scale(o.scale, o.scale)

            // Content mapping: origin (0,0) is centered on the content box
            const contentCenterInCanvasX = o.shadowMargins.left + o.contentW / 2
            const contentCenterInCanvasY = o.shadowMargins.top + o.contentH / 2

            const offsetX = -contentCenterInCanvasX
            const offsetY = -contentCenterInCanvasY

            ctx.drawImage(el, offsetX, offsetY, o.w, o.h)
            ctx.restore()
        }
    }

    /**
     * Animation loop
     * @private
     */
    #loop = () => {
        this.#draw()
        this.#raf = requestAnimationFrame(this.#loop)
    }

    /**
     * Updates logical resolution
     * @param {number} width
     * @param {number} height
     */
    setSize = (width, height) => {
        this.#outW = width
        this.#outH = height
        this.#resizeOutputCanvas()
        this.#draw()
    }

    /**
     * Refreshes scaling on window resize
     */
    handleResize = () => {
        this.#resizeOutputCanvas()
        this.#draw()
    }

    /**
     * Cleanup resources
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