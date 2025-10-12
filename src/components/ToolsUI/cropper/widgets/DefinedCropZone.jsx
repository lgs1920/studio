/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DefinedCropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-12
 * Last modified: 2025-10-12
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

import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { CropZoneInfo }                                          from './CropZoneInfo'

export const DefinedCropZone = memo(function DefinedCropZone({
                                                                 className = '',
                                                                 infoComponent = null,
                                                                 infoPosition = true,
                                                                 overlay,
                                                                 children,
                                                                 context,
                                                             }) {
    const _definedCropZone = useRef(null)

    const [crop, setCrop] = useState(() => {
        const cfg = __.ui.widgetManager.getWidgetConfig(context.id)
        return cfg?.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0}
    })

    // Store the crop zone DOM element in Valtio store when mounted
    useEffect(() => {
        if (_definedCropZone.current) {
            context.cropZone = _definedCropZone.current.id
            context.widgetEditor = true
        }
        return () => {
            if (context) {
                context.cropZone = null
                // we need widgetEditor later...
            }
        }
    }, [_definedCropZone.current])

    useEffect(() => {
        const sync = () => {
            const cfg = __.ui.widgetManager.getWidgetConfig(context.id)
            if (!cfg?.cropDimensions) {
                return
            }
            setCrop({...cfg.cropDimensions})
        }
        // initial
        sync()
        // live updates
        const onUpdate = (e) => {
            if (!e?.detail || e.detail.id === context.context.id) {
                sync()
            }
        }
        document.addEventListener('onCropUpdate', onUpdate)
        return () => document.removeEventListener('onCropUpdate', onUpdate)
    }, [context.id])

    // Apply DOM styles for the static crop box
    useEffect(() => {
        if (!_definedCropZone.current) {
            return
        }
        const el = _definedCropZone.current
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
            const cfg = __.ui.widgetManager.getWidgetConfig(context.id)
            if (cfg) {
                cfg.outsideOverlay = overlay
                __.ui.widgetManager.applyCropToOverlay({...cfg, cropDimensions: crop})
            }
        }
        catch (_) {
        }
    }, [overlay, context.id, crop])

    return (
        <div
            ref={_definedCropZone}
            className={`crop-zone defined ${className}`}
            aria-label="defined-crop-zone"
            id={context.id}
        >
            {infoPosition && (
                <div className="crop-info lgs-one-line-card on-map small">
                    <CropZoneInfo id={context.id}/>
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
})