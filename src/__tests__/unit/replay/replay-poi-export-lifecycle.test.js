/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-poi-export-lifecycle.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {POIUtils} from '@Utils/cesium/POIUtils'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {
    closeJourneyReplayOpenedPOIsBeforeStopClips, restoreNearbyPOIsAfterPlayback, syncNearbyPOIsForSample,
} from '@Core/ui/replay/JourneyReplaySessionPOIController'
import {renderReplayExportFrame} from '@Core/ui/replay/JourneyReplaySessionPlaybackController'
import {buildReplayVideoTimeline, resolveReplayVideoFramePhase} from '@Core/ui/replay/ReplayVideoTimeline'
import {resetRuntimeProgress} from '@Core/ui/replay/JourneyReplayRuntime'
import {afterEach, describe, expect, it, vi} from 'vitest'

/** Install a production POI window and visibility policy behind the public export frame boundary. */
const createReplay = () => {
    const poi = {id: 'near-end', type: 'poi', visible: true, expanded: false,
        replay: {animated: true, visible: false, displayDurationSeconds: 2}}
    const replay = {userMode: 'expert', clipSequenceActive: true, animatedPOIIds: [],
        hideAllPoisDuringJourneyReplay: true, nearbyPois: [{poi, projectedAbscissa: 990}]}
    vi.stubGlobal('lgs', {settings: {ui: {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: true}}},
        stores: {replay, main: {components: {pois: {list: new Map([[poi.id, poi]])}}}}})
    const sampler = {totalDistance: 1000, atProgress: progress => ({progress,
        distanceFromStart: progress * 1000, remainingDistance: (1 - progress) * 1000})}
    const controller = {duration: 10, seek: progress => sampler.atProgress(progress)}
    const state = {sampler, controller, sortedNearbyPois: replay.nearbyPois,
        replayPoiTriggered: new Set(), replayPoiExpandedState: new Map([[poi.id, false]]),
        renderer: {update: vi.fn()}}
    const entity = {show: false}
    const call = {
        updatePOIExpandedState: async (id, expanded) => {poi.expanded = expanded},
        applyJourneyReplayPOIVisibility: () => {
            entity.show = POIUtils.setPOIVisibility(poi, true)
        },
        now: () => 0,
        updateCamera: vi.fn(),
        recordReplayCameraAltitude: vi.fn(),
        renderReplayExportClipFrame: async ({sample}) => sample,
    }
    const mode = {[JOURNEY_REPLAY_INTERNAL_STATE]: state, [JOURNEY_REPLAY_INTERNAL_CALL]: call}
    call.syncNearbyPOIsForSample = sample => syncNearbyPOIsForSample(mode, sample)
    call.closeJourneyReplayOpenedPOIsBeforeStopClips = () => closeJourneyReplayOpenedPOIsBeforeStopClips(mode)
    const timeline = buildReplayVideoTimeline({replayDurationMillis: 10000, fps: 30,
        clips: {catalog: {outro: {id: 'outro', slots: ['stop'], defaults: {duration: 2}}}, stop: [{clipId: 'outro'}]}})

    /** Resolve and apply a frame through the same timeline used by Record and Dry run. */
    const renderAt = async (frameTimeMs, dryRun = false) => renderReplayExportFrame(mode, {
        phase: resolveReplayVideoFramePhase({timeline, frameTimeMs}), frame: {frameTimeMs}, controller, dryRun,
    })
    return {poi, replay, mode, entity, renderAt}
}

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('Replay POI fixed-frame lifecycle', () => {
    it.each([false, true])('closes a final animated POI before the outro and keeps Hide all applied (dryRun=%s)', async dryRun => {
        const {poi, replay, entity, renderAt} = createReplay()

        await renderAt(9966.666666666666, dryRun)
        expect(poi.expanded).toBe(true)
        expect(entity.show).toBe(true)
        expect(replay.animatedPOIIds).toEqual([poi.id])

        for (const timestamp of [10000, 11000, 12000]) {
            await renderAt(timestamp, dryRun)
            expect(poi.expanded).toBe(false)
            expect(entity.show).toBe(false)
            expect(replay.animatedPOIIds).toEqual([])
            expect(POIUtils.setPOIVisibility(poi, true)).toBe(false)
        }
        expect(poi.visible).toBe(true)
        expect(poi.replay.visible).toBe(false)
    })

    it('clears a previous animation when an export range starts directly inside a clip', async () => {
        const {poi, replay, mode, entity, renderAt} = createReplay()
        poi.expanded = true
        replay.animatedPOIIds = [poi.id]
        mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.add(poi.id)

        await renderAt(11000)

        expect(poi.expanded).toBe(false)
        expect(entity.show).toBe(false)
        expect(replay.animatedPOIIds).toEqual([])
    })

    it('continues through stop clips when closing a replay POI fails', async () => {
        const {mode, replay, renderAt} = createReplay()
        mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.add('near-end')
        mode[JOURNEY_REPLAY_INTERNAL_CALL].updatePOIExpandedState = vi.fn()
            .mockRejectedValue(new Error('POI update failed'))
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(renderAt(11000)).resolves.toBeTruthy()

        expect(mode[JOURNEY_REPLAY_INTERNAL_CALL].updatePOIExpandedState).toHaveBeenCalledWith('near-end', false)
        expect(replay.animatedPOIIds).toEqual([])
        expect(consoleError).toHaveBeenCalledWith(
            '[Replay POI] Failed to close POI near-end before stop clips.',
            expect.any(Error),
        )
    })

    it('restores normal expansion and clears transient animation ownership on cleanup', async () => {
        const {poi, replay, mode, renderAt} = createReplay()
        await renderAt(9900)

        await restoreNearbyPOIsAfterPlayback(mode)
        resetRuntimeProgress(replay)

        expect(poi.expanded).toBe(false)
        expect(replay.animatedPOIIds).toEqual([])
        expect(POIUtils.setPOIVisibility(poi, true)).toBe(true)
    })
})
