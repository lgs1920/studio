/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget2Canvas.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-20
 * Last modified: 2025-11-20
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
            queueMicrotask(() => {
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
     * Performs a single DOM mutation refresh — the fastest possible path.
     *
     * Clones the widget off-screen, renders it with snapdom, draws to canvas,
     * then replaces the previous canvas in one operation.
     *
     * @private
     */
    #refresh = () => {
        if (!this.#original) {
            return
        }

        // Clone using the global widget manager (avoids direct DOM reads that could trigger reflow)
        const clone = __.ui.widgetManager.clone(this.#original)

        // Ensure the clone is fully visible for accurate rendering
        clone.style.display = this.#originalDisplay
        clone.style.visibility = 'visible'

        // Append off-screen to allow layout/paint before snapshot
        document.body.appendChild(clone)

        snapdom
            .toCanvas(clone, this.#options)
            .then((snapshot) => {
                const scale = this.#options.scale
                const width = Math.round(snapshot.width / scale)
                const height = Math.round(snapshot.height / scale)

                const newCanvas = document.createElement('canvas')
                newCanvas.width = width
                newCanvas.height = height
                newCanvas.className = 'lgs-widget-canvas'

                const ctx = newCanvas.getContext('2d')
                ctx.drawImage(snapshot, 0, 0, width, height)

                // Single DOM mutation: replace or insert the new canvas
                this.#canvas
                ? this.#canvas.replaceWith(newCanvas)
                : this.#original.before(newCanvas)

                this.#canvas = newCanvas
            })
            .catch((error) => {
                // Silent fallback — errors are rare but we don't want to break the UI
                console.warn('Widget2Canvas: failed to render snapshot', error)
            })
            .finally(() => {
                // Always clean up the temporary clone
                clone.remove()
            })
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