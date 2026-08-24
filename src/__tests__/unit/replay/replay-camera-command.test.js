import {Cartesian3, Matrix4} from 'cesium'
import {describe, expect, it, vi} from 'vitest'

import {
    createReplayCameraCommand,
    replayCameraCommandFromIntent,
} from '@Core/ui/replay/ReplayCameraCommand'
import {
    applyReplayCesiumCameraCommand,
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
