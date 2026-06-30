/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-visibility.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-30
 * Last modified on: 2026-06-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFlythroughHideOtherJourneys, getGlobalHideOtherJourneys, refreshJourneyVisibility, setGlobalHideOtherJourneys } from '@Core/ui/JourneyVisibility'

describe('journey visibility policy', () => {
    let journeyA
    let journeyB

    beforeEach(() => {
        journeyA = {slug: 'journey-a', draw: vi.fn(async () => undefined)}
        journeyB = {slug: 'journey-b', draw: vi.fn(async () => undefined)}
        globalThis.lgs = {
            journeys: new Map([
                ['journey-a', journeyA],
                ['journey-b', journeyB],
            ]),
            scene: {
                requestRender: vi.fn(),
            },
            settings: {
                journey: {
                    hideOtherJourneys: false,
                },
                ui: {
                    flythrough: {
                        hideOtherJourneys: null,
                    },
                },
            },
            theJourney: journeyA,
        }
    })

    it('falls back to the global journey setting for flythrough when no explicit override exists', () => {
        expect(getGlobalHideOtherJourneys()).toBe(false)
        expect(getFlythroughHideOtherJourneys()).toBe(false)
        globalThis.lgs.settings.journey.hideOtherJourneys = true
        expect(getFlythroughHideOtherJourneys()).toBe(true)
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
})
