/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-command.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3, Cartographic, Matrix4} from 'cesium'
import {describe, expect, it, vi} from 'vitest'

import {
    createReplayCameraCommand,
    replayCameraCommandFromIntent,
} from '@Core/ui/replay/ReplayCameraCommand'
import {
    applyReplayCesiumCameraCommand,
    constrainReplayCesiumCameraAboveTerrain,
    replayCesiumCameraDestinationAboveTerrain,
    replayCameraCommandForCesiumFrame,
    replayCesiumCameraFrameForCommand,
} from '@Core/ui/replay/ReplayCesiumCameraAdapter'

/**
 * Build one deterministic target-relative camera command.
 *
 * @param {Object} overrides - Optional pose overrides.
 * @returns {Object} Replay camera command.
 */
const createCommandFixture = (overrides = {}) => createReplayCameraCommand({
    pose: Object.assign({
        definitionId: 'camera-a',
        target: {longitude: 0, latitude: 0, altitude: 100},
        heading: 0,
        pitch: -Math.PI / 4,
        roll: 0,
        rangeMeters: 1000,
    }, overrides),
})

describe('replay camera command', () => {
    it('rejects incomplete poses before they reach Cesium', () => {
        expect(createReplayCameraCommand({pose: {heading: 0, pitch: -1, rangeMeters: 1000}})).toBeNull()
        expect(createReplayCameraCommand({
            pose: {
                target: {longitude: 0, latitude: 0},
                heading: 0,
                pitch: -1,
                rangeMeters: 0,
            },
        })).toBeNull()
    })

    it('creates a Cesium frame at the requested target range', () => {
        const command = createCommandFixture()
        const frame = replayCesiumCameraFrameForCommand(command)

        expect(Cartesian3.distance(frame.destination, frame.target)).toBeCloseTo(1000, 6)
        expect(Cartesian3.magnitude(frame.direction)).toBeCloseTo(1, 8)
        expect(Cartesian3.magnitude(frame.up)).toBeCloseTo(1, 8)
        expect(Cartesian3.dot(frame.direction, frame.up)).toBeCloseTo(0, 8)
    })

    it('round-trips a qualified Cesium transition frame through the canonical command', () => {
        const originalCommand = createCommandFixture({
            heading: 1.2,
            pitch: -0.65,
            roll: 0.18,
        })
        const originalFrame = replayCesiumCameraFrameForCommand(originalCommand)
        const roundTripCommand = replayCameraCommandForCesiumFrame({
            frame: originalFrame,
            target: originalFrame.target,
            source: 'replay-transition',
        })
        const roundTripFrame = replayCesiumCameraFrameForCommand(roundTripCommand)

        expect(roundTripCommand.orientation.headingRadians).toBeCloseTo(
            originalCommand.orientation.headingRadians,
            8,
        )
        expect(roundTripCommand.orientation.pitchRadians).toBeCloseTo(
            originalCommand.orientation.pitchRadians,
            8,
        )
        expect(roundTripCommand.orientation.rollRadians).toBeCloseTo(
            originalCommand.orientation.rollRadians,
            8,
        )
        expect(Cartesian3.distance(roundTripFrame.destination, originalFrame.destination)).toBeLessThan(0.001)
        expect(Cartesian3.angleBetween(roundTripFrame.up, originalFrame.up)).toBeLessThan(0.000001)
    })

    it('derives a clip command range from camera height when no range is supplied', () => {
        const command = createReplayCameraCommand({
            pose: {
                sample: {longitude: 2, latitude: 48, altitude: 100},
                heading: 0,
                pitch: -Math.PI / 2,
                roll: 0,
                cameraHeight: 1100,
            },
            source: 'clip',
        })

        expect(command.rangeMeters).toBeCloseTo(1000, 6)
        expect(command.source).toBe('clip')
    })

    it('accepts the legacy clip height field and keeps ground poses valid', () => {
        const command = createReplayCameraCommand({
            pose: {
                sample: {longitude: 2, latitude: 48, altitude: 120},
                heading: 0.4,
                pitch: -0.8,
                roll: 0,
                height: 120,
            },
            source: 'replay-clip',
        })

        expect(command).not.toBeNull()
        expect(command.rangeMeters).toBeGreaterThan(0)
    })

    it('releases a previous look-at transform before applying setView', () => {
        const calls = []
        const camera = {
            lookAtTransform: vi.fn(transform => calls.push({type: 'release', transform})),
            setView: vi.fn(view => calls.push({type: 'set-view', view})),
        }
        const command = createCommandFixture({roll: Math.PI / 8})
        const frame = applyReplayCesiumCameraCommand({camera, command})

        expect(frame.commandId).toBe(command.id)
        expect(calls.map(call => call.type)).toEqual(['release', 'set-view'])
        expect(camera.lookAtTransform).toHaveBeenCalledWith(Matrix4.IDENTITY)
        expect(camera.setView).toHaveBeenCalledWith({
            destination: frame.destination,
            orientation: {
                direction: frame.direction,
                up: frame.up,
            },
        })
    })

    it('raises a camera destination above the available terrain with clearance', () => {
        const destination = Cartesian3.fromDegrees(2, 48, 100)
        const scene = {
            globe: {
                getHeight: vi.fn(() => 250),
            },
        }

        const safeDestination = replayCesiumCameraDestinationAboveTerrain({
            destination,
            scene,
            clearanceMeters: 10,
        })

        expect(Cartographic.fromCartesian(safeDestination).height).toBeCloseTo(260, 6)
        expect(scene.globe.getHeight).toHaveBeenCalledOnce()
    })

    it('leaves a destination unchanged when terrain height is unavailable', () => {
        const destination = Cartesian3.fromDegrees(2, 48, 100)
        const scene = {
            globe: {
                getHeight: vi.fn(() => undefined),
            },
        }

        expect(replayCesiumCameraDestinationAboveTerrain({destination, scene})).toBe(destination)
    })

    it('corrects a camera already below the available terrain', () => {
        const camera = {
            heading: 0.2,
            pitch: -0.5,
            positionWC: Cartesian3.fromDegrees(5.7, 45.3, 1000),
            roll: 0.1,
            setView: vi.fn(),
        }
        const scene = {
            globe: {
                getHeight: () => 2000,
            },
        }

        expect(constrainReplayCesiumCameraAboveTerrain({camera, scene})).toBe(true)
        expect(camera.setView).toHaveBeenCalledWith(expect.objectContaining({
            orientation: {
                heading: camera.heading,
                pitch: camera.pitch,
                roll: camera.roll,
            },
        }))
        expect(Cartographic.fromCartesian(camera.setView.mock.calls[0][0].destination).height).toBeCloseTo(2003)
    })

    it('applies terrain clearance before setting a replay camera command', () => {
        const calls = []
        const camera = {
            lookAtTransform: vi.fn(transform => calls.push({type: 'release', transform})),
            setView: vi.fn(view => calls.push({type: 'set-view', view})),
        }
        const scene = {
            globe: {
                getHeight: vi.fn(() => 2000),
            },
        }
        const command = createCommandFixture()
        const frame = applyReplayCesiumCameraCommand({camera, command, scene})

        expect(Cartographic.fromCartesian(frame.destination).height).toBeCloseTo(2003, 6)
        expect(calls[1].view.destination).toBe(frame.destination)
    })

    it('prefers the command already published by a canonical frame intent', () => {
        const command = createCommandFixture()
        const intent = {
            scene: {
                cameraCommand: command,
                cameraPose: {
                    target: {longitude: 10, latitude: 10, altitude: 0},
                    heading: 1,
                    pitch: -1,
                    rangeMeters: 500,
                },
            },
        }

        expect(replayCameraCommandFromIntent(intent)).toBe(command)
    })
})
