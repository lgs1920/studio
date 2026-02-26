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
 * Moteur de composition haute performance avec gestion du Backdrop Blur dynamique.
 * Optimisé pour limiter la pression sur le Garbage Collector via le pré-calcul des constantes.
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

    // Cache des coordonnées source pour éviter l'instanciation d'objets dans la boucle
    #srcRect = {x: 0, y: 0, w: 0, h: 0}

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
        this.#computeSourceRect()
        this.#resizeOutputCanvas()
        this.#loop()
    }

    #updateSourceDpr = () => {
        const rect = this.#sourceCanvas.getBoundingClientRect()
        this.#sourceDpr = rect.width > 0 ? this.#sourceCanvas.width / rect.width : 1
    }

    #computeSourceRect = () => {
        if (this.#clip) {
            this.#srcRect.x = this.#clip.x * this.#sourceDpr
            this.#srcRect.y = this.#clip.y * this.#sourceDpr
            this.#srcRect.w = this.#clip.width * this.#sourceDpr
            this.#srcRect.h = this.#clip.height * this.#sourceDpr
        }
        else {
            this.#srcRect.x = 0
            this.#srcRect.y = 0
            this.#srcRect.w = this.#sourceCanvas.width
            this.#srcRect.h = this.#sourceCanvas.height
        }
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
        const elGetter = typeof element === 'function' ? element : () => element
        const initialEl = elGetter()
        if (!initialEl) {
            return
        }

        const {
                  x, y, w, h,
                  contentWidth, contentHeight,
                  blur          = 0,
                  radius        = 0,
                  rotate        = 0,
                  scale         = 1,
                  zIndex = 0,
                  shadowMargins = {top: 0, right: 0, bottom: 0, left: 0},
              } = options

        const elRect = initialEl.getBoundingClientRect ? initialEl.getBoundingClientRect() : null
        const hasNumericWidth = typeof initialEl.width === 'number'

        const elDpr = elRect && elRect.width > 0 && hasNumericWidth ? (initialEl.width / elRect.width) : 1
        const elLogicalWidth = hasNumericWidth ? (initialEl.width / elDpr) : (elRect?.width ?? 0)

        let posX, posY, rawWidth, rawHeight

        if (typeof x === 'number' && typeof y === 'number') {
            posX = x
            posY = y
            rawWidth = w ?? elLogicalWidth
            rawHeight = h ?? (elRect?.height ?? 0)
        }
        else {
            const sourceRect = this.#sourceCanvas.getBoundingClientRect()
            posX = elRect.left - sourceRect.left
            posY = elRect.top - sourceRect.top
            if (this.#clip) {
                posX -= this.#clip.x
                posY -= this.#clip.y
            }
            rawWidth = elRect.width
            rawHeight = elRect.height
        }

        const scaleFactor = LGS_WIDGET_SCALE_EFFECTIVE
        const imgAspectRatio = initialEl.height / initialEl.width
        const cssScale = typeof scale === 'object' ? (scale.x ?? 1) : scale

        const logicalContentW = typeof contentWidth === 'number' ? contentWidth : (rawWidth / scaleFactor)
        const logicalContentH = typeof contentHeight === 'number' ? contentHeight : ((rawHeight ?? (logicalContentW * imgAspectRatio)) / scaleFactor)

        const totalW = logicalContentW + (shadowMargins.left + shadowMargins.right)
        const totalH = logicalContentH + (shadowMargins.top + shadowMargins.bottom)

        // Stockage des constantes pré-calculées pour éviter les calculs en boucle
        this.#overlays.push({
                                getElement: elGetter,
                                cx:         posX + totalW / 2,
                                cy:         posY + totalH / 2,
                                w:             totalW,
                                h:             totalH,
                                contentWidth:  logicalContentW,
                                contentHeight: logicalContentH,
                                blur,
                                radius,
                                rad:        (rotate * Math.PI) / 180,
                                scale:         cssScale,
                                zIndex,
                                dx:         -(logicalContentW / 2) - shadowMargins.left,
                                dy:         -(logicalContentH / 2) - shadowMargins.top,
                            })
    }

    #draw = () => {
        this.#flushWebGLBuffer?.()

        const ctx = this.#ctx
        const dpr = this.#dpr
        const physW = this.#outputCanvas.width
        const physH = this.#outputCanvas.height

        ctx.clearRect(0, 0, this.#outW, this.#outH)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, this.#outW, this.#outH)

        // Rendu de la source principale
        ctx.drawImage(
            this.#sourceCanvas,
            this.#srcRect.x, this.#srcRect.y, this.#srcRect.w, this.#srcRect.h,
            0, 0, this.#outW, this.#outH,
        )

        const len = this.#overlays.length
        for (let i = 0; i < len; i++) {
            const overlay = this.#overlays[i]
            const el = overlay.getElement()
            if (!el) {
                continue
            }

            const hw = overlay.contentWidth / 2
            const hh = overlay.contentHeight / 2

            if (overlay.blur > 0) {
                // PASSAGE BACKDROP BLUR
                ctx.save()

                // 1. Transformation en espace logique pour tracer le chemin
                ctx.translate(overlay.cx, overlay.cy)
                ctx.rotate(overlay.rad)
                ctx.scale(overlay.scale, overlay.scale)

                this.#traceRoundedRect(ctx, -hw, -hh, overlay.contentWidth, overlay.contentHeight, overlay.radius)

                // 2. CLIP IMMEDIAT : Fixe le masque avant le reset de la matrice
                ctx.clip()

                // 3. Reset vers référentiel physique pour l'échantillonnage du buffer
                const totalScale = overlay.scale * dpr
                ctx.setTransform(1, 0, 0, 1, 0, 0)

                // 4. Calibration du flou sur les pixels physiques
                ctx.filter = `blur(${overlay.blur * totalScale}px)`

                // 5. Injection du buffer flouté dans le masque
                ctx.drawImage(this.#outputCanvas, 0, 0, physW, physH, 0, 0, physW, physH)

                ctx.restore()

                // Reset pour le rendu du contenu
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            }

            // PASSAGE CONTENT
            ctx.save()
            ctx.translate(overlay.cx, overlay.cy)
            ctx.rotate(overlay.rad)
            ctx.scale(overlay.scale, overlay.scale)

            ctx.drawImage(
                el,
                0, 0, el.width, el.height,
                overlay.dx, overlay.dy, overlay.w, overlay.h,
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