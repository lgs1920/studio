/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { defaultJourneyReplaySettings } from '@Core/ui/replay/JourneyReplayProgressionStyle'

const defaults = defaultJourneyReplaySettings()

export const replay = {
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
    resolvedFrameState: null,
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
    clipSequenceActive: false,
    recordingSync:  false,
    deferredExportPlan: null,
    videoCropRect:  null,
    readiness:      {...defaults.readiness},
    orbitAllowed:   true,
}
