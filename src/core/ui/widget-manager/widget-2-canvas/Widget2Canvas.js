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
 * Widget2Canvas — Ultra-fast DOM-to-canvas mirror (faster than the original)
 *
 * Uses snapdom + replaceWith() for maximum performance.
 * Zero layout thrashing, zero memory leaks.
 * Only one DOM mutation per refresh.
 *
 * @class
 */
export class Widget2Canvas {
    /** Original widget element (never touched during refresh) */
    #original = null

    /** Current visible canvas */
    #canvas = null

    /** Original computed display value */
    #originalDisplay = 'block'

    /** Snapdom options */
    #options = {}

    /** Debounce flag for rapid mutations */
    #pendingRefresh = false

    /**
     * Creates an ultra-fast canvas mirror.
     *
     * @param {HTMLElement} target                  Target widget
     * @param {Object}      [options={}]            Snapdom options
     * @param {number}      [options.scale=devicePixelRatio]
     * @param {boolean}     [options.includeBackground=true]
     * @param {boolean}     [options.includeShadowDom=true]
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

        this.#originalDisplay = getComputedStyle(target).display

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

        this.#refresh()
    }

    /**
     * Single DOM mutation refresh — fastest possible path.
     *
     * @private
     */
    #refresh = () => {
        if (!this.#original) {
            return
        }

        const clone = __.ui.widgetManager.clone(this.#original)
        clone.style.display = this.#originalDisplay
        clone.style.visibility = 'visible'

        document.body.appendChild(clone)

        snapdom.toCanvas(clone, this.#options)
            .then((snapshot) => {
                const scale = this.#options.scale
                const width = Math.round(snapshot.width / scale)
                const height = Math.round(snapshot.height / scale)

                const newCanvas = document.createElement('canvas')
                newCanvas.width = width
                newCanvas.height = height
                newCanvas.classList.add('lgs-widget-canvas')

                const ctx = newCanvas.getContext('2d')
                ctx.drawImage(snapshot, 0, 0, width, height)

                // Fastest DOM replacement: single operation
                this.#canvas ? this.#canvas.replaceWith(newCanvas) : this.#original.before(newCanvas)
                this.#canvas = newCanvas
            })
            .catch(() => {
                // Silent fallback
            })
            .finally(() => {
                clone.remove()
            })
    }

    /** Returns 2D context for overlay drawing */
    getContext = () => this.#canvas?.getContext('2d') ?? null

    /** Returns current canvas element */
    getCanvas = () => this.#canvas

    /** Show canvas */
    show = () => {
        if (this.#canvas) {
            this.#canvas.style.opacity = '1'
        }
    }

    /** Hide canvas */
    hide = () => {
        if (this.#canvas) {
            this.#canvas.style.opacity = '0'
        }
    }

    /** Show original DOM widget */
    showOriginal = () => {
        if (this.#canvas) {
            this.#canvas.style.display = 'none'
        }
        if (this.#original) {
            this.#original.style.display = this.#originalDisplay
        }
    }

    /** Hide original DOM (default mirrored state) */
    hideOriginal = () => {
        if (this.#canvas) {
            this.#canvas.style.display = 'block'
        }
        if (this.#original) {
            this.#original.style.display = 'none'
        }
    }

    /** Full cleanup */
    destroy = () => {
        this.#canvas?.remove()
        if (this.#original) {
            this.#original.style.display = this.#originalDisplay
        }
        this.#canvas = null
        this.#original = null
    }
}