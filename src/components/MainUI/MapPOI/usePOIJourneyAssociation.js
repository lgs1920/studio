/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: usePOIJourneyAssociation.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-05-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    GLOBAL_PARENT, POI_FLAG_START, POI_FLAG_STOP, POI_JOURNEY_ASSOCIATION_DISTANCE, POI_STARTER_TYPE,
}                         from '@Core/constants'
import { useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }     from 'valtio'

const NON_ASSOCIABLE_POI_TYPES = new Set([POI_STARTER_TYPE, POI_FLAG_START, POI_FLAG_STOP])
export const NO_ASSOCIATED_JOURNEY_LABEL = 'No associated journey'

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const formatDistance = meters => {
    if (!Number.isFinite(meters)) {
        return ''
    }

    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} km`
    }

    return `${Math.round(meters)} m`
}

const resolveJourneySlug = parent => {
    if (!parent || parent === GLOBAL_PARENT) {
        return ''
    }

    return lgs.getJourneyByTrackSlug?.(parent)?.slug ?? ''
}

export const usePOIJourneyAssociation = point => {
    const journeyEditor = useSnapshot(lgs.stores.main.components.journeyEditor)
    const canAssociate = Boolean(point?.id) && !NON_ASSOCIABLE_POI_TYPES.has(point?.type)
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)
    const maxDistanceMeters = finiteNumber(lgs.settings?.poi?.association?.maxDistance)
                              ?? POI_JOURNEY_ASSOCIATION_DISTANCE
    const journeyListKey = useMemo(
        () => `${journeyEditor.keys?.journey?.list ?? 0}:${Array.from(journeyEditor.list ?? []).join('|')}`,
        [journeyEditor.keys?.journey?.list, journeyEditor.list],
    )

    const candidates = useMemo(() => {
        if (!canAssociate || longitude === null || latitude === null) {
            return []
        }

        return __.ui.poiManager.getNearbyJourneysForPOI(point, maxDistanceMeters)
    }, [canAssociate, longitude, latitude, point?.id, point?.parent, journeyListKey, maxDistanceMeters])

    const candidateSlugs = useMemo(
        () => new Set(candidates.map(({journey}) => journey.slug)),
        [candidates],
    )
    const journeys = useMemo(
        () => candidates.map(({journey}) => journey),
        [candidates],
    )
    const currentJourneySlug = useMemo(
        () => resolveJourneySlug(point?.parent),
        [point?.parent],
    )
    const selectedJourneySlug = candidateSlugs.has(currentJourneySlug) ? currentJourneySlug : ''
    const thresholdLabel = useMemo(() => formatDistance(maxDistanceMeters), [maxDistanceMeters])
    const hint = candidates.length > 0
                 ? `Journeys are filtered within ${thresholdLabel} and sorted by nearest first.`
                 : `No nearby journey within ${thresholdLabel}.`

    const handleChangeJourney = useCallback(async (event) => {
        const parent = event.target.value || null
        await __.ui.poiManager.updatePOI(point.id, {parent}, {immediate: true})
    }, [point?.id])

    useEffect(() => {
        if (!canAssociate || !currentJourneySlug || candidateSlugs.has(currentJourneySlug)) {
            return
        }

        if ((journeyEditor.list?.length ?? 0) === 0) {
            return
        }

        void __.ui.poiManager.updatePOI(point.id, {parent: null}, {immediate: true})
    }, [canAssociate, candidateSlugs, currentJourneySlug, journeyEditor.list?.length, point?.id])

    return {
        canAssociate,
        journeys,
        selectedJourneySlug,
        hint,
        handleChangeJourney,
    }
}
