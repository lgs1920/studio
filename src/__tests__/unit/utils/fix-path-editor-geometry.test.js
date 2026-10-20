/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-geometry.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-20
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it} from 'vitest'
import {cloneCorrectionList, getControlPointCoordinate} from '@Components/MainUI/FixPathEditorGeometry'
import {getFixPathSourceFingerprint} from '@Utils/cesium/fixPathCorrections'

describe('Fix Path editor geometry', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        globalThis.lgs = previousLgs
    })

    it('restores one source-point neighbor around a persisted edit at each section edge', () => {
        globalThis.lgs = {settings: {journey: {fixPathMaxSegmentMeters: 500}}}
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: Array.from({length: 5}, (_, index) => [index * 0.00001, 0, index * 10]),
            },
        }
        const savedCorrection = {
            id: 'sparse-section',
            segmentIndex: 0,
            startIndex: 2,
            endIndex: 2,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 2, 2),
            controlPoints: [{
                id: 'fix-point-0-2',
                sourceIndex: 2,
                progress: 0.5,
                coordinate: [0.00002, 0.00001, 20],
                fixed: true,
            }],
        }

        const [restored] = cloneCorrectionList([savedCorrection], content)

        expect(restored.startIndex).toBe(1)
        expect(restored.endIndex).toBe(3)
        expect(restored.controlPoints.map(point => point.sourceIndex)).toEqual([1, 2, 3])
        expect(restored.controlPoints.map(point => point.fixed)).toEqual([false, true, false])
        expect(restored.sourceFingerprint).toBe(getFixPathSourceFingerprint(content, 0, 1, 3))
    })

    it('retains erased source-point status when a saved correction is reloaded', () => {
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: Array.from({length: 3}, (_, index) => [index * 0.00001, 0, index * 10]),
            },
        }
        const savedCorrection = {
            id: 'section-with-erasure',
            segmentIndex: 0,
            startIndex: 0,
            endIndex: 2,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 0, 2),
            controlPoints: [{
                id: 'fix-point-0-1',
                sourceIndex: 1,
                progress: 0.5,
                coordinate: content.geometry.coordinates[1],
                fixed: false,
                removed: true,
                erased: true,
            }],
        }

        const [restored] = cloneCorrectionList([savedCorrection], content)

        expect(restored.controlPoints.find(point => point.sourceIndex === 1))
            .toMatchObject({removed: true, erased: true})
    })

    it('keeps unmodified source controls on the original GPX geometry', () => {
        const content = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[0, 0, 10], [0.001, 0.002, 20], [0.002, 0, 30]],
            },
        }
        const correctedContent = {
            ...content,
            geometry: {
                ...content.geometry,
                coordinates: [[0, 0, 10], [0.001, 0.0005, 20], [0.002, 0, 30]],
            },
        }
        const correction = {segmentIndex: 0, startIndex: 0, endIndex: 2}
        const point = {
            id: 'fix-point-0-1',
            sourceIndex: 1,
            progress: 0.5,
            coordinate: [0.001, 0.002, 20],
            fixed: false,
        }

        expect(getControlPointCoordinate(content, correction, point, correctedContent)).toEqual([0.001, 0.002, 20])
        expect(getControlPointCoordinate(content, correction, {...point, fixed: true, coordinate: [0.001, 0.003, 24]}, correctedContent))
            .toEqual([0.001, 0.003, 24])
    })
})
