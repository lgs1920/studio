/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneInfo.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-13
 * Last modified: 2025-10-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Minimal display of crop zone info, old-style, single prop: id
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
            console.log('CropZoneInfo: Initial cropDimensions (logical pixels)', {
                id,
                cropDimensions: cfg.cropDimensions,
                dpr:            __.device.dpr,
                scaled:         Object.fromEntries(
                    Object.entries(cfg.cropDimensions).map(([key, value]) => [key, value * __.device.dpr]),
                ),
            })
            return Object.fromEntries(
                Object.entries(cfg.cropDimensions).map(([key, value]) => [key, value * __.device.dpr]),
            )
        }
        console.log('CropZoneInfo: No initial cropDimensions', {id})
        return {left: 0, top: 0, width: 0, height: 0}
    })

    useEffect(() => {
        const update = () => {
            const cfg = __.ui.widgetManager.getWidgetConfig(id)
            if (cfg?.cropDimensions) {
                console.log('CropZoneInfo: Updating info (logical pixels)', {
                    id,
                    cropDimensions: cfg.cropDimensions,
                    dpr:            __.device.dpr,
                })
                setInfo(Object.fromEntries(
                    Object.entries(cfg.cropDimensions).map(([key, value]) => [key, value * __.device.dpr]),
                ))
            }
            else {
                console.log('CropZoneInfo: No cropDimensions in update', {id})
            }
        }

        // Initial sync
        update()

        const onUpdate = (e) => {
            console.log('CropZoneInfo: onCropUpdate received', {id, detail: e.detail})
            if (!e?.detail || e.detail.id === id) {
                update()
            }
        }
        document.addEventListener('onCropUpdate', onUpdate)
        return () => document.removeEventListener('onCropUpdate', onUpdate)
    }, [id])

    return (
        <div className="crop-zone-info">
            <span>{Math.floor(info.left)}×{Math.floor(info.top)}</span>
            <span>{Math.floor(info.width)}×{Math.floor(info.height)}</span>
            {console.log('CropZoneInfo: Rendering (physical pixels)', {info})}
        </div>
    )
})