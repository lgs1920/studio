/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-relaunch-regression.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified on: 2026-06-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VideoRecorderToolbar }         from '@Components/MainUI/video/toolbox/VideoRecorderToolbar'
import { VideoSceneWidgetsPortal }      from '@Components/MainUI/video/VideoSceneWidgetsPortal'
import { VIDEO_WIDGETS_BOARD }          from '@Core/constants'
import { ScreenMediaRecorder }          from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                        from 'valtio'
import { proxyMap }                     from 'valtio/utils'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        success: vi.fn(),
        warning: vi.fn(),
        error:   vi.fn(),
    },
}))

vi.mock('@Utils/UnitUtils', () => ({
    DISTANCE_UNITS: ['km'],
    km:             'km',
    UnitUtils: {
        convert: vi.fn(value => ({
            to:          () => Number(value) || 0,
            toTime:      () => '1s',
            toBytesUnit: () => '1 MB',
        })),
    },
}))

vi.mock('@Components/MainUI/widgets/DynamicWidget', () => ({
    DynamicWidget: () => <div data-testid="dynamic-widget"/>,
}))

vi.mock('@Core/ui/replay/ReplayVideoOverlayComposer', () => ({
    isReplayVideoWidgetReady: vi.fn(() => true),
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
    WaTooltip: ({children}) => <span>{children}</span>,
}))

class FakeRecorder extends EventTarget {
    constructor() {
        super()
        this.recording = false
        this.mediaData = {duration: 0}
        this.stopVideo = vi.fn()
        this.cancelVideo = vi.fn(async () => undefined)
        this.pauseVideo = vi.fn()
        this.resumeVideo = vi.fn()
    }

    isRecording = () => this.recording
}

describe('video recording relaunch regression', () => {
    let recorder
    let widgetManager
    let widgetCache
    let replaySync
    let board

    beforeEach(() => {
        recorder = new FakeRecorder()
        widgetManager = {
            invalidateRuntimeByBoard: vi.fn(),
            rehydrateWidgetsByBoard:   vi.fn(async () => 1),
        }
        widgetCache = {
            restoreAllHiddenWidgetsExcept: vi.fn(),
        }
        replaySync = {
            stopJourneyReplay: vi.fn(),
        }

        globalThis.__ = {
            device: {
                isMobile: false,
            },
            recorder,
            ui: {
                replayVideoSync: replaySync,
                widgetCache,
                widgetManager,
            },
        }

        globalThis.lgs = {
            settings: {
                unitSystem: proxy({current: 0}),
            },
            stores: {
                ui: proxy({
                    drawers: proxy({
                        open: null,
                    }),
                    video: proxy({
                        editing:      false,
                        recording:    true,
                        preRecording: false,
                        snapshot:     false,
                        finalizing:   false,
                        paused:       false,
                        step:         2,
                        maxSize:      100,
                        maxDuration:  10,
                        cropper:      proxy({}),
                    }),
                    widget: proxy({
                        restrictions: proxyMap([
                            ['scene-widget-1', {top: '10px', left: '20px', board: 'scene'}],
                        ]),
                        list: proxyMap([
                            ['video-widget-1', {widgetsBoard: VIDEO_WIDGETS_BOARD, zIndex: 1}],
                        ]),
                    }),
                }),
                replay: proxy({
                    active: false,
                    playing: false,
                    paused: false,
                    mainUiHidden: false,
                    clipSequenceActive: false,
                    progress: 0,
                    sample: null,
                    totalDistance: 0,
                    direction: 1,
                    elapsedMillis: null,
                    durationMillis: null,
                    recordingSync: false,
                }),
            },
        }

        board = document.createElement('div')
        board.id = VIDEO_WIDGETS_BOARD
        board.className = 'defined'
        board.getBoundingClientRect = () => ({
            left:   0,
            top:    0,
            right:  640,
            bottom: 360,
            width:  640,
            height: 360,
        })
        document.body.appendChild(board)
    })

    afterEach(() => {
        cleanup()
        board?.remove()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('cleans the video session on a normal stop so the next video session can rehydrate the board', async () => {
        const view = render(<VideoRecorderToolbar/>)

        recorder.recording = true
        act(() => {
            recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.STOP))
        })

        await waitFor(() => {
            expect(widgetCache.restoreAllHiddenWidgetsExcept).not.toHaveBeenCalled()
            expect(lgs.stores.ui.video.step).toBeNull()
            expect(lgs.stores.ui.video.recording).toBe(false)
        })

        lgs.stores.ui.video.editing = true
        lgs.stores.ui.video.step = 0

        const portal = render(<VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper} hidden/>)

        expect(widgetManager.invalidateRuntimeByBoard).not.toHaveBeenCalled()
        expect(widgetManager.rehydrateWidgetsByBoard).not.toHaveBeenCalled()

        lgs.stores.ui.video.editing = false
        lgs.stores.ui.video.preRecording = true
        portal.rerender(<VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper}/>)

        await waitFor(() => {
            expect(widgetManager.invalidateRuntimeByBoard).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
            expect(widgetManager.rehydrateWidgetsByBoard).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        })

        portal.unmount()
        view.unmount()
    })

    it('keeps video widgets mounted while recording is starting after the editor closes', async () => {
        globalThis.lgs.stores.ui.video.editing = false
        globalThis.lgs.stores.ui.video.recording = false
        globalThis.lgs.stores.ui.video.preRecording = true

        render(<VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper}/>)

        expect(screen.getByTestId('dynamic-widget')).not.toBeNull()
        await waitFor(() => {
            expect(widgetManager.rehydrateWidgetsByBoard).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        })
    })

    it('keeps the editor preview mounted without rehydrating while capture is inactive', async () => {
        globalThis.lgs.stores.ui.video.editing = true
        globalThis.lgs.stores.ui.video.recording = false
        globalThis.lgs.stores.ui.video.preRecording = false
        globalThis.lgs.stores.ui.video.snapshot = false
        globalThis.lgs.stores.ui.video.finalizing = false

        render(<VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper}/>)

        await waitFor(() => {
            expect(screen.getByTestId('dynamic-widget')).not.toBeNull()
        })

        expect(widgetManager.invalidateRuntimeByBoard).not.toHaveBeenCalled()
        expect(widgetManager.rehydrateWidgetsByBoard).not.toHaveBeenCalled()
    })

    it('rehydrates video widgets when capture actually starts and stays stable across editor state changes', async () => {
        globalThis.lgs.stores.ui.video.editing = true
        globalThis.lgs.stores.ui.video.recording = false

        const view = render(<VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper}/>)

        expect(widgetManager.rehydrateWidgetsByBoard).not.toHaveBeenCalled()

        globalThis.lgs.stores.ui.video.preRecording = true

        await waitFor(() => {
            expect(widgetManager.rehydrateWidgetsByBoard).toHaveBeenCalledTimes(1)
        })

        globalThis.lgs.stores.ui.video.editing = false
        view.rerender(<VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper}/>)

        expect(widgetManager.rehydrateWidgetsByBoard).toHaveBeenCalledTimes(1)

        globalThis.lgs.stores.ui.video.recording = true
        await waitFor(() => {
            expect(widgetManager.rehydrateWidgetsByBoard).toHaveBeenCalledTimes(1)
        })

        globalThis.lgs.stores.ui.video.recording = false
        globalThis.lgs.stores.ui.video.preRecording = false
        await waitFor(() => {
            expect(widgetManager.invalidateRuntimeByBoard).toHaveBeenCalledTimes(1)
        })

        globalThis.lgs.stores.ui.video.preRecording = true
        await waitFor(() => {
            expect(widgetManager.rehydrateWidgetsByBoard).toHaveBeenCalledTimes(2)
        })

        view.unmount()
    })

    it('shows replay progression in the recorder toolbar when the sync link is active', () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.sample = {
            progress: 0.5,
            distanceFromStart: 50,
            remainingDistance: 50,
        }
        globalThis.lgs.stores.replay.totalDistance = 100
        globalThis.lgs.stores.replay.elapsedMillis = 60000
        globalThis.lgs.stores.replay.durationMillis = 120000

        render(<VideoRecorderToolbar/>)

        expect(screen.getByText('00:01 / 00:02')).not.toBeNull()
        expect(screen.getByText('50.0 / 100.0 km')).not.toBeNull()
        expect(screen.getByText('50%')).not.toBeNull()
        expect(screen.queryByText(/fps/i)).toBeNull()
    })

    it('uses the draft video timeline for replay percent while clips are recording', async () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.clipSequenceActive = true
        globalThis.lgs.stores.replay.deferredExportPlan = {
            videoTimeline: {
                durationMillis: 200000,
            },
        }

        render(<VideoRecorderToolbar/>)

        act(() => {
            recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
                detail: {
                    duration: 30000,
                    size:     0,
                },
            }))
        })

        await waitFor(() => {
            expect(screen.getByText('15%')).not.toBeNull()
        })
        expect(screen.queryByText('50%')).toBeNull()
    })

    it('uses the configured replay duration and clips before the export plan is ready', async () => {
        globalThis.lgs.stores.ui.video.preRecording = false
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.duration = 100
        globalThis.lgs.stores.replay.durationMillis = 300000
        globalThis.lgs.stores.replay.clips = {
            start: [{params: {duration: 10}, enabled: true}],
            stop:  [{params: {duration: 10}, enabled: true}],
        }

        render(<VideoRecorderToolbar/>)

        act(() => {
            recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
                detail: {
                    duration: 60000,
                    size:     0,
                },
            }))
        })

        await waitFor(() => {
            expect(screen.getByText('50%')).not.toBeNull()
        })
    })

    it('starts Draft progress at zero while the recorder is preparing', () => {
        globalThis.lgs.stores.ui.video.preRecording = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.sample = {progress: 0.9}
        globalThis.lgs.stores.replay.dynamicFrameState = {
            replayFrameIndex: 90,
            replayFrameCount: 101,
        }

        render(<VideoRecorderToolbar/>)

        expect(screen.getByText('0%')).not.toBeNull()
        expect(screen.queryByText('90%')).toBeNull()
    })

    it('keeps Draft replay progress monotonic and reaches 100 percent on stop', async () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.deferredExportPlan = {
            videoTimeline: {
                durationMillis: 200000,
            },
        }

        render(<VideoRecorderToolbar/>)

        expect(screen.getByText('0%')).not.toBeNull()

        act(() => {
            recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
                detail: {
                    duration: 150000,
                    size:     0,
                },
            }))
            recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.INFO, {
                detail: {
                    duration: 100000,
                    size:     0,
                },
            }))
        })

        await waitFor(() => {
            expect(screen.getByText('75%')).not.toBeNull()
        })
        expect(screen.queryByText('50%')).toBeNull()

        act(() => {
            recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.STOP, {
                detail: {
                    duration: 200000,
                    size:     0,
                },
            }))
        })

        await waitFor(() => {
            expect(screen.getByText('100%')).not.toBeNull()
        })
    })

    it('shows a compact mobile replay summary without totals', () => {
        globalThis.__.device.isMobile = true
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.sample = {
            progress: 0.5,
            distanceFromStart: 50,
            remainingDistance: 50,
        }
        globalThis.lgs.stores.replay.totalDistance = 100
        globalThis.lgs.stores.replay.elapsedMillis = 60000
        globalThis.lgs.stores.replay.durationMillis = 120000

        render(<VideoRecorderToolbar/>)

        expect(screen.queryByText('00:01')).toBeNull()
        expect(screen.queryByText('50.0 km')).toBeNull()
        expect(screen.queryByText('00:01 / 00:02')).toBeNull()
        expect(screen.queryByText('50.0 / 100.0 km')).toBeNull()
        expect(screen.getByText('50%')).not.toBeNull()
    })

    it('keeps the mobile replay summary rendered inline', () => {
        globalThis.__.device.isMobile = true
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.playing = true
        globalThis.lgs.stores.replay.sample = {
            progress: 0.5,
            distanceFromStart: 50,
            remainingDistance: 50,
        }
        globalThis.lgs.stores.replay.totalDistance = 100
        globalThis.lgs.stores.replay.elapsedMillis = 60000
        globalThis.lgs.stores.replay.durationMillis = 120000

        render(<VideoRecorderToolbar/>)

        const percent = screen.getByText('50%')
        expect(percent.closest('.video-recorder-replay-progress')).not.toBeNull()
        expect(percent.closest('.video-recorder-widget')).not.toBeNull()
    })

    it('keeps the stop action available while recording is paused', () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.ui.video.paused = true

        render(<VideoRecorderToolbar/>)

        fireEvent.click(screen.getByRole('button', {name: 'Stop recording'}))

        expect(recorder.stopVideo).toHaveBeenCalledTimes(1)
        expect(lgs.stores.ui.video.finalizing).toBe(true)
    })

    it('restores the capture UI when the recording is aborted from the toolbar', async () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.ui.video.editing = false
        globalThis.lgs.stores.replay.mainUiHidden = true

        render(<VideoRecorderToolbar/>)

        await fireEvent.pointerDown(document.getElementById('video-recorder-cancel'))

        await waitFor(() => {
            expect(recorder.cancelVideo).toHaveBeenCalledTimes(1)
        })

        expect(widgetCache.restoreAllHiddenWidgetsExcept).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        expect(lgs.stores.replay.mainUiHidden).toBe(false)
        expect(lgs.stores.ui.video.recording).toBe(false)
        expect(lgs.stores.ui.video.preRecording).toBe(false)
        expect(lgs.stores.ui.video.editing).toBe(true)
    })

    it('keeps the preparation state free of a second record action', () => {
        globalThis.lgs.stores.replay.recordingSync = true
        const view = render(<VideoRecorderToolbar/>)

        expect(document.getElementById('video-recorder-play-pause')?.getAttribute('appearance')).toBe('plain')
        expect(document.getElementById('video-recorder-stop')?.getAttribute('appearance')).toBe('plain')
        expect(document.querySelector('[id$="-snapshot"]')?.getAttribute('appearance')).toBe('plain')
        expect(document.getElementById('video-recorder-cancel')?.getAttribute('appearance')).toBe('plain')

        act(() => {
            globalThis.lgs.stores.ui.video.recording = false
            globalThis.lgs.stores.ui.video.preRecording = true
        })
        view.rerender(<VideoRecorderToolbar/>)

        expect(document.getElementById('video-recorder-start-recording')).toBeNull()
        expect(screen.getByText('Preparing...')).not.toBeNull()
    })
})
