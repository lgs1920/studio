/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackPoints.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-04-26
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlAlert }               from '@shoelace-style/shoelace/dist/react'
import { WaIcon }                from '@web.awesome.me/webawesome-pro/dist/react'

export const TrackPoints = function TrackPoints() {
    return (<div className="track-points">
        <SlAlert variant="warning" open>
            <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
            <strong>Not Yet!</strong><br/>
            In a future version, it will be possible<br/>to view and edit points.
        </SlAlert>
    </div>)
}
