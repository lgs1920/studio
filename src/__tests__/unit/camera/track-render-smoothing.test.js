/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-render-smoothing.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    getTrackRenderContent, MAX_RENDER_POINTS, normalizeTrackRenderSmoothing, resolveTrackRenderSmoothing,
    trackRenderSmoothingKey,
}                                                from '@Utils/cesium/trackRenderSmoothing'
import {getFixPathSourceFingerprint} from '@Utils/cesium/fixPathCorrections'

const makeTrack = renderSmoothing => ({
    parent: 'journey#gpx',
    slug:   'track#journey#gpx#main',
    renderSmoothing,
    content: {
        type:       'Feature',
        properties: {
            name: 'Main track',
        },
        geometry:   {
            type:        'LineString',
            coordinates: [
                [6, 45, 100],
                [6.1, 45.1, 110],
                [6.2, 45, 120],
            ],
        },
    },
})

describe('track render smoothing', () => {
    beforeEach(() => {
        vi.unstubAllGlobals()
    })

    it('normalizes smoothing settings', () => {
        expect(normalizeTrackRenderSmoothing({enabled: 'true', step: '2'})).toEqual({
            enabled: true,
            step:    2,
        })
        expect(normalizeTrackRenderSmoothing({enabled: false, step: 12})).toEqual({
            enabled: false,
            step:    6,
        })
    })

    it('smooths only the render content without mutating the source track', () => {
        const track = makeTrack({enabled: true, step: 1})
        const renderContent = getTrackRenderContent(track)

        expect(renderContent).not.toBe(track.content)
        expect(renderContent.geometry.coordinates).toHaveLength(6)
        expect(renderContent.geometry.coordinates[0]).toEqual([6, 45, 100])
        expect(renderContent.geometry.coordinates.at(-1)).toEqual([6.2, 45, 120])
        expect(track.content.geometry.coordinates).toHaveLength(3)
    })

    it('reuses the rendered content cache for the same smoothing settings', () => {
        const track = makeTrack({enabled: true, step: 6})
        const firstRenderContent = getTrackRenderContent(track)
        const secondRenderContent = getTrackRenderContent(track)

        expect(secondRenderContent).toBe(firstRenderContent)
        expect(secondRenderContent.geometry.coordinates).toHaveLength(firstRenderContent.geometry.coordinates.length)
    })

    it('caps runaway smoothing growth on long segments', () => {
        const track = makeTrack({enabled: true, step: 6})
        track.content.geometry.coordinates = Array.from({length: 200}, (_, index) => [6 + (index * 0.001), 45 + (index * 0.001), 100 + index])

        const renderContent = getTrackRenderContent(track)

        expect(renderContent.geometry.coordinates.length).toBeLessThanOrEqual(4096)
        expect(renderContent.geometry.coordinates[0]).toEqual([6, 45, 100])
        expect(renderContent.geometry.coordinates.at(-1)).toEqual([6.199, 45.199, 299])
    })

    it('caps Cesium render geometry without changing the stored track', () => {
        const track = makeTrack()
        track.content.geometry.coordinates = Array.from({length: MAX_RENDER_POINTS * 4}, (_, index) => [
            6 + (index * 0.0001),
            45 + (index * 0.0001),
            100 + index,
        ])

        const renderContent = getTrackRenderContent(track, {forRender: true})

        expect(renderContent.geometry.coordinates).toHaveLength(MAX_RENDER_POINTS)
        expect(renderContent.geometry.coordinates[0]).toEqual(track.content.geometry.coordinates[0])
        expect(renderContent.geometry.coordinates.at(-1)).toEqual(track.content.geometry.coordinates.at(-1))
        expect(track.content.geometry.coordinates).toHaveLength(MAX_RENDER_POINTS * 4)
    })

    it('can force smoothing for replay without mutating stored track settings', () => {
        const track = makeTrack({enabled: false, step: 2})
        const renderContent = getTrackRenderContent(track, {forceRenderSmoothing: true})

        expect(renderContent).not.toBe(track.content)
        expect(renderContent.geometry.coordinates).toHaveLength(12)
        expect(track.renderSmoothing).toEqual({enabled: false, step: 2})
        expect(trackRenderSmoothingKey(track)).toBe('0:2')
        expect(trackRenderSmoothingKey(track, {forceRenderSmoothing: true})).toBe('1:2')
    })

    it('can use a replay smoothing override with its own step', () => {
        const track = makeTrack({enabled: false, step: 1})
        const renderContent = getTrackRenderContent(track, {
            renderSmoothing: {enabled: true, step: 2},
        })

        expect(renderContent).not.toBe(track.content)
        expect(renderContent.geometry.coordinates).toHaveLength(12)
        expect(trackRenderSmoothingKey(track, {
            renderSmoothing: {enabled: true, step: 2},
        })).toBe('1:2')
    })

    it('keeps a removed source sample out of the Cesium render path', () => {
        const track = makeTrack({enabled: true, step: 1})
        const sourceCoordinates = [
            [6, 45, 100],
            [6.00005, 45.00002, 110],
            [6.0001, 45.0002, 120],
            [6.00015, 45.00002, 130],
            [6.0002, 45, 140],
        ]
        track.content.geometry.coordinates = sourceCoordinates
        const correction = {
            id: 'removed-source-sample',
            segmentIndex: 0,
            startIndex: 1,
            endIndex: 3,
            sourceFingerprint: getFixPathSourceFingerprint(track.content, 0, 1, 3),
            controlPoints: [1, 2, 3].map(index => ({
                id: 'fix-point-0-' + index,
                sourceIndex: index,
                progress: (index - 1) / 2,
                coordinate: sourceCoordinates[index],
                fixed: index !== 2,
                removed: index === 2,
            })),
        }
        const journey = {
            slug: track.parent,
            fixPathEnabled: true,
            fixPathCorrectionData: {tracks: {[track.slug]: [correction]}},
            renderSmoothing: {enabled: true, step: 1},
            tracks: new Map([[track.slug, track]]),
        }
        vi.stubGlobal('lgs', {
            getJourneyBySlug: vi.fn(() => journey),
            theJourneyEditorProxy: {journey},
            settings: {journey: {}},
        })

        const renderContent = getTrackRenderContent(track)

        expect(renderContent.geometry.coordinates).not.toContainEqual(sourceCoordinates[2])
    })

    it('keeps moved Fix Path source vertices exact through render smoothing', () => {
        const track = makeTrack({enabled: true, step: 1})
        const sourceCoordinates = [
            [6, 45, 100],
            [6.00005, 45.00002, 110],
            [6.0001, 45, 120],
            [6.00015, 45.00002, 130],
            [6.0002, 45, 140],
        ]
        track.content.geometry.coordinates = sourceCoordinates
        const movedCoordinate = [6.0001, 45.00001, 125]
        const correction = {
            id: 'section-a',
            segmentIndex: 0,
            startIndex: 2,
            endIndex: 2,
            sourceFingerprint: getFixPathSourceFingerprint(track.content, 0, 2, 2),
            controlPoints: [{
                id: 'fix-point-0-2',
                sourceIndex: 2,
                progress: 0,
                coordinate: movedCoordinate,
                fixed: true,
            }],
        }
        const journey = {
            slug: track.parent,
            fixPathEnabled: true,
            fixPathCorrectionData: {tracks: {[track.slug]: [correction]}},
            renderSmoothing: {enabled: true, step: 1},
            tracks: new Map([[track.slug, track]]),
        }
        vi.stubGlobal('lgs', {
            getJourneyBySlug: vi.fn(() => journey),
            theJourneyEditorProxy: {journey},
            settings: {journey: {}},
        })

        const renderContent = getTrackRenderContent(track)

        expect(renderContent.geometry.coordinates).toContainEqual(movedCoordinate)
        expect(renderContent.geometry.coordinates.length).toBeGreaterThan(sourceCoordinates.length)
    })

    it('keeps every point in an edited section exact even when its controls are unchanged', () => {
        const track = makeTrack({enabled: true, step: 1})
        const sourceCoordinates = [
            [6, 45, 100],
            [6.00005, 45.00002, 110],
            [6.0001, 45, 120],
            [6.00015, 45.00002, 130],
            [6.0002, 45, 140],
        ]
        track.content.geometry.coordinates = sourceCoordinates
        const correction = {
            id: 'unchanged-section',
            segmentIndex: 0,
            startIndex: 1,
            endIndex: 3,
            sourceFingerprint: getFixPathSourceFingerprint(track.content, 0, 1, 3),
            controlPoints: [1, 2, 3].map(index => ({
                id: 'fix-point-0-' + index,
                sourceIndex: index,
                progress: (index - 1) / 2,
                coordinate: sourceCoordinates[index],
                fixed: false,
                removed: false,
            })),
        }
        const journey = {
            slug: track.parent,
            fixPathEnabled: true,
            fixPathCorrectionData: {tracks: {[track.slug]: [correction]}},
            renderSmoothing: {enabled: true, step: 1},
            tracks: new Map([[track.slug, track]]),
        }
        vi.stubGlobal('lgs', {
            getJourneyBySlug: vi.fn(() => journey),
            theJourneyEditorProxy: {journey},
            settings: {journey: {}},
        })

        const renderContent = getTrackRenderContent(track)

        sourceCoordinates.slice(1, 4).forEach(coordinate => {
            expect(renderContent.geometry.coordinates).toContainEqual(coordinate)
        })
    })

    it('retains every vertex in a corrected section when capped render geometry is sampled', () => {
        const track = makeTrack({enabled: true, step: 1})
        const coordinates = Array.from({length: MAX_RENDER_POINTS * 4}, (_, index) => [
            6 + (index * 0.0001),
            45 + (index * 0.0001),
            100 + index,
        ])
        const anchorIndex = 7777
        const startIndex = anchorIndex - 5
        const endIndex = anchorIndex + 5
        track.content.geometry.coordinates = coordinates
        const movedCoordinate = [...coordinates[anchorIndex]]
        movedCoordinate[2] += 0.5
        const previewCoordinates = coordinates.slice()
        previewCoordinates[anchorIndex] = movedCoordinate
        const correction = {
            segmentIndex: 0,
            startIndex,
            endIndex,
            sourceFingerprint: getFixPathSourceFingerprint(track.content, 0, startIndex, endIndex),
            controlPoints: [{
                id: 'fix-point-0-' + anchorIndex,
                sourceIndex: anchorIndex,
                coordinate: movedCoordinate,
                fixed: true,
                removed: false,
            }],
        }
        const journey = {
            slug: track.parent,
            fixPathEnabled: true,
            fixPathCorrectionData: {tracks: {[track.slug]: [correction]}},
            tracks: new Map([[track.slug, track]]),
        }
        vi.stubGlobal('lgs', {
            getJourneyBySlug: vi.fn(() => journey),
            theJourneyEditorProxy: {journey},
        })

        const renderContent = getTrackRenderContent(track, {
            forRender: true,
            content: {
                ...track.content,
                geometry: {...track.content.geometry, coordinates: previewCoordinates},
            },
        })

        expect(renderContent.geometry.coordinates).toHaveLength(MAX_RENDER_POINTS)
        for (let index = startIndex; index <= endIndex; index += 1) {
            expect(renderContent.geometry.coordinates).toContainEqual(previewCoordinates[index])
        }
    })

    it('uses journey settings for a single-track journey and track settings for multi-track journeys', () => {
        const singleTrack = makeTrack()
        const multiTrack = makeTrack({enabled: true, step: 3})

        vi.stubGlobal('lgs', {
            settings: {
                getJourney: {
                    renderSmoothing: {
                        enabled: false,
                        step:    1,
                    },
                },
            },
            theJourneyEditorProxy: {
                journey: {
                    slug:            'journey#gpx',
                    renderSmoothing: {enabled: true, step: 2},
                    tracks:          new Map([[singleTrack.slug, singleTrack]]),
                },
            },
        })

        expect(resolveTrackRenderSmoothing(singleTrack)).toEqual({enabled: true, step: 2})

        globalThis.lgs.theJourneyEditorProxy.journey.tracks.set('track#journey#gpx#second', {})

        expect(resolveTrackRenderSmoothing(multiTrack)).toEqual({enabled: true, step: 3})
    })
})
