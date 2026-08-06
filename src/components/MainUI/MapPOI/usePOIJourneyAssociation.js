/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: usePOIJourneyAssociation.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-11
 * Last modified: 2026-05-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    GLOBAL_PARENT, POI_FLAG_START, POI_FLAG_STOP, POI_JOURNEY_ASSOCIATION_DISTANCE, POI_STARTER_TYPE, POI_TMP_TYPE,
}                                                    from '@Core/constants'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot }                               from 'valtio'

const NON_ASSOCIABLE_POI_TYPES = new Set([POI_STARTER_TYPE, POI_FLAG_START, POI_FLAG_STOP, POI_TMP_TYPE])
export const NO_ASSOCIATED_JOURNEY_LABEL = 'No associated journey'
const EMPTY_CANDIDATES = []

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

    return lgs.getJourneyByTrackSlug?.(parent)?.slug
        ?? lgs.getJourneyBySlug?.(parent)?.slug
        ?? ''
}

export const usePOIJourneyAssociation = point => {
    const journeyEditor = useSnapshot(lgs.stores.main.components.journeyEditor)
    const pointId = point?.id
    const pointType = point?.type
    const pointParent = point?.parent
    const canAssociate = Boolean(pointId) && !NON_ASSOCIABLE_POI_TYPES.has(pointType)
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)
    const [candidateResult, setCandidateResult] = useState({key: null, candidates: EMPTY_CANDIDATES})
    const maxDistanceMeters = finiteNumber(lgs.settings?.poi?.association?.maxDistance)
                              ?? POI_JOURNEY_ASSOCIATION_DISTANCE
    const journeyListKey = useMemo(
        () => `${journeyEditor.keys?.journey?.list ?? 0}:${Array.from(journeyEditor.list ?? []).join('|')}`,
        [journeyEditor.keys?.journey?.list, journeyEditor.list],
    )
    const associationPoint = useMemo(() => ({
        id:        pointId,
        type:      pointType,
        parent:    pointParent,
        longitude,
        latitude,
    }), [pointId, pointType, pointParent, longitude, latitude])
    const canLoadCandidates = canAssociate && longitude !== null && latitude !== null
    const associationKey = useMemo(() => {
        if (!canLoadCandidates) {
            return ''
        }

        return [
            pointId ?? '',
            pointType ?? '',
            pointParent ?? '',
            longitude,
            latitude,
            journeyListKey,
            maxDistanceMeters,
        ].join('|')
    }, [canLoadCandidates, pointId, pointType, pointParent, longitude, latitude, journeyListKey, maxDistanceMeters])

    useEffect(() => {
        let cancelled = false
        let idleId = null
        let timeoutId = null

        if (!canLoadCandidates) {
            return undefined
        }

        const resolveCandidates = () => {
            const nextCandidates = __.ui.poiManager.getNearbyJourneysForPOI(associationPoint, maxDistanceMeters)

            if (!cancelled) {
                setCandidateResult({key: associationKey, candidates: nextCandidates})
            }
        }

        if (typeof window.requestIdleCallback === 'function') {
            idleId = window.requestIdleCallback(resolveCandidates, {timeout: 200})
        }
        else {
            timeoutId = window.setTimeout(resolveCandidates, 0)
        }

        return () => {
            cancelled = true
            if (idleId !== null) {
                window.cancelIdleCallback(idleId)
            }
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId)
            }
        }
    }, [canLoadCandidates, associationKey, associationPoint, maxDistanceMeters])

    const candidatesReady = !canLoadCandidates || candidateResult.key === associationKey
    const candidates = candidatesReady ? candidateResult.candidates : EMPTY_CANDIDATES

    const candidateSlugs = useMemo(
        () => new Set(candidates.map(({journey}) => journey.slug)),
        [candidates],
    )
    const journeys = useMemo(
        () => candidates.map(({journey}) => journey),
        [candidates],
    )
    const currentJourneySlug = useMemo(
        () => resolveJourneySlug(pointParent),
        [pointParent],
    )
    const selectedJourneySlug = candidatesReady && candidateSlugs.has(currentJourneySlug) ? currentJourneySlug : ''
    const thresholdLabel = useMemo(() => formatDistance(maxDistanceMeters), [maxDistanceMeters])
    const hint = !candidatesReady
                 ? 'Checking nearby journeys...'
                 : candidates.length > 0
                   ? `Journeys are filtered within ${thresholdLabel} and sorted by nearest first.`
                   : `No nearby journey within ${thresholdLabel}.`

    const handleChangeJourney = useCallback(async (event) => {
        const parent = event.target.value || null
        await __.ui.poiManager.updatePOI(pointId, {parent}, {immediate: true})
    }, [pointId])

    useEffect(() => {
        if (!candidatesReady || !canAssociate || !currentJourneySlug || candidateSlugs.has(currentJourneySlug)) {
            return
        }

        if ((journeyEditor.list?.length ?? 0) === 0) {
            return
        }

        void __.ui.poiManager.updatePOI(pointId, {parent: null}, {immediate: true})
    }, [candidatesReady, canAssociate, candidateSlugs, currentJourneySlug, journeyEditor.list?.length, pointId])

    return {
        canAssociate,
        journeys,
        selectedJourneySlug,
        hint,
        handleChangeJourney,
    }
}
