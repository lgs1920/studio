/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-anti-cliff-setting.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-18
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it} from 'vitest'
import {Journey} from '@Core/Journey'

describe('Journey anti-cliff setting', () => {
    const previousNamespace = globalThis.__

    afterEach(() => {
        globalThis.__ = previousNamespace
    })

    it('defaults to disabled and normalizes values during deserialization', () => {
        const tracks = [{__type: 'Map'}]
        const legacy = Journey.deserialize({object: {slug: 'journey-legacy', tracks}})
        const enabled = Journey.deserialize({object: {antiCliffCorrection: true, slug: 'journey-enabled', tracks}})
        const invalid = Journey.deserialize({object: {antiCliffCorrection: 'true', slug: 'journey-invalid', tracks}})

        expect(legacy.antiCliffCorrection).toBe(false)
        expect(enabled.antiCliffCorrection).toBe(true)
        expect(invalid.antiCliffCorrection).toBe(false)
    })

    it('preserves the setting through Journey database serialization', () => {
        globalThis.__ = {app: {deepClone: object => ({...object})}}
        const journey = new Journey('Journey enabled', 'gpx', {
            allowRename: false,
            antiCliffCorrection: true,
            slug: 'journey-enabled',
        })

        const persisted = Journey.unproxify(journey)
        const restored = Journey.deserialize({object: persisted})

        expect(persisted.antiCliffCorrection).toBe(true)
        expect(restored.antiCliffCorrection).toBe(true)
    })

    it('persists only sparse corrected points together with their terrain id', () => {
        globalThis.__ = {app: {deepClone: object => ({...object})}}
        const antiCliffCorrectionData = {
            terrainId: 'terrain-a',
            tracks: {
                'track-a': [{
                    segmentIndex: 1,
                    coordinateIndex: 8,
                    sourceCoordinate: [6.1, 45.2, 1430],
                    correctedCoordinate: [6.10001, 45.2, 1430],
                }],
                'track-b': [{
                    segmentIndex: 0,
                    coordinateIndex: 0,
                    sourceCoordinate: [6.2, 45.3, 1200],
                    correctedCoordinate: [6.2, 45.3, 1200],
                }],
            },
        }
        const journey = new Journey('Journey enabled', 'gpx', {
            allowRename: false,
            antiCliffCorrection: true,
            antiCliffCorrectionData,
            slug: 'journey-enabled',
        })

        const persisted = Journey.unproxify(journey)
        const restored = Journey.deserialize({object: persisted})

        const expectedSparseData = {
            ...antiCliffCorrectionData,
            tracks: {...antiCliffCorrectionData.tracks, 'track-b': []},
        }
        expect(persisted.antiCliffCorrectionData).toEqual(expectedSparseData)
        expect(restored.antiCliffCorrectionData).toEqual(expectedSparseData)
    })

    it('drops the legacy availability flag during serialization', () => {
        globalThis.__ = {app: {deepClone: object => ({...object})}}
        const journey = new Journey('Detected journey', 'gpx', {
            allowRename: false,
            slug: 'journey-detected',
        })
        journey.antiCliffCorrectionAvailable = true

        const persisted = Journey.unproxify(journey)
        const restored = Journey.deserialize({object: persisted})

        expect(persisted).not.toHaveProperty('antiCliffCorrectionAvailable')
        expect(restored).not.toHaveProperty('antiCliffCorrectionAvailable')
    })
})
