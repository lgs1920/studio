/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneInfo.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-06
 * Last modified: 2025-10-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * CropZoneInfo.jsx
 * Minimal display of crop zone info, old-style, single prop: id
 *
 ******************************************************************************/

import React, { memo, useEffect, useState } from 'react'

export const CropZoneInfo = memo(function CropZoneInfo({id}) {
    const [info, setInfo] = useState(() => {
        const cfg = __.ui.widgetManager.getConfig(id)
        return cfg?.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0}
    })

    useEffect(() => {
        const update = () => {
            const cfg = __.ui.widgetManager.getConfig(id)
            if (cfg?.cropDimensions) {
                setInfo({...cfg.cropDimensions})
            }
        }
        // initial sync
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
            <span>{Math.floor(info.left)}×{Math.floor(info.top)}</span><span>{Math.floor(info.width)}×{Math.floor(info.height)}</span>
        </div>
    )
})