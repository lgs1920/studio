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
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {viewportRectForCesiumSurface} from '@Core/ui/replay/JourneyReplayCameraOverlay'
import {
    trackingWindowPositionForSample,
    windowPositionForSample,
} from '@Core/ui/replay/JourneyReplayCameraState'
import {constrainedReplayProjectionViewport} from '@Core/ui/replay/JourneyReplayCameraConstraintBinding'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {clearReplayRenderTarget, setReplayRenderTarget} from '@Core/ui/replay/ReplayRenderTarget'

let activeOwner = null
let activeTarget = null
afterEach(() => {
    if (activeOwner && activeTarget) {
        clearReplayRenderTarget(activeOwner, activeTarget)
    }
    activeOwner = null
    activeTarget = null
    vi.unstubAllGlobals()
})

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

    it.each([1, 1.5, 2])('uses the logical preview crop viewport at output scale %s', outputScale => {
        const outputWidth = 640 * outputScale
        const outputHeight = 480 * outputScale
        const canvas = {
            width: outputWidth,
            height: outputHeight,
            clientWidth: outputWidth,
            clientHeight: outputHeight,
            getBoundingClientRect: () => ({left: 0, top: 0, width: outputWidth, height: outputHeight}),
        }
        const target = {
            canvas,
            scene: {drawingBufferWidth: outputWidth, drawingBufferHeight: outputHeight},
            cropProjection: {viewport: {width: 1000, height: 800}, crop: {left: 230, top: 130, width: 640, height: 480}},
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                videoCropRect: () => ({left: 230, top: 130, width: 640, height: 480}),
            },
        }
        setReplayRenderTarget(mode, target)
        activeOwner = mode
        activeTarget = target

        const expectedViewport = {
            left: 0,
            top: 0,
            width: 640,
            height: 480,
            canvasWidth: 640,
            canvasHeight: 480,
            canvasLeft: 0,
            canvasTop: 0,
        }
        expect(viewportRectForCesiumSurface(mode)).toEqual(expectedViewport)
        expect(constrainedReplayProjectionViewport(mode)).toEqual(expectedViewport)
    })

    it.each([1, 1.5, 2])('maps native marker coordinates back to preview crop space at output scale %s', outputScale => {
        const outputWidth = 640 * outputScale
        const outputHeight = 480 * outputScale
        const target = {
            canvas: {width: outputWidth, height: outputHeight, clientWidth: outputWidth, clientHeight: outputHeight},
            scene: {drawingBufferWidth: outputWidth, drawingBufferHeight: outputHeight},
            cropProjection: {viewport: {width: 1000, height: 800}, crop: {left: 230, top: 130, width: 640, height: 480}},
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: null,
        }
        mode[JOURNEY_REPLAY_INTERNAL_CALL] = {
            cesiumViewer: () => ({canvas: target.canvas}),
            cesiumScene: () => ({worldToWindowCoordinates: () => ({x: 125 * outputScale, y: 90 * outputScale})}),
            markerRenderCartesianForSample: () => ({x: 0, y: 0, z: 0}),
            windowPositionForSample: sample => windowPositionForSample(mode, sample),
            videoCropRect: () => ({left: 230, top: 130, width: 640, height: 480}),
        }
        setReplayRenderTarget(mode, target)
        activeOwner = mode
        activeTarget = target

        expect(windowPositionForSample(mode, {})).toEqual({x: 125, y: 90})
        expect(trackingWindowPositionForSample(mode, {})).toEqual({
            x: 125,
            y: 90,
        })
    })

    it('keeps subtracting the preview crop origin for the visible renderer', () => {
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                windowPositionForSample: () => ({x: 300, y: 220}),
                videoCropRect: () => ({left: 230, top: 130, width: 640, height: 480}),
            },
        }

        expect(trackingWindowPositionForSample(mode, {})).toEqual({x: 70, y: 90})
    })
})
