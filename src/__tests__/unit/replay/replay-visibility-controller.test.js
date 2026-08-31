/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-visibility-controller.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-07-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

const trackUtils = vi.hoisted(() => ({
    getDataSourceNameByEntityId: vi.fn(),
    getDataSourcesByName:       vi.fn(),
    setPolylineVisibility:      vi.fn(),
}))

vi.mock('@Utils/cesium/TrackUtils', () => ({TrackUtils: trackUtils}))

import {JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {restoreCurrentJourneyPolylineVisibility} from '@Core/ui/replay/JourneyReplayVisibilityController'

describe('JourneyReplayVisibilityController', () => {
    afterEach(() => {
        vi.clearAllMocks()
        delete globalThis.lgs
    })

    it('restores a hidden polyline without shadowing the controller state', () => {
        const entity = {id: 'track-polyline'}
        const source = {
            entities: {
                getById: vi.fn(() => entity),
            },
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                hiddenCurrentJourneyPolylines: new Map([
                    ['track-polyline', {sourceName: 'journey-source', visible: true}],
                ]),
            },
        }

        trackUtils.getDataSourcesByName.mockReturnValue([source])
        globalThis.lgs = {viewer: {dataSources: {}}}

        expect(() => restoreCurrentJourneyPolylineVisibility(mode)).not.toThrow()
        expect(trackUtils.setPolylineVisibility).toHaveBeenCalledWith(entity, true)
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].hiddenCurrentJourneyPolylines.size).toBe(0)
    })
})
