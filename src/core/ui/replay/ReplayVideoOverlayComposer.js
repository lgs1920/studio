/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { resolveVideoOverlayVisibility } from '@Core/ui/replay/ReplayOverlayResolver'
import { normalizeReplayVideoCropRect } from '@Core/ui/replay/ReplayVideoRenderSpec'
import { replayVideoTraceDebug } from '@Core/ui/replay/ReplayVideoTraceDebug'

const DEFAULT_METRICS_CACHE_TTL_MS = 750

const getComputedStyleSafe = element => globalThis.getComputedStyle?.(element) ?? globalThis.window?.getComputedStyle?.(element) ?? null

export const getReplayVideoOverlayMetrics = (el, depth = 0) => {
    if (!el || depth > 2) {
        return {blur: 0, radius: 0, border: 0, margins: {top: 0, right: 0, bottom: 0, left: 0}}
    }
    const style = getComputedStyleSafe(el)
    if (!style) {
        return {blur: 0, radius: 0, border: 0, margins: {top: 0, right: 0, bottom: 0, left: 0}}
    }

    const filter = style.backdropFilter || style.webkitBackdropFilter
    let blur = 0
    const blurMatch = filter?.match(/blur\(([^)]+)\)/)
    if (blurMatch) {
        const raw = blurMatch[1].trim()
        if (raw.startsWith('var(')) {
            const varName = raw.slice(4, -1).trim()
            const varValue = style.getPropertyValue(varName).trim()
            blur = parseFloat(varValue) || 0
        }
        else {
            blur = parseFloat(raw) || 0
        }
    }
    const radiusMatch = style.borderRadius?.match(/(\d+)px/)
    const radius = radiusMatch ? parseFloat(radiusMatch[1]) : 0
    const borderWidthMatch = style.borderWidth?.match(/([\d.]+)px/)
    const border = borderWidthMatch ? parseFloat(borderWidthMatch[1]) : 0

    let margins = {top: 0, right: 0, bottom: 0, left: 0}
    const shadow = style.boxShadow
    if (shadow && shadow !== 'none') {
        const values = shadow.match(/(-?[\d.]+)px/g)
        if (values && values.length >= 2) {
            const px = value => parseFloat(value) || 0
            margins = globalThis.__?.ui?.widgetManager?.getShadowMargins?.(
                px(values[0]),
                px(values[1]),
                px(values[2]),
                px(values[3]),
            ) ?? margins
        }
    }

    if (blur > 0 || radius > 0 || border > 0 || margins.top > 0 || margins.bottom > 0 || margins.left > 0 || margins.right > 0) {
        return {blur, radius, border, margins}
    }

    for (const child of el.children ?? []) {
        const metrics = getReplayVideoOverlayMetrics(child, depth + 1)
        if (metrics.blur > 0 || metrics.radius > 0 || metrics.border > 0 || metrics.margins.top > 0 || metrics.margins.bottom > 0 || metrics.margins.left > 0 || metrics.margins.right > 0) {
            return metrics
        }
    }

    return {blur: 0, radius: 0, border: 0, margins: {top: 0, right: 0, bottom: 0, left: 0}}
}

export const resolveReplayVideoWidgetScale = (el, configScale) => {
    const baseScaleX = typeof configScale === 'object' ? (configScale?.x ?? 1) : (configScale ?? 1)
    const baseScaleY = typeof configScale === 'object' ? (configScale?.y ?? baseScaleX) : (configScale ?? 1)
    if (!el) {
        return {x: baseScaleX, y: baseScaleY}
    }
    const style = getComputedStyleSafe(el)
    const transform = style?.transform
    let matrixScaleX = 0
    let matrixScaleY = 0
    const Matrix = globalThis.DOMMatrixReadOnly ?? globalThis.window?.DOMMatrixReadOnly
    if (Matrix && transform && transform !== 'none') {
        try {
            const matrix = new Matrix(transform)
            matrixScaleX = Math.hypot(matrix.a, matrix.b)
            matrixScaleY = Math.hypot(matrix.c, matrix.d)
        }
        catch {
            // Ignore invalid transform matrices and keep fallback scale resolution.
        }
    }
    const rect = el.getBoundingClientRect?.()
    const cssWidth = parseFloat(style?.width) || rect?.width
    const cssHeight = parseFloat(style?.height) || rect?.height
    const ratioScaleX = cssWidth ? rect.width / cssWidth : 0
    const ratioScaleY = cssHeight ? rect.height / cssHeight : 0
    return {x: matrixScaleX || ratioScaleX || baseScaleX, y: matrixScaleY || ratioScaleY || baseScaleY}
}

const getSortedVideoWidgetKeys = ({widgetKeys = null, widgetsBoard = VIDEO_WIDGETS_BOARD} = {}) => {
    if (widgetKeys?.length) {
        return widgetKeys
    }

    return [...(globalThis.__?.ui?.widgetCache?.getAll?.({widgetsBoard})?.entries?.() ?? [])]
        .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
        .map(entry => entry[0])
}

const resolveMetrics = ({widgetId, widgetEl, metricsCache = null, metricsCacheTtlMs = DEFAULT_METRICS_CACHE_TTL_MS} = {}) => {
    if (!metricsCache?.get || !metricsCache?.set) {
        return getReplayVideoOverlayMetrics(widgetEl)
    }

    const now = globalThis.performance?.now?.() ?? Date.now()
    const cached = metricsCache.get(widgetId)
    if (cached && (now - cached.time) < metricsCacheTtlMs) {
        return cached.metrics
    }

    const metrics = getReplayVideoOverlayMetrics(widgetEl)
    metricsCache.set(widgetId, {time: now, metrics})
    return metrics
}

export const buildReplayVideoComposerOverlays = ({
                                                     composer,
                                                     cropRect,
                                                     sceneOverlays = [],
                                                     widgetKeys = null,
                                                     replay = globalThis.lgs?.stores?.replay ?? null,
                                                     controller = globalThis.__?.ui?.replay?.controller ?? null,
                                                     metricsCache = null,
                                                     metricsCacheTtlMs = DEFAULT_METRICS_CACHE_TTL_MS,
                                                     widgetsBoard = VIDEO_WIDGETS_BOARD,
                                                 } = {}) => {
    if (!composer) {
        return
    }

    const normalizedCrop = normalizeReplayVideoCropRect(cropRect) ?? {left: 0, top: 0, width: 0, height: 0}
    composer.beginUpdate()

    const replayOverlayCandidates = Array.from(
        globalThis.lgs?.viewer?.container?.querySelectorAll?.('[data-replay-video-overlay-canvas="true"]')
        ?? globalThis.document?.querySelectorAll?.('[data-replay-video-overlay-canvas="true"]')
        ?? [],
    ).filter(element => element instanceof HTMLCanvasElement)
    const sceneOverlayEntries = []
    const seenSceneOverlayElements = new Set()
    for (const overlay of sceneOverlays ?? []) {
        const element = overlay?.element ?? overlay?.canvas ?? null
        if (!(element instanceof HTMLCanvasElement) || seenSceneOverlayElements.has(element)) {
            continue
        }

        sceneOverlayEntries.push(overlay)
        seenSceneOverlayElements.add(element)
    }
    for (const element of replayOverlayCandidates) {
        if (seenSceneOverlayElements.has(element)) {
            continue
        }

        sceneOverlayEntries.push({
            canvas: element,
        })
        seenSceneOverlayElements.add(element)
    }

    let sceneOverlayCount = 0
    for (const overlay of sceneOverlayEntries) {
        const element = overlay?.element ?? overlay?.canvas ?? null
        if (!(element instanceof HTMLCanvasElement)) {
            replayVideoTraceDebug('composer.scene-overlay.skip.invalid-element', {
                hasOverlay: Boolean(overlay),
                elementType: element?.constructor?.name ?? typeof element,
            })
            continue
        }

        const elementStyle = getComputedStyleSafe(element)
        const isReplayDiagnosticsCanvas = element.dataset?.replayVideoOverlayCanvas === 'true'
        if (
            !isReplayDiagnosticsCanvas
            && (
                element.hidden === true
                || elementStyle?.display === 'none'
                || elementStyle?.visibility === 'hidden'
            )
        ) {
            continue
        }

        composer.addOverlay(element, {
            x:             0,
            y:             0,
            w:             normalizedCrop.width,
            h:             normalizedCrop.height,
            contentWidth:  normalizedCrop.width,
            contentHeight: normalizedCrop.height,
            scale:         1,
            ...(overlay.options ?? {}),
        })
        sceneOverlayCount += 1
    }
    if (sceneOverlayEntries.length > 0) {
        replayVideoTraceDebug('composer.scene-overlays.added', {
            requested: sceneOverlayEntries.length,
            added: sceneOverlayCount,
            crop: normalizedCrop,
        })
    }

    for (const key of getSortedVideoWidgetKeys({widgetKeys, widgetsBoard})) {
        const widgetEl = globalThis.__?.ui?.widgetManager?.getElementById?.(key)
        if (!resolveVideoOverlayVisibility({widgetId: key, widgetEl, replay, controller})) {
            continue
        }

        const canvasEl = widgetEl?.querySelector?.('.lgs-widget-canvas')
        if (!(canvasEl instanceof HTMLCanvasElement)) {
            continue
        }

        const config = globalThis.__?.ui?.widgetManager?.getWidgetConfig?.(key) ?? {}
        const position = config.position ?? {}
        const metrics = resolveMetrics({
            widgetId: key,
            widgetEl,
            metricsCache,
            metricsCacheTtlMs,
        })
        const {blur, radius, border, margins} = metrics
        const canvasStyle = getComputedStyleSafe(canvasEl)
        const parsedWidth = parseFloat(canvasStyle?.width)
        const parsedHeight = parseFloat(canvasStyle?.height)
        const width = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : Number(canvasEl.width) || 0
        const height = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : Number(canvasEl.height) || 0

        composer.addOverlay(canvasEl, {
            x:             (Number(position.left) || 0) - normalizedCrop.left - margins.left,
            y:             (Number(position.top) || 0) - normalizedCrop.top - margins.top,
            w:             width,
            h:             height,
            contentWidth:  Math.max(0, width - (margins.left + margins.right)),
            contentHeight: Math.max(0, height - (margins.top + margins.bottom)),
            blur,
            radius,
            border,
            rotate:        config.rotate || 0,
            scale:         resolveReplayVideoWidgetScale(widgetEl, config.scale),
            shadowMargins: margins,
        })
    }
    composer.endUpdate()
}

export const isReplayVideoWidgetReady = widgetId => {
    const element = globalThis.__?.ui?.widgetManager?.getElementById?.(widgetId)
    const isMounted = typeof globalThis.__?.ui?.widgetCache?.isMounted === 'function'
                      ? globalThis.__.ui.widgetCache.isMounted(widgetId)
                      : Boolean(element)
    if (!element || !isMounted) {
        return false
    }

    const baseId = `${widgetId}`.split('#')[0]
    if (baseId === 'text-widget') {
        return true
    }

    return Boolean(element.querySelector?.('.lgs-widget-canvas'))
}
