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
})
