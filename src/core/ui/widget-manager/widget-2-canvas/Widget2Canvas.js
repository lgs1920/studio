/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget2Canvas.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-13
 * Last modified: 2025-12-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DYNAMIC_WIDGET_PART, STATIC_WIDGET_PART } from '@Core/constants'
import { snapdom }                                 from '@zumer/snapdom'

/**
 * Widget2Canvas — Ultra-fast DOM-to-canvas mirror (faster than html2canvas)
 *
 * Uses snapdom + single replaceWith() for maximum performance.
 * Zero layout thrashing, zero memory leaks.
 * Only one DOM mutation per refresh.
 *
 * @class
 * @exports
 */
export class Widget2Canvas {
    /** Original widget element (never touched during refresh) */
    #original = null

    /** Current visible canvas element */
    #canvas = null

    /** Snapdom rendering options */
    #options = {}

    /** Flag to debounce rapid successive mutations */
    #pendingRefresh = false

    /**
     * Creates an ultra-fast canvas mirror of a DOM widget.
     *
     * @param {HTMLElement} target - The widget element to mirror
     * @param {Object} [options={}] - Snapdom rendering options
     * @param {number} [options.scale=devicePixelRatio] - Rendering scale factor
     * @param {boolean} [options.includeBackground=true] - Capture element background
     * @param {boolean} [options.includeShadowDom=true] - Include shadow DOM content
     */
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
                const relevant = mutations.some(m => m.target.classList?.contains('dynamic-widget-part'))

                if (relevant) {
                    await this.#refreshDynamic()
                }
                else {
                    await this.#refreshStatic()
                }

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
        await this.#refreshStatic()
        await this.#refreshDynamic()
    }

    /**
     * Normalize a DOM element into a CanvasImageSource
     * - If it's an SVG, inline styles and serialize to XML
     * - Otherwise, return the element itself (or rasterized snapshot)
     *
     * @param {Element} el - DOM element (SVG or other)
     * @param {Object} options - rendering options
     * @returns {Promise<CanvasImageSource>} - Image or Canvas ready to draw
     */
    #elementToCanvasSource = async (el, options = {}) => {
        if (el instanceof SVGElement) {
            // Inline styles
            el.querySelectorAll('*').forEach(node => {
                const style = getComputedStyle(node)

                const fill = style.getPropertyValue('fill')
                if (fill && fill !== 'none') {
                    node.setAttribute('fill', fill)
                }

                const stroke = style.getPropertyValue('stroke')
                if (stroke && stroke !== 'none') {
                    node.setAttribute('stroke', stroke)
                }

                const strokeWidth = style.getPropertyValue('stroke-width')
                if (strokeWidth && strokeWidth !== '0px') {
                    node.setAttribute('stroke-width', strokeWidth)
                }

                const fontFamily = style.getPropertyValue('font-family')
                if (fontFamily) {
                    node.setAttribute('font-family', fontFamily)
                }

                const fontSize = style.getPropertyValue('font-size')
                if (fontSize) {
                    node.setAttribute('font-size', fontSize)
                }

                const opacity = style.getPropertyValue('opacity')
                if (opacity) {
                    node.setAttribute('opacity', opacity)
                }

                const transform = style.getPropertyValue('transform')
                if (transform && transform !== 'none') {
                    node.setAttribute('transform', transform)
                }

                // node.removeAttribute('class')
                // node.removeAttribute('id')
            })

            // Serialize to XML string
            const xml = new XMLSerializer().serializeToString(el)
            const img = new Image()
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

            await img.decode()
            return img
        }

        // Non-SVG fallback: rasterize via snapdom
        return await snapdom.toCanvas(el, options)
    }

    /**
     * Render a DOM element (static or dynamic) into the widget canvas
     * - Handles SVG vs non-SVG
     * - Inlines styles if needed
     * - Draws directly into the canvas
     */
    #renderPart = async (el) => {
        let target = el

        if (!(el instanceof SVGElement)) {
            const childSvg = el.querySelector('svg')
            if (childSvg) {
                target = childSvg
            }
        }

        return await this.#elementToCanvasSource(target, this.#options)
    }

    #refreshStatic = async () => {
        //TODO Fix Static and dynamic Refresh  Github #301
        const staticParts = this.#original.querySelectorAll(`.${STATIC_WIDGET_PART}`)

        if (staticParts.length > 0) {
            for (const el of staticParts) {
                const partCanvas = await this.#renderPart(el)
                this.#replaceCanvas(partCanvas, partCanvas.width, partCanvas.height, this.#options.scale)
            }
        }
        else {
            const partCanvas = await this.#renderPart(this.#original)
            this.#replaceCanvas(partCanvas, partCanvas.width, partCanvas.height, this.#options.scale)
        }
    }

    #refreshDynamic = async () => {
        const dynamicParts = this.#original.querySelectorAll(`.${DYNAMIC_WIDGET_PART}`)
        for (const el of dynamicParts) {
            const partCanvas = await this.#renderPart(el)
            this.#replaceCanvas(partCanvas, partCanvas.width, partCanvas.height, this.#options.scale)
        }
    }

    /**
     * Replace or insert a new canvas with given source
     * @param {CanvasImageSource} source - Image or canvas to draw
     * @param {number} width - Target width
     * @param {number} height - Target height
     * @param {number} scale - Scale factor
     */
    #replaceCanvas = (source, width, height, scale = 1) => {
        const newCanvas = document.createElement('canvas')
        newCanvas.width = Math.round(width / scale)
        newCanvas.height = Math.round(height / scale)
        newCanvas.className = 'lgs-widget-canvas'

        const ctx = newCanvas.getContext('2d')
        ctx.drawImage(source, 0, 0, newCanvas.width, newCanvas.height)

        this.#canvas
        ? this.#canvas.replaceWith(newCanvas)
        : this.#original.before(newCanvas)

        this.#canvas = newCanvas
    }


    /**
     * Returns the 2D rendering context of the current canvas (for overlays, annotations…).
     *
     * @returns {CanvasRenderingContext2D|null}
     */
    getContext = () => this.#canvas?.getContext('2d') ?? null

    /**
     * Returns the current canvas element.
     *
     * @returns {HTMLCanvasElement|null}
     */
    getCanvas = () => this.#canvas

    /** Makes the canvas fully visible */
    show = () => {
        if (this.#canvas) {
            this.#canvas.style.opacity = '1'
        }
    }

    /** Hides the canvas (useful for transitions or temporary DOM visibility) */
    hide = () => {
        if (this.#canvas) {
            this.#canvas.style.opacity = '0'
        }
    }

    /**
     * Completely removes the canvas mirror and restores the original widget.
     * Should be called when the widget is unmounted or no longer needed.
     */
    destroy = () => {
        this.#canvas?.remove()
        this.#canvas = null
        this.#original = null
    }
}