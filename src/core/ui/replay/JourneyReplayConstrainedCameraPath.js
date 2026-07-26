/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayConstrainedCameraPath.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3} from 'cesium'
import {
    clamp,
    replayInnerToleranceZoneBounds,
    replayToleranceZoneBounds,
    replayWindowCollisionFromPoint,
} from './JourneyReplayCameraMath'

const REPLAY_CONSTRAINED_PATH_MIN_SAMPLES = 128
const REPLAY_CONSTRAINED_PATH_MAX_SAMPLES = 256
const REPLAY_CONSTRAINED_PATH_SEARCH_STEPS = 24
const REPLAY_CONSTRAINED_PATH_SEARCH_ITERATIONS = 12

/**
 * Convert finite numeric input into a number.
 *
 * @param {*} value - Candidate numeric value.
 * @returns {number|null} Finite number or null.
 */
const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Check whether a Cartesian value can be used by the constrained path solver.
 *
 * @param {*} value - Candidate Cartesian value.
 * @returns {boolean} True when every component is finite.
 */
const isCartesian3Like = value => Boolean(value)
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && Number.isFinite(value.z)

/**
 * Check whether a complete camera frame can be sampled.
 *
 * @param {*} frame - Candidate camera frame.
 * @returns {boolean} True when the frame is complete.
 */
const isCameraFrame = frame => isCartesian3Like(frame?.destination)
    && isCartesian3Like(frame?.direction)
    && isCartesian3Like(frame?.up)

/**
 * Clone a complete camera frame.
 *
 * @param {object|null} frame - Source frame.
 * @returns {object|null} Cloned frame.
 */
const cloneCameraFrame = frame => isCameraFrame(frame) ? {
    destination: Cartesian3.clone(frame.destination, new Cartesian3()),
    direction:   Cartesian3.clone(frame.direction, new Cartesian3()),
    up:          Cartesian3.clone(frame.up, new Cartesian3()),
} : null

/**
 * Aim an existing camera position at an exact replay target.
 *
 * This is the deterministic fallback used when the nominal interpolated
 * orientation cannot contain the real curved-journey marker position.
 *
 * @param {object} frame - Source camera frame.
 * @param {Cartesian3} target - Exact marker target.
 * @returns {object|null} Camera frame focused on the target.
 */
export const focusConstrainedReplayFrame = (frame, target) => {
    if (!isCameraFrame(frame) || !isCartesian3Like(target)) {
        return cloneCameraFrame(frame)
    }

    const direction = normalizeCartesian(
        Cartesian3.subtract(target, frame.destination, new Cartesian3()),
        frame.direction,
    )
    const sourceUp = normalizeCartesian(frame.up, Cartesian3.UNIT_Z)
    const right = normalizeCartesian(
        Cartesian3.cross(direction, sourceUp, new Cartesian3()),
        Cartesian3.cross(frame.direction, frame.up, new Cartesian3()),
    )
    const up = normalizeCartesian(
        Cartesian3.cross(right, direction, new Cartesian3()),
        sourceUp,
    )
    if (!direction || !up) {
        return cloneCameraFrame(frame)
    }

    return {
        destination: Cartesian3.clone(frame.destination, new Cartesian3()),
        direction,
        up,
    }
}

/**
 * Normalize a Cartesian direction with a stable fallback.
 *
 * @param {Cartesian3} value - Value to normalize.
 * @param {Cartesian3} fallback - Fallback direction.
 * @returns {Cartesian3|null} Normalized direction.
 */
const normalizeCartesian = (value, fallback) => {
    if (isCartesian3Like(value) && Cartesian3.magnitudeSquared(value) > Number.EPSILON) {
        return Cartesian3.normalize(value, new Cartesian3())
    }

    return isCartesian3Like(fallback)
        ? Cartesian3.normalize(fallback, new Cartesian3())
        : null
}

/**
 * Interpolate a complete camera frame.
 *
 * Position and orientation are interpolated together so Draft and HQ consume
 * the same pose for a given replay progress.
 *
 * @param {object} start - Start camera frame.
 * @param {object} end - End camera frame.
 * @param {number} ratio - Interpolation ratio.
 * @returns {object|null} Interpolated frame.
 */
export const interpolateConstrainedReplayFrame = (start, end, ratio = 0) => {
    if (!isCameraFrame(start) || !isCameraFrame(end)) {
        return cloneCameraFrame(start ?? end)
    }

    const safeRatio = clamp(finiteNumber(ratio) ?? 0, 0, 1)
    const direction = normalizeCartesian(
        Cartesian3.lerp(start.direction, end.direction, safeRatio, new Cartesian3()),
        end.direction,
    )
    const upCandidate = normalizeCartesian(
        Cartesian3.lerp(start.up, end.up, safeRatio, new Cartesian3()),
        end.up,
    )
    const right = normalizeCartesian(
        Cartesian3.cross(direction, upCandidate, new Cartesian3()),
        Cartesian3.cross(end.direction, end.up, new Cartesian3()),
    )
    const up = normalizeCartesian(
        Cartesian3.cross(right, direction, new Cartesian3()),
        upCandidate,
    )
    return {
        destination: Cartesian3.lerp(start.destination, end.destination, safeRatio, new Cartesian3()),
        direction,
        up,
    }
}

/**
 * Apply a lateral drift to a replay frame while preserving its marker target.
 *
 * @param {object} frame - Source camera frame.
 * @param {Cartesian3} target - Marker target that must remain framed.
 * @param {number} lateralMeters - Signed displacement along the camera right axis.
 * @returns {object|null} Drifted camera frame.
 */
export const offsetConstrainedReplayFrame = (frame, target, lateralMeters = 0) => {
    if (!isCameraFrame(frame) || !isCartesian3Like(target)) {
        return cloneCameraFrame(frame)
    }

    const distance = finiteNumber(lateralMeters) ?? 0
    if (Math.abs(distance) <= Number.EPSILON) {
        return cloneCameraFrame(frame)
    }

    const direction = normalizeCartesian(frame.direction, Cartesian3.UNIT_Z)
    const sourceUp = normalizeCartesian(frame.up, Cartesian3.UNIT_Y)
    const right = normalizeCartesian(
        Cartesian3.cross(direction, sourceUp, new Cartesian3()),
        Cartesian3.UNIT_X,
    )
    if (!direction || !sourceUp || !right) {
        return cloneCameraFrame(frame)
    }

    const destination = Cartesian3.add(
        frame.destination,
        Cartesian3.multiplyByScalar(right, distance, new Cartesian3()),
        new Cartesian3(),
    )
    const targetDirection = normalizeCartesian(
        Cartesian3.subtract(target, destination, new Cartesian3()),
        direction,
    )
    const targetRight = normalizeCartesian(
        Cartesian3.cross(targetDirection, sourceUp, new Cartesian3()),
        right,
    )
    const up = normalizeCartesian(
        Cartesian3.cross(targetRight, targetDirection, new Cartesian3()),
        sourceUp,
    )

    return {
        destination,
        direction: targetDirection,
        up,
    }
}

/**
 * Convert a normalized bounds object back into a tolerance zone.
 *
 * @param {object} bounds - Normalized bounds.
 * @returns {object} Tolerance zone.
 */
const zoneFromBounds = bounds => ({
    top:    bounds.top,
    left:   bounds.left,
    width:  Math.max(0, bounds.right - bounds.left),
    height: Math.max(0, bounds.bottom - bounds.top),
})

/**
 * Build the landing zone used after a navigation trigger.
 *
 * Navigation has one public trigger zone. The compiler derives an internal
 * landing zone to prevent an immediate second correction after the first one.
 *
 * @param {object} triggerZone - Navigation trigger zone.
 * @returns {object} Internal navigation landing zone.
 */
const navigationLandingZone = triggerZone => zoneFromBounds(
    replayInnerToleranceZoneBounds(triggerZone, 0.28),
)

/**
 * Project a Cartesian target through a candidate camera frame.
 *
 * This projection is independent from Cesium's currently rendered camera. It
 * removes the one-frame delay that previously made Draft and HQ evaluate
 * different Z1/Z2 collisions.
 *
 * @param {object} options - Projection options.
 * @param {object} options.frame - Candidate camera frame.
 * @param {Cartesian3} options.target - World-space target.
 * @param {object} options.viewport - Crop and canvas dimensions.
 * @param {number} [options.verticalFovRadians=Math.PI / 3] - Vertical field of view.
 * @param {number|null} [options.aspectRatio] - Camera frustum aspect ratio.
 * @returns {{x: number, y: number, depth: number}|null} Crop-local screen point.
 */
export const projectReplayTargetInCameraFrame = ({
    frame,
    target,
    viewport,
    verticalFovRadians = Math.PI / 3,
    aspectRatio = null,
} = {}) => {
    if (!isCameraFrame(frame) || !isCartesian3Like(target)) {
        return null
    }

    const canvasWidth = finiteNumber(viewport?.canvasWidth) ?? finiteNumber(viewport?.width)
    const canvasHeight = finiteNumber(viewport?.canvasHeight) ?? finiteNumber(viewport?.height)
    const cropLeft = finiteNumber(viewport?.left) ?? 0
    const cropTop = finiteNumber(viewport?.top) ?? 0
    if (canvasWidth === null || canvasHeight === null || canvasWidth <= 0 || canvasHeight <= 0) {
        return null
    }

    const direction = normalizeCartesian(frame.direction, Cartesian3.UNIT_Z)
    const up = normalizeCartesian(frame.up, Cartesian3.UNIT_Y)
    const right = normalizeCartesian(
        Cartesian3.cross(direction, up, new Cartesian3()),
        Cartesian3.UNIT_X,
    )
    if (!direction || !up || !right) {
        return null
    }

    const relative = Cartesian3.subtract(target, frame.destination, new Cartesian3())
    const depth = Cartesian3.dot(relative, direction)
    if (!Number.isFinite(depth) || depth <= Number.EPSILON) {
        return null
    }

    const safeFov = clamp(
        finiteNumber(verticalFovRadians) ?? (Math.PI / 3),
        Math.PI / 180,
        Math.PI - (Math.PI / 180),
    )
    const safeAspect = Math.max(
        Number.EPSILON,
        finiteNumber(aspectRatio) ?? (canvasWidth / canvasHeight),
    )
    const tangentY = Math.tan(safeFov / 2)
    const tangentX = tangentY * safeAspect
    const normalizedX = Cartesian3.dot(relative, right) / Math.max(depth * tangentX, Number.EPSILON)
    const normalizedY = Cartesian3.dot(relative, up) / Math.max(depth * tangentY, Number.EPSILON)

    return {
        x: ((normalizedX + 1) * 0.5 * canvasWidth) - cropLeft,
        y: ((1 - normalizedY) * 0.5 * canvasHeight) - cropTop,
        depth,
    }
}

/**
 * Evaluate a target against a replay tolerance zone.
 *
 * @param {object} options - Collision options.
 * @param {object} options.frame - Candidate camera frame.
 * @param {Cartesian3} options.target - Marker target.
 * @param {Function} options.projectTarget - Projection callback.
 * @param {object} options.zone - Active tolerance zone.
 * @param {object} options.viewport - Crop dimensions.
 * @param {number} options.markerRadius - Marker radius in pixels.
 * @returns {object|null} Collision result.
 */
const collisionForFrame = ({
    frame,
    target,
    projectTarget,
    zone,
    viewport,
    markerRadius,
}) => {
    const point = projectTarget({frame, target})
    return replayWindowCollisionFromPoint({
        point,
        width:       viewport.width,
        height:      viewport.height,
        outerBounds: replayToleranceZoneBounds(zone),
        safeBounds:  replayToleranceZoneBounds(zone),
        markerRadius,
    })
}

/**
 * Determine whether a target is fully contained in a tolerance zone.
 *
 * @param {object} options - Collision options.
 * @returns {boolean} True when no camera correction is required.
 */
const frameContainsTarget = options => {
    const collision = collisionForFrame(options)
    return Boolean(collision) && collision.shouldMove !== true
}

/**
 * Find the first smooth interpolation that places the marker in a zone.
 *
 * The search starts with a coarse scan and ends with a binary refinement. It
 * avoids snapping directly to the nominal frame while still guaranteeing that
 * a sampled marker does not remain outside Z1.
 *
 * @param {object} options - Search options.
 * @param {object} options.startFrame - Current compiled frame.
 * @param {object} options.endFrame - Nominal centered frame.
 * @param {Cartesian3} options.target - Current marker target.
 * @param {Function} options.projectTarget - Projection callback.
 * @param {object} options.zone - Required screen zone.
 * @param {object} options.viewport - Crop dimensions.
 * @param {number} options.markerRadius - Marker radius.
 * @returns {object} First frame found inside the requested zone.
 */
const firstFrameInsideZone = ({
    startFrame,
    endFrame,
    target,
    projectTarget,
    zone,
    viewport,
    markerRadius,
}) => {
    const collisionOptions = {
        target,
        projectTarget,
        zone,
        viewport,
        markerRadius,
    }
    if (frameContainsTarget({...collisionOptions, frame: startFrame})) {
        return cloneCameraFrame(startFrame)
    }

    const safeEndFrame = frameContainsTarget({...collisionOptions, frame: endFrame})
                         ? endFrame
                         : focusConstrainedReplayFrame(endFrame, target)
    if (!frameContainsTarget({...collisionOptions, frame: safeEndFrame})) {
        return cloneCameraFrame(safeEndFrame)
    }

    let outsideRatio = 0
    let insideRatio = 1
    let step = 1
    while (step <= REPLAY_CONSTRAINED_PATH_SEARCH_STEPS) {
        const ratio = step / REPLAY_CONSTRAINED_PATH_SEARCH_STEPS
        const frame = interpolateConstrainedReplayFrame(startFrame, safeEndFrame, ratio)
        if (frameContainsTarget({...collisionOptions, frame})) {
            insideRatio = ratio
            outsideRatio = (step - 1) / REPLAY_CONSTRAINED_PATH_SEARCH_STEPS
            break
        }
        step += 1
    }

    let iteration = 0
    while (iteration < REPLAY_CONSTRAINED_PATH_SEARCH_ITERATIONS) {
        const ratio = (outsideRatio + insideRatio) / 2
        const frame = interpolateConstrainedReplayFrame(startFrame, safeEndFrame, ratio)
        if (frameContainsTarget({...collisionOptions, frame})) {
            insideRatio = ratio
        }
        else {
            outsideRatio = ratio
        }
        iteration += 1
    }

    return interpolateConstrainedReplayFrame(startFrame, safeEndFrame, insideRatio)
}

/**
 * Build a stable list of normalized replay progresses.
 *
 * @param {number[]} progresses - Optional source progress values.
 * @returns {number[]} Sorted progress values including both endpoints.
 */
const normalizedProgresses = progresses => {
    const source = Array.isArray(progresses)
        ? progresses
            .map(finiteNumber)
            .filter(value => value !== null)
            .map(value => clamp(value, 0, 1))
        : []
    const requestedCount = clamp(
        source.length > 0
            ? Math.ceil(source.length / 4)
            : REPLAY_CONSTRAINED_PATH_MIN_SAMPLES,
        REPLAY_CONSTRAINED_PATH_MIN_SAMPLES,
        REPLAY_CONSTRAINED_PATH_MAX_SAMPLES,
    )
    const uniform = Array.from(
        {length: requestedCount + 1},
        (_, index) => index / requestedCount,
    )
    return uniform
}

/**
 * Compute the response ratio for one compiled replay sample.
 *
 * @param {number} durationSeconds - Full replay duration.
 * @param {number} responseSeconds - Camera response duration.
 * @param {number} sampleCount - Compiled sample count.
 * @returns {number} Per-sample response ratio.
 */
const responseRatioForSamples = (durationSeconds, responseSeconds, sampleCount) => {
    const stepSeconds = Math.max(1 / 240, durationSeconds / Math.max(1, sampleCount - 1))
    const response = Math.max(0.05, responseSeconds)
    return clamp(1 - Math.exp(-stepSeconds / response), 0.02, 1)
}

/**
 * Locate the frame interval containing a replay progress.
 *
 * @param {object[]} frames - Compiled frame entries.
 * @param {number} progress - Requested replay progress.
 * @returns {number} Lower frame index.
 */
const lowerFrameIndex = (frames, progress) => {
    let low = 0
    let high = Math.max(0, frames.length - 1)
    while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        if (frames[middle].progress <= progress) {
            low = middle
        }
        else {
            high = middle - 1
        }
    }
    return low
}

/**
 * Sample a previously compiled constrained replay camera path.
 *
 * @param {object|null} path - Compiled path.
 * @param {number} progress - Normalized replay progress.
 * @returns {object|null} Camera frame.
 */
export const sampleConstrainedReplayCameraPath = (path, progress = 0) => {
    const frames = Array.isArray(path?.frames) ? path.frames : []
    if (frames.length === 0) {
        return null
    }

    const safeProgress = clamp(finiteNumber(progress) ?? 0, 0, 1)
    const startIndex = lowerFrameIndex(frames, safeProgress)
    const start = frames[startIndex]
    const end = frames[Math.min(frames.length - 1, startIndex + 1)]
    const span = Math.max(Number.EPSILON, end.progress - start.progress)
    const ratio = start === end ? 0 : (safeProgress - start.progress) / span
    const interpolatedFrame = interpolateConstrainedReplayFrame(start.frame, end.frame, ratio)
    const constraints = path?.constraints
    if (
        !constraints
        || !isCartesian3Like(start.target)
        || !isCartesian3Like(end.target)
        || !isCameraFrame(start.nominalFrame)
        || !isCameraFrame(end.nominalFrame)
    ) {
        return interpolatedFrame
    }

    const interpolatedTarget = Cartesian3.lerp(start.target, end.target, ratio, new Cartesian3())
    const exactTarget = (() => {
        try {
            return constraints.targetAtProgress?.(safeProgress) ?? null
        }
        catch {
            return null
        }
    })()
    const target = isCartesian3Like(exactTarget)
                   ? exactTarget
                   : interpolatedTarget
    const nominalFrame = interpolateConstrainedReplayFrame(
        start.nominalFrame,
        end.nominalFrame,
        ratio,
    )
    const collisionOptions = {
        projectTarget: constraints.projectTarget,
        zone:          constraints.triggerZone,
        viewport:      constraints.viewport,
        markerRadius:  constraints.markerRadius,
        frame:         interpolatedFrame,
        target,
    }
    if (frameContainsTarget(collisionOptions)) {
        return interpolatedFrame
    }

    return firstFrameInsideZone({
        startFrame: interpolatedFrame,
        endFrame:   nominalFrame,
        target,
        projectTarget: constraints.projectTarget,
        zone:          constraints.triggerZone,
        viewport:      constraints.viewport,
        markerRadius:  constraints.markerRadius,
    })
}

/**
 * Compile a journey-derived camera path under Z1/Z2 screen constraints.
 *
 * The compiler is intentionally independent from the live Cesium camera. It
 * receives deterministic nominal frames and marker targets, then stores one
 * in-memory result that can be sampled by Draft and HQ.
 *
 * @param {object} options - Compiler options.
 * @param {number[]} [options.progresses] - Preferred source progress density.
 * @param {Function} options.sampleAtProgress - Journey sampler callback.
 * @param {Function} options.frameForSample - Nominal camera frame callback.
 * @param {Function} options.targetForSample - Marker Cartesian callback.
 * @param {Function} options.projectTarget - Pure candidate-frame projection callback.
 * @param {string} options.trackingMode - Navigation or dynamic tracking mode.
 * @param {object} options.triggerZone - Z1 trigger zone.
 * @param {object|null} options.targetZone - Dynamic Z2 landing zone.
 * @param {object} options.viewport - Crop dimensions.
 * @param {number} [options.markerRadius=0] - Marker radius in pixels.
 * @param {number} [options.durationSeconds=60] - Replay duration.
 * @param {number} [options.responseSeconds=1] - Recenter response duration.
 * @param {number} [options.lookaheadSeconds=1] - Predictive collision horizon.
 * @returns {object|null} Compiled constrained path.
 */
export const buildConstrainedReplayCameraPath = ({
    progresses = [],
    sampleAtProgress,
    frameForSample,
    targetForSample,
    projectTarget,
    trackingMode,
    triggerZone,
    targetZone = null,
    viewport,
    markerRadius = 0,
    durationSeconds = 60,
    responseSeconds = 1,
    lookaheadSeconds = 1,
} = {}) => {
    if (
        typeof sampleAtProgress !== 'function'
        || typeof frameForSample !== 'function'
        || typeof targetForSample !== 'function'
        || typeof projectTarget !== 'function'
        || !viewport
        || !triggerZone
    ) {
        return null
    }

    const sourceProgresses = normalizedProgresses(progresses)
    const entries = sourceProgresses
        .map(progress => {
            const sample = sampleAtProgress(progress)
            const nominalFrame = frameForSample(sample, progress)
            const target = targetForSample(sample, progress)
            return isCameraFrame(nominalFrame) && isCartesian3Like(target)
                ? {
                    progress,
                    sample,
                    nominalFrame,
                    target,
                }
                : null
        })
        .filter(Boolean)
    if (entries.length === 0) {
        return null
    }

    const safeDurationSeconds = Math.max(1, finiteNumber(durationSeconds) ?? 60)
    const safeResponseSeconds = Math.max(0.05, finiteNumber(responseSeconds) ?? 1)
    const safeLookaheadSeconds = Math.max(0, finiteNumber(lookaheadSeconds) ?? safeResponseSeconds)
    const lookaheadCount = Math.max(
        1,
        Math.ceil((safeLookaheadSeconds / safeDurationSeconds) * Math.max(1, entries.length - 1)),
    )
    const responseRatio = responseRatioForSamples(
        safeDurationSeconds,
        safeResponseSeconds,
        entries.length,
    )
    const landingZone = trackingMode === 'dynamic' && targetZone
        ? targetZone
        : navigationLandingZone(triggerZone)
    const safeMarkerRadius = Math.max(0, finiteNumber(markerRadius) ?? 0)
    const frames = []
    let currentFrame = cloneCameraFrame(entries[0].nominalFrame)
    let correctionActive = false
    let constrainedSamples = 0

    entries.forEach((entry, index) => {
        const futureEntry = entries[Math.min(entries.length - 1, index + lookaheadCount)]
        const collisionOptions = {
            projectTarget,
            zone: triggerZone,
            viewport,
            markerRadius: safeMarkerRadius,
        }
        const currentInsideTrigger = frameContainsTarget({
            ...collisionOptions,
            frame:  currentFrame,
            target: entry.target,
        })
        const futureInsideTrigger = frameContainsTarget({
            ...collisionOptions,
            frame:  currentFrame,
            target: futureEntry.target,
        })
        if (!currentInsideTrigger || !futureInsideTrigger) {
            correctionActive = true
        }

        if (correctionActive) {
            constrainedSamples += 1
            const desiredFrame = futureEntry.nominalFrame
            let nextFrame = interpolateConstrainedReplayFrame(
                currentFrame,
                desiredFrame,
                responseRatio,
            )
            if (!frameContainsTarget({
                ...collisionOptions,
                frame:  nextFrame,
                target: entry.target,
            })) {
                nextFrame = firstFrameInsideZone({
                    startFrame: nextFrame,
                    endFrame:   entry.nominalFrame,
                    target:     entry.target,
                    projectTarget,
                    zone:       triggerZone,
                    viewport,
                    markerRadius: safeMarkerRadius,
                })
            }
            currentFrame = nextFrame

            const currentInsideLanding = frameContainsTarget({
                projectTarget,
                zone: landingZone,
                viewport,
                markerRadius: safeMarkerRadius,
                frame: currentFrame,
                target: entry.target,
            })
            const futureInsideLanding = frameContainsTarget({
                projectTarget,
                zone: landingZone,
                viewport,
                markerRadius: safeMarkerRadius,
                frame: currentFrame,
                target: futureEntry.target,
            })
            if (currentInsideLanding && futureInsideLanding) {
                correctionActive = false
            }
        }

        frames.push({
            progress:     entry.progress,
            frame:        cloneCameraFrame(currentFrame),
            nominalFrame: cloneCameraFrame(entry.nominalFrame),
            target:       Cartesian3.clone(entry.target, new Cartesian3()),
        })
    })

    const path = {
        mode: 'replay-constrained',
        trackingMode,
        triggerZone,
        targetZone: landingZone,
        viewport: {...viewport},
        durationSeconds: safeDurationSeconds,
        responseSeconds: safeResponseSeconds,
        lookaheadSeconds: safeLookaheadSeconds,
        constrainedSamples,
        frames,
        constraints: {
            projectTarget,
            triggerZone,
            viewport: {...viewport},
            markerRadius: safeMarkerRadius,
            targetAtProgress: progress => {
                const sample = sampleAtProgress(progress)
                return targetForSample(sample, progress)
            },
        },
    }
    /**
     * Sample the compiled path with a final exact-progress constraint check.
     *
     * @param {number} progress - Normalized replay progress.
     * @returns {object|null} Constrained camera frame.
     */
    const sampleAt = progress => sampleConstrainedReplayCameraPath(path, progress)
    path.sampleAt = sampleAt
    return path
}
