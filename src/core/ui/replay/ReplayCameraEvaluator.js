/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayCameraEvaluator.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Canonical replay camera evaluation against one logical frame sample.
 */

import {resolveJourneyReplayLogicalCameraPose} from './JourneyReplayLogicalCameraPose'
import {
    isReplayCameraDefinition,
    replayCameraSettingsFromDefinition,
    resolveReplayCameraMetricRange,
} from './ReplayCameraDefinition'

/**
 * Resolve one compact camera target from a logical replay sample.
 *
 * @param {Object|null} sample - Logical anchor sample.
 * @returns {Object|null} Compact target position.
 */
const replayCameraTarget = sample => {
    const longitude = Number(sample?.longitude)
    const latitude = Number(sample?.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
    }

    const altitude = Number(sample?.altitude ?? sample?.height)
    return {
        longitude,
        latitude,
        altitude: Number.isFinite(altitude) ? altitude : 0,
    }
}

/**
 * Resolve one deterministic, renderer-independent replay camera pose.
 *
 * @param {Object} options - Camera definition and logical frame inputs.
 * @returns {Object|null} Canonical logical camera pose.
 */
export const resolveReplayCameraPose = ({
    definition = null,
    sample = null,
    sampler = null,
    progress = sample?.progress ?? 0,
    axisHeading = null,
    useAxisHeadingForSystem = false,
} = {}) => {
    if (!isReplayCameraDefinition(definition) || !sample) {
        return null
    }

    const pose = resolveJourneyReplayLogicalCameraPose({
        sample,
        sampler,
        progress,
        cameraSettings: replayCameraSettingsFromDefinition(definition),
        markerSettings: definition.marker,
        axisHeading,
        useAxisHeadingForSystem,
    })
    if (!pose) {
        return null
    }

    const target = replayCameraTarget(pose.sample)
    const verticalDistance = Math.max(0, Number(pose.cameraHeight) - Number(target?.altitude ?? 0))
    return Object.assign({}, pose, {
        definitionId: definition.id,
        target,
        rangeMeters: resolveReplayCameraMetricRange(verticalDistance, pose.pitch),
        canonical: true,
    })
}

/**
 * Build a frame-resolver adapter bound to one camera definition and sampler.
 *
 * @param {Object} options - Camera evaluator dependencies.
 * @returns {Function} Replay frame camera contribution resolver.
 */
export const createReplayCameraPoseResolver = ({
    definition = null,
    sampler = null,
    useAxisHeadingForSystem = false,
} = {}) => {
    /**
     * Resolve the camera contribution for one lazy frame context.
     *
     * @param {Object} context - Lazy frame contribution context.
     * @returns {Object|null} Canonical logical camera pose.
     */
    const resolveCameraPose = context => resolveReplayCameraPose({
        definition,
        sample: context?.sample,
        sampler,
        progress: context?.progress,
        axisHeading: context?.axisHeading ?? null,
        useAxisHeadingForSystem,
    })

    return resolveCameraPose
}
