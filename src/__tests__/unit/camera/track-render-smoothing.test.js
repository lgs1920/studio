/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-render-smoothing.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-05-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    getTrackRenderContent, normalizeTrackRenderSmoothing, resolveTrackRenderSmoothing, trackRenderSmoothingKey,
}                                                from '@Utils/cesium/trackRenderSmoothing'

const makeTrack = (renderSmoothing = undefined) => ({
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
