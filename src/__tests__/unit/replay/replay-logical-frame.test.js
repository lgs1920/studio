import {describe, expect, it} from 'vitest'
import {createJourneyReplayLogicalFrame} from '@Core/ui/replay/JourneyReplayLogicalFrame'

describe('Journey replay logical frames', () => {
    it('prefers the explicit logical timeline timestamp', () => {
        const frame = createJourneyReplayLogicalFrame({
            sample: {
                progress:             0.4,
                journeyElapsedMillis: 400,
                journeyDurationMillis: 1000,
            },
            progress:        0.4,
            durationMillis:  1000,
            frameTimeMs:     250,
            frameIntervalMs: 33.333,
            cameraPose:      {heading: 1},
        })

        expect(frame).toEqual(expect.objectContaining({
            progress:        0.4,
            elapsedMillis:   250,
            frameTimeMs:     250,
            frameIntervalMs: 33.333,
            cameraPose:      {heading: 1},
        }))
    })

    it('derives logical time from the sample or the replay duration', () => {
        expect(createJourneyReplayLogicalFrame({
            sample: {
                journeyElapsedMillis: 420,
                journeyDurationMillis: 1000,
            },
            progress: 0.2,
        }).frameTimeMs).toBe(420)

        expect(createJourneyReplayLogicalFrame({
            progress:       0.25,
            durationMillis: 2000,
        }).frameTimeMs).toBe(500)
    })
})
