/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-14
 * Last modified: 2025-11-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VideoRecorderWidget } from '@Components/MainUI/video/toolbox/VideoRecorderWidget'
import { VideoSettingsInfo }                                 from '@Components/MainUI/video/VideoSettingsInfo'
import { WidgetRenderer }                                    from '@Components/MainUI/widgets/WidgetRenderer'
import { CropOverlay }                                       from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }                                   from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import { CROP_TOOLS_WIDGETS, VIDEO_CROP_ZONE, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import classNames                                            from 'classnames'
import React, { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                                       from 'valtio'

/**
 * Main video recording screen area.
 * Displays the crop overlay, recorder widget, defined crop zone and all lazy-loaded widgets.
 * Fully memoized and optimized for re-renders.
 */
export const VideoRecordingScreenArea = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    /** Ref to the DefinedCropZone DOM element – used only for animation control */
    const _cropZone = useRef(null)

    /** Current crop dimensions coming from widget config (VIDEO_CROP_ZONE) */
    const crop = useMemo(() => {
        const config = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        return config?.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0}
    }, [])

    /** All widgets cached by the singleton WidgetCache */
    const widgetCacheEntries = useMemo(() => [...__.ui.widgetCache.getAll().entries()], [])

    /** Validate crop values – if anything is invalid we render nothing (safe-guard) */
    const isValidCrop =
              Number.isFinite(crop.left) &&
              Number.isFinite(crop.top) &&
              Number.isFinite(crop.width) &&
              Number.isFinite(crop.height) &&
              crop.width > 0 &&
              crop.height > 0

    /** Synchronize crop zone pulse animation with video playback state */
    useEffect(() => {
        if (!_cropZone.current) {
            return
        }
        _cropZone.current.style.animationPlayState = video.paused ? 'paused' : 'running'
    }, [video.paused])

    /** Cleanup widget groups on unmount */
    useEffect(() => {
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, false)
        }
    }, [])

    /** Early return when crop is not ready */
    if (!isValidCrop) {
        return null
    }

    /** Clip-path applied to the overlay – everything outside the crop zone becomes dark */
    const overlayStyle = useMemo(
        () => ({
            clipPath: `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%,
        0% ${crop.top}px,
        ${crop.left}px ${crop.top}px,
        ${crop.left}px ${crop.top + crop.height}px,
        ${crop.left + crop.width}px ${crop.top + crop.height}px,
        ${crop.left + crop.width}px ${crop.top}px,
        0% ${crop.top}px
      )`,
        }),
        [crop.left, crop.top, crop.width, crop.height],
    )

    return (
        <>
            {/* Dark overlay outside the selected crop zone */}
            <CropOverlay style={overlayStyle} className="video-recording-in-progress"/>

            {/* Main recorder controls */}
            <VideoRecorderWidget id="video-recorder-widget"/>

            {/* Visible crop rectangle with pulse animation + settings info */}
            <DefinedCropZone
                context={$video.cropper}
                className={classNames('video-recording-in-progress', {
                    finalizing: video.finalizing,
                })}
                infoComponent={<VideoSettingsInfo/>}
                ref={_cropZone}
            />

            {/* Render every lazy-loaded widget from the cache */}
            {widgetCacheEntries.map(([key, {component: LazyComponent}]) => (
                <WidgetRenderer key={key} id={key} context={lgs.stores.ui.video.cropper}/>
            ))}
        </>
    )
})

VideoRecordingScreenArea.displayName = 'VideoRecordingScreenArea'