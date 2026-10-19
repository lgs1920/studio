/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-correction-editing.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it} from 'vitest'
import {
    applyFixPathCorrections,
    getFixPathSourceFingerprint,
    normalizeFixPathCorrectionData,
} from '@Utils/cesium/fixPathCorrections'
import {
    buildDraggedPointCorrections,
    buildFixPathSection,
    translateFixPathControlPoints,
} from '@Utils/cesium/fixPathCorrectionEditing'

const makeFeature = () => ({
    type: 'Feature',
    properties: {},
    geometry: {
        type: 'LineString',
        coordinates: Array.from({length: 9}, (_, index) => [index * 0.00005, 0, index * 10]),
    },
})

const makeCorrection = (content, id, startIndex, endIndex, controlPointId, coordinate) => ({
    id,
    segmentIndex: 0,
    startIndex,
    endIndex,
    sourceFingerprint: getFixPathSourceFingerprint(content, 0, startIndex, endIndex),
    controlPoints: [{id: controlPointId, progress: 0.5, coordinate}],
})

describe('Fix Path correction editing', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        globalThis.lgs = previousLgs
    })

    it('merges nearby corrections when a moved route point would overlap them', () => {
        const content = makeFeature()
        globalThis.lgs = {settings: {journey: {fixPathMaxSegmentMeters: 500}}}
        const corrections = [
            makeCorrection(content, 'section-a', 0, 3, 'control-a', [0.000075, 0.0002, 20.4]),
            makeCorrection(content, 'section-b', 5, 8, 'control-b', [0.000325, 0.0002, 60.6]),
        ]

        const result = buildDraggedPointCorrections(content, corrections, 0, 4, [0.0002, 0.001, 151.4])

        expect(result.error).toBeUndefined()
        expect(result.corrections).toHaveLength(1)
        expect(result.corrections[0]).toMatchObject({startIndex: 0, endIndex: 8})
        expect(result.corrections[0].controlPoints.map(point => point.id)).toEqual(expect.arrayContaining([
            'control-a',
            'control-b',
            'fix-point-0-4',
            'fix-point-0-3',
            'fix-point-0-5',
        ]))
        expect(result.corrections[0].controlPoints.map(point => point.progress)).toEqual(
            [...result.corrections[0].controlPoints.map(point => point.progress)].sort((first, second) => first - second),
        )
        expect(result.corrections[0].controlPoints.every(point => Number.isInteger(point.coordinate[2]))).toBe(true)
        expect(result.corrections[0].controlPoints.find(point => point.id === 'fix-point-0-0').fixed).toBe(false)
        expect(result.corrections[0].controlPoints.find(point => point.id === 'fix-point-0-4').fixed).toBe(true)
        expect(normalizeFixPathCorrectionData({revision: 1, tracks: {'track-a': result.corrections}})).not.toBeNull()

        const applied = applyFixPathCorrections(content, result.corrections)
        expect(applied.changed).toBe(true)
        expect(applied.skippedCorrectionIds).toEqual([])
    })

    it('retains every source point and merges two sections bridged by the selected points', () => {
        const content = makeFeature()
        globalThis.lgs = {settings: {journey: {fixPathMaxSegmentMeters: 500}}}
        const corrections = [
            makeCorrection(content, 'section-a', 0, 2, 'control-a', [0.00005, 0.0002, 20]),
            makeCorrection(content, 'section-b', 6, 8, 'control-b', [0.00035, 0.0002, 70]),
        ]

        const result = buildFixPathSection(content, corrections, 0, 2, 6)

        expect(result.error).toBeUndefined()
        expect(result.corrections).toHaveLength(1)
        expect(result.correction).toMatchObject({id: 'section-a', startIndex: 0, endIndex: 8})
        expect(result.correction.controlPoints.filter(point => Number.isInteger(point.sourceIndex)))
            .toHaveLength(9)
        expect(result.correction.controlPoints.find(point => point.id === 'fix-point-0-4'))
            .toMatchObject({sourceIndex: 4, fixed: false, removed: false})
        expect(result.correction.controlPoints.find(point => point.id === 'control-a').fixed).toBe(true)
        expect(result.correction.controlPoints.find(point => point.id === 'control-b').fixed).toBe(true)
    })

    it('merges sections whose source vertices are directly adjacent', () => {
        const content = makeFeature()
        globalThis.lgs = {settings: {journey: {fixPathMaxSegmentMeters: 500}}}
        const first = makeCorrection(content, 'section-a', 0, 3, 'control-a', [0.000075, 0.0002, 20])

        const result = buildFixPathSection(content, [first], 0, 4, 8, [{
            id: 'control-b',
            progress: 0.5,
            coordinate: [0.0003, 0.0002, 60],
            fixed: true,
            removed: false,
        }])

        expect(result.error).toBeUndefined()
        expect(result.corrections).toHaveLength(1)
        expect(result.correction).toMatchObject({id: 'section-a', startIndex: 0, endIndex: 8})
        expect(result.correction.controlPoints.filter(point => Number.isInteger(point.sourceIndex)))
            .toHaveLength(9)
        expect(result.correction.controlPoints.find(point => point.id === 'control-a').fixed).toBe(true)
        expect(result.correction.controlPoints.find(point => point.id === 'control-b').fixed).toBe(true)
    })

    it('allows source endpoints to be moved and stores them as fixed points', () => {
        const content = makeFeature()
        globalThis.lgs = {settings: {journey: {fixPathMaxSegmentMeters: 500}}}
        const correction = makeCorrection(content, 'section', 0, 4, 'control', [0.002, 0.001, 30])
        correction.controlPoints.push(...[0, 4].map(index => ({
            id: 'fix-point-0-' + index,
            sourceIndex: index,
            progress: index === 0 ? 0 : 1,
            coordinate: content.geometry.coordinates[index],
            fixed: false,
            removed: false,
        })))

        const moved = buildDraggedPointCorrections(content, [correction], 0, 0, [-0.001, 0.001, 15])

        expect(moved.error).toBeUndefined()
        expect(moved.corrections[0].controlPoints.find(point => point.sourceIndex === 0))
            .toMatchObject({fixed: true, coordinate: [-0.001, 0.001, 15]})
    })

    it('moves selected control points together and keeps their heights as integers', () => {
        const selectedPoints = [
            {trackSlug: 'track-a', controlPointId: 'first', coordinate: [179.9, 10, 10.3]},
            {trackSlug: 'track-b', controlPointId: 'second', coordinate: [-179.9, 11, 20.6]},
        ]

        const moved = translateFixPathControlPoints(
            selectedPoints,
            {trackSlug: 'track-a', controlPointId: 'first'},
            [-179.9, 10.5, 15],
        )

        expect(moved[0].coordinate[0]).toBeCloseTo(-179.9)
        expect(moved[0].coordinate.slice(1)).toEqual([10.5, 15])
        expect(moved[1].coordinate[0]).toBeCloseTo(-179.7)
        expect(moved[1].coordinate.slice(1)).toEqual([11.5, 26])
    })
})
