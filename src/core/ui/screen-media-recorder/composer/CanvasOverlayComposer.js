/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-03
 * Last modified: 2026-01-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * CanvasOverlayComposer – Lightweight 2D compositor for HiDPI environments
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
     */
    addOverlay = (element, options = {}) => {
        const el = typeof element === 'function' ? element() : element
        if (!el) {
            return
        }

        const {x, y, w, h, blur = 0, radius = 0} = options
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

        this.#overlays.push({
                                element,
                                x: posX,
                                y: posY,
                                w: width / scaleFactor,
                                h: height / scaleFactor,
                                blur:   blur,
                                radius: radius,
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

        drawMainSource()

        for (const o of this.#overlays) {
            const el = typeof o.element === 'function' ? o.element() : o.element
            if (!el) {
                continue
            }

            const hasEffect = o.blur > 0 || o.radius > 0

            if (hasEffect) {
                ctx.save()
                ctx.beginPath()
                // Use roundRect for masking (works for circle if radius is 50%)
                if (o.radius > 0) {
                    ctx.roundRect(o.x, o.y, o.w, o.h, o.radius)
                }
                else {
                    ctx.rect(o.x, o.y, o.w, o.h)
                }
                ctx.clip()

                if (o.blur > 0) {
                    ctx.filter = `blur(${o.blur}px)`
                    drawMainSource()
                    ctx.filter = 'none'
                }
            }

            ctx.drawImage(el, o.x, o.y, o.w, o.h)

            if (hasEffect) {
                ctx.restore()
            }
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