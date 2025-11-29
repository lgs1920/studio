/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-29
 * Last modified: 2025-11-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoRecordingScreenArea.jsx
 *
 * Main recording screen area.
 *
 * Renders:
 *  - Dark overlay outside the crop zone (clip-path)
 *  - Video recorder controls
 *  - Pulsing crop rectangle with settings info
 *  - All lazy-loaded widgets via DynamicWidget
 *
 */

import { VideoRecorderWidget }                                                                    from '@Components/MainUI/video/toolbox/VideoRecorderWidget'
import {
    VideoMessage,
}                                                                                                 from '@Components/MainUI/video/VideoMessage'
import {
    VideoSettingsInfo,
}                                                                                                 from '@Components/MainUI/video/VideoSettingsInfo'
import {
    DynamicWidget,
}                                                                                                 from '@Components/MainUI/widgets/DynamicWidget'
import {
    CropOverlay,
}                                                                                                 from '@Components/ToolsUI/cropper/CropOverlay'
import {
    DefinedCropZone,
}                                                                                                 from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import { APP_KEY, CROP_TOOLS_WIDGETS, LGS_PROJECT, MINUTE, VIDEO_CROP_ZONE, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import {
    CanvasOverlayComposer,
} from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {
    ScreenMediaRecorder,
} from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { UIToast } from '@Utils/UIToast'
import classNames                                                                                 from 'classnames'
import React, { memo, useCallback, useEffect, useMemo, useRef }                                   from 'react'
import { useSnapshot }                                                                            from 'valtio'

export const VideoRecordingScreenArea = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const {maxSize, maxDuration} = useSnapshot(lgs.settings.ui.video)
    const _cropZone = useRef(null)

    const crop = useMemo(() => {
        const config = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        return config?.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0}
    }, [])

    const widgetCacheEntries = useMemo(() => [...__.ui.widgetCache.getAll().entries()], [])

    const isValidCrop =
              Number.isFinite(crop.left) &&
              Number.isFinite(crop.top) &&
              Number.isFinite(crop.width) &&
              Number.isFinite(crop.height) &&
              crop.width > 0 &&
              crop.height > 0

    // Sync crop pulse animation
    useEffect(() => {
        if (_cropZone.current) {
            _cropZone.current.style.animationPlayState = video.paused ? 'paused' : 'running'
        }
    }, [video.paused])

    /**
     * Initializes VideoRecorder with Cesium canvas
     * @function
     */
    const initializeRecorder = useCallback(() => {
        // Save settings
        $video.settings = {quality: $video.quality, fps: $video.fps}

        // Set canvas source
        const configs = __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS)
        const widget = configs.find(config => config.id === VIDEO_CROP_ZONE)
        if (!widget) {
            console.warn('[VideoRecordingSettingsToolbar] No widget found for VIDEO_CROP_ZONE')
            return
        }
        // Configure recorder
        __.recorder.initialize({
                                   maxSize:     maxSize * 1048576, // MB to bytes
                                   maxDuration: maxDuration * MINUTE, // Minutes to milliseconds
                                   quality: ScreenMediaRecorder.QUALITY[$video.quality].value,
                                   filename:    APP_KEY,
                                   fps:     ScreenMediaRecorder.FPS[$video.fps],
                                   dimensions:  {
                                       width:  widget.cropDimensions.width * __.device.dpr,
                                       height: widget.cropDimensions.height * __.device.dpr,
                                   },
                                   ratio:       widget.ratio.value,
                                   metadata:    {
                                       artist:      lgs.servers.studio.name,
                                       date:        new Date(),
                                       description: `Visit ${lgs.servers.site.protocol}://${lgs.servers.site.domain}`,
                                       album:       LGS_PROJECT,
                                       genre:       'Adventure',
                                   },
                                   useWebGL:    true,
                               })

        const {top: y, left: x, width, height} = widget.cropDimensions
        widget.noResize = true

        const composer = new CanvasOverlayComposer(lgs.canvas, {
            clip: {x, y, width, height},
            width, height,
                  flushWebGLBuffer: () => lgs.scene.render(),
              })

        ;[...__.ui.widgetCache.getAll().keys()].map(key => {
            const getCanvas = () => __.ui.widgetManager.getElementById(key)?.querySelector('.lgs-widget-canvas')
            if (getCanvas() instanceof HTMLCanvasElement) {
                composer.addOverlay(getCanvas)
            }
        })
        __.recorder.setCanvas(composer.getCanvas())

    }, [$video.ratio, maxSize, maxDuration, $video.quality, $video.fps])


    /**
     * Toggles video recording
     * @function
     * @returns {Promise<void>}
     */
    const handleVideoRecording = useCallback(async async => {
        if (!__.recorder) {
            console.warn('[VideoRecordingSettingsToolbar] Recorder not initialized')
            return
        }

        try {
            initializeRecorder()
            await __.recorder.startVideo()
        }
        catch (error) {
            Object.assign($video, {
                recording: false,
                paused:    false,
                size:      0,
            })
            UIToast.error({
                              caption: 'Video capture',
                              text:    `Stopped due to error:<br>${error.message} !`,
                          })
        }
    }, [initializeRecorder])


    /**
     * Photo snapshot
     * @function
     * @returns {Promise<void>}
     */
    const handlePhotoSnapshot = useCallback(async async => {

        // Set canvas source
        const configs = __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS)
        const widget = configs.find(config => config.id === VIDEO_CROP_ZONE)
        if (!widget) {
            console.warn('[VideoRecordingSettingsToolbar] No widget found for VIDEO_CROP_ZONE')
            return
        }

        const {top: y, left: x, width, height} = widget.cropDimensions
        widget.noResize = true

        const composer = new CanvasOverlayComposer(lgs.canvas, {
                  clip:             {x, y, width, height},
                  width, height,
                  flushWebGLBuffer: () => lgs.scene.render(),
              })

        ;[...__.ui.widgetCache.getAll().keys()].map(key => {
            const getCanvas = () => __.ui.widgetManager.getElementById(key)?.querySelector('.lgs-widget-canvas')
            if (getCanvas() instanceof HTMLCanvasElement) {
                composer.addOverlay(getCanvas)
            }
        })

        // We capture the snapshot
        initializeRecorder()
        await __.recorder.captureScreenshot(composer.getCanvas())

    }, [])


    const waitingForAllWidgets = (widgets, onReady) => {
        if (!widgets || widgets.length === 0) {
            return () => {
            }
        }

        const observer = new MutationObserver(() => {
            const allMounted = widgets.every(k => __.ui.widgetCache.isMounted(k))
            const allInDOM = widgets.every(k => {
                const el = __.ui.widgetManager.getElementById(k)
                return el?.querySelector('.lgs-widget-canvas')
            })


            if (allMounted && allInDOM) {
                observer.disconnect()

                window.dispatchEvent(
                    new CustomEvent(__.ui.widgetManager.ALL_WIDGETS_RENDERED_EVENT, {
                        detail: widgets,
                    }),
                )

                onReady?.(widgets)
            }
        })


        observer.observe(document.body, {childList: true, subtree: true})

        // Return cleanup
        return () => observer.disconnect()
    }

    useEffect(() => {
        //Once all the widgets are rendered, we can start the recording or the snapshot
        waitingForAllWidgets([...__.ui.widgetCache.getAll().keys()], async (keys) => {
            if ($video.preRecording) {
                // Video pre-recording phase : ready to the recording
                $video.preRecording = false
                $video.recording = true
                await handleVideoRecording()
            }
            else if ($video.snapshot) {
                // it's a photo snapshot, let's do it !
                await handlePhotoSnapshot()
            }


        })

    }, [])


    // Cleanup on unmount
    useEffect(() => {
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
        }
    }, [])

    /** Early return when crop is not ready */
    if (!isValidCrop) {
        return null
    }

    const overlayStyle = useMemo(() => ({
        clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%,
            0% ${crop.top}px,
            ${crop.left}px ${crop.top}px,
            ${crop.left}px ${crop.top + crop.height}px,
            ${crop.left + crop.width}px ${crop.top + crop.height}px,
            ${crop.left + crop.width}px ${crop.top}px,
            0% ${crop.top}px
        )`,
    }), [crop.left, crop.top, crop.width, crop.height])


    return (
        <>
            {!video.recording && <CropOverlay style={overlayStyle}/>}

            {video.recording && <VideoRecorderWidget id="video-recorder-widget"/>}

            <DefinedCropZone
                context={$video.cropper}
                className={classNames(
                    {'video-recording-in-progress': video.recording},
                    {'video-pre-recording-in-progress': video.preRecording},
                    {'photo-snapshot-in-progress flash-effect flash-on': video.snapshot},
                    {finalizing: video.finalizing},
                )}
                infoComponent={<VideoSettingsInfo/>}
                ref={_cropZone}
            />

            {video.recording && <VideoMessage>{'Recording'}</VideoMessage>}
            {video.paused && <VideoMessage>{'Recording paused'}</VideoMessage>}
            {video.preRecording && <VideoMessage>{'Video setup in progress'}</VideoMessage>}
            {video.finalizing && <VideoMessage>{'Video finalization'}</VideoMessage>}
            {video.snapshot && <VideoMessage duration={2}>{'Snapshot'}</VideoMessage>}

            {widgetCacheEntries.map(([key, {component: LazyComponent}]) => (
                <DynamicWidget
                    key={key}
                    id={key}
                    context={lgs.stores.ui.video.cropper}
                />
            ))}
        </>
    )
})

VideoRecordingScreenArea.displayName = 'VideoRecordingScreenArea'