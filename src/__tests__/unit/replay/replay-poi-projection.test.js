/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-poi-projection.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {JourneyReplayPathSampler, REPLAY_SCOPE_ALL_TRACKS} from '@Core/ui/replay/JourneyReplayPathSampler'
import {projectReplayPOIsOnSampler} from '@Core/ui/replay/JourneyReplayPOIProjection'
import {point} from '@turf/helpers'
import turfDistance from '@turf/distance'
import {getFixPathSourceFingerprint} from '@Utils/cesium/fixPathCorrections'
import {findNearestJourneyProjection} from '@Core/ui/POIManager'
import {afterEach, describe, expect, it, vi} from 'vitest'

afterEach(() => vi.unstubAllGlobals())

describe('Replay POI trigger projection', () => {
    it('uses corrected Replay distance instead of the raw source distance with all tracks selected', () => {
        const content = {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [
            [0, 0, 0], [0.001, 0, 0], [0.002, 0, 0], [0.003, 0, 0], [0.004, 0, 0], [0.005, 0, 0], [0.006, 0, 0],
        ]}}
        const track = {slug: 'track', parent: 'journey', visible: true, content}
        const correction = {id: 'fix', segmentIndex: 0, startIndex: 0, endIndex: 4,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 0, 4),
            controlPoints: [{id: 'point', progress: 0.5, coordinate: [0.002, 0.004]}]}
        const journey = {slug: 'journey', tracks: new Map([[track.slug, track]]), fixPathEnabled: true,
            fixPathCorrectionData: {revision: 1, tracks: {[track.slug]: [correction]}}}
        vi.stubGlobal('lgs', {getJourneyBySlug: () => journey})
        const sampler = new JourneyReplayPathSampler({journey, scope: REPLAY_SCOPE_ALL_TRACKS})
        const poi = {id: 'after-fix', longitude: 0.005, latitude: 0}
        const rawProjection = findNearestJourneyProjection({poi, journey, maxDistanceMeters: 500})
        const [entry] = projectReplayPOIsOnSampler([{poi, projectedAbscissa: rawProjection.projectedAbscissa}], sampler)
        const passage = sampler.samples.find(sample => sample.longitude === poi.longitude && sample.latitude === poi.latitude)

        expect(entry.projectedAbscissa).toBeCloseTo(passage.distanceFromStart, 6)
        expect(entry.projectedAbscissa / sampler.totalDistance).toBeCloseTo(passage.progress, 8)
        expect(rawProjection.projectedAbscissa / sampler.totalDistance).toBeLessThan(passage.progress - 0.4)
        expect(poi).toEqual({id: 'after-fix', longitude: 0.005, latitude: 0})
    })

    it('does not add gaps between segments or distances from excluded traces', () => {
        /** Build a source track with explicit Replay selection visibility. */
        const track = (slug, visible, coordinates) => ({slug, visible,
            content: {geometry: {type: 'LineString', coordinates}}})
        const hidden = track('hidden', false, [[0, 0], [0.01, 0]])
        const first = track('first', true, [[1, 0], [1.01, 0]])
        const second = track('second', true, [[2, 0], [2.01, 0]])
        const journey = {tracks: new Map([hidden, first, second].map(value => [value.slug, value]))}
        const sampler = new JourneyReplayPathSampler({journey})
        const poi = {longitude: 2.005, latitude: 0}
        const [entry] = projectReplayPOIsOnSampler([{poi}], sampler)

        expect(entry.projectedAbscissa / sampler.totalDistance).toBeCloseTo(0.75, 8)
        expect(projectReplayPOIsOnSampler([], sampler)).toEqual([])
        expect(projectReplayPOIsOnSampler([{poi}], {samples: [], segments: []})).toEqual([])
    })

    it('keeps every separated visit while grouping nearby noisy samples into one passage', () => {
        const coordinates = [
            [0, 0],
            [0.0094, 0],
            [0.00985, 0],
            [0.01005, 0],
            [0.00995, 0],
            [0.01004, 0],
            [0.0105, 0],
            [0.02, 0],
            [0.0105, 0],
            [0.01004, 0],
            [0.00995, 0],
            [0.01005, 0],
            [0.00985, 0],
            [0.0094, 0],
            [0, 0],
        ]
        let distanceFromStart = 0
        const samples = coordinates.map(([longitude, latitude], index) => {
            if (index > 0) {
                distanceFromStart += turfDistance(
                    point(coordinates[index - 1]),
                    point([longitude, latitude]),
                    {units: 'meters'},
                )
            }
            return {longitude, latitude, distanceFromStart}
        })
        const sampler = {
            samples,
            segments: [{startIndex: 0, endIndex: samples.length - 1, startDistance: 0}],
        }
        const [entry] = projectReplayPOIsOnSampler([{
            poi: {id: 'poi-b', longitude: 0.01, latitude: 0},
        }], sampler)

        expect(entry.projectedPassages).toHaveLength(2)
        expect(entry.projectedPassages[0].projectedAbscissa)
            .toBeLessThan(entry.projectedPassages[1].projectedAbscissa)
    })
})
