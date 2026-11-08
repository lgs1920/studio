/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-isolated-render-host.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-11-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {PerspectiveFrustum} from 'cesium'

import {createReplayCameraCommand} from '@Core/ui/replay/ReplayCameraCommand'
import {IsolatedReplayRenderHost} from '@Core/ui/replay/IsolatedReplayRenderHost'
import {captureReplayCropProjection} from '@Core/ui/replay/ReplayCropFrustum'
import {captureReplaySceneDescriptor} from '@Core/ui/replay/ReplaySceneDescriptor'

/**
 * Build a collection fixture matching the Cesium collection contract.
 *
 * @param {Array<*>} values - Collection values.
 * @returns {Object} Cesium collection fixture.
 */
const createCollection = values => ({
    length: values.length,
    get: index => values[index],
})

describe('IsolatedReplayRenderHost', () => {
    it('captures providers and display settings without sharing live imagery layers', () => {
        const provider = {id: 'imagery-provider'}
        const sourceLayer = {imageryProvider: provider, alpha: 0.4, show: true}
        const descriptor = captureReplaySceneDescriptor({
            viewer: {
                terrainProvider: {id: 'terrain'},
                imageryLayers: createCollection([sourceLayer]),
                scene: {
                    mode: 3,
                    mapProjection: {id: 'projection'},
                    shadows: true,
                    backgroundColor: null,
                    globe: {show: true, depthTestAgainstTerrain: true, enableLighting: false},
                    fog: {enabled: true, renderable: true, density: 0.001},
                },
            },
        })

        expect(descriptor.imageryLayers[0]).not.toBe(sourceLayer)
        expect(descriptor.imageryLayers[0].imageryProvider).toBe(provider)
        expect(descriptor.imageryLayers[0].display).toMatchObject({alpha: 0.4, show: true})
    })

    it('uses an integer 1:1 CSS target when a portrait crop implies fractional viewport dimensions', async () => {
        const container = {
            dataset: {},
            style: {},
            setAttribute: vi.fn(),
            remove: vi.fn(),
        }
        vi.stubGlobal('document', {
            createElement: vi.fn(() => container),
            body: {append: vi.fn()},
        })
        const widget = {
            canvas: {width: 2160, height: 3840, addEventListener: vi.fn()},
            scene: {
                drawingBufferWidth: 2160,
                drawingBufferHeight: 3840,
                primitives: {add: vi.fn()},
                screenSpaceCameraController: {},
                globe: {},
                fog: {},
            },
            imageryLayers: {add: vi.fn()},
            resize: vi.fn(),
            render: vi.fn(),
            destroy: vi.fn(),
            isDestroyed: vi.fn(() => false),
        }
        const host = new IsolatedReplayRenderHost({
            dimensions: {width: 2160, height: 3840},
            viewportDimensions: {width: 674.446, height: 1199.001},
            descriptor: {sceneMode: 3, imageryLayers: [], environment: {}, compatibilityLimitations: []},
            createWidget: vi.fn(() => widget),
            createReadinessCoordinator: vi.fn(() => ({})),
        })

        try {
            await host.initialize()
            expect(container.style).toMatchObject({width: '2160px', height: '3840px'})
            expect(widget.resolutionScale).toBe(1)
            expect(host.renderTarget().viewportDimensions).toEqual({width: 674.446, height: 1199.001})
        }
        finally {
            host.destroy()
            vi.unstubAllGlobals()
        }
    })

    it('reconstructs Studio POIs and ignores hidden tracks and Cesium entity visualizers', () => {
        class Cesium3DTileset {}
        class GeoJsonPrimitive {}
        class BillboardCollection {}
        class EntityCluster {}
        class PrimitiveCollection {
            constructor(children) {
                this.length = children.length
                this.children = children
                this.show = true
            }

            get = index => this.children[index]
        }

        const baseTileset = Object.assign(new Cesium3DTileset(), {root: {}, maximumScreenSpaceError: 16})
        const poiModels = Array.from({length: 48}, (_value, index) => ({
            id: `poi-${index}`,
            name: `POI ${index}`,
            longitude: 2 + index / 1000,
            latitude: 48,
            parent: null,
            visible: true,
            image: {src: `data:image/svg+xml,${index}`, width: 32, height: 32},
        }))
        class CanvasImage {}
        const firstPoiImage = new CanvasImage()
        Object.assign(firstPoiImage, {width: 88, height: 54})
        const poiEntities = poiModels.map((poi, index) => ({
            id: poi.id,
            show: true,
            billboard: index === 0
                ? {
                    show: true,
                    image: {getValue: () => firstPoiImage},
                    width: {getValue: () => 88},
                    height: {getValue: () => 54},
                    scale: {getValue: () => 1.25},
                    pixelOffset: {getValue: () => ({x: 5, y: -7})},
                }
                : {show: true},
        }))
        const poiMap = new Map(poiModels.map(poi => [poi.id, poi]))
        const journeys = Array.from({length: 13}, (_value, index) => {
            const slug = `journey-${index}#gpx`
            const track = {
                slug: `track#journey-${index}#gpx#track-${index}`,
                visible: true,
                content: {geometry: {type: 'LineString', coordinates: []}},
            }
            return {slug, type: 'gpx', visible: true, tracks: new Map([[track.slug, track]])}
        })
        const replayJourney = journeys[0]
        const dataSources = [
            ...journeys.map(journey => ({name: journey.slug, show: true})),
            ...journeys.flatMap((journey, index) => Array.from(journey.tracks.values()).map(track => ({
                name: track.slug,
                show: index === 0,
            }))),
        ]
        const hiddenTrackPrimitives = Array.from({length: 3}, () => Object.assign(new GeoJsonPrimitive(), {show: false}))
        const entityClusters = Array.from({length: 26}, () => new EntityCluster())
        const poiGeneratedCollection = new PrimitiveCollection([new BillboardCollection()])
        const previousLgs = globalThis.lgs
        const previousApp = globalThis.__
        globalThis.lgs = {
            base3dTileset: baseTileset,
            theTiles3DLayer: null,
            journeys: new Map(journeys.map(journey => [journey.slug, journey])),
            stores: {main: {
                theBase3DLayer: {id: 'base-layer', assetId: 1},
                theTiles3DLayer: null,
                theJourney: replayJourney,
            }},
            settings: {ui: {replay: {userMode: 'basic'}}},
        }
        globalThis.__ = {ui: {poiManager: {
            list: poiMap,
            getJourneyForPOI: () => null,
        }}}
        try {
            const descriptor = captureReplaySceneDescriptor({
                journey: replayJourney,
                viewer: {
                    terrainProvider: null,
                    imageryLayers: createCollection([]),
                    dataSources: createCollection(dataSources),
                    entities: {
                        values: poiEntities,
                        getById: id => poiEntities.find(entity => entity.id === id),
                    },
                    scene: {
                        primitives: createCollection([
                            baseTileset,
                            ...hiddenTrackPrimitives,
                            poiGeneratedCollection,
                            ...entityClusters,
                        ]),
                        globe: {},
                        fog: {},
                    },
                },
                base3dDefinition: globalThis.lgs.stores.main.theBase3DLayer,
            })

            expect(descriptor.compatibilityLimitations).toEqual([])
            expect(descriptor.poiDescriptors).toHaveLength(48)
            expect(descriptor.poiDescriptors[0].poi).not.toBe(poiModels[0])
            expect(descriptor.poiDescriptors[0]).toMatchObject({poi: {id: 'poi-0'}, visible: true, dataSourceName: null})
            expect(descriptor.poiDescriptors[0].poi.image.src).toBe(firstPoiImage)
            expect(descriptor.poiDescriptors[0].billboard).toMatchObject({
                width: 88,
                height: 54,
                scale: 1.25,
                pixelOffset: {x: 5, y: -7},
            })
            expect(descriptor.trackDescriptors).toEqual([])
            expect(descriptor.additional3dDefinitions).toEqual([])
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousApp
        }
    })

    it('reports unsupported visible primitives with their Cesium type', () => {
        class UnsupportedPrimitive {}
        const descriptor = captureReplaySceneDescriptor({
            viewer: {
                imageryLayers: createCollection([]),
                scene: {
                    primitives: createCollection([Object.assign(new UnsupportedPrimitive(), {show: true})]),
                    globe: {},
                    fog: {},
                },
            },
        })

        expect(descriptor.compatibilityLimitations).toContain(
            'required visible Cesium primitive(s) cannot be reconstructed: UnsupportedPrimitive',
        )
    })

    it('captures POI visibility after applying the Journey hide-other policy', () => {
        const poi = {
            id: 'poi-from-another-journey',
            longitude: 2,
            latitude: 48,
            parent: null,
            visible: true,
        }
        const entity = {id: poi.id, show: true, billboard: {show: true}}
        const previousLgs = globalThis.lgs
        const previousApp = globalThis.__
        globalThis.lgs = {
            theJourney: {slug: 'current-journey'},
            settings: {journey: {hideOtherJourneys: true}},
        }
        globalThis.__ = {ui: {poiManager: {
            list: new Map([[poi.id, poi]]),
            getJourneyForPOI: () => ({slug: 'other-journey'}),
        }}}

        try {
            const descriptor = captureReplaySceneDescriptor({
                viewer: {
                    entities: {values: [entity], getById: id => id === entity.id ? entity : undefined},
                    imageryLayers: createCollection([]),
                    dataSources: createCollection([]),
                    scene: {primitives: createCollection([]), globe: {}, fog: {}},
                },
            })

            expect(descriptor.poiDescriptors).toHaveLength(1)
            expect(descriptor.poiDescriptors[0].visible).toBe(false)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousApp
        }
    })

    it('snapshots visible tracks from other Journeys when Replay allows them', () => {
        const currentJourney = {slug: 'current#gpx', tracks: new Map()}
        const backgroundTrack = {
            slug: 'track#background#gpx#ridge',
            parent: 'background#gpx',
            visible: true,
            color: '#35aaff',
            thickness: 5,
            content: {
                type: 'Feature',
                geometry: {type: 'LineString', coordinates: [[2, 48, 100], [2.1, 48.1, 120]]},
                properties: {},
            },
        }
        const backgroundJourney = {
            slug: 'background#gpx',
            visible: true,
            tracks: new Map([[backgroundTrack.slug, backgroundTrack]]),
        }
        const previousLgs = globalThis.lgs
        const previousApp = globalThis.__
        globalThis.lgs = {
            journeys: new Map([[currentJourney.slug, currentJourney], [backgroundJourney.slug, backgroundJourney]]),
            settings: {ui: {replay: {userMode: 'expert', inheritHideOtherJourneys: false, hideOtherJourneys: false}}},
            stores: {main: {theJourney: currentJourney}},
        }
        globalThis.__ = undefined

        try {
            const trackSource = {name: backgroundTrack.slug, show: true}
            const dataSources = {
                length: 1,
                get: index => index === 0 ? trackSource : undefined,
                getByName: name => name === backgroundTrack.slug ? [trackSource] : [],
            }
            const descriptor = captureReplaySceneDescriptor({
                journey: currentJourney,
                viewer: {
                    dataSources,
                    imageryLayers: createCollection([]),
                    scene: {primitives: createCollection([]), globe: {}, fog: {}},
                },
            })

            expect(descriptor.trackDescriptors).toHaveLength(1)
            expect(descriptor.trackDescriptors[0]).toMatchObject({
                slug: backgroundTrack.slug,
                content: {geometry: {type: 'LineString', coordinates: [[2, 48, 100], [2.1, 48.1, 120]]}},
                style: {color: '#35aaff', farPixelWidth: 5},
            })
            expect(descriptor.compatibilityLimitations).toEqual([])
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousApp
        }
    })

    it('renders with an independent camera and destroys every owned resource', async () => {
        const interactiveCamera = {setView: vi.fn()}
        const cropProjection = captureReplayCropProjection({
            camera: {
                frustum: new PerspectiveFrustum({
                    fov:          Math.PI / 3,
                    aspectRatio: 16 / 9,
                    near:         1,
                    far:          10000,
                }),
            },
            sourceViewportDimensions: {width: 1920, height: 1080},
            cropRect: {left: 100, top: 80, width: 960, height: 540},
        })
        const isolatedCamera = {
            lookAtTransform: vi.fn(),
            setView: vi.fn(),
        }
        const imageryLayers = {add: vi.fn()}
        const primitives = {add: vi.fn()}
        const readiness = {prepareForCapture: vi.fn(() => true), dispose: vi.fn()}
        const createTileset = vi.fn(() => ({id: 'isolated-tileset'}))
        const widget = {
            camera: isolatedCamera,
            canvas: {width: 1920, height: 1080},
            imageryLayers,
            scene: {
                camera: isolatedCamera,
                primitives,
                screenSpaceCameraController: {enableInputs: true},
                globe: {},
                fog: {},
            },
            resize: vi.fn(),
            render: vi.fn(),
            destroy: vi.fn(),
            isDestroyed: vi.fn(() => false),
        }
        const container = {style: {}, remove: vi.fn()}
        const descriptor = {
            sceneMode: 3,
            mapProjection: null,
            terrainProvider: {id: 'terrain'},
            imageryLayers: [{imageryProvider: {id: 'imagery'}, display: {alpha: 0.7}}],
            base3dDefinition: {id: 'tileset'},
            additional3dDefinitions: [{id: 'overlay-tileset'}],
            environment: {globe: {}, fog: {}},
        }
        const host = new IsolatedReplayRenderHost({
            dimensions: {width: 1920, height: 1080},
            descriptor,
            container,
            createWidget: vi.fn(() => widget),
            createImageryLayer: vi.fn(provider => ({imageryProvider: provider, alpha: 1})),
            createTileset,
            createReadinessCoordinator: vi.fn(() => readiness),
            maximumScreenSpaceError: 4,
            cropProjection,
        })
        const command = createReplayCameraCommand({
            pose: {
                target: {longitude: 2, latitude: 48, altitude: 100},
                heading: 0.4,
                pitch: -0.8,
                rangeMeters: 1000,
            },
        })

        await host.initialize()
        expect(isolatedCamera.frustum).toBeInstanceOf(PerspectiveFrustum)
        expect(isolatedCamera.frustum.aspectRatio).toBeCloseTo(16 / 9, 5)
        expect(isolatedCamera.frustum.xOffset).not.toBe(0)
        expect(isolatedCamera.frustum.yOffset).not.toBe(0)
        host.scene().screenSpaceCameraController.enableInputs = false
        const rendered = await host.renderFrame({
            intent: {id: 'intent-a', scene: {cameraCommand: command}},
            settled: true,
        })

        expect(rendered.appliedFrame.commandId).toBe(command.id)
        expect(isolatedCamera.setView).toHaveBeenCalledOnce()
        expect(interactiveCamera.setView).not.toHaveBeenCalled()
        expect(widget.render).toHaveBeenCalled()
        expect(widget.resize).toHaveBeenCalledOnce()
        expect(primitives.add).toHaveBeenCalledWith({id: 'isolated-tileset'})
        expect(createTileset).toHaveBeenNthCalledWith(1, descriptor.base3dDefinition, {
            maximumScreenSpaceError: 4,
        })
        expect(createTileset).toHaveBeenNthCalledWith(2, descriptor.additional3dDefinitions[0], {
            maximumScreenSpaceError: 4,
        })
        expect(createTileset).toHaveBeenCalledTimes(2)
        expect(createTileset).toHaveBeenCalledWith(descriptor.base3dDefinition, {
            maximumScreenSpaceError: 4,
        })
        expect(rendered.canvasDimensions.actual).toMatchObject({width: 1920, height: 1080})

        host.destroy()

        expect(widget.destroy).toHaveBeenCalledOnce()
    })

    it('rebuilds captured POIs and tracks on the isolated target', async () => {
        const registeredDataSources = []
        const dataSources = {
            add: vi.fn(async dataSource => {
                registeredDataSources.push(dataSource)
                return dataSource
            }),
            getByName: name => registeredDataSources.filter(dataSource => dataSource.name === name),
        }
        const trackEntity = {polyline: {positions: {getValue: () => []}}}
        const trackDataSource = {
            name: 'visible-track',
            entities: {
                values: [trackEntity],
                add: vi.fn(),
            },
        }
        const canvas = {width: 640, height: 360}
        const widget = {
            camera: {},
            canvas,
            dataSources,
            entities: {values: []},
            imageryLayers: {add: vi.fn()},
            scene: {
                drawingBufferWidth: 640,
                drawingBufferHeight: 360,
                primitives: {add: vi.fn()},
                screenSpaceCameraController: {},
                globe: {},
                fog: {},
            },
            resize: vi.fn(),
            render: vi.fn(),
            destroy: vi.fn(),
            isDestroyed: vi.fn(() => false),
        }
        const drawPOI = vi.fn(async poi => ({id: poi.id}))
        const host = new IsolatedReplayRenderHost({
            dimensions: {width: 640, height: 360},
            descriptor: {
                sceneMode: 3,
                imageryLayers: [],
                environment: {},
                compatibilityLimitations: [],
                poiDescriptors: [{
                    poi: {id: 'global-poi', longitude: 2, latitude: 48},
                    visible: true,
                    dataSourceName: null,
                }, {
                    poi: {id: 'journey-poi', longitude: 2.1, latitude: 48.1, parent: 'journey#gpx'},
                    visible: false,
                    dataSourceName: 'journey#gpx',
                    billboard: {width: 44, height: 36, scale: 1.5, pixelOffset: {x: 3, y: -5}},
                }],
                trackDescriptors: [{
                    slug: 'visible-track',
                    content: {type: 'FeatureCollection', features: []},
                    style: {
                        color: '#ff0000',
                        farPixelWidth: 3,
                        dash: {enabled: false},
                        underlay: {enabled: false},
                    },
                }],
            },
            container: {style: {}, remove: vi.fn()},
            createWidget: vi.fn(() => widget),
            createDataSource: vi.fn(name => ({name, entities: {}})),
            loadTrackDataSource: vi.fn(async () => trackDataSource),
            drawPOI,
            createReadinessCoordinator: vi.fn(() => ({prepareForCapture: vi.fn(() => true), dispose: vi.fn()})),
        })

        await host.initialize()

        expect(dataSources.add).toHaveBeenCalledTimes(2)
        expect(drawPOI).toHaveBeenCalledTimes(2)
        expect(drawPOI).toHaveBeenNthCalledWith(1, {id: 'global-poi', longitude: 2, latitude: 48}, expect.objectContaining({
            effectiveVisibility: true,
            renderTarget: expect.objectContaining({viewer: widget, scene: widget.scene}),
        }))
        expect(drawPOI).toHaveBeenNthCalledWith(2, expect.objectContaining({id: 'journey-poi'}), expect.objectContaining({
            effectiveVisibility: false,
            billboardOverrides: {width: 44, height: 36, scale: 1.5, pixelOffset: {x: 3, y: -5}},
        }))
        expect(trackEntity.polyline.width).toBe(3)
        expect(trackEntity.polyline.clampToGround).toBe(true)
        expect(dataSources.add).toHaveBeenLastCalledWith(trackDataSource)

        host.destroy()
        expect(widget.destroy).toHaveBeenCalledOnce()
    })

    it('rejects a lower-resolution Cesium drawing buffer instead of accepting an upscale', async () => {
        const widget = {
            camera: {setView: vi.fn()},
            canvas: {width: 1920, height: 1080},
            scene: {
                drawingBufferWidth: 1280,
                drawingBufferHeight: 720,
                primitives: {add: vi.fn()},
                screenSpaceCameraController: {},
            },
            imageryLayers: {add: vi.fn()},
            resize: vi.fn(),
            render: vi.fn(),
            destroy: vi.fn(),
            isDestroyed: vi.fn(() => false),
        }
        const host = new IsolatedReplayRenderHost({
            dimensions: {width: 1920, height: 1080},
            descriptor: {
                sceneMode: 3,
                imageryLayers: [],
                environment: {},
                compatibilityLimitations: [],
            },
            container: {style: {}, remove: vi.fn()},
            createWidget: vi.fn(() => widget),
        })

        await expect(host.initialize()).rejects.toThrow(
            'Native Replay rendering requested 1920 × 1080 pixels, but Cesium created 1280 × 720',
        )
        host.destroy()
        expect(widget.destroy).toHaveBeenCalledOnce()
    })

    it('reports unsupported active scene content before allocating a WebGL host', async () => {
        const createWidget = vi.fn()
        const host = new IsolatedReplayRenderHost({
            dimensions: {width: 1920, height: 1080},
            descriptor: {
                compatibilityLimitations: ['one additional Cesium primitive'],
            },
            container: {style: {}, remove: vi.fn()},
            createWidget,
        })

        await expect(host.initialize()).rejects.toThrow(
            'Native HQ cannot reconstruct required visible scene content: one additional Cesium primitive',
        )
        expect(createWidget).not.toHaveBeenCalled()
    })

    it('fails a pending capture on WebGL context loss and disposes the readiness listener', async () => {
        const canvas = new EventTarget()
        canvas.width = 320
        canvas.height = 180
        canvas.getContext = vi.fn(() => null)
        const removeEventListener = vi.spyOn(canvas, 'removeEventListener')
        const readiness = {
            prepareForCapture: vi.fn(() => new Promise(() => {})),
            dispose: vi.fn(),
        }
        const widget = {
            camera: {setView: vi.fn()},
            canvas,
            scene: {
                drawingBufferWidth: 320,
                drawingBufferHeight: 180,
                primitives: {add: vi.fn()},
                screenSpaceCameraController: {},
            },
            imageryLayers: {add: vi.fn()},
            resize: vi.fn(),
            render: vi.fn(),
            destroy: vi.fn(),
            isDestroyed: vi.fn(() => false),
        }
        const host = new IsolatedReplayRenderHost({
            dimensions: {width: 320, height: 180},
            descriptor: {sceneMode: 3, imageryLayers: [], environment: {}, compatibilityLimitations: []},
            container: {style: {}, remove: vi.fn()},
            createWidget: vi.fn(() => widget),
            createReadinessCoordinator: vi.fn(() => readiness),
        })

        await host.initialize()
        const pendingCapture = host.prepareForCapture()
        canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true}))
        await expect(pendingCapture).rejects.toThrow('WebGL context was lost during export')

        host.destroy()
        expect(readiness.dispose).toHaveBeenCalledOnce()
        expect(widget.destroy).toHaveBeenCalledOnce()
        expect(removeEventListener).toHaveBeenCalledWith('webglcontextlost', expect.any(Function))
    })
})
