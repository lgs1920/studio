/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: deferredJourneyData.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
import { WIDGET_GOOGLE_FONTS } from '@Core/constants'

export const precacheSnapdomAssets = ({
                                          root = document.body,
                                          widgetGoogleFonts = WIDGET_GOOGLE_FONTS,
                                      } = {}) => preCache({
                                                              root,
                                                              embedFonts: true,
                                                              localFonts: widgetGoogleFonts.map(family => ({
                                                                  family,
                                                                  src:    `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@400;700&display=swap`,
                                                                  weight: 400,
                                                              })),
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
