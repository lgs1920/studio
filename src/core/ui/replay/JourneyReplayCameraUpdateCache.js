/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraUpdateCache.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-27
 * Last modified: 2026-08-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay camera frame cache helpers.
 */

const finiteNumberKey = value => {
    if (value === null || value === undefined || value === '') {
        return 'null'
    }

    const number = Number(value)
    return Number.isFinite(number) ? `${number}` : 'null'
}

const cartesianKey = value => {
    if (!value) {
        return 'null'
    }

    const components = [value.x, value.y, value.z]
    if (components.some(component => !Number.isFinite(component))) {
        return 'null'
    }

    return components.join(',')
}

const zoneKey = zone => {
    if (!zone) {
        return 'null'
    }

    return [
        finiteNumberKey(zone.top),
        finiteNumberKey(zone.left),
        finiteNumberKey(zone.width),
        finiteNumberKey(zone.height),
    ].join(':')
}

const hysteresisKey = hysteresis => {
    if (!hysteresis) {
        return 'null'
    }

    return [
        finiteNumberKey(hysteresis.marginRatio),
        finiteNumberKey(hysteresis.easing),
        zoneKey(hysteresis.zone),
    ].join(':')
}

const sampleKey = sample => {
    if (!sample) {
        return 'null'
    }

    return [
        finiteNumberKey(sample.progress),
        finiteNumberKey(sample.distanceFromStart),
        finiteNumberKey(sample.longitude),
        finiteNumberKey(sample.latitude),
        finiteNumberKey(sample.altitude ?? sample.height),
        finiteNumberKey(sample.height ?? sample.altitude),
        finiteNumberKey(sample.journeyElapsedMillis ?? sample.timeMillis),
        finiteNumberKey(sample.journeyDurationMillis),
    ].join(':')
}

const viewKey = view => {
    if (!view) {
        return 'null'
    }

    return [
        sampleKey(view.sample),
        finiteNumberKey(view.heading),
        finiteNumberKey(view.pitch),
        finiteNumberKey(view.roll),
        finiteNumberKey(view.cameraHeight),
    ].join(':')
}

const cameraSettingsKey = cameraSettings => {
    if (!cameraSettings) {
        return 'null'
    }

    return [
        cameraSettings.positionMode ?? 'null',
        cameraSettings.altitudeMode ?? 'null',
        finiteNumberKey(cameraSettings.altitude),
        finiteNumberKey(cameraSettings.headingOffset),
        finiteNumberKey(cameraSettings.heading),
        finiteNumberKey(cameraSettings.pitch),
        cameraSettings.canDrift === false ? '0' : '1',
        cameraSettings.canFixHiddenMarker === false ? '0' : '1',
        cameraSettings.canRoll === false ? '0' : '1',
        finiteNumberKey(cameraSettings.driftSensitivity),
        finiteNumberKey(cameraSettings.rollSensitivity),
        finiteNumberKey(cameraSettings.pitchCorrectionSensitivity),
        hysteresisKey(cameraSettings.hysteresis),
    ].join(':')
}

const markerSettingsKey = markerSettings => {
    if (!markerSettings) {
        return 'null'
    }

    return [
        markerSettings.mode ?? 'null',
        sampleKey(markerSettings.position),
    ].join(':')
}

const redirectStateKey = redirectState => {
    if (!redirectState) {
        return 'null'
    }

    return [
        finiteNumberKey(redirectState.headingOffset),
        finiteNumberKey(redirectState.pitchOffset),
    ].join(':')
}

const frameKey = frame => {
    if (!frame) {
        return 'null'
    }

    return [
        cartesianKey(frame.destination),
        cartesianKey(frame.direction),
        cartesianKey(frame.up),
        cartesianKey(frame.correctedUp),
        sampleKey(frame.sample),
    ].join(':')
}

/**
 * Create a fresh cache for a single replay camera update.
 *
 * @returns {object} Cache buckets keyed by the helper-specific inputs.
 */
export const createReplayCameraUpdateCache = () => ({
    cameraViewForSample:             new Map(),
    cameraCollisionForSample:        new Map(),
    cameraLineOfSightVisibleForFrame: new Map(),
    renderedTargetVisible:           new Map(),
    renderedTraceVisibleForSample:   new Map(),
    cameraViewHasLineOfSight:       new Map(),
    cameraViewVisibilityForSample:   new Map(),
    findCameraRedirectState:        new Map(),
})

/**
 * Memoize a result in the current replay camera update cache bucket.
 *
 * @param {object|null} cache - Active replay camera cache.
 * @param {string} bucketName - Cache bucket name.
 * @param {string} key - Cache key.
 * @param {Function} compute - Lazy value factory.
 * @returns {*} Cached or computed value.
 */
export const memoizeReplayCameraUpdateCache = (cache, bucketName, key, compute) => {
    const bucket = cache?.[bucketName]
    if (!bucket) {
        return compute()
    }

    if (bucket.has(key)) {
        return bucket.get(key)
    }

    const value = compute()
    bucket.set(key, value)
    return value
}

export const replayCameraUpdateSampleKey = sampleKey
export const replayCameraUpdateViewKey = viewKey
export const replayCameraUpdateCameraSettingsKey = cameraSettingsKey
export const replayCameraUpdateMarkerSettingsKey = markerSettingsKey
export const replayCameraUpdateRedirectStateKey = redirectStateKey
export const replayCameraUpdateFrameKey = frameKey
