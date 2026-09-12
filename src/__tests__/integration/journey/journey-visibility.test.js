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
 * Last modified: 2026-09-12
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
