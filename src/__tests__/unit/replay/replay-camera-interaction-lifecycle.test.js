import {Cartesian3} from 'cesium'
import {defaultJourneyReplaySettings, REPLAY_MARKER_MODE_HYSTERESIS} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {bindMarkerInteractions} from '@Core/ui/replay/JourneyReplayCameraBinding'
import {updateCameraFromCesiumControls} from '@Core/ui/replay/JourneyReplayCameraState'
import {applyCameraFrame} from '@Core/ui/replay/JourneyReplayCameraTransition'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {afterEach, describe, expect, it, vi} from 'vitest'

describe('JourneyReplay camera interaction lifecycle', () => {
    afterEach(() => {
        delete globalThis.lgs
    })

    it('ignores programmatic camera restore events after leaving Dynamic replay', () => {
        const replay = defaultJourneyReplaySettings()
        const cameraListeners = {}
        const camera = {
            changed: {
                addEventListener:    listener => {
                    cameraListeners.changed = listener
                },
                removeEventListener: vi.fn(),
            },
            moveStart: {
                addEventListener:    listener => {
                    cameraListeners.moveStart = listener
                },
                removeEventListener: vi.fn(),
            },
            moveEnd: {
                addEventListener:    listener => {
                    cameraListeners.moveEnd = listener
                },
                removeEventListener: vi.fn(),
            },
        }
        const scene = {canvas: null}
        const refreshCamera = vi.fn()
        const call = {
            cesiumScene:                () => scene,
            now:                        () => 0,
            startCameraLiveSyncLoop:    vi.fn(),
            stopCameraLiveSyncLoop:     vi.fn(),
            updateCameraFromCesiumControls: vi.fn(),
        }
        const state = {
            cameraAutoTrackingIgnoreUntil: 0,
            cameraApplyingView:            false,
            cameraFlightActive:             false,
            cameraManualInteractionTimer:  null,
            cameraPointerActive:            false,
            cameraUserAdjusting:            false,
            suppressPlaybackCameraSync:     true,
            unbind:                         [],
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            refreshCamera,
        }

        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            viewer: {camera},
        }

        bindMarkerInteractions(mode)
        cameraListeners.moveStart()
        cameraListeners.moveEnd()

        expect(state.suppressPlaybackCameraSync).toBe(true)
        expect(state.cameraUserAdjusting).toBe(false)
        expect(call.startCameraLiveSyncLoop).not.toHaveBeenCalled()
        expect(call.updateCameraFromCesiumControls).not.toHaveBeenCalled()
        expect(refreshCamera).not.toHaveBeenCalled()
    })

    it('ignores unauthorised Cesium move events once replay is inactive', () => {
        const replay = defaultJourneyReplaySettings()
        const cameraListeners = {}
        const camera = {
            changed: {
                addEventListener:    listener => {
                    cameraListeners.changed = listener
                },
                removeEventListener: vi.fn(),
            },
            moveStart: {
                addEventListener:    listener => {
                    cameraListeners.moveStart = listener
                },
                removeEventListener: vi.fn(),
            },
            moveEnd: {
                addEventListener:    listener => {
                    cameraListeners.moveEnd = listener
                },
                removeEventListener: vi.fn(),
            },
        }
        const scene = {canvas: null}
        const refreshCamera = vi.fn()
        const call = {
            cesiumScene:                   () => scene,
            now:                           () => 0,
            startCameraLiveSyncLoop:       vi.fn(),
            stopCameraLiveSyncLoop:        vi.fn(),
            updateCameraFromCesiumControls: vi.fn(),
        }
        const state = {
            cameraAutoTrackingIgnoreUntil: 0,
            cameraApplyingView:            false,
            cameraFlightActive:             false,
            cameraManualInteractionTimer:  null,
            cameraPointerActive:            false,
            cameraUserAdjusting:            false,
            suppressPlaybackCameraSync:     false,
            unbind:                         [],
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            refreshCamera,
        }

        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores: {
                replay: {
                    active:            false,
                    clipSequenceActive: false,
                    marker:            {mode: REPLAY_MARKER_MODE_HYSTERESIS},
                },
            },
            viewer: {camera},
        }

        bindMarkerInteractions(mode)
        cameraListeners.moveStart()
        cameraListeners.moveEnd()

        expect(call.updateCameraFromCesiumControls).not.toHaveBeenCalled()
        expect(refreshCamera).not.toHaveBeenCalled()
    })

    it('protects an automatically applied frame from delayed Cesium synchronization', () => {
        const setView = vi.fn()
        const call = {
            now: () => 1000,
        }
        const state = {
            cameraApplyingView:            false,
            cameraAutoTrackingIgnoreUntil: 0,
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        }
        globalThis.lgs = {
            viewer: {
                camera: {setView},
            },
        }

        const applied = applyCameraFrame(mode, {
            destination: new Cartesian3(1, 2, 3),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        })

        expect(applied).toBe(true)
        expect(setView).toHaveBeenCalledOnce()
        expect(state.cameraAutoTrackingIgnoreUntil).toBe(1250)
        expect(state.cameraApplyingView).toBe(false)
    })

    it('does not persist an automatic correction as a user camera setting', () => {
        const markPlaybackCameraUserAdjusted = vi.fn()
        const syncCameraFromCesiumControls = vi.fn()
        const call = {
            markPlaybackCameraUserAdjusted,
            now: () => 1100,
        }
        const state = {
            cameraApplyingView:            false,
            cameraAutoTrackingIgnoreUntil: 1250,
            cameraPointerActive:            false,
            suppressPlaybackCameraSync:     false,
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            syncCameraFromCesiumControls,
        }
        globalThis.lgs = {
            stores: {
                replay: {
                    cameraUpdateSource: null,
                },
            },
        }

        updateCameraFromCesiumControls(mode)

        expect(markPlaybackCameraUserAdjusted).not.toHaveBeenCalled()
        expect(syncCameraFromCesiumControls).not.toHaveBeenCalled()

        updateCameraFromCesiumControls(mode, {userInteraction: true})

        expect(markPlaybackCameraUserAdjusted).toHaveBeenCalledOnce()
        expect(syncCameraFromCesiumControls).toHaveBeenCalledOnce()
    })

    it('does not accumulate repeated automatic pitch offsets into the nominal setting', () => {
        let now = 1000
        const camera = {
            pitch: -11 * Math.PI / 180,
            setView: vi.fn(),
        }
        const call = {
            markPlaybackCameraUserAdjusted: vi.fn(),
            now: () => now,
        }
        const state = {
            cameraApplyingView:            false,
            cameraAutoTrackingIgnoreUntil: 0,
            cameraPointerActive:            false,
            suppressPlaybackCameraSync:     false,
        }
        const syncCameraFromCesiumControls = vi.fn(() => {
            globalThis.lgs.settings.ui.replay.camera.pitch = camera.pitch * 180 / Math.PI
        })
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            syncCameraFromCesiumControls,
        }
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {
                        camera: {pitch: -11},
                    },
                },
            },
            stores: {
                replay: {
                    cameraUpdateSource: null,
                },
            },
            viewer: {camera},
        }
        const frame = {
            destination: new Cartesian3(1, 2, 3),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        }

        for (const correctedPitchDegrees of [-15, -19, -23]) {
            applyCameraFrame(mode, frame)
            camera.pitch = correctedPitchDegrees * Math.PI / 180
            now += 10
            updateCameraFromCesiumControls(mode)
            now += 300
        }
        updateCameraFromCesiumControls(mode)

        expect(syncCameraFromCesiumControls).not.toHaveBeenCalled()
        expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(-11)
    })
})
