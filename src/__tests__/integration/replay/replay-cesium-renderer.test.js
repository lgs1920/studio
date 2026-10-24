/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-cesium-renderer.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {JourneyReplayCesiumRenderer} from '@Core/ui/replay/JourneyReplayCesiumRenderer'
import {JourneyReplayPathSampler} from '@Core/ui/replay/JourneyReplayPathSampler'
import {defaultJourneyReplaySettings, REPLAY_TRACE_MODE_FULL} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {Cartesian3, Color, ColorMaterialProperty, PolylineGlowMaterialProperty} from 'cesium'
import {REPLAY_EFFECT_GLOW, REPLAY_EFFECT_NEON} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {afterEach, describe, expect, it, vi} from 'vitest'

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
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates,
        },
    },
})

/** Create a test Journey with a stable slug and track collection. */
const makeJourney = (tracks, slug = 'journey#gpx') => ({
    slug,
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

/** Install a minimal Cesium scene with explicit CSS and drawing-buffer dimensions. */
const installReplayGlobals = ({
                               dataSources,
                               replay = defaultJourneyReplaySettings(),
                               requestRender = vi.fn(),
                               canvas = {height: 1000, clientHeight: 1000},
                               pixelRatio = 1,
                           } = {}) => {
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
                frustum: {fovy: Math.PI / 3},
            },
            scene: {canvas},
        },
        scene: {
            canvas,
            pixelRatio,
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
            remainingSegmentsAt: () => [],
        }
        const sample = {
            longitude: 2,
            latitude: 48,
            altitude: 120,
            progress: 0,
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
                slug: 'track#journey#gpx#main',
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
                slug: 'track#journey#gpx#main',
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

    it('removes the previous replay source and marker when the renderer switches journeys', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const firstJourney = makeJourney([
            makeTrack({
                slug: 'track#first#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ], 'first#gpx')
        const firstSampler = new JourneyReplayPathSampler({journey: firstJourney})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler: firstSampler})
        renderer.update({sample: firstSampler.atProgress(0.5), sampler: firstSampler, forceGeometry: true})
        expect(dataSources.getByName('replay#first#gpx')).toHaveLength(1)
        expect(dataSources.getByName('replay#first#gpx')[0].entities.values.some(entity => String(entity.id).endsWith('#cursor'))).toBe(true)

        const secondJourney = makeJourney([
            makeTrack({
                slug: 'track#second#gpx#main',
                coordinates: [[3, 49, 220], [3.001, 49.001, 230], [3.002, 49.002, 240]],
            }),
        ], 'second#gpx')
        const secondSampler = new JourneyReplayPathSampler({journey: secondJourney})

        renderer.update({sample: secondSampler.atProgress(0.5), sampler: secondSampler, forceGeometry: true})

        expect(dataSources.getByName('replay#first#gpx')).toHaveLength(0)
        expect(dataSources.getByName('replay#second#gpx')).toHaveLength(1)
        const replaySources = dataSources.items.filter(source => source.name.startsWith('replay#'))
        const cursors = replaySources.flatMap(source => source.entities.values)
            .filter(entity => String(entity.id).endsWith('#cursor'))
        expect(cursors).toHaveLength(1)
        renderer.clear()
    })

    it('renders the replay marker fill and border on one Cesium point', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'expert'
        replay.progression = {
            ...replay.progression,
            fill: {...replay.progression.fill, color: '#ff2525', opacity: 1, width: 6},
            border: {...replay.progression.border, color: '#ffffff', opacity: 1, width: 1.5},
        }
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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

    it('uses the effective Basic colors instead of stale Expert presentation state', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'basic'
        replay.basic = {
            presentation: {
                progression: {
                    fill: {color: '#ff2525'},
                    border: {color: '#ff2525'},
                },
            },
        }
        installReplayGlobals({
            dataSources,
            replay,
        })
        globalThis.lgs.stores.replay.basicPreparationActive = true
        globalThis.lgs.stores.replay.progression = {
            ...replay.progression,
            fill: {...replay.progression.fill, color: '#001122'},
            border: {...replay.progression.border, color: '#334455'},
        }
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({sample: sampler.atProgress(0.5), sampler, forceGeometry: true})

        const cursor = replayEntity(dataSources, '#cursor')
        expect(propertyValue(cursor?.point?.color)?.toCssColorString()).toBe(Color.fromCssColorString('#ff2525').toCssColorString())
    })

    it.each([1.5, 2.3])('scales the actual Basic marker and trace by %s from the projected baseline', scale => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'basic'
        replay.basic = {presentation: {sizeScale: 1}}
        installReplayGlobals({dataSources, replay})
        globalThis.lgs.stores.replay.basicPreparationActive = true
        const journey = makeJourney([makeTrack({
            slug: 'track#journey#gpx#main',
            coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
        })])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()
        renderer.show({sampler})
        const sample = sampler.atProgress(0.5)
        renderer.update({sample, sampler, forceGeometry: true})
        const baselinePointSize = propertyValue(replayEntity(dataSources, '#cursor').point.pixelSize)
        const baselineLineWidth = propertyValue(replayEntity(dataSources, '#fill').polyline.width)
        const baselineOutline = propertyValue(replayEntity(dataSources, '#cursor').point.outlineWidth)
        replay.basic.presentation = {sizeScale: scale, fillColor: '#008000', borderColor: '#0000ff'}
        renderer.update({sample, sampler, forceGeometry: true})
        const cursor = replayEntity(dataSources, '#cursor')
        expect(propertyValue(cursor.point.pixelSize)).toBeCloseTo(baselinePointSize * scale)
        expect(propertyValue(cursor.point.outlineWidth)).toBeCloseTo(baselineOutline * scale)
        expect(propertyValue(replayEntity(dataSources, '#fill').polyline.width)).toBeCloseTo(baselineLineWidth * scale)
        expect(propertyValue(cursor.point.color).toCssColorString()).toBe(Color.fromCssColorString('#008000').toCssColorString())
        expect(propertyValue(cursor.point.outlineColor).toCssColorString()).toBe(Color.fromCssColorString('#0000ff').toCssColorString())
        renderer.clear()
    })

    it('keeps the thin Basic trace marker at the small size and hides its border when disabled', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'basic'
        replay.basic = {presentation: {sizeScale: 1, markerSizeScale: 1}}
        installReplayGlobals({dataSources, replay})
        globalThis.lgs.stores.replay.basicPreparationActive = true
        const journey = makeJourney([makeTrack({
            slug: 'track#journey#gpx#main',
            coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
        })])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()
        renderer.show({sampler})
        const sample = sampler.atProgress(0.5)
        renderer.update({sample, sampler, forceGeometry: true})
        const baselinePointSize = propertyValue(replayEntity(dataSources, '#cursor').point.pixelSize)
        const baselineLineWidth = propertyValue(replayEntity(dataSources, '#fill').polyline.width)

        replay.basic.presentation = {sizeScale: 0.65, markerSizeScale: 1, borderEnabled: false}
        renderer.update({sample, sampler, forceGeometry: true})

        const cursor = replayEntity(dataSources, '#cursor')
        expect(propertyValue(cursor.point.pixelSize)).toBeCloseTo(baselinePointSize)
        expect(propertyValue(replayEntity(dataSources, '#fill').polyline.width)).toBeCloseTo(baselineLineWidth * 0.65)
        expect(propertyValue(cursor.point.outlineColor).alpha).toBe(0)
        renderer.clear()
    })

    it('keeps marker CSS size and trace width stable when the drawing buffer resolution doubles', () => {
        const dataSources = makeDataSources()
        const canvas = {height: 1000, clientHeight: 1000}
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'expert'
        installReplayGlobals({dataSources, replay, canvas, pixelRatio: 1})
        const journey = makeJourney([makeTrack({
            slug: 'track#journey#gpx#main',
            coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140]],
        })])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()
        const sample = sampler.atProgress(0.5)

        renderer.show({sampler})
        renderer.update({sample, sampler, forceGeometry: true})

        const marker = replayEntity(dataSources, '#cursor')
        const fill = replayEntity(dataSources, '#fill')
        const baselineMarkerSize = propertyValue(marker.point.pixelSize)
        const baselinePathWidth = propertyValue(fill.polyline.width)

        canvas.height = 2000
        globalThis.lgs.scene.pixelRatio = 2
        renderer.update({sample, sampler, forceGeometry: true})

        expect(propertyValue(marker.point.pixelSize)).toBe(baselineMarkerSize)
        expect(propertyValue(fill.polyline.width)).toBe(baselinePathWidth)
        renderer.clear()
    })

    it('uses fill and border opacity for the shared Glow effect', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'expert'
        replay.progression = {
            ...replay.progression,
            effect: {mode: REPLAY_EFFECT_GLOW},
            fill: {...replay.progression.fill, color: '#112233', opacity: 0.35, width: 6},
            border: {...replay.progression.border, color: '#abcdef', opacity: 0.6, width: 1.5},
        }
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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
        replay.userMode = 'expert'
        replay.progression = {
            ...replay.progression,
            effect: {mode: REPLAY_EFFECT_NEON},
            fill: {...replay.progression.fill, color: '#123456', opacity: 0.15, width: 6},
            border: {...replay.progression.border, color: '#abcdef', opacity: 1, width: 0},
        }
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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
        replay.userMode = 'expert'
        replay.progression = {
            ...replay.progression,
            effect: {mode: REPLAY_EFFECT_GLOW},
        }
        installReplayGlobals({dataSources, replay})
        globalThis.lgs.stores.replay.playing = true
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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
        replay.userMode = 'expert'
        replay.progression = {
            ...replay.progression,
            fill: {...replay.progression.fill, color: '#123456'},
            border: {...replay.progression.border, color: '#abcdef'},
        }
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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

    it('uses Replay sampler geometry once when global journey smoothing is enabled', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        globalThis.lgs.settings.getJourney = {
            renderSmoothing: {
                enabled: true,
                step: 6,
            },
        }
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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

        expect(sampler.samples).toHaveLength(3)
        expect(positions).toHaveLength(3)
        expect(Cartesian3.equals(positions[1], Cartesian3.fromDegrees(2.001, 48.001, 0))).toBe(true)
        expect(propertyValue(completedFill?.polyline?.clampToGround)).toBe(true)
    })

    it('refreshes the cached trace when a Fix Path sampler rebuilds its samples', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const makeJourneyWithMiddlePoint = middlePoint => makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
                coordinates: [[2, 48, 120], middlePoint, [2.002, 48, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({
            journey: makeJourneyWithMiddlePoint([2.001, 48.001, 130]),
            renderSmoothing: {enabled: false, step: 1},
        })
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({sample: sampler.atProgress(1), sampler, forceGeometry: true, staticCompletedTrace: true})
        const line = replayEntity(dataSources, '#completed#smoothed#fill')
        const firstMiddle = propertyValue(line?.polyline?.positions)[1]

        sampler.update({
            journey: makeJourneyWithMiddlePoint([2.001, 48.002, 130]),
            renderSmoothing: {enabled: false, step: 1},
        })
        renderer.update({sample: sampler.atProgress(1), sampler, forceGeometry: true, staticCompletedTrace: true})
        const updatedMiddle = propertyValue(line?.polyline?.positions)[1]

        expect(Cartesian3.equals(firstMiddle, updatedMiddle)).toBe(false)
        expect(Cartesian3.equals(updatedMiddle, Cartesian3.fromDegrees(2.001, 48.002, 0))).toBe(true)
    })

    it('uses the dense replay camera guide for a smooth ground trace', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48, 140]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const smoothedGuide = [
            {progress: 0, longitude: 2, latitude: 48},
            {progress: 0.25, longitude: 2.00025, latitude: 48.0003},
            {progress: 0.5, longitude: 2.001, latitude: 48.001},
            {progress: 0.75, longitude: 2.00175, latitude: 48.0003},
            {progress: 1, longitude: 2.002, latitude: 48},
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

    it('converts a dense supplied guide once while keeping every frame and the final trace exact', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.01, 48.01, 130]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const guide = Array.from({length: 1000}, (_, index) => ({
            progress: index / 999,
            longitude: 2 + index / 99900,
            latitude: 48 + index / 99900,
        }))
        const renderer = new JourneyReplayCesiumRenderer()
        const fromDegrees = vi.spyOn(Cartesian3, 'fromDegrees')
        try {
            renderer.show({sampler, options: {smoothedGuide: guide}})
            for (let index = 0; index <= 100; index += 1) {
                renderer.update({
                    sample: sampler.atProgress(index / 100),
                    sampler,
                    forceGeometry: true,
                    syncCursorToTrace: true,
                    staticCompletedTrace: index === 100,
                })
            }
            // Coordinate conversions must grow with the route plus frames, not their product.
            expect(fromDegrees.mock.calls.length).toBeLessThan(guide.length + 101 * 5)
            const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
            const positions = propertyValue(completedFill?.polyline?.positions)
            expect(positions).toHaveLength(guide.length)
            expect(Cartesian3.equals(positions.at(-1), Cartesian3.fromDegrees(2.01, 48.01, 0))).toBe(true)
        } finally {
            fromDegrees.mockRestore()
            renderer.clear()
        }
    })

    it('refreshes cached guide positions when show reinstalls an edited guide and after clear', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const journey = makeJourney([
            makeTrack({slug: 'track#journey#gpx#main', coordinates: [[2, 48, 120], [2.01, 48.01, 130]]}),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const guide = [{progress: 0, longitude: 2, latitude: 48}, {progress: 1, longitude: 2.01, latitude: 48.01}]
        const renderer = new JourneyReplayCesiumRenderer()
        /** Read the static endpoint after reinstalling the same guide object. */
        const renderEnd = () => {
            renderer.show({sampler, options: {smoothedGuide: guide}})
            renderer.update({sample: sampler.atProgress(1), sampler, forceGeometry: true, staticCompletedTrace: true})
            return propertyValue(replayEntity(dataSources, '#completed#smoothed#fill')?.polyline?.positions).at(-1)
        }
        try {
            expect(Cartesian3.equals(renderEnd(), Cartesian3.fromDegrees(2.01, 48.01, 0))).toBe(true)
            guide[1].latitude = 48.02
            expect(Cartesian3.equals(renderEnd(), Cartesian3.fromDegrees(2.01, 48.02, 0))).toBe(true)
            renderer.clear()
            guide[1].latitude = 48.03
            expect(Cartesian3.equals(renderEnd(), Cartesian3.fromDegrees(2.01, 48.03, 0))).toBe(true)
        } finally {
            renderer.clear()
        }
    })

    it('keeps the final point in the live replay trace', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        installReplayGlobals({dataSources, replay})
        globalThis.lgs.stores.replay.playing = true
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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

    it('allows dry-run geometry through the interactive playback thresholds', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        globalThis.lgs.stores.replay.playing = true
        const completedSegmentsAt = vi.fn(() => [])
        const remainingSegmentsAt = vi.fn(() => [])
        const sampler = {
            journey: {slug: 'journey#gpx', tracks: new Map()},
            samples: [],
            segments: [],
            totalDistance: 1000,
            completedSegmentsAt,
            remainingSegmentsAt,
        }
        const renderer = new JourneyReplayCesiumRenderer()
        const initialSample = {
            longitude: 2,
            latitude: 48,
            progress: 0.1,
            distanceFromStart: 100,
        }
        renderer.show({sampler})
        renderer.update({sample: initialSample, sampler, forceGeometry: true})
        const performanceNow = vi.spyOn(globalThis.performance, 'now').mockReturnValue(100)

        renderer.update({sample: initialSample, sampler, allowPlaybackGeometryUpdate: true})
        const geometryUpdateCount = completedSegmentsAt.mock.calls.length
        renderer.update({
            sample: {...initialSample, progress: 0.101, distanceFromStart: 101},
            sampler,
            allowPlaybackGeometryUpdate: true,
        })

        expect(geometryUpdateCount).toBeGreaterThan(0)
        expect(completedSegmentsAt).toHaveBeenCalledTimes(geometryUpdateCount)

        renderer.update({
            sample: {...initialSample, progress: 0.102, distanceFromStart: 102},
            sampler,
        })
        expect(completedSegmentsAt).toHaveBeenCalledTimes(geometryUpdateCount)

        renderer.update({
            sample: {...initialSample, progress: 0.102, distanceFromStart: 102},
            sampler,
            forceGeometry: true,
        })
        expect(completedSegmentsAt).toHaveBeenCalledTimes(geometryUpdateCount + 1)
        performanceNow.mockRestore()
    })

    it('keeps the marker aligned when Cesium evaluates it before the completed trace', () => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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
        const completedBorder = replayEntity(dataSources, '#completed#smoothed#border')
        const initialTraceEnd = propertyValue(completedFill?.polyline?.positions).at(-1)

        renderer.update({sample: sampler.atProgress(0.5), sampler, syncCursorToTrace: true})

        const cursor = replayEntity(dataSources, '#cursor')
        const cursorBeforeTraceRender = propertyValue(cursor?.position)
        const tracePositions = propertyValue(completedFill?.polyline?.positions)
        const borderPositions = propertyValue(completedBorder?.polyline?.positions)
        const traceEnd = tracePositions.at(-1)
        const cursorAfterTraceRender = propertyValue(cursor?.position)
        const cursorSize = propertyValue(replayEntity(dataSources, '#cursor')?.point?.pixelSize)

        expect(Cartesian3.equals(cursorBeforeTraceRender, initialTraceEnd)).toBe(false)
        expect(Cartesian3.equals(cursorBeforeTraceRender, traceEnd)).toBe(true)
        expect(Cartesian3.equals(cursorAfterTraceRender, traceEnd)).toBe(true)
        expect(borderPositions).toBe(tracePositions)
        expect(replaySource(dataSources)?.entities.values.filter(entity => String(entity.id).endsWith('#cursor'))).toHaveLength(1)
        expect(Number.isFinite(cursorSize)).toBe(true)

        renderer.update({sample: sampler.atProgress(0.5001), sampler, syncCursorToTrace: true})

        const cursorWithinProgressStep = propertyValue(cursor?.position)
        const traceWithinProgressStep = propertyValue(completedFill?.polyline?.positions)
        expect(traceWithinProgressStep).toBe(tracePositions)
        expect(Cartesian3.equals(cursorWithinProgressStep, traceWithinProgressStep.at(-1))).toBe(true)
    })

    it.each([false, true])('keeps the completed trace empty at exact progress zero with recording sync %s', recordingSync => {
        const dataSources = makeDataSources()
        installReplayGlobals({dataSources})
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.recordingSync = recordingSync
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.01, 48.01, 130]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()
        const smoothedGuide = [
            {longitude: 2, latitude: 48, progress: 0},
            {longitude: 2.01, latitude: 48.01, progress: 1},
        ]

        renderer.show({sampler, options: {smoothedGuide}})
        renderer.update({sample: sampler.atProgress(0), sampler, forceGeometry: true, showTrace: true})

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        expect(propertyValue(completedFill?.polyline?.positions)).toEqual([])

        renderer.update({sample: sampler.atProgress(0.1), sampler, forceGeometry: true, showTrace: true})

        const positions = propertyValue(completedFill?.polyline?.positions)
        expect(positions).toHaveLength(2)
        expect(Cartesian3.equals(positions[0], Cartesian3.fromDegrees(2, 48, 0))).toBe(true)
        expect(Cartesian3.equals(positions[1], Cartesian3.fromDegrees(2.001, 48.001, 0))).toBe(true)
    })

    it('keeps the complete point set for the Interactive trace', () => {
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

    it('uniformly keeps at most 4096 trace points and preserves both endpoints', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'expert'
        installReplayGlobals({dataSources, replay})
        const coordinates = Array.from({length: 8192}, (_, index) => [2 + (index * 0.00001), 48 + (index * 0.00001), 120])
        const journey = makeJourney([makeTrack({slug: 'track#journey#gpx#main', coordinates})])
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({sample: sampler.atProgress(1), sampler, forceGeometry: true, showTrace: true})

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const positions = propertyValue(completedFill?.polyline?.positions)
        expect(positions).toHaveLength(4096)
        expect(Cartesian3.equals(positions[0], Cartesian3.fromDegrees(coordinates[0][0], coordinates[0][1], 0))).toBe(true)
        expect(Cartesian3.equals(positions.at(-1), Cartesian3.fromDegrees(coordinates.at(-1)[0], coordinates.at(-1)[1], 0))).toBe(true)
    })

    it('caps partial replay geometry without copying the full completed prefix', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'expert'
        installReplayGlobals({dataSources, replay})
        globalThis.lgs.stores.replay.recordingSync = true
        const coordinates = Array.from({length: 8192}, (_, index) => [2 + (index * 0.00001), 48 + (index * 0.00001), 120])
        const journey = makeJourney([makeTrack({slug: 'track#journey#gpx#main', coordinates})])
        const sampler = new JourneyReplayPathSampler({journey})
        const sample = sampler.atProgress(0.75)
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({sample, sampler, forceGeometry: true, showTrace: true})

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const positions = propertyValue(completedFill?.polyline?.positions)
        expect(positions).toHaveLength(4096)
        expect(Cartesian3.equals(
            positions.at(-1),
            Cartesian3.fromDegrees(sample.longitude, sample.latitude, 0),
        )).toBe(true)
    })

    it.each([1024, 2048, 4096])('renders the Basic Replay Journey sample budget of %i points', sampleCount => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.basic = {sampleCount: 1024}
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
                coordinates: Array.from({length: 8192}, (_, index) => [2 + (index * 0.00001), 48 + (index * 0.00001), 120]),
            }),
        ])
        journey.replay = {basic: {sampleCount}}
        globalThis.lgs.theJourney = journey
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({sample: sampler.atProgress(1), sampler, forceGeometry: true, showTrace: true})

        const completedFill = replayEntity(dataSources, '#completed#smoothed#fill')
        const positions = propertyValue(completedFill?.polyline?.positions)
        expect(positions).toHaveLength(sampleCount)
        expect(Cartesian3.equals(positions[0], Cartesian3.fromDegrees(2, 48, 0))).toBe(true)
        expect(Cartesian3.equals(positions.at(-1), Cartesian3.fromDegrees(2 + (8191 * 0.00001), 48 + (8191 * 0.00001), 0))).toBe(true)
    })

    it('does not resurrect the remaining trace for stop clip frames', () => {
        const dataSources = makeDataSources()
        const replay = defaultJourneyReplaySettings()
        replay.userMode = 'expert'
        replay.trace = {
            ...replay.trace,
            mode: REPLAY_TRACE_MODE_FULL,
        }
        installReplayGlobals({dataSources, replay})
        const journey = makeJourney([
            makeTrack({
                slug: 'track#journey#gpx#main',
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
                slug: 'track#journey#gpx#main',
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
                slug: 'track#journey#gpx#main',
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
                slug: 'track#journey#gpx#main',
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
