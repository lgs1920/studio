/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-cesium-renderer.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
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
import { Cartesian3, Color, ColorMaterialProperty, PolylineGlowMaterialProperty } from 'cesium'
import { REPLAY_EFFECT_GLOW, REPLAY_EFFECT_NEON }               from '@Core/ui/replay/JourneyReplayProgressionStyle'
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
    remove(source) {
        const index = this.items.indexOf(source)
        if (index < 0) {
            return false
        }
        this.items.splice(index, 1)
        return true
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
        expect(propertyValue(replayEntity(dataSources, '#cursor')?.point?.disableDepthTestDistance)).toBe(0)

        renderer.update({sample: midSample, sampler, forceGeometry: true, hideCursor: true})

        expect(visibleTraceEntities(dataSources).length).toBeGreaterThan(0)
        expect(replayEntity(dataSources, '#cursor')?.show).toBe(false)
        expect(replayEntity(dataSources, '#cursor-border')?.show).not.toBe(true)

        renderer.update({sample: midSample, sampler, forceGeometry: true})

        expect(replayEntity(dataSources, '#cursor')?.show).toBe(true)
        expect(propertyValue(replayEntity(dataSources, '#cursor')?.point?.disableDepthTestDistance)).toBe(0)
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

        expect(replaySource(dataSources)).toBeUndefined()
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

    it('uses fill and border opacity for the shared Glow effect', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.progression = {
            ...replay.progression,
            effect: {mode: REPLAY_EFFECT_GLOW},
            fill:   {...replay.progression.fill, color: '#112233', opacity: 0.35, width: 6},
            border: {...replay.progression.border, color: '#abcdef', opacity: 0.6, width: 1.5},
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

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const completedInnerGlow = replayEntity(dataSources, '#completed#smoothed#inner-glow')
        const completedBorder = replayEntity(dataSources, '#completed#smoothed#border')
        const cursorEffect = replayEntity(dataSources, '#cursor-effect-outer')
        const cursorEffectInner = replayEntity(dataSources, '#cursor-effect-inner')
        const expectedBorderGlowColor = Color.fromCssColorString('#abcdef')
            .brighten(0.2, new Color())
            .withAlpha(0.33)
            .toCssColorString()
        const expectedFillEffectColor = Color.fromCssColorString('#112233').withAlpha(0.35).toCssColorString()
        const expectedInnerGlowColor = Color.lerp(
            Color.fromCssColorString('#112233').withAlpha(0.35),
            Color.fromCssColorString('#abcdef').withAlpha(0.6),
            0.75,
            new Color(),
        )
            .withAlpha(0.35)
            .brighten(0.2, new Color())
            .withAlpha(0.1925)
            .toCssColorString()

        expect(completedFill?.polyline?.material).toBeInstanceOf(ColorMaterialProperty)
        expect(propertyValue(completedFill?.polyline?.width)).toBe(6)
        expect(propertyValue(completedBorder?.polyline?.width)).toBe(15)
        expect(materialCss(completedFill?.polyline?.material)).toBe(expectedFillEffectColor)
        expect(completedInnerGlow?.polyline?.material).toBeInstanceOf(PolylineGlowMaterialProperty)
        expect(propertyValue(completedInnerGlow?.polyline?.width)).toBe(8)
        expect(materialCss(completedInnerGlow?.polyline?.material)).toBe(expectedInnerGlowColor)
        expect(completedBorder?.polyline?.material).toBeInstanceOf(PolylineGlowMaterialProperty)
        expect(materialCss(completedBorder?.polyline?.material)).toBe(expectedBorderGlowColor)
        expect(propertyValue(completedBorder?.polyline?.material?.glowPower)).toBe(0.18)
        expect(propertyValue(cursorEffect?.point?.color)?.toCssColorString()).toBe(
            Color.fromCssColorString('#abcdef')
                .brighten(0.2, new Color())
                .withAlpha(0.33)
                .toCssColorString(),
        )
        expect(propertyValue(cursorEffectInner?.point?.color)?.toCssColorString()).toBe(
            Color.lerp(
                Color.fromCssColorString('#112233').withAlpha(0.35),
                Color.fromCssColorString('#abcdef').withAlpha(0.6),
                0.75,
                new Color(),
            )
                .withAlpha(0.35)
                .brighten(0.2, new Color())
                .withAlpha(0.1925)
                .toCssColorString(),
        )
        expect(propertyValue(replayEntity(dataSources, '#cursor')?.point?.color)?.alpha).toBeCloseTo(0.85)
    })

    it('falls back to the trace color and composes Neon marker layers without a native point effect', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.progression = {
            ...replay.progression,
            effect: {mode: REPLAY_EFFECT_NEON},
            fill:   {...replay.progression.fill, color: '#123456', opacity: 0.15, width: 6},
            border: {...replay.progression.border, color: '#abcdef', opacity: 1, width: 0},
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

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const completedInnerGlow = replayEntity(dataSources, '#completed#smoothed#inner-glow')
        const cursor = replayEntity(dataSources, '#cursor')
        const cursorEffectOuter = replayEntity(dataSources, '#cursor-effect-outer')
        const cursorEffectInner = replayEntity(dataSources, '#cursor-effect-inner')
        const cursorEffectCore = replayEntity(dataSources, '#cursor-effect-core')
        const expectedEffectColor = Color.fromCssColorString('#123456').withAlpha(0.15).toCssColorString()
        const expectedGlowColor = Color.fromCssColorString('#123456')
            .brighten(0.35, new Color())
            .withAlpha(0.063)
            .toCssColorString()

        expect(completedFill?.polyline?.material).toBeInstanceOf(ColorMaterialProperty)
        expect(propertyValue(completedFill?.polyline?.width)).toBe(6)
        expect(materialCss(completedFill?.polyline?.material)).toBe(expectedEffectColor)
        expect(completedInnerGlow?.polyline?.material).toBeInstanceOf(PolylineGlowMaterialProperty)
        expect(propertyValue(completedInnerGlow?.polyline?.width)).toBe(9)
        expect(materialCss(completedInnerGlow?.polyline?.material)).toBe(
            Color.fromCssColorString('#123456')
                .brighten(0.35, new Color())
                .withAlpha(0.0675)
                .toCssColorString(),
        )
        expect(replayEntity(dataSources, '#completed#smoothed#border')?.polyline?.material)
            .toBeInstanceOf(PolylineGlowMaterialProperty)
        expect(propertyValue(replayEntity(dataSources, '#completed#smoothed#border')?.polyline?.width)).toBe(16)
        expect(materialCss(replayEntity(dataSources, '#completed#smoothed#border')?.polyline?.material))
            .toBe(expectedGlowColor)
        expect(propertyValue(replayEntity(dataSources, '#completed#smoothed#border')?.polyline?.material?.glowPower))
            .toBe(0.28)
        expect(propertyValue(cursor?.point?.outlineWidth)).toBe(0)
        expect(propertyValue(cursorEffectOuter?.point?.color)?.toCssColorString()).toBe(
            Color.fromCssColorString('#123456')
                .brighten(0.35, new Color())
                .withAlpha(0.0975)
                .toCssColorString(),
        )
        expect(propertyValue(cursorEffectCore?.point?.color)?.toCssColorString()).toBe(expectedEffectColor)
        expect(propertyValue(cursorEffectInner?.point?.color)?.toCssColorString()).toBe(
            Color.fromCssColorString('#123456')
                .brighten(0.35, new Color())
                .withAlpha(0.0675)
                .toCssColorString(),
        )
        expect(cursorEffectOuter?.show).toBe(true)
        expect(cursorEffectCore?.show).toBe(true)

        replay.progression.effect = {
            mode: 'none',
        }
        renderer.update({sample: sampler.atProgress(0.5), sampler, forceGeometry: true})

        expect(replayEntity(dataSources, '#completed#smoothed#fill')?.polyline?.material)
            .not.toBeInstanceOf(PolylineGlowMaterialProperty)
        expect(cursorEffectOuter?.show).toBe(false)
        expect(cursorEffectInner?.show).toBe(false)
        expect(cursorEffectCore?.show).toBe(false)
    })

    it('updates dynamic effect materials when the replay style changes during playback', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.progression = {
            ...replay.progression,
            effect: {mode: REPLAY_EFFECT_GLOW},
        }
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
        const sample = sampler.atProgress(0.5)

        renderer.show({sampler})
        renderer.update({sample, sampler, forceGeometry: true})

        const completedBorder = replayEntity(dataSources, '#completed#smoothed#border')
        expect(propertyValue(completedBorder?.polyline?.material?.glowPower)).toBe(0.18)

        replay.progression.effect = {mode: REPLAY_EFFECT_NEON}
        renderer.update({sample, sampler})

        expect(propertyValue(completedBorder?.polyline?.material?.glowPower)).toBe(0.28)
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

    it('smooths trace coordinates geographically before applying ground clamping', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        globalThis.lgs.settings.getJourney = {
            renderSmoothing: {
                enabled: true,
                step:    1,
            },
        }
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({
            journey,
            renderSmoothing: {enabled: false, step: 1},
        })
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({
            sample: sampler.atProgress(1),
            sampler,
            forceGeometry: true,
            staticCompletedTrace: true,
        })

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const positions = propertyValue(completedFill?.polyline?.positions)

        expect(positions).toHaveLength(6)
        expect(Cartesian3.equals(positions[1], Cartesian3.fromDegrees(2.00025, 48.00025, 0))).toBe(true)
        expect(propertyValue(completedFill?.polyline?.clampToGround)).toBe(true)
    })

    it('uses the dense replay camera guide for a smooth ground trace', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const smoothedGuide = [
            {progress: 0,    longitude: 2,        latitude: 48},
            {progress: 0.25, longitude: 2.00025, latitude: 48.0003},
            {progress: 0.5,  longitude: 2.001,   latitude: 48.001},
            {progress: 0.75, longitude: 2.00175, latitude: 48.0003},
            {progress: 1,    longitude: 2.002,   latitude: 48},
        ]
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler, options: {smoothedGuide}})
        renderer.update({
            sample: sampler.atProgress(1),
            sampler,
            forceGeometry: true,
            staticCompletedTrace: true,
        })

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const positions = propertyValue(completedFill?.polyline?.positions)

        expect(positions).toHaveLength(smoothedGuide.length)
        expect(Cartesian3.equals(positions[1], Cartesian3.fromDegrees(2.00025, 48.0003, 0))).toBe(true)
        expect(propertyValue(completedFill?.polyline?.clampToGround)).toBe(true)
        expect(propertyValue(completedFill?.polyline?.granularity)).toBe(8)
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

    it('can align the HQ marker with the trace without forcing a geometry rebuild', () => {
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
        const smoothedGuide = [
            {longitude: 2, latitude: 48, progress: 0},
            {longitude: 2.01, latitude: 48.01, progress: 1},
        ]

        renderer.show({sampler, options: {smoothedGuide}})
        renderer.update({sample: sampler.atProgress(0.4), sampler, forceGeometry: true, showTrace: true})
        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const positionsProperty = completedFill?.polyline?.positions
        const initialTraceEnd = propertyValue(positionsProperty).at(-1)

        renderer.update({sample: sampler.atProgress(0.5), sampler, syncCursorToTrace: true})

        const cursorBeforeTraceRender = propertyValue(replayEntity(dataSources, '#cursor')?.position)
        const traceEnd = propertyValue(completedFill?.polyline?.positions).at(-1)
        const cursorAfterTraceRender = propertyValue(replayEntity(dataSources, '#cursor')?.position)
        const cursorSize = propertyValue(replayEntity(dataSources, '#cursor')?.point?.pixelSize)

        expect(completedFill?.polyline?.positions).toBe(positionsProperty)
        expect(Cartesian3.equals(cursorBeforeTraceRender, initialTraceEnd)).toBe(true)
        expect(Cartesian3.equals(cursorAfterTraceRender, traceEnd)).toBe(true)
        expect(Number.isFinite(cursorSize)).toBe(true)
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

    it('removes the replay data source when the replay is cleared', () => {
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
        renderer.update({sample: sampler.atProgress(0.5), sampler, forceGeometry: true})
        const source = replaySource(dataSources)

        expect(source).toBeDefined()
        renderer.clear()

        expect(dataSources.contains(source)).toBe(false)
        expect(replaySource(dataSources)).toBeUndefined()
    })

    it('keeps an explicitly hidden trace hidden until it is explicitly shown', () => {
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
        renderer.update({sample: sampler.atProgress(0.5), sampler, forceGeometry: true, showTrace: false})
        renderer.update({sample: sampler.atProgress(0.6), sampler, forceGeometry: true})

        expect(replaySource(dataSources)).toBeUndefined()
        expect(visibleTraceEntities(dataSources)).toHaveLength(0)

        renderer.update({sample: sampler.atProgress(0.6), sampler, forceGeometry: true, showTrace: true})

        expect(replaySource(dataSources).show).toBe(true)
        expect(visibleTraceEntities(dataSources).length).toBeGreaterThan(0)
    })

})
