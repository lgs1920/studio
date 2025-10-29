/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-29
 * Last modified: 2025-10-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VIDEO_CROP_ZONE } from '@Core/constants'
import React, { useEffect, useRef, useCallback, useState } from 'react'
import { CropZoneInfo }                                                from './CropZoneInfo'

/**
 * CropZone component for rendering the crop zone content with imperative API.
 */
export const CropZone = ({onDoubleClick, infoComponent, infoPosition, overlay, children, context}) => {
    const _cropZone = useRef(null)

    const handleContextMenu = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    return (
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
    )
}