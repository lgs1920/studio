/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackPoints.jsx
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

import { faTriangleExclamation } from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                 from '@Utils/FA2SL'

export const TrackPoints = function TrackPoints() {
    return (<div className="track-points">
        <SlAlert variant="warning" open>
            <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
            <strong>Not Yet!</strong><br/>
            In a future version, it will be possible<br/>to view and edit points.
        </SlAlert>
    </div>)
}