/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-crop-constraint.test.js
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

import {Cartesian3, Matrix4, Transforms} from 'cesium'
import {describe, expect, it} from 'vitest'
import {constrainReplayCameraFrameToCrop} from '@Core/ui/replay/JourneyReplayCameraCropConstraint'
import {projectReplayTargetInCameraFrame, replayAdaptiveTrackingTiming} from '@Core/ui/replay/JourneyReplayCameraMath'
import {replayCameraCropWidthMeters} from '@Core/ui/replay/JourneyReplayCameraMotionSmoothing'

/** Build a target-locked camera frame above a real ellipsoid position. */
const createFrame = () => {
    const anchor = Cartesian3.fromDegrees(5, 45, 120)
    const transform = Transforms.eastNorthUpToFixedFrame(anchor)
    return {
        destination: Matrix4.multiplyByPoint(transform, new Cartesian3(0, -3000, 1732), new Cartesian3()),
        direction: Matrix4.multiplyByPointAsVector(transform, new Cartesian3(0, Math.sqrt(3) / 2, -0.5), new Cartesian3()),
        up: Matrix4.multiplyByPointAsVector(transform, new Cartesian3(0, 0.5, Math.sqrt(3) / 2), new Cartesian3()),
    }
}

const viewport = {left: 180, top: 100, width: 640, height: 480, canvasWidth: 1000, canvasHeight: 800}

describe('Replay camera crop constraint', () => {
    it.each([[5.1, 45.07], [4.9, 44.93], [5, 45.18]])('keeps an offscreen marker at %s/%s framed without changing rotation or zoom', (longitude, latitude) => {
        const frame = createFrame()
        const initialPosition = Cartesian3.clone(frame.destination)
        const target = Cartesian3.fromDegrees(longitude, latitude, 120)
        const options = {frame, target, viewport, verticalFovRadians: Math.PI / 3, aspectRatio: 1.25}

        const corrected = constrainReplayCameraFrameToCrop(options)
        const point = projectReplayTargetInCameraFrame({...options, frame: corrected})

        expect(point.x).toBeGreaterThanOrEqual(0)
        expect(point.x).toBeLessThanOrEqual(viewport.width)
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeLessThanOrEqual(viewport.height)
        expect(corrected.direction).toBe(frame.direction)
        expect(corrected.up).toBe(frame.up)
        expect(Cartesian3.distance(corrected.destination, target))
            .toBeCloseTo(Cartesian3.distance(initialPosition, target), 6)
        expect(Cartesian3.equals(frame.destination, initialPosition)).toBe(true)
    })

    it('preserves the configured range when preparation keeps the marker at its saved crop position', () => {
        const frame = createFrame()
        const target = Cartesian3.fromDegrees(5, 45, 120)
        const options = {
            frame,
            target,
            viewport,
            verticalFovRadians: Math.PI / 3,
            aspectRatio: 1.25,
            desiredPoint: {x: 500, y: 240},
        }

        const corrected = constrainReplayCameraFrameToCrop(options)
        const point = projectReplayTargetInCameraFrame({...options, frame: corrected})

        expect(point.x).toBeCloseTo(options.desiredPoint.x, 6)
        expect(point.y).toBeCloseTo(options.desiredPoint.y, 6)
        expect(Cartesian3.distance(corrected.destination, target))
            .toBeCloseTo(Cartesian3.distance(frame.destination, target), 6)
    })

    it('leaves a safely framed marker and the selected zoom unchanged', () => {
        const frame = createFrame()

        expect(constrainReplayCameraFrameToCrop({frame, target: Cartesian3.fromDegrees(5, 45, 120), viewport})).toBe(frame)
    })

    it('projects against the full canvas with crop and canvas offsets in CSS pixels', () => {
        const frame = createFrame()
        const target = Cartesian3.fromDegrees(5, 45, 120)
        const shiftedViewport = {...viewport, left: 230, top: 130, canvasLeft: 50, canvasTop: 30}

        expect(projectReplayTargetInCameraFrame({frame, target, viewport: shiftedViewport}))
            .toEqual(projectReplayTargetInCameraFrame({frame, target, viewport}))
    })

    it('anticipates more strongly at a low selected height for the same ten-second Replay', () => {
        /** Resolve the actual projected ground span for one prepared camera height. */
        const timingAtHeight = cameraHeight => replayAdaptiveTrackingTiming({
            durationSeconds: 10,
            transitionSeconds: 3,
            distanceMeters: 10000,
            cropWidthMeters: replayCameraCropWidthMeters({
                cameraHeight, targetHeight: 120, pitchRadians: -Math.PI / 6,
                verticalFovRadians: Math.PI / 3, aspectRatio: 1.25, cropWidthRatio: 0.64,
            }),
        })
        const zoomed = timingAtHeight(539)
        const distant = timingAtHeight(7000)

        expect(zoomed.adaptationRatio).toBeGreaterThan(distant.adaptationRatio)
        expect(zoomed.cropCrossingSeconds).toBeLessThan(distant.cropCrossingSeconds)
        expect(zoomed.minimumTransitionSeconds).toBe(3)
        expect(distant.minimumTransitionSeconds).toBe(3)
    })
})
