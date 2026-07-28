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
import {
    bindRenderer, restorePlaybackSceneInternal,
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
    })

    it('restores the captured focus after journey focus completes', async () => {
        const cameraState = {
            destination: {longitude: 2, latitude: 48, height: 5000},
            orientation: {heading: 0.4, pitch: -0.8, roll: 0},
            altitude: 5000,
        }
        const state = {
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

        expect(call.focusJourneyAfterPlayback).toHaveBeenCalledTimes(1)
        expect(call.restoreCameraState).toHaveBeenCalledTimes(1)
        expect(state.savedCameraState).toBeNull()
        expect(state.replayEntryCameraState).toBeNull()
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

        const restorePromise = restorePlaybackSceneInternal(mode)
        state.sceneRestorePromise = null
        state.clipSequenceToken++
        resolveFocus()
        await restorePromise

        expect(call.updateCamera).toHaveBeenCalledWith(expect.objectContaining({
            progress:      0.4,
            logicalCamera: true,
            exportMode:    true,
        }))
        expect(call.restoreCameraState).not.toHaveBeenCalled()
    })
})
