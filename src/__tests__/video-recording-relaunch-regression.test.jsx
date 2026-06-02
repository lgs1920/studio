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

import { cleanup, act, render, waitFor } from '@testing-library/react'
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
    UnitUtils: {
        convert: vi.fn(() => ({
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
    let flythroughSync
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
        flythroughSync = {
            stopFlythrough: vi.fn(),
        }

        globalThis.__ = {
            recorder,
            ui: {
                flythroughVideoSync: flythroughSync,
                widgetCache,
                widgetManager,
            },
        }

        globalThis.lgs = {
            stores: {
                ui: proxy({
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
            expect(widgetCache.restoreAllHiddenWidgetsExcept).toHaveBeenCalledWith(VIDEO_WIDGETS_BOARD)
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
})
