/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayPOISettings.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-11
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {GLOBAL_PARENT} from '@Core/constants'
import {isJourneyReplayBasicMode} from './ReplayUserModeConstants'

export const DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS = 3
export const DEFAULT_REPLAY_POI_ANIMATION_DURATION_SECONDS = 2
export const DEFAULT_REPLAY_GLOBAL_POI_DISTANCE_METERS = 500
export const MIN_REPLAY_GLOBAL_POI_DISTANCE_METERS = 50
export const MAX_REPLAY_GLOBAL_POI_DISTANCE_METERS = 500
export const REPLAY_GLOBAL_POI_DISTANCE_STEP_METERS = 50
/** Upper bound used to index Replay POI presentation windows. */
export const MAX_REPLAY_POI_DISPLAY_DURATION_SECONDS = 60
const replayAnimatedPOIIndexes = new WeakMap()
const replayNearbyPOIIndexes = new WeakMap()
/** Keep enabled endpoint POI animations on screen for a short framing pause. */
export const REPLAY_ENDPOINT_POI_PAUSE_MILLIS = 1000
export const REPLAY_POI_VISIBILITY_MODES = Object.freeze(['yes', 'no', 'user'])

/** Check animated membership with a Set cached by Replay snapshot array identity. */
const isReplayPOIInAnimatedSnapshot = (animatedPOIIds, poiId) => {
    if (!Array.isArray(animatedPOIIds) || !poiId) {
        return false
    }
    let animatedPOIIdSet = replayAnimatedPOIIndexes.get(animatedPOIIds)
    if (!animatedPOIIdSet) {
        animatedPOIIdSet = new Set(animatedPOIIds)
        replayAnimatedPOIIndexes.set(animatedPOIIds, animatedPOIIdSet)
    }

    return animatedPOIIdSet.has(poiId)
}

/** Check nearby POI membership with a Set cached by Replay snapshot array identity. */
const isReplayPOIInNearbySnapshot = (nearbyPois, poiId) => {
    if (!Array.isArray(nearbyPois) || !poiId) {
        return false
    }
    let nearbyPOIIdSet = replayNearbyPOIIndexes.get(nearbyPois)
    if (!nearbyPOIIdSet) {
        nearbyPOIIdSet = new Set(nearbyPois.map(entry => entry?.poi?.id).filter(Boolean))
        replayNearbyPOIIndexes.set(nearbyPois, nearbyPOIIdSet)
    }

    return nearbyPOIIdSet.has(poiId)
}

/** Let a POI-level opt-out override Replay-wide animation switches. */
export const shouldAnimateReplayPOI = (behavior, settings) => {
    if (settings.animated === false) {
        return false
    }

    return behavior.basicMode
        ? behavior.animatePoisDuringJourneyReplay
        : behavior.animateAllPoisDuringJourneyReplay || settings.animated !== false
}

/** Normalize global POI visibility and animation settings for Replay. */
export const normalizeReplayPOIBehavior = settings => {
    const savedMode = settings?.poiVisibilityMode
    const poiVisibilityMode = REPLAY_POI_VISIBILITY_MODES.includes(savedMode)
        ? savedMode
        : settings?.hideAllPoisDuringJourneyReplay === true ? 'no' : 'user'
    const rawDuration = Number(settings?.poiAnimationDurationSeconds)
    const savedGlobalPOIDistance = settings?.globalPoiDistanceMeters
    const requestedGlobalPOIDistance = savedGlobalPOIDistance === null
        || savedGlobalPOIDistance === undefined
        || savedGlobalPOIDistance === ''
        ? Number.NaN
        : Number(savedGlobalPOIDistance)
    const rawGlobalPOIDistance = Number.isFinite(requestedGlobalPOIDistance)
        ? requestedGlobalPOIDistance
        : DEFAULT_REPLAY_GLOBAL_POI_DISTANCE_METERS
    const clampedGlobalPOIDistance = Math.max(
        MIN_REPLAY_GLOBAL_POI_DISTANCE_METERS,
        Math.min(MAX_REPLAY_GLOBAL_POI_DISTANCE_METERS, rawGlobalPOIDistance),
    )
    const globalPoiDistanceMeters = MIN_REPLAY_GLOBAL_POI_DISTANCE_METERS
        + Math.round((clampedGlobalPOIDistance - MIN_REPLAY_GLOBAL_POI_DISTANCE_METERS)
        / REPLAY_GLOBAL_POI_DISTANCE_STEP_METERS) * REPLAY_GLOBAL_POI_DISTANCE_STEP_METERS

    return {
        poiVisibilityMode,
        includeGlobalPois: settings?.includeGlobalPois !== false,
        globalPoiDistanceMeters,
        animatePoisDuringJourneyReplay: settings?.animatePoisDuringJourneyReplay === true
            || (settings?.animatePoisDuringJourneyReplay === undefined
                && settings?.animateAllPoisDuringJourneyReplay === true),
        poiAnimationDurationSeconds: Number.isFinite(rawDuration)
            ? Math.max(1, Math.min(3, Math.round(rawDuration)))
            : DEFAULT_REPLAY_POI_ANIMATION_DURATION_SECONDS,
    }
}

/** Return whether the POI is an endpoint whose visibility remains user-controlled. */
export const isReplayPOIEndpoint = poi => ['start', 'stop', 'starter'].includes(poi?.type)

/** Check whether a normalized replay sample falls inside the POI's centered animation window. */
export const isReplayPOIAnimationActiveAtProgress = ({
    progress,
    poiDistance,
    totalDistance,
    replayDurationSeconds,
    animationDurationSeconds,
} = {}) => {
    const normalizedProgress = finiteNumber(progress)
    const targetDistance = finiteNumber(poiDistance)
    const routeDistance = finiteNumber(totalDistance)
    const replayDuration = finiteNumber(replayDurationSeconds)
    const animationDuration = finiteNumber(animationDurationSeconds)
    if (normalizedProgress === null || targetDistance === null || routeDistance === null || routeDistance <= 0
        || replayDuration === null || replayDuration <= 0 || animationDuration === null || animationDuration <= 0) {
        return false
    }

    const currentReplaySeconds = Math.max(0, Math.min(1, normalizedProgress)) * replayDuration
    const poiReplaySeconds = Math.max(0, Math.min(1, targetDistance / routeDistance)) * replayDuration
    const visibleDuration = Math.min(replayDuration, animationDuration)
    const centeredStart = poiReplaySeconds - visibleDuration / 2
    const animationStart = Math.max(0, Math.min(centeredStart, replayDuration - visibleDuration))
    const animationEnd = animationStart + visibleDuration
    return currentReplaySeconds >= animationStart && currentReplaySeconds < animationEnd
}

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const toIntegerSeconds = value => Math.max(0, Math.round(finiteNumber(value) ?? DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS))

export const defaultJourneyReplayPOISettings = () => ({
    displayDurationSeconds: DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS,
    visible:                true,
    animated:               true,
    hiddenFields:           {
        location:    false,
        category:    false,
        altitude:    false,
        coordinates: false,
    },
})

export const normalizeJourneyReplayPOISettings = (settings = {}) => {
    const defaults = defaultJourneyReplayPOISettings()
    return {
        displayDurationSeconds: toIntegerSeconds(
            clamp(
                finiteNumber(settings?.displayDurationSeconds) ?? defaults.displayDurationSeconds,
                0,
                MAX_REPLAY_POI_DISPLAY_DURATION_SECONDS,
            ),
        ),
        visible:  settings?.visible !== false,
        animated: settings?.animated !== false,
        hiddenFields: {
            location:    settings?.hiddenFields?.location === true,
            category:    settings?.hiddenFields?.category === true,
            altitude:    settings?.hiddenFields?.altitude === true,
            coordinates: settings?.hiddenFields?.coordinates === true,
        },
    }
}

/**
 * Resolve one-second holds for visible and enabled Journey endpoint animations.
 * @param {Object} options - Journey and Replay state inputs.
 * @param {Object|null} options.poiVisibilityQualification - Optional terrain and crop qualification.
 * @returns {{start: number, end: number}} Start and arrival holds in milliseconds.
 */
export const resolveReplayEndpointPOIPauseMillis = ({
    sampler,
    journey = sampler?.journey,
    settings = globalThis.lgs?.settings?.ui?.replay,
    replay = globalThis.lgs?.stores?.replay,
    direction = 1,
    poiVisibilityQualification = null,
} = {}) => {
    const tracks = Array.from(journey?.tracks?.values?.() ?? [])
    const poiList = globalThis.lgs?.stores?.main?.components?.pois?.list
    const nearbyPois = Array.isArray(replay?.nearbyPois) ? replay.nearbyPois : []
    /** Resolve a Journey endpoint reference to its current POI record. */
    const resolveEndpointPOI = (reference, type) => {
        const poiId = typeof reference === 'object' ? reference?.id : reference
        return poiList?.get?.(poiId)
            ?? (reference?.type === type ? reference : null)
            ?? nearbyPois.find(entry => entry?.poi?.id === poiId || entry?.poi?.type === type)?.poi
            ?? null
    }
    const startPOI = resolveEndpointPOI(tracks[0]?.flags?.start, 'start')
    const stopPOI = resolveEndpointPOI(tracks.at(-1)?.flags?.stop, 'stop')
    const basicMode = isJourneyReplayBasicMode({settings, replay})
    const basicBehavior = normalizeReplayPOIBehavior(settings?.basic)
    const behavior = {
        basicMode,
        animatePoisDuringJourneyReplay: basicBehavior.animatePoisDuringJourneyReplay,
        animateAllPoisDuringJourneyReplay: settings?.animateAllPoisDuringJourneyReplay === true
            || replay?.animateAllPoisDuringJourneyReplay === true,
    }
    /** Check endpoint visibility and Replay animation permission. */
    const canAnimateEndpoint = (poi, endpoint) => {
        if (!poi || poi.visible === false) {
            return false
        }

        const poiSettings = normalizeJourneyReplayPOISettings(poi.replay)
        if (!poiSettings.visible || !shouldAnimateReplayPOI(behavior, poiSettings)) {
            return false
        }

        if (poiVisibilityQualification?.qualified !== true) {
            return true
        }

        const poiWindows = (Array.isArray(poiVisibilityQualification.windows)
            ? poiVisibilityQualification.windows
            : [])
            .filter(window => window.poiId === poi.id)
        return endpoint === 'start'
            ? poiWindows.some(window => window.routeStartMillis <= 0.5)
            : poiWindows.some(window => window.routeEndMillis >= poiVisibilityQualification.routeDurationMillis - 0.5)
    }
    const departurePOI = Number(direction) < 0 ? stopPOI : startPOI
    const arrivalPOI = Number(direction) < 0 ? startPOI : stopPOI
    const visibleArrivalPOI = arrivalPOI?.type === 'stop' && arrivalPOI.tooClose === true
        ? startPOI
        : arrivalPOI

    return {
        start: canAnimateEndpoint(departurePOI, 'start') ? REPLAY_ENDPOINT_POI_PAUSE_MILLIS : 0,
        end: canAnimateEndpoint(visibleArrivalPOI, 'end') ? REPLAY_ENDPOINT_POI_PAUSE_MILLIS : 0,
    }
}

/**
 * Identify an active Replay scene without treating linked-video preparation as playback.
 * @param {object|null} replay - Transient Replay state.
 * @returns {boolean} Whether Replay currently owns POI presentation.
 */
export const isReplayPOIPresentationActive = (replay = globalThis.lgs?.stores?.replay) => Boolean(
    replay?.active || replay?.playing || replay?.paused || replay?.clipSequenceActive
    || replay?.deferredExportPlan?.runtime?.status === 'exporting',
)

/** Identify a POI that is global rather than owned by a Journey or track. */
export const isGlobalPOI = poi => !poi?.parent || poi.parent === GLOBAL_PARENT

/**
 * Check whether a global POI is part of the active Journey's Replay selection.
 * @param {object|null} poi - Global POI record.
 * @param {object|null} replay - Replay state containing the selected POI entries.
 * @returns {boolean} Whether the global POI is eligible for this Journey Replay.
 */
export const isReplayGlobalPOIEligibleForJourney = (poi, replay = globalThis.lgs?.stores?.replay) => Boolean(
    isGlobalPOI(poi) && isReplayPOIInNearbySnapshot(replay?.nearbyPois, poi?.id),
)

/**
 * Resolve the same transient POI mask for React content and Cesium billboard commits.
 * @param {object|null} poi - Source POI, whose persisted visibility stays unchanged.
 * @param {object} options - Optional runtime state and presentation permissions.
 * @param {boolean} options.allowReplayPreparation - Apply Replay visibility during preparation.
 * @param {boolean} options.allowReplayAnimation - Explicit permission for a Replay animation.
 * @returns {{active: boolean, animationActive: boolean, visible: boolean}} Current presentation.
 */
export const resolveReplayPOIPresentation = (poi, {
    replay = globalThis.lgs?.stores?.replay,
    settings = globalThis.lgs?.settings?.ui?.replay ?? replay,
    allowReplayAnimation = false,
    allowReplayPreparation = false,
    animatedPOI = undefined,
} = {}) => {
    const active = isReplayPOIPresentationActive(replay)
    const basicMode = isJourneyReplayBasicMode({settings, replay})
    const preparationActive = basicMode && (allowReplayPreparation || replay?.poiPresentationPreparationActive === true)
    const policyActive = active || preparationActive
    const endpoint = isReplayPOIEndpoint(poi)
    const animationActive = active && (allowReplayAnimation
        || (typeof animatedPOI === 'boolean'
            ? animatedPOI
            : isReplayPOIInAnimatedSnapshot(replay?.animatedPOIIds, poi?.id)))
    const ineligibleGlobalPOI = policyActive
        && isGlobalPOI(poi)
        && !isReplayGlobalPOIEligibleForJourney(poi, replay)
    const behavior = normalizeReplayPOIBehavior(settings?.basic)
    const forceShow = policyActive && basicMode && behavior.poiVisibilityMode === 'yes'
    const hiddenByReplay = ineligibleGlobalPOI || (policyActive && !animationActive && (
        basicMode
            ? endpoint
                ? normalizeJourneyReplayPOISettings(poi?.replay).visible === false
                : behavior.poiVisibilityMode === 'no'
                || (behavior.poiVisibilityMode === 'user'
                    && normalizeJourneyReplayPOISettings(poi?.replay).visible === false)
            : (!endpoint && (settings?.hideAllPoisDuringJourneyReplay === true
                || replay?.hideAllPoisDuringJourneyReplay === true))
                || normalizeJourneyReplayPOISettings(poi?.replay).visible === false
    ))

    return {
        active,
        animationActive,
        visible: poi?.tooClose !== true && !hiddenByReplay && (forceShow || poi?.visible !== false),
    }
}
