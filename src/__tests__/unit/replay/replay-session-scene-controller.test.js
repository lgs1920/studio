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
import {bindRenderer} from '@Core/ui/replay/JourneyReplaySessionSceneController'

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
})
