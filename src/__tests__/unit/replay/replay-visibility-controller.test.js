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
