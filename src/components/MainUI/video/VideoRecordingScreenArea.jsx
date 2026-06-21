/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoRecorderWidget }                                  from '@Components/MainUI/video/toolbox/VideoRecorderWidget'
import { VideoSceneWidgetsPortal } from '@Components/MainUI/video/VideoSceneWidgetsPortal'
import { VideoSettingsInfo }                                    from '@Components/MainUI/video/VideoSettingsInfo'
import { CropOverlay }                                          from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }       from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import {
    APP_KEY, CROP_TOOLS_WIDGETS, LGS_PROJECT, MINUTE, NAVIGATOR, SECOND, VIDEO_CROP_ZONE,
    VIDEO_TOOLS_WIDGETS, WIDGET_MOUNT_TIMEOUT, VIDEO_WIDGETS_BOARD,
} from '@Core/constants'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import { ScreenMediaRecorder }   from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WidgetMountErrorDialog } from '@Components/MainUI/video/WidgetMountErrorDialog'
import { UIToast }                                              from '@Utils/UIToast'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }           from 'valtio'

// Overlay refresh cadence (in ms). Balanced for smooth updates and low CPU.
const OVERLAYS_REFRESH_MS = 250
// Cache TTL for expensive DOM metrics (in ms).
const METRICS_CACHE_TTL_MS = 750
// Softer recorder timeslice to reduce INFO event overhead.
const SOFT_TIMESLICE_MS = SECOND * 2
const VIDEO_RECORDER_INITIALIZE_TIMEOUT_MS = 6000
const VIDEO_PIXEL_BUDGETS_BY_FPS = {
    30: 2_800_000,
    45: 2_250_000,
    60: 1_700_000,
}
const VIDEO_QUALITY_BUDGET_FACTORS = [0.9, 1, 1.12]
const VIDEO_BROWSER_BUDGET_FACTORS = {
    [NAVIGATOR.firefox]: 0.92,
    [NAVIGATOR.edge]: 0.65,
}
const VIDEO_HIGH_DPR_BUDGET_FACTORS_BY_FPS = {
    30: 1.12,
    45: 1.08,
    60: 1.04,
}
const VIDEO_MOBILE_BUDGET_FACTORS_BY_FPS = {
    30: 1.08,
    45: 1.04,
    60: 1,
}
const VIDEO_DESKTOP_MAX_DPR_BY_FPS = {
    30: 2.75,
    45: 2.5,
    60: 2.25,
}
const VIDEO_MOBILE_MAX_DPR_BY_FPS = {
    30: 2.5,
    45: 2.3,
    60: 2.1,
}

const toEvenInt = (value) => Math.max(2, Math.floor(value / 2) * 2)

const withTimeout = async (promise, timeoutMs, message) => {
    let timeoutId = null
    try {
        return await Promise.race([
                                      promise,
                                      new Promise((_, reject) => {
                                          timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
                                      }),
                                  ])
    }
    finally {
        clearTimeout(timeoutId)
    }
}

const computeRecordingOutput = ({
    cropWidth,
    cropHeight,
    fps,
    qualityIndex,
    deviceDpr,
    browser,
}) => {
    const baseWidth = Math.max(2, Math.round(cropWidth))
    const baseHeight = Math.max(2, Math.round(cropHeight))
    const nativeDpr = Math.max(1, Number(deviceDpr) || 1)
    const isHighDpr = nativeDpr > 1.25
    const platformDprCap = __.device.mobile
                           ? (VIDEO_MOBILE_MAX_DPR_BY_FPS[fps] ?? VIDEO_MOBILE_MAX_DPR_BY_FPS[30])
                           : (VIDEO_DESKTOP_MAX_DPR_BY_FPS[fps] ?? VIDEO_DESKTOP_MAX_DPR_BY_FPS[30])
    const usableDpr = Math.max(1, Math.min(nativeDpr, isHighDpr ? platformDprCap : nativeDpr))
    const nativeWidth = toEvenInt(baseWidth * usableDpr)
    const nativeHeight = toEvenInt(baseHeight * usableDpr)
    const basePixels = baseWidth * baseHeight
    const nativePixels = nativeWidth * nativeHeight
    const qualityFactor = VIDEO_QUALITY_BUDGET_FACTORS[qualityIndex] ?? 1
    const browserFactor = VIDEO_BROWSER_BUDGET_FACTORS[browser] ?? 1
    const highDprFactor = isHighDpr ? (VIDEO_HIGH_DPR_BUDGET_FACTORS_BY_FPS[fps] ?? VIDEO_HIGH_DPR_BUDGET_FACTORS_BY_FPS[30]) : 1
    const mobileFactor = __.device.mobile ? (VIDEO_MOBILE_BUDGET_FACTORS_BY_FPS[fps] ?? VIDEO_MOBILE_BUDGET_FACTORS_BY_FPS[30]) : 1
    const pixelBudget = Math.round((VIDEO_PIXEL_BUDGETS_BY_FPS[fps] ?? VIDEO_PIXEL_BUDGETS_BY_FPS[30]) * qualityFactor * browserFactor * highDprFactor * mobileFactor)
    const targetPixels = Math.max(basePixels, Math.min(nativePixels, pixelBudget))
    const scale = Math.sqrt(targetPixels / basePixels)
    const targetWidth = Math.min(nativeWidth, toEvenInt(baseWidth * scale))
    const targetHeight = Math.min(nativeHeight, toEvenInt(baseHeight * scale))
    const outputDpr = Math.max(1, Math.min(usableDpr, targetWidth / baseWidth, targetHeight / baseHeight))

    return {
        outputDpr,
        targetWidth,
        targetHeight,
        nativeWidth,
        nativeHeight,
        pixelBudget,
    }
}

/**
 * Extract overlay metrics from DOM styles, with a shallow search on children.
 * Handles CSS variables for blur (e.g. blur(var(--foo))).
 */
const getOverlayMetrics = (el, depth = 0) => {
    if (!el || depth > 2) {
        return {blur: 0, radius: 0, border: 0, margins: {top: 0, right: 0, bottom: 0, left: 0}}
    }
    const style = window.getComputedStyle(el)
    const filter = style.backdropFilter || style.webkitBackdropFilter
    let blur = 0
    const blurMatch = filter?.match(/blur\(([^)]+)\)/)
    if (blurMatch) {
        const raw = blurMatch[1].trim()
        if (raw.endsWith('px')) {
            blur = parseFloat(raw) || 0
        }
        else if (raw.startsWith('var(')) {
            const varName = raw.slice(4, -1).trim()
            const varValue = style.getPropertyValue(varName).trim()
            blur = varValue.endsWith('px') ? (parseFloat(varValue) || 0) : (parseFloat(varValue) || 0)
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
            const px = (v) => parseFloat(v) || 0
            margins = __.ui.widgetManager.getShadowMargins(px(values[0]), px(values[1]), px(values[2]), px(values[3]))
        }
    }

    if (blur > 0 || radius > 0 || border > 0 || margins.top > 0 || margins.bottom > 0 || margins.left > 0 || margins.right > 0) {
        return {blur, radius, border, margins}
    }

    for (const child of el.children) {
        const m = getOverlayMetrics(child, depth + 1)
        if (m.blur > 0 || m.radius > 0 || m.border > 0 || m.margins.top > 0 || m.margins.bottom > 0 || m.margins.left > 0 || m.margins.right > 0) {
            return m
        }
    }

    return {blur: 0, radius: 0, border: 0, margins: {top: 0, right: 0, bottom: 0, left: 0}}
}

/**
 * Resolve the effective widget scale based on CSS transforms and layout.
 * @param {HTMLElement} el
 * @param {number|{x:number,y:number}} configScale
 * @returns {{x:number,y:number}}
 */
const resolveWidgetScale = (el, configScale) => {
    const baseScaleX = typeof configScale === 'object' ? (configScale?.x ?? 1) : (configScale ?? 1)
    const baseScaleY = typeof configScale === 'object' ? (configScale?.y ?? baseScaleX) : (configScale ?? 1)
    if (!el) {
        return {x: baseScaleX, y: baseScaleY}
    }
    const style = window.getComputedStyle(el)
    const transform = style.transform
    let matrixScaleX = 0
    let matrixScaleY = 0
    if (transform && transform !== 'none') {
        try {
            const matrix = new DOMMatrixReadOnly(transform)
            matrixScaleX = Math.hypot(matrix.a, matrix.b)
            matrixScaleY = Math.hypot(matrix.c, matrix.d)
        }
        catch {
            // Ignore invalid transform matrices and keep fallback scale resolution.
        }
    }
    const rect = el.getBoundingClientRect()
    const cssWidth = parseFloat(style.width) || rect.width
    const cssHeight = parseFloat(style.height) || rect.height
    const ratioScaleX = cssWidth ? rect.width / cssWidth : 0
    const ratioScaleY = cssHeight ? rect.height / cssHeight : 0
    return {x: matrixScaleX || ratioScaleX || baseScaleX, y: matrixScaleY || ratioScaleY || baseScaleY}
}

export const VideoRecordingScreenArea = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const {maxSize, maxDuration} = useSnapshot(lgs.settings.ui.video)
    const _cropZone = useRef(null)
    const _composer = useRef(null)
    const _pendingFinish = useRef(null)
    const _overlaysRefreshRafId = useRef(null)
    const _overlaysRefreshLast = useRef(0)
    const _metricsCache = useRef(new Map())
    const _wakeLock = useRef(null)
    const _recordingStartToken = useRef(0)
    const [mountTimeoutOpen, setMountTimeoutOpen] = useState(false)
    const [mountTimeoutError] = useState({missing: [], timeoutMs: WIDGET_MOUNT_TIMEOUT})
    const [mountTimeoutAction] = useState('record')

    const updateFlythroughVideoCropRect = useCallback((cropRect = null) => {
        const flythroughStore = lgs.stores?.flythrough
        if (!flythroughStore) {
            return
        }

        flythroughStore.videoCropRect = cropRect
            && Number.isFinite(cropRect.left)
            && Number.isFinite(cropRect.top)
            && Number.isFinite(cropRect.width)
            && Number.isFinite(cropRect.height)
            && cropRect.width > 0
            && cropRect.height > 0
            ? {...cropRect}
            : null
    }, [])

    const readCrop = useCallback(() => {
        const config = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        return config?.cropDimensions
               ? {...config.cropDimensions}
               : {left: 0, top: 0, width: 0, height: 0}
    }, [])

    const [crop, setCrop] = useState(() => readCrop())

    const syncVideoCropFrame = useCallback(async (phase = 'sync', persist = false) => {
        await __.ui.widgetManager.syncCropDimensionsFromElement(VIDEO_CROP_ZONE, persist, phase)
        const config = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        if (!config?.cropDimensions) {
            updateFlythroughVideoCropRect(null)
            return null
        }
        updateFlythroughVideoCropRect(config.cropDimensions)
        return config
    }, [updateFlythroughVideoCropRect])

    useEffect(() => {
        const syncCrop = () => {
            const next = readCrop()
            updateFlythroughVideoCropRect(next)
            setCrop(current => (
                                   current.left === next.left &&
                                   current.top === next.top &&
                                   current.width === next.width &&
                                   current.height === next.height
                               ) ? current : next)
        }

        syncCrop()

        const handleCropUpdate = (event) => {
            if (!event?.detail || event.detail.id === VIDEO_CROP_ZONE) {
                syncCrop()
            }
        }

        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [readCrop, updateFlythroughVideoCropRect])

    const isValidCrop = Number.isFinite(crop.left) && crop.width > 0

    // Dispose composer and release references.
    const disposeComposer = useCallback(() => {
        _composer.current?.dispose()
        _composer.current = null
    }, [])

    // Stop live overlay refresh.
    const stopOverlaysRefresh = useCallback(() => {
        if (_overlaysRefreshRafId.current) {
            cancelAnimationFrame(_overlaysRefreshRafId.current)
            _overlaysRefreshRafId.current = null
        }
        _overlaysRefreshLast.current = 0
        _metricsCache.current.clear()
    }, [])

    // Rebuild overlay list with pooled objects.
    const buildComposerOverlays = useCallback((composer, cropRect, widgetKeys) => {
        composer.beginUpdate()

        const sortedWidgetKeys = (widgetKeys?.length ? widgetKeys : [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).entries()]
            .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
            .map(entry => entry[0]))

        for (const key of sortedWidgetKeys) {
            const widgetEl = __.ui.widgetManager.getElementById(key)
            const canvasEl = widgetEl?.querySelector('.lgs-widget-canvas')
            if (canvasEl instanceof HTMLCanvasElement) {
                const config = __.ui.widgetManager.getWidgetConfig(key)
                const now = performance.now()
                const cacheKey = key
                const cached = _metricsCache.current.get(cacheKey)
                const useCached = cached && (now - cached.time) < METRICS_CACHE_TTL_MS
                const metrics = useCached ? cached.metrics : getOverlayMetrics(widgetEl)
                if (!useCached) {
                    _metricsCache.current.set(cacheKey, {time: now, metrics})
                }
                const {blur, radius, border, margins} = metrics
                const canvasStyle = window.getComputedStyle(canvasEl)
                const width = parseFloat(canvasStyle.width)
                const height = parseFloat(canvasStyle.height)

                composer.addOverlay(canvasEl, {
                    x:             config.position.left - cropRect.left - margins.left,
                    y:             config.position.top - cropRect.top - margins.top,
                    w:             width,
                    h:             height,
                    contentWidth:  Math.max(0, width - (margins.left + margins.right)),
                    contentHeight: Math.max(0, height - (margins.top + margins.bottom)),
                    blur,
                    radius,
                    border,
                    rotate:        config.rotate || 0,
                    scale:         resolveWidgetScale(widgetEl, config.scale),
                    shadowMargins: margins,
                })
            }
        }

        composer.endUpdate()
    }, [])

    const isWidgetReadyForRecording = useCallback((widgetId) => {
        const element = __.ui.widgetManager.getElementById(widgetId)
        if (!element || !__.ui.widgetCache.isMounted(widgetId)) {
            return false
        }

        const baseId = widgetId.split('#')[0]
        if (baseId === 'text-widget') {
            return true
        }

        return Boolean(element.querySelector('.lgs-widget-canvas'))
    }, [])

    // rAF-based refresh loop to avoid setInterval bursts.
    const startOverlaysRefresh = useCallback((composer, cropRect) => {
        stopOverlaysRefresh()
        const tick = (time) => {
            if (!_composer.current) {
                _overlaysRefreshRafId.current = null
                return
            }
            if (!_overlaysRefreshLast.current) {
                _overlaysRefreshLast.current = time
            }
            if ((time - _overlaysRefreshLast.current) >= OVERLAYS_REFRESH_MS) {
                _overlaysRefreshLast.current = time
                buildComposerOverlays(composer, cropRect)
            }
            _overlaysRefreshRafId.current = requestAnimationFrame(tick)
        }
        _overlaysRefreshRafId.current = requestAnimationFrame(tick)
    }, [buildComposerOverlays, stopOverlaysRefresh])

    const requestWakeLock = useCallback(async () => {
        try {
            if (!('wakeLock' in navigator)) {
                return
            }
            if (_wakeLock.current) {
                return
            }
            _wakeLock.current = await navigator.wakeLock.request('screen')
            _wakeLock.current.addEventListener('release', () => {
                _wakeLock.current = null
            })
        }
        catch {
            // Wake Lock is best-effort only.
            _wakeLock.current = null
        }
    }, [])

    const releaseWakeLock = useCallback(async () => {
        try {
            await _wakeLock.current?.release?.()
        }
        catch {
            // Wake Lock may already be released.
        }
        _wakeLock.current = null
    }, [])

    const initializeRecorder = useCallback(async (startToken) => {
        const selectedFps = ScreenMediaRecorder.FPS[$video.fps]
        $video.settings = {quality: $video.quality, fps: $video.fps}
        const videoFrame = await syncVideoCropFrame('before-record')
        if (!videoFrame) {
            return false
        }
        if (startToken !== _recordingStartToken.current) {
            return false
        }
        const outputConfig = computeRecordingOutput({
            cropWidth: videoFrame.cropDimensions.width,
            cropHeight: videoFrame.cropDimensions.height,
            fps: selectedFps,
            qualityIndex: $video.quality,
            deviceDpr: __.device.dpr,
            browser: __.device.browser,
        })
        __.recorder.initialize({
                                   maxSize:    maxSize * 1048576,
                                    maxDuration: maxDuration * MINUTE,
                                    quality: ScreenMediaRecorder.QUALITY[$video.quality].value,
                                    filename:   APP_KEY,
                                    fps: selectedFps,
                                    timeslice: SOFT_TIMESLICE_MS,
                                    dimensions: {
                                       width: outputConfig.targetWidth,
                                       height: outputConfig.targetHeight,
                                    },
                                    ratio:      videoFrame.ratio.value,
                                    metadata: {artist: lgs.servers.studio.name, date: new Date(), album: LGS_PROJECT},
                                    useWebGL:   true,
                                })

        const {top: y, left: x, width, height} = videoFrame.cropDimensions
        disposeComposer()
        stopOverlaysRefresh()
        const composer = new CanvasOverlayComposer(lgs.canvas, {
            clip: {x, y, width, height}, width, height,
            fps: selectedFps,
            outputDpr: outputConfig.outputDpr,
            flushWebGLBuffer: () => lgs.scene.render(),
        })
        _composer.current = composer

        buildComposerOverlays(composer, videoFrame.cropDimensions)
        await composer.renderFrame({waitForNextFrame: true})
        if (startToken !== _recordingStartToken.current) {
            composer.dispose()
            return false
        }
        __.recorder.setCanvas(composer.getCanvas())
        startOverlaysRefresh(composer, videoFrame.cropDimensions)
        return true
    }, [maxDuration, maxSize, disposeComposer, stopOverlaysRefresh, buildComposerOverlays, startOverlaysRefresh, syncVideoCropFrame, $video])

    const markRecordingStarted = useCallback(() => {
        if (!$video.preRecording && $video.recording) {
            return
        }
        Object.assign($video, {
            preRecording: false,
            recording:    true,
            finalizing:   false,
            paused:       false,
            size:         0,
        })
        UIToast.warning({caption: 'Video Recording', text: 'ON AIR!'})
    }, [$video])

    const handleVideoRecording = useCallback(async () => {
        const startToken = _recordingStartToken.current + 1
        _recordingStartToken.current = startToken
        try {
            const ready = await withTimeout(
                initializeRecorder(startToken),
                VIDEO_RECORDER_INITIALIZE_TIMEOUT_MS,
                'Video recording initialization timed out on this browser.',
            )
            if (!ready) {
                Object.assign($video, {
                    preRecording: false,
                    recording:    false,
                    finalizing:   false,
                    editing:      true,
                    size:         0,
                })
                return
            }
            if (startToken !== _recordingStartToken.current) {
                return
            }
            await __.recorder.startVideo()
            markRecordingStarted()
        }
        catch (e) {
            _recordingStartToken.current += 1
            disposeComposer()
            stopOverlaysRefresh()
            Object.assign($video, {preRecording: false, recording: false, finalizing: false, editing: true, size: 0})
            console.error('[VideoRecordingScreenArea] Video recording start failed', e)
            UIToast.error({text: e?.message ?? 'Video recording could not be started.'})
        }
    }, [$video, initializeRecorder, markRecordingStarted, disposeComposer, stopOverlaysRefresh])

    const handlePhotoSnapshot = useCallback(async () => {
        const videoFrame = await syncVideoCropFrame('before-snapshot')
        if (!videoFrame) {
            Object.assign($video, {snapshot: false, finalizing: false})
            return
        }
        const selectedFps = ScreenMediaRecorder.FPS[$video.fps]
        const {top: y, left: x, width, height} = videoFrame.cropDimensions
        let composer = null

        try {
            composer = new CanvasOverlayComposer(lgs.canvas, {
                clip:             {x, y, width, height}, width, height,
                fps: selectedFps,
                flushWebGLBuffer: () => lgs.scene.render(),
            })
            buildComposerOverlays(composer, videoFrame.cropDimensions)
            await composer.renderFrame({waitForNextFrame: true})
            __.recorder.initialize({
                                       maxSize:     maxSize * 1048576,
                                       maxDuration: maxDuration * MINUTE,
                                       quality:     ScreenMediaRecorder.QUALITY[$video.quality].value,
                                       filename:    APP_KEY,
                                       fps: selectedFps,
                                       timeslice:   SOFT_TIMESLICE_MS,
                                       ratio:       videoFrame.ratio.value,
                                       metadata:    {
                                           artist: lgs.servers.studio.name,
                                           date:   new Date(),
                                           album:  LGS_PROJECT,
                                       },
                                   })
            await __.recorder.captureScreenshot(composer.getCanvas())
            Object.assign($video, {snapshot: false, finalizing: false})
        }
        catch (e) {
            Object.assign($video, {snapshot: false, finalizing: false})
            UIToast.error({text: e.message})
        }
        finally {
            composer?.dispose()
        }
    }, [$video, maxSize, maxDuration, buildComposerOverlays, syncVideoCropFrame])

    const waitingForAllWidgets = useCallback((widgets, onReady) => {
        if (!widgets?.length) {
            return () => {
            }
        }
        const observer = new MutationObserver(() => {
            if (widgets.every(isWidgetReadyForRecording)) {
                observer.disconnect()
                onReady?.(widgets)
            }
        })
        observer.observe(document.body, {childList: true, subtree: true})
        return () => observer.disconnect()
    }, [isWidgetReadyForRecording])

    useEffect(() => {
        if (!$video.preRecording && !$video.snapshot) {
            return
        }
        const keys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()]
        if (!keys.length) {
            if ($video.preRecording) {
                void handleVideoRecording()
            }
            else if ($video.snapshot) {
                void handlePhotoSnapshot()
            }
            return
        }
        let done = false
        const finish = async () => {
            if (done) {
                return
            }
            done = true
            if ($video.preRecording) {
                await handleVideoRecording()
            }
            else if ($video.snapshot) {
                await handlePhotoSnapshot()
            }
        }
        const cleanup = waitingForAllWidgets(keys, finish)
        const tid = setTimeout(() => {
            if (done) {
                return
            }
            const missing = keys.filter(k => !isWidgetReadyForRecording(k))
            _pendingFinish.current = finish
            window.dispatchEvent(new CustomEvent('widget-mount-timeout', {
                detail: {
                    missing,
                    action: $video.preRecording ? 'record' : 'snapshot',
                },
            }))
        }, WIDGET_MOUNT_TIMEOUT)
        return () => {
            cleanup?.()
            clearTimeout(tid)
            if (_pendingFinish.current === finish) {
                _pendingFinish.current = null
            }
        }
    }, [handleVideoRecording, handlePhotoSnapshot, $video.preRecording, $video.snapshot, isWidgetReadyForRecording, waitingForAllWidgets])

    useEffect(() => {
        const hStopped = () => {
            disposeComposer()
            stopOverlaysRefresh()
            releaseWakeLock()
            updateFlythroughVideoCropRect(null)
        }
        const hPaused = () => {
            stopOverlaysRefresh()
            releaseWakeLock()
        }
        const hResumed = () => {
            if (_composer.current) {
                startOverlaysRefresh(_composer.current, __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)?.cropDimensions)
            }
            requestWakeLock()
        }
        const hStarted = () => {
            markRecordingStarted()
            requestWakeLock()
        }
        __.recorder.addEventListener(ScreenMediaRecorder.events.STOP, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.CANCEL, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.FINALIZE, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.PAUSE, hPaused)
        __.recorder.addEventListener(ScreenMediaRecorder.events.RESUME, hResumed)
        __.recorder.addEventListener(ScreenMediaRecorder.events.START, hStarted)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && __.recorder.isRecording?.()) {
                requestWakeLock()
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        return () => {
            __.recorder.removeEventListener(ScreenMediaRecorder.events.STOP, hStopped)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.CANCEL, hStopped)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.FINALIZE, hStopped)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.PAUSE, hPaused)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.RESUME, hResumed)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.START, hStarted)
            document.removeEventListener('visibilitychange', handleVisibility)
            updateFlythroughVideoCropRect(null)
        }
    }, [disposeComposer, stopOverlaysRefresh, startOverlaysRefresh, requestWakeLock, releaseWakeLock, markRecordingStarted, updateFlythroughVideoCropRect])

    useEffect(() => {
        __.ui.widgetManager.windowResizing = false

        const metricsCache = _metricsCache.current
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
            disposeComposer()
            stopOverlaysRefresh()
            releaseWakeLock()
            __.ui.widgetManager.windowResizing = true
            metricsCache.clear()
        }
    }, [disposeComposer, stopOverlaysRefresh, releaseWakeLock])

    if (!isValidCrop) {
        return null
    }

    return (
        <>
            <CropOverlay
                style={{clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${crop.top}px, ${crop.left}px ${crop.top}px, ${crop.left}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top}px, 0% ${crop.top}px)`}}/>
            {(video.preRecording || video.recording) && <VideoRecorderWidget id="video-recorder-widget"/>}
            <WidgetMountErrorDialog open={mountTimeoutOpen} error={mountTimeoutError} action={mountTimeoutAction}
                                    onConfirm={() => {
                                        setMountTimeoutOpen(false)
                                        _pendingFinish.current?.()
                                    }} onCancel={() => {
                setMountTimeoutOpen(false)
                $video.preRecording = false
                $video.finalizing = false
                $video.editing = true
            }}/>
            <DefinedCropZone className="lgs-on-map-theme-vars" context={$video.cropper} infoComponent={<VideoSettingsInfo/>} ref={_cropZone}/>
            <VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper}/>
        </>
    )
})

VideoRecordingScreenArea.displayName = 'VideoRecordingScreenArea'
