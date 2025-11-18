/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-18
 * Last modified: 2025-11-18
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * CanvasOverlayComposer – clean, robust, Cesium-agnostic compositor
 *
 * Usage:
 *   new CanvasOverlayComposer(lgs.canvas, {
 *     clip: { x, y, width, height },
 *     width: 1920,
 *     height: 1080,
 *     flushWebGLBuffer: () => viewer.scene.render()
 *   })
 */
export class CanvasOverlayComposer {
    #sourceCanvas
    #outputCanvas
    #ctx
    #outW
    #outH
    #clip = null
    #overlays = []
    #raf = null
    #dpr = window.devicePixelRatio || 1
    #flushWebGLBuffer = null

    /**
     * @param {HTMLCanvasElement} sourceCanvas                     Required – main source (WebGL or 2D)
     * @param {Object} [options={}]
     * @param {{x?: number, y?: number, width?: number, height?: number}|null} [options.clip=null]
     * @param {number|null} [options.width=null]                   Logical output width
     * @param {number|null} [options.height=null]                  Logical output height
     * @param {(() => void)|null} [options.flushWebGLBuffer=null] Executed before each draw to flush the buffer
     */
    constructor(sourceCanvas, options = {}) {
        if (!sourceCanvas || !(sourceCanvas instanceof HTMLCanvasElement)) {
            throw new Error('CanvasOverlayComposer: sourceCanvas is required and must be an HTMLCanvasElement')
        }

        this.#sourceCanvas = sourceCanvas

        const {
                  clip             = null,
                  width            = null,
                  height           = null,
                  flushWebGLBuffer = null,
              } = options

        this.#clip = clip ? {...clip} : null
        this.#flushWebGLBuffer = typeof flushWebGLBuffer === 'function' ? flushWebGLBuffer : null

        // Resolve output size (logical pixels)
        this.#outW = width ?? this.#clip?.width ?? sourceCanvas.clientWidth ?? sourceCanvas.width
        this.#outH = height ?? this.#clip?.height ?? sourceCanvas.clientHeight ?? sourceCanvas.height

        this.#outputCanvas = document.createElement('canvas')
        this.#ctx = this.#outputCanvas.getContext('2d', {alpha: false})

        this.#resizeAndScale()
        this.#draw()
        this.#loop()
    }

    #resizeAndScale = () => {
        this.#outputCanvas.width = Math.round(this.#outW * this.#dpr)
        this.#outputCanvas.height = Math.round(this.#outH * this.#dpr)
        this.#outputCanvas.style.width = `${this.#outW}px`
        this.#outputCanvas.style.height = `${this.#outH}px`
        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    }

    /** @returns {HTMLCanvasElement} */
    getCanvas = () => this.#outputCanvas

    /**
     * Add an overlay – auto-detect position & size if not provided
     */
    addOverlay = (element, x, y, w, h) => {
        let lx = x
        let ly = y

        if (lx === undefined || ly === undefined) {
            const rect = element.getBoundingClientRect()
            lx = rect.left / this.#dpr
            ly = rect.top / this.#dpr
        }

        const lw = w ?? (element.width ?? element.videoWidth ?? element.clientWidth ?? 0) / LGS_WIDGET_SCALE_FACTOR
        const lh = h ?? (element.height ?? element.videoHeight ?? element.clientHeight ?? 0) / LGS_WIDGET_SCALE_FACTOR

        this.#overlays.push({element, x: Number(lx), y: Number(ly), w: lw, h: lh})
        this.#draw()
    }

    clearOverlays = () => {
        this.#overlays = []
        this.#draw()
    }

    #draw = () => {
        // Critical: allow Cesium/Three.js/etc. to flush their WebGL buffer
        this.#flushWebGLBuffer?.()

        const ctx = this.#ctx
        const w = this.#outW
        const h = this.#outH

        ctx.clearRect(0, 0, w, h)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, w, h)

        // Main source – clip in physical pixels
        const physicalClip = this.#clip
                             ? {
                x:      this.#clip.x * this.#dpr,
                y:      this.#clip.y * this.#dpr,
                width:  this.#clip.width * this.#dpr,
                height: this.#clip.height * this.#dpr,
            }
                             : {
                x:      0,
                y:      0,
                width:  this.#sourceCanvas.width,
                height: this.#sourceCanvas.height,
            }

        ctx.drawImage(
            this.#sourceCanvas,
            physicalClip.x,
            physicalClip.y,
            physicalClip.width,
            physicalClip.height,
            0,
            0,
            w,
            h,
        )

        // Overlays
        this.#overlays.forEach(o => ctx.drawImage(o.element, o.x, o.y, o.w, o.h))
    }

    #loop = () => {
        this.#draw()
        this.#raf = requestAnimationFrame(this.#loop)
    }

    setSize = (width, height) => {
        this.#outW = width
        this.#outH = height
        this.#resizeAndScale()
        this.#draw()
    }

    dispose = () => {
        if (this.#raf) {
            cancelAnimationFrame(this.#raf)
        }
        this.#raf = null
        this.#flushWebGLBuffer = null
        this.#overlays = []
    }
}