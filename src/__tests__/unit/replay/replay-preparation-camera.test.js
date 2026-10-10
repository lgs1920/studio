/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-preparation-camera.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-26
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3, Matrix4} from 'cesium'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {defaultJourneyReplaySettings} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {lockReplayCameraToAnchor} from '@Core/ui/replay/JourneyReplayCameraState'
import {configure, enterReplayPreparation, leaveReplayPreparation, prepareReplayCamera, refreshCamera, start} from '@Core/ui/replay/JourneyReplaySessionPlaybackController'

afterEach(() => {
    delete globalThis.__
    delete globalThis.lgs
})

describe('replay preparation camera', () => {
    it('keeps the prepared Basic pitch when Replay reconfigures against the selected journey', () => {
        const settings = defaultJourneyReplaySettings()
        settings.userMode = 'basic'
        settings.simple = {
            camera: {...settings.camera, pitch: -65},
        }
        const journey = {
            slug: 'selected-journey',
            replay: {simple: {camera: {...settings.camera, pitch: -65}}},
        }
        const staleJourney = {
            slug: 'previous-journey',
            replay: {simple: {camera: {...settings.camera, pitch: -10}}},
        }
        const sampler = {hasSamples: true, totalDistance: 1200}
        const configureController = vi.fn()
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                sampler,
                samplerConfigKey: 'same-sampler',
                controller: {configure: configureController},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                samplerConfigurationKey: vi.fn(() => 'same-sampler'),
                bindCesiumCameraBridge: vi.fn(),
            },
        }
        globalThis.lgs = {
            theJourney: staleJourney,
            settings: {ui: {replay: settings}},
            stores: {
                main: {theJourney: journey},
                replay: {
                    userMode: 'basic',
                    simplePreparationActive: true,
                    camera: {...settings.camera, pitch: -32},
                },
            },
        }

        expect(configure(mode)).toBe(sampler)
        expect(globalThis.lgs.stores.replay.journeySlug).toBe('selected-journey')
        expect(globalThis.lgs.stores.replay.camera.pitch).toBe(-32)
        expect(configureController).toHaveBeenCalledWith(expect.objectContaining({sampler}))
    })

    it('does not prepare or start Replay without a Journey, even when an old sampler remains', async () => {
        const call = {
            configure:          vi.fn(),
            captureCameraState: vi.fn(),
        }
        const renderer = {clear: vi.fn()}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                renderer,
                sampler: {atProgress: vi.fn(() => ({longitude: 2, latitude: 48, altitude: 100}))},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: call,
        }
        globalThis.lgs = {
            theJourney: null,
            stores: {main: {theJourney: null}},
        }

        await expect(prepareReplayCamera(mode)).resolves.toBe(false)
        expect(start(mode)).toBeNull()
        expect(call.configure).not.toHaveBeenCalled()
        expect(call.captureCameraState).not.toHaveBeenCalled()
        expect(renderer.clear).not.toHaveBeenCalled()
    })

    it('skips pre-Replay clips when timeline playback starts inside the Replay phase', () => {
        const journey = {}
        const sample = {longitude: 2, latitude: 48, altitude: 120}
        const clip = {clipId: 'intro'}
        const replayEntryCameraState = {
            destination: {longitude: 2, latitude: 48, height: 1200},
            orientation: {heading: 0, pitch: -0.8, roll: 0},
            altitude: 1200,
            pivot: null,
        }
        const sampler = {
            hasSamples: true,
            atProgress: vi.fn(() => sample),
        }
        const controller = {
            videoTimeline: {phases: [{kind: 'pre-replay'}, {kind: 'replay'}]},
            start: vi.fn(() => sample),
        }
        const call = {
            bindCesiumCameraBridge: vi.fn(),
            cancelActiveCameraFlight: vi.fn(),
            captureJourneyReplayDrawerStateBeforePlayback: vi.fn(),
            capturePlaybackCameraSettings: vi.fn(),
            captureCameraState: vi.fn(),
            clipListForSlot: vi.fn(slot => slot === 'pre-replay' ? [clip] : []),
            configure: vi.fn(() => sampler),
            currentReplayClipCameraState: vi.fn(() => ({sample})),
            hideCurrentJourneyVisibility: vi.fn(),
            hideOtherJourneysVisibility: vi.fn(),
            isReplayVideoLinked: vi.fn(() => false),
            now: vi.fn(() => 0),
            placeCameraAtPlaybackStart: vi.fn(() => false),
            playJourneyReplayClips: vi.fn(async () => true),
            prepareNearbyPOIsForPlayback: vi.fn(),
            resetCameraInterpolationState: vi.fn(),
            restoreJourneyReplayPOIVisibility: vi.fn(),
            restoreOtherJourneysVisibility: vi.fn(),
            setJourneyReplayOrbitAllowed: vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                clipSequenceToken: 0,
                controller,
                renderer: {clear: vi.fn()},
                replayCameraPrepared: true,
                replayEntryCameraState,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: call,
        }
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'expert'}}},
            theJourney: journey,
            stores: {
                replay: {toolbarVisible: false},
            },
        }

        expect(start(mode, {progress: 0, skipStartClips: true, hideOtherJourneys: false})).toBe(sample)

        expect(call.clipListForSlot).not.toHaveBeenCalledWith('pre-replay')
        expect(call.playJourneyReplayClips).not.toHaveBeenCalled()
        expect(call.placeCameraAtPlaybackStart).toHaveBeenCalledWith(sample, 0)
        expect(controller.start).toHaveBeenCalledWith({progress: 0})
    })

    it('locks Cesium navigation to the Replay pose instead of standard camera framing', () => {
        const target = Cartesian3.fromDegrees(2, 48, 120)
        const destination = Cartesian3.add(target, new Cartesian3(500, 500, 500), new Cartesian3())
        const camera = {
            positionWC: Cartesian3.fromDegrees(2.01, 48.01, 8500),
            lookAtTransform: vi.fn(),
        }
        const exportCamera = {
            lookAtTransform: vi.fn(),
        }
        globalThis.lgs = {
            camera,
            viewer: {camera: exportCamera},
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
                                               cameraSettings: {cameraAngle: 70, altitude: 1200},
                                               cameraHeight: 1200,
                                           })).toBe(true)
        expect(camera.lookAtTransform).toHaveBeenCalledTimes(2)
        expect(exportCamera.lookAtTransform).not.toHaveBeenCalled()
        expect(camera.lookAtTransform.mock.calls[0][0]).not.toBe(Matrix4.IDENTITY)
        expect(camera.lookAtTransform.mock.calls[1][0]).not.toBe(Matrix4.IDENTITY)
        expect(camera.lookAtTransform.mock.calls[1][1].heading).toBe(0.4)
        expect(camera.lookAtTransform.mock.calls[1][1].pitch).toBe(-0.8)
        expect(mode[JOURNEY_REPLAY_INTERNAL_CALL].cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({
            cameraHeight: 1200,
            cameraRange:  expect.closeTo(1080 / Math.sin(0.8)),
            heading:      0.4,
            pitch:        -0.8,
        }))
    })

    it('preserves standard camera navigation while preparing Replay', async () => {
        const settings = defaultJourneyReplaySettings()
        const sample = {longitude: 2, latitude: 48, altitude: 120, progress: 0}
        const call = {
            cancelActiveCameraFlight: vi.fn(),
            cesiumScene:              () => ({requestRender: vi.fn()}),
            configure:                vi.fn(() => ({atProgress: () => sample})),
            persistCameraSettings:    vi.fn(),
            cameraViewForSample:      vi.fn(() => ({
                sample,
                heading:     0,
                pitch:       -Math.PI / 4,
                roll:        0,
                cameraHeight: 1200,
            })),
            recenterCameraToSample:   vi.fn(async () => undefined),
            lockReplayCameraToAnchor: vi.fn(() => true),
            setReplayPreparationPivot: vi.fn(),
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
        expect(stopPanoramic).not.toHaveBeenCalled()
        expect(stopRotate).not.toHaveBeenCalled()
        expect(globalThis.lgs.camera.cancelFlight).not.toHaveBeenCalled()
        expect(call.lockReplayCameraToAnchor).not.toHaveBeenCalled()
        expect(call.setReplayPreparationPivot).not.toHaveBeenCalled()
        expect(call.updateCameraSettingsFromCesiumControls).not.toHaveBeenCalled()
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].savedCameraState).toBeUndefined()

    })

    it('updates prepared Replay settings without moving the normal camera', () => {
        const settings = defaultJourneyReplaySettings()
        const departure = {longitude: 2, latitude: 48, altitude: 120, progress: 0}
        const laterSample = {longitude: 2.1, latitude: 48.1, altitude: 120, progress: 0.7}
        const call = {
            cameraViewForSample: vi.fn(() => ({
                cameraHeight: 1200,
                heading:      0.4,
                pitch:        -0.8,
                roll:         0,
                sample:       departure,
            })),
            configure: vi.fn(() => ({atProgress: () => departure})),
            lockReplayCameraToAnchor: vi.fn(() => true),
            persistCameraSettings: vi.fn(),
            now: vi.fn(() => 1000),
            updateCamera: vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                cameraAutoTrackingIgnoreUntil: 0,
                controller: {
                    currentSample: () => laterSample,
                    progress:      0.7,
                },
                sampler: {atProgress: () => departure},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: call,
        }
        globalThis.lgs = {
            settings: {ui: {replay: settings}},
            stores: {
                replay: {camera: settings.camera, marker: settings.marker},
                main: {theJourney: {}},
            },
            theJourney: {},
        }

        expect(refreshCamera(mode, {
            preparation: true,
            source:      'keyboard',
        })).toEqual(departure)
        expect(call.configure).not.toHaveBeenCalled()
        expect(call.cameraViewForSample).toHaveBeenCalledWith(expect.objectContaining({
            progress: 0,
            sample:   departure,
            source:   'keyboard',
        }))
        expect(call.lockReplayCameraToAnchor).not.toHaveBeenCalled()
        expect(call.persistCameraSettings).toHaveBeenCalledWith(expect.objectContaining({pitch: settings.camera.pitch}))
        expect(call.updateCamera).not.toHaveBeenCalled()
    })

    it('waits for scene restoration before rebuilding the canonical preparation view', async () => {
        const settings = defaultJourneyReplaySettings()
        const sample = {longitude: 2, latitude: 48, altitude: 120, progress: 0}
        const frame = {
            destination: Cartesian3.fromDegrees(2, 47.99, 1200),
            direction: new Cartesian3(0, 1, -1),
            correctedUp: new Cartesian3(0, 1, 1),
        }
        let resolveSceneRestore
        const sceneRestorePromise = new Promise(resolve => {
            resolveSceneRestore = resolve
        })
        const call = {
            cancelActiveCameraFlight: vi.fn(),
            captureCameraState:       vi.fn(),
            cameraRecenterFrame:      vi.fn(() => frame),
            cesiumScene:              () => ({requestRender: vi.fn()}),
            configure:                vi.fn(() => ({atProgress: () => sample})),
            persistCameraSettings:    vi.fn(),
            cameraViewForSample:      vi.fn(() => ({
                sample,
                heading:     0,
                pitch:       -Math.PI / 4,
                roll:        0,
                cameraHeight: 1200,
            })),
            lockReplayCameraToAnchor: vi.fn(() => true),
            setReplayPreparationPivot: vi.fn(),
            updateCameraSettingsFromCesiumControls: vi.fn(),
            bindCesiumCameraBridge:   vi.fn(),
            hideOtherJourneysVisibility: vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {sceneRestorePromise},
            [JOURNEY_REPLAY_INTERNAL_CALL]: call,
        }
        let finishRotation
        const rotationStopped = new Promise(resolve => { finishRotation = resolve })
        const stopRotate = vi.fn(() => rotationStopped)
        globalThis.__ = {ui: {cameraManager: {stopRotate}}}
        globalThis.lgs = {
            camera: {positionWC: Cartesian3.fromDegrees(2, 48, 1200), pitch: -0.4, setView: vi.fn(), cancelFlight: vi.fn()},
            settings: {ui: {replay: settings}},
            stores: {replay: {camera: settings.camera, marker: settings.marker}},
        }

        const preparation = enterReplayPreparation(mode, {
            journey: {},
            shouldApply: () => true,
        })
        expect(stopRotate).toHaveBeenCalledOnce()
        expect(call.configure).not.toHaveBeenCalled()
        expect(lgs.camera.setView).not.toHaveBeenCalled()
        finishRotation()
        await rotationStopped
        expect(call.configure).not.toHaveBeenCalled()
        expect(lgs.camera.setView).not.toHaveBeenCalled()

        resolveSceneRestore()
        await expect(preparation).resolves.toBe(true)
        expect(call.cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({sample, heading: 0}))
        expect(lgs.camera.setView).toHaveBeenCalledWith({destination: frame.destination, orientation: {direction: frame.direction, up: frame.correctedUp}})
        expect(lgs.camera.cancelFlight).toHaveBeenCalledOnce()
        expect(call.captureCameraState).not.toHaveBeenCalled()
        expect(call.hideOtherJourneysVisibility).toHaveBeenCalledOnce()
        expect(call.setReplayPreparationPivot).not.toHaveBeenCalled()
        expect(call.lockReplayCameraToAnchor).not.toHaveBeenCalled()
    })

    it('does not reorient or configure a cancelled preparation after rotation shutdown', async () => {
        let finishRotation
        let current = true
        const rotationStopped = new Promise(resolve => { finishRotation = resolve })
        const stopRotate = vi.fn(() => rotationStopped)
        const setView = vi.fn()
        const configure = vi.fn()
        globalThis.__ = {ui: {cameraManager: {stopRotate}}}
        globalThis.lgs = {camera: {pitch: -0.4, setView}}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {configure},
        }
        const preparation = enterReplayPreparation(mode, {journey: {}, shouldApply: () => current})
        expect(stopRotate).toHaveBeenCalledOnce()
        current = false
        finishRotation()
        await expect(preparation).resolves.toBe(false)
        expect(setView).not.toHaveBeenCalled()
        expect(configure).not.toHaveBeenCalled()
    })

    it('restores the main-scene camera when leaving Replay preparation', () => {
        const state = {
            replayCameraPrepared:   true,
            replayEntryCameraState: {destination: {}, orientation: {}},
            replayPreparationSample: {longitude: 2, latitude: 48, altitude: 120},
            savedCameraState:       {destination: {}, orientation: {}, pivot: {longitude: 2, latitude: 48, height: 120}},
        }
        const call = {
            cancelActiveCameraFlight:          vi.fn(),
            restoreCameraState:                vi.fn(() => true),
            restoreCurrentJourneyVisibility:   vi.fn(),
            restoreOtherJourneysVisibility:    vi.fn(),
            setContinuousRender:               vi.fn(),
            setJourneyReplayOrbitAllowed:      vi.fn(),
            stopCameraLiveSyncLoop:            vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
        }

        expect(leaveReplayPreparation(mode)).toBe(true)
        expect(call.restoreCameraState).toHaveBeenCalledOnce()
        expect(state.replayCameraPrepared).toBe(false)
        expect(state.replayEntryCameraState).toBeNull()
        expect(state.replayPreparationSample).toBeNull()
        expect(state.savedCameraState).toBeNull()
    })
})
