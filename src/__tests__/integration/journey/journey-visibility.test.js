/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-visibility.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-30
 * Last modified: 2026-10-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getJourneyReplayHideOtherJourneys, getGlobalHideOtherJourneys, refreshJourneyVisibility, setGlobalHideOtherJourneys, sortJourneysByCentroidDistance } from '@Core/ui/JourneyVisibility'
import { SceneUtils } from '@Utils/cesium/SceneUtils'

describe('journey visibility policy', () => {
    let journeyA
    let journeyB
    let journeyC

    beforeEach(() => {
        journeyA = {slug: 'journey-a', draw: vi.fn(async () => undefined)}
        journeyB = {slug: 'journey-b', draw: vi.fn(async () => undefined)}
        journeyC = {slug: 'journey-c', draw: vi.fn(async () => undefined)}
        globalThis.lgs = {
            journeys: new Map([
                ['journey-a', journeyA],
                ['journey-b', journeyB],
                ['journey-c', journeyC],
            ]),
            scene: {
                requestRender: vi.fn(),
            },
            settings: {
                journey: {
                    hideOtherJourneys: false,
                },
                ui: {
                    replay: {
                        hideOtherJourneys: null,
                    },
                },
            },
            theJourney: journeyA,
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('falls back to the global journey setting for replay when no explicit override exists', () => {
        expect(getGlobalHideOtherJourneys()).toBe(false)
        expect(getJourneyReplayHideOtherJourneys()).toBe(false)
        globalThis.lgs.settings.journey.hideOtherJourneys = true
        expect(getJourneyReplayHideOtherJourneys()).toBe(true)
    })

    it('always hides other journeys in Basic Replay', () => {
        globalThis.lgs.settings.ui.replay = {
            userMode: 'basic',
            hideOtherJourneys: false,
            inheritHideOtherJourneys: false,
        }

        expect(getJourneyReplayHideOtherJourneys()).toBe(true)
    })

    it('defaults Expert Replay to hiding other journeys but honors its explicit drawer setting', () => {
        globalThis.lgs.settings.ui.replay = {
            userMode: 'expert',
            hideOtherJourneys: false,
            inheritHideOtherJourneys: true,
        }

        expect(getJourneyReplayHideOtherJourneys()).toBe(true)

        globalThis.lgs.settings.ui.replay.inheritHideOtherJourneys = false
        expect(getJourneyReplayHideOtherJourneys()).toBe(false)
    })

    it('refreshes every journey with the current visibility policy', async () => {
        await refreshJourneyVisibility({
            hideOtherJourneys: true,
            currentJourney:    journeyA,
            forceCurrentVisible: true,
        })

        expect(journeyA.draw).toHaveBeenCalledWith(expect.objectContaining({
            hideOtherJourneys: true,
            currentJourneySlug: 'journey-a',
            forceCurrentVisible: true,
        }))
        expect(journeyB.draw).toHaveBeenCalledWith(expect.objectContaining({
            hideOtherJourneys: true,
            currentJourneySlug: 'journey-a',
            forceCurrentVisible: true,
        }))
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledOnce()
    })

    it('updates the global setting and reapplies the policy', async () => {
        await setGlobalHideOtherJourneys(true, {currentJourney: journeyA})

        expect(globalThis.lgs.settings.journey.hideOtherJourneys).toBe(true)
        expect(journeyA.draw).toHaveBeenCalled()
        expect(journeyB.draw).toHaveBeenCalled()
    })

    it('does not crash when the journey registry is unavailable or non-iterable', async () => {
        globalThis.lgs.journeys = null
        await expect(refreshJourneyVisibility()).resolves.toBeUndefined()

        globalThis.lgs.journeys = {}
        await expect(refreshJourneyVisibility()).resolves.toBeUndefined()
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledTimes(2)
    })

    it('continues refreshing journeys when centroid resolution or one draw fails', async () => {
        vi.spyOn(SceneUtils, 'getJourneyCentroid').mockRejectedValue(new Error('Invalid journey geometry'))
        vi.spyOn(console, 'error').mockImplementation(() => {})
        journeyA.draw = vi.fn().mockRejectedValue(new Error('Journey renderer unavailable'))

        await expect(setGlobalHideOtherJourneys(true, {currentJourney: journeyA})).resolves.toBe(true)

        expect(journeyA.draw).toHaveBeenCalledOnce()
        expect(journeyB.draw).toHaveBeenCalledOnce()
        expect(journeyC.draw).toHaveBeenCalledOnce()
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledOnce()
    })

    it('serializes overlapping visibility changes so the latest choice is applied last', async () => {
        vi.spyOn(SceneUtils, 'getJourneyCentroid').mockImplementation(async journey => ({
            longitude: journey.slug === journeyA.slug ? 0 : 1,
            latitude:  0,
            height:    0,
        }))
        let signalFirstDraw
        let releaseFirstDraw
        const firstDrawStarted = new Promise(resolve => {
            signalFirstDraw = resolve
        })
        const firstDrawHold = new Promise(resolve => {
            releaseFirstDraw = resolve
        })
        journeyA.draw = vi.fn(async options => {
            if (options.hideOtherJourneys) {
                signalFirstDraw()
                await firstDrawHold
            }
        })

        const hideRefresh = refreshJourneyVisibility({hideOtherJourneys: true, currentJourney: journeyA})
        await firstDrawStarted
        const showRefresh = refreshJourneyVisibility({hideOtherJourneys: false, currentJourney: journeyA})
        expect(journeyB.draw).not.toHaveBeenCalled()

        releaseFirstDraw()
        await Promise.all([hideRefresh, showRefresh])

        expect(journeyA.draw.mock.calls.map(([options]) => options.hideOtherJourneys)).toEqual([true, false])
        expect(journeyB.draw.mock.calls.map(([options]) => options.hideOtherJourneys)).toEqual([true, false])
        expect(journeyC.draw.mock.calls.map(([options]) => options.hideOtherJourneys)).toEqual([true, false])
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledTimes(2)
    })

    it('sorts journeys by centroid distance from the current journey', async () => {
        const ordered = await sortJourneysByCentroidDistance(
            [journeyA, journeyB, journeyC],
            journeyB,
            async journey => {
                const centroids = {
                    'journey-a': {longitude: 10, latitude: 0, height: 0},
                    'journey-b': {longitude: 0, latitude: 0, height: 0},
                    'journey-c': {longitude: 3, latitude: 0, height: 0},
                }
                return centroids[journey.slug]
            },
        )

        expect(ordered.map(journey => journey.slug)).toEqual(['journey-b', 'journey-c', 'journey-a'])
    })

    it('refreshes journeys sequentially in centroid order', async () => {
        vi.spyOn(globalThis, 'setTimeout').mockImplementation(callback => {
            callback()
            return 0
        })
        const started = []
        let journeyBCompleted = false
        vi.spyOn(SceneUtils, 'getJourneyCentroid').mockImplementation(async journey => {
            const centroids = {
                'journey-a': {longitude: 10, latitude: 0, height: 0},
                'journey-b': {longitude: 0, latitude: 0, height: 0},
                'journey-c': {longitude: 3, latitude: 0, height: 0},
            }
            return centroids[journey.slug]
        })
        journeyA.draw = vi.fn(async () => {
            started.push('journey-a')
        })
        journeyB.draw = vi.fn(async () => {
            started.push('journey-b')
            await Promise.resolve()
            journeyBCompleted = true
        })
        journeyC.draw = vi.fn(async () => {
            expect(journeyBCompleted).toBe(true)
            started.push('journey-c')
        })

        await refreshJourneyVisibility({
            hideOtherJourneys: true,
            currentJourney:    journeyB,
        })

        expect(started).toEqual(['journey-b', 'journey-c', 'journey-a'])
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledOnce()
    })
})
