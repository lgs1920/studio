/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-screen-area-start.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-15
 * Last modified: 2026-07-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, waitFor } from '@testing-library/react'
import { VIDEO_CROP_ZONE, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

vi.mock('@Components/MainUI/video/toolbox/VideoRecorderWidget', () => ({
    VideoRecorderWidget: () => <div data-testid="video-recorder-widget"/>,
}))

vi.mock('@Components/MainUI/video/VideoSceneWidgetsPortal', () => ({
    VideoSceneWidgetsPortal: () => <div data-testid="video-scene-widgets-portal"/>,
}))

vi.mock('@Components/ToolsUI/cropper/CropOverlay', () => ({
    CropOverlay: () => <div data-testid="crop-overlay"/>,
}))

vi.mock('@Components/ToolsUI/cropper/widgets/DefinedCropZone', () => ({
    DefinedCropZone: () => <div id="video-crop-zone" data-testid="defined-crop-zone"/>,
}))

vi.mock('@Components/MainUI/video/VideoSettingsInfo', () => ({
    VideoSettingsInfo: () => <div/>,
}))

vi.mock('@Components/MainUI/video/WidgetMountErrorDialog', () => ({
    WidgetMountErrorDialog: () => null,
}))

vi.mock('@Components/MainUI/video/videoEditingCleanup', () => ({
    prepareVideoCaptureUi: vi.fn(),
}))

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        warning: vi.fn(),
        error:   vi.fn(),
    },
}))

vi.mock('@Core/ui/replay/ReplayDeferredExporter', () => ({
    prepareReplayDeferredExportPlan: vi.fn(() => ({exporter: {}, plan: {runtime: {}}})),
    warmReplayDeferredExportPlan:    vi.fn(),
}))

vi.mock('@Core/ui/replay/ReplayVideoOverlayComposer', () => ({
    buildReplayVideoComposerOverlays: vi.fn(),
    isReplayVideoWidgetReady:         vi.fn(() => true),
}))

vi.mock('@Core/ui/replay/ReplayVideoRenderSpec', () => ({
    buildReplayVideoRenderSpec: vi.fn(() => ({
        fps:          30,
        captureMode:  'speed',
        dimensions:   {width: 640, height: 360},
        cropRect:     {left: 0, top: 0, width: 640, height: 360},
        composerClip: {x: 0, y: 0, width: 640, height: 360},
        outputDpr:    1,
    })),
}))

vi.mock('@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer', () => ({
    CanvasOverlayComposer: vi.fn(function FakeCanvasOverlayComposer() {
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 360
        this.renderFrame = vi.fn(async () => canvas)
        this.getCanvas = vi.fn(() => canvas)
        this.setFps = vi.fn()
        this.setContinuousRendering = vi.fn()
        this.dispose = vi.fn()
    }),
}))

vi.mock('@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder', () => ({
    ScreenMediaRecorder: {
        FPS:     [30],
        QUALITY: [{value: 0}],
        events:  {
            STOP:     'stop',
            CANCEL:   'cancel',
            FINALIZE: 'finalize',
            PAUSE:    'pause',
            RESUME:   'resume',
            START:    'start',
        },
    },
}))

import { VideoRecordingScreenArea } from '@Components/MainUI/video/VideoRecordingScreenArea'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'

describe('VideoRecordingScreenArea start flow', () => {
    let recorder

    beforeEach(() => {
        vi.clearAllMocks()
        globalThis.requestAnimationFrame = vi.fn(callback => {
            setTimeout(callback, 0)
            return 1
        })
        globalThis.cancelAnimationFrame = vi.fn()
        recorder = new EventTarget()
        recorder.initialize = vi.fn()
        recorder.setFrameCaptureReady = vi.fn()
        recorder.setCanvas = vi.fn()
        recorder.startVideo = vi.fn(async () => undefined)
        recorder.captureScreenshot = vi.fn()
        recorder.addEventListener = recorder.addEventListener.bind(recorder)
        recorder.removeEventListener = recorder.removeEventListener.bind(recorder)

        globalThis.__ = {
            device: {
                browser: 'chromium',
            },
            recorder,
            ui: {
                replayVideoSync: {
                    arm: vi.fn(),
                },
                widgetCache: {
                    getAll: vi.fn(({widgetsBoard}) => (
                        widgetsBoard === VIDEO_WIDGETS_BOARD
                            ? new Map([['video-widget-1', {widgetsBoard: VIDEO_WIDGETS_BOARD}]])
                            : new Map()
                    )),
                },
                widgetManager: {
                    syncCropDimensionsFromElement: vi.fn(async () => null),
                    getWidgetConfig: vi.fn(id => id === VIDEO_CROP_ZONE
                        ? {
                            cropDimensions: {left: 0, top: 0, width: 640, height: 360},
                            ratio:          {value: 16 / 9},
                        }
                        : null),
                    disposeByGroup: vi.fn(),
                },
            },
        }

        globalThis.lgs = {
            canvas: document.createElement('canvas'),
            scene:  {
                render: vi.fn(),
            },
            servers: {
                studio: {name: 'LGS1920'},
            },
            settings: {
                ui: {
                    video: proxy({
                        maxSize:     100,
                        maxDuration: 10,
                        captureMode: 'speed',
                    }),
                    replay: proxy({
                        recordingSync: false,
                    }),
                },
            },
            stores: {
                ui: proxy({
                    video: proxy({
                        editing:      false,
                        preRecording: true,
                        recording:    false,
                        snapshot:     false,
                        finalizing:   false,
                        paused:       false,
                        quality:      0,
                        fps:          0,
                        size:         0,
                        cropper:      proxy({id: VIDEO_CROP_ZONE}),
                    }),
                    widget: proxy({
                        list: proxyMap([
                            ['video-widget-1', {widgetsBoard: VIDEO_WIDGETS_BOARD, zIndex: 1}],
                        ]),
                    }),
                }),
                replay: proxy({
                    recordingSync: false,
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        delete globalThis.__
        delete globalThis.lgs
        delete globalThis.requestAnimationFrame
        delete globalThis.cancelAnimationFrame
        delete globalThis.__lgsReplayVideoTrace
    })

    it('starts recording after expected video widgets are ready', async () => {
        render(<VideoRecordingScreenArea/>)

        await waitFor(() => {
            expect(recorder.startVideo).toHaveBeenCalledTimes(1)
        })

        const traceEntries = globalThis.__lgsReplayVideoTrace ?? []
        const traceEvents = traceEntries.map(entry => entry.event)
        expect(traceEvents).toEqual(expect.arrayContaining([
            'draft.recording.initialize.start',
            'draft.recording.ui.prepare.start',
            'draft.recording.ui.prepare.end',
            'draft.recording.crop.sync.start',
            'draft.recording.crop.sync.end',
            'draft.recording.replay-bridge.start',
            'draft.recording.replay-bridge.end',
            'draft.recording.scene-restore.wait.start',
            'draft.recording.scene-restore.wait.end',
            'draft.recording.composer.first-frame.end',
            'draft.recording.initialize.end',
            'draft.recorder.start.begin',
            'draft.recorder.start.end',
        ]))
        expect(traceEntries.find(entry => entry.event === 'draft.recording.initialize.end')?.data).toEqual(expect.objectContaining({
            syncRequested: false,
        }))

        expect(globalThis.lgs.stores.ui.video.preRecording).toBe(false)
        expect(globalThis.lgs.stores.ui.video.recording).toBe(true)
        expect(CanvasOverlayComposer.mock.instances[0].setContinuousRendering).toHaveBeenCalledWith(false)
    })
})
