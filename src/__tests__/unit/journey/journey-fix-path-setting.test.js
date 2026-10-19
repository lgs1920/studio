/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-fix-path-setting.test.js
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
import {Journey} from '@Core/Journey'

describe('Journey Fix Path settings', () => {
    const previousNamespace = globalThis.__

    afterEach(() => {
        globalThis.__ = previousNamespace
    })

    it('defaults to disabled and drops legacy anti-cliff values on load', () => {
        const tracks = [{__type: 'Map'}]
        const legacy = Journey.deserialize({object: {
            antiCliffCorrection: true,
            antiCliffCorrectionData: {terrainId: 'terrain-a', tracks: {}},
            slug: 'journey-legacy',
            tracks,
        }})

        expect(legacy.fixPathEnabled).toBe(false)
        expect(legacy.fixPathCorrectionData).toBeNull()
        expect(legacy).not.toHaveProperty('antiCliffCorrection')
        expect(legacy).not.toHaveProperty('antiCliffCorrectionData')
    })

    it('normalizes the enabled flag and persists manual correction sections', () => {
        globalThis.__ = {app: {deepClone: object => ({...object})}}
        const correctionData = {
            revision: 3,
            tracks: {
                'track-a': [{
                    id: 'correction-a',
                    segmentIndex: 0,
                    startIndex: 10,
                    endIndex: 16,
                    sourceFingerprint: 'source-fingerprint',
                    controlPoints: [
                        {id: 'control-a', progress: 0.5, coordinate: [6.1, 45.2]},
                    ],
                }],
            },
        }
        const journey = new Journey('Journey enabled', 'gpx', {
            allowRename: false,
            fixPathEnabled: true,
            fixPathCorrectionData: correctionData,
            slug: 'journey-enabled',
        })

        const persisted = Journey.unproxify(journey)
        const restored = Journey.deserialize({object: persisted})
        const normalizedCorrectionData = {
            ...correctionData,
            tracks: {
                ...correctionData.tracks,
                'track-a': correctionData.tracks['track-a'].map(correction => ({
                    ...correction,
                    controlPoints: correction.controlPoints.map(point => ({
                        ...point,
                        fixed: true,
                        removed: false,
                    })),
                })),
            },
        }

        expect(persisted.fixPathEnabled).toBe(true)
        expect(persisted.fixPathCorrectionData).toEqual(normalizedCorrectionData)
        expect(restored.fixPathEnabled).toBe(true)
        expect(restored.fixPathCorrectionData).toEqual(normalizedCorrectionData)
        expect(persisted).not.toHaveProperty('antiCliffCorrection')
        expect(persisted).not.toHaveProperty('antiCliffCorrectionData')
    })

    it('drops the legacy runtime-only availability flag during serialization', () => {
        globalThis.__ = {app: {deepClone: object => ({...object})}}
        const journey = new Journey('Journey', 'gpx', {allowRename: false, slug: 'journey-a'})
        journey.antiCliffCorrectionAvailable = true

        const persisted = Journey.unproxify(journey)
        const restored = Journey.deserialize({object: persisted})

        expect(persisted).not.toHaveProperty('antiCliffCorrectionAvailable')
        expect(restored).not.toHaveProperty('antiCliffCorrectionAvailable')
    })
})
