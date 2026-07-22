/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: camera-manager-orbit.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-13
 * Last modified: 2026-07-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { Cartesian3 }    from 'cesium'
import { CameraManager } from '@Core/ui/CameraManager'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error: vi.fn(),
    },
}))

const installCameraManagerGlobals = () => {
    const animationFrames = []
    const rotate = proxy({
                             direction: 1,
                             heightAdjustmentUntil: 0,
                             heightOffset: 0,
                             rpm:       1,
                             running:   false,
                             target:    null,
                         })

    vi.stubGlobal('lgs', {
        camera: {
            changed: {addEventListener: vi.fn()},
            heading: 0.2,
            inverseTransform: {},
            lookAtTransform: vi.fn(),
            orbitalPercentageChanged: 0,
            percentageChanged: 0,
            pitch: -0.5,
            position: new Cartesian3(1000, 2000, 3000),
            positionCartographic: {
                height:    1200,
                latitude:  0.8,
                longitude: 0.1,
            },
            rotateLeft:  vi.fn(),
            rotateRight: vi.fn(),
            transform:   {},
        },
        colors: {},
        configuration: {
            db: {IDBDelay: 1},
        },
        db: {
            lgs1920: {
                get: vi.fn(async () => null),
                put: vi.fn(),
            },
        },
        scene: {
            cartesianToCanvasCoordinates: vi.fn(() => ({x: 0, y: 0})),
            requestRender: vi.fn(),
        },
        settings: {
            camera: {
                heading: 0,
                height:  1200,
                latitude: 0,
                longitude: 0,
                orbitalPercentageChanged: 0.01,
                percentageChanged: 0.01,
                pitch:   -30,
                range:   1000,
                roll:    0,
                rotations: 1,
            },
            starter: {
                height:    0,
                latitude:  0,
                longitude: 0,
            },
        },
        stores: {
            main: proxy({
                            components: {
                                camera: {
                                    position: {
                                        heading: 0.2,
                                        pitch:   -0.5,
                                        range:   1000,
                                        roll:    0,
                                    },
                                    target: {},
                                },
                            },
                        }),
            ui: proxy({
                          mainUI: {
                              cameraFlight: {running: false},
                              panorama:     {active: false, target: null},
                              rotate,
                          },
                      }),
        },
        viewer: null,
    })

    vi.stubGlobal('__', {
        app: {
            isEmpty: vi.fn(value => !value || Object.keys(value).length === 0),
        },
        cancelAnimationFrame: vi.fn(),
        requestAnimationFrame: vi.fn(callback => {
            animationFrames.push(callback)
            return animationFrames.length
        }),
        ui: {
            css: {
                setCSSVariable: vi.fn(),
            },
            sceneManager: {
                get startRotate() {
                    rotate.running = true
                    return true
                },
                get stopRotate() {
                    rotate.running = false
                    return false
                },
            },
        },
    })

    return {animationFrames, rotate}
}

const orbitTarget = {
    height: 100,
    latitude: 45,
    longitude: 5,
}

describe('CameraManager orbit', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        CameraManager.instance = null
    })

    afterEach(() => {
        CameraManager.instance = null
        vi.unstubAllGlobals()
    })

    it('does not reapply a height transform when orbit height is unchanged', async () => {
        const {animationFrames} = installCameraManagerGlobals()
        const manager = new CameraManager()
        manager.proxy = {
            getTargetPositionInPixels: vi.fn(() => null),
            setOrbitTransform: vi.fn(),
            unlock: vi.fn(),
        }

        await manager.rotateAround(orbitTarget, {
            direction: 1,
            infinite:  true,
            preserveView: true,
            rpm:       1,
        })
        animationFrames[0]()

        expect(lgs.camera.rotateRight).toHaveBeenCalled()
        expect(lgs.camera.lookAtTransform).not.toHaveBeenCalled()
    })

    it('applies a height transform once when orbit height changes', async () => {
        const {animationFrames, rotate} = installCameraManagerGlobals()
        const manager = new CameraManager()
        manager.proxy = {
            getTargetPositionInPixels: vi.fn(() => null),
            setOrbitTransform: vi.fn(),
            unlock: vi.fn(),
        }

        await manager.rotateAround(orbitTarget, {
            direction: 1,
            infinite:  true,
            preserveView: true,
            rpm:       1,
        })
        rotate.heightOffset = 100
        animationFrames[0]()
        animationFrames[1]()

        expect(lgs.camera.lookAtTransform).toHaveBeenCalledTimes(1)
    })
})
