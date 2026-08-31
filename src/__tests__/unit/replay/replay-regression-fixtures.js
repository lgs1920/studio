/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-regression-fixtures.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-07-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const REPLAY_REGRESSION_VIEWPORTS = {
    standard: {
        width:  1920,
        height: 1440,
    },
    narrow: {
        width:  1080,
        height: 1920,
    },
}

export const REPLAY_REGRESSION_CAMERA_STATE = {
    destination: {
        longitude: 2.123456,
        latitude:  48.765432,
        height:    2400,
    },
    orientation: {
        heading: 0.4,
        pitch:   -0.7,
        roll:    0,
    },
}

export const REPLAY_REGRESSION_LOGICAL_FRAME = {
    sample: {
        progress:          0.5,
        distanceFromStart: 1500,
        longitude:         2.123456,
        latitude:          48.765432,
        altitude:          120,
        height:            120,
    },
    progress:        0.5,
    durationMillis: 20_000,
    frameTimeMs:    10_000,
    frameIntervalMs: 1000 / 30,
}
