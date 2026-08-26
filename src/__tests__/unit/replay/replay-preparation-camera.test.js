import {Cartesian3, Matrix4} from 'cesium'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {defaultJourneyReplaySettings} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {lockReplayCameraToAnchor} from '@Core/ui/replay/JourneyReplayCameraState'
import {prepareReplayCamera} from '@Core/ui/replay/JourneyReplaySessionPlaybackController'
import {showCameraAnglePreview} from '@Core/ui/replay/JourneyReplaySessionSceneController'

afterEach(() => {
    delete globalThis.__
    delete globalThis.lgs
})

describe('replay preparation camera', () => {
    it('delegates camera angle preview rendering to the overlay controller', () => {
        const showCameraAnglePreviewOverlay = vi.fn()
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]: {showCameraAnglePreviewOverlay},
        }

        showCameraAnglePreview(mode, {
            displayOffset: 40,
            positionMode:  'behind',
        })

        expect(showCameraAnglePreviewOverlay).toHaveBeenCalledWith({
            displayOffset: 40,
            positionMode:  'behind',
        })
    })

    it('locks Cesium navigation to the replay anchor', () => {
        const target = Cartesian3.fromDegrees(2, 48, 120)
        const destination = Cartesian3.add(target, new Cartesian3(500, 500, 500), new Cartesian3())
        const camera = {
            lookAtTransform: vi.fn(),
        }
        const hqCamera = {
            lookAtTransform: vi.fn(),
        }
        globalThis.lgs = {
            camera,
            viewer: {camera: hqCamera},
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {cameraApplyingView: false},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cesiumViewer:       () => ({camera}),
                cameraRecenterFrame: vi.fn(() => ({
                    target,
                    destination,
                    safeHeading: 0.4,
                    safePitch:   -0.8,
                    roll:        0,
                })),
                rememberCameraView: vi.fn(),
                refreshReplayDiagnosticsOverlay: vi.fn(),
            },
        }

        expect(lockReplayCameraToAnchor(mode, {
                                               sample: {longitude: 2, latitude: 48, altitude: 120},
                                               heading: 0.4,
                                               pitch:   -0.8,
                                               cameraPosition: Cartesian3.add(target, new Cartesian3(1000, -500, 300), new Cartesian3()),
                                           })).toBe(true)
        expect(camera.lookAtTransform).toHaveBeenCalledTimes(2)
        expect(hqCamera.lookAtTransform).not.toHaveBeenCalled()
        expect(camera.lookAtTransform.mock.calls[0][0]).not.toBe(Matrix4.IDENTITY)
        expect(camera.lookAtTransform.mock.calls[1][0]).not.toBe(Matrix4.IDENTITY)
        expect(camera.lookAtTransform.mock.calls[1][1].heading).toBe(0.4)
        expect(camera.lookAtTransform.mock.calls[1][1].pitch).toBe(-0.8)
        expect(mode[JOURNEY_REPLAY_INTERNAL_CALL].cameraRecenterFrame.mock.calls[0][0].heading).toBe(0.4)
    })

    it('stops active orbit and panorama before preparing the first replay sample', async () => {
        const settings = defaultJourneyReplaySettings()
        const sample = {longitude: 2, latitude: 48, altitude: 120, progress: 0}
        const call = {
            cancelActiveCameraFlight: vi.fn(),
            cesiumScene:              () => ({requestRender: vi.fn()}),
            configure:                vi.fn(() => ({atProgress: () => sample})),
            cameraViewForSample:      vi.fn(() => ({
                sample,
                heading:     0,
                pitch:       -Math.PI / 4,
                roll:        0,
                cameraHeight: 1200,
            })),
            recenterCameraToSample:   vi.fn(async () => undefined),
            lockReplayCameraToAnchor: vi.fn(() => true),
            updateCameraSettingsFromCesiumControls: vi.fn(),
            bindCesiumCameraBridge:   vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {sampler: null},
            [JOURNEY_REPLAY_INTERNAL_CALL]: call,
        }
        const stopRotate = vi.fn(async () => undefined)
        const stopPanoramic = vi.fn()
        const isRotating = vi.fn(() => true)

        globalThis.__ = {
            ui: {
                cameraManager: {isRotating, stopPanoramic, stopRotate},
            },
        }
        globalThis.lgs = {
            camera: {
                cancelFlight: vi.fn(),
                positionWC:  Cartesian3.fromDegrees(2.01, 48.01, 1200),
            },
            theJourney: {},
            settings: {ui: {replay: settings}},
            stores: {
                replay: {camera: settings.camera, marker: settings.marker},
                ui: {
                    mainUI: {
                        rotate:   {running: true},
                        panorama: {active: true, target: {id: 'panorama'}},
                    },
                },
            },
        }

        await expect(prepareReplayCamera(mode, {journey: globalThis.lgs.theJourney})).resolves.toBe(true)
        expect(stopPanoramic).toHaveBeenCalledOnce()
        expect(isRotating).toHaveBeenCalledOnce()
        expect(stopRotate).toHaveBeenCalledOnce()
        expect(globalThis.lgs.camera.cancelFlight).toHaveBeenCalledOnce()
        expect(call.configure).toHaveBeenCalledWith({journey: globalThis.lgs.theJourney, progress: 0})
        expect(call.recenterCameraToSample).not.toHaveBeenCalled()
        expect(call.lockReplayCameraToAnchor).toHaveBeenCalledOnce()
        expect(call.lockReplayCameraToAnchor.mock.calls[0][0].cameraPosition).toEqual(
            globalThis.lgs.camera.positionWC,
        )
        expect(call.updateCameraSettingsFromCesiumControls).toHaveBeenCalledWith(sample, {
            altitudeMode: settings.camera.altitudeMode,
        })
    })
})
