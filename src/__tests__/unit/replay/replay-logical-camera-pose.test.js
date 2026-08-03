import {describe, expect, it} from 'vitest'
import {
    resolveJourneyReplayLogicalCameraPose,
    resolveJourneyReplayLogicalCameraRoll,
} from '@Core/ui/replay/JourneyReplayLogicalCameraPose'
import {normalizeJourneyReplayCamera} from '@Core/ui/replay/JourneyReplayProgressionStyle'

describe('Journey replay logical camera pose', () => {
    it('resolves heading, pitch, and altitude from logical replay data only', () => {
        const pose = resolveJourneyReplayLogicalCameraPose({
            sample: {
                progress: 0.5,
                longitude: 2,
                latitude:  48,
                altitude:  120,
                source: {
                    endPoint: {
                        longitude: 2.001,
                        latitude:  48.001,
                    },
                },
            },
            cameraSettings: {
                positionMode: 'ahead',
                altitudeMode: 'ground-offset',
                altitude:     300,
                pitch:        -45,
            },
            markerSettings: {},
        })

        expect(pose.progress).toBe(0.5)
        expect(pose.heading).toBeGreaterThan(Math.PI / 2)
        expect(pose.pitch).toBeCloseTo(-Math.PI / 4)
        expect(pose.cameraHeight).toBe(420)
        expect(pose.logical).toBe(true)
    })

    it('uses the predicted path heading for HQ Navigation system mode', () => {
        const pose = resolveJourneyReplayLogicalCameraPose({
            sample: {
                progress: 0.5,
                longitude: 2,
                latitude:  48,
                altitude: 120,
            },
            cameraSettings: {
                positionMode: 'system',
                heading:      0,
                altitudeMode: 'constant',
                altitude:     1000,
                pitch:        -60,
            },
            markerSettings: {mode: 'navigation'},
            axisHeading: 0.8,
            useAxisHeadingForSystem: true,
        })

        expect(pose.heading).toBeCloseTo(0.8, 6)
    })

    it('banks in the direction of a turn and eases back to zero on a straight path', () => {
        const leftTurn = {
            progress: 0.5,
            distanceFromStart: 150,
            remainingDistance: 150,
            journeyDurationMillis: 3000,
            longitude: 2.001,
            latitude:  48,
            source: {
                startPoint: {longitude: 2, latitude: 48, journeyElapsedMillis: 0},
                endPoint:   {longitude: 2.001, latitude: 48.001, journeyElapsedMillis: 1000},
            },
        }
        const rightTurn = {
            ...leftTurn,
            longitude: 2,
            latitude: 48.001,
            source: {
                startPoint: {longitude: 2, latitude: 48, journeyElapsedMillis: 0},
                endPoint:   {longitude: 2.001, latitude: 48.001, journeyElapsedMillis: 1000},
            },
        }

        expect(resolveJourneyReplayLogicalCameraRoll({sample: leftTurn})).toBeLessThan(0)
        expect(resolveJourneyReplayLogicalCameraRoll({sample: rightTurn})).toBeGreaterThan(0)
        expect(resolveJourneyReplayLogicalCameraRoll({
            sample: {
                ...leftTurn,
                source: {
                    startPoint: {longitude: 2, latitude: 48, journeyElapsedMillis: 0},
                    endPoint:   {longitude: 2.002, latitude: 48, journeyElapsedMillis: 1000},
                },
                longitude: 2.001,
            },
        })).toBe(0)
    })

    it('increases banking with speed and never exceeds 45 degrees', () => {
        const makeSample = endTime => ({
            progress: 0.5,
            distanceFromStart: 150,
            remainingDistance: 150,
            journeyDurationMillis: 3000,
            longitude: 2.001,
            latitude:  48,
            source: {
                startPoint: {longitude: 2, latitude: 48, journeyElapsedMillis: 0},
                endPoint:   {longitude: 2.001, latitude: 48.001, journeyElapsedMillis: endTime},
            },
        })

        const slowRoll = resolveJourneyReplayLogicalCameraRoll({sample: makeSample(2000)})
        const fastRoll = resolveJourneyReplayLogicalCameraRoll({sample: makeSample(500)})
        const clampedRoll = resolveJourneyReplayLogicalCameraRoll({sample: makeSample(100)})

        expect(Math.abs(fastRoll)).toBeGreaterThan(Math.abs(slowRoll))
        expect(Math.abs(clampedRoll)).toBeLessThanOrEqual(Math.PI / 4)
    })

    it('does not retain roll for a stationary sample', () => {
        const roll = resolveJourneyReplayLogicalCameraRoll({
            sample: {
                progress: 0.5,
                distanceFromStart: 150,
                remainingDistance: 150,
                journeyDurationMillis: 3000,
                longitude: 2.001,
                latitude:  48,
                source: {
                    startPoint: {longitude: 2, latitude: 48, journeyElapsedMillis: 1000},
                    endPoint:   {longitude: 2.001, latitude: 48.001, journeyElapsedMillis: 1000},
                },
            },
        })

        expect(roll).toBe(0)
    })

    it('defaults the camera capabilities on and lets canRoll disable banking', () => {
        const defaults = normalizeJourneyReplayCamera({})
        expect(defaults.canDrift).toBe(true)
        expect(defaults.canFixHiddenMarker).toBe(true)
        expect(defaults.canRoll).toBe(true)

        const sample = {
            progress: 0.5,
            distanceFromStart: 150,
            remainingDistance: 150,
            journeyDurationMillis: 3000,
            longitude: 2.001,
            latitude:  48,
            source: {
                startPoint: {longitude: 2, latitude: 48, journeyElapsedMillis: 0},
                endPoint:   {longitude: 2.001, latitude: 48.001, journeyElapsedMillis: 1000},
            },
        }
        const settings = {
            ...defaults,
            positionMode: 'ahead',
            altitudeMode: 'constant',
            altitude: 1000,
            pitch: -45,
            canRoll: false,
        }
        const pose = resolveJourneyReplayLogicalCameraPose({sample, cameraSettings: settings})
        expect(pose.roll).toBe(0)
    })
})
