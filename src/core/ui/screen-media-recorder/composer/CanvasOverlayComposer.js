/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-18
 * Last modified: 2026-01-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * CanvasOverlayComposer – Lightweight 2D compositor for HiDPI environments
 * Handles backdrop blur and rounded corners clipping for overlays.
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
                  clip  = null,
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
     * Adds an overlay with support for blur and rounded corners
     * @param {HTMLElement|(() => HTMLElement)} element
     * @param {Object} options
     * @param {number} [options.blur=0]
     * @param {number} [options.radius=0]
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
            width = w ?? el.width ?? el.videoWidth ?? el.clientWidth ?? 0
            height = h ?? el.height ?? el.videoHeight ?? el.clientHeight ?? 0
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

        // posX, posY is the position of the widget content (without shadow)
        // contentW, contentH are the real content dimensions (without shadow)

        const actualContentW = contentW || (width / scaleFactor)
        const actualContentH = contentH || (height / scaleFactor)

        // Calculate center based on content dimensions
        const cx = posX + actualContentW / 2
        const cy = posY + actualContentH / 2

        console.log('addOverlay center calc:', {
            posX, posY,
            canvasSize:  {w: width, h: height},
            contentSize: {w: actualContentW, h: actualContentH},
            center:      {cx, cy},
        })

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
                                scale:    cssScale,
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
            console.log(o)
            const el = typeof o.element === 'function' ? o.element() : o.element
            if (!el) {
                continue
            }

            const rad = (o.rotate * Math.PI) / 180

            // Get the actual canvas dimensions (includes shadow)
            const canvasW = el.width || o.w
            const canvasH = el.height || o.h

            // If blur is needed, we must clip a blurred version of the background underneath
            if (o.blur > 0) {
                ctx.save()

                // --- Step A: Define the mask in widget-space ---
                ctx.translate(o.cx, o.cy)
                ctx.rotate(rad)
                ctx.scale(o.scale, o.scale)

                ctx.beginPath()
                const hw = o.contentW / 2
                const hh = o.contentH / 2

                if (o.radius > 0) {
                    ctx.roundRect(-hw, -hh, o.contentW, o.contentH, o.radius)
                }
                else {
                    ctx.rect(-hw, -hh, o.contentW, o.contentH)
                }
                ctx.clip() // The mask is now locked in! 🔒

                // --- Step B: Reset transformation to draw the background correctly ---
                // We go back to the base DPR scale so (0,0) is top-left of the whole canvas
                ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)

                ctx.filter = `blur(${o.blur}px)`
                drawMainSource() // Now this draws at the correct screen position

                ctx.restore() // Cleans up the clip and the filter
            }

            // Draw the canvas at its position with rotation and scale
            ctx.save()
            ctx.translate(o.cx, o.cy)
            ctx.rotate(rad)
            ctx.scale(o.scale, o.scale)

            // The canvas includes shadow, so offset to center the content
            const offsetX = -o.contentW / 2 - o.shadowMargins.left
            const offsetY = -o.contentH / 2 - o.shadowMargins.top

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