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
    getTrackRenderContent, normalizeTrackRenderSmoothing, resolveTrackRenderSmoothing,
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
            step:    4,
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
