import {defaultJourneyReplaySettings, REPLAY_MARKER_MODE_HYSTERESIS} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {bindMarkerInteractions} from '@Core/ui/replay/JourneyReplayCameraBinding'
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
})
