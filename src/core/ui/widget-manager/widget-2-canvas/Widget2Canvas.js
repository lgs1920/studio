/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget2Canvas.js
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

import { DYNAMIC_WIDGET_PART, STATIC_WIDGET_PART } from '@Core/constants'
import { snapdom }                                 from '@zumer/snapdom'

/**
 * Widget2Canvas — Ultra-fast DOM-to-canvas mirror
 * Correctly handles HiDPI scales and prevents edge truncation.
 */
export class Widget2Canvas {
    #original = null
    #canvas = null
    #options = {}
    #pendingRefresh = false

    constructor(target, options = {}) {
        if (!target || !(target instanceof HTMLElement)) {
            return
        }

        this.#original = target
        this.#options = {
            scale: window.devicePixelRatio || 1,
            ...options,
        }

        const observer = new MutationObserver((mutations) => {
            if (!mutations.length || this.#pendingRefresh) {
                return
            }

            this.#pendingRefresh = true
            requestAnimationFrame(async () => {
                const relevant = mutations.some(m => m.target.classList?.contains(DYNAMIC_WIDGET_PART))

                // Refresh everything to ensure correct layering
                await this.refresh()
                this.#pendingRefresh = false
            })
        })

        observer.observe(target, {
            childList:  true,
            subtree:    true,
            attributes: true,
            characterData: true,
        })
    }

    init = async () => {
        await this.refresh()
    }

    /**
     * Main refresh logic. Composites all widget parts into a single canvas.
     */
    refresh = async () => {
        const staticParts = this.#original?.querySelectorAll(`.${STATIC_WIDGET_PART}`)
        const dynamicParts = this.#original?.querySelectorAll(`.${DYNAMIC_WIDGET_PART}`)

        // If no parts defined, render the whole element
        if ((!staticParts || staticParts.length === 0) && (!dynamicParts || dynamicParts.length === 0)) {
            const fullCanvas = await this.#renderPart(this.#original)
            this.#updateCanvas(fullCanvas)
            return
        }

        // Create a composition buffer
        const buffer = document.createElement('canvas')
        const logicalW = this.#original.offsetWidth
        const logicalH = this.#original.offsetHeight

        buffer.width = Math.ceil(logicalW * this.#options.scale)
        buffer.height = Math.ceil(logicalH * this.#options.scale)
        const ctx = buffer.getContext('2d')

        const allParts = [...(staticParts || []), ...(dynamicParts || [])]

        for (const el of allParts) {
            const partCanvas = await this.#renderPart(el)
            const rect = el.getBoundingClientRect()
            const parentRect = this.#original.getBoundingClientRect()

            // Calculate relative position within the widget
            const dx = (rect.left - parentRect.left) * this.#options.scale
            const dy = (rect.top - parentRect.top) * this.#options.scale

            ctx.drawImage(partCanvas, dx, dy)
        }

        this.#updateCanvas(buffer)
    }

    #elementToCanvasSource = async (el, options = {}) => {
        if (el instanceof SVGElement) {
            const style = getComputedStyle(el)
            // Ensure SVG has intrinsic dimensions
            if (!el.getAttribute('width')) {
                el.setAttribute('width', el.clientWidth || style.width)
            }
            if (!el.getAttribute('height')) {
                el.setAttribute('height', el.clientHeight || style.height)
            }

            const xml = new XMLSerializer().serializeToString(el)
            const img = new Image()
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

            await img.decode()
            return img
        }
        return await snapdom.toCanvas(el, options)
    }

    #renderPart = async (el) => {
        let target = el
        if (!(el instanceof SVGElement) && this.#options.type === 'svg') {
            const childSvg = el.querySelector('svg')
            if (childSvg) {
                target = childSvg
            }
        }
        return await this.#elementToCanvasSource(target, this.#options)
    }

    /**
     * Updates the visible canvas while maintaining HiDPI consistency.
     * @param {HTMLCanvasElement|HTMLImageElement} source
     */
    #updateCanvas = (source) => {
        const newCanvas = document.createElement('canvas')
        const scale = this.#options.scale

        // The internal buffer MUST be physical pixels (HiDPI)
        newCanvas.width = source.width
        newCanvas.height = source.height
        newCanvas.className = 'lgs-widget-canvas'

        // The CSS size MUST be logical pixels
        const logicalW = source.width / scale
        const logicalH = source.height / scale
        newCanvas.style.width = `${logicalW}px`
        newCanvas.style.height = `${logicalH}px`

        // Hide the canvas visually - it's only used for video composition
        newCanvas.style.position = 'absolute'
        newCanvas.style.visibility = 'hidden'
        newCanvas.style.pointerEvents = 'none'

        const ctx = newCanvas.getContext('2d')
        ctx.drawImage(source, 0, 0)

        if (this.#canvas) {
            this.#canvas.replaceWith(newCanvas)
        }
        else {
            this.#original.before(newCanvas)
        }

        this.#canvas = newCanvas
    }

    getContext = () => this.#canvas?.getContext('2d') ?? null
    getCanvas = () => this.#canvas

    destroy = () => {
        this.#canvas?.remove()
        this.#canvas = null
        this.#original = null
    }
}