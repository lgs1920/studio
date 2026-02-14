/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-15
 * Last modified: 2026-02-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoRecorderWidget }                                  from '@Components/MainUI/video/toolbox/VideoRecorderWidget'
import { VideoMessage }                                         from '@Components/MainUI/video/VideoMessage'
import { VideoSettingsInfo }                                    from '@Components/MainUI/video/VideoSettingsInfo'
import { DynamicWidget }                                        from '@Components/MainUI/widgets/DynamicWidget'
import { CropOverlay }                                          from '@Components/ToolsUI/cropper/CropOverlay'
import {
    DefinedCropZone,
}                                                               from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import {
    APP_KEY, CROP_TOOLS_WIDGETS, LGS_PROJECT, MINUTE, SECOND, VIDEO_CROP_ZONE,
    VIDEO_TOOLS_WIDGETS,
    VIDEO_WIDGETS_BOARD,
    WIDGET_MOUNT_TIMEOUT,
} from '@Core/constants'
import {
    CanvasOverlayComposer,
}                                                               from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {
    ScreenMediaRecorder,
}                                                               from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WidgetMountErrorDialog } from '@Components/MainUI/video/WidgetMountErrorDialog'
import { UIToast }                                              from '@Utils/UIToast'
import classNames from 'classnames'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'

/**
 * Extracts blur and radius values from an element or its children (depth 2)
 * @param {HTMLElement} el
 * @param {number} depth
 * @returns {{blur: number, radius: number}}
 */
const getStyles = (el, depth = 0) => {
    if (!el || depth > 2) {
        return {blur: 0, radius: 0}
    }

    const style = window.getComputedStyle(el)

    // Backdrop filter detection
    const filter = style.backdropFilter || style.webkitBackdropFilter
    const blurMatch = filter?.match(/blur\(([\d.]+)px\)/)
    const blur = blurMatch ? parseFloat(blurMatch[1]) : 0

    // Border radius detection
    const radiusMatch = style.borderRadius?.match(/(\d+)px/)
    const radius = radiusMatch ? parseFloat(radiusMatch[1]) : 0

    // Border width detection
    const borderWidthMatch = style.borderWidth?.match(/([\d.]+)px/)
    const border = borderWidthMatch ? parseFloat(borderWidthMatch[1]) : 0

    // Stop if any found
    if (blur > 0 || radius > 0 || border > 0) {
        return {blur, radius, border}
    }

    for (const child of el.children) {
        const childStyles = getStyles(child, depth + 1)
        if (childStyles.blur > 0 || childStyles.radius > 0) {
            return childStyles
        }
    }

    return {blur: 0, radius: 0, border: 0}
}

/**
 * Recursively finds box-shadow and converts it to logical margins
 */
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
        const childMargins = getShadowParameters(child, depth + 1)
        if (childMargins.top > 0 || childMargins.bottom > 0 || childMargins.right > 0 || childMargins.left > 0) {
            return childMargins
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
        catch (error) {
            matrixScaleX = 0
            matrixScaleY = 0
        }
    }

    // Fallback using the rendered size ratio (handles ancestor transforms)
    const rect = el.getBoundingClientRect()
    const cssWidth = parseFloat(style.width) || rect.width
    const cssHeight = parseFloat(style.height) || rect.height
    const ratioScaleX = cssWidth ? rect.width / cssWidth : 0
    const ratioScaleY = cssHeight ? rect.height / cssHeight : 0

    return {
        x: matrixScaleX || ratioScaleX || baseScaleX,
        y: matrixScaleY || ratioScaleY || baseScaleY,
    }
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

    const widgetCacheEntries = useMemo(() => [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).entries()], [])

    const isValidCrop = Number.isFinite(crop.left) && crop.width > 0

    const disposeComposer = useCallback(() => {
        _composer.current?.dispose()
        _composer.current = null
    }, [])

    useEffect(() => {
        if (_cropZone.current) {
            _cropZone.current.style.animationPlayState = video.paused ? 'paused' : 'running'
        }
    }, [video.paused])

    /**
     * Prepares the recorder and composes the canvas overlays.
     * Optimizes rendering by sorting widgets based on their DOM zIndex before composition.
     */
    const initializeRecorder = useCallback(() => {
        $video.settings = {quality: $video.quality, fps: $video.fps}

        const configs = __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS)
        const videoFrame = configs.find(config => config.id === VIDEO_CROP_ZONE)
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
                                   metadata:   {
                                       artist: lgs.servers.studio.name,
                                       date:   new Date(),
                                       album:  LGS_PROJECT,
                                   },
                                   useWebGL:   true,
                               })

        const {top: y, left: x, width, height} = videoFrame.cropDimensions
        videoFrame.noResize = true

        disposeComposer()
        const composer = new CanvasOverlayComposer(lgs.canvas, {
            clip: {x, y, width, height},
            width, height,
            flushWebGLBuffer: () => lgs.scene.render(),
        })
        _composer.current = composer

        // 1. Collect all widget data and their DOM zIndex
        const overlayData = []
        const widgetKeys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()]

        for (const key of widgetKeys) {
            const widgetEl = __.ui.widgetManager.getElementById(key)
            const canvasEl = widgetEl?.querySelector('.lgs-widget-canvas')

            if (canvasEl instanceof HTMLCanvasElement) {
                const config = __.ui.widgetManager.getWidgetConfig(key)
                const styles = getStyles(widgetEl)
                const shadowMargins = getShadowParameters(widgetEl)
                const canvasStyle = window.getComputedStyle(canvasEl)
                const widgetScale = resolveWidgetScale(widgetEl, config.scale)

                // Read zIndex from computed style for accurate DOM layering
                const zIndex = parseInt(window.getComputedStyle(widgetEl).zIndex, 10) || 0

                overlayData.push({
                                     canvasEl,
                                     zIndex,
                                     params: {
                                         x:             config.position.left - crop.left - shadowMargins.left,
                                         y:             config.position.top - crop.top - shadowMargins.top,
                                         w:             parseFloat(canvasStyle.width),
                                         h:             parseFloat(canvasStyle.height),
                                         contentWidth:  Math.max(0, parseFloat(canvasStyle.width) - (shadowMargins.left + shadowMargins.right)),
                                         contentHeight: Math.max(0, parseFloat(canvasStyle.height) - (shadowMargins.top + shadowMargins.bottom)),
                                         blur:          styles.blur,
                                         radius:        styles.radius,
                                         border:        styles.border,
                                         rotate:        config.rotate || 0,
                                         scale:         widgetScale,
                                         shadowMargins,
                                     },
                                 })
            }
        }

        // 2. Sort by ascending zIndex to ensure correct painting order (painter's algorithm)
        overlayData.sort((a, b) => a.zIndex - b.zIndex)

        // 3. Add to composer in order
        for (const item of overlayData) {
            composer.addOverlay(item.canvasEl, item.params)
        }

        __.recorder.setCanvas(composer.getCanvas())

    }, [$video.ratio, disposeComposer, maxDuration, maxSize, $video.fps, $video.quality, crop])

    const handleVideoRecording = useCallback(async () => {
        try {
            initializeRecorder()
            await __.recorder.startVideo()
        }
        catch (error) {
            Object.assign($video, {recording: false, paused: false, size: 0})
            UIToast.error({caption: 'Video capture', text: error.message})
        }
    }, [initializeRecorder])


    const handlePhotoSnapshot = useCallback(async () => {
        const configs = __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS)
        const widget = configs.find(config => config.id === VIDEO_CROP_ZONE)
        if (!widget) {
            return
        }

        const {top: y, left: x, width, height} = widget.cropDimensions
        const composer = new CanvasOverlayComposer(lgs.canvas, {
            clip: {x, y, width, height},
                  width, height,
                  flushWebGLBuffer: () => lgs.scene.render(),
              })

        ;[...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()].map(key => {
            const widgetEl = __.ui.widgetManager.getElementById(key)
            const canvasEl = widgetEl?.querySelector('.lgs-widget-canvas')
            console.log('Adding overlay:', canvasEl.id)
            if (canvasEl instanceof HTMLCanvasElement) {
                const config = __.ui.widgetManager.getWidgetConfig(key)
                const styles = getStyles(widgetEl)
                const shadowMargins = getShadowParameters(widgetEl)

                // config.position contains coordinates relative to the Studio origin
                // x, y are coordinates of the crop relative to the Studio origin
                // The canvas includes the shadow, so we need to offset by shadow margins
                const localX = config.position.left - x - shadowMargins.left
                const localY = config.position.top - y - shadowMargins.top

                // Get canvas CSS dimensions (logical pixels)
                const canvasStyle = window.getComputedStyle(canvasEl)
                const canvasWidth = parseFloat(canvasStyle.width)
                const canvasHeight = parseFloat(canvasStyle.height)
                const widgetScale = resolveWidgetScale(widgetEl, config.scale)
                const contentWidth = Math.max(0, canvasWidth - (shadowMargins.left + shadowMargins.right))
                const contentHeight = Math.max(0, canvasHeight - (shadowMargins.top + shadowMargins.bottom))

                composer.addOverlay(canvasEl, {
                    x:        localX,
                    y:        localY,
                    w:        canvasWidth,
                    h:        canvasHeight,
                    contentWidth,
                    contentHeight,
                    blur:     styles.blur,
                    radius:   styles.radius,
                    border: styles.border,
                    rotate:   config.rotate || 0,
                    scale: widgetScale,
                    shadowMargins,
                })
            }
        })

        initializeRecorder()
        try {
            await __.recorder.captureScreenshot(composer.getCanvas())
        }
        finally {
            composer.dispose()
        }
    }, [initializeRecorder])

    const waitingForAllWidgets = (widgets, onReady) => {
        if (!widgets || widgets.length === 0) {
            return () => {
            }
        }
        const observer = new MutationObserver(() => {
            const allInDOM = widgets.every(k => __.ui.widgetManager.getElementById(k)?.querySelector('.lgs-widget-canvas'))
            if (allInDOM) {
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
        const widgetKeys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()]
        if (!widgetKeys || widgetKeys.length === 0) {
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

        const cleanup = waitingForAllWidgets(widgetKeys, finish)

        const timeoutId = setTimeout(() => {
            if (done) {
                return
            }
            const missing = widgetKeys.filter(k => {
                const el = __.ui.widgetManager.getElementById(k)
                return !el?.querySelector('.lgs-widget-canvas')
            })
            _pendingFinish.current = finish
            window.dispatchEvent(new CustomEvent('widget-mount-timeout', {
                detail: {
                    missing,
                    timeoutMs: WIDGET_MOUNT_TIMEOUT,
                    action:    $video.preRecording ? 'record' : 'snapshot',
                },
            }))
        }, WIDGET_MOUNT_TIMEOUT)
        return () => {
            cleanup?.()
            clearTimeout(timeoutId)
            if (_pendingFinish.current === finish) {
                _pendingFinish.current = null
            }
        }
    }, [handleVideoRecording, handlePhotoSnapshot, $video.preRecording, $video.snapshot])

    useEffect(() => {
        const handleTimeout = (event) => {
            const missing = Array.isArray(event?.detail?.missing) ? event.detail.missing : []
            const timeoutMs = event?.detail?.timeoutMs ?? WIDGET_MOUNT_TIMEOUT
            const action = event?.detail?.action || 'record'
            setMountTimeoutError({missing, timeoutMs})
            setMountTimeoutAction(action)
            setMountTimeoutOpen(true)
        }
        window.addEventListener('widget-mount-timeout', handleTimeout)
        return () => window.removeEventListener('widget-mount-timeout', handleTimeout)
    }, [])

    useEffect(() => {
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
            disposeComposer()
        }
    }, [disposeComposer])

    useEffect(() => {
        const handleStop = () => disposeComposer()
        __.recorder.addEventListener(ScreenMediaRecorder.events.STOP, handleStop)
        __.recorder.addEventListener(ScreenMediaRecorder.events.CANCEL, handleStop)
        __.recorder.addEventListener(ScreenMediaRecorder.events.FINALIZE, handleStop)

        return () => {
            __.recorder.removeEventListener(ScreenMediaRecorder.events.STOP, handleStop)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.CANCEL, handleStop)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.FINALIZE, handleStop)
        }
    }, [disposeComposer])

    if (!isValidCrop) {
        return null
    }

    const overlayStyle = useMemo(() => ({
        clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${crop.top}px, ${crop.left}px ${crop.top}px, ${crop.left}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top}px, 0% ${crop.top}px)`,
    }), [crop])

    return (
        <>
            {!video.recording && <CropOverlay style={overlayStyle}/>}
            {video.recording && <VideoRecorderWidget id="video-recorder-widget"/>}
            <WidgetMountErrorDialog
                open={mountTimeoutOpen}
                error={mountTimeoutError}
                action={mountTimeoutAction}
                onConfirm={() => {
                    setMountTimeoutOpen(false)
                    _pendingFinish.current?.()
                    _pendingFinish.current = null
                }}
                onCancel={() => {
                    setMountTimeoutOpen(false)
                    _pendingFinish.current = null
                    $video.preRecording = false
                    $video.recording = false
                    $video.snapshot = false
                    $video.finalizing = false
                    $video.editing = true
                    $video.step = 1
                }}
            />
            <DefinedCropZone
                context={$video.cropper}
                className={classNames({'video-recording-in-progress': video.recording}, {'video-pre-recording-in-progress': video.preRecording}, {'photo-snapshot-in-progress flash-effect flash-on': video.snapshot}, {finalizing: video.finalizing})}
                infoComponent={<VideoSettingsInfo/>}
                ref={_cropZone}
            />
            {widgetCacheEntries.map(([key]) => (
                <DynamicWidget key={key} id={key} context={lgs.stores.ui.video.cropper}/>
            ))}
        </>
    )
})

VideoRecordingScreenArea.displayName = 'VideoRecordingScreenArea'
