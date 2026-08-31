/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-import-color.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-12
 * Last modified: 2026-07-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Journey } from '@Core/Journey'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error:   vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}))

describe('Journey import color assignment', () => {
    beforeEach(() => {
        globalThis.__ = {
            app: {
                setSlug: ({content}) => content.join('#').toLowerCase(),
            },
            ui:  {
                editor: {
                    journey: {
                        newColor: vi.fn(() => '#abcdef'),
                    },
                },
            },
        }

        globalThis.lgs = {
            settings: {
                getJourney: {
                    thickness: 2,
                },
            },
        }
    })

    afterEach(() => {
        globalThis.__ = undefined
        globalThis.lgs = undefined
        vi.restoreAllMocks()
    })

    it('keeps an explicit imported track color', () => {
        const journey = new Journey('Imported Journey', 'gpx', {allowRename: false})
        journey.geoJson = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {
                        name:   'Main Track',
                        color:  '#123456',
                        stroke: '#123456',
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [6.1, 45.1, 100],
                            [6.2, 45.2, 120],
                        ],
                    },
                },
            ],
        }

        journey.getTracksFromGeoJson()

        const track = Array.from(journey.tracks.values())[0]

        expect(__.ui.editor.journey.newColor).not.toHaveBeenCalled()
        expect(track.color).toBe('#123456')
    })

    it('uses the palette when the imported track has no color', () => {
        const journey = new Journey('Imported Journey', 'gpx', {allowRename: false})
        journey.geoJson = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: {
                        name: 'Main Track',
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [6.1, 45.1, 100],
                            [6.2, 45.2, 120],
                        ],
                    },
                },
            ],
        }

        journey.getTracksFromGeoJson()

        const track = Array.from(journey.tracks.values())[0]

        expect(__.ui.editor.journey.newColor).toHaveBeenCalledTimes(1)
        expect(track.color).toBe('#abcdef')
    })
})
