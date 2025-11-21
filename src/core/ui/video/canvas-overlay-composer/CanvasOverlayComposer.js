/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-21
 * Last modified: 2025-11-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * CanvasOverlayComposer – Compositeur 2D ultra-léger
 * Fonctionne parfaitement avec Cesium/Three.js/video en HiDPI
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
     * Ajoute un overlay – position et taille corrigées automatiquement en HiDPI
     */
    addOverlay = (element, x, y, w, h) => {
        const el = typeof element === 'function' ? element() : element
        if (!el) {
            return
        }

        let posX, posY, width, height

        // Si position manuelle fournie → on l'utilise directement (déjà en pixels logiques)
        if (typeof x === 'number' && typeof y === 'number') {
            posX = x
            posY = y
            width = w ?? el.width ?? el.videoWidth ?? el.clientWidth ?? 0
            height = h ?? el.height ?? el.videoHeight ?? el.clientHeight ?? 0
        }
        else {
            // Auto-détection via getBoundingClientRect → on est en CSS pixels
            const rect = el.getBoundingClientRect()
            const sourceRect = this.#sourceCanvas.getBoundingClientRect()

            // Conversion CSS pixels → logical pixels (en tenant compte du DPR du canvas source)
            const cssX = rect.left - sourceRect.left
            const cssY = rect.top - sourceRect.top

            posX = cssX * this.#sourceDpr
            posY = cssY * this.#sourceDpr

            // Taille physique de l'élément
            width = rect.width * this.#sourceDpr
            height = rect.height * this.#sourceDpr

            // Ajustement clip
            if (this.#clip) {
                posX -= this.#clip.x
                posY -= this.#clip.y
            }
        }

        // Facteur d'échelle pour les widgets LGS rendus en haute résolution
        const scaleFactor = el.classList?.contains('lgs-widget-canvas') ? LGS_WIDGET_SCALE_FACTOR : 1

        this.#overlays.push({
                                element,
                                x: posX,
                                y: posY,
                                w: width / scaleFactor,
                                h: height / scaleFactor,
                            })

        this.#draw()
    }

    clearOverlays = () => {
        this.#overlays = []
        this.#draw()
    }

    #draw = () => {
        this.#flushWebGLBuffer?.()
        this.#updateSourceDpr()

        const ctx = this.#ctx

        ctx.clearRect(0, 0, this.#outW, this.#outH)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, this.#outW, this.#outH)

        // --- Source principale ---
        let srcX = 0, srcY = 0, srcW = this.#sourceCanvas.width, srcH = this.#sourceCanvas.height

        if (this.#clip) {
            srcX = this.#clip.x * this.#sourceDpr
            srcY = this.#clip.y * this.#sourceDpr
            srcW = this.#clip.width * this.#sourceDpr
            srcH = this.#clip.height * this.#sourceDpr
        }

        ctx.drawImage(
            this.#sourceCanvas,
            srcX, srcY, srcW, srcH,
            0, 0, this.#outW, this.#outH,
        )

        // --- Overlays ---
        for (const o of this.#overlays) {
            const el = typeof o.element === 'function' ? o.element() : o.element
            if (el) {
                ctx.drawImage(el, o.x, o.y, o.w, o.h)
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