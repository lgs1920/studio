/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-utils-startup.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-15
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Journey } from '@Core/Journey'
import { TrackUtils } from '@Utils/cesium/TrackUtils'

describe('TrackUtils startup journey visibility', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        vi.restoreAllMocks()
        globalThis.lgs = previousLgs
    })

    it.each([true, false])('passes the global hide-other-journeys preference (%s)', async hideOtherJourneys => {
        const currentJourney = {slug: 'journey-current'}
        const otherJourney = {
            slug:          'journey-other',
            camera:        {},
            prepareDrawing: vi.fn(async () => undefined),
            draw:          vi.fn(async () => undefined),
        }

        vi.spyOn(Journey, 'readAllFromDB').mockResolvedValue([otherJourney])
        globalThis.lgs = {
            theJourney: currentJourney,
            settings: {
                journey: {hideOtherJourneys},
            },
            saveJourneyInContext: vi.fn(),
        }

        await expect(TrackUtils.readRemainingFromDB()).resolves.toEqual([otherJourney])

        expect(otherJourney.draw).toHaveBeenCalledWith(expect.objectContaining({
            hideOtherJourneys,
            currentJourneySlug: currentJourney.slug,
        }))
    })
})
