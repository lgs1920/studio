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
 * Last modified: 2026-05-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { UIToast }    from '@Utils/UIToast'
import { preCache }   from '@zumer/snapdom'

/**
 * Pre-caches SnapDOM resources and embedded fonts before capture begins.
 *
 * @param {object} options - Pre-cache options.
 * @param {Element|Document} options.root - Document subtree scanned for capture resources.
 * @returns {Promise<void>} Resolves when SnapDOM finishes pre-caching resources.
 */
export const precacheSnapdomAssets = ({
                                          root = document.body,
                                      } = {}) => preCache(root, {
                                          embedFonts: true,
                                          fontStylesheetDomains: ['fonts.googleapis.com'],
                                      })

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
