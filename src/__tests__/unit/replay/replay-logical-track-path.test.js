import {describe, expect, it} from 'vitest'
import {
    logicalCoordinateSegmentsFromTrack, logicalTrackPathFromJourney,
} from '@Core/ui/replay/JourneyReplayLogicalTrackPath'

describe('Journey replay logical track path', () => {
    it('resolves the replay path from GeoJSON coordinates without a Cesium render content', () => {
        const track = {
            content: {
                geometry: {
                    type: 'LineString',
                    coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                },
            },
        }

        expect(logicalCoordinateSegmentsFromTrack(track)).toEqual([
            [[2, 48, 120], [2.001, 48.001, 130]],
        ])
    })

    it('keeps logical smoothing deterministic and renderer-independent', () => {
        const track = {
            content: {
                geometry: {
                    type: 'LineString',
                    coordinates: [[0, 0, 0], [1, 1, 10], [2, 0, 20]],
                },
            },
        }

        const first = logicalCoordinateSegmentsFromTrack(track, {
            renderSmoothing: {enabled: true, step: 1},
        })
        const second = logicalCoordinateSegmentsFromTrack(track, {
            renderSmoothing: {enabled: true, step: 1},
        })

        expect(first).toBe(second)
        expect(first[0]).toHaveLength(6)
        expect(first[0][0]).toEqual([0, 0, 0])
        expect(first[0][first[0].length - 1]).toEqual([2, 0, 20])
    })

    it('builds the shared path contract for selected journey tracks', () => {
        const journey = {
            tracks: new Map([
                ['track-a', {
                    slug: 'track-a',
                    content: {
                        geometry: {
                            type: 'LineString',
                            coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                        },
                    },
                }],
            ]),
        }

        expect(logicalTrackPathFromJourney(journey)).toEqual([{
            trackSlug: 'track-a',
            trackIndex: 0,
            segments: [[[2, 48, 120], [2.001, 48.001, 130]]],
        }])
    })
})
