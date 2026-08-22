/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * CropOverlay component for the dark overlay around the crop area
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.crop - Crop dimensions relative to the overlay container
 * @param {Object} props.style - Inline styles for the overlay
 * @param {boolean} [props.blockOutsideCrop=true] - Whether to block pointer input outside the crop window.
 * @returns {JSX.Element} The crop overlay element
 */
import { buildCropOverlayBlockers } from '@Components/ToolsUI/cropper/cropOverlayBlockers'
import { memo } from 'react'

export const CropOverlay = memo(({ crop, style, blockOutsideCrop = true }) => {
    const blockers = blockOutsideCrop ? buildCropOverlayBlockers(crop) : []

    return (
        <>
            <div className="crop-overlay" style={{...style, pointerEvents: 'none'}}/>
            {blockers.length > 0 && (
                <div className="crop-overlay-blockers" aria-hidden="true">
                    {blockers.map(blocker => (
                        <div key={blocker.className} className={blocker.className} style={blocker.style}/>
                    ))}
                </div>
            )}
        </>
    )
})
