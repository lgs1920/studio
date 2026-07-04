/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget2Canvas.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-01
 * Last modified: 2026-02-01
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
    #observer = null
    #tickFrame = null
    #tickLoopActive = false
    #pendingRefresh = false
    #refreshing = false
    #destroyed = false

    constructor(target, options = {}) {
        if (!target || !(target instanceof HTMLElement)) {
            return
        }

        this.#original = target
        this.#options = {
            scale: window.devicePixelRatio || 1,
            ...options,
        }
    }

    init = async () => {
        if (!this.#shouldUseLiveLoop() || !this.#refreshLiveCanvas()) {
            await this.refresh()
        }
        this.#setupRefreshLoop()
    }

    #shouldUseMutationObserver = () => {
        const mode = this.#options.refreshMode ?? 'mutation'
        return mode === 'mutation' || mode === 'live' || mode === 'tick' || mode === 'both'
    }

    #shouldUseLiveLoop = () => {
        const mode = this.#options.refreshMode ?? 'mutation'
        return mode === 'live' || mode === 'tick' || mode === 'both'
    }

    #setupRefreshLoop = () => {
        if (this.#observer || this.#destroyed || !this.#original) {
            return
        }

        if (this.#shouldUseMutationObserver()) {
            this.#observer = new MutationObserver((mutations) => {
                if (!mutations.length || this.#pendingRefresh) {
                    return
                }

                this.#pendingRefresh = true
                requestAnimationFrame(async () => {
                    try {
                        if (this.#shouldUseLiveLoop() && this.#refreshLiveCanvas()) {
                            return
                        }
                        // Refresh everything to ensure correct layering
                        await this.refresh()
                    }
                    finally {
                        this.#pendingRefresh = false
                    }
                })
            })

            this.#observer.observe(this.#original, {
                childList:  true,
                subtree:    true,
                attributes: true,
                characterData: true,
            })
        }

        if (this.#shouldUseLiveLoop()) {
            this.#startLiveLoop()
        }
    }

    #startLiveLoop = () => {
        if (this.#tickLoopActive || this.#destroyed || !this.#original) {
            return
        }

        this.#tickLoopActive = true

        const tick = () => {
            this.#tickFrame = null

            if (!this.#tickLoopActive || this.#destroyed || !this.#original) {
                return
            }

            if (!this.#refreshLiveCanvas() && this.#options.refreshMode === 'both') {
                void this.refresh()
            }

            if (this.#tickLoopActive && !this.#destroyed && this.#original) {
                this.#tickFrame = requestAnimationFrame(tick)
            }
        }

        this.#tickFrame = requestAnimationFrame(tick)
    }

    #readOriginalLogicalSize = () => {
        const rect = this.#original?.getBoundingClientRect?.()

        return {
            width:  this.#original?.offsetWidth || rect?.width || 0,
            height: this.#original?.offsetHeight || rect?.height || 0,
        }
    }

    #paintLiveBackdrop = (ctx, width, height) => {
        if (!ctx || !this.#original || width <= 0 || height <= 0) {
            return
        }

        const style = getComputedStyle(this.#original)
        const scale = this.#options.scale
        const backgroundColor = style.backgroundColor
        const borderWidth = Math.max(
            0,
            parseFloat(style.borderTopWidth) || 0,
            parseFloat(style.borderRightWidth) || 0,
            parseFloat(style.borderBottomWidth) || 0,
            parseFloat(style.borderLeftWidth) || 0,
        )
        const borderColor = style.borderTopColor || style.borderColor
        const radius = Math.max(
            0,
            parseFloat(style.borderTopLeftRadius) || 0,
            parseFloat(style.borderTopRightRadius) || 0,
            parseFloat(style.borderBottomRightRadius) || 0,
            parseFloat(style.borderBottomLeftRadius) || 0,
        ) * scale

        const hasBackground = backgroundColor && backgroundColor !== 'transparent'
        const hasBorder = borderWidth > 0 && borderColor && borderColor !== 'transparent'

        if (!hasBackground && !hasBorder) {
            return
        }

        ctx.save?.()
        if (typeof ctx.roundRect === 'function' && radius > 0) {
            const inset = (borderWidth * scale) / 2
            ctx.beginPath()
            ctx.roundRect(
                inset,
                inset,
                Math.max(0, width - (borderWidth * scale)),
                Math.max(0, height - (borderWidth * scale)),
                radius,
            )
            if (hasBackground) {
                ctx.fillStyle = backgroundColor
                ctx.fill()
            }
            if (hasBorder) {
                ctx.lineWidth = borderWidth * scale
                ctx.strokeStyle = borderColor
                ctx.stroke()
            }
        }
        else {
            if (hasBackground) {
                ctx.fillStyle = backgroundColor
                ctx.fillRect?.(0, 0, width, height)
            }
            if (hasBorder) {
                ctx.lineWidth = borderWidth * scale
                ctx.strokeStyle = borderColor
                ctx.strokeRect?.(0, 0, width, height)
            }
        }
        ctx.restore?.()
    }

    #refreshLiveCanvas = () => {
        if (!this.#original || this.#destroyed) {
            return false
        }

        const nestedCanvases = Array.from(this.#original.querySelectorAll('canvas'))
            .filter(canvas => canvas !== this.#canvas && canvas.width > 0 && canvas.height > 0)
        if (!nestedCanvases.length) {
            return false
        }

        const scale = this.#options.scale
        const {width: logicalW, height: logicalH} = this.#readOriginalLogicalSize()
        if (logicalW <= 0 || logicalH <= 0) {
            return false
        }

        const buffer = document.createElement('canvas')
        buffer.width = Math.ceil(logicalW * scale)
        buffer.height = Math.ceil(logicalH * scale)
        const ctx = buffer.getContext('2d')
        const parentRect = this.#original.getBoundingClientRect()
        const renderScaleX = parentRect.width > 0 ? (parentRect.width / logicalW) : 1
        const renderScaleY = parentRect.height > 0 ? (parentRect.height / logicalH) : 1

        this.#paintLiveBackdrop(ctx, buffer.width, buffer.height)

        nestedCanvases.forEach((canvas) => {
            const rect = canvas.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) {
                return
            }

            ctx.drawImage(
                canvas,
                ((rect.left - parentRect.left) / renderScaleX) * scale,
                ((rect.top - parentRect.top) / renderScaleY) * scale,
                (rect.width / renderScaleX) * scale,
                (rect.height / renderScaleY) * scale,
            )
        })

        this.#updateCanvas(buffer)
        return true
    }

    /**
     * Main refresh logic. Composites all widget parts into a single canvas.
     */
    refresh = async () => {
        if (!this.#original || this.#destroyed) {
            return
        }

        if (this.#refreshing) {
            return
        }
        this.#refreshing = true

        try {
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
            const {width: logicalW, height: logicalH} = this.#readOriginalLogicalSize()

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
        finally {
            this.#refreshing = false
        }
    }


    /**
     * Converts an element to a high-quality canvas source.
     * Scaled to match device pixel ratio or custom scale for maximum sharpness.
     */
    #elementToCanvasSource = async (el, options = {}) => {
        if (el instanceof SVGElement) {
            const $clone = el.cloneNode(true)
            const style = getComputedStyle(el)

            const scale = this.#options.scale

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
            if (this.#original) {
                this.#original.before(this.#canvas)
            }
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
        this.#destroyed = true
        this.#observer?.disconnect()
        this.#observer = null
        this.#tickLoopActive = false
        if (this.#tickFrame !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.#tickFrame)
        }
        this.#tickFrame = null
        this.#pendingRefresh = false
        this.#refreshing = false
        this.#canvas?.remove()
        this.#canvas = null
        this.#original = null
    }
}
