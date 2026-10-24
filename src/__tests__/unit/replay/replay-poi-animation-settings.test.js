/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-poi-animation-settings.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    isReplayPOIAnimationActiveAtProgress,
    isReplayPOIEndpoint,
    normalizeReplayPOIBehavior,
} from '@Core/ui/replay/JourneyReplayPOISettings'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {syncNearbyPOIsForSample} from '@Core/ui/replay/JourneyReplaySessionPOIController'

afterEach(() => vi.unstubAllGlobals())

describe('Replay POI animation settings', () => {
    it('defaults Basic Replay POIs to user visibility, no animation, and a two-second duration', () => {
        expect(normalizeReplayPOIBehavior()).toEqual({
            poiVisibilityMode: 'user',
            animatePoisDuringJourneyReplay: false,
            poiAnimationDurationSeconds: 2,
        })
    })

    it('normalizes legacy visibility and animation settings', () => {
        expect(normalizeReplayPOIBehavior({
            hideAllPoisDuringJourneyReplay: true,
            animateAllPoisDuringJourneyReplay: true,
        })).toEqual({
            poiVisibilityMode: 'no',
            animatePoisDuringJourneyReplay: true,
            poiAnimationDurationSeconds: 2,
        })
    })

    it('limits the Basic animation duration to one through three seconds', () => {
        expect(normalizeReplayPOIBehavior({poiAnimationDurationSeconds: 0}).poiAnimationDurationSeconds).toBe(1)
        expect(normalizeReplayPOIBehavior({poiAnimationDurationSeconds: 2.7}).poiAnimationDurationSeconds).toBe(3)
        expect(normalizeReplayPOIBehavior({poiAnimationDurationSeconds: 9}).poiAnimationDurationSeconds).toBe(3)
    })

    it('centers the expansion window on the POI passage time', () => {
        const options = {
            poiDistance: 500,
            totalDistance: 1000,
            replayDurationSeconds: 10,
            animationDurationSeconds: 2,
        }

        expect(isReplayPOIAnimationActiveAtProgress({...options, progress: 0.39})).toBe(false)
        expect(isReplayPOIAnimationActiveAtProgress({...options, progress: 0.4})).toBe(true)
        expect(isReplayPOIAnimationActiveAtProgress({...options, progress: 0.5})).toBe(true)
        expect(isReplayPOIAnimationActiveAtProgress({...options, progress: 0.599})).toBe(true)
        expect(isReplayPOIAnimationActiveAtProgress({...options, progress: 0.6})).toBe(false)
    })

    it('identifies all endpoint POIs so they can retain user visibility without animation', () => {
        expect(isReplayPOIEndpoint({type: 'start'})).toBe(true)
        expect(isReplayPOIEndpoint({type: 'stop'})).toBe(true)
        expect(isReplayPOIEndpoint({type: 'starter'})).toBe(true)
        expect(isReplayPOIEndpoint({type: 'poi'})).toBe(false)
    })

    it('opens Basic POIs in a replay-clock window and never auto-opens Start or Stop', async () => {
        const poi = {id: 'poi-1', type: 'poi', replay: {visible: true}, expanded: false}
        const start = {id: 'poi-start', type: 'start', replay: {visible: true}, expanded: false}
        const stop = {id: 'poi-stop', type: 'stop', replay: {visible: true}, expanded: false}
        const points = new Map([[poi.id, poi], [start.id, start], [stop.id, stop]])
        const updatePOIExpandedState = vi.fn(async (id, expanded) => {
            points.get(id).expanded = expanded
        })
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                sortedNearbyPois: [
                    {poi, projectedAbscissa: 500},
                    {poi: start, projectedAbscissa: 200},
                    {poi: stop, projectedAbscissa: 800},
                ],
                sampler: {totalDistance: 1000},
                controller: {duration: 10},
                replayPoiTriggered: new Set(),
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {updatePOIExpandedState},
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'basic', basic: {
                poiVisibilityMode: 'yes',
                animatePoisDuringJourneyReplay: true,
                poiAnimationDurationSeconds: 2,
            }}}},
            stores: {
                replay: {userMode: 'basic', basicPreparationActive: true, totalDistance: 1000},
                main: {components: {pois: {list: points}}},
            },
        })

        await syncNearbyPOIsForSample(mode, {progress: 0.39, distanceFromStart: 390})
        expect(updatePOIExpandedState).not.toHaveBeenCalled()

        await syncNearbyPOIsForSample(mode, {progress: 0.4, distanceFromStart: 400})
        expect(updatePOIExpandedState).toHaveBeenCalledTimes(1)
        expect(updatePOIExpandedState).toHaveBeenLastCalledWith(poi.id, true)
        expect(start.expanded).toBe(false)
        expect(stop.expanded).toBe(false)

        await syncNearbyPOIsForSample(mode, {progress: 0.6, distanceFromStart: 600})
        expect(updatePOIExpandedState).toHaveBeenLastCalledWith(poi.id, false)
    })
})
