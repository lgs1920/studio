/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-focus.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Journey } from '@Core/Journey'
import { focusJourneyAfterPlayback } from '@Core/ui/replay/JourneyReplayClipController'
import { JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE } from '@Core/ui/replay/JourneyReplayInternal'
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
