/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-focus.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-24
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Journey } from '@Core/Journey'
import { NO_FOCUS } from '@Core/constants'
import { focusJourneyAfterPlayback } from '@Core/ui/replay/JourneyReplayClipController'
import { JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE } from '@Core/ui/replay/JourneyReplayInternal'
import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error:   vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}))

describe('Journey focus lifecycle', () => {
    afterEach(() => {
        globalThis.__ = undefined
        globalThis.lgs = undefined
        vi.restoreAllMocks()
    })

    it('returns the scene focus promise so replay restoration can finish without a camera callback', async () => {
        const focusResult = Promise.resolve('focused')
        const focusOnJourney = vi.fn(() => focusResult)
        globalThis.__ = {
            ui: {
                sceneManager: {focusOnJourney},
            },
        }
        const journey = new Journey()

        const result = journey.focus({resetCamera: true, rotate: false})

        expect(result).toBe(focusResult)
        await expect(result).resolves.toBe('focused')
        expect(focusOnJourney).toHaveBeenCalledWith(expect.objectContaining({
            journey,
            target: journey,
            resetCamera: true,
            rotate: false,
        }))
    })

    it('hides only other journey traces without changing their visibility settings', async () => {
        const journey = new Journey()
        journey.slug = 'journey-other'
        journey.visible = true
        journey.tracks = new Map()
        const track = {slug: 'track#journey#other#main', visible: true, draw: vi.fn()}
        journey.tracks.set(track.slug, track)
        journey.updateVisibility = vi.fn()
        const previousLgs = globalThis.lgs
        globalThis.lgs = {viewer: {dataSources: {}}}
        const updateTrackVisibility = vi.spyOn(TrackUtils, 'updateTrackVisibility').mockImplementation(() => {})
        const updatePOIsVisibility = vi.spyOn(TrackUtils, 'updatePOIsVisibility').mockImplementation(() => {})

        try {
            await journey.draw({
                mode: NO_FOCUS,
                hideOtherJourneys: true,
                currentJourneySlug: 'journey-current',
            })

            expect(journey.visible).toBe(true)
            expect(track.visible).toBe(true)
            expect(journey.updateVisibility).toHaveBeenCalledWith(true)
            expect(updateTrackVisibility).toHaveBeenCalledWith(journey, track, false)
            expect(updatePOIsVisibility).toHaveBeenCalledWith(journey, false)
        }
        finally {
            updateTrackVisibility.mockRestore()
            updatePOIsVisibility.mockRestore()
            globalThis.lgs = previousLgs
        }
    })

    it('finishes replay restoration when the journey focus callback and return value are both absent', async () => {
        const journey = {
            focus: vi.fn(() => undefined),
            updateVisibility: vi.fn(),
            visible: false,
        }
        globalThis.lgs = {
            theJourney: journey,
            viewer: {
                camera: {
                    cancelFlight: vi.fn(),
                },
            },
        }
        const restoreCurrentJourneyVisibility = vi.fn()
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                cameraFlightActive: true,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                hideGloballyHiddenPOIs: vi.fn(),
                restoreCurrentJourneyVisibility,
            },
        }

        await expect(focusJourneyAfterPlayback(mode)).resolves.toBeUndefined()

        expect(journey.focus).toHaveBeenCalledTimes(1)
        expect(restoreCurrentJourneyVisibility).toHaveBeenCalledTimes(1)
    })
})
