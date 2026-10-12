/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-motion-smoothing.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-11
 * Last modified: 2026-10-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    replayCameraCropWidthMeters,
    replayCameraHeadingLookaheadSeconds,
    replayCameraHeadingWindowMeters,
    replayCameraPositionSmoothingWindowMeters,
    REPLAY_SIMPLE_CAMERA_MIN_EASING,
} from '@Core/ui/replay/JourneyReplayCameraMotionSmoothing'
import {describe, expect, it} from 'vitest'

describe('Replay camera motion smoothing', () => {
    it('uses the persisted Ease value to extend route-heading anticipation', () => {
        expect(replayCameraHeadingLookaheadSeconds(null)).toBe(2.5)
        expect(replayCameraHeadingLookaheadSeconds(0.3))
            .toBeGreaterThan(replayCameraHeadingLookaheadSeconds(null))
        expect(replayCameraHeadingLookaheadSeconds(0.5)).toBe(4)
        expect(REPLAY_SIMPLE_CAMERA_MIN_EASING).toBe(0.3)
    })

    it('scales heading distance to Replay duration and caps it for short videos', () => {
        expect(replayCameraHeadingWindowMeters({
            totalDistanceMeters: 178716,
            durationSeconds: 10,
            lookaheadSeconds: 3.4,
        })).toBeCloseTo(178716 * 0.3)
        expect(replayCameraHeadingWindowMeters({
            totalDistanceMeters: 178716,
            durationSeconds: 30,
            lookaheadSeconds: 3.4,
        })).toBeCloseTo((178716 / 30) * 3.4)
        expect(replayCameraHeadingWindowMeters({
            totalDistanceMeters: 1000,
            durationSeconds: 60,
            lookaheadSeconds: 3.4,
        })).toBe(300)
    })

    it('scales the camera-position smoothing window with Replay speed', () => {
        expect(replayCameraPositionSmoothingWindowMeters({
            totalDistanceMeters: 178716,
            durationSeconds: 10,
        })).toBeCloseTo(178716 * 0.05)
        expect(replayCameraPositionSmoothingWindowMeters({
            totalDistanceMeters: 178716,
            durationSeconds: 30,
        })).toBeCloseTo(178716 / 60)
        expect(replayCameraPositionSmoothingWindowMeters({
            totalDistanceMeters: 1000,
            durationSeconds: 1,
            smoothingSeconds: 4,
        })).toBe(300)
        expect(replayCameraPositionSmoothingWindowMeters({
            totalDistanceMeters: 178716,
            durationSeconds: 0,
        })).toBe(0)
    })

    it('estimates crop width at the configured camera pitch and crop fraction', () => {
        expect(replayCameraCropWidthMeters({
            cameraHeight: 1000,
            targetHeight: 0,
            pitchRadians: -Math.PI / 2,
            verticalFovRadians: Math.PI / 3,
            aspectRatio: 1,
            cropWidthRatio: 0.5,
        })).toBeCloseTo(1000 / Math.sqrt(3), 5)
    })

    it('returns no simplification width for invalid or ground-level poses', () => {
        expect(replayCameraCropWidthMeters({
            cameraHeight: 100,
            targetHeight: 100,
            pitchRadians: -Math.PI / 4,
            verticalFovRadians: Math.PI / 3,
            aspectRatio: 1,
        })).toBe(0)
        expect(replayCameraCropWidthMeters({cameraHeight: 1000})).toBe(0)
    })
})
