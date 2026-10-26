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
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    isReplayPOIAnimationActiveAtProgress,
    isReplayPOIAnimationEndpoint,
    isReplayPOIEndpoint,
    normalizeReplayPOIBehavior,
    resolveReplayPOIPresentation,
} from '@Core/ui/replay/JourneyReplayPOISettings'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {
    prepareNearbyPOIsForPlayback,
    syncRuntimeNearbyPOIs,
    syncNearbyPOIsForSample,
} from '@Core/ui/replay/JourneyReplaySessionPOIController'
import {applyJourneyReplayPOIVisibility} from '@Core/ui/replay/JourneyReplayVisibilityController'

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

    it('keeps starter visibility user-controlled while allowing it to animate as a nearby POI', () => {
        expect(isReplayPOIEndpoint({type: 'start'})).toBe(true)
        expect(isReplayPOIEndpoint({type: 'stop'})).toBe(true)
        expect(isReplayPOIEndpoint({type: 'starter'})).toBe(true)
        expect(isReplayPOIEndpoint({type: 'poi'})).toBe(false)
        expect(isReplayPOIAnimationEndpoint({type: 'start'})).toBe(true)
        expect(isReplayPOIAnimationEndpoint({type: 'stop'})).toBe(true)
        expect(isReplayPOIAnimationEndpoint({type: 'starter'})).toBe(false)
        expect(isReplayPOIAnimationEndpoint({type: 'poi'})).toBe(false)

        const presentation = resolveReplayPOIPresentation({
            id: 'global-starter',
            type: 'starter',
            visible: true,
            replay: {visible: true},
        }, {
            replay: {
                active: true,
                basicPreparationActive: true,
                userMode: 'basic',
                animatedPOIIds: ['global-starter'],
            },
            settings: {userMode: 'basic', basic: {poiVisibilityMode: 'user'}},
        })
        expect(presentation).toMatchObject({
            animationActive: true,
            visible: true,
        })
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

    it('animates a global POI from the selected journey when the legacy journey alias is absent', async () => {
        const journey = {slug: 'journey-1'}
        const poi = {
            id: 'global-poi-1',
            type: 'starter',
            parent: null,
            longitude: 0.004493,
            latitude: 0.0001,
            replay: {visible: true},
            expanded: false,
        }
        const stalePoi = {
            id: 'stale-poi',
            type: 'poi',
            longitude: 0,
            latitude: 0,
            replay: {visible: true},
            expanded: true,
        }
        const entry = {poi, source: 'global-near-journey'}
        const points = new Map([[poi.id, poi], [stalePoi.id, stalePoi]])
        const updatePOIExpandedState = vi.fn(async (poiId, expanded) => {
            points.get(poiId).expanded = expanded
        })
        const getJourneyReplayPOIsForJourney = vi.fn(() => [entry])
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                sortedNearbyPois: [],
                replayPoiTriggered: new Set(),
                replayPoiExpandedState: new Map(),
                sampler: {
                    samples: [
                        {longitude: 0, latitude: 0},
                        {longitude: 0.008986, latitude: 0},
                    ],
                    segments: [{startIndex: 0, endIndex: 1, startDistance: 0}],
                    totalDistance: 1000,
                },
                controller: {duration: 10},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                restoreNearbyPOIsAfterPlayback: vi.fn(async () => {}),
                applyJourneyReplayPOIVisibility: vi.fn(),
                replayPOICandidates: nearbyPois => nearbyPois.map(candidate => candidate.poi),
                updatePOIExpandedState,
            },
        }
        mode[JOURNEY_REPLAY_INTERNAL_CALL].syncRuntimeNearbyPOIs = selectedJourney => syncRuntimeNearbyPOIs(mode, selectedJourney)

        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {
                userMode: 'basic',
                poiDistance: 10000,
                basic: {
                    poiVisibilityMode: 'yes',
                    animatePoisDuringJourneyReplay: true,
                    poiAnimationDurationSeconds: 2,
                },
            }}},
            stores: {
                replay: {
                    userMode: 'basic',
                    basicPreparationActive: true,
                    nearbyPois: [{poi: stalePoi, projectedAbscissa: 0, source: 'journey-poi'}],
                },
                main: {
                    theJourney: journey,
                    components: {pois: {list: points}},
                },
            },
        })
        vi.stubGlobal('__', {ui: {poiManager: {getJourneyReplayPOIsForJourney}}})

        await prepareNearbyPOIsForPlayback(mode)
        await syncNearbyPOIsForSample(mode, {progress: 0.5})

        expect(getJourneyReplayPOIsForJourney).toHaveBeenCalledWith(journey, 10000, {includeHidden: true})
        expect(globalThis.lgs.stores.replay.nearbyPois.map(candidate => candidate.poi.id)).toEqual([poi.id])
        expect(updatePOIExpandedState).toHaveBeenCalledWith(poi.id, true)
        expect(updatePOIExpandedState).not.toHaveBeenCalledWith(stalePoi.id, true)
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.has(poi.id)).toBe(true)
    })

    it('animates every POI shown by the Basic All visibility mode, including globally hidden POIs', async () => {
        const journey = {slug: 'journey-all-pois'}
        const pois = [
            {id: 'poi-visible-1', type: 'poi', longitude: 0.0017972, latitude: 0, visible: true, expanded: false},
            {id: 'poi-hidden-2', type: 'poi', longitude: 0.004493, latitude: 0, visible: false, expanded: false},
            {id: 'poi-hidden-3', type: 'poi', longitude: 0.0071888, latitude: 0, visible: false, expanded: false},
        ]
        const points = new Map(pois.map(poi => [poi.id, poi]))
        const entries = pois.map(poi => ({poi, source: 'global-near-journey'}))
        const getJourneyReplayPOIsForJourney = vi.fn((_journey, _distance, {includeHidden} = {}) => (
            entries.filter(entry => includeHidden || entry.poi.visible !== false)
        ))
        const updatePOIExpandedState = vi.fn(async (poiId, expanded) => {
            points.get(poiId).expanded = expanded
        })
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                sortedNearbyPois: [],
                replayPoiTriggered: new Set(),
                replayPoiExpandedState: new Map(),
                sampler: {
                    samples: [
                        {longitude: 0, latitude: 0},
                        {longitude: 0.008986, latitude: 0},
                    ],
                    segments: [{startIndex: 0, endIndex: 1, startDistance: 0}],
                    totalDistance: 1000,
                },
                controller: {duration: 10},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                restoreNearbyPOIsAfterPlayback: vi.fn(async () => {}),
                applyJourneyReplayPOIVisibility: vi.fn(),
                replayPOICandidates: nearbyPois => nearbyPois.map(entry => entry.poi),
                updatePOIExpandedState,
            },
        }
        mode[JOURNEY_REPLAY_INTERNAL_CALL].syncRuntimeNearbyPOIs = selectedJourney => syncRuntimeNearbyPOIs(mode, selectedJourney)

        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {
                userMode: 'basic',
                poiDistance: 10000,
                basic: {
                    poiVisibilityMode: 'yes',
                    animatePoisDuringJourneyReplay: true,
                    poiAnimationDurationSeconds: 2,
                },
            }}},
            stores: {
                replay: {userMode: 'basic', basicPreparationActive: true, poiDistance: 10000},
                main: {theJourney: journey, components: {pois: {list: points}}},
            },
        })
        vi.stubGlobal('__', {ui: {poiManager: {getJourneyReplayPOIsForJourney}}})

        await prepareNearbyPOIsForPlayback(mode)
        expect(getJourneyReplayPOIsForJourney).toHaveBeenCalledWith(journey, 10000, {includeHidden: true})

        await syncNearbyPOIsForSample(mode, {progress: 0.1})
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.has('poi-visible-1')).toBe(true)
        await syncNearbyPOIsForSample(mode, {progress: 0.4})
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.has('poi-hidden-2')).toBe(true)
        await syncNearbyPOIsForSample(mode, {progress: 0.7})
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.has('poi-hidden-3')).toBe(true)
        expect(pois.map(poi => poi.expanded)).toEqual([false, false, true])
        expect(updatePOIExpandedState).toHaveBeenCalledWith('poi-hidden-2', true)
        expect(updatePOIExpandedState).toHaveBeenCalledWith('poi-hidden-3', true)
    })

    it('preserves the expanded state of a Basic All POI with animation disabled', async () => {
        const journey = {slug: 'journey-poi-animation-exception'}
        const disabledPOI = {
            id: 'poi-no-animation',
            type: 'starter',
            longitude: 0.004493,
            latitude: 0,
            replay: {animated: false},
            expanded: true,
        }
        const animatedPOI = {
            id: 'poi-with-animation',
            type: 'poi',
            longitude: 0.004493,
            latitude: 0,
            replay: {animated: true},
            expanded: false,
        }
        const entries = [disabledPOI, animatedPOI].map(poi => ({poi, source: 'global-near-journey'}))
        const points = new Map(entries.map(entry => [entry.poi.id, entry.poi]))
        const updatePOIExpandedState = vi.fn(async (poiId, expanded) => {
            points.get(poiId).expanded = expanded
        })
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                sortedNearbyPois: [],
                replayPoiTriggered: new Set(),
                replayPoiExpandedState: new Map(),
                sampler: {
                    samples: [
                        {longitude: 0, latitude: 0},
                        {longitude: 0.008986, latitude: 0},
                    ],
                    segments: [{startIndex: 0, endIndex: 1, startDistance: 0}],
                    totalDistance: 1000,
                },
                controller: {duration: 10},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                restoreNearbyPOIsAfterPlayback: vi.fn(async () => {}),
                applyJourneyReplayPOIVisibility: vi.fn(),
                replayPOICandidates: nearbyPois => nearbyPois.map(entry => entry.poi),
                updatePOIExpandedState,
            },
        }
        mode[JOURNEY_REPLAY_INTERNAL_CALL].syncRuntimeNearbyPOIs = selectedJourney => syncRuntimeNearbyPOIs(mode, selectedJourney)

        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {
                userMode: 'basic',
                poiDistance: 10000,
                basic: {
                    poiVisibilityMode: 'yes',
                    animatePoisDuringJourneyReplay: true,
                    poiAnimationDurationSeconds: 2,
                },
            }}},
            stores: {
                replay: {userMode: 'basic', basicPreparationActive: true, totalDistance: 1000},
                main: {
                    theJourney: journey,
                    components: {pois: {list: points}},
                },
            },
        })
        vi.stubGlobal('__', {ui: {poiManager: {getJourneyReplayPOIsForJourney: vi.fn(() => entries)}}})

        await prepareNearbyPOIsForPlayback(mode)

        expect(disabledPOI.expanded).toBe(true)
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiExpandedState.has(disabledPOI.id)).toBe(false)
        expect(animatedPOI.expanded).toBe(false)
        expect(updatePOIExpandedState).not.toHaveBeenCalledWith(disabledPOI.id, false)

        await syncNearbyPOIsForSample(mode, {progress: 0.5, distanceFromStart: 500})

        expect(disabledPOI.expanded).toBe(true)
        expect(animatedPOI.expanded).toBe(true)
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.has(disabledPOI.id)).toBe(false)
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.has(animatedPOI.id)).toBe(true)
        expect(updatePOIExpandedState).not.toHaveBeenCalledWith(disabledPOI.id, true)
    })

    it('keeps an Expert POI opt-out when global animation is enabled', async () => {
        const poi = {
            id: 'poi-no-animation',
            type: 'poi',
            replay: {animated: false},
            expanded: true,
        }
        const updatePOIExpandedState = vi.fn()
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                sortedNearbyPois: [{poi, projectedAbscissa: 500}],
                sampler: {totalDistance: 1000},
                controller: {duration: 10},
                replayPoiTriggered: new Set(),
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {updatePOIExpandedState},
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {
                userMode: 'expert',
                animateAllPoisDuringJourneyReplay: true,
            }}},
            stores: {
                replay: {userMode: 'expert', animateAllPoisDuringJourneyReplay: true, totalDistance: 1000},
                main: {components: {pois: {list: new Map([[poi.id, poi]])}}},
            },
        })

        await syncNearbyPOIsForSample(mode, {progress: 0.5})

        expect(poi.expanded).toBe(true)
        expect(updatePOIExpandedState).not.toHaveBeenCalled()
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.has(poi.id)).toBe(false)
    })

    it('animates an explicitly requested Expert POI even while Hide all POIs is enabled', async () => {
        const poi = {id: 'poi-hidden', type: 'poi', replay: {visible: false, animated: true}, expanded: false}
        const points = new Map([[poi.id, poi]])
        const updatePOIExpandedState = vi.fn(async (id, expanded) => {
            points.get(id).expanded = expanded
        })
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                sortedNearbyPois: [{poi, projectedAbscissa: 500}],
                sampler: {totalDistance: 1000},
                controller: {duration: 10},
                replayPoiTriggered: new Set(),
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                updatePOIExpandedState,
                applyJourneyReplayPOIVisibility: vi.fn(),
            },
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {
                userMode: 'expert',
                hideAllPoisDuringJourneyReplay: true,
                animateAllPoisDuringJourneyReplay: false,
            }}},
            stores: {
                replay: {
                    userMode: 'expert',
                    hideAllPoisDuringJourneyReplay: true,
                    animateAllPoisDuringJourneyReplay: false,
                    totalDistance: 1000,
                },
                main: {components: {pois: {list: points}}},
            },
        })

        await syncNearbyPOIsForSample(mode, {progress: 0.4})

        expect(updatePOIExpandedState).toHaveBeenCalledWith(poi.id, true)
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.has(poi.id)).toBe(true)
        expect(mode[JOURNEY_REPLAY_INTERNAL_CALL].applyJourneyReplayPOIVisibility).toHaveBeenCalledOnce()
    })

    it('keeps active animation visibility when replay visibility mode hides the POI', () => {
        const poi = {id: 'poi-animated', type: 'poi', visible: true, replay: {visible: false}}
        const idlePOI = {id: 'poi-idle', type: 'poi', visible: true, replay: {visible: true}}
        const setPOIEntityVisibility = vi.fn()
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                replayPoiTriggered: new Set([poi.id]),
                replayPOIVisibilityState: new Map(),
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                resolveJourneyReplayPOI: entry => entry?.poi ?? null,
                replayPOICandidates: () => [poi, idlePOI],
                isPOIVisibleBeforePlayback: () => false,
                setPOIEntityVisibility,
            },
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: true}}},
            stores: {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: true}},
        })

        applyJourneyReplayPOIVisibility(mode, [{poi}, {poi: idlePOI}])

        expect(setPOIEntityVisibility).toHaveBeenCalledWith(poi, true, {allowReplayAnimation: true})
        expect(setPOIEntityVisibility).toHaveBeenCalledWith(idlePOI, false, {allowReplayAnimation: false})
    })

    it('applies Hide all before waiting for previous POI state to restore', async () => {
        let finishRestore
        const applyJourneyReplayPOIVisibility = vi.fn()
        const restoreNearbyPOIsAfterPlayback = vi.fn(() => new Promise(resolve => {
            finishRestore = resolve
        }))
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                replayPoiTriggered: new Set(['previously-animated-poi']),
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                applyJourneyReplayPOIVisibility,
                restoreNearbyPOIsAfterPlayback,
                syncRuntimeNearbyPOIs: () => [],
            },
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: true}}},
            stores: {replay: {userMode: 'expert', hideAllPoisDuringJourneyReplay: true, nearbyPois: []}},
        })

        const preparation = prepareNearbyPOIsForPlayback(mode)

        expect(applyJourneyReplayPOIVisibility).toHaveBeenCalledOnce()
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].replayPoiTriggered.size).toBe(0)
        expect(restoreNearbyPOIsAfterPlayback).toHaveBeenCalledOnce()

        finishRestore()
        await preparation
    })
})
