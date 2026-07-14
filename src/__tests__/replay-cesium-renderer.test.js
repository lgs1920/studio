/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-cesium-renderer.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-15
 * Last modified: 2026-07-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyReplayCesiumRenderer } from '@Core/ui/replay/JourneyReplayCesiumRenderer'
import { JourneyReplayPathSampler }    from '@Core/ui/replay/JourneyReplayPathSampler'
import { defaultJourneyReplaySettings } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { Cartesian3 }                  from 'cesium'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Utils/cesium/TrackUtils', () => ({
    TrackUtils: {
        getTrackRenderStyle: vi.fn(() => null),
        createTrackMaterial: vi.fn(() => null),
    },
}))

const makeTrack = ({slug, coordinates}) => ({
    slug,
    visible: true,
    metrics: {},
    content: {
        type:       'Feature',
        properties: {},
        geometry:   {
            type: 'LineString',
            coordinates,
        },
    },
})

const makeJourney = tracks => ({
    slug:   'journey#gpx',
    tracks: new Map(tracks.map(track => [track.slug, track])),
})

const makeDataSources = () => ({
    items: [],
    add(source) {
        this.items.push(source)
        return Promise.resolve(source)
    },
    contains(source) {
        return this.items.includes(source)
    },
    getByName(name) {
        return this.items.filter(source => source.name === name)
    },
    raiseToTop: vi.fn(),
})

const replaySource = dataSources => dataSources.getByName('replay#journey#gpx')[0]

const replayEntity = (dataSources, suffix) => replaySource(dataSources)
    ?.entities
    ?.values
    ?.find(entity => String(entity.id).endsWith(suffix))

const visibleTraceEntities = dataSources => replaySource(dataSources)
    ?.entities
    ?.values
    ?.filter(entity => entity.polyline && entity.show !== false) ?? []

describe('JourneyReplayCesiumRenderer', () => {
    afterEach(() => {
        delete globalThis.lgs
    })

    it('uses the trace visibility rule for the replay marker', () => {
        const dataSources = makeDataSources()
        const requestRender = vi.fn()
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: defaultJourneyReplaySettings(),
                },
            },
            stores: {
                replay: {
                    playing: false,
                },
            },
            viewer: {
                dataSources,
                camera: {
                    position: Cartesian3.fromDegrees(2, 48, 1500),
                    frustum:  {fovy: Math.PI / 3},
                },
                scene: {
                    canvas: {height: 1000},
                },
            },
            scene: {
                canvas: {height: 1000},
                requestRender,
            },
        }

        const emptySampler = {
            journey: {slug: 'journey#gpx', tracks: new Map()},
            segments: [],
            samples: [],
            totalDistance: 0,
            completedSegmentsAt: () => [],
            remainingSegmentsAt:  () => [],
        }
        const sample = {
            longitude: 2,
            latitude:  48,
            altitude:  120,
            progress:  0,
            distanceFromStart: 0,
        }
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler: emptySampler})
        renderer.update({sample, sampler: emptySampler, forceGeometry: true})

        expect(visibleTraceEntities(dataSources)).toHaveLength(0)
        expect(replayEntity(dataSources, '#cursor')?.show).toBe(false)
        expect(replayEntity(dataSources, '#cursor-border')?.show).toBe(false)

        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const midSample = sampler.atProgress(0.5)

        renderer.show({sampler})
        renderer.update({sample: midSample, sampler, forceGeometry: true})

        expect(visibleTraceEntities(dataSources).length).toBeGreaterThan(0)
        expect(replayEntity(dataSources, '#cursor')?.show).toBe(true)
        expect(replayEntity(dataSources, '#cursor-border')?.show).toBe(true)

        renderer.update({sample: midSample, sampler, forceGeometry: true, hideCursor: true})

        expect(visibleTraceEntities(dataSources).length).toBeGreaterThan(0)
        expect(replayEntity(dataSources, '#cursor')?.show).toBe(false)
        expect(replayEntity(dataSources, '#cursor-border')?.show).toBe(false)

        renderer.update({sample: midSample, sampler, forceGeometry: true})

        expect(replayEntity(dataSources, '#cursor')?.show).toBe(true)
        expect(replayEntity(dataSources, '#cursor-border')?.show).toBe(true)
        expect(requestRender).toHaveBeenCalled()
    })
})
