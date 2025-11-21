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
 * CanvasOverlayComposer – 2D compositor ultra-léger (Cesium / Three.js / video)
 * Garantit une image complète même quand le canvas source est affiché en 1/4
 */
export class CanvasOverlayComposer {
    /** Canvas source principal (Cesium, Three.js, <video>, …) */
    #sourceCanvas

    /** Canvas de sortie composite */
    #outputCanvas

    /** Contexte 2D du canvas de sortie */
    #ctx

    /** Largeur logique souhaitée de sortie (ex: 1920) */
    #outW = 1920

    /** Hauteur logique souhaitée de sortie (ex: 1080) */
    #outH = 1080

    /** Clip éventuel exprimé en pixels logiques du canvas source */
    #clip = null

    /** Overlays à dessiner par-dessus */
    #overlays = []

    /** Handle requestAnimationFrame */
    #raf = null

    /** DPR de la page */
    #dpr = window.devicePixelRatio || 1

    /** DPR réel du canvas source – recalculé chaque frame (critique) */
    #sourceDpr = 1

    /** Callback pour forcer le flush WebGL (Cesium) */
    #flushWebGLBuffer = null

    /**
     * @param {HTMLCanvasElement} sourceCanvas                    Canvas source
     * @param {Object} [options={}]
     * @param {{x?:number,y?:number,width?:number,height?:number}|null} [options.clip=null]
     * @param {number} [options.width=1920]                       Largeur logique de sortie
     * @param {number} [options.height=1080]                      Hauteur logique de sortie
     * @param {(() => void)|null} [options.flushWebGLBuffer=null]
     */
    constructor(sourceCanvas, options = {}) {
        if (!(sourceCanvas instanceof HTMLCanvasElement)) {
            throw new Error('CanvasOverlayComposer: sourceCanvas must be an HTMLCanvasElement')
        }

        this.#sourceCanvas = sourceCanvas

        const {
                  clip   = null,
                  width  = 1920,
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

    /** Recalcule le DPR réel du canvas source (peut changer à chaque frame avec Cesium) */
    #updateSourceDpr = () => {
        const rect = this.#sourceCanvas.getBoundingClientRect()
        this.#sourceDpr = rect.width > 0 ? this.#sourceCanvas.width / rect.width : 1
    }

    /** Redimensionne le canvas de sortie selon le DPR de la page */
    #resizeOutputCanvas = () => {
        const physicalW = Math.round(this.#outW * this.#dpr)
        const physicalH = Math.round(this.#outH * this.#dpr)

        this.#outputCanvas.width = physicalW
        this.#outputCanvas.height = physicalH
        this.#outputCanvas.style.width = `${this.#outW}px`
        this.#outputCanvas.style.height = `${this.#outH}px`

        this.#ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    }

    /** @returns {HTMLCanvasElement} Canvas final prêt pour MediaRecorder / WebRTC */
    getCanvas = () => this.#outputCanvas

    /**
     * Ajoute un overlay
     */
    addOverlay = (element, x, y, w, h) => {
        const el = typeof element === 'function' ? element() : element

        let lx = x
        let ly = y

        if (lx === undefined || ly === undefined) {
            const rect = el.getBoundingClientRect()
            const sourceRect = this.#sourceCanvas.getBoundingClientRect()
            lx = rect.left - sourceRect.left
            ly = rect.top - sourceRect.top
            if (this.#clip) {
                lx -= this.#clip.x
                ly -= this.#clip.y
            }
        }

        const lw = w ?? el.width ?? el.videoWidth ?? el.clientWidth ?? 0
        const lh = h ?? el.height ?? el.videoHeight ?? el.clientHeight ?? 0
        const scaleFactor = el.classList?.contains('lgs-widget-canvas') ? LGS_WIDGET_SCALE_FACTOR : 1

        this.#overlays.push({
                                element,
                                x: Number(lx),
                                y: Number(ly),
                                w: lw / scaleFactor,
                                h: lh / scaleFactor,
                            })

        this.#draw()
    }

    clearOverlays = () => {
        this.#overlays = []
        this.#draw()
    }

    /** Dessine une frame complète */
    #draw = () => {
        this.#flushWebGLBuffer?.()
        this.#updateSourceDpr() // Indispensable à chaque frame

        const ctx = this.#ctx

        // Fond noir propre
        ctx.clearRect(0, 0, this.#outW, this.#outH)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, this.#outW, this.#outH)

        // --- Source principale (calcul 100 % en pixels physiques) ---
        let srcX = 0
        let srcY = 0
        let srcW = this.#sourceCanvas.width
        let srcH = this.#sourceCanvas.height

        if (this.#clip) {
            srcX = this.#clip.x * this.#sourceDpr
            srcY = this.#clip.y * this.#sourceDpr
            srcW = this.#clip.width * this.#sourceDpr
            srcH = this.#clip.height * this.#sourceDpr
        }

        ctx.drawImage(
            this.#sourceCanvas,
            srcX, srcY, srcW, srcH,     // rectangle source en pixels physiques
            0, 0, this.#outW, this.#outH, // destination logique
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

    /** Change la résolution de sortie à la volée */
    setSize = (width, height) => {
        this.#outW = width
        this.#outH = height
        this.#resizeOutputCanvas()
        this.#draw()
    }

    /** À appeler impérativement au resize de la fenêtre */
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