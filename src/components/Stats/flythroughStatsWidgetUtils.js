/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythroughStatsWidgetUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-02
 * Last modified on: 2026-07-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const END_WIDGET_LEAD_MS = 2000

const finiteNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

export const isFlythroughLinked = () => globalThis.lgs?.stores?.flythrough?.recordingSync === true

export const hasFlythroughStopClips = () => {
    const stop = globalThis.lgs?.settings?.ui?.flythrough?.clips?.stop
    return Array.isArray(stop) && stop.length > 0
}

export const isVideoWidgetEditorPhase = () => {
    const video = globalThis.lgs?.stores?.ui?.video ?? null
    return Boolean(video?.editing || video?.preRecording)
        && !video?.recording
        && !video?.finalizing
        && !video?.snapshot
}

export const getFlythroughRemainingMillis = (flythrough = globalThis.lgs?.stores?.flythrough ?? null) => {
    const durationMillis = finiteNumber(flythrough?.durationMillis)
    const progress = finiteNumber(flythrough?.progress)
    if (durationMillis === null || progress === null) {
        return null
    }

    const direction = Number(flythrough?.direction) < 0 ? -1 : 1
    const remainingProgress = direction < 0 ? progress : (1 - progress)
    return Math.max(0, durationMillis * Math.max(0, remainingProgress))
}

export const shouldShowDynamicStatsWidget = (flythrough = globalThis.lgs?.stores?.flythrough ?? null) => {
    if (!isFlythroughLinked() || !flythrough) {
        return false
    }

    if (!(flythrough.playing || flythrough.paused)) {
        return false
    }

    if (!hasFlythroughStopClips()) {
        const remainingMillis = getFlythroughRemainingMillis(flythrough)
        if (remainingMillis !== null && remainingMillis <= END_WIDGET_LEAD_MS) {
            return false
        }
    }

    return true
}

export const shouldShowJourneyStatsWidget = (flythrough = globalThis.lgs?.stores?.flythrough ?? null) => {
    if (!isFlythroughLinked() || !flythrough) {
        return false
    }

    const remainingMillis = getFlythroughRemainingMillis(flythrough)
    return remainingMillis !== null && remainingMillis <= END_WIDGET_LEAD_MS
}

export const buildDynamicFlythroughStatsMetrics = (
    flythrough = globalThis.lgs?.stores?.flythrough ?? null,
    journey = globalThis.lgs?.theJourney ?? null,
) => {
    const sample = flythrough?.sample ?? null
    const coveredDistance = finiteNumber(
        Number(flythrough?.direction) < 0
            ? sample?.remainingDistance
            : sample?.distanceFromStart,
    )
    const elapsedSeconds = finiteNumber(flythrough?.elapsedMillis)
    const elevationGain = finiteNumber(sample?.cumulativeElevationGain)
    const hasElevation = journey?.hasElevation !== false

    return {
        distance: coveredDistance ?? 0,
        positive: {
            elevation: elevationGain ?? 0,
        },
        duration: elapsedSeconds !== null ? elapsedSeconds / 1000 : 0,
        hasElevation,
    }
}
