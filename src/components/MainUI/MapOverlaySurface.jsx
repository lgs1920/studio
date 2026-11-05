/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapOverlaySurface.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-05
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { forwardRef } from 'react'
import './MapOverlaySurface.css'

/** Render the shared themed surface used by compact overlays on the map. */
export const MapOverlaySurface = forwardRef(({className = '', ...props}, ref) => (
    <div
        {...props}
        ref={ref}
        className={`lgs-map-overlay-surface ${className}`.trim()}
    />
))

MapOverlaySurface.displayName = 'MapOverlaySurface'
