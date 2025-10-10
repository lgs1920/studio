/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DefinedCropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-10
 * Last modified: 2025-10-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * DefinedCropZone.jsx
 * Static crop zone display (no drag/resize), modeled after CropZone rendering
 *
 ******************************************************************************/

import React, { memo, useEffect, useRef, useState } from 'react'
import { CropZoneInfo } from './CropZoneInfo'

export const DefinedCropZone = memo(function DefinedCropZone({
                                                                 className = '',
                                                                 infoComponent = null,
                                                                 infoPosition = true,
                                                                 overlay,
                                                                 id,
                                                             }) {
    const _zoneRef = useRef(null)
    const [crop, setCrop] = useState(() => {
        const cfg = __.ui.widgetManager.getWidgetConfig(id)
        return cfg?.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0}
    })

    useEffect(() => {
        const sync = () => {
            const cfg = __.ui.widgetManager.getWidgetConfig(id)
            if (!cfg?.cropDimensions) {
                return
            }
            setCrop({...cfg.cropDimensions})
        }
        // initial
        sync()
        // live updates
        const onUpdate = (e) => {
            if (!e?.detail || e.detail.id === id) {
                sync()
            }
        }
        document.addEventListener('onCropUpdate', onUpdate)
        return () => document.removeEventListener('onCropUpdate', onUpdate)
    }, [id])

    // Apply DOM styles for the static crop box
    useEffect(() => {
        if (!_zoneRef.current) {
            return
        }
        const el = _zoneRef.current
        el.style.left = `${crop.left}px`
        el.style.top = `${crop.top}px`
        el.style.width = `${crop.width}px`
        el.style.height = `${crop.height}px`
        el.style.position = 'absolute'
        el.style.transform = 'none'
    }, [crop])

    // Keep outside overlay in sync if provided
    useEffect(() => {
        if (!overlay) {
            return
        }
        try {
            const cfg = __.ui.widgetManager.getWidgetConfig(id)
            if (cfg) {
                cfg.outsideOverlay = overlay
                __.ui.widgetManager.applyCropToOverlay({...cfg, cropDimensions: crop})
            }
        }
        catch (_) {
        }
    }, [overlay, id, crop])

    return (
        <div
            ref={_zoneRef}
            className={`crop-zone defined ${className}`}
            aria-label="defined-crop-zone"
        >
            {infoPosition && (
                <div className="crop-info lgs-one-line-card on-map small">
                    <CropZoneInfo id={id}/>
                </div>
            )}

            {infoComponent && (
                <div className="crop-info-custom lgs-one-line-card on-map small">
                    {infoComponent}
                </div>
            )}
        </div>
    )
})