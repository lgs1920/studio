/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-21
 * Last modified: 2025-07-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * CropZone component for the interactive crop area with handles
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.crop - Crop dimensions and position
 * @param {Object} props.manager - CropperManager instance
 * @param {Object} props.cropper - Cropper state from store
 * @param {Object} props.interactionState - Current interaction state
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onStart - Handler for drag/resize start
 * @param {Function} props.onDoubleClick - Handler for double-click
 * @param {Object} props.ref - Ref for the crop zone element
 * @returns {JSX.Element} The interactive crop zone with handles
 */
import { memo, forwardRef } from 'react'
import { CropperManager } from './CropperManager'

export const CropZone = memo(forwardRef(({ 
    crop, 
    manager, 
    cropper, 
    interactionState, 
    className, 
    onStart, 
    onDoubleClick 
}, ref) => {
    return (
        <div
            ref={ref}
            className={`crop-zone ${className}`}
            style={{
                left: crop.x / manager.dpr,
                top: crop.y / manager.dpr,
                width: crop.width / manager.dpr,
                height: crop.height / manager.dpr,
                cursor: 'grab',
            }}
            onPointerDown={(e) => onStart('drag', e)}
            onTouchStart={(e) => onStart('drag', e)}
            onDoubleClick={onDoubleClick}
            onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onStart('drag', e)
            }}
        >
            <div className="crop-info lgs-one-line-card on-map small">
                {Math.round(crop.x / manager.dpr)}×{Math.round(crop.y / manager.dpr)} |{' '}
                {Math.round(crop.width / manager.dpr)}×{Math.round(crop.height / manager.dpr)}
            </div>
            {interactionState.showHCenterLine && <div className="center-line-inner-horizontal" />}
            {interactionState.showVCenterLine && <div className="center-line-inner-vertical" />}
            {cropper.resizable &&
                CropperManager.handleMap.map(([dir, cursor]) => (
                    <div
                        key={dir}
                        className={`crop-handle handle-${dir}`}
                        style={{ cursor }}
                        onPointerDown={(e) => {
                            e.stopPropagation()
                            onStart(`resize-${dir}`, e)
                        }}
                        onTouchStart={(e) => {
                            e.stopPropagation()
                            onStart(`resize-${dir}`, e)
                        }}
                    />
                ))}
        </div>
    )
}))