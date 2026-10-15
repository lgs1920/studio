/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-crop-viewport.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-12
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {viewportRectForCesiumSurface} from '@Core/ui/replay/JourneyReplayCameraOverlay'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {setReplayRenderTarget} from '@Core/ui/replay/ReplayRenderTarget'

afterEach(() => vi.unstubAllGlobals())

describe('Replay crop projection viewport', () => {
    it('retains logical canvas size and origin for a smaller offset crop at high DPR', () => {
        const canvas = {
            width: 2000, height: 1600, clientWidth: 1000, clientHeight: 800,
            getBoundingClientRect: () => ({left: 50, top: 30, width: 1000, height: 800}),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cesiumViewer: () => ({canvas}),
                videoCropRect: () => ({left: 230, top: 130, width: 640, height: 480}),
            },
        }

        expect(viewportRectForCesiumSurface(mode)).toEqual({
            left: 230, top: 130, width: 640, height: 480,
            canvasWidth: 1000, canvasHeight: 800, canvasLeft: 50, canvasTop: 30,
        })
    })

    it('uses CSS canvas coordinates and client-size fallback without a crop', () => {
        const canvas = {
            width: 2000, height: 1600, clientWidth: 1000, clientHeight: 800,
            getBoundingClientRect: () => ({left: 50, top: 30, width: 0, height: 0}),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cesiumViewer: () => ({canvas}),
                videoCropRect: () => null,
            },
        }

        expect(viewportRectForCesiumSurface(mode)).toEqual({
            left: 50, top: 30, width: 1000, height: 800,
            canvasWidth: 1000, canvasHeight: 800, canvasLeft: 50, canvasTop: 30,
        })
    })

    it('uses crop-local coordinates for an explicit render target canvas', () => {
        const canvas = {
            width: 2000, height: 1600, clientWidth: 1000, clientHeight: 800,
            getBoundingClientRect: () => ({left: 0, top: 0, width: 1000, height: 800}),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                videoCropRect: () => ({left: 230, top: 130, width: 640, height: 480}),
            },
        }
        setReplayRenderTarget(mode, {canvas})

        expect(viewportRectForCesiumSurface(mode)).toEqual({
            left: 230, top: 130, width: 640, height: 480,
            canvasWidth: 1000, canvasHeight: 800, canvasLeft: 0, canvasTop: 0,
        })
    })
})
