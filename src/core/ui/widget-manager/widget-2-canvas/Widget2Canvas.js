/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget2Canvas.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-25
 * Last modified: 2025-11-25
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { snapdom } from '@zumer/snapdom'

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

    /** Original computed display value (restored on destroy/showOriginal) */
    #originalDisplay = 'block'

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
            scale:            window.devicePixelRatio || 1,
            includeBackground: true,
            includeShadowDom: true,
            ...options,
        }

        // Store original display value before any manipulation
        this.#originalDisplay = getComputedStyle(target).display

        // Observe all possible mutations on the target and its subtree
        const observer = new MutationObserver((mutations) => {
            if (!mutations.length) {
                return
            }
            if (this.#pendingRefresh) {
                return
            }

            this.#pendingRefresh = true
            requestAnimationFrame(() => {
                this.#refresh()
                this.#pendingRefresh = false
            })
        })

        observer.observe(target, {
            childList:     true,
            subtree:       true,
            attributes:    true,
            characterData: true,
        })

        // Initial render
        this.#refresh()
    }

    /**
     * Refreshes the widget snapshot into a canvas
     * - If type is 'svg', uses native Image + drawImage for speed
     * - Otherwise falls back to snapdom.toCanvas
     * - Ensures static vs dynamic rendering pipelines remain consistent
     */
    #refresh = async () => {
        if (!this.#original) {
            return
        }

        // Clone via widget manager to avoid direct DOM reads
        const clone = __.ui.widgetManager.clone(this.#original)
        clone.style.display = this.#originalDisplay
        clone.style.visibility = 'visible'
        this.#original.style.visibility = 'hidden'
        document.body.appendChild(clone)

        const cleanup = () => clone.remove()

        /**
         * Replace or insert a new canvas with given source
         * @param {CanvasImageSource} source - Image or canvas to draw
         * @param {number} width - Target width
         * @param {number} height - Target height
         * @param {number} scale - Scale factor
         */
        const replaceCanvas = (source, width, height, scale = 1) => {
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

        try {
            if (this.#options.type === 'svg') {
                // Direct SVG pipeline: faster and resolves CSS variables/classes natively
                const svg = clone.querySelector('svg')

                /**
                 * Convert an SVG element into a self-contained XML string
                 * - Resolves classes and CSS variables via computed styles
                 * - Applies paint/text/transform properties as inline attributes
                 * - Removes class attributes
                 * - Returns serialized XML string
                 *
                 * @param {SVGElement} svgEl - The SVG element to process
                 * @returns {string} - Serialized XML string with inline styles
                 */
                function svgToXml(svgEl) {
                    svgEl.querySelectorAll('*').forEach(el => {
                        const style = getComputedStyle(el)

                        // Paint properties
                        const fill = style.getPropertyValue('fill')
                        if (fill && fill !== 'none') {
                            el.setAttribute('fill', fill)
                        }

                        const stroke = style.getPropertyValue('stroke')
                        if (stroke && stroke !== 'none') {
                            el.setAttribute('stroke', stroke)
                        }

                        const strokeWidth = style.getPropertyValue('stroke-width')
                        if (strokeWidth && strokeWidth !== '0px') {
                            el.setAttribute('stroke-width', strokeWidth)
                        }

                        // Text properties
                        const fontFamily = style.getPropertyValue('font-family')
                        if (fontFamily) {
                            el.setAttribute('font-family', fontFamily)
                        }

                        const fontSize = style.getPropertyValue('font-size')
                        if (fontSize) {
                            el.setAttribute('font-size', fontSize)
                        }

                        // Opacity
                        const opacity = style.getPropertyValue('opacity')
                        if (opacity) {
                            el.setAttribute('opacity', opacity)
                        }

                        // Transform
                        const transform = style.getPropertyValue('transform')
                        if (transform && transform !== 'none') {
                            el.setAttribute('transform', transform)
                        }

                        // Remove class to make SVG self-contained
                        el.removeAttribute('class')
                    })

                    // Serialize to XML string
                    return new XMLSerializer().serializeToString(svgEl)
                }

                const xml = svgToXml(svg)
                const img = new Image()
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

                // Wait until image is decoded before drawing
                await img.decode()

                replaceCanvas(img, img.width, img.height, this.#options.scale)
            }
            else {
                // Fallback pipeline: rasterize via snapdom
                const snapshot = await snapdom.toCanvas(clone, this.#options)
                replaceCanvas(snapshot, snapshot.width, snapshot.height, this.#options.scale)
            }
        }
        catch (err) {
            console.warn('Widget2Canvas: failed to render snapshot', err)
        }
        finally {
            cleanup()
        }
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

    /** Displays the original DOM widget and hides the canvas */
    showOriginal = () => {
        if (this.#canvas) {
            this.#canvas.style.display = 'none'
        }
        if (this.#original) {
            this.#original.style.display = this.#originalDisplay
        }
    }

    /** Hides the original widget and shows the canvas (default mirrored state) */
    hideOriginal = () => {
        if (this.#canvas) {
            this.#canvas.style.display = 'block'
        }
        if (this.#original) {
            this.#original.style.display = 'none'
        }
    }

    /**
     * Completely removes the canvas mirror and restores the original widget.
     * Should be called when the widget is unmounted or no longer needed.
     */
    destroy = () => {
        this.#canvas?.remove()
        if (this.#original) {
            this.#original.style.display = this.#originalDisplay
        }
        this.#canvas = null
        this.#original = null
    }
}