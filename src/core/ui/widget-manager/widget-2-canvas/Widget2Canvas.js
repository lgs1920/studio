/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget2Canvas.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-28
 * Last modified: 2026-01-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DYNAMIC_WIDGET_PART, LGS_WIDGET_SCALE_FACTOR, STATIC_WIDGET_PART } from '@Core/constants'
import { snapdom }                                                          from '@zumer/snapdom'

/**
 * Widget2Canvas — Ultra-fast DOM-to-canvas mirror
 * Correctly handles HiDPI scales and prevents edge truncation.
 */
export class Widget2Canvas {
    #original = null
    #canvas = null
    #options = {}
    #observer = null
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

        this.#observer = new MutationObserver((mutations) => {
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

        this.#observer.observe(target, {
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
        if (!this.#original) {
            return
        }

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


    /**
     * Converts an element to a high-quality canvas source.
     * Scaled to match device pixel ratio or custom scale for maximum sharpness.
     */
    #elementToCanvasSource = async (el, options = {}) => {
        if (el instanceof SVGElement) {
            const $clone = el.cloneNode(true)
            const style = getComputedStyle(el)

            // Custom scale for high-end export
            const scale = options.scale || LGS_WIDGET_SCALE_FACTOR

            // Get original bounding box dimensions
            const bbox = el.getBBox?.()
            const baseWidth = el.clientWidth || bbox?.width || parseFloat(style.width) || 512
            const baseHeight = el.clientHeight || bbox?.height || parseFloat(style.height) || 512

            // Set high-resolution dimensions
            const scaledWidth = baseWidth * scale
            const scaledHeight = baseHeight * scale

            $clone.setAttribute('width', scaledWidth)
            $clone.setAttribute('height', scaledHeight)

            // 3. Force ViewBox
            if (!el.getAttribute('viewBox')) {
                // We use the base dimensions to ensure the 'camera' captures the original area
                $clone.setAttribute('viewBox', `0 0 ${baseWidth} ${baseHeight}`)
            }

            // Ensure aspect ratio is preserved during scaling
            $clone.setAttribute('preserveAspectRatio', 'xMidYMid meet')

            // Inline computed styles
            const allElements = el.querySelectorAll('*')
            const allClones = $clone.querySelectorAll('*')

            allClones.forEach((target, index) => {
                const original = allElements[index]
                if (!original) {
                    return
                }

                const computed = getComputedStyle(original)

                target.style.fill = computed.fill
                target.style.stroke = computed.stroke
                target.style.strokeWidth = computed.strokeWidth
                target.style.opacity = computed.opacity

                // Critical for elements that use CSS transitions or transforms
                if (computed.transform !== 'none') {
                    target.style.transform = computed.transform
                    target.style.transformOrigin = computed.transformOrigin
                }
            })

            const xml = new XMLSerializer().serializeToString($clone)
            const img = new Image()

            const utf8Bytes = new TextEncoder().encode(xml)
            const base64 = btoa(String.fromCharCode(...utf8Bytes))
            img.src = `data:image/svg+xml;base64,${base64}`

            await img.decode()
            return img
        }

        return await snapdom.toCanvas(el, options)
    }
    #renderPart = async (el) => {
        let target = el
        if (el instanceof SVGElement || this.#options.type === 'svg') {
            const childSvg = el.querySelector('svg')
            if (childSvg) {
                target = childSvg
            }
        }
        return await this.#elementToCanvasSource(target, this.#options)
    }

    /**
     * Updates the visible canvas while maintaining HiDPI consistency.
     * Uses a single canvas instance to keep video streams alive.
     * @param {HTMLCanvasElement|HTMLImageElement} source
     */
    #updateCanvas = (source) => {
        const scale = this.#options.scale
        const logicalW = this.#original?.offsetWidth ?? (source.width / scale)
        const logicalH = this.#original?.offsetHeight ?? (source.height / scale)

        // 1. If the canvas doesn't exist, create it once
        if (!this.#canvas) {
            this.#canvas = document.createElement('canvas')
            this.#canvas.className = 'lgs-widget-canvas'

            // Internal configuration for video composition
            this.#canvas.style.position = 'absolute'
            this.#canvas.style.visibility = 'hidden'
            this.#canvas.style.pointerEvents = 'none'

            // Insert into DOM only once
            this.#original.before(this.#canvas)
        }

        // 2. Update physical dimensions only if they changed to avoid flickering
        if (this.#canvas.width !== source.width || this.#canvas.height !== source.height) {
            this.#canvas.width = source.width
            this.#canvas.height = source.height
            this.#canvas.style.width = `${logicalW}px`
            this.#canvas.style.height = `${logicalH}px`
        }

        // 3. Draw onto the PERMANENT canvas instance
        const ctx = this.#canvas.getContext('2d')

        // Production note: Clear before drawing to handle transparency correctly
        ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height)
        ctx.drawImage(source, 0, 0)
    }
    getContext = () => this.#canvas?.getContext('2d') ?? null
    getCanvas = () => this.#canvas

    destroy = () => {
        this.#observer?.disconnect()
        this.#observer = null
        this.#pendingRefresh = false
        this.#canvas?.remove()
        this.#canvas = null
        this.#original = null
    }
}
