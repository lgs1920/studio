/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DefinedCropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * DefinedCropZone.jsx
 * Static crop zone display (no drag/resize), modeled after CropZone rendering
 *
 ******************************************************************************/

import { VideoMessage }                             from '@Components/MainUI/video/VideoMessage'
import classNames                            from 'classnames'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                              from 'valtio'
import { CropZoneInfo }                             from './CropZoneInfo'

export const DefinedCropZone = memo(function DefinedCropZone({
                                                                 className = '',
                                                                 infoComponent = null,
                                                                 infoPosition = true,
                                                                 overlay,
                                                                 children,
                                                                 context,
                                                             }) {
    const _definedCropZone = useRef(null)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const readCrop = useCallback(() => {
        const config = __.ui.widgetManager.getWidgetConfig(context.id)
        return config?.cropDimensions
               ? {...config.cropDimensions}
               : {left: 0, top: 0, width: 0, height: 0}
    }, [context.id])

    const [crop, setCrop] = useState(() => readCrop())

    useEffect(() => {
        const syncCrop = () => {
            const next = readCrop()
            setCrop(current => (
                                   current.left === next.left &&
                                   current.top === next.top &&
                                   current.width === next.width &&
                                   current.height === next.height
                               ) ? current : next)
        }

        syncCrop()

        const handleCropUpdate = (event) => {
            if (!event?.detail || event.detail.id === context.id) {
                syncCrop()
            }
        }

        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [context.id, readCrop])

    // Store the crop zone DOM element in Valtio store when mounted
    useEffect(() => {
        if (_definedCropZone.current) {
            context.widgetsBoard = _definedCropZone.current.id
            context.resizable = video.cropper?.resizable ?? context.resizable
            context.widgetEditor = true
        }


        return () => {
            if (context) {
                context.widgetsBoard = null
                // we need widgetEditor later...
            }
        }
    }, [context, video.cropper?.resizable])

    // Apply DOM styles for the static crop box
    useEffect(() => {
        if (!_definedCropZone.current) {
            return
        }
        const el = _definedCropZone.current
        el.style.left = `${crop.left}px`
        el.style.top = `${crop.top}px`
        el.style.right = 'auto'
        el.style.bottom = 'auto'
        el.style.width = `${crop.width}px`
        el.style.height = `${crop.height}px`
        el.style.position = 'absolute'
        el.style.transform = 'none'
    }, [crop])

    // Keep outside overlay in sync if provided
    useEffect(() => {
        if (!overlay) {
            return
        }
        try {
            const config = __.ui.widgetManager.getWidgetConfig(context.id)
            if (config) {
                config.outsideOverlay = overlay
                __.ui.widgetManager.applyCropToOverlay({...config, cropDimensions: crop})
            }
        }
        catch {
            // Ignore overlay sync errors for non-mounted/static states.
        }
    }, [context.id, crop, overlay])

    const zoneClassName = classNames(
        'crop-zone',
        'defined',
        'defined-crop-zone',
        className,
        {
            'video-pre-recording-in-progress': video.preRecording,
            'video-recording-in-progress':     video.recording,
            'video-finalizing-in-progress': video.finalizing,
            'photo-snapshot-in-progress':      video.snapshot,
            finalizing:                        video.finalizing,
        },
    )

    return (
        <>
            <div
                ref={_definedCropZone}
                className={zoneClassName}
                aria-label="defined-crop-zone"
                id={context.id}
            >
                {infoPosition && (
                    <div className="crop-info lgs-one-line-card on-map small">
                        <CropZoneInfo id={context.id}/>
                    </div>
                )}

                {infoComponent && (
                    <div className="crop-info-custom lgs-one-line-card on-map small">
                        {infoComponent}
                    </div>
                )}

                {children}

            </div>
            {video.step === 1 && <VideoMessage>{'Add some widgets'}</VideoMessage>}
        </>
    )
})
