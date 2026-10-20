/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-corrections.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it } from 'vitest'
import {
    applyFixPathCorrections,
    getCorrectedTrackContent,
    getFixPathSegmentDistanceMeters,
    getFixPathSourceFingerprint,
    mergeAdjacentFixPathCorrections,
    normalizeFixPathCorrectionData,
} from '@Utils/cesium/fixPathCorrections'

const makeFeature = (coordinates = [
    [0, 0, 10],
    [0.001, 0, 20],
    [0.002, 0, 30],
    [0.003, 0, 40],
    [0.004, 0, 50],
]) => ({
    type: 'Feature',
    properties: {name: 'source track'},
    geometry: {type: 'LineString', coordinates},
})

const makeCorrection = (content, {segmentIndex = 0, startIndex = 0, endIndex = 4, controlPoints} = {}) => ({
    id: 'correction-1',
    segmentIndex,
    startIndex,
    endIndex,
    sourceFingerprint: getFixPathSourceFingerprint(content, segmentIndex, startIndex, endIndex),
    controlPoints: controlPoints ?? [{id: 'control-1', progress: 0.5, coordinate: [0.002, 0.001]}],
})

describe('Fix Path correction data', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        globalThis.lgs = previousLgs
    })

    it('measures the source route length across every point in a section', () => {
        const content = makeFeature()
        const length = getFixPathSegmentDistanceMeters(content, 0, 0, 4)

        expect(length).toBeGreaterThan(440)
        expect(length).toBeLessThan(450)
        expect(getFixPathSegmentDistanceMeters(content, 0, 0, 1)).toBeLessThan(length)
    })

    it('applies a smooth local correction without mutating source geometry or vertical values', () => {
        const content = makeFeature()
        const correction = makeCorrection(content)

        const result = applyFixPathCorrections(content, [correction])

        expect(result.changed).toBe(true)
        expect(result.skippedCorrectionIds).toEqual([])
        expect(result.content).not.toBe(content)
        expect(result.content.geometry.coordinates).toHaveLength(5)
        expect(result.content.geometry.coordinates[0]).toEqual(content.geometry.coordinates[0])
        expect(result.content.geometry.coordinates[2]).toEqual([0.002, 0.001, 30])
        expect(result.content.geometry.coordinates[4]).toEqual(content.geometry.coordinates[4])
        expect(result.content.properties).toBe(content.properties)
        expect(content.geometry.coordinates[2]).toEqual([0.002, 0, 30])
    })

    it('interpolates corrected elevations between control points for the Journey profile', () => {
        const content = makeFeature()
        const correction = makeCorrection(content, {
            controlPoints: [{id: 'control-high', progress: 0.5, coordinate: [0.002, 0.001, 210]}],
        })

        const result = applyFixPathCorrections(content, [correction])

        expect(result.content.geometry.coordinates[0][2]).toBe(10)
        expect(result.content.geometry.coordinates[2][2]).toBe(210)
        expect(result.content.geometry.coordinates[4][2]).toBe(50)
        expect(result.content.geometry.coordinates[1][2]).toBeGreaterThan(20)
        expect(result.content.geometry.coordinates[3][2]).toBeGreaterThan(20)
    })

    it('uses the source elevation when a saved correction has no sampled height', () => {
        const content = makeFeature()
        const correction = makeCorrection(content, {
            controlPoints: [{id: 'control-without-height', progress: 0.5, coordinate: [0.002, 0.001, null]}],
        })

        const result = applyFixPathCorrections(content, [correction])

        expect(result.changed).toBe(true)
        expect(result.content.geometry.coordinates[2][2]).toBe(30)
        expect(normalizeFixPathCorrectionData({
            revision: 1,
            tracks: {'track-a': [correction]},
        }).tracks['track-a'][0].controlPoints[0].coordinate).toEqual([0.002, 0.001])
    })

    it('applies a saved section longer than the previous limit and still skips stale sections', () => {
        const content = makeFeature([
            [0, 0, 0],
            [0.0015, 0, 1],
            [0.003, 0, 2],
            [0.0045, 0, 3],
            [0.006, 0, 4],
        ])
        const correction = makeCorrection(content)
        globalThis.lgs = {settings: {journey: {fixPathMaxSegmentMeters: 50}}}
        expect(getFixPathSegmentDistanceMeters(content, 0, 0, 4)).toBeGreaterThan(500)
        const accepted = applyFixPathCorrections(content, [correction])
        expect(accepted.changed).toBe(true)
        expect(accepted.skippedCorrectionIds).toEqual([])

        const stale = applyFixPathCorrections(makeFeature(), [correction])
        expect(stale.changed).toBe(false)
        expect(stale.skippedCorrectionIds).toEqual(['correction-1'])
    })

    it('rejects overlapping or malformed saved sections during normalization', () => {
        const content = makeFeature()
        const first = makeCorrection(content, {startIndex: 0, endIndex: 2})
        const second = makeCorrection(content, {startIndex: 2, endIndex: 4})
        const valid = normalizeFixPathCorrectionData({
            revision: 4,
            tracks: {'track-a': [first]},
            currentSection: {trackSlug: 'track-a', correctionId: first.id},
        })

        expect(valid).toMatchObject({
            revision: 4,
            tracks: {'track-a': [first]},
            currentSection: {trackSlug: 'track-a', correctionId: first.id},
        })
        expect(normalizeFixPathCorrectionData({
            revision: 4,
            tracks: {'track-a': [first]},
            currentSection: {trackSlug: 'track-a', correctionId: 'missing-section'},
        })).not.toHaveProperty('currentSection')
        expect(normalizeFixPathCorrectionData({revision: 1, tracks: {'track-a': [first, second]}})).toBeNull()
        expect(normalizeFixPathCorrectionData({revision: 1, tracks: {'track-a': [{...first, controlPoints: []}]}})).toBeNull()
    })

    it('merges saved sections that directly follow each other on the source route', () => {
        const content = makeFeature()
        const first = makeCorrection(content, {
            startIndex: 0,
            endIndex: 1,
            controlPoints: [{
                id: 'fix-point-0-1',
                sourceIndex: 1,
                progress: 1,
                coordinate: [0.001, 0.001, 20],
                fixed: true,
                removed: false,
            }],
        })
        const second = {
            ...makeCorrection(content, {
                startIndex: 2,
                endIndex: 4,
                controlPoints: [{
                    id: 'fix-point-0-3',
                    sourceIndex: 3,
                    progress: 0.5,
                    coordinate: [0.003, 0.001, 40],
                    fixed: true,
                    removed: false,
                }],
            }),
            id: 'correction-2',
        }

        const merged = mergeAdjacentFixPathCorrections(content, [first, second])

        expect(merged).toHaveLength(1)
        expect(merged[0]).toMatchObject({id: 'correction-1', startIndex: 0, endIndex: 4})
        expect(merged[0].controlPoints.filter(point => Number.isInteger(point.sourceIndex)))
            .toHaveLength(5)
        expect(merged[0].controlPoints.find(point => point.sourceIndex === 2))
            .toMatchObject({fixed: false, removed: false})
        const applied = applyFixPathCorrections(content, [first, second])
        expect(applied.changed).toBe(true)
        expect(applied.skippedCorrectionIds).toEqual([])
    })

    it('persists fixed and removed flags for every section point, including endpoints', () => {
        const content = makeFeature()
        const correction = makeCorrection(content, {
            controlPoints: [
                {id: 'fix-point-0-0', sourceIndex: 0, progress: 0, coordinate: [0, 0, 10], fixed: false},
                {id: 'control-1', progress: 0.5, coordinate: [0.002, 0.001, 30], fixed: true, removed: true},
                {id: 'fix-point-0-4', sourceIndex: 4, progress: 1, coordinate: [0.004, 0, 50], fixed: false},
            ],
        })

        const normalized = normalizeFixPathCorrectionData({revision: 1, tracks: {'track-a': [correction]}})

        expect(normalized.tracks['track-a'][0].controlPoints).toEqual([
            expect.objectContaining({id: 'fix-point-0-0', fixed: false, removed: false}),
            expect.objectContaining({id: 'control-1', fixed: true, removed: true}),
            expect.objectContaining({id: 'fix-point-0-4', fixed: false, removed: false}),
        ])
    })

    it('keeps a section when all its points are marked removed so they can be restored', () => {
        const content = makeFeature()
        const correction = makeCorrection(content, {
            controlPoints: [{
                id: 'removed-control',
                progress: 0.5,
                coordinate: [0.002, 0.001],
                fixed: true,
                removed: true,
            }],
        })

        const normalized = normalizeFixPathCorrectionData({revision: 1, tracks: {'track-a': [correction]}})

        expect(normalized.tracks['track-a']).toHaveLength(1)
        expect(normalized.tracks['track-a'][0].controlPoints[0]).toMatchObject({
            id: 'removed-control',
            removed: true,
        })
    })

    it('does not use removed points as curve anchors and supports a one-point section', () => {
        const content = makeFeature()
        const removedAnchor = makeCorrection(content, {
            controlPoints: [{id: 'removed-anchor', progress: 0.5, coordinate: [0.002, 0.01, 300], fixed: true, removed: true}],
        })

        const unchanged = applyFixPathCorrections(content, [removedAnchor])
        expect(unchanged.changed).toBe(false)
        expect(unchanged.skippedCorrectionIds).toEqual([])
        expect(unchanged.content).toBe(content)

        const singlePoint = {
            id: 'single-point-section',
            segmentIndex: 0,
            startIndex: 2,
            endIndex: 2,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 2, 2),
            controlPoints: [{
                id: 'fix-point-0-2',
                sourceIndex: 2,
                progress: 0,
                coordinate: [0.002, 0.001, 80],
                fixed: true,
                removed: false,
            }],
        }
        const corrected = applyFixPathCorrections(content, [singlePoint])
        expect(corrected.changed).toBe(true)
        expect(corrected.content.geometry.coordinates[2]).toEqual([0.002, 0.001, 80])
    })

    it('uses saved Journey corrections only while Fix Path is enabled', () => {
        const content = makeFeature()
        const correction = makeCorrection(content)
        const journey = {
            fixPathEnabled: false,
            fixPathCorrectionData: {revision: 1, tracks: {'track-a': [correction]}},
        }
        const track = {content, parent: journey, slug: 'track-a'}

        expect(getCorrectedTrackContent(track)).toBe(content)
        journey.fixPathEnabled = true
        expect(getCorrectedTrackContent(track).geometry.coordinates[2]).toEqual([0.002, 0.001, 30])
    })
})
