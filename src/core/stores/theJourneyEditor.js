/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: theJourneyEditor.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-09
 * Last modified: 2025-06-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

export const theJourneyEditor = {
    journey: null,
    track: null,
    poi: null,
    flags: {
        start: null,
        stop: null,
    },
    allPOIs: true,
    longTask: false,
    tabs: {
        journey: {
            data: false, edit: false, pois: false, points: false,
        },
        track: {
            data: true, edit: false, points: false,
        },
    },
}