import {describe, expect, it} from 'vitest'
import {resolveJourneyReplayLogicalCameraPose} from '@Core/ui/replay/JourneyReplayLogicalCameraPose'

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
        expect(pose.roll).toBe(0)
        expect(pose.cameraHeight).toBe(420)
        expect(pose.logical).toBe(true)
    })

    it('defaults the logical timeline to the replay phase when one is not provided explicitly', () => {
        const phase = {
            kind: 'replay',
            slot: 'replay',
            progress: 0.5,
        }
        const pose = resolveJourneyReplayLogicalCameraPose({
            sample: {
                progress: 0.5,
                longitude: 2,
                latitude:  48,
                altitude:  120,
            },
            cameraSettings: {
                positionMode: 'system',
                heading: 0,
                pitch:   -45,
                altitude: 300,
            },
            markerSettings: {},
            phase,
        })

        expect(pose.timeline).toEqual(phase)
    })

    it('banks more on faster turns while staying capped at 45 degrees', () => {
        const baseSample = {
            progress: 0.5,
            distanceFromStart: 5000,
            remainingDistance:  5000,
            journeyDurationMillis: 10000,
            source: {
                startPoint: {
                    longitude: 2,
                    latitude:  48,
                    journeyElapsedMillis: 1000,
                    timeMillis: 1000,
                },
                endPoint: {
                    longitude: 2.01,
                    latitude:  48.01,
                    journeyElapsedMillis: 3000,
                    timeMillis: 3000,
                },
            },
        }

        const slowTurn = resolveJourneyReplayLogicalCameraPose({
            sample: {
                ...baseSample,
                longitude: 2.01,
                latitude:  48,
                altitude:  120,
            },
            cameraSettings: {
                positionMode: 'system',
                heading: 0,
                pitch:   -45,
                altitude: 300,
            },
            markerSettings: {},
        })
        const fastTurn = resolveJourneyReplayLogicalCameraPose({
            sample: {
                ...baseSample,
                longitude: 2.01,
                latitude:  48,
                altitude:  120,
                source: {
                    ...baseSample.source,
                    endPoint: {
                        ...baseSample.source.endPoint,
                        journeyElapsedMillis: 1500,
                        timeMillis:           1500,
                    },
                },
            },
            cameraSettings: {
                positionMode: 'system',
                heading: 0,
                pitch:   -45,
                altitude: 300,
            },
            markerSettings: {},
        })

        expect(Math.abs(fastTurn.roll)).toBeGreaterThan(Math.abs(slowTurn.roll))
        expect(Math.abs(slowTurn.roll)).toBeLessThanOrEqual(Math.PI / 4)
        expect(Math.abs(fastTurn.roll)).toBeLessThanOrEqual(Math.PI / 4)
    })
})
