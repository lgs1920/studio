/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: deferred-journey-data.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-24
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it, vi } from 'vitest'

import { precacheSnapdomAssets, runDeferredJourneyDataLoad } from '@Core/ui/deferredJourneyData'

vi.hoisted(() => {
    if (!Object.getOwnPropertyDescriptor(document, 'adoptedStyleSheets')) {
        Object.defineProperty(document, 'adoptedStyleSheets', {
            configurable: true,
            get:          () => [],
            set:          () => {},
        })
    }
})

const dependencies = ({journeys = []} = {}) => ({
    trackUtils:          {
        readRemainingFromDB: vi.fn(async () => journeys),
    },
    journeyGroupManager: {
        initialize: vi.fn(async () => undefined),
    },
    poiManager:          {
        readAllFromDB:         vi.fn(async () => undefined),
        rebuildJourneyIndex:  vi.fn(),
        ensureAllPOILocations: vi.fn(async () => undefined),
    },
    precacheAssets:      vi.fn(async () => undefined),
    uiToast:             {
        success: vi.fn(),
    },
})

const waitForBackgroundStartupTask = () => new Promise(resolve => {
    setTimeout(resolve, 20)
})

describe('deferred journey data loading', () => {
    it('keeps startup capture preparation disabled during responsiveness diagnostics', async () => {
        await expect(precacheSnapdomAssets()).resolves.toBeUndefined()
    })


    it('loads remaining journeys and refreshes UI-critical indexes before background work finishes', async () => {
        let resolveLocation
        let resolvePrecache
        const deps = dependencies({journeys: [{slug: 'journey-a'}, {slug: 'journey-b'}]})
        deps.poiManager.ensureAllPOILocations = vi.fn(() => new Promise(resolve => {
            resolveLocation = resolve
        }))
        deps.precacheAssets = vi.fn(() => new Promise(resolve => {
            resolvePrecache = resolve
        }))

        await runDeferredJourneyDataLoad(deps)

        expect(deps.trackUtils.readRemainingFromDB).toHaveBeenCalledOnce()
        expect(deps.poiManager.readAllFromDB).toHaveBeenCalledWith({ensureLocations: false})
        expect(deps.journeyGroupManager.initialize).toHaveBeenCalledOnce()
        expect(deps.poiManager.rebuildJourneyIndex).toHaveBeenCalledOnce()
        expect(deps.poiManager.ensureAllPOILocations).not.toHaveBeenCalled()
        expect(deps.precacheAssets).not.toHaveBeenCalled()

        await waitForBackgroundStartupTask()

        expect(deps.poiManager.ensureAllPOILocations).toHaveBeenCalledOnce()
        expect(deps.precacheAssets).toHaveBeenCalledOnce()

        resolveLocation()
        resolvePrecache()
    })

    it('shows a success toast when additional journeys were loaded', async () => {
        const deps = dependencies({journeys: [{slug: 'journey-a'}]})

        await runDeferredJourneyDataLoad(deps)

        expect(deps.uiToast.success).toHaveBeenCalledWith({
                                                              caption: 'Journeys loaded',
                                                              text:    'All journeys are ready.',
                                                          })
    })

    it('does not show a toast when there are no additional journeys', async () => {
        const deps = dependencies({journeys: []})

        await runDeferredJourneyDataLoad(deps)

        expect(deps.uiToast.success).not.toHaveBeenCalled()
    })

    it('propagates loading errors without running follow-up refreshes', async () => {
        const error = new Error('DB failed')
        const deps = dependencies()
        deps.trackUtils.readRemainingFromDB.mockRejectedValueOnce(error)

        await expect(runDeferredJourneyDataLoad(deps)).rejects.toBe(error)
        expect(deps.poiManager.readAllFromDB).not.toHaveBeenCalled()
        expect(deps.journeyGroupManager.initialize).not.toHaveBeenCalled()
        expect(deps.poiManager.rebuildJourneyIndex).not.toHaveBeenCalled()
        expect(deps.poiManager.ensureAllPOILocations).not.toHaveBeenCalled()
        expect(deps.precacheAssets).not.toHaveBeenCalled()
        expect(deps.uiToast.success).not.toHaveBeenCalled()
    })
})
