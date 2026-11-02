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
 * Last modified: 2026-11-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_JOURNEY } from '@Core/constants'
import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { LGS_SUCCESS_TOAST, LGS_WARNING_TOAST, UIToast } from '@Utils/UIToast'
import { yieldStartupIdleTask, yieldStartupTask } from './startup/StartupWorkerClient'

const POI_LOCATION_BATCH_SIZE = 2
/** Stable toast identifier for the deferred Journey and POI startup phase. */
export const DEFERRED_JOURNEY_DATA_TOAST_ID = 'deferred-journeys-and-pois'

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
 * Load secondary journey and POI data, then wait for queued map POI captures.
 *
 * @param {object} options - Deferred loading dependencies.
 * @param {Function} options.waitForPOICaptures - Resolves when queued POI map captures settle.
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
                                                     waitForPOICaptures = () => Promise.resolve(),
                                                     onCurrentJourneyReady,
                                                     onJourneysReady,
                                                 } = {}) => {
    const loadingToastId = uiToast.loading?.(
        {caption: 'Loading all your data ...'},
        DEFERRED_JOURNEY_DATA_TOAST_ID,
    )
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

    let poiDataLoaded = true
    if (startupLoader) {
        await yieldStartupIdleTask()
        poiDataLoaded = await startupLoader.loadPOIs() !== false
    }
    else {
        const result = await poiManager.readAllFromDB({ensureLocations: false})
        poiDataLoaded = result !== false
    }
    await yieldStartupIdleTask()
    await journeyGroupManager.initialize()
    if (!startupLoader) {
        poiManager.rebuildJourneyIndex()
    }

    if (poiDataLoaded) {
        await waitForPOICaptures()
        uiToast.update?.(
            loadingToastId,
            {caption: 'Journeys and POIs are ready ...'},
            LGS_SUCCESS_TOAST,
        )
    }
    else {
        uiToast.update?.(
            loadingToastId,
            {caption: 'Could not load all Journey and POI data.'},
            LGS_WARNING_TOAST,
        )
    }

    runStartupBackgroundTask(resolvePoiLocationsInBackground(poiManager), 'Deferred POI location resolution')

    runStartupBackgroundTask((async () => {
        await yieldStartupIdleTask()
        await precacheAssets()
    })(), 'Deferred capture asset preparation')
}
