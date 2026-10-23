/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-cesium-trace-caps.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {JourneyReplayCesiumRenderer} from '@Core/ui/replay/JourneyReplayCesiumRenderer'
import {JourneyReplayPathSampler} from '@Core/ui/replay/JourneyReplayPathSampler'
import {defaultJourneyReplaySettings} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {Cartesian2, Cartesian3, HeightReference, HorizontalOrigin, VerticalOrigin} from 'cesium'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Utils/cesium/TrackUtils', () => ({
    TrackUtils: {
        getTrackRenderStyle: vi.fn(() => null),
        createTrackMaterial: vi.fn(() => null),
    },
}))

/** Create a viewer data source collection for Replay rendering tests. */
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

/** Resolve a Cesium property to the value used by a renderer test. */
const propertyValue = property => typeof property?.getValue === 'function' ? property.getValue() : property

/** Create a small test journey with a deterministic ground trace. */
const makeJourney = () => {
    const track = {
        slug: 'track#journey#gpx#main',
        visible: true,
        metrics: {},
        content: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130], [2.002, 48.002, 140], [2.003, 48.003, 150]],
            },
        },
    }

    return {
        slug: 'journey#gpx',
        tracks: new Map([[track.slug, track]]),
    }
}

/** Install the Replay and viewer globals consumed by the Cesium renderer. */
const installReplayGlobals = dataSources => {
    const replay = defaultJourneyReplaySettings()
    replay.userMode = 'expert'
    globalThis.lgs = {
        settings: {ui: {replay}},
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
            scene: {
                canvas: {height: 1000},
                cartesianToCanvasCoordinates: position => new Cartesian2(position.x, position.y),
            },
        },
        scene: {
            canvas: {height: 1000},
            cartesianToCanvasCoordinates: position => new Cartesian2(position.x, position.y),
            requestRender: vi.fn(),
        },
    }
    return replay
}

describe('JourneyReplayCesiumRenderer trace endpoint caps', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        delete globalThis.lgs
        delete globalThis.__lgsReplayVideoTrace
        delete globalThis.__lgsReplayVideoTraceConsole
    })

    it('keeps the active Replay caps aligned with the dynamic trace and freezes them at completion', () => {
        const dataSources = makeDataSources()
        const replay = installReplayGlobals(dataSources)
        const journey = makeJourney()
        const sampler = new JourneyReplayPathSampler({journey})
        const renderer = new JourneyReplayCesiumRenderer()

        renderer.show({sampler})
        renderer.update({sample: sampler.atProgress(0.4), sampler, forceGeometry: true})

        const source = dataSources.getByName('replay#journey#gpx')[0]
        const border = source.entities.values.find(entity => String(entity.id).endsWith('#completed#smoothed#border'))
        const startCap = source.entities.values.find(entity => String(entity.id).endsWith('#completed#smoothed#border#cap-start'))
        const endCap = source.entities.values.find(entity => String(entity.id).endsWith('#completed#smoothed#border#cap-end'))

        expect(startCap).toBeTruthy()
        expect(endCap).toBeTruthy()
        expect(startCap.billboard.width.getValue()).toBe(propertyValue(border.polyline.width) / 2)
        expect(startCap.billboard.height.getValue()).toBe(propertyValue(border.polyline.width))
        expect(startCap.billboard.heightReference.getValue()).toBe(HeightReference.CLAMP_TO_GROUND)
        expect(startCap.billboard.horizontalOrigin.getValue()).toBe(HorizontalOrigin.LEFT)
        expect(startCap.billboard.verticalOrigin.getValue()).toBe(VerticalOrigin.CENTER)
        expect(decodeURIComponent(startCap.billboard.image.getValue())).toContain('A 64 64 0 0 1 0 128 Z')
        expect(Number.isFinite(endCap.billboard.rotation.getValue())).toBe(true)
        const dynamicEndPosition = endCap.position.getValue()
        const dynamicLineEnd = border.polyline.positions.getValue().at(-1)
        expect(Cartesian3.equals(dynamicEndPosition, dynamicLineEnd)).toBe(true)

        renderer.update({sample: sampler.atProgress(0.7), sampler, forceGeometry: true, freezeDynamic: true})

        const frozenBorder = source.entities.values.find(entity => String(entity.id).endsWith('#completed#smoothed#border'))
        const frozenEndCap = source.entities.values.find(entity => String(entity.id).endsWith('#completed#smoothed#border#cap-end'))
        const frozenPositions = frozenBorder.polyline.positions.getValue()
        expect(frozenBorder.polyline.positions.isConstant).toBe(true)
        expect(Cartesian3.equals(frozenEndCap.position.getValue(), frozenPositions.at(-1))).toBe(true)

        renderer.update({sample: sampler.atProgress(1), sampler, forceGeometry: true, staticCompletedTrace: true})

        const completedBorder = source.entities.values.find(entity => String(entity.id).endsWith('#completed#smoothed#border'))
        const completedStartCap = source.entities.values.find(entity => String(entity.id).endsWith('#completed#smoothed#border#cap-start'))
        const completedEndCap = source.entities.values.find(entity => String(entity.id).endsWith('#completed#smoothed#border#cap-end'))
        const completedPositions = completedBorder.polyline.positions.getValue()

        expect(Cartesian3.equals(completedStartCap.position.getValue(), completedPositions[0])).toBe(true)
        expect(Cartesian3.equals(completedEndCap.position.getValue(), completedPositions.at(-1))).toBe(true)
        expect(decodeURIComponent(completedEndCap.billboard.image.getValue())).toContain('A 64 64 0 0 1 0 128 Z')
        expect(completedStartCap.show).toBe(true)
        expect(completedEndCap.show).toBe(true)

        renderer.clear()
        expect(dataSources.getByName('replay#journey#gpx')).toHaveLength(0)
        expect(replay.progression.border.width).toBeGreaterThan(0)
    })
})
