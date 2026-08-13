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
    focusTargetSampleForReplayExport,
    playJourneyReplayClips,
    replayElementBoundaryOwner,
    resolveJourneyReplayClipCameraPlan,
    targetSampleForClip,
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

    it('uses the last replay point when focus is configured for the last point', async () => {
        const sample = {longitude: 2.4, latitude: 48.4, altitude: 140}
        const getJourneyCentroid = vi.fn()
        vi.stubGlobal('__', {ui: {sceneManager: {getJourneyCentroid}}})
        vi.stubGlobal('lgs', {theJourney: {}})

        await expect(focusTargetSampleForReplayExport({}, sample, 'last-point')).resolves.toBe(sample)
        expect(getJourneyCentroid).not.toHaveBeenCalled()
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
            height: 100,
        }))
        expect(plan.instant).toBe(false)
    })

    it('falls back to ellipsoid ground instead of the track altitude for landing', () => {
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: true,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                markerRenderHeightForSample: vi.fn((_sample, options) => options?.fallback),
            },
        }
        const sample = {longitude: 2, latitude: 48, altitude: 10}

        expect(targetSampleForClip(mode, sample, 'landing')).toEqual({
            ...sample,
            altitude: 0,
        })
        expect(mode[JOURNEY_REPLAY_INTERNAL_CALL].markerRenderHeightForSample)
            .toHaveBeenCalledWith(sample, {fallback: 0})
    })

    it('uses replay ground-offset altitude for take-off while keeping its start on ground', () => {
        const sample = {longitude: 2, latitude: 48, altitude: 120}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: false,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cameraSettingsForClip: vi.fn(() => ({
                    altitude:     300,
                    altitudeMode: 'ground-offset',
                    pitch:        -35,
                })),
                replayExportBaseView: vi.fn(() => ({
                    sample,
                    heading:      0.2,
                    pitch:        -1,
                    cameraHeight: 1320,
                })),
                clipReplayHeadingForProgress: vi.fn(() => 0.4),
                targetSampleForClip: vi.fn(() => sample),
                cameraAltitudeForSample: vi.fn(() => 380),
                markerRenderHeightForSample: vi.fn(() => 80),
            },
        }
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            altitudeMode: 'ground-offset',
                            altitude: 1200,
                            pitch: -65,
                        },
                    },
                },
            },
        })

        const plan = resolveJourneyReplayClipCameraPlan(mode, {
            clip:        {clipId: 'take-off', params: {duration: 2, altitude: 300, pitch: -35}},
            slot:        REPLAY_CLIP_SLOT_START,
            sample,
            startCamera: {sample, heading: 0.1, pitch: -0.8, height: 2000},
        })

        expect(plan.startView).toEqual(expect.objectContaining({
            height: 80,
        }))
        expect(plan.startView.cameraSettings).toEqual(expect.objectContaining({
            altitudeMode: 'constant',
        }))
        expect(plan.endView).toEqual(expect.objectContaining({
            height: 380,
        }))
        expect(plan.endView.cameraSettings).toEqual(expect.objectContaining({
            altitudeMode: 'constant',
            altitude:     300,
        }))
    })

    it('keeps a legacy launch moving upward from ground to the configured camera height', () => {
        const sample = {longitude: 2, latitude: 48, altitude: 120}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: false,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cameraSettingsForClip: vi.fn(() => ({
                    altitude:     380,
                    altitudeMode: 'ground-offset',
                    pitch:        -35,
                })),
                replayExportBaseView: vi.fn(() => ({
                    sample,
                    heading:      0.2,
                    pitch:        -1,
                    cameraHeight: 1320,
                })),
                clipReplayHeadingForProgress: vi.fn(() => 0.4),
                targetSampleForClip: vi.fn(() => sample),
                cameraAltitudeForSample: vi.fn(() => 460),
                markerRenderHeightForSample: vi.fn(() => 80),
            },
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {camera: {positionMode: 'system'}}}},
        })

        const plan = resolveJourneyReplayClipCameraPlan(mode, {
            clip:        {clipId: 'launch', params: {duration: 2, altitude: 380, pitch: -35}},
            slot:        REPLAY_CLIP_SLOT_START,
            sample,
            startCamera: {sample, heading: 0.1, pitch: -0.8, height: 2000},
        })

        expect(plan.startView.height).toBe(80)
        expect(plan.endView.height).toBe(460)
        expect(plan.endView.height).toBeGreaterThan(plan.startView.height)
    })

    it('synchronizes a zoom-in endpoint with the ground pose of a following launch', async () => {
        const replaySample = {longitude: 2, latitude: 48, altitude: 120}
        const launchSample = {longitude: 2.001, latitude: 48.001, altitude: 125}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: false,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cameraSettingsForClip: vi.fn(() => ({altitude: 900, pitch: -35})),
                replayExportBaseView: vi.fn(() => ({
                    sample:       replaySample,
                    heading:      0.2,
                    pitch:        -1,
                    cameraHeight: 1200,
                })),
                clipReplayHeadingForProgress: vi.fn(() => 0.4),
                targetSampleForClip: vi.fn(() => launchSample),
                cameraAltitudeForSample: vi.fn((_target, cameraSettings) => cameraSettings?.altitude ?? 1200),
                markerRenderHeightForSample: vi.fn(() => 80),
            },
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {camera: {positionMode: 'system'}}}},
        })

        const plan = await resolveJourneyReplayClipCameraPlan(mode, {
            clip: {
                clipId: 'zoom-in',
                params: {duration: 2, altitude: 900, pitch: -35},
            },
            slot: REPLAY_CLIP_SLOT_START,
            sample: replaySample,
            startCamera: {sample: replaySample, heading: 0.1, pitch: -0.8, height: 2000},
            nextClip: {clipId: 'take-off', params: {duration: 2, altitude: 900, pitch: -35}},
        })

        expect(plan.endView).toEqual(expect.objectContaining({
            sample: launchSample,
            height: 80,
            pitch: -0.8,
        }))
        expect(plan.endView.cameraSettings).toEqual(expect.objectContaining({altitudeMode: 'constant'}))
    })

    it('assigns replay and take-off boundaries to the element that defines their entry pose', () => {
        expect(replayElementBoundaryOwner({
            previous: {type: 'clip', clipId: 'zoom-out'},
            next:     {type: 'replay'},
        })).toBe('next')
        expect(replayElementBoundaryOwner({
            previous: {type: 'clip', clipId: 'zoom-in'},
            next:     {type: 'take-off'},
        })).toBe('next')
        expect(replayElementBoundaryOwner({
            previous: {type: 'replay'},
            next:     {type: 'landing'},
        })).toBe('previous')
    })

    it('ends the final start clip on the exact replay entry pose', async () => {
        const replaySample = {longitude: 2, latitude: 48, altitude: 120}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: false,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cameraSettingsForClip: vi.fn(() => ({altitude: 900, pitch: -35})),
                replayExportBaseView: vi.fn(() => ({
                    sample:       replaySample,
                    heading:      0.6,
                    pitch:        -1.1,
                    cameraHeight: 1400,
                })),
                clipReplayHeadingForProgress: vi.fn(() => 0.6),
                targetSampleForClip: vi.fn(() => replaySample),
                cameraAltitudeForSample: vi.fn(() => 1400),
                markerRenderHeightForSample: vi.fn(() => 80),
            },
        }
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {camera: {positionMode: 'system', pitch: -63}}}},
        })

        const plan = await resolveJourneyReplayClipCameraPlan(mode, {
            clip:        {clipId: 'zoom-out', params: {duration: 2}},
            slot:        REPLAY_CLIP_SLOT_START,
            sample:      replaySample,
            startCamera: {sample: replaySample, heading: 0.1, pitch: -0.8, height: 2500},
            nextElement: {type: 'replay'},
        })

        expect(plan.endView).toEqual(expect.objectContaining({
            sample:  replaySample,
            heading: 0.6,
            height:  1400,
        }))
        expect(plan.endView.pitch).toBeCloseTo(-1.099557, 5)
    })

    it('uses the shared path for a live focus clip', async () => {
        const focus = vi.fn()
        const cameraRecenterFrame = vi.fn(() => ({destination: {}, direction: {}, correctedUp: {}}))
        const startDeterministicCameraTransition = vi.fn(() => true)
        const applyDeterministicCameraTransition = vi.fn()
        const endSample = {longitude: 2.3, latitude: 48.3, altitude: 130}
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: false,
                clipSequenceToken:      1,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                setContinuousRender: vi.fn(),
                isReplayVideoLinked: vi.fn(() => false),
                applyJourneyReplayPOIVisibility: vi.fn(),
                interpolateReplayExportSample: vi.fn((start, end, ratio) => ratio < 1 ? start : end),
                cameraRecenterFrame,
                startDeterministicCameraTransition,
                applyDeterministicCameraTransition,
            },
        }
        vi.stubGlobal('lgs', {
            theJourney: {focus},
            scene:      {requestRender: vi.fn()},
        })

        const result = await applyJourneyReplayClipCameraPlan(mode, {
            kind: 'focus',
            duration: 0,
            rpm:  4,
            startView: {
                sample:  {longitude: 2, latitude: 48, altitude: 100},
                heading: 0.1,
                pitch:   -1,
                height:  2000,
            },
            endView: {
                sample:  endSample,
                heading: 0.2,
                pitch:   -0.8,
                height:  5000,
                cameraSettings: {altitude: 5000},
            },
        }, {token: 1})

        expect(focus).not.toHaveBeenCalled()
        expect(startDeterministicCameraTransition).toHaveBeenCalledWith(expect.objectContaining({
            sample:        endSample,
            duration:     0,
            logicalNow:    0,
        }))
        expect(applyDeterministicCameraTransition).toHaveBeenCalledWith(0)
        expect(result.endView.sample).toEqual(endSample)
        expect(result.endView.cameraSettings).toEqual({altitude: 5000})
    })

    it.each([
        ['zoom-in', {sample: {longitude: 2, latitude: 48, altitude: 100}, height: 1200}],
        ['take-off', {sample: {longitude: 2.1, latitude: 48.1, altitude: 110}, height: 5000}],
        ['launch', {sample: {longitude: 2.1, latitude: 48.1, altitude: 110}, height: 5000}],
        ['zoom-out', {sample: {longitude: 2.2, latitude: 48.2, altitude: 120}, height: 5000}],
        ['focus', {sample: {longitude: 2.3, latitude: 48.3, altitude: 130}, height: 5000}],
        ['landing', {sample: {longitude: 2.4, latitude: 48.4, altitude: 30}, height: 50}],
    ])('keeps camera continuity through the %s clip boundary', (clipId, expectedEnd) => {
        const entryCamera = {
            sample:  {longitude: 2, latitude: 48, altitude: 100},
            heading: 0.1,
            pitch:   -1,
            height:  2000,
        }
        const targetSamples = {
            'zoom-in': {longitude: 2, latitude: 48, altitude: 100},
            'take-off': {longitude: 2.1, latitude: 48.1, altitude: 110},
            launch:     {longitude: 2.1, latitude: 48.1, altitude: 110},
            'zoom-out': {longitude: 2.2, latitude: 48.2, altitude: 120},
            focus:      {longitude: 2.3, latitude: 48.3, altitude: 130},
            landing:    {longitude: 2.4, latitude: 48.4, altitude: 30},
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                logicalCameraTrajectory: false,
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cameraSettingsForClip: vi.fn(() => ({altitude: 5000, pitch: -45})),
                replayExportBaseView: vi.fn(() => ({
                    sample:       entryCamera.sample,
                    heading:      0.2,
                    pitch:        -1,
                    cameraHeight: 1200,
                })),
                clipReplayHeadingForProgress: vi.fn(() => 0.4),
                targetSampleForClip: vi.fn(() => targetSamples[clipId]),
                cameraAltitudeForSample: vi.fn((_target, cameraSettings) => cameraSettings?.altitude ?? 1200),
                markerRenderHeightForSample: vi.fn(() => 30),
                focusTargetSampleForReplayExport: vi.fn(() => targetSamples.focus),
            },
        }
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            altitudeMode: 'constant',
                            altitude: 1200,
                            pitch: -65,
                            heading: 0,
                        },
                    },
                },
            },
        })

        const plan = resolveJourneyReplayClipCameraPlan(mode, {
            clip: {
                clipId,
                params: {
                    duration: 2,
                    altitude: 5000,
                    pitch: -45,
                },
            },
            slot:  REPLAY_CLIP_SLOT_STOP,
            sample: entryCamera.sample,
            startCamera: entryCamera,
        })

        const expectedStart = clipId === 'take-off' || clipId === 'launch'
            ? {
                sample: targetSamples[clipId],
                height: 30,
            }
            : clipId === 'zoom-in'
                ? {
                    sample: targetSamples[clipId],
                    height: 5000,
                }
            : entryCamera
        expect(plan.startView).toEqual(expect.objectContaining(expectedStart))
        expect(plan.endView).toEqual(expect.objectContaining({
            sample: expectedEnd.sample,
            height: expectedEnd.height,
        }))
    })
})
