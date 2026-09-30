/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-preparation-visibility-and-clips.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-30
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {hideJourneyReplayPOIsForPreparation, restoreJourneyReplayPOIVisibility} from '@Core/ui/replay/JourneyReplayVisibilityController'
import {clipListForSlot} from '@Core/ui/replay/JourneyReplayClipController'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP} from '@Core/ui/replay/JourneyReplayClips'
import {REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT} from '@Core/ui/replay/ReplayUserModeConstants'

afterEach(() => vi.unstubAllGlobals())

describe('Replay preparation visibility and clip rules', () => {
    it('hides POIs during preparation and restores their saved visibility', () => {
        const poi = {id: 'poi-a', visible: true, entityVisible: true}
        const state = {replayPOIVisibilityState: new Map()}
        const call = {
            replayPOICandidates: () => [poi],
            isPOIVisibleBeforePlayback: () => poi.entityVisible,
            setPOIEntityVisibility: (item, visible) => {
                item.entityVisible = visible
            },
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            [JOURNEY_REPLAY_INTERNAL_CALL]: call,
        }
        vi.stubGlobal('lgs', {
            stores: {main: {components: {pois: {list: new Map([[poi.id, poi]])}}}},
        })

        hideJourneyReplayPOIsForPreparation(mode)
        expect(poi.entityVisible).toBe(false)
        expect(state.replayPOIVisibilityState.get(poi.id)).toEqual({visible: true})

        restoreJourneyReplayPOIVisibility(mode)
        expect(poi.entityVisible).toBe(true)
        expect(state.replayPOIVisibilityState.size).toBe(0)
    })

    it('ignores start and stop clips in Simple mode while keeping Expert clips', () => {
        const startClips = [{id: 'start'}]
        const stopClips = [{id: 'stop'}]
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                clipSettings: () => ({start: startClips, stop: stopClips}),
            },
        }

        vi.stubGlobal('lgs', {settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC}}}})
        expect(clipListForSlot(mode, REPLAY_CLIP_SLOT_START)).toEqual([])
        expect(clipListForSlot(mode, REPLAY_CLIP_SLOT_STOP)).toEqual([])

        lgs.settings.ui.replay.userMode = REPLAY_USER_MODE_EXPERT
        expect(clipListForSlot(mode, REPLAY_CLIP_SLOT_START)).toBe(startClips)
        expect(clipListForSlot(mode, REPLAY_CLIP_SLOT_STOP)).toBe(stopClips)
    })
})
