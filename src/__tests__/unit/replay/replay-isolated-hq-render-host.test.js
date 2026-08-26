import {describe, expect, it, vi} from 'vitest'
import {PerspectiveFrustum} from 'cesium'

import {createReplayCameraCommand} from '@Core/ui/replay/ReplayCameraCommand'
import {IsolatedHqReplayRenderHost} from '@Core/ui/replay/IsolatedHqReplayRenderHost'
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

describe('IsolatedHqReplayRenderHost', () => {
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
        const host = new IsolatedHqReplayRenderHost({
            dimensions: {width: 1920, height: 1080},
            descriptor,
            container,
            createWidget: vi.fn(() => widget),
            createImageryLayer: vi.fn(provider => ({imageryProvider: provider, alpha: 1})),
            createTileset: vi.fn(() => ({id: 'isolated-tileset'})),
            createReadinessCoordinator: vi.fn(() => readiness),
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
        expect(primitives.add).toHaveBeenCalledWith({id: 'isolated-tileset'})

        host.destroy()

        expect(widget.destroy).toHaveBeenCalledOnce()
    })
})
