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
 * Last modified: 2026-11-07
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

    it('lists additional active Cesium resources that isolated rendering cannot reproduce', () => {
        const baseTileset = {root: {}, maximumScreenSpaceError: 16}
        const additionalTileset = {root: {}, maximumScreenSpaceError: 16}
        const unsupportedPrimitive = {show: true}
        const previousLgs = globalThis.lgs
        globalThis.lgs = {base3dTileset: baseTileset}
        try {
            const descriptor = captureReplaySceneDescriptor({
                viewer: {
                    terrainProvider: null,
                    imageryLayers: createCollection([]),
                    dataSources: createCollection([
                        {name: 'journey-track'},
                        {name: 'replay#journey-a'},
                    ]),
                    entities: {values: [{id: 'external-entity'}]},
                    scene: {
                        primitives: createCollection([baseTileset, additionalTileset, unsupportedPrimitive]),
                        globe: {},
                        fog: {},
                    },
                },
                base3dDefinition: {assetId: 1},
            })

            expect(descriptor.compatibilityLimitations).toEqual([
                '2 additional Cesium scene primitive(s) or tileset(s)',
                '1 non-Replay Cesium data source(s)',
                '1 viewer-owned Cesium entity',
            ])
        }
        finally {
            globalThis.lgs = previousLgs
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
        expect(createTileset).toHaveBeenCalledWith(descriptor.base3dDefinition, {
            maximumScreenSpaceError: 4,
        })
        expect(rendered.canvasDimensions.actual).toMatchObject({width: 1920, height: 1080})

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
            'Native Replay rendering cannot reproduce this scene: one additional Cesium primitive',
        )
        expect(createWidget).not.toHaveBeenCalled()
    })
})
