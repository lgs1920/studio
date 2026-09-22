/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: theJourneyEditor.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-04-08
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
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
    showPOIsFilter: false,
    tab: false,
}

const JOURNEY_EDITOR_KEYS = new Set(Object.keys(theJourneyEditor))

/**
 * Reset the journey editor contents while preserving the proxy identity.
 *
 * @param {Object} $editor - Journey editor proxy to reset
 * @returns {void}
 */
export const resetJourneyEditor = $editor => {
    for (const key of Object.keys($editor)) {
        if (!JOURNEY_EDITOR_KEYS.has(key)) {
            delete $editor[key]
        }
    }

    $editor.journey = null
    $editor.track = null
    $editor.poi = null
    $editor.flags.start = null
    $editor.flags.stop = null
    $editor.allPOIs = true
    $editor.longTask = false
    $editor.showPOIsFilter = false
    $editor.tab = false
}
