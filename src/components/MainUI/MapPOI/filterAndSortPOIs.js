/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: filterAndSortPOIs.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { createJourneyProximityMatcher } from '@Components/MainUI/MapPOI/poiJourneyProximity'
import { GLOBAL_PARENT } from '@Core/constants'

/**
 * Filters and sorts POIs using the same rules for the editor list and its count.
 * @param {{onlyJourney: boolean, filterSettings: object, list: Map, journeySlug: string|null, journey: object|null, getJourneyByTrackSlug: (slug: string) => object|null}} options
 * @returns {string[]}
 */
export const filterAndSortPOIs = ({
    onlyJourney,
    filterSettings,
    list,
    journeySlug,
    journey,
    getJourneyByTrackSlug,
}) => {
    const {
        journey: showJourney = false,
        global = false,
        byName = '',
        byCategories = [],
        exclude = false,
        alphabetic = true,
        allPOIs = false,
    } = filterSettings

    const environmentFilterActive = !allPOIs && Boolean(journeySlug)
    const isNearCurrentJourney = environmentFilterActive
        ? createJourneyProximityMatcher(journey)
        : () => false
    const lowerName = byName.trim().toLowerCase()
    const sorted = []
    let hasEmptyTitle = false

    for (const [id, poi] of list) {
        if (!poi?.id || poi.tooClose === true) {
            continue
        }

        const isGlobal = poi.parent == null || poi.parent === GLOBAL_PARENT
        const poiJourneySlug = !isGlobal && journeySlug
            ? getJourneyByTrackSlug(poi.parent)?.slug ?? null
            : null
        const isJourney = Boolean(journeySlug) && poiJourneySlug === journeySlug
        const isIncludedByScope = onlyJourney
            ? isJourney || (isGlobal && isNearCurrentJourney(poi))
            : (global && isGlobal && (!environmentFilterActive || isNearCurrentJourney(poi))) || (showJourney && isJourney)

        if (!isIncludedByScope) {
            continue
        }

        const displayTitle = `${poi.title ?? poi.name ?? poi.id}`.trim()
        if (!`${poi.title ?? ''}`.trim()) {
            hasEmptyTitle = true
        }
        if (lowerName && !displayTitle.toLowerCase().includes(lowerName)) {
            continue
        }

        if (byCategories.length) {
            const category = poi.category ?? poi.type
            const inCategory = category != null && byCategories.includes(category)
            if (exclude ? inCategory : !inCategory) {
                continue
            }
        }

        sorted.push({id, title: displayTitle})
    }

    if (sorted.length > 1 && alphabetic && !hasEmptyTitle) {
        sorted.sort((first, second) => first.title.localeCompare(second.title))
    }

    return sorted.map(({id}) => id)
}
