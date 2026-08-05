import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_WARNING_TOAST:     'warning',
    LGS_TOAST_DURATION:    5000,
    showToast:             vi.fn(),
}))

import {
    applyJourneyReplayClipCameraPlan,
    playJourneyReplayClips,
    resolveJourneyReplayClipCameraPlan,
} from '@Core/ui/replay/JourneyReplayClipController'
import {REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP} from '@Core/ui/replay/JourneyReplayClips'
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

    it.each([
        ['start', REPLAY_CLIP_SLOT_START],
        ['stop', REPLAY_CLIP_SLOT_STOP],
    ])('passes the previous %s clip end camera to the next clip', async (_label, slot) => {
        const entryCamera = {
            sample:  {longitude: 2, latitude: 48, altitude: 100},
            heading: 0.1,
            pitch:   -1,
            height:  2000,
        }
        const firstEnd = {
            sample:  {longitude: 2.1, latitude: 48.1, altitude: 120},
            heading: 0.4,
            pitch:   -0.9,
            height:  1400,
        }
        const secondEnd = {
            sample:  {longitude: 2.2, latitude: 48.2, altitude: 140},
            heading: 0.8,
            pitch:   -0.7,
            height:  900,
        }
        const runJourneyReplayClip = vi.fn()
            .mockResolvedValueOnce({endView: firstEnd})
            .mockResolvedValueOnce({endView: secondEnd})
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                clipSequenceToken: 7,
                clipCameraContinuity: null,
                controller: {videoTimeline: {phases: []}},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                currentReplayClipCameraState: vi.fn(() => entryCamera),
                clipListForSlot: vi.fn(() => [
                    {clipId: 'zoom-in'},
                    {clipId: 'zoom-out'},
                ]),
                runJourneyReplayClip,
            },
        }

        const result = await playJourneyReplayClips(mode, slot, {
            sample: entryCamera.sample,
            token:  7,
        })

        expect(runJourneyReplayClip).toHaveBeenNthCalledWith(
            1,
            {clipId: 'zoom-in'},
            expect.objectContaining({
                slot,
                startCamera: expect.objectContaining(entryCamera),
            }),
        )
        expect(runJourneyReplayClip).toHaveBeenNthCalledWith(
            2,
            {clipId: 'zoom-out'},
            expect.objectContaining({
                slot,
                startCamera: expect.objectContaining(firstEnd),
            }),
        )
        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].clipCameraContinuity).toEqual(expect.objectContaining(secondEnd))
        expect(result).toBe(true)
    })

    it('keeps the replay end camera as the start of a landing exit clip', () => {
        const replayEndCamera = {
            sample:  {longitude: 2, latitude: 48, altitude: 600},
            heading: 1.2,
            pitch:   -0.8,
            height:  1500,
        }
        const landingSample = {longitude: 2.05, latitude: 48.05, altitude: 10}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: false,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cameraSettingsForClip:       vi.fn(() => ({altitude: 900, pitch: -45})),
                replayExportBaseView:        vi.fn(() => ({
                    sample:       replayEndCamera.sample,
                    heading:      0,
                    pitch:        -1,
                    cameraHeight: 1000,
                })),
                clipReplayHeadingForProgress: vi.fn(() => 0.5),
                targetSampleForClip:         vi.fn(() => landingSample),
                markerRenderHeightForSample: vi.fn(() => 80),
            },
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {camera: {positionMode: 'system'}}}},
        })

        const plan = resolveJourneyReplayClipCameraPlan(mode, {
            clip:       {clipId: 'landing', params: {duration: 2}},
            slot:       REPLAY_CLIP_SLOT_STOP,
            sample:     replayEndCamera.sample,
            startCamera: replayEndCamera,
        })

        expect(plan.startView).toEqual(expect.objectContaining(replayEndCamera))
        expect(plan.endView).toEqual(expect.objectContaining({
            sample: landingSample,
            height: 80,
        }))
        expect(plan.instant).toBe(true)
    })
})
