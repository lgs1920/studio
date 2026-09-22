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
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { UIToast }    from '@Utils/UIToast'
import { yieldStartupIdleTask, yieldStartupTask } from './startup/StartupWorkerClient'

const POI_LOCATION_BATCH_SIZE = 2

/**
 * Keep startup capture preparation disabled while startup responsiveness is diagnosed.
 *
 * @returns {Promise<void>} Resolved promise so callers can keep the same flow.
 */
export const precacheSnapdomAssets = () => Promise.resolve()

/**
 * Resolve POI locations in small background batches so startup follow-up work
 * does not monopolize interactions after the app becomes visible.
 *
 * @param {object} poiManager - POI manager used by Studio.
 * @returns {Promise<void>} Promise resolved when the background pass finishes.
 */
const resolvePoiLocationsInBackground = async poiManager => {
    await yieldStartupIdleTask()

    if (poiManager.list?.keys && poiManager.ensurePOILocation) {
        const ids = Array.from(poiManager.list.keys())
        for (let index = 0; index < ids.length; index++) {
            await poiManager.ensurePOILocation(ids[index])
            if ((index + 1) % POI_LOCATION_BATCH_SIZE === 0) {
                await yieldStartupIdleTask()
            }
        }
        return
    }

    await poiManager.ensureAllPOILocations()
}

/**
 * Run non-critical startup follow-up work without blocking the UI flow.
 *
 * @param {Promise<void>} task - Background task to run.
 * @param {string} label - Diagnostic label for failures.
 * @returns {void}
 */
const runStartupBackgroundTask = (task, label) => {
    void task.catch(error => {
        console.warn(`[LGS1920] ${label} failed:`, error)
    })
}

/**
 * Load secondary journey data after the app is visible.
 *
 * @param {object} options - Deferred loading dependencies.
 * @returns {Promise<void>} Promise resolved when UI-critical deferred data is ready.
 */
export const runDeferredJourneyDataLoad = async ({
                                                     trackUtils = TrackUtils,
                                                     journeyGroupManager = __.ui.journeyGroupManager,
                                                     poiManager = __.ui.poiManager,
                                                     precacheAssets = precacheSnapdomAssets,
                                                     uiToast = UIToast,
                                                     startupLoader = null,
                                                     currentPOIsReady = false,
                                                     onCurrentJourneyReady,
                                                     onJourneysReady,
                                                 } = {}) => {
    await yieldStartupIdleTask()

    if (startupLoader && !currentPOIsReady) {
        await startupLoader.loadPOIs({currentOnly: true, includeStarter: false})
        onCurrentJourneyReady?.()
        await yieldStartupTask()
    }

    const journeys = startupLoader
        ? await startupLoader.loadRemainingJourneys()
        : await trackUtils.readRemainingFromDB()
    onJourneysReady?.(journeys)

    if (startupLoader) {
        await yieldStartupIdleTask()
        await startupLoader.loadPOIs()
    }
    else {
        await poiManager.readAllFromDB({ensureLocations: false})
    }
    await yieldStartupIdleTask()
    await journeyGroupManager.initialize()
    if (!startupLoader) {
        poiManager.rebuildJourneyIndex()
    }

    runStartupBackgroundTask(resolvePoiLocationsInBackground(poiManager), 'Deferred POI location resolution')

    if (journeys.length > 0) {
        uiToast.success({
                            caption: 'Journeys loaded',
                            text:    'All journeys are ready.',
                        })
    }

    runStartupBackgroundTask((async () => {
        await yieldStartupIdleTask()
        await precacheAssets()
    })(), 'Deferred capture asset preparation')
}
