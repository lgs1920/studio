/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraCollision.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import bbox from '@turf/bbox'
import {replayRuntimeTrackingSettings} from './JourneyReplayCameraMath'
import {REPLAY_MARKER_MODE_NAVIGATION} from './JourneyReplayProgressionStyle'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const tracksFeatureSource = journey => {
    const features = Array.from(journey?.tracks?.values?.() ?? [])
        .map(track => track?.content)
        .filter(Boolean)

    if (features.length === 0) {
        return null
    }

    return features.length === 1 ? features[0] : {
        type: 'FeatureCollection',
        features,
    }
}

const zoneArea = zone => {
    const width = finiteNumber(zone?.width) ?? 0
    const height = finiteNumber(zone?.height) ?? 0
    return Math.max(0, width * height)
}

const zonePressure = zone => {
    const area = zoneArea(zone)
    if (area <= 0) {
        return 1
    }

    return Math.max(0.9, Math.min(1.45, 1.45 - (area * 0.5)))
}

/**
 * Build the replay safety profile used by deterministic camera transfers.
 *
 * The profile keeps the historical world-space bounds for collision avoidance
 * and also exposes the active replay zones so the transfer path can adapt to
 * navigation and dynamic tracking constraints.
 *
 * @param {Journey|null} journey - Journey source of truth.
 * @param {object} [options] - Safety options.
 * @param {string} [options.trackingMode='navigation'] - Replay tracking mode.
 * @param {object|null} [options.cameraSettings] - Normalized replay camera settings.
 * @param {object|null} [options.viewport] - Active viewport dimensions.
 * @param {number} [options.clearanceMeters=500] - Base world-space clearance.
 * @returns {object|null} Replay safety profile.
 */
export const buildReplayTransferSafetyProfile = (journey, {
    trackingMode = REPLAY_MARKER_MODE_NAVIGATION,
    cameraSettings = null,
    viewport = null,
    clearanceMeters = 500,
} = {}) => {
    const source = tracksFeatureSource(journey)
    if (!source) {
        return null
    }

    const runtimeTracking = replayRuntimeTrackingSettings(cameraSettings ?? {}, viewport ?? {})
    const normalizedTrackingMode = trackingMode === REPLAY_MARKER_MODE_NAVIGATION ? 'navigation' : 'dynamic'
    const navigationZone = runtimeTracking.navigation.triggerZone
    const dynamicTriggerZone = runtimeTracking.dynamic.triggerZone
    const dynamicTargetZone = runtimeTracking.dynamic.targetZone
    const primaryZone = normalizedTrackingMode === 'navigation' ? navigationZone : dynamicTargetZone
    const secondaryZone = normalizedTrackingMode === 'dynamic' ? dynamicTriggerZone : null
    const primaryPressure = zonePressure(primaryZone)
    const secondaryPressure = secondaryZone ? zonePressure(secondaryZone) : 1
    const zoneScale = normalizedTrackingMode === 'dynamic'
        ? Math.min(1.75, primaryPressure + ((secondaryPressure - 1) * 0.5) + 0.08)
        : primaryPressure

    const theBbox = bbox(source)
    if (!Array.isArray(theBbox) || theBbox.length !== 4) {
        return null
    }

    const [west, south, east, north] = theBbox.map(finiteNumber)
    if ([west, south, east, north].some(value => value === null)) {
        return null
    }

    return {
        mode: normalizedTrackingMode,
        west,
        south,
        east,
        north,
        minimumHeightMeters: 0,
        clearanceMeters:     Math.max(100, (finiteNumber(clearanceMeters) ?? 500) * zoneScale),
        zoneScale,
        zones:               {
            navigation: runtimeTracking.navigation.triggerZone,
            dynamic:    {
                trigger: runtimeTracking.dynamic.triggerZone,
                target:  runtimeTracking.dynamic.targetZone,
            },
        },
    }
}

export const buildReplayAntiCollisionBounds = (journey, options = {}) => buildReplayTransferSafetyProfile(journey, options)
