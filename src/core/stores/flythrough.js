/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythrough.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { defaultFlythroughSettings } from '@Core/ui/flythrough/FlythroughProgressionStyle'

const defaults = defaultFlythroughSettings()

export const flythrough = {
    ...defaults,
    active:        false,
    playing:       false,
    paused:        false,
    nearbyPois:    [],
    journeySlug:    null,
    trackSlug:      null,
    progress:       0,
    elapsedMillis:  null,
    durationMillis: null,
    sample:         null,
    hoverSample:    null,
    metricOverlay:  {
        visible:   false,
        source:    null,
        anchor:    null,
        sample:    null,
        expiresAt: 0,
    },
    markerRadius:   35,
    totalDistance:  0,
    toolbarVisible: false,
    mainUiHidden:   false,
    recordingSync:  false,
    videoCropRect:  null,
    orbitAllowed:   true,
}
