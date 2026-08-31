/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-load-count.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-30
 * Last modified: 2026-07-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Journey } from '@Core/Journey'
import { CountApi } from '@Utils/CountApi'
import { JOURNEY_OK, TrackUtils } from '@Utils/cesium/TrackUtils'

describe('TrackUtils journey count instrumentation', () => {
    let journey

    beforeEach(() => {
        journey = {
            slug:               'new-journey#gpx',
            tracks:             new Map(),
            visible:             true,
            globalSettings:     vi.fn(),
            extractMetrics:     vi.fn(),
            addToContext:       vi.fn(),
            addToEditor:        vi.fn(),
            persistToDatabase:  vi.fn(async () => undefined),
            saveOriginDataToDB: vi.fn(async () => undefined),
            draw:               vi.fn(async () => undefined),
        }
        globalThis.__ = {
            ui: {
                cameraManager: {stopRotate: vi.fn(async () => undefined)},
                profiler:      {draw: vi.fn()},
            },
        }
        globalThis.lgs = {
            journeys: new Map(),
            settings: {
                widgets: {
                    'profile-widget': {
                        configuration: {
                            default: {show: true},
                        },
                    },
                },
            },
            stores: {
                main: {
                    fullSize:          true,
                    canViewJourneyData: false,
                },
            },
            theJourney: journey,
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
        delete globalThis.__
        delete globalThis.lgs
    })

    it('counts each journey after the load has completed successfully', async () => {
        vi.spyOn(Journey, 'create').mockResolvedValue(journey)
        const sendJourney = vi.spyOn(CountApi, 'sendJourney').mockResolvedValue(true)

        await expect(TrackUtils.loadJourneyFromFile({
            name:     'New journey',
            extension: 'gpx',
            content:  '<gpx/>',
        })).resolves.toBe(JOURNEY_OK)

        expect(sendJourney).toHaveBeenCalledTimes(1)
        expect(journey.persistToDatabase).toHaveBeenCalledTimes(1)
        expect(journey.saveOriginDataToDB).toHaveBeenCalledTimes(1)
    })

    it('does not count unsuccessful journey loads', async () => {
        const sendJourney = vi.spyOn(CountApi, 'sendJourney').mockResolvedValue(true)

        await expect(TrackUtils.loadJourneyFromFile(null)).resolves.not.toBe(JOURNEY_OK)

        expect(sendJourney).not.toHaveBeenCalled()
    })
})
