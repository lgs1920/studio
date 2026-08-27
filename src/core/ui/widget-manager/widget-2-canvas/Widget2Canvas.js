/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget2Canvas.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
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
    static #instances = new Map()

    static get = widgetId => Widget2Canvas.#instances.get(widgetId) ?? null

    static refresh = (widgetId, options = {}) => (
        Widget2Canvas.get(widgetId)?.requestRefresh?.(options) ?? false
    )

    static flush = (widgetId, options = {}) => (
        Widget2Canvas.get(widgetId)?.flush?.(options) ?? Promise.resolve(false)
    )

    #original = null
    #canvas = null
    #options = {}
    #widgetId = null
    #observer = null
    #tickFrame = null
    #tickLoopActive = false
    #pendingRefresh = false
    #queuedRefresh = false
    #refreshing = false
    #refreshIdleWaiters = []
    #destroyed = false
    #parts = new Map()
    #partOrder = []
    #partsDirty = true
    #captureSandbox = null
    #captureGeometry = null

    #timingLabel = 'Widget2Canvas'

    constructor(target, options = {}) {
        if (!target || !(target instanceof HTMLElement)) {
            return
        }

        this.#original = target
        this.#options = {
            scale: window.devicePixelRatio || 1,
            ...options,
        }
        this.#widgetId = this.#options.widgetId ?? this.#original?.id ?? null
        this.#timingLabel = `Widget2Canvas:${this.#widgetId ?? 'unknown'}`
    }

    init = async () => {
        if (this.#widgetId) {
            Widget2Canvas.#instances.set(this.#widgetId, this)
        }
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
                if (!mutations.length) {
                    return
                }

                this.#handleMutations(mutations)
                this.requestRefresh({afterFrame: true})
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
                this.requestRefresh()
            }

            if (this.#tickLoopActive && !this.#destroyed && this.#original) {
                this.#tickFrame = requestAnimationFrame(tick)
            }
        }

        this.#tickFrame = requestAnimationFrame(tick)
    }

    requestRefresh = ({afterFrame = false} = {}) => {
        if (this.#destroyed || !this.#original) {
            return false
        }

        if (this.#pendingRefresh || this.#refreshing) {
            this.#queuedRefresh = true
            return true
        }

        this.#pendingRefresh = true
        const run = async () => {
            try {
                if (this.#shouldUseLiveLoop() && this.#refreshLiveCanvas()) {
                    return
                }
                await this.refresh()
            }
            finally {
                this.#pendingRefresh = false
                if (this.#queuedRefresh && !this.#destroyed && this.#original) {
                    this.#queuedRefresh = false
                    this.requestRefresh({afterFrame: true})
                    return
                }
                this.#resolveRefreshIdleWaiters(true)
            }
        }

        if (afterFrame) {
            requestAnimationFrame(() => void run())
        }
        else {
            void run()
        }
        return true
    }

    flush = ({afterFrame = false} = {}) => {
        if (this.#destroyed || !this.#original) {
            return Promise.resolve(false)
        }

        this.requestRefresh({afterFrame})
        return this.waitForIdle()
    }

    waitForIdle = () => {
        if (!this.#pendingRefresh && !this.#refreshing && !this.#queuedRefresh) {
            return Promise.resolve(true)
        }

        return new Promise(resolve => {
            this.#refreshIdleWaiters.push(resolve)
        })
    }

    #resolveRefreshIdleWaiters = (result) => {
        const waiters = this.#refreshIdleWaiters.splice(0)
        waiters.forEach(resolve => resolve(result))
    }

    #collectMarkedParts = () => {
        if (!this.#original) {
            return []
        }

        const selector = `.${STATIC_WIDGET_PART}, .${DYNAMIC_WIDGET_PART}`
        const parts = []

        if (this.#original.classList?.contains(STATIC_WIDGET_PART) || this.#original.classList?.contains(DYNAMIC_WIDGET_PART)) {
            parts.push(this.#original)
        }

        parts.push(...this.#original.querySelectorAll(selector))
        return parts
    }

    #syncPartRegistry = () => {
        if (!this.#original) {
            this.#parts.clear()
            this.#partOrder = []
            this.#partsDirty = false
            return
        }

        const orderedParts = this.#collectMarkedParts()
        const nextParts = new Map()

        for (const element of orderedParts) {
            if (!(element instanceof Element)) {
                continue
            }

            const role = element.classList.contains(DYNAMIC_WIDGET_PART) ? 'dynamic' : 'static'
            const existing = this.#parts.get(element)
            nextParts.set(element, {
                element,
                role,
                dirty: existing?.dirty ?? true,
                capture: existing?.capture ?? null,
            })
        }

        this.#parts = nextParts
        this.#partOrder = orderedParts
            .map(element => this.#parts.get(element))
            .filter(Boolean)
        this.#partsDirty = false
    }

    #markAllPartsDirty = () => {
        this.#parts.forEach((entry) => {
            entry.dirty = true
        })
        this.#partsDirty = true
    }

    #markPartDirty = (element) => {
        if (!element) {
            this.#markAllPartsDirty()
            return
        }

        const entry = this.#parts.get(element)
        if (entry) {
            entry.dirty = true
            return
        }

        this.#markAllPartsDirty()
    }

    #findMarkedAncestor = (node) => {
        let current = node instanceof Element ? node : node?.parentElement

        while (current && current !== this.#original) {
            if (current.classList?.contains(STATIC_WIDGET_PART) || current.classList?.contains(DYNAMIC_WIDGET_PART)) {
                return current
            }
            current = current.parentElement
        }

        if (this.#original?.classList?.contains(STATIC_WIDGET_PART) || this.#original?.classList?.contains(DYNAMIC_WIDGET_PART)) {
            return this.#original
        }

        return null
    }

    #handleMutations = (mutations) => {
        let shouldRescan = false

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                this.#markAllPartsDirty()
                shouldRescan = true
            }

            const marked = this.#findMarkedAncestor(mutation.target)
            if (marked) {
                this.#markPartDirty(marked)
                continue
            }

            this.#markAllPartsDirty()
        }

        if (shouldRescan) {
            this.#partsDirty = true
        }
    }

    #composeMarkedParts = async () => {
        if (!this.#original) {
            return null
        }

        const scale = this.#options.scale
        const {width: logicalW, height: logicalH} = this.#readLogicalSize()

        if (logicalW <= 0 || logicalH <= 0) {
            return null
        }

        const buffer = document.createElement('canvas')
        buffer.width = Math.ceil(logicalW * scale)
        buffer.height = Math.ceil(logicalH * scale)
        const ctx = buffer.getContext('2d')
        const parentRect = this.#original.getBoundingClientRect()
        const renderScaleX = parentRect.width > 0 ? (parentRect.width / logicalW) : 1
        const renderScaleY = parentRect.height > 0 ? (parentRect.height / logicalH) : 1

        this.#paintLiveBackdrop(ctx, buffer.width, buffer.height)

        for (const entry of this.#partOrder) {
            if (!entry?.element) {
                continue
            }

            if (entry.dirty || !entry.capture) {
                entry.capture = await this.#renderPart(entry.element, entry.role)
                entry.dirty = false
            }

            const source = entry.capture?.source
            const rect = entry.element.getBoundingClientRect()
            if (!source || rect.width <= 0 || rect.height <= 0) {
                continue
            }

            ctx.drawImage(
                source,
                ((rect.left - parentRect.left) / renderScaleX) * scale,
                ((rect.top - parentRect.top) / renderScaleY) * scale,
                (rect.width / renderScaleX) * scale,
                (rect.height / renderScaleY) * scale,
            )
        }

        return buffer
    }

    #copyCanvasBitmap = (canvas) => {
        if (!(canvas instanceof HTMLCanvasElement)) {
            return null
        }

        const copy = document.createElement('canvas')
        copy.width = canvas.width
        copy.height = canvas.height

        const ctx = copy.getContext('2d')
        if (!ctx) {
            return null
        }

        ctx.drawImage(canvas, 0, 0)
        return copy
    }

    #getCaptureSandbox = () => {
        if (this.#captureSandbox?.isConnected) {
            return this.#captureSandbox
        }

        const sandbox = document.createElement('div')
        sandbox.className = 'lgs-widget-clone'
        sandbox.style.position = 'absolute'
        sandbox.style.top = '-100000px'
        sandbox.style.left = '-100000px'
        sandbox.style.visibility = 'visible'
        sandbox.style.pointerEvents = 'none'
        sandbox.style.opacity = '1'
        sandbox.style.contain = 'layout style paint'

        document.body.appendChild(sandbox)
        this.#captureSandbox = sandbox
        return sandbox
    }

    #buildStaticCaptureTarget = (el) => {
        if (!el) {
            return null
        }

        const clone = el.cloneNode(true)
        clone.querySelectorAll(`.${DYNAMIC_WIDGET_PART}, canvas`).forEach((node) => {
            if (node instanceof HTMLElement) {
                node.style.visibility = 'hidden'
            }
        })

        const sandbox = this.#getCaptureSandbox()
        sandbox.appendChild(clone)
        return clone
    }

    /**
     * Reads an element's logical layout dimensions without applying raster scale.
     *
     * @param {HTMLElement|SVGElement|null} element - Element whose layout dimensions are required.
     * @returns {{width: number, height: number}} Logical dimensions in CSS pixels.
     */
    #readLogicalSize = (element = this.#original) => {
        const rect = element?.getBoundingClientRect?.()
        const layoutWidth = Math.max(element?.offsetWidth || 0, element?.scrollWidth || 0)
        const layoutHeight = Math.max(element?.offsetHeight || 0, element?.scrollHeight || 0)

        return {
            width:  layoutWidth || rect?.width || 0,
            height: layoutHeight || rect?.height || 0,
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
        const {width: logicalW, height: logicalH} = this.#readLogicalSize()
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
            this.#queuedRefresh = true
            return
        }
        this.#refreshing = true
        const startedAt = this.#shouldLogTiming() ? performance.now() : 0

        try {
            if (this.#partsDirty) {
                this.#syncPartRegistry()
            }

            if (this.#options.captureWholeWidget || !this.#partOrder.length) {
                const capture = await this.#renderPart(this.#original)
                this.#updateCanvas(capture?.source, capture?.dimensions)
                return
            }

            const buffer = await this.#composeMarkedParts()
            if (!buffer) {
                return
            }
            this.#updateCanvas(buffer)
        }
        finally {
            if (startedAt) {
                this.#logTiming('refresh', startedAt)
            }
            this.#refreshing = false
        }
    }


    /**
     * Converts an element to a high-quality canvas source.
     * Scaled to match device pixel ratio or custom scale for maximum sharpness.
     */
    #elementToCanvasSource = async (el, options = {}) => {
        const startedAt = this.#shouldLogTiming() ? performance.now() : 0
        if (el instanceof HTMLCanvasElement) {
            const canvasCopy = this.#copyCanvasBitmap(el)
            if (canvasCopy) {
                if (startedAt) {
                    this.#logTiming(`canvas:${el.tagName?.toLowerCase?.() ?? 'canvas'}`, startedAt)
                }
                return {
                    source:     canvasCopy,
                    dimensions: this.#readLogicalSize(el),
                }
            }
        }
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
            if (startedAt) {
                this.#logTiming(`svg:${el.tagName?.toLowerCase?.() ?? 'svg'}`, startedAt)
            }
            return {
                source:     img,
                dimensions: {width: baseWidth, height: baseHeight},
            }
        }

        let capture = null
        let canvas = null
        if (typeof snapdom === 'function') {
            capture = await snapdom(el, options)
            canvas = await capture.toCanvas()
        }
        else {
            canvas = await snapdom.toCanvas(el, options)
        }

        const metadataWidth = Number(capture?.meta?.w0)
        const metadataHeight = Number(capture?.meta?.h0)
        const fallbackDimensions = this.#readLogicalSize(el)
        const dimensions = metadataWidth > 0 && metadataHeight > 0
                          ? {width: metadataWidth, height: metadataHeight}
                          : fallbackDimensions
        if (startedAt) {
            this.#logTiming(`snapdom:${el?.tagName?.toLowerCase?.() ?? 'node'}`, startedAt)
        }
        return {source: canvas, dimensions}
    }
    #renderPart = async (el, role = 'dynamic') => {
        let target = el
        if (el instanceof SVGElement || this.#options.type === 'svg') {
            const childSvg = el.querySelector('svg')
            if (childSvg) {
                target = childSvg
            }
        }

        let captureTarget = target
        const shouldMaskDynamicChildren = role === 'static' && target instanceof HTMLElement && target.querySelector?.(`.${DYNAMIC_WIDGET_PART}`)

        if (shouldMaskDynamicChildren) {
            captureTarget = this.#buildStaticCaptureTarget(target)
        }

        try {
            return await this.#elementToCanvasSource(captureTarget, this.#options)
        }
        finally {
            if (captureTarget && captureTarget !== target && captureTarget.parentElement) {
                captureTarget.remove()
            }
        }
    }

    /**
     * Updates the visible canvas using logical capture dimensions and raster source pixels.
     *
     * @param {HTMLCanvasElement|HTMLImageElement} source - Rasterized capture source.
     * @param {{width?: number, height?: number}|null} dimensions - Logical capture dimensions in CSS pixels.
     */
    #updateCanvas = (source, dimensions = null) => {
        const scale = Number(this.#options.scale) > 0 ? Number(this.#options.scale) : 1
        const sourceWidth = Number(source?.width) || 0
        const sourceHeight = Number(source?.height) || 0
        const metadataWidth = Number(dimensions?.width)
        const metadataHeight = Number(dimensions?.height)
        const logicalW = metadataWidth > 0
                         ? metadataWidth
                         : sourceWidth > 0
                           ? sourceWidth / scale
                           : (this.#original?.offsetWidth ?? 0)
        const logicalH = metadataHeight > 0
                         ? metadataHeight
                         : sourceHeight > 0
                           ? sourceHeight / scale
                           : (this.#original?.offsetHeight ?? 0)

        this.#captureGeometry = {width: logicalW, height: logicalH}

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
        }

        // The bitmap is authoritative after a layout-changing update. Always
        // synchronize its CSS box, even when the physical bitmap dimensions
        // happen to remain unchanged after rounding.
        this.#canvas.style.width = `${logicalW}px`
        this.#canvas.style.height = `${logicalH}px`

        // 3. Draw onto the PERMANENT canvas instance
        const ctx = this.#canvas.getContext('2d')

        // Production note: Clear before drawing to handle transparency correctly
        ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height)
        ctx.drawImage(source, 0, 0)
    }
    getContext = () => this.#canvas?.getContext('2d') ?? null
    getCanvas = () => this.#canvas

    /**
     * Returns the logical geometry used by the latest canvas capture.
     *
     * @returns {{width: number, height: number}|null} Latest capture geometry in CSS pixels.
     */
    getCaptureGeometry = () => this.#captureGeometry

    #shouldLogTiming = () => this.#options.debugTiming === true

    #logTiming = (phase, startedAt) => {
        if (!startedAt || !this.#shouldLogTiming()) {
            return
        }

        const duration = Math.round((performance.now() - startedAt) * 100) / 100
        console.info(`[${this.#timingLabel}] ${phase} ${duration}ms`)
    }

    destroy = () => {
        this.#destroyed = true
        if (this.#widgetId && Widget2Canvas.get(this.#widgetId) === this) {
            Widget2Canvas.#instances.delete(this.#widgetId)
        }
        this.#observer?.disconnect()
        this.#observer = null
        this.#tickLoopActive = false
        if (this.#tickFrame !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.#tickFrame)
        }
        this.#tickFrame = null
        this.#pendingRefresh = false
        this.#queuedRefresh = false
        this.#refreshing = false
        this.#resolveRefreshIdleWaiters(false)
        this.#captureGeometry = null
        this.#canvas?.remove()
        this.#canvas = null
        this.#original = null
        this.#captureSandbox?.remove()
        this.#captureSandbox = null
        this.#parts.clear()
        this.#partOrder = []
        this.#partsDirty = true
    }
}
