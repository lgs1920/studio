/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
 * @param {Object} props.style - Inline styles for the overlay
 * @returns {JSX.Element} The crop overlay element
 */
import { memo } from 'react'

export const CropOverlay = memo(({ style }) => {
    return <div className="crop-overlay" style={style}/>
})