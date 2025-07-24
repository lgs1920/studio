/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DefinedCropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-24
 * Last modified: 2025-07-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * DefinedCropZone component for displaying a static crop area without handles or dragging
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.crop - Crop dimensions and position
 * @param {Object} props.manager - CropperManager instance
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} [props.showInfo=true] - Whether to show crop info
 * @param {Object} props.ref - Ref for the crop zone element
 * @returns {JSX.Element} The static crop zone without interaction
 */
import { memo, forwardRef } from 'react'

export const DefinedCropZone = memo(forwardRef(({ 
    crop, 
    manager, 
    className = '', 
    showInfo = true 
}, ref) => {
    return (
        <div
            ref={ref}
            className={`crop-zone defined-crop-zone ${className}`}
            style={{
                left: crop.x / manager.dpr,
                top: crop.y / manager.dpr,
                width: crop.width / manager.dpr,
                height: crop.height / manager.dpr,
            }}
        >
            {showInfo && (
                <div className="crop-info lgs-one-line-card on-map small">
                    {Math.round(crop.x / manager.dpr)}×{Math.round(crop.y / manager.dpr)} |{' '}
                    {Math.round(crop.width / manager.dpr)}×{Math.round(crop.height / manager.dpr)}
                </div>
            )}
        </div>
    )
}))