/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneInfo.jsx
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
 * Displays the crop zone output dimensions in physical pixels.
 * @param {Object} props - Component props
 * @param {string} props.id - ID of the widget to get crop dimensions
 * @returns {JSX.Element} - Crop zone information display
 */
import React, { memo, useEffect, useState } from 'react'

export const CropZoneInfo = memo(function CropZoneInfo({id}) {
    /**
     * Get crop zone info from widget config in physical pixels
     */
    const [info, setInfo] = useState(() => {
        const cfg = __.ui.widgetManager.getWidgetConfig(id)
        if (cfg?.cropDimensions) {
            return Object.fromEntries(
                Object.entries(cfg.cropDimensions).map(([key, value]) => [key, value * __.device.dpr]),
            )
        }
        return {left: 0, top: 0, width: 0, height: 0}
    })

    useEffect(() => {
        const update = () => {
            const cfg = __.ui.widgetManager.getWidgetConfig(id)
            if (cfg?.cropDimensions) {
                setInfo(Object.fromEntries(
                    Object.entries(cfg.cropDimensions).map(([key, value]) => [key, value * __.device.dpr]),
                ))
            }
        }

        // Initial sync
        update()

        const onUpdate = (e) => {
            if (!e?.detail || e.detail.id === id) {
                update()
            }
        }
        document.addEventListener('onCropUpdate', onUpdate)
        return () => document.removeEventListener('onCropUpdate', onUpdate)
    }, [id])

    return (
        <div className="crop-zone-info">
            <span><strong>W/H :</strong> {Math.floor(info.width)}×{Math.floor(info.height)}</span>
        </div>
    )
})
