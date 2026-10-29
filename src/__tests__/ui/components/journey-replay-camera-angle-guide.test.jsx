/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-replay-camera-angle-guide.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-29
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {useState} from 'react'
import {VIDEO_CROP_ZONE} from '@Core/constants'

const guideHarness = vi.hoisted(() => ({
    mount:   vi.fn(() => true),
    remove:  vi.fn(),
    changeEvent: 'lgs:replay:camera-angle-guide-change',
    resolve: vi.fn(({camera, sample}) => ({
        angleDegrees: camera.cameraAngle ?? 180,
        anchor: sample
            ? {height: sample.altitude, latitude: sample.latitude, longitude: sample.longitude}
            : {height: 0, latitude: 48, longitude: 2},
        coneHeading: (camera.cameraAngle ?? 180) * Math.PI / 180,
        followViewerHeading: Boolean(sample),
    })),
    update: vi.fn(() => true),
}))

vi.mock('@Core/ui/replay/JourneyReplayCameraAngleGuide', () => ({
    REPLAY_CAMERA_ANGLE_GUIDE_CHANGE_EVENT: guideHarness.changeEvent,
    mountJourneyReplayCameraAngleGuide: guideHarness.mount,
    removeJourneyReplayCameraAngleGuide: guideHarness.remove,
    resolveJourneyReplayCameraAngleGuide: guideHarness.resolve,
    updateJourneyReplayCameraAngleGuide: guideHarness.update,
}))

vi.mock('@Core/ui/replay/JourneyReplayRuntime', async importOriginal => ({
    ...await importOriginal(),
    isJourneyReplayCameraActive: replay => Boolean(
        replay?.active || replay?.playing || replay?.paused || replay?.clipSequenceActive,
    ),
    isJourneyReplayDryRunActive: (replay, video) => replay?.recordingSync === true
        && Boolean(replay?.active || replay?.playing || replay?.paused || replay?.clipSequenceActive)
        && video?.preRecording !== true
        && video?.exporting !== true
        && video?.snapshot !== true
        && video?.finalizing !== true,
    isJourneyReplayVideoCaptureActive: () => false,
}))

import {JourneyReplayCameraAngleGuide} from '@Components/JourneyReplay/JourneyReplayCameraAngleGuide'

afterEach(() => {
    cleanup()
    document.getElementById(VIDEO_CROP_ZONE)?.remove()
    document.querySelector('[data-test-cone-tools-root]')?.remove()
    vi.clearAllMocks()
    globalThis.lgs = undefined
    globalThis.__ = undefined
})

describe('JourneyReplayCameraAngleGuide component', () => {
    it('moves the Expert map guide with the live replay sample', async () => {
        const journey = {
            slug:   'journey-a',
            tracks: new Map(),
        }
        const replaySettings = proxy({
            userMode: 'expert',
            camera: {
                cameraAngle: 20,
            },
        })
        const replay = proxy({
            active:        false,
            liveSample:    null,
            sample:        null,
            recordingSync: false,
        })
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: replaySettings,
                },
            },
            stores: {
                main: proxy({theJourney: journey}),
                replay,
                ui: {
                    drawers: proxy({open: null}),
                    video: proxy({
                        editing:      false,
                        preRecording: false,
                        exporting:  false,
                        snapshot:     false,
                        finalizing:   false,
                    }),
                },
            },
            viewer: {},
        }

        render(<JourneyReplayCameraAngleGuide/>)
        expect(guideHarness.mount).not.toHaveBeenCalled()

        const sample = {
            longitude:  2.5,
            latitude:   48.5,
            altitude:   150,
            source: {
                startPoint: {longitude: 2.49, latitude: 48.5, altitude: 145},
                endPoint:   {longitude: 2.51, latitude: 48.5, altitude: 155},
            },
        }
        act(() => {
            replay.active = true
            replay.liveSample = sample
        })

        await waitFor(() => {
            expect(guideHarness.mount).toHaveBeenCalled()
            expect(guideHarness.mount).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({angleDegrees: 20}),
                {routeFillColor: '#ff6a00', routeBorderColor: '#ffffff'},
                expect.objectContaining({onCameraChange: expect.any(Function), screenLocked: false}),
            )
            expect(guideHarness.resolve).toHaveBeenLastCalledWith(expect.objectContaining({sample}))
            expect(guideHarness.update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
                anchor: {height: 150, latitude: 48.5, longitude: 2.5},
            }), expect.objectContaining({onCameraChange: expect.any(Function)}))
        })

        act(() => {
            replaySettings.camera.cameraAngle = 35
        })

        await waitFor(() => {
            expect(guideHarness.resolve).toHaveBeenLastCalledWith(expect.objectContaining({
                camera: expect.objectContaining({cameraAngle: 35}),
                sample,
            }))
            expect(guideHarness.update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
                angleDegrees: 35,
                coneHeading: (35 * Math.PI) / 180,
            }), expect.objectContaining({onCameraChange: expect.any(Function)}))
        })
        expect(guideHarness.mount).toHaveBeenCalledTimes(1)
    })

    it.each(['basic', undefined])('constrains preparation with mode %s and a crop mounted outside the tools root', async userMode => {
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: proxy({
                        userMode,
                        camera: {
                            cameraAngle: 10,
                        },
                    }),
                },
            },
            stores: {
                main: proxy({theJourney: {slug: 'journey-a', tracks: new Map()}}),
                replay: proxy({active: false, liveSample: null, sample: null}),
                ui: {
                    drawers: proxy({open: null}),
                    video: proxy({
                        editing:      true,
                        preRecording: false,
                        exporting:  false,
                        snapshot:     false,
                        finalizing:   false,
                    }),
                },
            },
            viewer: {},
        }

        const toolsRoot = document.createElement('div')
        toolsRoot.id = 'lgs-tools-ui'
        toolsRoot.dataset.testConeToolsRoot = 'true'
        document.body.append(toolsRoot)
        /** Replace the crop from its own React lifecycle without rerendering the guide sibling. */
        const Crop = () => {
            const [version, setVersion] = useState(0)
            return <>
                <div id={VIDEO_CROP_ZONE} key={version}/>
                <button onClick={() => setVersion(current => current + 1)}>Replace crop</button>
            </>
        }
        const {container, getByRole} = render(
            <>
                <JourneyReplayCameraAngleGuide/>
                <Crop/>
            </>,
        )
        const cropElement = container.querySelector(`#${VIDEO_CROP_ZONE}`)

        await waitFor(() => expect(guideHarness.mount).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                anchor: {height: 0, latitude: 48, longitude: 2},
            }),
            {routeFillColor: '#ff6a00', routeBorderColor: '#ffffff'},
            expect.objectContaining({
                cropElement,
                onCameraChange: expect.any(Function),
                screenLocked: true,
            }),
        ))

        await waitFor(() => expect(guideHarness.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({cropElement}),
        ))
        const initialUpdateCount = guideHarness.update.mock.calls.length
        act(() => {
            globalThis.lgs.stores.replay.videoCropRect = {left: 20, top: 30, width: 640, height: 360}
        })
        await waitFor(() => expect(guideHarness.update).toHaveBeenCalledTimes(initialUpdateCount + 1))

        fireEvent.click(getByRole('button', {name: 'Replace crop'}))
        const replacementCrop = container.querySelector(`#${VIDEO_CROP_ZONE}`)
        expect(replacementCrop).not.toBe(cropElement)
        await waitFor(() => expect(guideHarness.mount).toHaveBeenLastCalledWith(
            expect.anything(), expect.anything(), {routeFillColor: '#ff6a00', routeBorderColor: '#ffffff'},
            expect.objectContaining({cropElement: replacementCrop, screenLocked: true}),
        ))
    })

    it('shows the cone during Basic Replay using its effective trace-relative camera', async () => {
        const sample = {
            longitude:  2.5,
            latitude:   48.5,
            altitude:   150,
            source: {
                startPoint: {longitude: 2.49, latitude: 48.5, altitude: 145},
                endPoint:   {longitude: 2.51, latitude: 48.5, altitude: 155},
            },
        }
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: proxy({
                        userMode: 'basic',
                        camera: {
                            cameraAngle: 180,
                        },
                    }),
                },
            },
            stores: {
                main: proxy({theJourney: {slug: 'journey-a', tracks: new Map()}}),
                replay: proxy({active: false, liveSample: null, sample: null, basicPreparationActive: true}),
                ui: {
                    drawers: proxy({open: null}),
                    video: proxy({
                        editing:      true,
                        preRecording: false,
                        exporting:  false,
                        snapshot:     false,
                        finalizing:   false,
                    }),
                },
            },
            viewer: {},
        }

        render(<JourneyReplayCameraAngleGuide/>)

        await waitFor(() => {
            expect(guideHarness.mount).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({angleDegrees: 0}),
                {routeFillColor: '#ff6a00', routeBorderColor: '#ffffff'},
                expect.objectContaining({onCameraChange: expect.any(Function), screenLocked: true}),
            )
            expect(guideHarness.resolve).toHaveBeenLastCalledWith(expect.objectContaining({
                camera: expect.objectContaining({cameraAngle: 0}),
            }))
        })

        act(() => {
            globalThis.lgs.stores.replay.active = true
            globalThis.lgs.stores.replay.liveSample = sample
            globalThis.lgs.stores.replay.sample = sample
        })

        await waitFor(() => {
            expect(guideHarness.resolve).toHaveBeenLastCalledWith(expect.objectContaining({
                camera: expect.objectContaining({cameraAngle: 0}),
                sample,
            }))
        })
    })

    it('hides the camera angle guide during linked Replay dry run', async () => {
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: proxy({
                        userMode: 'expert',
                        camera: {cameraAngle: 10},
                    }),
                },
            },
            stores: {
                main: proxy({theJourney: {slug: 'journey-a', tracks: new Map()}}),
                replay: proxy({active: true, liveSample: null, sample: null, recordingSync: true}),
                ui: {
                    drawers: proxy({open: null}),
                    video: proxy({
                        editing: true,
                        preRecording: false,
                        exporting: false,
                        snapshot: false,
                        finalizing: false,
                    }),
                },
            },
            viewer: {},
        }

        render(<JourneyReplayCameraAngleGuide/>)
        await waitFor(() => expect(guideHarness.remove).toHaveBeenCalled())
        expect(guideHarness.mount).not.toHaveBeenCalled()
    })

    it('persists dragged cone angle and altitude through Basic camera settings', async () => {
        const basicCamera = {
            altitude: 1200,
            cameraAngle: 180,
        }
        const journey = {
            replay: {basic: {camera: {...basicCamera}}},
            slug: 'journey-a',
            tracks: new Map(),
        }
        const settings = proxy({
            userMode: 'basic',
            camera: {...basicCamera},
            basic: {camera: {...basicCamera}},
        })
        const refresh = vi.fn()
        const refreshCamera = vi.fn()
        globalThis.__ = {ui: {replay: {refresh, refreshCamera}}}
        globalThis.lgs = {
            settings: {ui: {replay: settings}},
            stores: {
                main: proxy({theJourney: journey}),
                replay: proxy({active: false, liveSample: null, sample: null}),
                ui: {
                    drawers: proxy({open: null}),
                    video: proxy({editing: true, preRecording: false, exporting: false, snapshot: false, finalizing: false}),
                },
            },
            viewer: {},
        }

        render(<JourneyReplayCameraAngleGuide/>)
        await waitFor(() => expect(guideHarness.mount).toHaveBeenCalled())
        await act(async () => {
            guideHarness.mount.mock.calls.at(-1)[3].onCameraChange({altitude: 600, cameraAngle: -150})
        })

        expect(settings.basic.camera).not.toHaveProperty('altitude')
        expect(settings.basic.camera.cameraAngle).toBe(0)
        expect(journey.replay.basic.camera).toMatchObject({altitude: 600, cameraAngle: -150})
        expect(globalThis.lgs.stores.replay.camera).toMatchObject({altitude: 600, cameraAngle: -150})
        expect(refresh).not.toHaveBeenCalled()
        expect(refreshCamera).toHaveBeenCalledExactlyOnceWith({
            preparation: true,
            sample: null,
            source: 'camera-angle-guide',
            suppressMoveEvents: true,
        })
    })

    it('persists an Expert camera angle and previews the prepared Cesium view', async () => {
        const journey = {replay: {expert: {camera: {altitude: 900, cameraAngle: 180}}}}
        const refresh = vi.fn()
        const refreshCamera = vi.fn()
        globalThis.__ = {ui: {replay: {refresh, refreshCamera}}}
        const settings = proxy({
            userMode: 'expert',
            camera: {altitude: 900, cameraAngle: 180},
        })
        globalThis.lgs = {
            theJourney: journey,
            settings: {ui: {replay: settings}},
            stores: {
                main: proxy({theJourney: journey}),
                replay: proxy({active: false, liveSample: null, sample: null}),
                ui: {
                    drawers: proxy({open: null}),
                    video: proxy({editing: true, preRecording: false, exporting: false, snapshot: false, finalizing: false}),
                },
            },
            viewer: {},
        }

        render(<JourneyReplayCameraAngleGuide/>)
        await waitFor(() => expect(guideHarness.mount).toHaveBeenCalled())
        await act(async () => {
            guideHarness.mount.mock.calls.at(-1)[3].onCameraChange({
                altitude: 900,
                cameraAngle: -40,
            })
        })

        expect(settings.camera).not.toHaveProperty('altitude')
        expect(settings.camera.cameraAngle).toBe(0)
        expect(journey.replay.expert.camera).toMatchObject({altitude: 900, cameraAngle: -40})
        expect(globalThis.lgs.stores.replay.camera).toMatchObject({altitude: 900, cameraAngle: -40})
        expect(refresh).not.toHaveBeenCalled()
        expect(refreshCamera).toHaveBeenCalledExactlyOnceWith({
            preparation: true,
            sample: null,
            source: 'camera-angle-guide',
            suppressMoveEvents: true,
        })
    })
})
