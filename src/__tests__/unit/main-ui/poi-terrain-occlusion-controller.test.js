/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-terrain-occlusion-controller.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {createPOITerrainOcclusionController} from '@Components/MainUI/MapPOI/poiTerrainOcclusionController'
import {isReplayPOIPresentationActive} from '@Core/ui/replay/JourneyReplayPOISettings'
import {acquireReplayExportRenderLoop} from '@Core/ui/replay/ReplayExportRenderLoop'
import {POIUtils} from '@Utils/cesium/POIUtils'
import {Cartesian3} from 'cesium'
import {afterEach, describe, expect, it, vi} from 'vitest'

/** Create a small event source with Cesium-compatible listener teardown. */
const createEvent = () => {
    const listeners = new Set()
    return {
        addEventListener: listener => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        raiseEvent: (...arguments_) => listeners.forEach(listener => listener(...arguments_)),
        get numberOfListeners() {
            return listeners.size
        },
    }
}

/** Build a terrain scene whose focus depth can be changed between camera frames. */
const createTerrainScene = () => {
    let terrainPosition = Cartesian3.fromDegrees(2, 48, 10)
    const scene = {
        camera: {
            positionWC: Cartesian3.fromDegrees(2, 48, 1000),
            getPickRay: vi.fn(() => ({})),
            changed: createEvent(),
        },
        canvas: {clientWidth: 100, clientHeight: 100},
        cartesianToCanvasCoordinates: (_position, result) => {
            result.x = 50
            result.y = 50
            return result
        },
        globe: {
            show: true,
            getHeight: () => 0,
            pick: () => terrainPosition,
            terrainProviderChanged: createEvent(),
            tileLoadProgressEvent: createEvent(),
        },
        preRender: createEvent(),
        postRender: createEvent(),
        requestRender: vi.fn(),
    }

    return {
        scene,
        setTerrainHeight: height => {
            terrainPosition = Cartesian3.fromDegrees(2, 48, height)
        },
    }
}

afterEach(() => {
    delete globalThis.lgs
})

describe('POI terrain occlusion controller', () => {
    it('captures current terrain masks without camera events and consumes masks changed during rendering', () => {
        const {scene, setTerrainHeight} = createTerrainScene()
        const entity = {id: 'record-poi', show: true, billboard: {show: true, image: {}}}
        const poi = {id: entity.id, longitude: 2, latitude: 48, height: 0, visible: true, expanded: true}
        const drawnVisibility = []
        let loadTerrainDuringDraw = false
        const viewer = {
            scene,
            entities: {getById: id => id === poi.id ? entity : null},
            useDefaultRenderLoop: true,
            render: () => {
                // Entity visualizers consume visibility before the scene starts drawing.
                const primitiveVisibility = entity.billboard.show
                scene.preRender.raiseEvent()
                drawnVisibility.push(primitiveVisibility)
                if (loadTerrainDuringDraw) {
                    loadTerrainDuringDraw = false
                    setTerrainHeight(10)
                    scene.globe.tileLoadProgressEvent.raiseEvent(0)
                }
                scene.postRender.raiseEvent()
            },
        }
        globalThis.lgs = {viewer}
        const controller = createPOITerrainOcclusionController({
            scene, poiList: new Map([[poi.id, poi]]), isReplayActive: () => true,
        })
        const loop = acquireReplayExportRenderLoop({viewer, scene})
        try {
            setTerrainHeight(-10)
            loop.render()
            expect(drawnVisibility).toEqual([true])

            // Fixed-frame camera changes need not raise Cesium's threshold-based changed event.
            setTerrainHeight(10)
            loop.render()
            expect(drawnVisibility).toEqual([true, false])

            setTerrainHeight(-10)
            loadTerrainDuringDraw = true
            loop.render()
            expect(drawnVisibility).toEqual([true, false, true, false])
            expect(entity.billboard.show).toBe(false)
        }
        finally {
            loop.release()
            controller.dispose()
        }
        const renderCount = drawnVisibility.length
        const nextLoop = acquireReplayExportRenderLoop({viewer, scene})
        nextLoop.render()
        nextLoop.release()
        expect(drawnVisibility).toHaveLength(renderCount + 1)
        expect(drawnVisibility.at(-1)).toBe(true)
        expect(viewer.useDefaultRenderLoop).toBe(true)
    })

    it('rechecks terrain visibility on camera rotation without replacing the POI image', () => {
        const {scene, setTerrainHeight} = createTerrainScene()
        const canvas = {}
        const entity = {
            id: 'poi-rotation',
            show: true,
            billboard: {show: true, image: canvas},
        }
        const poi = {id: entity.id, longitude: 2, latitude: 48, height: 0, visible: true}
        const entities = new Map([[entity.id, entity]])
        globalThis.lgs = {viewer: {entities: {getById: id => entities.get(id)}}}
        const controller = createPOITerrainOcclusionController({
            scene,
            poiList: new Map([[poi.id, poi]]),
            isReplayActive: () => false,
        })

        scene.postRender.raiseEvent()
        expect(entity.billboard.show).toBe(false)
        expect(POIUtils.updateVisibility(poi, true)).toBe(true)
        expect(entity.billboard.show).toBe(false)
        expect(entity.billboard.image).toBe(canvas)

        setTerrainHeight(-10)
        scene.camera.changed.raiseEvent(0.25)
        scene.postRender.raiseEvent()
        expect(entity.billboard.show).toBe(true)
        expect(entity.billboard.image).toBe(canvas)

        for (let turn = 0; turn < 8; turn += 1) {
            scene.camera.changed.raiseEvent(0.25)
            scene.postRender.raiseEvent()
        }

        expect(entity.billboard.show).toBe(true)
        expect(entity.billboard.image).toBe(canvas)

        setTerrainHeight(10)
        scene.globe.terrainProviderChanged.raiseEvent({provider: 'updated'})
        scene.postRender.raiseEvent()
        expect(entity.billboard.show).toBe(false)
        expect(entity.billboard.image).toBe(canvas)

        setTerrainHeight(-10)
        scene.globe.tileLoadProgressEvent.raiseEvent(0)
        scene.postRender.raiseEvent()
        expect(entity.billboard.show).toBe(true)
        expect(entity.billboard.image).toBe(canvas)

        controller.dispose()
        expect(scene.camera.changed.numberOfListeners).toBe(0)
        expect(scene.globe.terrainProviderChanged.numberOfListeners).toBe(0)
        expect(scene.postRender.numberOfListeners).toBe(0)
    })

    it('masks Replay-visible POIs even when their persisted map visibility is disabled', () => {
        const {scene, setTerrainHeight} = createTerrainScene()
        const entity = {
            id: 'poi-replay-visible',
            show: true,
            billboard: {show: true, image: {}},
        }
        const poi = {id: entity.id, longitude: 2, latitude: 48, height: 0, visible: false}
        const entities = new Map([[entity.id, entity]])
        const replay = {active: true}
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'basic'}}},
            stores: {replay},
            viewer: {entities: {getById: id => entities.get(id)}},
        }
        const controller = createPOITerrainOcclusionController({
            scene,
            poiList: new Map([[poi.id, poi]]),
            isReplayActive: () => isReplayPOIPresentationActive(replay),
        })

        scene.postRender.raiseEvent()
        expect(entity.billboard.show).toBe(false)

        setTerrainHeight(-10)
        scene.camera.changed.raiseEvent(0.25)
        scene.postRender.raiseEvent()
        expect(entity.billboard.show).toBe(true)

        controller.dispose()
    })

    it('preserves Replay-hidden POIs when restoring a terrain mask', () => {
        const {scene} = createTerrainScene()
        const entity = {
            id: 'poi-replay-hidden',
            show: true,
            billboard: {show: true, image: {}},
        }
        const poi = {id: entity.id, longitude: 2, latitude: 48, height: 0, visible: true}
        const entities = new Map([[entity.id, entity]])
        globalThis.lgs = {viewer: {entities: {getById: id => entities.get(id)}}}
        const controller = createPOITerrainOcclusionController({
            scene,
            poiList: new Map([[poi.id, poi]]),
            isReplayActive: () => true,
        })

        scene.postRender.raiseEvent()
        expect(entity.billboard.show).toBe(false)

        entity.show = false
        entity.billboard.show = false
        controller.dispose()

        expect(entity.show).toBe(false)
        expect(entity.billboard.show).toBe(false)
    })
})
