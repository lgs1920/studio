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
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it} from 'vitest'
import {
    applyFixPathCorrections,
    getFixPathSourcePosition,
    getFixPathSegmentDistanceMeters,
    getFixPathSourceFingerprint,
    normalizeFixPathManualControlProgress,
    normalizeFixPathCorrectionData,
} from '@Utils/cesium/fixPathCorrections'
import {
    buildFixPathSectionsFromSourceIndexes,
    buildFixPathControlPointAddition,
    buildDraggedPointCorrections,
    buildFixPathSection,
    removeFixPathControlPointsFromSection,
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

    it('creates and applies a section longer than the previous 500 m limit', () => {
        globalThis.lgs = {settings: {journey: {fixPathMaxSegmentMeters: 50}}}
        const content = makeFeature()
        content.geometry.coordinates = [0, 0.0015, 0.003, 0.0045, 0.006]
            .map((longitude, index) => [longitude, 0, index * 10])
        const addedPoints = [{id: 'manual-long-section', progress: 0.5, coordinate: [0.003, 0.002, 40]}]

        const result = buildFixPathSection(content, [], 0, 0, 4, addedPoints)

        expect(getFixPathSegmentDistanceMeters(content, 0, 0, 4)).toBeGreaterThan(500)
        expect(result.error).toBeUndefined()
        expect(result.correction).toMatchObject({startIndex: 0, endIndex: 4})
        expect(result.correction.controlPoints).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'manual-long-section', fixed: true}),
        ]))
        expect(applyFixPathCorrections(content, result.corrections)).toMatchObject({
            changed: true,
            skippedCorrectionIds: [],
        })
    })

    it('orders added manual points by route position instead of click order', () => {
        const content = makeFeature()
        const result = buildFixPathSection(content, [], 0, 0, 8, [
            {
                id: 'added-later-on-route',
                progress: 0.2,
                sourcePosition: 6,
                coordinate: [0.0003, 0.0002, 60],
            },
            {
                id: 'added-earlier-on-route',
                progress: 0.8,
                coordinate: [0.0001, 0.0002, 20],
            },
        ])
        const manualPoints = result.correction.controlPoints.filter(point => !Number.isInteger(point.sourceIndex))

        expect(manualPoints.map(point => point.id)).toEqual([
            'added-earlier-on-route',
            'added-later-on-route',
        ])
        expect(manualPoints[0].progress).toBeCloseTo(0.25, 2)
        expect(manualPoints[1].progress).toBeCloseTo(0.75, 2)
        expect(manualPoints[0].sourcePosition).toBeCloseTo(2, 2)
        expect(manualPoints[1].sourcePosition).toBeCloseTo(6, 2)
    })

    it('repairs the ordering of saved manual controls that were stored in click order', () => {
        const content = makeFeature()
        const correction = makeCorrection(content, 'saved-section', 0, 8, 'manual-later', [0.0003, 0.0002, 60])
        correction.controlPoints = [
            {id: 'manual-later', progress: 0.2, coordinate: [0.0003, 0.0002, 60], inserted: true},
            {id: 'manual-earlier', progress: 0.8, coordinate: [0.0001, 0.0002, 20], inserted: true},
        ]

        const normalized = normalizeFixPathManualControlProgress(content, correction)
        const applied = applyFixPathCorrections(content, [correction])
        const insertedLongitudes = applied.content.geometry.coordinates
            .filter(coordinate => coordinate[1] === 0.0002
                && (coordinate[0] === 0.0001 || coordinate[0] === 0.0003))
            .map(coordinate => coordinate[0])

        expect(normalized.controlPoints.map(point => point.id)).toEqual([
            'manual-earlier',
            'manual-later',
        ])
        expect(normalized.controlPoints[0].sourcePosition).toBeCloseTo(2, 2)
        expect(normalized.controlPoints[1].sourcePosition).toBeCloseTo(6, 2)
        expect(normalized.controlPoints[0].progress).toBeCloseTo(0.25, 2)
        expect(normalized.controlPoints[1].progress).toBeCloseTo(0.75, 2)
        expect(insertedLongitudes).toEqual([0.0001, 0.0003])
    })

    it('merges nearby corrections when a moved route point would overlap them', () => {
        const content = makeFeature()
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

    it('creates a short section and inserts a control point at the clicked route position', () => {
        const content = makeFeature()
        const coordinate = [0.000125, 0.0001, 25]

        const result = buildFixPathControlPointAddition(content, [], 0, 2, 0.5, coordinate)

        expect(result.error).toBeUndefined()
        expect(result.correction).toMatchObject({segmentIndex: 0, startIndex: 2, endIndex: 3})
        expect(result.correction.controlPoints).toHaveLength(1)
        expect(result.correction.controlPoints.find(point => point.id === result.controlPointId))
            .toMatchObject({progress: 0.5, coordinate, fixed: true, removed: false})
        expect(applyFixPathCorrections(content, result.corrections)).toMatchObject({
            changed: true,
            skippedCorrectionIds: [],
        })
    })

    it('integrates an added point into the trace, keeps it draggable, and maps the display back to source points', () => {
        const content = makeFeature()
        const addedCoordinate = [0.000125, 0.00003, 25]
        const result = buildFixPathControlPointAddition(content, [], 0, 2, 0.5, addedCoordinate)
        const insertedPoint = result.correction.controlPoints[0]
        const displayed = applyFixPathCorrections(content, result.corrections).content

        expect(insertedPoint.inserted).toBe(true)
        expect(normalizeFixPathCorrectionData({revision: 1, tracks: {'track-a': result.corrections}})
            .tracks['track-a'][0].controlPoints[0].inserted).toBe(true)
        expect(displayed.geometry.coordinates).toHaveLength(content.geometry.coordinates.length + 1)
        expect(displayed.geometry.coordinates[3]).toEqual(addedCoordinate)
        expect(getFixPathSourcePosition(displayed, 0, 2, 0.5)).toBeCloseTo(2.25)
        expect(getFixPathSourcePosition(displayed, 0, 3, 0.5)).toBeCloseTo(2.75)

        const movedCoordinate = [0.00014, 0.00008, 30]
        const movedCorrections = result.corrections.map(correction => ({
            ...correction,
            controlPoints: correction.controlPoints.map(point => ({...point, coordinate: movedCoordinate})),
        }))
        const movedDisplay = applyFixPathCorrections(content, movedCorrections).content

        expect(movedDisplay.geometry.coordinates).toHaveLength(content.geometry.coordinates.length + 1)
        expect(movedDisplay.geometry.coordinates[3]).toEqual(movedCoordinate)
        expect(movedDisplay.geometry.coordinates[3]).not.toEqual(displayed.geometry.coordinates[3])
    })

    it.each([
        {firstIndex: 2, nextIndex: 3},
        {firstIndex: 3, nextIndex: 2},
    ])('keeps additions on consecutive intervals in GPX order ($firstIndex then $nextIndex)', ({firstIndex, nextIndex}) => {
        const content = makeFeature()
        const firstCoordinate = [(firstIndex + 0.5) * 0.00005, 0, 25]
        const nextCoordinate = [(nextIndex + 0.5) * 0.00005, 0, 35]
        const first = buildFixPathControlPointAddition(content, [], 0, firstIndex, 0.5, firstCoordinate)

        const next = buildFixPathControlPointAddition(content, first.corrections, 0, nextIndex, 0.5, nextCoordinate)
        const addedPoint = next.correction.controlPoints.find(point => point.id === next.controlPointId)
        const displayed = applyFixPathCorrections(content, next.corrections)
        const expected = content.geometry.coordinates.flatMap((coordinate, index) => {
            const insertion = index === firstIndex ? firstCoordinate : index === nextIndex ? nextCoordinate : null
            return insertion ? [coordinate, insertion] : [coordinate]
        })

        expect(addedPoint.sourcePosition).toBeCloseTo(nextIndex + 0.5)
        expect(normalizeFixPathCorrectionData({revision: 1, tracks: {'track-a': next.corrections}})).not.toBeNull()
        expect(displayed.skippedCorrectionIds).toEqual([])
        expect(displayed.content.geometry.coordinates).toEqual(expected)
    })

    it('inserts a moved point into a large section without resampling untouched GPX vertices', () => {
        const content = makeFeature()
        content.geometry.coordinates = content.geometry.coordinates.map((coordinate, index) => [...coordinate, index * 1000])
        const section = buildFixPathSection(content, [], 0, 0, 8)
        const coordinate = [0.000125, 0.001, 25]
        const added = buildFixPathControlPointAddition(content, section.corrections, 0, 2, 0.5, coordinate)

        const displayed = applyFixPathCorrections(content, added.corrections)

        expect(displayed.content.geometry.coordinates).toEqual([
            ...content.geometry.coordinates.slice(0, 3),
            [...coordinate, 2500],
            ...content.geometry.coordinates.slice(3),
        ])
    })

    it('keeps insertion order after dragging, reloading, adding on the corrected edge, and extending the section', () => {
        const content = makeFeature()
        const originalCoordinates = structuredClone(content.geometry.coordinates)
        const first = buildFixPathControlPointAddition(content, [], 0, 2, 0.5, [0.000125, 0, 25])
        const movedCoordinate = [0.00019, 0.001, 25]
        const moved = first.corrections.map(correction => ({
            ...correction,
            controlPoints: correction.controlPoints.map(point => ({...point, coordinate: movedCoordinate})),
        }))
        const reloaded = normalizeFixPathCorrectionData(JSON.parse(JSON.stringify({revision: 1, tracks: {'track-a': moved}})))
        const displayed = applyFixPathCorrections(content, reloaded.tracks['track-a']).content
        const sourcePosition = getFixPathSourcePosition(displayed, 0, 3, 0.5)
        const middleCoordinate = [0.00017, 0.0005, 28]
        const middle = buildFixPathControlPointAddition(
            content,
            reloaded.tracks['track-a'],
            0,
            Math.floor(sourcePosition),
            sourcePosition % 1,
            middleCoordinate,
        )
        const nextCoordinate = [0.000175, 0, 35]
        const extended = buildFixPathControlPointAddition(content, middle.corrections, 0, 3, 0.5, nextCoordinate)
        const saved = normalizeFixPathCorrectionData(JSON.parse(JSON.stringify({revision: 2, tracks: {'track-a': extended.corrections}})))
        const result = applyFixPathCorrections(content, saved.tracks['track-a'])

        expect(sourcePosition).toBeCloseTo(2.75)
        expect(result.skippedCorrectionIds).toEqual([])
        expect(result.content.geometry.coordinates).toEqual([
            ...originalCoordinates.slice(0, 3),
            movedCoordinate,
            middleCoordinate,
            originalCoordinates[3],
            nextCoordinate,
            ...originalCoordinates.slice(4),
        ])
        expect(getFixPathSourcePosition(result.content, 0, 3, 0.5)).toBeCloseTo(2.625)
        expect(content.geometry.coordinates).toEqual(originalCoordinates)
    })

    it.each(['LineString', 'MultiLineString'])('keeps GPX order when an insertion joins two sections in a %s', type => {
        const content = makeFeature()
        const original = structuredClone(content.geometry.coordinates)
        const segmentIndex = type === 'MultiLineString' ? 1 : 0
        if (segmentIndex === 1) content.geometry = {type, coordinates: [[[1, 1, 0], [1.1, 1.1, 0]], original]}
        const firstCoordinate = [0.000125, 0.001, 25]
        const lastCoordinate = [0.000225, -0.001, 45]
        const middleCoordinate = [0.000175, 0.002, 35]
        const first = buildFixPathControlPointAddition(content, [], segmentIndex, 2, 0.5, firstCoordinate)
        const last = buildFixPathControlPointAddition(content, first.corrections, segmentIndex, 4, 0.5, lastCoordinate)
        expect(last.corrections).toHaveLength(2)

        const joined = buildFixPathControlPointAddition(content, last.corrections, segmentIndex, 3, 0.5, middleCoordinate)
        const applied = applyFixPathCorrections(content, joined.corrections)
        const coordinates = segmentIndex === 1 ? applied.content.geometry.coordinates[1] : applied.content.geometry.coordinates

        expect(joined.corrections).toHaveLength(1)
        expect(joined.correction).toMatchObject({segmentIndex, startIndex: 2, endIndex: 5})
        expect(applied.skippedCorrectionIds).toEqual([])
        expect(coordinates).toEqual([
            ...original.slice(0, 3), firstCoordinate,
            original[3], middleCoordinate,
            original[4], lastCoordinate,
            ...original.slice(5),
        ])
        expect(normalizeFixPathCorrectionData({revision: 1, tracks: {'track-a': joined.corrections}})).not.toBeNull()
        if (segmentIndex === 1) expect(applied.content.geometry.coordinates[0]).toEqual(content.geometry.coordinates[0])
    })

    it.each(['LineString', 'MultiLineString'])('keeps timestamps aligned with inserted vertices in a %s', type => {
        const content = makeFeature()
        const originalTimes = content.geometry.coordinates.map((_, index) => new Date(Date.UTC(2026, 0, 1, 0, 0, index * 10)).toISOString())
        const segmentIndex = type === 'MultiLineString' ? 1 : 0
        const otherTimes = originalTimes.slice(0, 2)
        if (segmentIndex === 1) content.geometry = {type, coordinates: [[[1, 1, 0], [1.1, 1.1, 0]], content.geometry.coordinates]}
        content.properties.coordinateProperties = {times: segmentIndex === 1 ? [otherTimes, originalTimes] : originalTimes}
        const first = buildFixPathControlPointAddition(content, [], segmentIndex, 2, 0.5, [0.000125, 0, 25])
        const next = buildFixPathControlPointAddition(content, first.corrections, segmentIndex, 3, 0.5, [0.000175, 0, 35])

        const result = applyFixPathCorrections(content, next.corrections).content
        const times = segmentIndex === 1 ? result.properties.coordinateProperties.times[1] : result.properties.coordinateProperties.times

        expect(times).toEqual([
            ...originalTimes.slice(0, 3), '2026-01-01T00:00:25.000Z',
            originalTimes[3], '2026-01-01T00:00:35.000Z',
            ...originalTimes.slice(4),
        ])
        expect(originalTimes).toHaveLength(9)
        if (segmentIndex === 1) expect(result.properties.coordinateProperties.times[0]).toEqual(otherTimes)
    })

    it('keeps a single added point independent from an adjacent source section', () => {
        const content = makeFeature()
        const existing = buildFixPathSection(content, [], 0, 0, 1)

        const result = buildFixPathControlPointAddition(
            content,
            existing.corrections,
            0,
            2,
            0.5,
            [0.000125, 0.0001, 25],
        )
        const pointOnlySection = result.corrections.find(correction => correction.id === result.correction.id)

        expect(result.error).toBeUndefined()
        expect(result.corrections).toHaveLength(2)
        expect(pointOnlySection.controlPoints).toHaveLength(1)
        expect(applyFixPathCorrections(content, result.corrections)).toMatchObject({
            changed: true,
            skippedCorrectionIds: [],
        })
    })

    it('adds a clicked route point to the correction section it falls inside', () => {
        const content = makeFeature()
        const existing = makeCorrection(content, 'existing-section', 1, 5, 'existing-control', [0.00015, 0.0002, 30])

        const result = buildFixPathControlPointAddition(
            content,
            [existing],
            0,
            2,
            0.5,
            [0.000125, 0.0001, 25],
        )

        expect(result.error).toBeUndefined()
        expect(result.corrections).toHaveLength(1)
        expect(result.correction).toMatchObject({id: 'existing-section', startIndex: 1, endIndex: 5})
        expect(result.correction.controlPoints.find(point => point.id === result.controlPointId))
            .toMatchObject({coordinate: [0.000125, 0.0001, 25], fixed: true})
    })

    it('creates and applies a dense multi-kilometre section without losing source-point progress', () => {
        const content = makeFeature()
        const coordinates = Array.from({length: 4096}, (_, index) => [
            index * 0.00001,
            Math.sin(index / 200) * 0.0001,
            index,
        ])
        content.geometry.coordinates = coordinates

        const result = buildFixPathSection(content, [], 0, 0, coordinates.length - 1, [{
            id: 'long-section-control',
            progress: 0.5,
            coordinate: [0.02048, 0.001, 2500],
        }])
        const applied = applyFixPathCorrections(content, [result.correction])

        expect(result.error).toBeUndefined()
        expect(result.correction.controlPoints).toHaveLength(coordinates.length + 1)
        expect(result.correction.controlPoints[0].progress).toBe(0)
        expect(result.correction.controlPoints.at(-1).progress).toBe(1)
        expect(applied.changed).toBe(true)
        expect(applied.skippedCorrectionIds).toEqual([])
        expect(applied.content.geometry.coordinates).toHaveLength(coordinates.length)
        expect(applied.content.geometry.coordinates.every(coordinate => (
            Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1])
        ))).toBe(true)
    })

    it('retains every source point and merges two sections bridged by the selected points', () => {
        const content = makeFeature()
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

    it('keeps a disjoint source selection separate from the active section', () => {
        const content = makeFeature()
        const initial = buildFixPathSection(content, [], 0, 0, 2).correction

        const result = buildFixPathSectionsFromSourceIndexes(content, [initial], 0, new Set([6, 7, 8]))

        expect(result.errors).toEqual([])
        expect(result.corrections.map(section => [section.startIndex, section.endIndex])).toEqual([
            [0, 2],
            [6, 8],
        ])
        expect(result.sections).toHaveLength(1)
        expect(result.sections[0]).toMatchObject({startIndex: 6, endIndex: 8})
        expect(result.sections[0].id).not.toBe(initial.id)
        expect(result.corrections.some(section => section.startIndex <= 3 && section.endIndex >= 5)).toBe(false)
    })

    it('creates one continuous section for one lasso intersection', () => {
        const content = makeFeature()

        const result = buildFixPathSectionsFromSourceIndexes(content, [], 0, new Set([1, 7]))

        expect(result.errors).toEqual([])
        expect(result.corrections.map(section => [section.startIndex, section.endIndex])).toEqual([
            [1, 7],
        ])
        expect(result.sections).toHaveLength(1)
        expect(result.sections[0].controlPoints.map(point => point.sourceIndex)).toEqual([1, 2, 3, 4, 5, 6, 7])
        expect(result.sections[0].controlPoints.filter(point => [3, 4, 5].includes(point.sourceIndex))
            .every(point => point.fixed === false)).toBe(true)
    })

    it('keeps two disjoint lasso intersections as two sections', () => {
        const content = makeFeature()
        const first = buildFixPathSectionsFromSourceIndexes(content, [], 0, new Set([1, 2]))
        const second = buildFixPathSectionsFromSourceIndexes(content, first.corrections, 0, new Set([6, 7]))

        expect(second.errors).toEqual([])
        expect(second.corrections.map(section => [section.startIndex, section.endIndex])).toEqual([
            [1, 2],
            [6, 7],
        ])
    })

    it('merges existing sections bridged by one disjoint lasso selection', () => {
        const content = makeFeature()
        const corrections = [
            makeCorrection(content, 'section-a', 0, 1, 'control-a', [0.000025, 0.0002, 10]),
            makeCorrection(content, 'section-b', 6, 8, 'control-b', [0.00035, 0.0002, 70]),
        ]

        const result = buildFixPathSectionsFromSourceIndexes(content, corrections, 0, new Set([2, 5]))

        expect(result.errors).toEqual([])
        expect(result.corrections).toHaveLength(1)
        expect(result.corrections[0]).toMatchObject({startIndex: 0, endIndex: 8})
        expect(result.sections).toHaveLength(1)
        expect(result.sections[0].controlPoints.map(point => point.id)).toEqual(expect.arrayContaining([
            'control-a',
            'control-b',
        ]))
    })

    it('keeps erased source points hidden when the surrounding sections are extended again', () => {
        const content = makeFeature()
        const initial = buildFixPathSection(content, [], 0, 0, 8).correction
        const erased = removeFixPathControlPointsFromSection(
            content,
            initial,
            new Set(['fix-point-0-3', 'fix-point-0-4']),
        )

        expect(erased).toHaveLength(2)
        expect(erased.every(section => section.controlPoints
            .filter(point => point.erased === true)
            .map(point => point.sourceIndex)
            .sort((first, second) => first - second)
            .join(',') === '3,4')).toBe(true)

        const extended = buildFixPathSection(content, erased, 0, 0, 6)
        const erasedPoints = extended.correction.controlPoints.filter(point => point.erased === true)

        expect(extended.error).toBeUndefined()
        expect(erasedPoints.map(point => point.sourceIndex)).toEqual([3, 4])
        expect(erasedPoints.every(point => point.removed === true)).toBe(true)
        expect(extended.correction.controlPoints.filter(point => point.erased !== true)
            .map(point => point.sourceIndex)).not.toContain(3)
        expect(extended.correction.controlPoints.filter(point => point.erased !== true)
            .map(point => point.sourceIndex)).not.toContain(4)

        const persisted = normalizeFixPathCorrectionData({
            revision: 1,
            tracks: {'track-a': extended.corrections},
        })
        expect(persisted.tracks['track-a'][0].controlPoints
            .filter(point => point.erased === true)
            .map(point => point.sourceIndex)).toEqual([3, 4])
    })

    it('removes a section when erasing its last remaining source points', () => {
        const content = makeFeature()
        const initial = buildFixPathSection(content, [], 0, 0, 8).correction
        const removedIds = new Set(initial.controlPoints.map(point => point.id))

        expect(removeFixPathControlPointsFromSection(content, initial, removedIds)).toEqual([])
    })

    it('keeps removed source points excluded from lasso section creation', () => {
        const content = makeFeature()
        const section = buildFixPathSection(content, [], 0, 2, 5).correction
        const removedSection = {
            ...section,
            controlPoints: section.controlPoints.map(point => point.sourceIndex === 3
                ? {...point, removed: true, erased: true}
                : point),
        }
        const corrections = [removedSection]

        const removedOnly = buildFixPathSectionsFromSourceIndexes(content, corrections, 0, new Set([3]))

        expect(removedOnly.sections).toEqual([])
        expect(removedOnly.corrections).toBe(corrections)

        const withNeighbor = buildFixPathSectionsFromSourceIndexes(content, corrections, 0, new Set([3, 4]))
        const updatedSection = withNeighbor.sections[0]

        expect(withNeighbor.sections).toHaveLength(1)
        expect(updatedSection.controlPoints.find(point => point.sourceIndex === 3))
            .toMatchObject({sourceIndex: 3, fixed: false, removed: true, erased: true})
        expect(updatedSection.controlPoints.find(point => point.sourceIndex === 4))
            .toMatchObject({sourceIndex: 4, fixed: false, removed: false})
    })

    it('merges sections whose source vertices are directly adjacent', () => {
        const content = makeFeature()
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

    it('excludes removed control points from a global move', () => {
        const selectedPoints = [
            {trackSlug: 'track-a', controlPointId: 'first', coordinate: [179.9, 10, 10.3]},
            {trackSlug: 'track-a', controlPointId: 'removed', coordinate: [-179.9, 11, 20.6], removed: true},
            {trackSlug: 'track-a', controlPointId: 'third', coordinate: [-179.8, 12, 30.4]},
        ]

        const moved = translateFixPathControlPoints(
            selectedPoints,
            {trackSlug: 'track-a', controlPointId: 'first'},
            [-179.9, 10.5, 15],
        )
        const removedAnchorMove = translateFixPathControlPoints(
            selectedPoints,
            {trackSlug: 'track-a', controlPointId: 'removed'},
            [-179.9, 10.5, 15],
        )

        expect(moved.map(point => point.controlPointId)).toEqual(['first', 'third'])
        expect(moved.every(point => point.removed === false)).toBe(true)
        expect(removedAnchorMove).toEqual([])
    })
})
