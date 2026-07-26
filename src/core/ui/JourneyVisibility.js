/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyVisibility.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-30
 * Last modified on: 2026-06-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NO_FOCUS, REFRESH_DRAWING } from '@Core/constants'
import { SceneUtils } from '@Utils/cesium/SceneUtils'
import { Cartesian3 } from 'cesium'

const getJourneys = () => Array.from(globalThis.lgs?.journeys?.values?.() ?? [])

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

export const sortJourneysByCentroidDistance = async (journeys = [], currentJourney = globalThis.lgs?.theJourney ?? null, resolveCentroid = async journey => SceneUtils.getJourneyCentroid(journey, null, {useStoredHeight: false})) => {
    const currentCentroid = currentJourney ? await resolveCentroid(currentJourney) : null
    const resolvedJourneys = await Promise.all((journeys ?? []).map(async journey => ({
        journey,
        centroid: await resolveCentroid(journey),
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
    if (replay?.inheritHideOtherJourneys === false) {
        return replay.hideOtherJourneys === true
    }

    if (replay?.hideOtherJourneys === true) {
        return true
    }

    return getGlobalHideOtherJourneys()
}

export const refreshJourneyVisibility = async ({
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
        if (!journey) {
            continue
        }

        await journey.draw({
            action,
            mode,
            hideOtherJourneys,
            currentJourneySlug,
            forceCurrentVisible,
        })

        if (index < journeys.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 0))
        }
    }

    globalThis.lgs?.scene?.requestRender?.()
}

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
