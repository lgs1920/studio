import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_WARNING_TOAST:     'warning',
    LGS_TOAST_DURATION:    5000,
    showToast:             vi.fn(),
}))

import {applyJourneyReplayClipCameraPlan} from '@Core/ui/replay/JourneyReplayClipController'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from '@Core/ui/replay/JourneyReplayInternal'

describe('logical replay clip camera path', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('uses the logical clip plan without journey focus or Cesium flight callbacks', async () => {
        const focus = vi.fn()
        const recenterCameraToSample = vi.fn()
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: true,
                clipSequenceToken:      1,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                setContinuousRender:           vi.fn(),
                isReplayVideoLinked:            vi.fn(() => false),
                applyJourneyReplayPOIVisibility: vi.fn(),
                interpolateReplayExportSample:  vi.fn((start, end, ratio) => ratio < 1 ? start : end),
                recenterCameraToSample,
            },
        }
        vi.stubGlobal('lgs', {
            theJourney: {focus},
            scene:      {requestRender: vi.fn()},
        })

        const startSample = {longitude: 2, latitude: 48, altitude: 120}
        const endSample = {longitude: 2.1, latitude: 48.1, altitude: 180}
        await applyJourneyReplayClipCameraPlan(mode, {
            kind:     'focus',
            duration: 0,
            rpm:      0,
            startView: {
                sample:  startSample,
                heading: 0,
                pitch:   -1,
                height:  1000,
            },
            endView: {
                sample:  endSample,
                heading: 1,
                pitch:   -0.8,
                height:  800,
            },
        }, {token: 1})

        expect(focus).not.toHaveBeenCalled()
        expect(recenterCameraToSample).toHaveBeenCalledWith(expect.objectContaining({
            sample:        endSample,
            deterministic: true,
            instant:       true,
            duration:      0,
            logicalNow:    0,
        }))
    })
})
