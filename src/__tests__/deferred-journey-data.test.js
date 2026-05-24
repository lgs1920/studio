/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: deferred-journey-data.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-24
 * Last modified: 2026-05-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it, vi } from 'vitest'
import { runDeferredJourneyDataLoad } from '@Core/ui/deferredJourneyData'

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
    widgetCache:         {
        init: vi.fn(async () => undefined),
    },
    precacheAssets:      vi.fn(async () => undefined),
    uiToast:             {
        success: vi.fn(),
    },
})

describe('deferred journey data loading', () => {
    it('loads remaining journeys, refreshes groups and POI indexes', async () => {
        const deps = dependencies({journeys: [{slug: 'journey-a'}, {slug: 'journey-b'}]})

        await runDeferredJourneyDataLoad(deps)

        expect(deps.trackUtils.readRemainingFromDB).toHaveBeenCalledOnce()
        expect(deps.poiManager.readAllFromDB).toHaveBeenCalledWith({ensureLocations: false})
        expect(deps.journeyGroupManager.initialize).toHaveBeenCalledOnce()
        expect(deps.poiManager.rebuildJourneyIndex).toHaveBeenCalledOnce()
        expect(deps.poiManager.ensureAllPOILocations).toHaveBeenCalledOnce()
        expect(deps.widgetCache.init).toHaveBeenCalledOnce()
        expect(deps.precacheAssets).toHaveBeenCalledOnce()
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
        expect(deps.widgetCache.init).not.toHaveBeenCalled()
        expect(deps.precacheAssets).not.toHaveBeenCalled()
        expect(deps.uiToast.success).not.toHaveBeenCalled()
    })
})
