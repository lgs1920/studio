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
import { Cartesian3, Cartographic, Color, SceneTransforms }     from 'cesium'
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
        expect(materialCss(completedFill?.polyline?.material)).toBe(Color.fromCssColorString('#123456').toCssColorString())
        expect(materialCss(completedBorder?.polyline?.material)).toBe(Color.fromCssColorString('#abcdef').toCssColorString())
        expect(completedFill?.polyline?.depthFailMaterial).toBeUndefined()
        expect(completedBorder?.polyline?.depthFailMaterial).toBeUndefined()
        expect(replayEntity(dataSources, '#cursor')?.show).toBe(false)
        expect(replayEntity(dataSources, '#cursor-border')?.show).not.toBe(true)
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

    it('projects stop clip video trace from the Cesium canvas into the export crop', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        globalThis.__lgsReplayVideoTraceConsole = false

        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 2000
        sourceCanvas.height = 1000
        sourceCanvas.getBoundingClientRect = vi.fn(() => ({
            left: 100, top: 50, width: 1000, height: 500,
        }))

        const sceneCanvas = document.createElement('canvas')
        sceneCanvas.width = 2000
        sceneCanvas.height = 1000
        sceneCanvas.getBoundingClientRect = vi.fn(() => ({
            left: 150, top: 80, width: 1000, height: 500,
        }))

        globalThis.lgs.canvas = sourceCanvas
        globalThis.lgs.viewer.scene.canvas = sceneCanvas
        globalThis.lgs.scene.canvas = sceneCanvas
        globalThis.lgs.scene.globe = {getHeight: vi.fn(() => 250)}

        const ctx = {
            setTransform: vi.fn(),
            beginPath:    vi.fn(),
            moveTo:       vi.fn(),
            lineTo:       vi.fn(),
            stroke:       vi.fn(),
            set lineCap(value) {
                this._lineCap = value
            },
            set lineJoin(value) {
                this._lineJoin = value
            },
            set strokeStyle(value) {
                this._strokeStyle = value
            },
            set lineWidth(value) {
                this._lineWidth = value
            },
        }
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)

        const projectedPoints = [{x: 500, y: 240}, {x: 510, y: 250}, {x: 520, y: 260}]
        const projectedHeights = []
        let projectionIndex = 0
        vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockImplementation((_scene, position, result) => {
            projectedHeights.push(Math.round(Cartographic.fromCartesian(position)?.height ?? 0))
            const point = projectedPoints[Math.min(projectionIndex, projectedPoints.length - 1)]
            projectionIndex += 1
            result.x = point.x
            result.y = point.y
            return result
        })
        vi.spyOn(SceneTransforms, 'worldToDrawingBufferCoordinates').mockReturnValue(undefined)

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

        const overlay = renderer.createCompletedTraceVideoOverlay({
            cropRect: {left: 540, top: 270, width: 80, height: 60},
            outputDpr: 2,
            sourceCanvas,
        })

        const createdTrace = globalThis.__lgsReplayVideoTrace
            ?.find(entry => entry.event === 'renderer.overlay.stop.created')

        expect(overlay?.element).toBeInstanceOf(HTMLCanvasElement)
        expect(createdTrace?.data?.projectionMode).toBe('scene-css-to-source-css')
        expect(createdTrace?.data?.visible).toBeGreaterThan(0)
        expect(projectedHeights.every(height => height === 250)).toBe(true)
        expect(ctx.moveTo).toHaveBeenCalledWith(10, 0)
        expect(ctx.lineTo).toHaveBeenCalledWith(20, 10)
    })
})
