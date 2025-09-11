/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DefinedCropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-11
 * Last modified: 2025-09-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * DefinedCropZone component for displaying a static crop area without handles or dragging
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.cssCrop - Crop dimensions and position in CSS units
 * @param {Object} props.manager - CropperManager instance
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} [props.showInfo=true] - Whether to show crop info
 * @param {Object} props.ref - Ref for the crop zone element
 * @returns {JSX.Element} The static crop zone without interaction
 */
import { memo } from 'react'

export const DefinedCropZone = ({
                                    cssCrop,
                                    className = '',
                                    innerRef,
                                }) => {
    return (
        <div
            ref={innerRef}
            className={`crop-zone defined ${className}`}
            style={{
                left:   cssCrop.x,
                top:    cssCrop.y,
                width:  cssCrop.width,
                height: cssCrop.height,
            }}
        />
    )
}