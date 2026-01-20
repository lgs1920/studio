/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-20
 * Last modified: 2026-01-20
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
} from '@Core/constants'
import {
    CanvasOverlayComposer,
}                                                               from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {
    ScreenMediaRecorder,
}                                                               from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { UIToast }                                              from '@Utils/UIToast'
import classNames                                               from 'classnames'
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                                          from 'valtio'

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
    const blurValue = blurMatch ? parseFloat(blurMatch[1]) : 0

    // Border radius detection
    const radiusMatch = style.borderRadius?.match(/(\d+)px/)
    const radiusValue = radiusMatch ? parseFloat(radiusMatch[1]) : 0

    // Stop if any found
    if (blurValue > 0 || radiusValue > 0) {
        return {blur: blurValue, radius: radiusValue}
    }

    for (const child of el.children) {
        const childStyles = getStyles(child, depth + 1)
        if (childStyles.blur > 0 || childStyles.radius > 0) {
            return childStyles
        }
    }

    return {blur: 0, radius: 0}
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

export const VideoRecordingScreenArea = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const {maxSize, maxDuration} = useSnapshot(lgs.settings.ui.video)
    const _cropZone = useRef(null)

    const crop = useMemo(() => {
        const config = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        return config?.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0}
    }, [])

    const widgetCacheEntries = useMemo(() => [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).entries()], [])

    const isValidCrop = Number.isFinite(crop.left) && crop.width > 0

    useEffect(() => {
        if (_cropZone.current) {
            _cropZone.current.style.animationPlayState = video.paused ? 'paused' : 'running'
        }
    }, [video.paused])

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

        const composer = new CanvasOverlayComposer(lgs.canvas, {
            clip: {x, y, width, height},
            width, height,
                  flushWebGLBuffer: () => lgs.scene.render(),
              })

        ;[...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()].map(key => {
            const widgetEl = __.ui.widgetManager.getElementById(key)
            const canvasEl = widgetEl?.querySelector('.lgs-widget-canvas')

            if (canvasEl instanceof HTMLCanvasElement) {
                const config = __.ui.widgetManager.getWidgetConfig(key)
                const styles = getStyles(widgetEl)
                const shadowMargins = getShadowParameters(widgetEl)

                // config.position contains coordinates relative to the Studio origin
                // crop.left, crop.top are coordinates of the crop relative to the Studio origin
                // The canvas includes the shadow, so we need to offset by shadow margins
                const localX = config.position.left - crop.left - shadowMargins.left
                const localY = config.position.top - crop.top - shadowMargins.top

                // Get canvas CSS dimensions (logical pixels)
                const canvasStyle = window.getComputedStyle(canvasEl)
                const canvasWidth = parseFloat(canvasStyle.width)
                const canvasHeight = parseFloat(canvasStyle.height)


                composer.addOverlay(canvasEl, {
                    x:        localX,
                    y:        localY,
                    w:        canvasWidth,
                    h:        canvasHeight,
                    contentWidth:  config.dimensions.width,  // Real content dimensions for blur
                    contentHeight: config.dimensions.height,
                    blur:     styles.blur,
                    radius:   styles.radius,
                    rotate:   config.rotate || 0,
                    scale:    config.scale || 1,
                    shadowMargins,
                })
            }
        })

        __.recorder.setCanvas(composer.getCanvas())

    }, [$video.ratio, maxSize, maxDuration, $video.quality, $video.fps])


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

                composer.addOverlay(canvasEl, {
                    x:        localX,
                    y:        localY,
                    w:        canvasWidth,
                    h:        canvasHeight,
                    contentW: config.dimensions.width,  // Real content dimensions for blur
                    contentH: config.dimensions.height,
                    blur:     styles.blur,
                    radius:   styles.radius,
                    rotate:   config.rotate || 0,
                    scale:    config.scale || 1,
                    shadowMargins,
                })
            }
        })

        initializeRecorder()
        await __.recorder.captureScreenshot(composer.getCanvas())
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
        const widgetKeys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()]
        return waitingForAllWidgets(widgetKeys, async () => {
            if ($video.preRecording) {
                $video.preRecording = false
                $video.recording = true
                await handleVideoRecording()
            }
            else if ($video.snapshot) {
                await handlePhotoSnapshot()
            }
        })
    }, [handleVideoRecording, handlePhotoSnapshot])

    useEffect(() => {
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
        }
    }, [])

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