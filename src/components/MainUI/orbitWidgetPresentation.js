/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: orbitWidgetPresentation.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-06
 * Last modified: 2026-05-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ORBIT_RPM_MAX, ORBIT_RPM_MIN, normalizeOrbitRPM } from '@Core/OrbitSettings'

export const getOrbitRPMGaugeIcon = (rpm) => {
    const range = ORBIT_RPM_MAX - ORBIT_RPM_MIN
    const ratio = range > 0 ? (normalizeOrbitRPM(rpm) - ORBIT_RPM_MIN) / range : 0.5

    if (ratio < 0.2) {
        return 'gauge-simple-min'
    }
    if (ratio < 0.4) {
        return 'gauge-simple-low'
    }
    if (ratio <= 0.6) {
        return 'gauge-simple'
    }
    if (ratio < 0.8) {
        return 'gauge-simple-high'
    }
    return 'gauge-simple-max'
}
