/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VIDEO_CROP_ZONE }                from '@Core/constants'
import { useCallback, useEffect, useRef } from 'react'
import { useSnapshot }                           from 'valtio'
import { CropZoneInfo }                          from './CropZoneInfo'

/**
 * CropZone component for rendering the crop zone content with imperative API.
 */
export const CropZone = ({onDoubleClick, infoComponent, infoPosition, children, context}) => {
    const _cropZone = useRef(null)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const handleContextMenu = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    useEffect(() => {
        return () => {
            void __.ui.widgetManager.syncCropDimensionsFromElement(context.id, true, 'unmount')
        }
    }, [context.id])

    return (
        <>
            <div
                ref={_cropZone}
                className="crop-zone"
                onDoubleClick={onDoubleClick}
                onContextMenu={handleContextMenu}
            >
                {infoPosition && (
                    <div className="crop-info lgs-one-line-card wa-theme-lgs1920-on-map small">
                        <CropZoneInfo id={VIDEO_CROP_ZONE}/>
                    </div>
                )}
                {infoComponent && (
                    <div className="crop-info-custom lgs-one-line-card wa-theme-lgs1920-on-map small">
                        {infoComponent}
                    </div>
                )}
                {children}
            </div>
        </>

    )
}
