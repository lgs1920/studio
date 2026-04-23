/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-23
 * Last modified: 2026-04-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoRecorderWidget }                                  from '@Components/MainUI/video/toolbox/VideoRecorderWidget'
import { VideoMessage }                                         from '@Components/MainUI/video/VideoMessage'
import { VideoSettingsInfo }                                    from '@Components/MainUI/video/VideoSettingsInfo'
import { DynamicWidget }                                        from '@Components/MainUI/widgets/DynamicWidget'
import { CropOverlay }                                          from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }       from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import {
    APP_KEY, CROP_TOOLS_WIDGETS, LGS_PROJECT, MINUTE, SECOND, VIDEO_CROP_ZONE,
    VIDEO_TOOLS_WIDGETS, VIDEO_WIDGETS_BOARD, WIDGET_MOUNT_TIMEOUT,
} from '@Core/constants'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import { ScreenMediaRecorder }   from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WidgetMountErrorDialog } from '@Components/MainUI/video/WidgetMountErrorDialog'
import { UIToast }                                              from '@Utils/UIToast'
import classNames                from 'classnames'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }           from 'valtio'

// Overlay refresh cadence (in ms). Balanced for smooth updates and low CPU.
const OVERLAYS_REFRESH_MS = 250
// Cache TTL for expensive DOM metrics (in ms).
const METRICS_CACHE_TTL_MS = 750
// Softer recorder timeslice to reduce INFO event overhead.
const SOFT_TIMESLICE_MS = SECOND * 2
// Adaptive quality sampling interval (in ms).
const ADAPTIVE_QUALITY_SAMPLE_MS = 1000
// Adaptive quality defaults.
const ADAPTIVE_QUALITY_DEFAULTS = {
    enabled:    false,
    startIndex: 1, // medium
    minIndex:   0,
    maxIndex:   3,
    overloadMs: 28,
    coolMs:     16,
    downHoldMs: 3000,
    upHoldMs:   5000,
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
        catch (e) {
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
    const {maxSize, maxDuration, adaptiveFps, adaptiveQuality} = useSnapshot(lgs.settings.ui.video)
    const _cropZone = useRef(null)
    const _composer = useRef(null)
    const _pendingFinish = useRef(null)
    const _overlaysRefreshRafId = useRef(null)
    const _overlaysRefreshLast = useRef(0)
    const _metricsCache = useRef(new Map())
    const _adaptiveQualityTimer = useRef(null)
    const _adaptiveQualityState = useRef({index: null, overloadSince: 0, coolSince: 0})
    const _wakeLock = useRef(null)
    const [mountTimeoutOpen, setMountTimeoutOpen] = useState(false)
    const [mountTimeoutError, setMountTimeoutError] = useState({missing: [], timeoutMs: WIDGET_MOUNT_TIMEOUT})
    const [mountTimeoutAction, setMountTimeoutAction] = useState('record')

    const crop = useMemo(() => {
        const config = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        return config?.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0}
    }, [])

    /**
     * Cache entries sorted DESCENDING for React rendering (Top to Bottom).
     * Includes all cache props (zIndex, etc.) passed to DynamicWidget.
     */
    const widgetCacheEntries = useMemo(() => {
        return [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).entries()]
            .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
    }, [])

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

    const stopAdaptiveQuality = useCallback(() => {
        if (_adaptiveQualityTimer.current) {
            clearInterval(_adaptiveQualityTimer.current)
            _adaptiveQualityTimer.current = null
        }
        _adaptiveQualityState.current = {index: null, overloadSince: 0, coolSince: 0}
    }, [])

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
        catch (e) {
            _wakeLock.current = null
        }
    }, [])

    const releaseWakeLock = useCallback(async () => {
        try {
            await _wakeLock.current?.release?.()
        }
        catch (e) {
        }
        _wakeLock.current = null
    }, [])

    const startAdaptiveQuality = useCallback((composer) => {
        stopAdaptiveQuality()
        const config = {...ADAPTIVE_QUALITY_DEFAULTS, ...(typeof adaptiveQuality === 'object' ? adaptiveQuality : {})}
        const enabled = (adaptiveQuality === true) ? true : config.enabled
        if (!enabled) {
            return
        }
        const startIndex = Math.min(config.maxIndex, Math.max(config.minIndex, config.startIndex))
        if (_adaptiveQualityState.current.index == null) {
            _adaptiveQualityState.current.index = startIndex
            $video.quality = startIndex
            __.recorder.setQualityIndex?.(startIndex)
        }

        _adaptiveQualityTimer.current = setInterval(() => {
            if (!_composer.current) {
                return
            }
            const {emaMs} = composer.getRenderStats?.() || {}
            if (!emaMs) {
                return
            }
            const now = performance.now()
            if (emaMs > config.overloadMs) {
                if (!_adaptiveQualityState.current.overloadSince) {
                    _adaptiveQualityState.current.overloadSince = now
                }
                _adaptiveQualityState.current.coolSince = 0
            }
            else if (emaMs < config.coolMs) {
                if (!_adaptiveQualityState.current.coolSince) {
                    _adaptiveQualityState.current.coolSince = now
                }
                _adaptiveQualityState.current.overloadSince = 0
            }
            else {
                _adaptiveQualityState.current.overloadSince = 0
                _adaptiveQualityState.current.coolSince = 0
            }

            const currentIndex = _adaptiveQualityState.current.index ?? startIndex
            if (_adaptiveQualityState.current.overloadSince &&
                (now - _adaptiveQualityState.current.overloadSince) >= config.downHoldMs &&
                currentIndex > config.minIndex) {
                const next = currentIndex - 1
                _adaptiveQualityState.current.index = next
                _adaptiveQualityState.current.overloadSince = 0
                $video.quality = next
                __.recorder.setQualityIndex?.(next)
                return
            }

            if (_adaptiveQualityState.current.coolSince &&
                (now - _adaptiveQualityState.current.coolSince) >= config.upHoldMs &&
                currentIndex < config.maxIndex) {
                const next = currentIndex + 1
                _adaptiveQualityState.current.index = next
                _adaptiveQualityState.current.coolSince = 0
                $video.quality = next
                __.recorder.setQualityIndex?.(next)
            }
        }, ADAPTIVE_QUALITY_SAMPLE_MS)
    }, [adaptiveQuality, stopAdaptiveQuality, $video])

    const initializeRecorder = useCallback(async () => {
        const adaptiveConfig = {...ADAPTIVE_QUALITY_DEFAULTS, ...(typeof adaptiveQuality === 'object' ? adaptiveQuality : {})}
        const adaptiveEnabled = (adaptiveQuality === true) ? true : adaptiveConfig.enabled
        if (adaptiveEnabled) {
            const startIndex = Math.min(adaptiveConfig.maxIndex, Math.max(adaptiveConfig.minIndex, adaptiveConfig.startIndex))
            $video.quality = startIndex
            _adaptiveQualityState.current.index = startIndex
        }
        $video.settings = {quality: $video.quality, fps: $video.fps}
        const configs = __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS)
        const videoFrame = configs.find(c => c.id === VIDEO_CROP_ZONE)
        if (!videoFrame) {
            return
        }
        console.log($video)
        __.recorder.initialize({
                                   maxSize:    maxSize * 1048576,
                                   maxDuration: maxDuration * MINUTE,
                                   quality: ScreenMediaRecorder.QUALITY[$video.quality].value,
                                   filename:   APP_KEY,
                                   fps:        ScreenMediaRecorder.FPS[$video.fps],
                                   timeslice: SOFT_TIMESLICE_MS,
                                   dimensions: {
                                       width: videoFrame.cropDimensions.width * __.device.dpr,
                                       height: videoFrame.cropDimensions.height * __.device.dpr,
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
            fps: ScreenMediaRecorder.FPS[$video.fps],
            adaptiveFps,
            flushWebGLBuffer: () => lgs.scene.render(),
        })
        _composer.current = composer

        buildComposerOverlays(composer, videoFrame.cropDimensions)
        __.recorder.setCanvas(composer.getCanvas())
        startOverlaysRefresh(composer, videoFrame.cropDimensions)
        startAdaptiveQuality(composer)
    }, [$video.quality, $video.fps, maxDuration, maxSize, adaptiveQuality, adaptiveFps, disposeComposer, stopOverlaysRefresh, buildComposerOverlays, startOverlaysRefresh, startAdaptiveQuality, $video])

    const handleVideoRecording = useCallback(async () => {
        try {
            await initializeRecorder()
            await __.recorder.startVideo()
        }
        catch (e) {
            Object.assign($video, {recording: false, size: 0})
            UIToast.error({text: e.message})
        }
    }, [initializeRecorder])

    const handlePhotoSnapshot = useCallback(async () => {
        const videoFrame = __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS).find(c => c.id === VIDEO_CROP_ZONE)
        if (!videoFrame) {
            return
        }
        const {top: y, left: x, width, height} = videoFrame.cropDimensions
        const composer = new CanvasOverlayComposer(lgs.canvas, {
            clip:             {x, y, width, height}, width, height,
            fps: ScreenMediaRecorder.FPS[$video.fps],
            adaptiveFps,
            flushWebGLBuffer: () => lgs.scene.render(),
        })

        buildComposerOverlays(composer, videoFrame.cropDimensions)

        await initializeRecorder()
        try {
            await __.recorder.captureScreenshot(composer.getCanvas())
        }
        finally {
            composer.dispose()
            stopAdaptiveQuality()
        }
    }, [initializeRecorder, buildComposerOverlays, stopAdaptiveQuality])

    const waitingForAllWidgets = (widgets, onReady) => {
        if (!widgets?.length) {
            return () => {
            }
        }
        const observer = new MutationObserver(() => {
            if (widgets.every(k => __.ui.widgetManager.getElementById(k)?.querySelector('.lgs-widget-canvas'))) {
                observer.disconnect()
                onReady?.(widgets)
            }
        })
        observer.observe(document.body, {childList: true, subtree: true})
        return () => observer.disconnect()
    }

    useEffect(() => {
        if (!$video.preRecording && !$video.snapshot) {
            return
        }
        const keys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()]
        if (!keys.length) {
            if ($video.preRecording) {
                $video.preRecording = false
                $video.recording = true
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
                $video.preRecording = false
                $video.recording = true
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
            const missing = keys.filter(k => !__.ui.widgetManager.getElementById(k)?.querySelector('.lgs-widget-canvas'))
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
    }, [handleVideoRecording, handlePhotoSnapshot, $video.preRecording, $video.snapshot])

    useEffect(() => {
        const hStopped = () => {
            disposeComposer()
            stopOverlaysRefresh()
            stopAdaptiveQuality()
            releaseWakeLock()
        }
        const hPaused = () => {
            stopOverlaysRefresh()
            stopAdaptiveQuality()
            releaseWakeLock()
        }
        const hResumed = () => {
            if (_composer.current) {
                startOverlaysRefresh(_composer.current, __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS).find(c => c.id === VIDEO_CROP_ZONE)?.cropDimensions)
                startAdaptiveQuality(_composer.current)
            }
            requestWakeLock()
        }
        const hStarted = () => {
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
        }
    }, [disposeComposer, stopOverlaysRefresh, startOverlaysRefresh, stopAdaptiveQuality, startAdaptiveQuality, requestWakeLock, releaseWakeLock])

    useEffect(() => {
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
            disposeComposer()
            stopOverlaysRefresh()
            stopAdaptiveQuality()
            releaseWakeLock()
            _metricsCache.current.clear()
        }
    }, [disposeComposer, stopOverlaysRefresh, stopAdaptiveQuality, releaseWakeLock])

    if (!isValidCrop) {
        return null
    }

    return (
        <>
            {!video.recording && <CropOverlay
                style={{clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${crop.top}px, ${crop.left}px ${crop.top}px, ${crop.left}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top}px, 0% ${crop.top}px)`}}/>}
            {video.recording && <VideoRecorderWidget id="video-recorder-widget"/>}
            <WidgetMountErrorDialog open={mountTimeoutOpen} error={mountTimeoutError} action={mountTimeoutAction}
                                    onConfirm={() => {
                                        setMountTimeoutOpen(false)
                                        _pendingFinish.current?.()
                                    }} onCancel={() => {
                setMountTimeoutOpen(false)
                $video.preRecording = false
                $video.editing = true
            }}/>
            <DefinedCropZone context={$video.cropper}
                             className={classNames({'video-recording-in-progress': video.recording})}
                             infoComponent={<VideoSettingsInfo/>} ref={_cropZone}/>
            {widgetCacheEntries.map(([key, props]) => (
                    <DynamicWidget
                        key={key}
                        id={key}
                        props={props}
                        context={lgs.stores.ui.video.cropper}
                    />
            ))}
        </>
    )
})

VideoRecordingScreenArea.displayName = 'VideoRecordingScreenArea'
