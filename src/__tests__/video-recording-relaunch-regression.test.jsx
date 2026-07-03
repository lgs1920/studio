/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-relaunch-regression.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified on: 2026-06-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, act, render, screen, waitFor } from '@testing-library/react'
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

        lgs.stores.ui.video.step = 1
        portal.rerender(<VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper}/>)

        await waitFor(() => {
            expect(widgetManager.invalidateRuntimeByBoard).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
            expect(widgetManager.rehydrateWidgetsByBoard).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
        })

        portal.unmount()
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

        expect(screen.getByText('00:01')).not.toBeNull()
        expect(screen.getByText('50.0 km')).not.toBeNull()
        expect(screen.queryByText('00:01 / 00:02')).toBeNull()
        expect(screen.queryByText('50.0 / 100.0 km')).toBeNull()
        expect(screen.queryByText('50%')).toBeNull()
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

        const time = screen.getByText('00:01')
        const distance = screen.getByText('50.0 km')
        expect(time.parentElement).toBe(distance.parentElement)
        expect(time.parentElement.className).toContain('video-recorder-widget')
    })
})
