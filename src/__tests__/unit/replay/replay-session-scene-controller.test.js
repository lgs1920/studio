import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))

import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {REPLAY_EVENT_UPDATE} from '@Core/ui/replay/JourneyReplayPlaybackController'
import {beginReplaySessionOwnership} from '@Core/ui/replay/ReplaySessionOwnership'
import {
    abortPlaybackAfterListenerError, bindRenderer, captureCameraState, restoreCameraState, restorePlaybackScene, restorePlaybackSceneInternal,
    setReplayPreparationPivot,
} from '@Core/ui/replay/JourneyReplaySessionSceneController'

const makeMode = () => {
    const listeners = new Map()
    const renderer = {
        clear: vi.fn(),
        show:  vi.fn(),
        update: vi.fn(),
    }
    const call = {
        abortPlaybackAfterListenerError: vi.fn(),
        hideJourneyToolbarVisibility:    vi.fn(),
        setContinuousRender:             vi.fn(),
        setToleranceZoneOverlayVisible:  vi.fn(),
        syncNearbyPOIsForSample:         vi.fn(),
        updateCamera:                    vi.fn(),
    }
    const state = {
        controller: {
            on: (event, callback) => {
                listeners.set(event, callback)
                return () => listeners.delete(event)
            },
        },
        lastPlaybackUpdateProgressKey: null,
        renderingReplayExportFrame:    false,
        renderer,
        sampler:                       {id: 'sampler'},
        unbind:                        [],
    }

    return {
        listeners,
        mode: {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        },
        renderer,
        state,
        call,
    }
}

describe('JourneyReplaySessionSceneController', () => {
    afterEach(() => {
        delete globalThis.lgs
        vi.clearAllMocks()
    })

    it('keeps throttling playback updates when capture is inactive', () => {
        const {listeners, mode, call, renderer} = makeMode()
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {
                        recordingSync: false,
                    },
                },
            },
            stores: {
                replay: {
                    recordingSync: false,
                },
            },
        }

        bindRenderer(mode)

        listeners.get(REPLAY_EVENT_UPDATE)?.({
            progress: 0.1,
            sample:   {progress: 0.1},
        })
        listeners.get(REPLAY_EVENT_UPDATE)?.({
            progress:  0.1001,
            sample:    {progress: 0.1001},
        })

        expect(renderer.update).toHaveBeenCalledTimes(2)
        expect(call.updateCamera).toHaveBeenCalledTimes(1)
    })

    it('updates the camera on each playback frame while capture is active', () => {
        const {listeners, mode, call, renderer} = makeMode()
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {
                        recordingSync: true,
                    },
                },
            },
            stores: {
                replay: {
                    recordingSync: true,
                },
            },
        }

        bindRenderer(mode)

        listeners.get(REPLAY_EVENT_UPDATE)?.({
            progress: 0.1,
            sample:   {progress: 0.1},
        })
        listeners.get(REPLAY_EVENT_UPDATE)?.({
            progress:  0.1001,
            sample:    {progress: 0.1001},
        })

        expect(renderer.update).toHaveBeenCalledTimes(2)
        expect(call.updateCamera).toHaveBeenCalledTimes(2)
        expect(call.updateCamera.mock.calls.flat()).toEqual(expect.arrayContaining([
            expect.objectContaining({logicalCamera: true}),
        ]))
    })

    it('restores the captured focus after journey focus completes', async () => {
        const cameraState = {
            destination: {longitude: 2, latitude: 48, height: 5000},
            orientation: {heading: 0.4, pitch: -0.8, roll: 0},
            altitude: 5000,
        }
        const state = {
            renderer: {
                clear: vi.fn(),
            },
            cameraStateRestoredBeforeSceneCleanup: false,
            deferPlaybackCameraRestore: true,
            sceneRestoreDeferred: true,
            sceneRestorePromise: null,
            replayEntryCameraState: cameraState,
            savedCameraState: cameraState,
        }
        const call = {
            removeToleranceZoneOverlay:     vi.fn(),
            restoreOtherJourneysVisibility: vi.fn(),
            restoreCurrentJourneyVisibility: vi.fn(),
            setJourneyReplayOrbitAllowed:   vi.fn(),
            setToleranceZoneOverlayVisible: vi.fn(),
            restoreJourneyToolbarVisibility: vi.fn(),
            restoreJourneyReplayDrawerAfterPlayback: vi.fn(),
            restoreMainUI:                  vi.fn(),
            restoreNearbyPOIsAfterPlayback: vi.fn(() => Promise.resolve()),
            resetCameraController:          vi.fn(),
            focusJourneyAfterPlayback:     vi.fn(() => Promise.resolve()),
            restoreCameraState:             vi.fn(() => {
                state.savedCameraState = null
            }),
            restorePlaybackCameraSettings: vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        }
        globalThis.lgs = {
            stores: {
                replay: {
                    active: true,
                    sample: {progress: 1},
                },
            },
        }

        await restorePlaybackSceneInternal(mode)

        expect(state.renderer.clear).toHaveBeenCalledTimes(1)
        expect(call.restoreOtherJourneysVisibility).toHaveBeenCalledTimes(1)
        expect(call.restoreCurrentJourneyVisibility).toHaveBeenCalled()
        expect(call.focusJourneyAfterPlayback).toHaveBeenCalledTimes(1)
        expect(call.restoreCameraState).toHaveBeenCalledTimes(1)
        expect(state.savedCameraState).toBeNull()
        expect(state.replayEntryCameraState).toBeNull()
    })

    it('keeps the internal restore finalizer active through the public restore wrapper', async () => {
        const state = {
            renderer: {
                clear: vi.fn(),
            },
            cameraStateRestoredBeforeSceneCleanup: false,
            deferPlaybackCameraRestore: true,
            sceneRestoreDeferred: true,
            sceneRestorePromise: null,
            replayEntryCameraState: {destination: {}, orientation: {}},
            savedCameraState: {destination: {}, orientation: {}},
        }
        const call = {
            removeToleranceZoneOverlay:     vi.fn(),
            restoreOtherJourneysVisibility: vi.fn(),
            restoreCurrentJourneyVisibility: vi.fn(),
            setJourneyReplayOrbitAllowed:   vi.fn(),
            setToleranceZoneOverlayVisible: vi.fn(),
            restoreJourneyToolbarVisibility: vi.fn(),
            restoreJourneyReplayDrawerAfterPlayback: vi.fn(),
            restoreMainUI:                  vi.fn(),
            restoreNearbyPOIsAfterPlayback: vi.fn(() => Promise.resolve()),
            resetCameraController:          vi.fn(),
            focusJourneyAfterPlayback:     vi.fn(() => Promise.resolve()),
            restoreCameraState:             vi.fn(() => {
                state.savedCameraState = null
            }),
            restorePlaybackCameraSettings: vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        }
        call.restorePlaybackScene = vi.fn(() => restorePlaybackSceneInternal(mode))
        globalThis.lgs = {
            stores: {
                replay: {
                    active: true,
                },
            },
        }

        await expect(restorePlaybackScene(mode, {force: true})).resolves.toBe(true)

        expect(call.focusJourneyAfterPlayback).toHaveBeenCalledTimes(1)
        expect(call.restoreCameraState).toHaveBeenCalledTimes(1)
        expect(state.sceneRestorePromise).toBeNull()
    })

    it('applies the replay entry camera without replacing the pre-replay snapshot', () => {
        const state = {
            savedCameraState: {
                destination: {longitude: 2, latitude: 48, height: 2400},
                orientation: {heading: 0.4, pitch: -0.7, roll: 0},
                altitude: 2400,
            },
        }
        const replayEntryCameraState = {
            destination: {longitude: 2.001, latitude: 48.001, height: 900},
            orientation: {heading: 0.8, pitch: -0.5, roll: 0},
            altitude: 900,
        }
        const camera = {
            cancelFlight: vi.fn(),
            lookAtTransform: vi.fn(),
            setView:      vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  {},
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        }
        globalThis.lgs = {
            viewer: {camera},
        }

        expect(restoreCameraState(mode, {
            clear:       false,
            cameraState: replayEntryCameraState,
        })).toBe(true)

        expect(state.savedCameraState).toEqual({
            destination: {longitude: 2, latitude: 48, height: 2400},
            orientation: {heading: 0.4, pitch: -0.7, roll: 0},
            altitude: 2400,
        })
        expect(camera.setView).toHaveBeenCalledTimes(1)
    })

    it('preserves the camera pivot when restoring after replay', () => {
        const pivot = {
            height:          120,
            id:              'departure-pivot',
            latitude:        48.1,
            longitude:       2.1,
            simulatedHeight: 125,
        }
        const cameraManager = {target: {...pivot}}
        const camera = {
            cancelFlight: vi.fn(),
            heading:      0.4,
            latitude:     0,
            longitude:    0,
            pitch:        -0.8,
            positionCartographic: {height: 5000, latitude: 0.8, longitude: 0.03},
            roll:         0,
            lookAtTransform: vi.fn(),
            setView:      vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  {},
            [JOURNEY_REPLAY_INTERNAL_STATE]: {lastCameraHeading: 0, lastCameraPitch: -1},
        }
        globalThis.__ = {ui: {cameraManager}}
        globalThis.lgs = {
            stores: {
                main: {
                    components: {
                        camera: {target: {...pivot}},
                    },
                },
            },
            viewer: {camera},
        }

        try {
            const captured = captureCameraState(mode)
            expect(captured.pivot).toEqual(pivot)

            cameraManager.target = {longitude: 9, latitude: 9, height: 9}
            globalThis.lgs.stores.main.components.camera.target = {longitude: 9, latitude: 9, height: 9}
            expect(restoreCameraState(mode)).toBe(true)

            expect(cameraManager.target).toEqual(pivot)
            expect(globalThis.lgs.stores.main.components.camera.target).toEqual(pivot)
        }
        finally {
            delete globalThis.__
        }
    })

    it('forces the preparation pivot to the departure sample', () => {
        const cameraManager = {target: {longitude: 9, latitude: 9, height: 9}}
        const cameraStore = {target: {longitude: 9, latitude: 9, height: 9}}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {},
        }
        globalThis.__ = {ui: {cameraManager}}
        globalThis.lgs = {
            stores: {
                main: {
                    components: {
                        camera: cameraStore,
                    },
                },
            },
        }

        expect(setReplayPreparationPivot(mode, {
            altitude: 125,
            latitude: 48.1,
            longitude: 2.1,
        })).toEqual({
            height:    125,
            latitude: 48.1,
            longitude: 2.1,
        })
        expect(cameraManager.target).toEqual({
            height:    125,
            latitude: 48.1,
            longitude: 2.1,
        })
        expect(cameraStore.target).toEqual({
            height:    125,
            latitude: 48.1,
            longitude: 2.1,
        })
    })

    it('reapplies the active replay camera when an obsolete focus settles late', async () => {
        let resolveFocus
        const focusPromise = new Promise(resolve => {
            resolveFocus = resolve
        })
        const state = {
            clipSequenceToken: 2,
            controller: {
                running:       true,
                playing:       true,
                paused:        false,
                progress:      0.4,
                currentSample: () => ({progress: 0.4, longitude: 2, latitude: 48}),
            },
            renderer: {
                clear: vi.fn(),
            },
            sceneRestoreDeferred: true,
            sceneRestorePromise: null,
            deferPlaybackCameraRestore: true,
            cameraStateRestoredBeforeSceneCleanup: false,
            logicalCameraTrajectory: true,
            replayExportCameraActive: true,
            savedCameraState: {destination: {}, orientation: {}},
            replayEntryCameraState: {destination: {}, orientation: {}},
        }
        const call = {
            removeToleranceZoneOverlay:     vi.fn(),
            restoreOtherJourneysVisibility: vi.fn(),
            restoreCurrentJourneyVisibility: vi.fn(),
            setJourneyReplayOrbitAllowed:   vi.fn(),
            setToleranceZoneOverlayVisible: vi.fn(),
            restoreJourneyToolbarVisibility: vi.fn(),
            restoreJourneyReplayDrawerAfterPlayback: vi.fn(),
            restoreMainUI:                  vi.fn(),
            restoreNearbyPOIsAfterPlayback: vi.fn(() => Promise.resolve()),
            resetCameraController:          vi.fn(),
            focusJourneyAfterPlayback:     vi.fn(() => focusPromise),
            restoreCameraState:             vi.fn(),
            restorePlaybackCameraSettings: vi.fn(),
            updateCamera:                  vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        }
        globalThis.lgs = {
            stores: {
                replay: {
                    active: true,
                },
            },
        }

        beginReplaySessionOwnership(mode)
        const restorePromise = restorePlaybackSceneInternal(mode)
        beginReplaySessionOwnership(mode)
        resolveFocus()
        await restorePromise

        expect(call.updateCamera).toHaveBeenCalledWith(expect.objectContaining({
            progress:      0.4,
            logicalCamera: true,
            exportMode:    true,
        }))
        expect(call.restoreCameraState).not.toHaveBeenCalled()
        expect(state.sceneRestorePromise).toBeNull()
    })

    it('restores focus and replay visibility after a premature listener failure', async () => {
        const state = {
            clipSequenceToken: 4,
            controller: {
                stop: vi.fn(),
            },
            renderer: {
                clear: vi.fn(),
            },
            sceneRestoreDeferred: true,
            sceneRestorePromise: null,
            deferPlaybackCameraRestore: true,
            cameraStateRestoredBeforeSceneCleanup: false,
            replayExportCameraActive: true,
            renderingReplayExportFrame: true,
            logicalCameraTrajectory: true,
            deferStartCameraRecenter: true,
            savedCameraState: {destination: {}, orientation: {}},
            replayEntryCameraState: {destination: {}, orientation: {}},
        }
        const call = {
            stopStopClipPOIMaskLoop: vi.fn(),
            cancelActiveCameraFlight: vi.fn(),
            setContinuousRender: vi.fn(),
            restoreOtherJourneysVisibility: vi.fn(),
            restoreCurrentJourneyVisibility: vi.fn(),
            setJourneyReplayOrbitAllowed: vi.fn(),
            setToleranceZoneOverlayVisible: vi.fn(),
            removeToleranceZoneOverlay: vi.fn(),
            restoreJourneyToolbarVisibility: vi.fn(),
            restoreJourneyReplayDrawerAfterPlayback: vi.fn(),
            restoreMainUI: vi.fn(),
            restoreNearbyPOIsAfterPlayback: vi.fn(() => Promise.resolve()),
            resetCameraController: vi.fn(),
            focusJourneyAfterPlayback: vi.fn(() => Promise.resolve()),
            restoreCameraState: vi.fn(() => {
                state.savedCameraState = null
            }),
            restorePlaybackCameraSettings: vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        }
        call.restorePlaybackScene = vi.fn(() => restorePlaybackSceneInternal(mode))
        globalThis.lgs = {
            stores: {
                replay: {
                    active: true,
                    toolbarVisible: true,
                    mainUiHidden: true,
                },
            },
        }

        await abortPlaybackAfterListenerError(mode, new Error('listener failed'))

        expect(call.cancelActiveCameraFlight).toHaveBeenCalledTimes(1)
        expect(call.focusJourneyAfterPlayback).toHaveBeenCalledTimes(1)
        expect(call.restoreCurrentJourneyVisibility).toHaveBeenCalled()
        expect(call.restoreCameraState).toHaveBeenCalledTimes(1)
        expect(globalThis.lgs.stores.replay).toMatchObject({
            active: false,
            toolbarVisible: false,
            mainUiHidden: false,
        })
        expect(state.replayExportCameraActive).toBe(false)
        expect(state.renderingReplayExportFrame).toBe(false)
        expect(state.logicalCameraTrajectory).toBe(false)
    })
})
