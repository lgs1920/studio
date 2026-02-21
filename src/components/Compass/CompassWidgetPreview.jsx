/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-21
 * Last modified: 2026-02-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CompassWidget } from '@Components/Compass/CompassWidget'
import { Compass }       from '@Components/MainUI/compass/Compass'
import React             from 'react'

/**
 * Preview component for Journey Stats.
 * Simplified version focusing strictly on the widget display.
 */
export const CompassWidgetPreview = ({entity}) => {
    return (
        <div className="compass-widget-preview">
            <Compass fixed inWidget/>
        </div>
    )
}