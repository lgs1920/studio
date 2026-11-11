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
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {POIUtils} from '@Utils/cesium/POIUtils'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {
    closeJourneyReplayOpenedPOIsBeforeStopClips, restoreNearbyPOIsAfterPlayback, syncNearbyPOIsForSample,
    updatePOIExpandedState,
} from '@Core/ui/replay/JourneyReplaySessionPOIController'
import {setReplayRenderTarget, clearReplayRenderTarget} from '@Core/ui/replay/ReplayRenderTarget'
import {syncCapturedReplayPOIToTarget} from '@Core/ui/replay/ReplayPOICaptureBridge'
import {renderReplayExportFrame} from '@Core/ui/replay/JourneyReplaySessionPlaybackController'
import {buildReplayVideoTimeline, resolveReplayVideoFramePhase} from '@Core/ui/replay/ReplayVideoTimeline'
import {resetRuntimeProgress} from '@Core/ui/replay/JourneyReplayRuntime'
import * as ReplayVisibility from '@Core/ui/replay/JourneyReplayVisibilityController'
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
    it('holds a Native HQ frame update until the expanded POI bitmap reaches the isolated scene', async () => {
        const poi = {
            id: 'native-hq-animated-poi',
            longitude: 2,
            latitude: 48,
            visible: true,
            expanded: false,
            image: {src: 'collapsed', width: 40, height: 40},
        }
        const entities = new Map()
        const target = {
            viewer: {
                entities: {
                    getById: id => entities.get(id),
                    add: entity => {entities.set(entity.id, entity); return entity},
                },
                dataSources: {length: 0},
            },
            scene: {requestRender: vi.fn()},
            canvas: {width: 1920, height: 1080},
        }
        const state = {replayPoiTriggered: new Set([poi.id])}
        const mode = {[JOURNEY_REPLAY_INTERNAL_STATE]: state, [JOURNEY_REPLAY_INTERNAL_CALL]: {}}
        const updatePOI = vi.fn(async (_id, updates) => {
            Object.assign(poi, updates)
            queueMicrotask(() => {
                poi.image = {src: 'expanded-capture', width: 180, height: 120}
                void syncCapturedReplayPOIToTarget({poi, expanded: true, effectiveVisibility: true})
            })
            return poi
        })
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'expert'}}},
            stores: {main: {components: {pois: {list: new Map([[poi.id, poi]])}}}},
        })
        vi.stubGlobal('__', {
            ui: {
                sceneManager: {noRelief: () => true},
                poiManager: {updatePOI},
            },
        })
        setReplayRenderTarget(mode, target)

        try {
            await expect(updatePOIExpandedState(mode, poi.id, true)).resolves.toBe(poi)
            const entity = entities.get(poi.id)
            expect(entity).toBeDefined()
            expect(entity.billboard.image.getValue()).toBe('expanded-capture')
            expect(updatePOI).toHaveBeenCalledWith(poi.id, {expanded: true}, expect.objectContaining({skipPersist: true}))
        }
        finally {
            clearReplayRenderTarget(mode, target)
        }
    })

    it('refreshes the Native HQ POI bitmap when replay expands an already-expanded UI POI', async () => {
        const poi = {
            id: 'already-expanded-native-hq-poi',
            longitude: 2,
            latitude: 48,
            visible: true,
            expanded: true,
            image: {src: 'stale-expanded-capture', width: 120, height: 80},
        }
        const entities = new Map()
        const target = {
            viewer: {
                entities: {
                    getById: id => entities.get(id),
                    add: entity => {entities.set(entity.id, entity); return entity},
                },
                dataSources: {length: 0},
            },
            scene: {requestRender: vi.fn()},
            canvas: {width: 1920, height: 1080},
        }
        const state = {replayPoiTriggered: new Set([poi.id])}
        const mode = {[JOURNEY_REPLAY_INTERNAL_STATE]: state, [JOURNEY_REPLAY_INTERNAL_CALL]: {}}
        const updatePOI = vi.fn(async () => poi)
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'expert'}}},
            stores: {main: {components: {pois: {list: new Map([[poi.id, poi]])}}}},
        })
        vi.stubGlobal('__', {
            ui: {
                sceneManager: {noRelief: () => true},
                poiManager: {updatePOI},
            },
        })
        setReplayRenderTarget(mode, target)

        try {
            const update = updatePOIExpandedState(mode, poi.id, true)
            await Promise.resolve()
            poi.image = {src: 'fresh-expanded-capture', width: 180, height: 120}
            await syncCapturedReplayPOIToTarget({poi, expanded: true, effectiveVisibility: true})
            await expect(update).resolves.toBe(poi)

            expect(entities.get(poi.id)?.billboard.image.getValue()).toBe('fresh-expanded-capture')
            expect(updatePOI).not.toHaveBeenCalled()
        }
        finally {
            clearReplayRenderTarget(mode, target)
        }
    })

    it.each(['basic', 'expert'])('restores the pre-preparation POIs after an export handoff in %s mode', userMode => {
        const pois = [
            {id: 'initially-shown', visible: true, replay: {visible: false}},
            {id: 'user-hidden', visible: false},
            {id: 'render-hidden', visible: true},
        ]
        const entities = new Map(pois.map((poi, index) => [poi.id, {
            show: index === 0,
            billboard: {show: index === 0},
        }]))
        const replay = {userMode, animatedPOIIds: [], nearbyPois: []}
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode, basic: {poiVisibilityMode: 'no'}, hideAllPoisDuringJourneyReplay: true}}},
            stores: {replay, main: {components: {pois: {list: new Map(pois.map(poi => [poi.id, poi]))}}}},
            viewer: {entities: {getById: id => entities.get(id)}, dataSources: {length: 0}},
            scene: {requestRender: vi.fn()},
        })
        const state = {replayPOIVisibilityState: new Map(), replayPoiTriggered: new Set()}
        const call = {}
        const mode = {[JOURNEY_REPLAY_INTERNAL_STATE]: state, [JOURNEY_REPLAY_INTERNAL_CALL]: call}
        for (const name of ['replayPOICandidates', 'resolveJourneyReplayPOI', 'poiEntities', 'isVisibleProperty',
            'isPOIVisibleBeforePlayback', 'setPOIEntityVisibility']) {
            call[name] = (...args) => ReplayVisibility[name](mode, ...args)
        }

        ReplayVisibility.hideJourneyReplayPOIsForPreparation(mode)
        expect(entities.get('initially-shown').show).toBe(false)

        // Record marks the export active before restoring the preceding preparation scene.
        replay.deferredExportPlan = {runtime: {status: 'exporting'}}
        ReplayVisibility.restoreJourneyReplayPOIVisibility(mode)
        ReplayVisibility.applyJourneyReplayPOIVisibility(mode)
        expect(entities.get('initially-shown').show).toBe(false)

        replay.deferredExportPlan.runtime.status = 'ready'
        resetRuntimeProgress(replay)
        ReplayVisibility.restoreJourneyReplayPOIVisibility(mode)

        expect(entities.get('initially-shown')).toEqual({show: true, billboard: {show: true}})
        expect(entities.get('user-hidden').show).toBe(false)
        expect(entities.get('render-hidden').show).toBe(false)
        expect(state.replayPOIVisibilityState.size).toBe(0)
        expect(pois.map(poi => poi.visible)).toEqual([true, false, true])
    })

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
