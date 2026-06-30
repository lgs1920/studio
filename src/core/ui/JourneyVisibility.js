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

const getJourneys = () => Array.from(globalThis.lgs?.journeys?.values?.() ?? [])

export const getGlobalHideOtherJourneys = () => globalThis.lgs?.settings?.journey?.hideOtherJourneys === true

export const getFlythroughHideOtherJourneys = () => {
    const flythrough = globalThis.lgs?.settings?.ui?.flythrough
    if (flythrough?.inheritHideOtherJourneys === false) {
        return flythrough.hideOtherJourneys === true
    }

    if (flythrough?.hideOtherJourneys === true) {
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
    const items = []

    for (const journey of getJourneys()) {
        if (!journey) {
            continue
        }

        items.push(journey.draw({
            action,
            mode,
            hideOtherJourneys,
            currentJourneySlug,
            forceCurrentVisible,
        }))
    }

    await Promise.all(items)
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
