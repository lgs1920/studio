/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-poi-appearance-proximity.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-29
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {syncNearbyPOIsForSample} from '@Core/ui/replay/JourneyReplaySessionPOIController'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {afterEach, describe, expect, it, vi} from 'vitest'

/** Build a moving view whose zoom can contain either nearby POIs or the complete route. */
const createReplayView = ({userMode, height, direction = 1, distances = [2000, 50000, 90000]}) => {
    const totalDistance = 100000
    const pois = distances.map(distance => ({
        id: `poi-${distance}`,
        type: 'poi',
        expanded: false,
        replay: {animated: true, displayDurationSeconds: 2},
    }))
    const entries = pois.map((poi, index) => ({poi, projectedAbscissa: distances[index]}))
    const points = new Map(pois.map(poi => [poi.id, poi]))
    const replay = {userMode, direction, totalDistance, animatedPOIIds: []}
    let markerDistance = 0
    const viewer = {
        canvas: {clientWidth: 800, clientHeight: 600},
        scene: {
            worldToWindowCoordinates: position => ({
                x: 400 + (position.x - markerDistance) * 100 / height,
                y: 300,
            }),
        },
    }
    vi.stubGlobal('lgs', {
        settings: {ui: {replay: {
            userMode,
            basic: {poiVisibilityMode: 'no', animatePoisDuringJourneyReplay: true, poiAnimationDurationSeconds: 2},
            hideAllPoisDuringJourneyReplay: true,
            animateAllPoisDuringJourneyReplay: true,
        }}},
        stores: {replay, main: {components: {pois: {list: points}}}},
        viewer,
    })
    const mode = {
        [JOURNEY_REPLAY_INTERNAL_STATE]: {
            sortedNearbyPois: entries,
            sampler: {totalDistance},
            controller: {duration: 10, direction},
            replayPoiTriggered: new Set(),
        },
        [JOURNEY_REPLAY_INTERNAL_CALL]: {
            cesiumViewer: () => viewer,
            poiEntities: poi => [{position: {x: distances[pois.indexOf(poi)], y: 0, z: 0}}],
            videoCropRect: () => ({left: 100, top: 100, width: 600, height: 400}),
            updatePOIExpandedState: async (id, expanded) => {points.get(id).expanded = expanded},
            applyJourneyReplayPOIVisibility: vi.fn(),
        },
    }

    /** Apply one canonical route sample and return the POIs whose animations own visibility. */
    const step = async progress => {
        markerDistance = progress * totalDistance
        await syncNearbyPOIsForSample(mode, {progress, distanceFromStart: markerDistance})
        return [...replay.animatedPOIIds]
    }
    return {step}
}

afterEach(() => vi.unstubAllGlobals())

describe('Replay POI appearance proximity', () => {
    it.each(['basic', 'expert'].flatMap(userMode => [1000, 1000000].map(height => ({userMode, height}))))(
        'opens only POIs near the current passage in $userMode at height $height',
        async ({userMode, height}) => {
            const {step} = createReplayView({userMode, height})

            expect(await step(0)).toEqual(['poi-2000'])
            expect(await step(0.02)).toEqual(['poi-2000'])
            expect(await step(0.3)).toEqual([])
            expect(await step(0.5)).toEqual(['poi-50000'])
            expect(await step(0.7)).toEqual([])
            expect(await step(0.9)).toEqual(['poi-90000'])
        },
    )

    it('waits for crop entry after the approach window starts in a close view', async () => {
        const {step} = createReplayView({userMode: 'basic', height: 1000, distances: [50000]})

        expect(await step(0.4)).toEqual([])
        expect(await step(0.5)).toEqual(['poi-50000'])
    })

    it.each(['basic', 'expert'])('expires a POI display after its passage during reverse %s playback', async userMode => {
        const {step} = createReplayView({userMode, height: 1000000, direction: -1, distances: [80000]})

        expect(await step(0.85)).toEqual(['poi-80000'])
        expect(await step(0.8)).toEqual(['poi-80000'])
        expect(await step(0.59)).toEqual([])
    })
})
