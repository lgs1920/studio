/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-23
 * Last modified: 2025-11-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VideoMessage }                          from '@Components/MainUI/video/VideoMessage'
import { VIDEO_CROP_ZONE }                       from '@Core/constants'
import React, { useCallback, useEffect, useRef } from 'react'
import { useSnapshot }                           from 'valtio'
import { CropZoneInfo }                          from './CropZoneInfo'

/**
 * CropZone component for rendering the crop zone content with imperative API.
 */
export const CropZone = ({onDoubleClick, infoComponent, infoPosition, overlay, children, context}) => {
    const _cropZone = useRef(null)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const handleContextMenu = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    useEffect(() => {
        return async () => {
            const config = await __.ui.widgetManager.getWidgetConfig(context.id)
            await __.ui.widgetManager.saveWidgetPosition(context.id, config)
        }
    }, [])

    return (
        <>
            <div
                ref={_cropZone}
                className="crop-zone"
                onDoubleClick={onDoubleClick}
                onContextMenu={handleContextMenu}
            >
                {infoPosition && (
                    <div className="crop-info lgs-one-line-card on-map small">
                        <CropZoneInfo id={VIDEO_CROP_ZONE}/>
                    </div>
                )}
                {infoComponent && (
                    <div className="crop-info-custom lgs-one-line-card on-map small">
                        {infoComponent}
                    </div>
                )}
                {children}
            </div>
            {video.step === 0 && <VideoMessage>{'Video settings'}</VideoMessage>}
        </>

    )
}