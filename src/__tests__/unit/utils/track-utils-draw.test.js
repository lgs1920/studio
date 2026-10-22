/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-utils-draw.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import {DRAWING_FROM_UI} from '@Core/constants'
import { TrackUtils } from '@Utils/cesium/TrackUtils'
import {getFixPathSourceFingerprint} from '@Utils/cesium/fixPathCorrections'

describe('TrackUtils draw scheduling', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        vi.restoreAllMocks()
        globalThis.lgs = previousLgs
    })

    it('coalesces concurrent requests and renders the latest request after the active one', async () => {
        const source = {name: 'track#1'}
        const calls = []
        let releaseFirstDraw
        const firstDrawGate = new Promise(resolve => {
            releaseFirstDraw = resolve
        })

        globalThis.lgs = {
            viewer: {
                dataSources: {
                    contains:  value => value === source,
                    getByName: slug => slug === source.name ? [source] : [],
                },
            },
        }

        vi.spyOn(TrackUtils, 'drawOnce').mockImplementation(async (track, options) => {
            calls.push({options, track})
            if (calls.length === 1) {
                await firstDrawGate
            }
        })

        const track = {slug: source.name}
        const first = TrackUtils.draw(track, {action: 'first'})
        const second = TrackUtils.draw(track, {action: 'latest'})

        await Promise.resolve()
        expect(calls).toHaveLength(1)

        releaseFirstDraw()
        await Promise.all([first, second])

        expect(calls).toHaveLength(2)
        expect(calls[0].options).toEqual({action: 'first'})
        expect(calls[1].options).toEqual({action: 'latest'})
    })

    it('uses a temporary display override for map geometry without changing Journey content', async () => {
        const source = {
            name: 'track-display-override',
            entities: {
                values: [],
            },
            load: vi.fn(async () => {}),
            show: true,
        }
        const originalContent = {
            type:       'Feature',
            properties: {},
            geometry:   {
                type:        'LineString',
                coordinates: [[0, 0, 10], [0.001, 0, 10]],
            },
        }
        const displayContent = {
            ...originalContent,
            geometry: {
                ...originalContent.geometry,
                coordinates: [[0, 0, 10], [0.001, 0.002, 10]],
            },
        }
        const track = {
            content: originalContent,
            parent:  'journey-display-override',
            slug:    source.name,
            title:   'Temporary display override test',
            visible: true,
        }

        globalThis.lgs = {
            getJourneyBySlug: () => null,
            viewer: {
                dataSources: {
                    contains:  candidate => candidate === source,
                    getByName: name => name === source.name ? [source] : [],
                },
                scene: {
                    requestRender: vi.fn(),
                },
            },
        }
        vi.spyOn(TrackUtils, 'applyTrackRenderStyle').mockImplementation(() => {})

        TrackUtils.setDisplayContentOverride(track, displayContent)
        try {
            await TrackUtils.drawOnce(track, {action: DRAWING_FROM_UI})
        }
        finally {
            TrackUtils.setDisplayContentOverride(track, null)
        }

        expect(source.load).toHaveBeenCalledOnce()
        expect(source.load.mock.calls[0][0].geometry.coordinates).toEqual(displayContent.geometry.coordinates)
        expect(track.content).toEqual(originalContent)
        expect(source.__lgsTrackPathContent.geometry.coordinates).toEqual(displayContent.geometry.coordinates)
    })

    it('redraws the source route after the final correction section is deleted', async () => {
        const source = {
            name: 'track-fix-path-delete-section',
            entities: {values: []},
            load: vi.fn(async () => {}),
            show: true,
        }
        const originalContent = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.002, 0, 0],
                    [0.003, 0, 0],
                ],
            },
        }
        const correction = {
            id: 'section-to-delete',
            segmentIndex: 0,
            startIndex: 1,
            endIndex: 2,
            sourceFingerprint: getFixPathSourceFingerprint(originalContent, 0, 1, 2),
            controlPoints: [{
                id: 'correction-point',
                progress: 0.5,
                coordinate: [0.0015, 0.001, 10],
                fixed: true,
            }],
        }
        const journey = {
            fixPathEnabled: true,
            fixPathCorrectionData: {revision: 1, tracks: {'track-fix-path-delete-section': [correction]}},
        }
        const track = {
            content: originalContent,
            parent: 'journey-fix-path-delete-section',
            slug: source.name,
            title: 'Delete correction section test',
            visible: true,
        }
        globalThis.lgs = {
            getJourneyBySlug: () => journey,
            viewer: {
                dataSources: {
                    contains: candidate => candidate === source,
                    getByName: name => name === source.name ? [source] : [],
                },
                scene: {requestRender: vi.fn()},
            },
        }
        vi.spyOn(TrackUtils, 'applyTrackRenderStyle').mockImplementation(() => {})

        await TrackUtils.drawOnce(track, {action: DRAWING_FROM_UI, renderMode: 'entities'})
        expect(source.load).toHaveBeenCalledOnce()
        expect(source.load.mock.calls[0][0].geometry.coordinates).not.toEqual(originalContent.geometry.coordinates)

        journey.fixPathEnabled = false
        journey.fixPathCorrectionData = {revision: 2, tracks: {}}
        await TrackUtils.drawOnce(track, {action: DRAWING_FROM_UI, renderMode: 'entities'})

        expect(source.load).toHaveBeenCalledTimes(2)
        expect(source.load.mock.calls[1][0].geometry.coordinates).toEqual(originalContent.geometry.coordinates)
        expect(source.__lgsTrackPathContent).toBe(originalContent)
    })
})
