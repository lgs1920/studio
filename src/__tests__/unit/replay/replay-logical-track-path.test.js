/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-logical-track-path.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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

    it('applies the requested smoothing to long Replay tracks within the point budget', () => {
        const coordinates = Array.from({length: 8192}, (_, index) => [
            6 + (index * 0.00001),
            index < 4096 ? 45 : 45 + ((index - 4096) * 0.00001),
            100,
        ])
        const track = {content: {geometry: {type: 'LineString', coordinates}}}

        const onePass = logicalCoordinateSegmentsFromTrack(track, {
            renderSmoothing: {enabled: true, step: 1},
        })[0]
        const sixPasses = logicalCoordinateSegmentsFromTrack(track, {
            renderSmoothing: {enabled: true, step: 6},
        })[0]

        expect(sixPasses).toHaveLength(4096)
        expect(sixPasses[0]).toEqual(coordinates[0])
        expect(sixPasses.at(-1)).toEqual(coordinates.at(-1))
        expect(sixPasses).not.toEqual(onePass)
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
