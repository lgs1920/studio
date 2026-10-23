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
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_JOURNEY } from '@Core/constants'
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
 * Stop and snapshot an active orbit around the current Journey before deferred Journeys load.
 * @returns {Promise<object|null>} The orbit state to restore after the load, or null when unrelated.
 */
const suspendCurrentJourneyOrbit = async () => {
    const app = globalThis.lgs
    const rotate = app?.stores?.ui?.mainUI?.rotate
    const journey = app?.theJourney
    const target = rotate?.target
    const targetSlug = target?.slug ?? target?.id
    const cameraManager = globalThis.__?.ui?.cameraManager

    if (!journey?.slug
        || rotate?.running !== true
        || target?.element !== CURRENT_JOURNEY
        || `${targetSlug}` !== `${journey.slug}`
        || typeof cameraManager?.stopRotate !== 'function'
        || typeof cameraManager?.rotateAround !== 'function') {
        return null
    }

    const suspendedOrbit = {
        direction: rotate.direction,
        journeySlug: journey.slug,
        rpm: rotate.rpm,
        targetSlug,
    }
    try {
        await cameraManager.stopRotate()
    }
    catch (error) {
        console.warn('[LGS1920] Failed to pause the current Journey orbit before loading Journeys:', error)
        if (rotate.running === true) {
            return null
        }
    }

    if (rotate.running === true) {
        return null
    }
    return suspendedOrbit
}

/**
 * Resume the captured Journey orbit if the user has not changed the active Journey or camera target.
 * @param {object|null} suspendedOrbit - Orbit state captured before deferred Journey loading.
 * @returns {Promise<void>} Resolves after the orbit is restarted when still applicable.
 */
const resumeCurrentJourneyOrbit = async suspendedOrbit => {
    if (!suspendedOrbit) {
        return
    }

    const app = globalThis.lgs
    const rotate = app?.stores?.ui?.mainUI?.rotate
    const journey = app?.theJourney
    const target = rotate?.target
    const targetSlug = target?.slug ?? target?.id
    const cameraManager = globalThis.__?.ui?.cameraManager
    const replay = app?.stores?.replay

    if (journey?.slug !== suspendedOrbit.journeySlug
        || rotate?.running === true
        || target?.element !== CURRENT_JOURNEY
        || `${targetSlug}` !== `${suspendedOrbit.targetSlug}`
        || replay?.active === true
        || replay?.playing === true
        || replay?.paused === true
        || replay?.orbitAllowed === false) {
        return
    }

    await cameraManager?.rotateAround?.(null, {
        direction: suspendedOrbit.direction,
        infinite: true,
        preserveView: true,
        rpm: suspendedOrbit.rpm,
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

    let journeys
    const suspendedOrbit = startupLoader ? await suspendCurrentJourneyOrbit() : null
    try {
        journeys = startupLoader
            ? await startupLoader.loadRemainingJourneys()
            : await trackUtils.readRemainingFromDB()
    }
    finally {
        try {
            await resumeCurrentJourneyOrbit(suspendedOrbit)
        }
        catch (error) {
            console.warn('[LGS1920] Failed to resume the current Journey orbit after loading Journeys:', error)
        }
    }
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
