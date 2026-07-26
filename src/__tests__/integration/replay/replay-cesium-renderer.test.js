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
import { defaultJourneyReplaySettings, REPLAY_TRACE_MODE_FULL } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { Cartesian3, Color }                                   from 'cesium'
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

const materialCss = material => material?.color?.getValue?.()?.toCssColorString?.()
    ?? material?.toCssColorString?.()
    ?? `${material}`

const propertyValue = value => typeof value?.getValue === 'function' ? value.getValue() : value

const installReplayGlobals = ({dataSources, replay = defaultJourneyReplaySettings(), requestRender = vi.fn()} = {}) => {
    globalThis.lgs = {
        settings: {
            ui: {
                replay,
            },
        },
        stores: {
            replay: {
                playing: false,
                progression: replay.progression,
                trace: replay.trace,
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

    return requestRender
}

describe('JourneyReplayCesiumRenderer', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        delete globalThis.lgs
        delete globalThis.__lgsReplayVideoTrace
        delete globalThis.__lgsReplayVideoTraceConsole
    })

    it('uses the trace visibility rule for the replay marker', () => {
        const dataSources = makeDataSources()
        const requestRender = installReplayGlobals({dataSources})

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
        expect(replayEntity(dataSources, '#cursor-border')?.show).not.toBe(true)

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
        expect(replayEntity(dataSources, '#cursor-border')?.show).not.toBe(true)

        renderer.update({sample: midSample, sampler, forceGeometry: true, hideCursor: true})

        expect(visibleTraceEntities(dataSources).length).toBeGreaterThan(0)
        expect(replayEntity(dataSources, '#cursor')?.show).toBe(false)
        expect(replayEntity(dataSources, '#cursor-border')?.show).not.toBe(true)

        renderer.update({sample: midSample, sampler, forceGeometry: true})

        expect(replayEntity(dataSources, '#cursor')?.show).toBe(true)
        expect(replayEntity(dataSources, '#cursor-border')?.show).not.toBe(true)
        expect(requestRender).toHaveBeenCalled()
    })

    it('keeps the replay trace hidden when the global scene is not the video scene', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({
            sample: sampler.atProgress(0.5),
            sampler,
            forceGeometry: true,
            showTrace: false,
        })

        expect(replaySource(dataSources).show).toBe(false)
        expect(visibleTraceEntities(dataSources)).toHaveLength(0)

        renderer.update({
            sample: sampler.atProgress(0.5),
            sampler,
            forceGeometry: true,
            showTrace: true,
        })

        expect(replaySource(dataSources).show).toBe(true)
        expect(visibleTraceEntities(dataSources).length).toBeGreaterThan(0)
    })

    it('renders the replay marker fill and border on one Cesium point', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.progression = {
            ...replay.progression,
            fill:   {...replay.progression.fill, color: '#ff2525', opacity: 1, width: 6},
            border: {...replay.progression.border, color: '#ffffff', opacity: 1, width: 1.5},
        }
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({sample: sampler.atProgress(0.5), sampler, forceGeometry: true})

        const cursor = replayEntity(dataSources, '#cursor')

        expect(cursor?.show).toBe(true)
        expect(replayEntity(dataSources, '#cursor-border')?.show).not.toBe(true)
        expect(propertyValue(cursor?.point?.color)?.toCssColorString()).toBe(Color.fromCssColorString('#ff2525').toCssColorString())
        expect(propertyValue(cursor?.point?.outlineColor)?.toCssColorString()).toBe(Color.fromCssColorString('#ffffff').toCssColorString())
        expect(propertyValue(cursor?.point?.outlineWidth)).toBe(1.5)
    })

    it('renders a static completed trace for stop clip frames', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.progression = {
            ...replay.progression,
            fill:   {...replay.progression.fill, color: '#123456'},
            border: {...replay.progression.border, color: '#abcdef'},
        }
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({
            sample: sampler.atProgress(1),
            sampler,
            forceGeometry: true,
            hideCursor: true,
            hideRemainingTrace: true,
            staticCompletedTrace: true,
        })

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const completedBorder = replayEntity(dataSources, '#completed#smoothed#border')

        expect(completedFill?.show).toBe(true)
        expect(completedBorder?.show).toBe(true)
        expect(propertyValue(completedFill?.polyline?.clampToGround)).toBe(true)
        expect(propertyValue(completedBorder?.polyline?.clampToGround)).toBe(true)
        const guideEnd = sampler.samples.at(-1)
        const renderedEnd = propertyValue(completedFill?.polyline?.positions).at(-1)
        expect(Cartesian3.equals(renderedEnd, Cartesian3.fromDegrees(guideEnd.longitude, guideEnd.latitude, 0))).toBe(true)
        expect(materialCss(completedFill?.polyline?.material)).toBe(Color.fromCssColorString('#123456').toCssColorString())
        expect(materialCss(completedBorder?.polyline?.material)).toBe(Color.fromCssColorString('#abcdef').toCssColorString())
        expect(completedFill?.polyline?.depthFailMaterial).toBeUndefined()
        expect(completedBorder?.polyline?.depthFailMaterial).toBeUndefined()
        expect(replayEntity(dataSources, '#cursor')?.show).toBe(false)
        expect(replayEntity(dataSources, '#cursor-border')?.show).not.toBe(true)
    })

    it('keeps the final point in the live replay trace', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        installReplayGlobals({dataSources, replay})
        globalThis.lgs.stores.replay.playing = true
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({
            sample: sampler.atProgress(1),
            sampler,
            forceGeometry: true,
            showTrace: true,
        })

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const renderedEnd = propertyValue(completedFill?.polyline?.positions).at(-1)
        const guideEnd = sampler.samples.at(-1)
        expect(Cartesian3.equals(renderedEnd, Cartesian3.fromDegrees(guideEnd.longitude, guideEnd.latitude, 0))).toBe(true)
    })

    it('keeps the complete point set for the Draft trace', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        installReplayGlobals({dataSources, replay})
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.recordingSync = true
        const coordinates = Array.from({length: 12}, (_, index) => [2 + (index * 0.001), 48 + (index * 0.001), 120 + index])
        const journey = makeJourney([makeTrack({slug: 'track#journey#gpx#main', coordinates})])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({
            sample: sampler.atProgress(0.8),
            sampler,
            forceGeometry: true,
            showTrace: true,
        })

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const renderedPositions = propertyValue(completedFill?.polyline?.positions)
        expect(renderedPositions.length).toBeGreaterThan(8)
    })

    it('uniformly keeps at most 2048 trace points and preserves both endpoints', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const coordinates = Array.from({length: 4096}, (_, index) => [2 + (index * 0.00001), 48 + (index * 0.00001), 120])
        const journey = makeJourney([makeTrack({slug: 'track#journey#gpx#main', coordinates})])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({sample: sampler.atProgress(1), sampler, forceGeometry: true, showTrace: true})

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const positions = propertyValue(completedFill?.polyline?.positions)
        expect(positions).toHaveLength(2048)
        expect(Cartesian3.equals(positions[0], Cartesian3.fromDegrees(coordinates[0][0], coordinates[0][1], 0))).toBe(true)
        expect(Cartesian3.equals(positions.at(-1), Cartesian3.fromDegrees(coordinates.at(-1)[0], coordinates.at(-1)[1], 0))).toBe(true)
    })

    it('does not resurrect the remaining trace for stop clip frames', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.trace = {
            ...replay.trace,
            mode: REPLAY_TRACE_MODE_FULL,
        }
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({
            sample: sampler.atProgress(0.5),
            sampler,
            forceGeometry: true,
        })

        expect(visibleTraceEntities(dataSources)
            .some(entity => String(entity.id).includes('#remaining#'))).toBe(true)

        renderer.update({
            sample: sampler.atProgress(1),
            sampler,
            forceGeometry: true,
            hideCursor: true,
            hideRemainingTrace: true,
            staticCompletedTrace: true,
        })

        expect(visibleTraceEntities(dataSources)
            .some(entity => String(entity.id).includes('#remaining#'))).toBe(false)
        expect(visibleTraceEntities(dataSources)
            .some(entity => String(entity.id).includes('#completed#'))).toBe(true)
    })

    it('keeps the completed stop clip trace entity stable across repeated frames', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()
        const sample = sampler.atProgress(1)

        renderer.show({sampler})
        renderer.update({
            sample,
            sampler,
            forceGeometry: true,
            hideCursor: true,
            hideRemainingTrace: true,
            staticCompletedTrace: true,
        })
        const firstCompletedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const firstCompletedBorder = replayEntity(dataSources, '#completed#smoothed#border')

        renderer.update({
            sample,
            sampler,
            forceGeometry: true,
            hideCursor: true,
            hideRemainingTrace: true,
            staticCompletedTrace: true,
        })

        expect(replayEntity(dataSources, '#completed#smoothed#fill')).toBe(firstCompletedFill)
        expect(replayEntity(dataSources, '#completed#smoothed#border')).toBe(firstCompletedBorder)
        expect(visibleTraceEntities(dataSources)
            .some(entity => String(entity.id).includes('#remaining#'))).toBe(false)
    })

})
