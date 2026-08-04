import {describe, expect, it} from 'vitest'
import {JourneyReplayTurfPath} from '@Core/ui/replay/JourneyReplayTurfPath'

describe('JourneyReplayTurfPath', () => {
    it('follows the route geometry when sampling by distance', () => {
        const path = new JourneyReplayTurfPath([
            [0, 0, 10],
            [0, 1, 20],
            [1, 1, 30],
        ])

        const position = path.positionAtDistance(path.totalDistance / 2)

        expect(position.longitude).toBeCloseTo(0, 2)
        expect(position.latitude).toBeCloseTo(1, 2)
        expect(position.altitude).toBeCloseTo(20, 2)
    })

    it('tracks cumulative distance for each route vertex', () => {
        const path = new JourneyReplayTurfPath([
            [2, 48],
            [2.001, 48.001],
            [2.002, 48.001],
        ])

        expect(path.cumulativeDistances).toHaveLength(3)
        expect(path.cumulativeDistances[0]).toBe(0)
        expect(path.cumulativeDistances[1]).toBeGreaterThan(0)
        expect(path.totalDistance).toBe(path.cumulativeDistances[2])
    })

    it('returns the local tangent and clamps lookahead to the route', () => {
        const path = new JourneyReplayTurfPath([
            [0, 0, 10],
            [0, 1, 20],
            [1, 1, 30],
        ])

        const tangent = path.tangentAtDistance(path.cumulativeDistances[0])
        const lookahead = path.lookaheadAtDistance(path.totalDistance, 1000)

        expect(tangent.bearingDegrees).toBeCloseTo(0, 2)
        expect(lookahead.longitude).toBeCloseTo(1, 5)
        expect(lookahead.latitude).toBeCloseTo(1, 5)
        expect(lookahead.altitude).toBeCloseTo(30, 5)
    })

    it('does not construct a renderer-dependent path for invalid coordinates', () => {
        const path = new JourneyReplayTurfPath([[null as unknown as number, 48]])

        expect(path.isValid).toBe(false)
        expect(path.positionAtDistance(0)).toEqual({longitude: 0, latitude: 0, altitude: 0})
    })
})
