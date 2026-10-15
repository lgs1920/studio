/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyVisibility.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-30
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NO_FOCUS, REFRESH_DRAWING } from '@Core/constants'
import { SceneUtils } from '@Utils/cesium/SceneUtils'
import { Cartesian3 } from 'cesium'

/**
 * Read the currently registered journeys when the registry supports iteration.
 *
 * @returns {Array<object>} Registered journeys.
 */
const getJourneys = () => {
    const journeys = globalThis.lgs?.journeys
    if (typeof journeys?.values !== 'function') {
        return []
    }

    try {
        return Array.from(journeys.values())
    }
    catch {
        return []
    }
}
let journeyVisibilityRefreshQueue = Promise.resolve()

const toCartesian = point => {
    const longitude = Number(point?.longitude)
    const latitude = Number(point?.latitude)
    const height = Number(point?.height ?? point?.altitude ?? 0)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(height)) {
        return null
    }

    return Cartesian3.fromDegrees(longitude, latitude, height)
}

const centroidDistance = (first, second) => {
    const a = toCartesian(first)
    const b = toCartesian(second)
    return a && b ? Cartesian3.distance(a, b) : Number.POSITIVE_INFINITY
}

/**
 * Sort journeys by their centroid distance, keeping invalid geometries in a stable fallback order.
 *
 * @param {Array<object>} journeys - Journeys to sort.
 * @param {object|null} currentJourney - Journey used as the distance origin.
 * @param {Function} resolveCentroid - Centroid resolver.
 * @returns {Promise<Array<object>>} Sorted journeys.
 */
export const sortJourneysByCentroidDistance = async (journeys = [], currentJourney = globalThis.lgs?.theJourney ?? null, resolveCentroid = async journey => SceneUtils.getJourneyCentroid(journey, null, {useStoredHeight: false})) => {
    /**
     * Resolve a centroid without making one malformed journey abort the refresh.
     *
     * @param {object} journey - Journey to resolve.
     * @returns {Promise<object|null>} Centroid or null when its geometry is invalid.
     */
    const safeResolveCentroid = async journey => {
        try {
            return await resolveCentroid(journey)
        }
        catch {
            return null
        }
    }
    const currentCentroid = currentJourney ? await safeResolveCentroid(currentJourney) : null
    const resolvedJourneys = await Promise.all((journeys ?? []).map(async journey => ({
        journey,
        centroid: journey ? await safeResolveCentroid(journey) : null,
    })))

    return resolvedJourneys
        .map(item => ({
            ...item,
            distance: centroidDistance(item.centroid, currentCentroid),
        }))
        .sort((first, second) => first.distance - second.distance)
        .map(item => item.journey)
}

export const getGlobalHideOtherJourneys = () => globalThis.lgs?.settings?.journey?.hideOtherJourneys === true

export const getJourneyReplayHideOtherJourneys = () => {
    const replay = globalThis.lgs?.settings?.ui?.replay
    if (replay?.userMode === 'basic') {
        return true
    }

    if (replay?.inheritHideOtherJourneys === false) {
        return replay.hideOtherJourneys === true
    }

    if (replay?.userMode === 'expert') {
        return true
    }

    if (replay?.hideOtherJourneys === true) {
        return true
    }

    return getGlobalHideOtherJourneys()
}

/**
 * Apply one global visibility policy after resolving a stable journey order.
 *
 * @param {object} options - Visibility refresh options.
 * @returns {Promise<void>} Resolves after loaded journeys are refreshed.
 */
const runJourneyVisibilityRefresh = async ({
                                               hideOtherJourneys = getGlobalHideOtherJourneys(),
                                               currentJourney = globalThis.lgs?.theJourney ?? null,
                                               forceCurrentVisible = false,
                                               action = REFRESH_DRAWING,
                                               mode = NO_FOCUS,
                                           } = {}) => {
    const currentJourneySlug = currentJourney?.slug ?? null
    const journeys = await sortJourneysByCentroidDistance(getJourneys(), currentJourney)

    for (let index = 0; index < journeys.length; index++) {
        const journey = journeys[index]
        if (!journey || typeof journey.draw !== 'function') {
            continue
        }

        try {
            await journey.draw({
                action,
                mode,
                hideOtherJourneys,
                currentJourneySlug,
                forceCurrentVisible,
            })
        }
        catch (error) {
            console.error(`[Journey visibility] Failed to refresh ${journey.slug ?? 'an unnamed journey'}.`, error)
        }

        if (index < journeys.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 0))
        }
    }

    globalThis.lgs?.scene?.requestRender?.()
}

/**
 * Queue visibility refreshes so a slow earlier request cannot finish after a newer user choice.
 *
 * @param {object} options - Visibility refresh options.
 * @returns {Promise<void>} Resolves when this refresh and earlier queued changes finish.
 */
export const refreshJourneyVisibility = (options = {}) => {
    const refresh = journeyVisibilityRefreshQueue.then(() => runJourneyVisibilityRefresh(options))
    journeyVisibilityRefreshQueue = refresh.catch(() => {})
    return refresh
}

/**
 * Update the global Hide other journeys setting and refresh rendered traces.
 *
 * @param {boolean} enabled - Whether to hide traces outside the current journey.
 * @param {object} options - Visibility refresh options.
 * @returns {Promise<boolean>} The normalized setting value.
 */
export const setGlobalHideOtherJourneys = async (enabled = true, options = {}) => {
    const nextEnabled = enabled === true
    if (globalThis.lgs?.settings?.journey) {
        globalThis.lgs.settings.journey.hideOtherJourneys = nextEnabled
    }

    await refreshJourneyVisibility({
        ...options,
        hideOtherJourneys: nextEnabled,
    })

    return nextEnabled
}
