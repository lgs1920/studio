/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replayStatsWidgetUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-02
 * Last modified on: 2026-07-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    getJourneyReplayRemainingMillis,
    hasJourneyReplayStopClips,
    isJourneyReplayLinked,
    resolveReplayDynamicFrameState,
    isVideoWidgetEditorPhase,
    resolveReplayExportFrameState,
    resolveReplayVideoStatsWidgetVisibility,
    resolveReplayVisibilityState,
    resolveVideoOverlayVisibility,
} from '@Core/ui/replay/ReplayOverlayResolver'

const finiteNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

const defaultReplayStore = () => globalThis.lgs?.stores?.replay ?? null

export const shouldShowDynamicStatsWidget = (replay = globalThis.lgs?.stores?.replay ?? null) => {
    return resolveReplayVideoStatsWidgetVisibility({mode: 'dynamic', replay})
}

export const shouldShowJourneyStatsWidget = (replay = globalThis.lgs?.stores?.replay ?? null) => {
    return resolveReplayVideoStatsWidgetVisibility({mode: 'journey', replay})
}

export const shouldShowVideoStatsWidget = ({
    mode = 'journey',
    replay = globalThis.lgs?.stores?.replay ?? null,
} = {}) => {
    return resolveReplayVideoStatsWidgetVisibility({mode, replay})
}

/**
 * Resolve the journey sample used by dynamic Stats.
 *
 * The shared replay frame state is preferred so Stats, Profile, and HQ export
 * widgets all render from the same tick.
 */
export const resolveDynamicJourneyReplayStatsSample = ({
    replay = defaultReplayStore(),
    controller = globalThis.__?.ui?.replay?.controller ?? null,
} = {}) => {
    const dynamicFrameState = resolveReplayDynamicFrameState(replay)
    return dynamicFrameState?.sample
           ?? controller?.currentSample?.()
           ?? replay?.liveSample
           ?? replay?.sample
           ?? null
}

export const buildDynamicJourneyReplayStatsMetrics = (
    replay = defaultReplayStore(),
    journey = globalThis.lgs?.theJourney ?? null,
    sampleOverride = null,
) => {
    const replayState = resolveReplayVisibilityState({replay})
    const sample = sampleOverride ?? replayState?.sample ?? null
    const coveredDistance = finiteNumber(
        Number(replayState?.direction) < 0
            ? sample?.remainingDistance
            : sample?.distanceFromStart,
    )
    const elapsedSeconds = finiteNumber(
        sample?.journeyElapsedMillis
        ?? replayState?.elapsedMillis
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

export {
    getJourneyReplayRemainingMillis,
    hasJourneyReplayStopClips,
    isJourneyReplayLinked,
    isVideoWidgetEditorPhase,
    resolveReplayDynamicFrameState,
    resolveReplayExportFrameState,
    resolveVideoOverlayVisibility,
}
