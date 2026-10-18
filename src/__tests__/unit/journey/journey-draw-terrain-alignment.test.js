/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-draw-terrain-alignment.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-18
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Journey } from '@Core/Journey'
import { NO_FOCUS } from '@Core/constants'

describe('Journey terrain-alignment draw behavior', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        globalThis.lgs = previousLgs
        vi.restoreAllMocks()
    })

    it('leaves terrain-alignment selection to the Journey-owned track setting', async () => {
        const journey = new Journey()
        journey.slug = 'journey-current'
        journey.visible = true
        journey.tracks = new Map()
        journey.updateVisibility = vi.fn()
        const track = {draw: vi.fn()}
        journey.tracks.set('track-current', track)
        globalThis.lgs = {theJourney: journey}

        await journey.draw({mode: NO_FOCUS})

        const drawOptions = track.draw.mock.calls[0][0]
        expect(drawOptions).toEqual(expect.objectContaining({forcedToHide: false}))
        expect(drawOptions).not.toHaveProperty('terrainAlignment')
    })
})
