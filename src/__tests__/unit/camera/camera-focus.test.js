/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: camera-focus.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-05-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DEFAULT_2D_FOCUS_PITCH, SCENE_MODE_2D } from '@Core/constants'
import { CameraUtils }                           from '@Utils/cesium/CameraUtils'
import { SceneUtils }                            from '@Utils/cesium/SceneUtils'
import * as CameraPath                           from '@Core/ui/replay/JourneyReplayCameraPath'
import { Cartesian3, Math as M, SceneMode }      from 'cesium'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lineFeature = coordinates => ({
    type:       'Feature',
    properties: {name: 'Track'},
    geometry:   {
        type: 'LineString',
        coordinates,
    },
})

const makeJourney = () => ({
    slug:   'journey-a',
    tracks: new Map([
                        ['track-a', {
                            slug:    'track-a',
                            content: lineFeature([[0, 0, 0], [0.1, 0.1, 0]]),
                        }],
                        ['track-b', {
                            slug:    'track-b',
                            content: lineFeature([[1, 1, 0], [1.1, 1.1, 0]]),
                        }],
                    ]),
})

const installFocusGlobals = journey => {
    vi.stubGlobal('lgs', {
        theJourney: journey,
        journeys:   new Map([[journey.slug, journey]]),
        colors:     {
            poiDefault:           '#fff',
            poiDefaultBackground: '#000',
        },
        settings:   {
            scene:  {mode: SCENE_MODE_2D},
            camera: {
                heading:           0,
                pitch:             -30,
                roll:              0,
                range:             2000,
                maximumHeight:     9000,
                pitchAdjustHeight: 5000,
                flyingTime:        0,
                rpm:               4,
                fps:               30,
                rotations:         1,
            },
        },
        scene:      {mode: SceneMode.SCENE2D},
        camera:     {
            flyToBoundingSphere: vi.fn(),
            flyTo:               vi.fn(),
            changed:             {
                addEventListener: vi.fn(() => vi.fn()),
            },
            positionWC:          Cartesian3.fromDegrees(-120, 10, 1000),
        },
    })

    vi.stubGlobal('__', {
        ui: {
            sceneManager:  {
                is2D:       true,
                stopRotate: false,
            },
            cameraManager: {
                position:         {heading: 0, pitch: DEFAULT_2D_FOCUS_PITCH, roll: 0, range: 2000},
                isJourneyFocusOn: vi.fn(() => false),
                raiseUpdateEvent: vi.fn(),
                saveInformation:  vi.fn(),
                unlock:           vi.fn(),
                rotateAround:     vi.fn(),
                beginFlight:      vi.fn(),
                endFlight:        vi.fn(),
            },
            poiManager:    {
                getHeightFromTerrain: vi.fn(async () => 0),
            },
        },
    })
}

describe('camera focus position conversion', () => {
    it('builds a camera position using the pitch projection and requested range', () => {
        const position = CameraUtils.cameraPositionFromTarget(
            {longitude: 0, latitude: 0, height: 0},
            {heading: 0, pitch: -30, range: 1000},
        )
        const targetCartesian = Cartesian3.fromDegrees(0, 0, 0)
        const positionCartesian = Cartesian3.fromDegrees(position.longitude, position.latitude, position.height)

        expect(Cartesian3.distance(targetCartesian, positionCartesian)).toBeCloseTo(1000, 3)
        expect(position.height).toBeCloseTo(-500, 0)
    })
})

describe('camera focus defaults', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('uses a 45 degree pitch fallback when Cesium cannot expose HPR outside 3D', () => {
        expect(CameraUtils.getHeadingPitchRoll(null).pitch).toBe(DEFAULT_2D_FOCUS_PITCH)
    })

    it('uses the 2D pitch fallback when focusing without an explicit pitch', async () => {
        const journey = makeJourney()
        installFocusGlobals(journey)

        await SceneUtils.focus({longitude: 0, latitude: 0, height: 0}, {range: 1000})

        const flyOptions = lgs.camera.flyToBoundingSphere.mock.calls[0][1]
        expect(Math.round(M.toDegrees(flyOptions.offset.pitch))).toBe(DEFAULT_2D_FOCUS_PITCH)
    })

    it('starts same-target rotation immediately without a zero-duration flyTo', async () => {
        const journey = makeJourney()
        installFocusGlobals(journey)

        await SceneUtils.focus({longitude: 0, latitude: 0, height: 0}, {
            flyingTime: 2,
            rotate:      true,
            initializer: () => ({
                distance:         100,
                height:           0,
                rotationTarget:   {longitude: 1, latitude: 2, height: 3},
                sameRotateTarget: true,
            }),
        })

        expect(lgs.camera.flyToBoundingSphere).not.toHaveBeenCalled()
        expect(__.ui.cameraManager.beginFlight).not.toHaveBeenCalled()
        expect(__.ui.cameraManager.rotateAround).toHaveBeenCalledTimes(1)
        expect(__.ui.cameraManager.rotateAround.mock.calls[0][0].longitude).toBe(0)
        expect(__.ui.cameraManager.rotateAround.mock.calls[0][0].latitude).toBe(0)
        expect(__.ui.cameraManager.rotateAround.mock.calls[0][1].lookAt).toBe(false)
        expect(__.ui.cameraManager.rotateAround.mock.calls[0][1].preserveView).toBe(true)
    })

    it('keeps the flyTo when rotating toward another target even under the snap distance', async () => {
        const journey = makeJourney()
        installFocusGlobals(journey)

        await SceneUtils.focus({longitude: 0, latitude: 0, height: 0}, {
            rotate:      true,
            initializer: () => ({distance: 100, height: 0, sameRotateTarget: false}),
        })

        expect(lgs.camera.flyToBoundingSphere).toHaveBeenCalledTimes(1)
        expect(__.ui.cameraManager.beginFlight).toHaveBeenCalledTimes(1)
        expect(__.ui.cameraManager.rotateAround).not.toHaveBeenCalled()
    })

    it('stops an active rotation before focusing the journey', async () => {
        const journey = makeJourney()
        installFocusGlobals(journey)
        __.ui.cameraManager.isRotating = vi.fn(() => true)
        __.ui.cameraManager.stopRotate = vi.fn(async () => undefined)

        await SceneUtils.focusOnJourney({journey, resetCamera: true})

        expect(__.ui.cameraManager.stopRotate).toHaveBeenCalledTimes(1)
        expect(lgs.camera.flyToBoundingSphere).toHaveBeenCalledTimes(1)
    })

    it('ends the camera flight marker when focus flyTo completes', async () => {
        const journey = makeJourney()
        installFocusGlobals(journey)

        await SceneUtils.focus({longitude: 0, latitude: 0, height: 0}, {range: 1000})

        expect(__.ui.cameraManager.beginFlight).toHaveBeenCalledTimes(1)
        expect(__.ui.cameraManager.endFlight).not.toHaveBeenCalled()

        await lgs.camera.flyToBoundingSphere.mock.calls[0][1].complete()

        expect(__.ui.cameraManager.endFlight).toHaveBeenCalledTimes(1)
    })

    it('frames every track when focusing a full journey', async () => {
        const journey = makeJourney()
        installFocusGlobals(journey)
        const focusSpy = vi.spyOn(SceneUtils, 'focus')

        await SceneUtils.focusOnJourney({journey, resetCamera: true})

        const focusOptions = focusSpy.mock.calls[0][1]
        expect(focusOptions.bbox.data[0]).toBeLessThan(0)
        expect(focusOptions.bbox.data[2]).toBeGreaterThan(1.1)
        expect(focusOptions.range).toBe(10000)
        expect(focusOptions.boundingSphereRange).toBe(0)
        expect(lgs.camera.flyToBoundingSphere).toHaveBeenCalledTimes(1)
    })

    it('starts a path-based focus with a flyTo preflight', async () => {
        const journey = makeJourney()
        installFocusGlobals(journey)
        const pathFlyTo = vi.fn(({complete}) => {
            complete?.()
            return vi.fn()
        })
        const buildSpy = vi.spyOn(CameraPath, 'buildCameraTransferPath').mockReturnValue({
            mode:        'spiral-conical',
            distanceMeters: 200000,
            sampleCount: 48,
            samples:     [],
            sampleAt:    () => new Cartesian3(1, 1, 1),
            flyTo:       pathFlyTo,
        })

        await SceneUtils.focus({
            longitude: 10,
            latitude:  20,
            height:    0,
        }, {
            cameraPosition: {
                longitude: 10,
                latitude:  20,
                height:    1200,
            },
            useCameraPath: true,
            flyingTime:    1,
            initializer:   () => ({distance: 200000, height: 0, sameRotateTarget: false}),
        })

        expect(buildSpy).toHaveBeenCalled()
        expect(pathFlyTo).toHaveBeenCalled()
        expect(lgs.camera.flyTo).not.toHaveBeenCalled()
        expect(lgs.camera.flyToBoundingSphere).not.toHaveBeenCalled()
        buildSpy.mockRestore()
    })

    it('replans the focus path when the camera changes during the flight', async () => {
        vi.useFakeTimers()
        try {
            const journey = makeJourney()
            installFocusGlobals(journey)

            let cameraChangedHandler = null
            lgs.camera.changed.addEventListener = vi.fn(handler => {
                cameraChangedHandler = handler
                return vi.fn()
            })
            const pathCancels = []
            const buildSpy = vi.spyOn(CameraPath, 'buildCameraTransferPath').mockImplementation(options => {
                const cancel = vi.fn()
                pathCancels.push(cancel)
                return {
                    mode:        options.mode,
                    distanceMeters: 200000,
                    sampleCount: 48,
                    samples:     [],
                    sampleAt:    () => new Cartesian3(1, 1, 1),
                    flyTo:       vi.fn(() => cancel),
                }
            })

            await SceneUtils.focus({
                longitude: 10,
                latitude:  20,
                height:    0,
            }, {
                cameraPosition: {
                    longitude: 10,
                    latitude:  20,
                    height:    1200,
                },
                useCameraPath: true,
                flyingTime:    1,
                initializer:   () => ({distance: 200000, height: 0, sameRotateTarget: false}),
            })

            expect(buildSpy).toHaveBeenCalledTimes(1)
            expect(pathCancels).toHaveLength(1)

            lgs.camera.positionWC = Cartesian3.fromDegrees(11, 21, 1300)
            cameraChangedHandler?.()
            await vi.advanceTimersByTimeAsync(100)

            expect(pathCancels[0]).toHaveBeenCalledTimes(1)
            expect(buildSpy).toHaveBeenCalledTimes(2)
            expect(lgs.camera.flyTo).not.toHaveBeenCalled()

            buildSpy.mockRestore()
        }
        finally {
            vi.useRealTimers()
        }
    })

    it('does not reuse a corrupted stored journey height when reset focusing', async () => {
        const journey = makeJourney()
        journey.camera = {
            target:   {longitude: 9, latitude: 45, height: -42000},
            position: {longitude: 9, latitude: 45, height: -42000},
        }
        installFocusGlobals(journey)
        const focusSpy = vi.spyOn(SceneUtils, 'focus')

        await SceneUtils.focusOnJourney({journey, resetCamera: true})

        const [point, focusOptions] = focusSpy.mock.calls[0]
        expect(point.height).toBe(0)
        expect(focusOptions.cameraPosition).toBeNull()
        expect(focusOptions.boundingSphere).not.toBeNull()
    })

    it('falls back to journey framing when the saved journey camera is underground', async () => {
        const journey = makeJourney()
        journey.camera = {
            target:   {longitude: 9, latitude: 45, height: 1200},
            position: {longitude: 9, latitude: 45, height: -42000, heading: 80, pitch: -20, roll: 4, range: 900},
        }
        installFocusGlobals(journey)
        __.ui.cameraManager.isJourneyFocusOn.mockReturnValue(true)
        const focusSpy = vi.spyOn(SceneUtils, 'focus')

        await SceneUtils.focusOnJourney({journey})

        const [point, focusOptions] = focusSpy.mock.calls[0]
        expect(point.longitude).not.toBe(9)
        expect(focusOptions.cameraPosition).toBeNull()
        expect(focusOptions.range).toBe(10000)
        expect(focusOptions.boundingSphereRange).toBe(0)
    })
})
