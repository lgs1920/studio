/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_BASE, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { resolveVideoOverlayVisibility } from '@Core/ui/replay/ReplayOverlayResolver'
import { getReplayVideoWidgetKeys } from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import { normalizeReplayVideoCropRect } from '@Core/ui/replay/ReplayVideoRenderSpec'
import { replayVideoTraceDebug } from '@Core/ui/replay/ReplayVideoTraceDebug'
import { renderReplayWidgetFrames } from '@Core/ui/replay/ReplayWidgetFrameRenderers'
import { Widget2Canvas } from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'

const DEFAULT_METRICS_CACHE_TTL_MS = 750
const OVERLAY_FLUSH_TIMEOUT_MS = 1000
const OVERLAY_MIRROR_READY_POLL_MS = 16

const getComputedStyleSafe = element => globalThis.getComputedStyle?.(element) ?? globalThis.window?.getComputedStyle?.(element) ?? null

const parseTransformScale = transform => {
    if (!transform || transform === 'none') {
        return null
    }

    const matrixMatch = transform.match(/^matrix(3d)?\(([^)]+)\)$/)
    if (matrixMatch) {
        const values = matrixMatch[2].split(',').map(value => Number.parseFloat(value.trim()))
        if (values.every(Number.isFinite)) {
            const a = values[0]
            const b = values[1]
            const c = matrixMatch[1] ? values[4] : values[2]
            const d = matrixMatch[1] ? values[5] : values[3]
            return {x: Math.hypot(a, b), y: Math.hypot(c, d)}
        }
    }

    const scaleMatch = transform.match(/scale\(\s*([\d.+-]+)(?:\s*,\s*([\d.+-]+))?\s*\)/)
    if (scaleMatch) {
        const x = Number.parseFloat(scaleMatch[1])
        const y = Number.parseFloat(scaleMatch[2] ?? scaleMatch[1])
        if (Number.isFinite(x) && Number.isFinite(y)) {
            return {x: Math.abs(x), y: Math.abs(y)}
        }
    }

    return null
}

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
    const parsedTransformScale = parseTransformScale(transform)
    if (parsedTransformScale) {
        return parsedTransformScale
    }
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
    return {x: matrixScaleX || baseScaleX, y: matrixScaleY || baseScaleY}
}

const getSortedVideoWidgetKeys = ({widgetKeys = null, widgetsBoard = VIDEO_WIDGETS_BOARD} = {}) => {
    return getReplayVideoWidgetKeys({
        widgetKeys: Array.isArray(widgetKeys) ? widgetKeys : null,
        widgetsBoard,
    })
}

/** Resolve the same visible widget set for capture and composition on this frame. */
export const getVisibleReplayVideoWidgetKeys = ({
    widgetKeys = null,
    widgetsBoard = VIDEO_WIDGETS_BOARD,
    replay = globalThis.lgs?.stores?.replay ?? null,
    controller = globalThis.__?.ui?.replay?.controller ?? null,
} = {}) => getSortedVideoWidgetKeys({widgetKeys, widgetsBoard}).filter(widgetId => {
    const widgetEl = globalThis.__?.ui?.widgetManager?.getElementById?.(widgetId)
    return Boolean(widgetEl) && resolveVideoOverlayVisibility({widgetId, widgetEl, replay, controller})
})

/**
 * Render visible widgets and flush their dirty DOM mirrors for the current frame.
 *
 * @param {object} options - Flush options.
 * @param {string[]|null} [options.widgetKeys=null] - Optional widget IDs to flush.
 * @param {string} [options.widgetsBoard='video'] - Board containing the overlays.
 * @param {number} [options.timeoutMs=1000] - Maximum wait per overlay mirror.
 * @param {object|null} [options.frameState=null] - Canonical frame supplied to widget renderers.
 * @param {Set|null} [options.captureMirrors=null] - Mirrors owned by this export session.
 * @param {number} [options.outputDpr=1] - Physical output pixels per logical crop pixel.
 * @param {boolean} [options.strict=false] - Reject incomplete captures rather than reuse stale pixels.
 * @param {AbortSignal|null} [options.signal=null] - Export cancellation signal.
 * @returns {Promise<string[]>} Visible widget IDs whose mirrors are ready to compose.
 */
export const flushReplayVideoOverlayCanvases = async ({
                                                         widgetKeys = null,
                                                         widgetsBoard = VIDEO_WIDGETS_BOARD,
                                                         timeoutMs = OVERLAY_FLUSH_TIMEOUT_MS,
                                                         replay = globalThis.lgs?.stores?.replay ?? null,
                                                         controller = globalThis.__?.ui?.replay?.controller ?? null,
                                                         frameState = null,
                                                         captureMirrors = null,
                                                         outputDpr = 1,
                                                         strict = false,
                                                         signal = null,
                                                     } = {}) => {
    const keys = getVisibleReplayVideoWidgetKeys({widgetKeys, widgetsBoard, replay, controller})
    await renderReplayWidgetFrames({widgetKeys: keys, frameState})
    await Promise.all(keys.map(async widgetId => {
        let timeoutId = null
        let abort = null
        const startedAt = Date.now()
        let captureCancelled = false
        let mirror = Widget2Canvas.get(widgetId)
        /** Let deterministic export own refreshes without invalidating the initialized raster cache. */
        const prepareMirror = currentMirror => {
            if (!currentMirror) {
                return
            }
            if (captureMirrors) {
                currentMirror.setFrameDriven(true)
                captureMirrors.add(currentMirror)
            }

            const requiredPixelRatio = Math.max(1, Number(outputDpr) || 1)
            const currentPixelRatio = Number(currentMirror.getCapturePixelRatio?.())
            if (captureMirrors && Number.isFinite(currentPixelRatio) && requiredPixelRatio > currentPixelRatio + 0.0001) {
                currentMirror.setCapturePixelRatio?.(requiredPixelRatio)
            }

            const effectivePixelRatio = Number(currentMirror.getCapturePixelRatio?.())
            if (captureMirrors && Number.isFinite(effectivePixelRatio) && effectivePixelRatio + 0.0001 < requiredPixelRatio) {
                const supportedPixelRatio = Math.max(1, Number.isFinite(effectivePixelRatio) ? effectivePixelRatio : LGS_WIDGET_SCALE_BASE)
                throw new RangeError(
                    `Replay widget ${widgetId} can be captured at ${supportedPixelRatio} pixels per CSS pixel, `
                    + `below the ${requiredPixelRatio} required by this export. Choose a lower output resolution.`,
                )
            }
        }
        prepareMirror(mirror)
        try {
            const outcome = await Promise.race([
                (async () => {
                    let flushed = await Widget2Canvas.flush(widgetId, {onlyIfDirty: true})
                    // A widget can enter the visible set just before its React
                    // setup effect registers the DOM-to-canvas mirror. Retry
                    // that startup race instead of treating the missing mirror
                    // as a failed capture on the first Replay frame.
                    if (strict && flushed === false && !Widget2Canvas.get(widgetId)) {
                        const deadline = startedAt + timeoutMs
                        while (!captureCancelled && !mirror && Date.now() < deadline) {
                            await new Promise(resolve => setTimeout(
                                resolve,
                                Math.min(OVERLAY_MIRROR_READY_POLL_MS, Math.max(1, deadline - Date.now())),
                            ))
                            mirror = Widget2Canvas.get(widgetId)
                        }
                        if (mirror && !captureCancelled) {
                            prepareMirror(mirror)
                            flushed = await Widget2Canvas.flush(widgetId, {onlyIfDirty: true})
                        }
                    }
                    return {kind: 'flush', result: flushed}
                })(),
                new Promise(resolve => {
                    timeoutId = setTimeout(() => resolve({kind: 'timeout'}), timeoutMs)
                }),
                new Promise((_, reject) => {
                    abort = () => reject(new DOMException('Replay widget capture was aborted.', 'AbortError'))
                    if (signal?.aborted) {
                        abort()
                    }
                    else {
                        signal?.addEventListener('abort', abort, {once: true})
                    }
                }),
            ])
            if (strict && (outcome.kind === 'timeout' || outcome.result === false)) {
                const registeredMirror = Widget2Canvas.get(widgetId)
                const diagnosticMirror = registeredMirror ?? mirror
                const mirrorDiagnostics = diagnosticMirror?.getCaptureDiagnostics?.() ?? {
                    registered: Boolean(registeredMirror),
                }
                const captureDiagnostics = {
                    widgetId,
                    outcome: outcome.kind,
                    flushResult: outcome.kind === 'flush' ? outcome.result : null,
                    elapsedMs: Date.now() - startedAt,
                    timeoutMs,
                    mirror: mirrorDiagnostics,
                }
                const error = new Error(`Replay widget capture did not complete: ${widgetId}`)
                error.captureDiagnostics = captureDiagnostics
                if (mirrorDiagnostics.refreshError) {
                    error.cause = mirrorDiagnostics.refreshError
                }
                replayVideoTraceDebug('overlay-capture-failed', captureDiagnostics)
                throw error
            }
        }
        catch (error) {
            if (strict || signal?.aborted) {
                throw error
            }
        }
        finally {
            captureCancelled = true
            clearTimeout(timeoutId)
            signal?.removeEventListener('abort', abort)
        }
    }))
    return keys
}

const resolveMetrics = ({widgetId, widgetEl, metricsCache = null, metricsCacheTtlMs = DEFAULT_METRICS_CACHE_TTL_MS} = {}) => {
    if (!metricsCache?.get || !metricsCache?.set) {
        return getReplayVideoOverlayMetrics(widgetEl)
    }

    const now = globalThis.performance?.now?.() ?? Date.now()
    const cached = metricsCache.get(widgetId)
    const revision = Widget2Canvas.get(widgetId)?.getCaptureRevision?.() ?? null
    if (cached && cached.element === widgetEl && cached.revision === revision && (now - cached.time) < metricsCacheTtlMs) {
        return cached.metrics
    }

    const metrics = getReplayVideoOverlayMetrics(widgetEl)
    metricsCache.set(widgetId, {time: now, metrics, element: widgetEl, revision})
    return metrics
}

/**
 * Resolve the best captured source generated for a widget.
 *
 * SVG based Replay widgets can provide their decoded vector snapshot. Other
 * widgets use the raster canvas inserted beside or inside the widget node.
 *
 * @param {string} widgetId - Concrete widget identifier.
 * @param {HTMLElement|null} widgetElement - Mounted widget root.
 * @returns {CanvasImageSource|null} Resolved capture source.
 */
const resolveWidgetCaptureSource = (widgetId, widgetElement) => {
    const replaySource = Widget2Canvas.get(widgetId)?.getReplayCaptureSource?.()
    if (replaySource) {
        return replaySource
    }

    const descendantCanvas = widgetElement?.querySelector?.('.lgs-widget-canvas')
    if (descendantCanvas instanceof HTMLCanvasElement) {
        return descendantCanvas
    }

    const siblingCanvas = Array.from(widgetElement?.parentElement?.children ?? [])
        .find(element => element !== widgetElement && element.classList?.contains('lgs-widget-canvas'))
    return siblingCanvas instanceof HTMLCanvasElement ? siblingCanvas : null
}

/** Resolve a cached compass raster's current frame rotation and local origin. */
const resolveReplayWidgetFrameTransform = ({widgetId, widgetElement, contentWidth, contentHeight} = {}) => {
    const rotation = Number(Widget2Canvas.get(widgetId)?.getReplayFrameRotationDelta?.()) || 0
    if (!rotation) {
        return null
    }

    const transformElement = widgetElement?.matches?.('[data-replay-capture-transform="true"]')
        ? widgetElement
        : widgetElement?.querySelector?.('[data-replay-capture-transform="true"]')
    const svg = transformElement?.closest?.('svg')
    const viewBox = svg?.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number) ?? []
    const origin = transformElement?.dataset?.replayCaptureRotationOrigin?.trim().split(/[\s,]+/).map(Number) ?? []
    if (viewBox.length !== 4 || origin.length !== 2 || !viewBox.every(Number.isFinite)
        || !origin.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0) {
        return {rotation, origin: null}
    }

    return {
        rotation,
        origin: {
            x: ((origin[0] - viewBox[0]) / viewBox[2]) * contentWidth,
            y: ((origin[1] - viewBox[1]) / viewBox[3]) * contentHeight,
        },
    }
}

/**
 * Build the canvas overlays used by replay video composition.
 *
 * @param {object} options - Overlay build options.
 * @param {boolean} [options.skipVisibilityChecks=false] - Include mounted widgets without replay visibility filtering.
 * @param {{x:number,y:number}|null} [options.coordinateScale=null] - Crop-space CSS to compositor-space scale, applied once to widget geometry and effects.
 *
 * Widget positions and capture geometry stay in logical CSS pixels. The
 * coordinate scale maps those logical values into the compositor viewport;
 * CanvasOverlayComposer then applies outputDpr once when drawing to physical
 * output pixels. Widget bitmap density is controlled separately by the mirror.
 */
export const buildReplayVideoComposerOverlays = ({
                                                     composer,
                                                     cropRect,
                                                     coordinateScale = null,
                                                     sceneOverlays = [],
                                                     widgetKeys = null,
                                                     replay = globalThis.lgs?.stores?.replay ?? null,
                                                     controller = globalThis.__?.ui?.replay?.controller ?? null,
                                                     metricsCache = null,
                                                     metricsCacheTtlMs = DEFAULT_METRICS_CACHE_TTL_MS,
                                                     widgetsBoard = VIDEO_WIDGETS_BOARD,
                                                     skipVisibilityChecks = false,
                                                 } = {}) => {
    if (!composer) {
        return
    }

    const normalizedCrop = normalizeReplayVideoCropRect(cropRect) ?? {left: 0, top: 0, width: 0, height: 0}
    const scaleX = Math.max(0.000001, Number(coordinateScale?.x) || 1)
    const scaleY = Math.max(0.000001, Number(coordinateScale?.y) || 1)
    const effectScale = Math.sqrt(scaleX * scaleY)
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
        if (
            element.hidden === true
            || elementStyle?.display === 'none'
            || elementStyle?.visibility === 'hidden'
        ) {
            continue
        }

        composer.addOverlay(element, {
            x:             0,
            y:             0,
            w:             normalizedCrop.width * scaleX,
            h:             normalizedCrop.height * scaleY,
            contentWidth:  normalizedCrop.width * scaleX,
            contentHeight: normalizedCrop.height * scaleY,
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
        if (!skipVisibilityChecks && !resolveVideoOverlayVisibility({widgetId: key, widgetEl, replay, controller})) {
            continue
        }

        const captureSource = resolveWidgetCaptureSource(key, widgetEl)
        if (!captureSource) {
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
        const canvasStyle = getComputedStyleSafe(captureSource)
        const parsedWidth = parseFloat(canvasStyle?.width)
        const parsedHeight = parseFloat(canvasStyle?.height)
        const canvasWidth = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : Number(captureSource.width) || 0
        const canvasHeight = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : Number(captureSource.height) || 0
        const captureGeometry = Widget2Canvas.get(key)?.getCaptureGeometry?.()
        const captureWidth = Number(captureGeometry?.width) || 0
        const captureHeight = Number(captureGeometry?.height) || 0
        const width = captureWidth > 0 ? captureWidth : canvasWidth
        const height = captureHeight > 0 ? captureHeight : canvasHeight
        const captureOffsetX = Number(captureGeometry?.offsetX)
        const captureOffsetY = Number(captureGeometry?.offsetY)
        const hasCaptureViewBoxOrigin = Number.isFinite(captureOffsetX) && Number.isFinite(captureOffsetY)
        const overlayX = hasCaptureViewBoxOrigin
            ? (Number(position.left) || 0) - normalizedCrop.left - captureOffsetX
            : (Number(position.left) || 0) - normalizedCrop.left - margins.left
        const overlayY = hasCaptureViewBoxOrigin
            ? (Number(position.top) || 0) - normalizedCrop.top - captureOffsetY
            : (Number(position.top) || 0) - normalizedCrop.top - margins.top
        const contentWidth = Math.max(0, width - (margins.left + margins.right)) * scaleX
        const contentHeight = Math.max(0, height - (margins.top + margins.bottom)) * scaleY
        const frameTransform = resolveReplayWidgetFrameTransform({
            widgetId: key,
            widgetElement: widgetEl,
            contentWidth,
            contentHeight,
        })

        composer.addOverlay(captureSource, {
            x:             overlayX * scaleX,
            y:             overlayY * scaleY,
            w:             width * scaleX,
            h:             height * scaleY,
            contentWidth,
            contentHeight,
            blur:          blur * effectScale,
            radius:        radius * effectScale,
            border:        border * effectScale,
            rotate:        config.rotate || 0,
            frameRotate:   frameTransform?.rotation ?? 0,
            frameRotationOrigin: frameTransform?.origin ?? null,
            scale:         resolveReplayVideoWidgetScale(widgetEl, config.scale),
            shadowMargins: {
                top: margins.top * scaleY,
                right: margins.right * scaleX,
                bottom: margins.bottom * scaleY,
                left: margins.left * scaleX,
            },
        })
    }
    composer.endUpdate()
}

/**
 * Require a mounted widget and a capture surface only when it is currently visible.
 * Hidden timeline widgets create their first bitmap when capture reaches their clip.
 * @param {string} widgetId - Concrete video widget identifier.
 * @returns {boolean} Whether the widget can participate in the current frame.
 */
export const isReplayVideoWidgetReady = widgetId => {
    const element = globalThis.__?.ui?.widgetManager?.getElementById?.(widgetId)
    const isMounted = typeof globalThis.__?.ui?.widgetCache?.isMounted === 'function'
                      ? globalThis.__.ui.widgetCache.isMounted(widgetId)
                      : Boolean(element)
    if (!element || !isMounted) {
        return false
    }

    if (!resolveVideoOverlayVisibility({widgetId, widgetEl: element})) {
        return true
    }

    return Boolean(resolveWidgetCaptureSource(widgetId, element))
}
