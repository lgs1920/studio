/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replayStatsWidgetUtils.js
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

export const isJourneyReplayLinked = () => globalThis.lgs?.stores?.replay?.recordingSync === true

export const hasJourneyReplayStopClips = () => {
    const stop = globalThis.lgs?.settings?.ui?.replay?.clips?.stop
    return Array.isArray(stop) && stop.length > 0
}

export const isVideoWidgetEditorPhase = () => {
    const video = globalThis.lgs?.stores?.ui?.video ?? null
    return Boolean(video?.editing || video?.preRecording)
        && !video?.recording
        && !video?.finalizing
        && !video?.snapshot
}

export const getJourneyReplayRemainingMillis = (replay = globalThis.lgs?.stores?.replay ?? null) => {
    const durationMillis = finiteNumber(replay?.durationMillis)
    const progress = finiteNumber(replay?.progress)
    if (durationMillis === null || progress === null) {
        return null
    }

    const direction = Number(replay?.direction) < 0 ? -1 : 1
    const remainingProgress = direction < 0 ? progress : (1 - progress)
    return Math.max(0, durationMillis * Math.max(0, remainingProgress))
}

export const shouldShowDynamicStatsWidget = (replay = globalThis.lgs?.stores?.replay ?? null) => {
    if (!isJourneyReplayLinked() || !replay) {
        return false
    }

    if (!(replay.playing || replay.paused)) {
        return false
    }

    if (!hasJourneyReplayStopClips()) {
        const remainingMillis = getJourneyReplayRemainingMillis(replay)
        if (remainingMillis !== null && remainingMillis <= END_WIDGET_LEAD_MS) {
            return false
        }
    }

    return true
}

export const shouldShowJourneyStatsWidget = (replay = globalThis.lgs?.stores?.replay ?? null) => {
    if (!isJourneyReplayLinked() || !replay) {
        return false
    }

    const remainingMillis = getJourneyReplayRemainingMillis(replay)
    if (remainingMillis === null || remainingMillis > END_WIDGET_LEAD_MS) {
        return false
    }

    if (hasJourneyReplayStopClips()) {
        return true
    }

    return remainingMillis > 0
}

export const shouldShowVideoStatsWidget = ({
    mode = 'journey',
    replay = globalThis.lgs?.stores?.replay ?? null,
} = {}) => {
    if (isVideoWidgetEditorPhase()) {
        return true
    }

    return mode === 'dynamic'
           ? shouldShowDynamicStatsWidget(replay)
           : shouldShowJourneyStatsWidget(replay)
}

export const buildDynamicJourneyReplayStatsMetrics = (
    replay = globalThis.lgs?.stores?.replay ?? null,
    journey = globalThis.lgs?.theJourney ?? null,
    sampleOverride = null,
) => {
    const sample = sampleOverride ?? replay?.sample ?? null
    const coveredDistance = finiteNumber(
        Number(replay?.direction) < 0
            ? sample?.remainingDistance
            : sample?.distanceFromStart,
    )
    const elapsedSeconds = finiteNumber(
        sample?.journeyElapsedMillis
        ?? replay?.elapsedMillis
    )
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
