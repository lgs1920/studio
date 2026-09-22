/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: deferred-journey-ui-responsiveness.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-22
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it, vi } from 'vitest'

import { runDeferredJourneyDataLoad } from '@Core/ui/deferredJourneyData'

const waitForBackgroundStartupTask = () => new Promise(resolve => {
    setTimeout(resolve, 20)
})

describe('deferred journey UI responsiveness', () => {
    it('does not wait for POI location resolution or capture preparation', async () => {
        let resolveLocation
        let resolvePrecache
        const dependencies = {
            journeyGroupManager: {
                initialize: vi.fn(async () => undefined),
            },
            poiManager: {
                ensureAllPOILocations: vi.fn(() => new Promise(resolve => {
                    resolveLocation = resolve
                })),
                readAllFromDB: vi.fn(async () => undefined),
                rebuildJourneyIndex: vi.fn(),
            },
            precacheAssets: vi.fn(() => new Promise(resolve => {
                resolvePrecache = resolve
            })),
            trackUtils: {
                readRemainingFromDB: vi.fn(async () => [{slug: 'journey-a'}]),
            },
            uiToast: {
                success: vi.fn(),
            },
        }

        await expect(runDeferredJourneyDataLoad(dependencies)).resolves.toBeUndefined()

        expect(dependencies.trackUtils.readRemainingFromDB).toHaveBeenCalledOnce()
        expect(dependencies.journeyGroupManager.initialize).toHaveBeenCalledOnce()
        expect(dependencies.poiManager.rebuildJourneyIndex).toHaveBeenCalledOnce()
        expect(dependencies.poiManager.ensureAllPOILocations).not.toHaveBeenCalled()
        expect(dependencies.precacheAssets).not.toHaveBeenCalled()

        await waitForBackgroundStartupTask()

        expect(dependencies.poiManager.ensureAllPOILocations).toHaveBeenCalledOnce()
        expect(dependencies.precacheAssets).toHaveBeenCalledOnce()

        resolveLocation()
        resolvePrecache()
    })
})
