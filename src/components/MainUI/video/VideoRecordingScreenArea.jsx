/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-17
 * Last modified: 2026-02-17
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

const getStyles = (el, depth = 0) => {
    if (!el || depth > 2) {
        return {blur: 0, radius: 0}
    }
    const style = window.getComputedStyle(el)
    const filter = style.backdropFilter || style.webkitBackdropFilter
    const blurMatch = filter?.match(/blur\(([\d.]+)px\)/)
    const blur = blurMatch ? parseFloat(blurMatch[1]) : 0
    const radiusMatch = style.borderRadius?.match(/(\d+)px/)
    const radius = radiusMatch ? parseFloat(radiusMatch[1]) : 0
    const borderWidthMatch = style.borderWidth?.match(/([\d.]+)px/)
    const border = borderWidthMatch ? parseFloat(borderWidthMatch[1]) : 0
    if (blur > 0 || radius > 0 || border > 0) {
        return {blur, radius, border}
    }
    for (const child of el.children) {
        const s = getStyles(child, depth + 1)
        if (s.blur > 0 || s.radius > 0) {
            return s
        }
    }
    return {blur: 0, radius: 0, border: 0}
}

const getShadowParameters = (el, depth = 0) => {
    if (!el || depth > 2) {
        return {top: 0, right: 0, bottom: 0, left: 0}
    }
    const style = window.getComputedStyle(el)
    const shadow = style.boxShadow
    if (shadow && shadow !== 'none') {
        const values = shadow.match(/(-?[\d.]+)px/g)
        if (values && values.length >= 2) {
            const px = (v) => parseFloat(v) || 0
            return __.ui.widgetManager.getShadowMargins(px(values[0]), px(values[1]), px(values[2]), px(values[3]))
        }
    }
    for (const child of el.children) {
        const m = getShadowParameters(child, depth + 1)
        if (m.top > 0 || m.bottom > 0 || m.right > 0 || m.left > 0) {
            return m
        }
    }
    return {top: 0, right: 0, bottom: 0, left: 0}
}

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
    const {maxSize, maxDuration} = useSnapshot(lgs.settings.ui.video)
    const _cropZone = useRef(null)
    const _composer = useRef(null)
    const _pendingFinish = useRef(null)
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

    const disposeComposer = useCallback(() => {
        _composer.current?.dispose()
        _composer.current = null
    }, [])

    const initializeRecorder = useCallback(async () => {
        $video.settings = {quality: $video.quality, fps: $video.fps}
        const configs = __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS)
        const videoFrame = configs.find(c => c.id === VIDEO_CROP_ZONE)
        if (!videoFrame) {
            return
        }

        __.recorder.initialize({
                                   maxSize:    maxSize * 1048576,
                                   maxDuration: maxDuration * MINUTE,
                                   quality: ScreenMediaRecorder.QUALITY[$video.quality].value,
                                   filename:   APP_KEY,
                                   fps:        ScreenMediaRecorder.FPS[$video.fps],
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
        const composer = new CanvasOverlayComposer(lgs.canvas, {
            clip: {x, y, width, height}, width, height,
            flushWebGLBuffer: () => lgs.scene.render(),
        })
        _composer.current = composer

        // // Painter's Algorithm: Sort ASCENDING (Background to Foreground) for canvas drawing
        const sortedWidgetKeys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).entries()]
            .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
            .map(entry => entry[0])

        for (const key of sortedWidgetKeys) {
            const widgetEl = __.ui.widgetManager.getElementById(key)
            const canvasEl = widgetEl?.querySelector('.lgs-widget-canvas')
            if (canvasEl instanceof HTMLCanvasElement) {
                const config = __.ui.widgetManager.getWidgetConfig(key)
                const margins = getShadowParameters(widgetEl)
                const styles = getStyles(widgetEl)

                composer.addOverlay(canvasEl, {
                    x:             config.position.left - crop.left - margins.left,
                    y:             config.position.top - crop.top - margins.top,
                    w:             parseFloat(window.getComputedStyle(canvasEl).width),
                    h:             parseFloat(window.getComputedStyle(canvasEl).height),
                    contentWidth:  Math.max(0, parseFloat(window.getComputedStyle(canvasEl).width) - (margins.left + margins.right)),
                    contentHeight: Math.max(0, parseFloat(window.getComputedStyle(canvasEl).height) - (margins.top + margins.bottom)),
                    blur:          styles.blur,
                    radius:        styles.radius,
                    border:        styles.border,
                    rotate:        config.rotate || 0,
                    scale:         resolveWidgetScale(widgetEl, config.scale),
                    shadowMargins: margins,
                })
            }
        }
        __.recorder.setCanvas(composer.getCanvas())
    }, [$video.quality, $video.fps, crop, maxDuration, maxSize, disposeComposer])

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
            flushWebGLBuffer: () => lgs.scene.render(),
        })

        // Painter's Algorithm: Sort ASCENDING for composer
        const sortedWidgetKeys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).entries()]
            .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
            .map(entry => entry[0])

        for (const key of sortedWidgetKeys) {
            const el = __.ui.widgetManager.getElementById(key)
            const canvas = el?.querySelector('.lgs-widget-canvas')
            if (canvas instanceof HTMLCanvasElement) {
                const cfg = __.ui.widgetManager.getWidgetConfig(key)
                const margins = getShadowParameters(el)
                const styles = getStyles(el)

                composer.addOverlay(canvas, {
                    x:             cfg.position.left - x - margins.left,
                    y:             cfg.position.top - y - margins.top,
                    w:             parseFloat(window.getComputedStyle(canvas).width),
                    h:             parseFloat(window.getComputedStyle(canvas).height),
                    contentWidth:  Math.max(0, parseFloat(window.getComputedStyle(canvas).width) - (margins.left + margins.right)),
                    contentHeight: Math.max(0, parseFloat(window.getComputedStyle(canvas).height) - (margins.top + margins.bottom)),
                    blur:          styles.blur, radius: styles.radius, border: styles.border,
                    rotate:        cfg.rotate || 0, scale: resolveWidgetScale(el, cfg.scale), shadowMargins: margins,
                })
            }
        }

        await initializeRecorder()
        try {
            await __.recorder.captureScreenshot(composer.getCanvas())
        }
        finally {
            composer.dispose()
        }
    }, [initializeRecorder])

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
        const hStopped = () => disposeComposer()
        __.recorder.addEventListener(ScreenMediaRecorder.events.STOP, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.CANCEL, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.FINALIZE, hStopped)
        return () => {
            __.recorder.removeEventListener(ScreenMediaRecorder.events.STOP, hStopped)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.CANCEL, hStopped)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.FINALIZE, hStopped)
        }
    }, [disposeComposer])

    useEffect(() => {
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
            disposeComposer()
        }
    }, [disposeComposer])

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
                console.log('widgetCacheEntries', key, props),
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