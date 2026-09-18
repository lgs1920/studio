/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: deferredJourneyData.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-24
 * Last modified: 2026-09-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { UIToast }    from '@Utils/UIToast'
import { snapdom }     from '@zumer/snapdom'

/**
 * Prepare SnapDOM capture intent handling before capture begins.
 *
 * SnapDOM 3 embeds fonts and caches eligible resources during capture. Its
 * replacement for the removed pre-cache hook arms intent-based capture
 * preparation and does not take a document root or capture options.
 *
 * @param {object} options - Preparation options retained for API compatibility.
 * @param {Element|Document} options.root - Root retained for callers using the previous contract.
 * @returns {Promise<void>} Resolves after SnapDOM capture preparation is armed.
 */
export const precacheSnapdomAssets = (options = {}) => {
    const root = options.root === undefined ? document.body : options.root
    if (!root) return Promise.resolve()
    snapdom.preCapture()
    return Promise.resolve()
}

export const runDeferredJourneyDataLoad = async ({
                                                     trackUtils = TrackUtils,
                                                     journeyGroupManager = __.ui.journeyGroupManager,
                                                     poiManager = __.ui.poiManager,
                                                     precacheAssets = precacheSnapdomAssets,
                                                     uiToast = UIToast,
                                                 } = {}) => {
    const journeys = await trackUtils.readRemainingFromDB()
    await poiManager.readAllFromDB({ensureLocations: false})
    await journeyGroupManager.initialize()
    poiManager.rebuildJourneyIndex()
    await poiManager.ensureAllPOILocations()

    if (journeys.length > 0) {
        uiToast.success({
                            caption: 'Journeys loaded',
                            text:    'All journeys are ready.',
                        })
    }

    await precacheAssets()
}
